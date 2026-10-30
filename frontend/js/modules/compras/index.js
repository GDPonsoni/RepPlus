import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { formatarDia, diaDoInstante } from '../../core/datas.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { nomeDaRepublica } from '../../core/aparencia.js';
import { carregarCategorias, categoria, categoriasDe, htmlEscolhaCategoria } from '../../core/categorias.js';
import {
    iconeCategoria, STATUS, estado, itensComStatus, compradosRecentes, sugestoes, buscarItem, haQuantoTempo,
    carregarItens, adicionarItem, atualizarItem, comprarItem, desfazerCompra, excluirItem
} from './dados.js';
import inicio from './inicio.js';
import avisos from './avisos.js';

const HTML_ABA_LISTA = `
    <div class="card card-padded compras-adicionar" data-permissao="compras:editar">
        <form id="form-compra-rapida" class="compra-rapida" autocomplete="off">
            <input type="text" id="compra-nome" maxlength="60" placeholder="O que acabou? Ex.: detergente" list="compras-catalogo" enterkeyhint="done" aria-label="Item">
            <button type="submit" class="btn btn-primary" aria-label="Adicionar à lista"><i class="fa-solid fa-plus"></i></button>
        </form>
        <div class="chips compra-status-escolha" role="radiogroup" aria-label="Situação">
            <label class="chip cstatus-falta"><input type="radio" name="compra-status" value="falta" checked><span><i class="${STATUS.falta.icone}"></i> Acabou</span></label>
            <label class="chip cstatus-acabando"><input type="radio" name="compra-status" value="acabando"><span><i class="${STATUS.acabando.icone}"></i> Tá acabando</span></label>
        </div>
        <div id="compras-sugestoes" class="compras-sugestoes"></div>
        <datalist id="compras-catalogo"></datalist>
    </div>
    <div class="compras-resumo">
        <span id="compras-contagem"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="compartilhar-compras"><i class="fa-solid fa-share-nodes"></i> Enviar lista</button>
    </div>
    <div id="compras-lista" class="compras-lista"></div>
`;

const HTML_ABA_ITENS = `
    <div class="pagina-topo">
        <h2 class="section-title">Itens salvos</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="novo-item-compra" data-permissao="compras:editar"><i class="fa-solid fa-plus"></i> Novo</button>
    </div>
    <input type="search" id="compras-busca" class="compras-busca" placeholder="Buscar item..." aria-label="Buscar item" autocomplete="off">
    <div id="compras-catalogo-lista" class="compras-lista"></div>
`;

// ===== LISTA =====
function nomeDoMorador(id) {
    return obterIntegrantes().find(integrante => String(integrante.id) === String(id))?.nome || null;
}

function htmlItemLista(item) {
    const quem = nomeDoMorador(item.pedidoPor);
    const detalhes = [
        item.quantidade && `<strong>${escaparHtml(item.quantidade)}</strong>`,
        item.observacao && escaparHtml(item.observacao),
        [quem && `por ${escaparHtml(quem)}`, haQuantoTempo(item.pedidoEm)].filter(Boolean).join(' · ')
    ].filter(Boolean);

    return `
        <div class="compra-item cstatus-${item.status}">
            <button type="button" class="compra-check" data-acao="comprar-item" data-id="${escaparHtml(item.id)}" data-permissao="compras:editar" aria-label="Comprei ${escaparHtml(item.nome)}">
                <i class="fa-solid fa-check"></i>
            </button>
            <button type="button" class="compra-info" data-acao="abrir-item-compra" data-id="${escaparHtml(item.id)}">
                <span class="compra-nome">${iconeCategoria(item)} ${escaparHtml(item.nome)}</span>
                ${detalhes.length ? `<span class="compra-meta">${detalhes.join(' · ')}</span>` : ''}
            </button>
            ${item.status === 'acabando' ? `<button type="button" class="btn btn-ghost btn-sm compra-acabou" data-acao="marcar-acabou" data-id="${escaparHtml(item.id)}" data-permissao="compras:editar">Acabou</button>` : ''}
        </div>
    `;
}

function htmlSecao(titulo, icone, classe, itens, vazio = '') {
    if (!itens.length && !vazio) return '';
    return `
        <section class="compras-secao ${classe}">
            <h3 class="compras-secao-titulo"><i class="${icone}"></i> ${titulo} <span class="compras-secao-total">${itens.length}</span></h3>
            <div class="card compras-itens">${itens.length ? itens.map(htmlItemLista).join('') : `<p class="empty-state">${vazio}</p>`}</div>
        </section>
    `;
}

function renderizarLista() {
    const container = document.getElementById('compras-lista');
    if (!container) return;

    const faltando = itensComStatus('falta');
    const acabando = itensComStatus('acabando');
    const recentes = compradosRecentes();
    const total = faltando.length + acabando.length;

    document.getElementById('compras-contagem').innerHTML = total
        ? `<i class="fa-solid fa-cart-shopping"></i> ${total} ${total === 1 ? 'item' : 'itens'} na lista`
        : '';
    document.querySelector('[data-acao="compartilhar-compras"]').hidden = total === 0;

    container.innerHTML = total === 0 && !recentes.length
        ? `<div class="card compras-vazio"><i class="fa-solid fa-face-smile-beam"></i><p><strong>Nada para comprar!</strong></p><p>Quando algo acabar, adicione aqui para quem for ao mercado ver.</p></div>`
        : `
            ${htmlSecao('Acabou: precisa comprar', STATUS.falta.icone, 'compras-secao-falta', faltando, 'Nada acabou por enquanto 👍')}
            ${htmlSecao('Está acabando', STATUS.acabando.icone, 'compras-secao-acabando', acabando)}
            ${recentes.length ? `
                <section class="compras-secao compras-secao-recentes">
                    <h3 class="compras-secao-titulo"><i class="fa-solid fa-bag-shopping"></i> Comprados agora há pouco</h3>
                    <div class="card compras-itens">
                        ${recentes.map(item => `
                            <div class="compra-item comprado">
                                <span class="compra-check marcado"><i class="fa-solid fa-check"></i></span>
                                <span class="compra-info"><span class="compra-nome">${escaparHtml(item.nome)}</span></span>
                                <button type="button" class="btn btn-ghost btn-sm" data-acao="desfazer-compra" data-id="${escaparHtml(item.id)}" data-permissao="compras:editar">Desfazer</button>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        `;
    aplicarPermissoes(container);
    renderizarSugestoes();
}

// Sugestões em chips + autocomplete do campo, a partir dos itens já salvos
function renderizarSugestoes() {
    const lista = sugestoes();
    document.getElementById('compras-sugestoes').innerHTML = lista.length
        ? `<span class="compras-sugestoes-rotulo">Já compramos antes:</span>${lista.map(item => `
            <button type="button" class="compra-sugestao" data-acao="sugestao-compra" data-id="${escaparHtml(item.id)}"><i class="fa-solid fa-plus"></i> ${escaparHtml(item.nome)}</button>
        `).join('')}`
        : '';
    document.getElementById('compras-catalogo').innerHTML = estado.itens
        .map(item => `<option value="${escaparHtml(item.nome)}">`).join('');
}

// ===== ITENS SALVOS =====
const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function renderizarCatalogo() {
    const container = document.getElementById('compras-catalogo-lista');
    if (!container) return;
    const busca = semAcento(document.getElementById('compras-busca').value.trim());
    const itens = estado.itens.filter(item => !busca || semAcento(item.nome).includes(busca));

    if (!itens.length) {
        container.innerHTML = `<div class="card"><p class="empty-state">${busca ? 'Nenhum item encontrado.' : 'Nenhum item salvo ainda. Tudo o que for adicionado à lista fica salvo aqui.'}</p></div>`;
        return;
    }

    // Um grupo por categoria, na ordem do cadastro (categorias sem cadastro vão para o fim)
    const chaves = [...new Set([...categoriasDe('compras').map(c => c.chave), ...itens.map(item => item.categoria)])];
    container.innerHTML = chaves.map(chave => {
        const doGrupo = itens.filter(item => item.categoria === chave).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        if (!doGrupo.length) return '';
        const c = categoria('compras', chave);
        return `
            <section class="compras-secao">
                <h3 class="compras-secao-titulo">${iconeCategoria(doGrupo[0])} ${escaparHtml(c.nome)} <span class="compras-secao-total">${doGrupo.length}</span></h3>
                <div class="card compras-itens">
                    ${doGrupo.map(item => `
                        <div class="compra-item cstatus-${item.status}">
                            <button type="button" class="compra-info" data-acao="abrir-item-compra" data-id="${escaparHtml(item.id)}">
                                <span class="compra-nome">${escaparHtml(item.nome)}</span>
                                <span class="compra-meta">${item.compradoEm ? `Comprado ${haQuantoTempo(item.compradoEm)}` : 'Nunca comprado'}${item.vezesComprado ? ` · ${item.vezesComprado}x` : ''}</span>
                            </button>
                            ${item.status === 'ok'
                                ? `<button type="button" class="btn btn-ghost btn-sm" data-acao="sugestao-compra" data-id="${escaparHtml(item.id)}" data-status="falta" data-permissao="compras:editar"><i class="fa-solid fa-plus"></i> Lista</button>`
                                : `<span class="compra-status-tag cstatus-${item.status}"><i class="${STATUS[item.status].icone}"></i> ${STATUS[item.status].nome}</span>`}
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
    aplicarPermissoes(container);
}

function renderizarTudo() {
    if (!estado.carregado) return;
    renderizarLista();
    renderizarCatalogo();
}

// ===== AÇÕES =====
async function executar(acao, mensagemErro) {
    try {
        await acao();
        renderizarTudo();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || mensagemErro, 'error');
    }
}

async function adicionarRapido(e) {
    e.preventDefault();
    const campo = document.getElementById('compra-nome');
    const nome = campo.value.trim();
    if (!nome) {
        mostrarNotificacao('Digite o que precisa comprar', 'warning');
        campo.focus();
        return;
    }
    const status = document.querySelector('input[name="compra-status"]:checked').value;
    await executar(async () => {
        const { item, jaEstavaNaLista } = await adicionarItem({ nome, status });
        campo.value = '';
        mostrarNotificacao(jaEstavaNaLista ? `${item.nome} já estava na lista (atualizado)` : `${item.nome} adicionado!`, 'success');
    }, 'Erro ao adicionar');
}

// Chips de sugestão usam a situação escolhida no topo; o "+ Lista" dos itens salvos manda status=falta
function adicionarSugestao({ id, status: statusFixo }) {
    const item = buscarItem(id);
    if (!item) return;
    const status = statusFixo || document.querySelector('input[name="compra-status"]:checked')?.value || 'falta';
    return executar(async () => {
        await atualizarItem(id, { status });
        mostrarNotificacao(`${item.nome} ${status === 'falta' ? 'na lista' : 'marcado como acabando'}`, 'success');
    }, 'Erro ao adicionar');
}

function comprar({ id }) {
    return executar(async () => {
        const item = await comprarItem(id);
        mostrarNotificacao(`${item.nome} comprado ✔`, 'success', 1800);
    }, 'Erro ao marcar como comprado');
}

function desfazer({ id }) {
    return executar(async () => {
        const item = await desfazerCompra(id);
        mostrarNotificacao(`${item.nome} voltou para a lista`, 'info');
    }, 'Erro ao desfazer');
}

function marcarAcabou({ id }) {
    return executar(() => atualizarItem(id, { status: 'falta' }), 'Erro ao atualizar');
}

// Texto da lista para mandar no grupo da casa (WhatsApp etc.)
async function compartilhar() {
    const linha = (item) => `• ${item.nome}${item.quantidade ? ` (${item.quantidade})` : ''}${item.observacao ? ` - ${item.observacao}` : ''}`;
    const faltando = itensComStatus('falta');
    const acabando = itensComStatus('acabando');
    const texto = [
        `🛒 Lista de compras · ${nomeDaRepublica()}`,
        faltando.length ? `\nAcabou:\n${faltando.map(linha).join('\n')}` : '',
        acabando.length ? `\nEstá acabando:\n${acabando.map(linha).join('\n')}` : ''
    ].filter(Boolean).join('\n');

    try {
        if (navigator.share) {
            await navigator.share({ title: 'Lista de compras', text: texto });
            return;
        }
        await navigator.clipboard.writeText(texto);
        mostrarNotificacao('Lista copiada! É só colar no grupo.', 'success');
    } catch (error) {
        if (error.name === 'AbortError') return; // fechou o menu de compartilhar
        console.error('Erro:', error);
        mostrarNotificacao('Não foi possível compartilhar a lista', 'error');
    }
}

// ===== FORMULÁRIO (painel) =====
function htmlFormulario(item, podeEditar) {
    const v = (campo) => escaparHtml(item?.[campo] ?? '');
    const desabilitado = podeEditar ? '' : 'disabled';
    const status = item?.status || 'falta';
    const moradores = obterIntegrantes().filter(i => i.ativo !== false || String(i.id) === String(item?.pedidoPor));

    return `
        <form id="form-item-compra" class="form-stack" novalidate>
            <label class="field">
                <span>Item *</span>
                <input type="text" name="nome" value="${v('nome')}" maxlength="60" required ${desabilitado}>
            </label>
            <div class="field">
                <span>Situação</span>
                <div class="chips" role="radiogroup">
                    ${Object.entries(STATUS).map(([id, s]) => `
                        <label class="chip cstatus-${id}"><input type="radio" name="status" value="${id}" ${id === status ? 'checked' : ''} ${desabilitado}><span><i class="${s.icone}"></i> ${s.nome}</span></label>
                    `).join('')}
                </div>
            </div>
            <div class="field">
                <span>Categoria</span>
                ${htmlEscolhaCategoria({ escopo: 'compras', selecionada: item?.categoria, desabilitado: Boolean(desabilitado) })}
            </div>
            <div class="field-row">
                <label class="field">
                    <span>Quantidade</span>
                    <input type="text" name="quantidade" value="${v('quantidade')}" maxlength="30" placeholder="Ex.: 2 un, 5 kg" ${desabilitado}>
                </label>
                <label class="field">
                    <span>Quem pediu</span>
                    <select name="pedidoPor" ${desabilitado}>
                        <option value="">—</option>
                        ${moradores.map(m => `<option value="${escaparHtml(m.id)}" ${String(m.id) === String(item?.pedidoPor) ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('')}
                    </select>
                </label>
            </div>
            <label class="field">
                <span>Observação</span>
                <input type="text" name="observacao" value="${v('observacao')}" maxlength="200" placeholder="Marca, tamanho, onde comprar..." ${desabilitado}>
            </label>
            ${item ? `<p class="compra-historico"><i class="fa-solid fa-clock-rotate-left"></i> ${item.vezesComprado
                ? `Comprado ${item.vezesComprado} ${item.vezesComprado === 1 ? 'vez' : 'vezes'}, a última em ${formatarDia(diaDoInstante(item.compradoEm), { day: '2-digit', month: '2-digit', year: 'numeric' })}.`
                : 'Ainda não foi comprado pelo app.'}</p>` : ''}
            ${podeEditar ? `
                <div class="painel-acoes">
                    ${item ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir" data-permissao="compras:gerenciar"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                    <button type="submit" class="btn btn-primary">${item ? 'Salvar' : 'Adicionar'}</button>
                </div>
            ` : ''}
        </form>
    `;
}

function abrirFormulario(id = null) {
    const item = id ? buscarItem(id) : null;
    if (id && !item) return;
    const podeEditar = temPermissao('compras:editar');

    const { corpo, fechar } = abrirPainel({
        titulo: item ? (podeEditar ? `Editando: ${item.nome}` : item.nome) : 'Novo item',
        html: htmlFormulario(item, podeEditar)
    });
    aplicarPermissoes(corpo);

    const form = corpo.querySelector('#form-item-compra');
    if (!item) form.elements.nome.focus();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            nome: form.elements.nome.value.trim(),
            status: form.elements.status.value,
            categoria: form.elements.categoria.value,
            quantidade: form.elements.quantidade.value.trim(),
            observacao: form.elements.observacao.value.trim(),
            pedidoPor: form.elements.pedidoPor.value || null
        };
        if (!dados.nome) {
            mostrarNotificacao('Digite o nome do item', 'warning');
            form.elements.nome.focus();
            return;
        }

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            if (item) {
                await atualizarItem(item.id, dados);
                mostrarNotificacao(`${dados.nome} atualizado!`, 'success');
            } else {
                const { item: novo, reaproveitado } = await adicionarItem(dados);
                mostrarNotificacao(reaproveitado ? `${novo.nome} já existia e foi atualizado` : `${novo.nome} adicionado!`, 'success');
            }
            renderizarTudo();
            fechar();
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar o item', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Apagar "${item.nome}" dos itens salvos? Ele some da lista e das sugestões.`, { titulo: 'Apagar item', confirmarTexto: 'Apagar' }))) return;
        try {
            await excluirItem(item.id);
            renderizarTudo();
            fechar();
            mostrarNotificacao('Item apagado', 'success');
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao apagar', 'error');
        }
    });
}

async function recarregar() {
    try {
        await carregarItens();
        renderizarTudo();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar a lista de compras', 'error');
    }
}

// Módulo: lista de compras da casa
export default {
    id: 'compras',
    nome: 'Lista de Compras',
    nomeCurto: 'Compras',
    descricao: 'O que acabou e o que está acabando',
    icone: 'fa-solid fa-cart-shopping',
    cor: 'icon-green',
    inicio,
    avisos,
    abas: [
        // Cada vez que a aba abre, busca de novo: outra pessoa pode ter mexido na lista
        { id: 'lista', titulo: 'Lista', icone: 'fa-solid fa-list-check', html: HTML_ABA_LISTA, permissao: 'compras:ver', aoAbrir: recarregar },
        { id: 'itens', titulo: 'Itens salvos', icone: 'fa-solid fa-box-archive', html: HTML_ABA_ITENS, permissao: 'compras:ver', aoAbrir: recarregar }
    ],

    async iniciar() {
        document.getElementById('form-compra-rapida')?.addEventListener('submit', adicionarRapido);
        document.getElementById('compras-busca')?.addEventListener('input', renderizarCatalogo);

        registrarAcoes({
            'comprar-item': comprar,
            'desfazer-compra': desfazer,
            'marcar-acabou': marcarAcabou,
            'sugestao-compra': adicionarSugestao,
            'abrir-item-compra': ({ id }) => abrirFormulario(id),
            'novo-item-compra': () => abrirFormulario(),
            'compartilhar-compras': compartilhar
        });

        // "Quem pediu" mostra nomes do cadastro: redesenha quando ele mudar
        ouvir('moradores:atualizados', renderizarTudo);
        ouvir('categorias:atualizadas', ({ escopo }) => { if (escopo === 'compras') renderizarTudo(); });
        await carregarCategorias('compras');
    }
};
