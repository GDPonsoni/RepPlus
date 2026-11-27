import { api } from '../../core/api.js';
import { aplicarPermissoes, moduloAtivo, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { formatarDia, diaDoInstante } from '../../core/datas.js';
import { categoria, categoriasDe, estiloCategoria, htmlEscolhaCategoria } from '../../core/categorias.js';
import {
    estado, ACEITOS, LIMITE_MB, semAcento, buscarDocumento, ehImagem, ehPdf, tamanhoLegivel, validarArquivo,
    enviarDocumento, atualizarDocumento, excluirDocumento
} from './dados.js';

// Aba "Mural": arquivos enviados pela casa (fotos e PDFs), com busca e filtro por categoria

export const HTML_ABA_MURAL = `
    <div class="pagina-topo">
        <h2 class="section-title">Mural de documentos</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="enviar-documento" data-permissao="documentos:enviar"><i class="fa-solid fa-upload"></i> Enviar</button>
    </div>
    <input type="search" id="docs-busca" class="docs-busca" placeholder="Buscar documento..." aria-label="Buscar documento" autocomplete="off">
    <div id="docs-filtro" class="chips docs-filtro" role="radiogroup" aria-label="Filtrar por categoria"></div>
    <div id="docs-lista" class="docs-grade"></div>
`;

const dataCurta = (iso) => formatarDia(diaDoInstante(iso), { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '');
const dataDaAta = (dia) => formatarDia(dia, { day: '2-digit', month: '2-digit', year: 'numeric' });

function htmlCapa(doc) {
    if (ehImagem(doc.tipo)) return `<img src="${escaparHtml(doc.arquivo)}" alt="" loading="lazy" decoding="async">`;
    return `<i class="fa-solid ${ehPdf(doc.tipo) ? 'fa-file-pdf' : 'fa-file'}"></i>`;
}

function textoBuscavel(doc) {
    return semAcento([doc.titulo, doc.descricao, doc.nomeArquivo, doc.ata?.titulo, categoria('documentos', doc.categoria)?.nome].join(' '));
}

function renderizarFiltro() {
    const container = document.getElementById('docs-filtro');
    if (!container) return;
    const contagem = new Map();
    estado.documentos.forEach(doc => contagem.set(doc.categoria, (contagem.get(doc.categoria) || 0) + 1));
    const usadas = categoriasDe('documentos').filter(c => contagem.has(c.chave));
    // Filtro escolhido que ficou vazio (ex.: apagou o último documento) volta para "Todos"
    if (estado.filtro && !contagem.has(estado.filtro)) estado.filtro = '';

    const chip = (valor, nome, total, estilo = '', icone = '') => `
        <label class="chip" style="${estilo}">
            <input type="radio" name="docs-filtro" value="${escaparHtml(valor)}" ${valor === estado.filtro ? 'checked' : ''}>
            <span>${icone ? `<i class="${icone}"></i> ` : ''}${escaparHtml(nome)} <small>${total}</small></span>
        </label>`;
    container.innerHTML = usadas.length > 1
        ? chip('', 'Todos', estado.documentos.length) + usadas.map(c => chip(c.chave, c.nome, contagem.get(c.chave), estiloCategoria(c), c.icone)).join('')
        : '';
}

export function renderizarMural() {
    const container = document.getElementById('docs-lista');
    if (!container || !estado.carregado) return;
    renderizarFiltro();
    const busca = semAcento(document.getElementById('docs-busca').value.trim());
    const docs = estado.documentos
        .filter(doc => !estado.filtro || doc.categoria === estado.filtro)
        .filter(doc => !busca || textoBuscavel(doc).includes(busca));

    if (!docs.length) {
        container.innerHTML = `<div class="card docs-vazio"><p class="empty-state">${busca || estado.filtro
            ? 'Nenhum documento encontrado.'
            : 'Nenhum documento ainda. Envie fotos ou PDFs: a ata em papel digitalizada, o contrato, o manual da máquina...'}</p></div>`;
        return;
    }

    container.innerHTML = docs.map(doc => {
        const c = categoria('documentos', doc.categoria);
        return `
            <button type="button" class="doc-card" data-acao="abrir-documento" data-id="${escaparHtml(doc.id)}">
                <span class="doc-capa ${ehImagem(doc.tipo) ? 'com-imagem' : ''}">${htmlCapa(doc)}</span>
                <span class="doc-info">
                    <span class="doc-titulo">${escaparHtml(doc.titulo)}</span>
                    <span class="doc-meta">
                        ${c ? `<span class="doc-categoria" style="${estiloCategoria(c)}"><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>` : ''}
                        <span>${dataCurta(doc.criadoEm)}</span>
                    </span>
                    ${doc.ata ? `<span class="doc-ata"><i class="fa-solid fa-paperclip"></i> ${escaparHtml(doc.ata.titulo)}</span>` : ''}
                </span>
            </button>`;
    }).join('');
}

// ===== VER =====
export function abrirDocumento(id) {
    const doc = buscarDocumento(id);
    if (!doc) return;
    const c = categoria('documentos', doc.categoria);
    const { corpo, fechar } = abrirPainel({
        titulo: doc.titulo,
        classe: 'painel-documento',
        html: `
            ${ehImagem(doc.tipo)
                ? `<a href="${escaparHtml(doc.arquivo)}" target="_blank" rel="noopener" class="doc-visualizar" title="Abrir em tamanho real"><img src="${escaparHtml(doc.arquivo)}" alt="${escaparHtml(doc.titulo)}"></a>`
                : `<a href="${escaparHtml(doc.arquivo)}" target="_blank" rel="noopener" class="doc-visualizar doc-visualizar-arquivo"><i class="fa-solid fa-file-pdf"></i><span>Toque para abrir o PDF</span></a>`}
            <dl class="doc-detalhes">
                ${c ? `<div><dt>Categoria</dt><dd><span class="doc-categoria" style="${estiloCategoria(c)}"><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span></dd></div>` : ''}
                ${doc.ata ? `<div><dt>Anexo da ata</dt><dd>${escaparHtml(doc.ata.titulo)} · ${dataDaAta(doc.ata.data)}</dd></div>` : ''}
                <div><dt>Enviado em</dt><dd>${dataCurta(doc.criadoEm)}</dd></div>
                <div><dt>Arquivo</dt><dd>${escaparHtml(doc.nomeArquivo)}${doc.tamanho ? ` · ${tamanhoLegivel(doc.tamanho)}` : ''}</dd></div>
            </dl>
            ${doc.descricao ? `<p class="doc-descricao">${escaparHtml(doc.descricao).replace(/\n/g, '<br>')}</p>` : ''}
            <div class="painel-acoes">
                <button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir" data-permissao="documentos:gerenciar"><i class="fa-solid fa-trash"></i> Excluir</button>
                <a class="btn btn-ghost" href="${escaparHtml(doc.arquivo)}" download="${escaparHtml(doc.nomeArquivo)}"><i class="fa-solid fa-download"></i> Baixar</a>
                <button type="button" class="btn btn-primary" data-papel="editar" data-permissao="documentos:enviar"><i class="fa-solid fa-pen"></i> Editar</button>
            </div>
        `
    });
    aplicarPermissoes(corpo);

    corpo.querySelector('[data-papel="editar"]').addEventListener('click', () => {
        fechar();
        abrirFormularioDocumento({ id });
    });
    corpo.querySelector('[data-papel="excluir"]').addEventListener('click', async () => {
        const daAta = doc.ata ? ` Ele também sai dos anexos da ata "${doc.ata.titulo}".` : '';
        if (!(await mostrarConfirmacao(`Apagar "${doc.titulo}"? O arquivo é apagado de vez.${daAta}`, { titulo: 'Apagar documento', confirmarTexto: 'Apagar' }))) return;
        try {
            await excluirDocumento(id);
            fechar();
            mostrarNotificacao('Documento apagado', 'success');
            renderizarMural();
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao apagar', 'error');
        }
    });
}

// ===== ENVIAR / EDITAR =====
// Atas para o campo "Anexo da ata" (só com o módulo Atas ligado e permissão para lê-las)
async function atasParaEscolher() {
    if (!moduloAtivo('atas') || !temPermissao('atas:ver')) return null;
    try {
        const atas = await api('/atas');
        return atas.sort((a, b) => b.data.localeCompare(a.data));
    } catch (error) {
        console.error('Erro ao buscar as atas:', error);
        return null;
    }
}

const sugerirTitulo = (nome) => nome.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120);

export async function abrirFormularioDocumento({ id } = {}) {
    const doc = id ? buscarDocumento(id) : null;
    if (id && !doc) return;
    const atas = await atasParaEscolher();

    const { corpo, fechar } = abrirPainel({
        titulo: doc ? `Editando: ${doc.titulo}` : 'Enviar documento',
        classe: 'painel-documento',
        html: `
            <form id="form-documento" class="form-stack" novalidate>
                ${doc ? '' : `
                <label class="upload-drop" for="documento-arquivo">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span data-papel="nome-arquivo">Toque para escolher uma foto ou PDF (até ${LIMITE_MB}MB)</span>
                </label>
                <input type="file" id="documento-arquivo" name="arquivo" accept="${ACEITOS}" class="visually-hidden" required>`}
                <label class="field"><span>Título${doc ? ' *' : ''}</span>
                    <input type="text" name="titulo" value="${escaparHtml(doc?.titulo || '')}" maxlength="120" placeholder="Ex.: Ata da reunião de março"></label>
                <div class="field"><span>Categoria</span>
                    ${htmlEscolhaCategoria({ escopo: 'documentos', selecionada: doc?.categoria ?? undefined })}
                </div>
                ${atas ? `
                <label class="field"><span>Anexo da ata</span>
                    <select name="ataId">
                        <option value="">Nenhuma</option>
                        ${atas.map(ata => `<option value="${escaparHtml(ata.id)}" ${String(ata.id) === String(doc?.ataId) ? 'selected' : ''}>${escaparHtml(ata.titulo)} · ${dataDaAta(ata.data)}</option>`).join('')}
                    </select></label>` : ''}
                <label class="field"><span>Descrição</span>
                    <textarea name="descricao" rows="3" maxlength="1000" placeholder="Opcional">${escaparHtml(doc?.descricao || '')}</textarea></label>
                <div class="painel-acoes">
                    <button type="submit" class="btn btn-primary">${doc ? 'Salvar' : '<i class="fa-solid fa-upload"></i> Enviar'}</button>
                </div>
            </form>
        `
    });
    aplicarPermissoes(corpo);
    const form = corpo.querySelector('#form-documento');
    const campoArquivo = form.querySelector('#documento-arquivo');

    // Escolheu o arquivo: mostra o nome e sugere o título (se ainda estiver vazio)
    campoArquivo?.addEventListener('change', () => {
        const arquivo = campoArquivo.files[0];
        if (!arquivo) return;
        const erro = validarArquivo(arquivo);
        if (erro) {
            campoArquivo.value = '';
            mostrarNotificacao(erro, 'warning', 5000);
            return;
        }
        form.querySelector('[data-papel="nome-arquivo"]').textContent = `${arquivo.name} (${tamanhoLegivel(arquivo.size)})`;
        if (!form.elements.titulo.value.trim()) form.elements.titulo.value = sugerirTitulo(arquivo.name);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            titulo: form.elements.titulo.value.trim(),
            descricao: form.elements.descricao.value.trim(),
            categoria: form.querySelector('input[name="categoria"]:checked')?.value || ''
        };
        if (form.elements.ataId) dados.ataId = form.elements.ataId.value || null;

        const arquivo = campoArquivo?.files[0];
        if (!doc && !arquivo) return mostrarNotificacao('Escolha um arquivo para enviar', 'warning');
        if (doc && !dados.titulo) return mostrarNotificacao('Dê um título para o documento', 'warning');

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, doc ? '⏳ Salvando...' : '⏳ Enviando...');
        try {
            const salvo = doc ? await atualizarDocumento(doc.id, dados) : await enviarDocumento(arquivo, dados);
            mostrarNotificacao(doc ? 'Documento atualizado!' : 'Documento enviado!', 'success');
            fechar();
            renderizarMural();
            abrirDocumento(salvo.id);
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar o documento', 'error');
            definirCarregando(botao, false);
        }
    });
}
