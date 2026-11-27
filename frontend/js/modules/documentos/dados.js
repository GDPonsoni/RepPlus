import { api } from '../../core/api.js';

// Estado e API do módulo Documentos (mural + Drive)

export const LIMITE_MB = 10;
const EXTENSOES = /\.(pdf|png|jpe?g|webp|gif)$/i;
export const ACEITOS = 'application/pdf,image/png,image/jpeg,image/webp,image/gif';

export const estado = {
    documentos: [],
    carregado: false,
    filtro: '',            // '' = todas as categorias, ou a chave de uma
    drive: {
        status: null,      // GET /documentos/drive/status
        pasta: null,       // resposta de GET /documentos/drive
        escolhendo: null,  // pilha de pastas na escolha da pasta da rep: [{ id, nome }]
        carregando: false
    }
};

export const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const buscarDocumento = (id) => estado.documentos.find(doc => String(doc.id) === String(id));
export const ehImagem = (tipo) => String(tipo || '').startsWith('image/');
export const ehPdf = (tipo) => tipo === 'application/pdf';

export function tamanhoLegivel(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// Mesmos limites do backend, para avisar antes de enviar
export function validarArquivo(arquivo) {
    if (!EXTENSOES.test(arquivo.name)) return 'Tipo de arquivo não permitido. Envie PDF, png, jpg, webp ou gif.';
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
        return `Arquivo muito grande (${tamanhoLegivel(arquivo.size)}). O limite é ${LIMITE_MB}MB.`;
    }
    return null;
}

function substituir(documento) {
    const i = estado.documentos.findIndex(atual => String(atual.id) === String(documento.id));
    if (i >= 0) estado.documentos[i] = documento;
    else estado.documentos.unshift(documento);
    return documento;
}

// ===== MURAL =====
export async function carregarDocumentos() {
    estado.documentos = await api('/documentos');
    estado.carregado = true;
    return estado.documentos;
}

export async function enviarDocumento(arquivo, { titulo, descricao, categoria, ataId } = {}) {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    if (titulo) formData.append('titulo', titulo);
    if (descricao) formData.append('descricao', descricao);
    if (categoria) formData.append('categoria', categoria);
    if (ataId) formData.append('ataId', ataId);
    return substituir(await api('/documentos', { metodo: 'POST', formData }));
}

export async function atualizarDocumento(id, dados) {
    return substituir(await api(`/documentos/${id}`, { metodo: 'PUT', corpo: dados }));
}

export async function excluirDocumento(id) {
    await api(`/documentos/${id}`, { metodo: 'DELETE' });
    estado.documentos = estado.documentos.filter(doc => String(doc.id) !== String(id));
}

// ===== DRIVE =====
export const urlArquivoDrive = (id) => `/api/documentos/drive/arquivo/${encodeURIComponent(id)}`;
export const urlMiniaturaDrive = (id) => `/api/documentos/drive/miniatura/${encodeURIComponent(id)}`;
// Navegação do navegador (não fetch): o servidor manda para a tela de login do Google
export const URL_CONECTAR_DRIVE = '/api/documentos/drive/conectar';

// { configurado, conectado, email, pasta: { id, nome } | null, erro }
export async function carregarStatusDrive({ forcar = false } = {}) {
    if (forcar || !estado.drive.status) estado.drive.status = await api('/documentos/drive/status');
    return estado.drive.status;
}

export async function carregarPastaDrive(pastaId = '') {
    const parametros = pastaId ? `?${new URLSearchParams({ pasta: pastaId })}` : '';
    estado.drive.pasta = await api(`/documentos/drive${parametros}`);
    return estado.drive.pasta;
}

// Escolha da pasta da rep: 'root' (Meu Drive), 'compartilhados' ou o id de uma pasta
export const listarPastasParaEscolher = (pastaId) => api(`/documentos/drive/escolher?${new URLSearchParams({ pasta: pastaId })}`);

export async function escolherPastaDrive(pastaId) {
    estado.drive.status = await api('/documentos/drive/pasta', { metodo: 'PUT', corpo: { pastaId } });
    estado.drive.pasta = null;
    return estado.drive.status;
}

export async function desconectarDrive() {
    estado.drive.status = await api('/documentos/drive/conexao', { metodo: 'DELETE' });
    estado.drive.pasta = null;
    return estado.drive.status;
}
