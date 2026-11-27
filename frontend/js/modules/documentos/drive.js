import { abrirPainel } from '../../core/painel.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { temPermissao } from '../../core/sessao.js';
import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { formatarDia, diaDoInstante } from '../../core/datas.js';
import {
    estado, tamanhoLegivel, carregarStatusDrive, carregarPastaDrive, urlArquivoDrive, urlMiniaturaDrive,
    URL_CONECTAR_DRIVE, listarPastasParaEscolher, escolherPastaDrive, desconectarDrive
} from './dados.js';

// Aba "Drive": a pasta da rep no Google Drive, só para ler. Alguém da administração conecta a
// conta Google da rep uma vez e escolhe a pasta; daí todos veem. O servidor busca tudo no
// Google, então a pasta continua privada.

export const HTML_ABA_DRIVE = `
    <div class="pagina-topo">
        <h2 class="section-title">Google Drive da rep</h2>
        <a id="drive-abrir-pasta" class="btn btn-ghost btn-sm" target="_blank" rel="noopener" hidden><i class="fa-brands fa-google-drive"></i> Abrir no Drive</a>
    </div>
    <div id="drive-conta" class="drive-conta" hidden></div>
    <nav id="drive-caminho" class="drive-caminho" aria-label="Pastas"></nav>
    <div id="drive-lista" class="drive-lista"></div>
`;

const podeGerenciar = () => temPermissao('documentos:gerenciar');
const el = (id) => document.getElementById(id);

const ICONES = [
    [t => t === 'application/vnd.google-apps.folder', 'fa-solid fa-folder', 'pasta'],
    [t => t === 'application/pdf', 'fa-solid fa-file-pdf', 'pdf'],
    [t => t.startsWith('image/'), 'fa-solid fa-file-image', 'imagem'],
    [t => t === 'application/vnd.google-apps.document' || t.includes('wordprocessing') || t === 'application/msword', 'fa-solid fa-file-word', 'texto'],
    [t => t === 'application/vnd.google-apps.spreadsheet' || t.includes('spreadsheet') || t.includes('excel'), 'fa-solid fa-file-excel', 'planilha'],
    [t => t === 'application/vnd.google-apps.presentation' || t.includes('presentation') || t.includes('powerpoint'), 'fa-solid fa-file-powerpoint', 'apresentacao'],
    [t => t.startsWith('video/'), 'fa-solid fa-file-video', 'video'],
    [t => t.startsWith('audio/'), 'fa-solid fa-file-audio', 'audio'],
    [t => t.includes('zip') || t.includes('compressed'), 'fa-solid fa-file-zipper', 'outro']
];
const iconeDe = (tipo) => ICONES.find(([teste]) => teste(tipo)) || [null, 'fa-solid fa-file', 'outro'];

const quando = (iso) => (iso ? formatarDia(diaDoInstante(iso), { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '') : '');

// ===== ESTADOS SEM PASTA =====
function mostrarAviso(html) {
    el('drive-caminho').innerHTML = '';
    el('drive-abrir-pasta').hidden = true;
    el('drive-lista').innerHTML = `<div class="card card-padded drive-aviso">${html}</div>`;
}

const AVISO_ADMIN = '<p>Peça a quem administra o app para conectar a conta Google da rep.</p>';

function mostrarNaoConfigurado() {
    mostrarAviso(`
        <p><i class="fa-brands fa-google-drive"></i> <strong>O login com Google ainda não foi ligado no servidor.</strong></p>
        <p>Quem administra o servidor precisa criar um cliente OAuth no Google Cloud e preencher <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code>. O passo a passo está em <code>docs/deploy.md</code>.</p>`);
}

function mostrarConectar(erro) {
    mostrarAviso(`
        <p><i class="fa-brands fa-google-drive"></i> <strong>${erro ? 'A conexão com o Drive caiu.' : 'Conecte o Google Drive da rep'}</strong></p>
        ${erro ? `<p>${escaparHtml(erro)}</p>` : '<p>Entre uma vez com a conta Google da rep: depois todo mundo vê a pasta escolhida aqui, sem precisar fazer login. O app só lê, nunca altera nada no Drive.</p>'}
        ${podeGerenciar()
            ? `<a class="btn btn-primary drive-conectar" href="${URL_CONECTAR_DRIVE}"><i class="fa-brands fa-google"></i> ${erro ? 'Conectar de novo' : 'Conectar com Google'}</a>`
            : AVISO_ADMIN}`);
}

// Conta conectada e, para a administração, trocar pasta / desconectar
function renderizarConta(status) {
    const conta = el('drive-conta');
    conta.hidden = !status.conectado || Boolean(status.erro);
    if (conta.hidden) return;
    conta.innerHTML = `
        <span><i class="fa-brands fa-google"></i> ${escaparHtml(status.email || 'Conta conectada')}${status.pasta ? ` · <i class="fa-solid fa-folder"></i> ${escaparHtml(status.pasta.nome)}` : ''}</span>
        ${podeGerenciar() ? `
            <span class="drive-conta-acoes">
                ${status.pasta ? '<button type="button" class="btn btn-ghost btn-sm" data-acao="drive-trocar-pasta"><i class="fa-solid fa-folder-tree"></i> Trocar pasta</button>' : ''}
                <button type="button" class="btn btn-ghost btn-sm btn-perigo" data-acao="drive-desconectar"><i class="fa-solid fa-link-slash"></i> Desconectar</button>
            </span>` : ''}`;
}

// ===== ESCOLHER A PASTA DA REP (administração) =====
// estado.drive.escolhendo = pilha das pastas abertas, começando por Meu Drive ou Compartilhados
export async function abrirEscolhaDePasta(pastaId = 'root', nome = 'Meu Drive', { reiniciar = false } = {}) {
    const lista = el('drive-lista');
    if (!lista) return;
    if (reiniciar || !estado.drive.escolhendo) estado.drive.escolhendo = [];
    const pilha = estado.drive.escolhendo;
    const i = pilha.findIndex(p => p.id === pastaId);
    if (i >= 0) pilha.splice(i + 1);
    else pilha.push({ id: pastaId, nome });

    el('drive-abrir-pasta').hidden = true;
    el('drive-caminho').innerHTML = pilha.map((p, j) => (j === pilha.length - 1
        ? `<span aria-current="page">${escaparHtml(p.nome)}</span>`
        : `<button type="button" data-acao="drive-escolha" data-id="${escaparHtml(p.id)}" data-nome="${escaparHtml(p.nome)}">${escaparHtml(p.nome)}</button>`
    )).join('<i class="fa-solid fa-chevron-right"></i>');
    lista.innerHTML = '<div class="card"><p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Carregando pastas...</p></div>';

    const atual = pilha[pilha.length - 1];
    const virtual = atual.id === 'root' || atual.id === 'compartilhados';
    const trocando = Boolean(estado.drive.status?.pasta);
    try {
        const { itens } = await listarPastasParaEscolher(atual.id);
        lista.innerHTML = `
            <div class="card card-padded drive-escolha">
                <p><strong>Qual é a pasta da rep?</strong> Entre nela e toque em <strong>Usar esta pasta</strong>. Os moradores vão ver só o que estiver dentro dela.</p>
                <div class="chips">
                    <button type="button" class="chip ${pilha[0].id === 'root' ? 'ativo' : ''}" data-acao="drive-escolha-inicio" data-id="root" data-nome="Meu Drive"><span><i class="fa-solid fa-hard-drive"></i> Meu Drive</span></button>
                    <button type="button" class="chip ${pilha[0].id === 'compartilhados' ? 'ativo' : ''}" data-acao="drive-escolha-inicio" data-id="compartilhados" data-nome="Compartilhados comigo"><span><i class="fa-solid fa-user-group"></i> Compartilhados comigo</span></button>
                </div>
                <div class="btn-row">
                    ${trocando ? '<button type="button" class="btn btn-ghost" data-acao="drive-escolha-cancelar">Cancelar</button>' : ''}
                    <button type="button" class="btn btn-primary" data-acao="drive-usar-pasta" data-id="${escaparHtml(atual.id)}" ${virtual ? 'disabled' : ''}>
                        <i class="fa-solid fa-check"></i> ${virtual ? 'Entre numa pasta' : `Usar "${escaparHtml(atual.nome)}"`}
                    </button>
                </div>
            </div>
            ${itens.length
                ? `<div class="card drive-itens">${itens.map(p => `
                    <button type="button" class="drive-item tipo-pasta" data-acao="drive-escolha" data-id="${escaparHtml(p.id)}" data-nome="${escaparHtml(p.nome)}">
                        <span class="drive-capa"><i class="fa-solid fa-folder"></i></span>
                        <span class="drive-info"><span class="drive-nome">${escaparHtml(p.nome)}</span></span>
                        <i class="fa-solid fa-chevron-right drive-seta"></i>
                    </button>`).join('')}</div>`
                : '<div class="card"><p class="empty-state">Nenhuma pasta aqui dentro.</p></div>'}`;
    } catch (error) {
        console.error('Erro:', error);
        lista.innerHTML = `<div class="card card-padded drive-aviso"><p>${escaparHtml(error.message || 'Não foi possível listar as pastas.')}</p></div>`;
    }
}

export async function usarPasta(pastaId) {
    try {
        const status = await escolherPastaDrive(pastaId);
        estado.drive.escolhendo = null;
        mostrarNotificacao(`Pronto! A pasta "${status.pasta.nome}" aparece para todos.`, 'success');
        await abrirPastaDrive();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao escolher a pasta', 'error');
    }
}

export function cancelarEscolha() {
    estado.drive.escolhendo = null;
    abrirPastaDrive();
}

export async function desconectar() {
    const status = estado.drive.status;
    if (!(await mostrarConfirmacao(`Desconectar a conta ${status?.email || 'Google'}? A aba Drive some para todos até alguém conectar de novo. Nada é apagado no Drive.`, { titulo: 'Desconectar o Drive', confirmarTexto: 'Desconectar' }))) return;
    try {
        await desconectarDrive();
        estado.drive.escolhendo = null;
        mostrarNotificacao('Drive desconectado', 'success');
        await abrirPastaDrive();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao desconectar', 'error');
    }
}

// ===== PASTA DA REP =====
function renderizarCaminho({ pasta, caminho }) {
    const trechos = [...caminho, pasta];
    el('drive-caminho').innerHTML = trechos.map((item, i) => (i === trechos.length - 1
        ? `<span aria-current="page">${escaparHtml(i === 0 ? 'Início' : item.nome)}</span>`
        : `<button type="button" data-acao="drive-pasta" data-id="${escaparHtml(item.id)}">${escaparHtml(i === 0 ? 'Início' : item.nome)}</button>`
    )).join('<i class="fa-solid fa-chevron-right"></i>');

    const abrir = el('drive-abrir-pasta');
    abrir.hidden = !pasta.link;
    if (pasta.link) abrir.href = pasta.link;
}

function htmlItem(item) {
    const [, icone, classe] = iconeDe(item.tipo);
    const meta = item.pasta ? 'Pasta' : [tamanhoLegivel(item.tamanho), quando(item.modificadoEm)].filter(Boolean).join(' · ');
    const capa = item.miniatura && !item.pasta
        ? `<img src="${urlMiniaturaDrive(item.id)}" alt="" loading="lazy" decoding="async"><i class="${icone}"></i>`
        : `<i class="${icone}"></i>`;
    return `
        <button type="button" class="drive-item tipo-${classe}" data-acao="${item.pasta ? 'drive-pasta' : 'drive-arquivo'}" data-id="${escaparHtml(item.id)}">
            <span class="drive-capa ${item.miniatura && !item.pasta ? 'com-miniatura' : ''}">${capa}</span>
            <span class="drive-info">
                <span class="drive-nome">${escaparHtml(item.nome)}</span>
                <span class="drive-meta">${escaparHtml(meta)}</span>
            </span>
            ${item.pasta ? '<i class="fa-solid fa-chevron-right drive-seta"></i>' : ''}
        </button>`;
}

// Decide o que a aba mostra: aviso, botão de conectar, escolha da pasta ou a pasta da rep
export async function abrirPastaDrive(pastaId = '') {
    const lista = el('drive-lista');
    if (!lista || estado.drive.carregando) return;
    estado.drive.carregando = true;
    lista.setAttribute('aria-busy', 'true');
    lista.innerHTML = '<div class="card"><p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Carregando a pasta...</p></div>';
    try {
        const status = await carregarStatusDrive({ forcar: !pastaId });
        renderizarConta(status);
        if (!status.configurado) return mostrarNaoConfigurado();
        if (!status.conectado || status.erro) return mostrarConectar(status.erro);
        if (!status.pasta) {
            if (!podeGerenciar()) return mostrarAviso('<p><strong>O Drive está conectado, mas falta escolher a pasta da rep.</strong></p>' + AVISO_ADMIN);
            estado.drive.carregando = false;
            return abrirEscolhaDePasta('root', 'Meu Drive', { reiniciar: true });
        }

        const resposta = await carregarPastaDrive(pastaId);
        renderizarCaminho(resposta);
        lista.innerHTML = resposta.itens.length
            ? `<div class="card drive-itens">${resposta.itens.map(htmlItem).join('')}</div>`
            : '<div class="card"><p class="empty-state">Pasta vazia.</p></div>';
    } catch (error) {
        console.error('Erro:', error);
        // 409: conexão caiu ou falta a pasta; o status atualizado mostra o caminho certo
        if (error.status === 409 && !pastaId) estado.drive.status = null;
        lista.innerHTML = `<div class="card card-padded drive-aviso"><p>${escaparHtml(error.message || 'Não foi possível abrir a pasta do Drive.')}</p>
            <button type="button" class="btn btn-ghost btn-sm" data-acao="drive-pasta" data-id="${escaparHtml(pastaId)}"><i class="fa-solid fa-rotate-right"></i> Tentar de novo</button></div>`;
    } finally {
        estado.drive.carregando = false;
        lista.removeAttribute('aria-busy');
    }
}

// Aba reaberta: continua a escolha de pasta, ou volta para a pasta em que estava
export function recarregarDrive() {
    const pilha = estado.drive.escolhendo;
    if (pilha?.length) return abrirEscolhaDePasta(pilha[pilha.length - 1].id, pilha[pilha.length - 1].nome);
    return abrirPastaDrive(estado.drive.pasta?.pasta.id || '');
}

// Volta do login no Google: /?drive=conectado#/documentos/drive. Avisa e limpa o endereço
export function avisarRetornoDoLogin() {
    const resultado = new URLSearchParams(location.search).get('drive');
    if (!resultado) return;
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
    const mensagens = {
        conectado: ['Google Drive conectado! Agora escolha a pasta da rep.', 'success'],
        cancelado: ['Login com Google cancelado.', 'info'],
        'sem-permissao': ['É preciso permitir o acesso ao Google Drive. Tente de novo e marque a permissão.', 'warning'],
        erro: ['Não foi possível conectar o Google Drive. Tente de novo.', 'error']
    };
    const [texto, tipo] = mensagens[resultado] || mensagens.erro;
    mostrarNotificacao(texto, tipo, 6000);
}

// Imagem: abre num painel. PDF e documentos do Google (convertidos em PDF): nova aba.
// Outros tipos: baixa pelo app ou abre no Drive
export function abrirArquivoDrive(id) {
    const item = estado.drive.pasta?.itens.find(i => i.id === id);
    if (!item) return;
    const url = urlArquivoDrive(id);
    const linkDrive = item.link ? `<a class="btn btn-ghost" href="${escaparHtml(item.link)}" target="_blank" rel="noopener"><i class="fa-brands fa-google-drive"></i> Abrir no Drive</a>` : '';

    let conteudo;
    if (item.tipo.startsWith('image/')) {
        conteudo = `<a href="${url}" target="_blank" rel="noopener" class="doc-visualizar"><img src="${url}" alt="${escaparHtml(item.nome)}"></a>`;
    } else if (item.visualizavel) {
        conteudo = `<a href="${url}" target="_blank" rel="noopener" class="doc-visualizar doc-visualizar-arquivo"><i class="${iconeDe(item.tipo)[1]}"></i><span>Toque para abrir${item.tipo === 'application/pdf' ? '' : ' (em PDF)'}</span></a>`;
    } else {
        conteudo = `<div class="doc-visualizar doc-visualizar-arquivo"><i class="${iconeDe(item.tipo)[1]}"></i><span>${item.baixavel ? 'Esse tipo de arquivo não abre no app: baixe ou abra no Drive.' : 'Esse tipo de arquivo só abre no Google Drive.'}</span></div>`;
    }

    abrirPainel({
        titulo: item.nome,
        classe: 'painel-documento',
        html: `
            ${conteudo}
            <dl class="doc-detalhes">
                ${item.modificadoEm ? `<div><dt>Modificado em</dt><dd>${quando(item.modificadoEm)}</dd></div>` : ''}
                ${item.tamanho ? `<div><dt>Tamanho</dt><dd>${tamanhoLegivel(item.tamanho)}</dd></div>` : ''}
            </dl>
            <div class="painel-acoes">
                ${linkDrive}
                ${item.baixavel ? `<a class="btn btn-primary" href="${url}" download><i class="fa-solid fa-download"></i> Baixar</a>` : ''}
            </div>
        `
    });
}

// Miniatura que não carregou (o Google nem sempre gera): fica só o ícone
export function ligarFalhaDeMiniatura() {
    document.getElementById('drive-lista')?.addEventListener('error', (e) => {
        if (e.target.tagName !== 'IMG') return;
        e.target.closest('.drive-capa')?.classList.remove('com-miniatura');
        e.target.remove();
    }, true);
}
