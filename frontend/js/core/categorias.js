import { api } from './api.js';
import { emitir } from './eventos.js';
import { registrarAcoes } from './acoes.js';
import { temPermissao } from './sessao.js';
import { abrirPainel } from './painel.js';
import { mostrarConfirmacao, mostrarEscolha } from './modal.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from './ui.js';

// Categorias gerenciáveis (núcleo): nome, cor e ícone escolhidos pela casa, por grupo (escopo):
// 'agenda', 'compras', 'anotacoes-contas', 'anotacoes-contatos'. Os registros guardam a `chave`.
//
// Nos módulos:
//   await carregarCategorias('compras');            // uma vez, no iniciar()
//   const c = categoria('compras', item.categoria);  // { nome, cor, icone } (com reserva se não existir)
//   `<span style="${estiloCategoria(c)}">`           // define --cat para o CSS
//   htmlEscolhaCategoria({ escopo, selecionada })     // chips de escolha num formulário (com "gerenciar")
//   ouvir('categorias:atualizadas', ({ escopo }) => redesenhar())

const cache = new Map();
const RESERVA = { nome: 'Sem categoria', cor: '#6b7280', icone: 'fa-solid fa-tag' };

// Paleta sugerida e ícones disponíveis no seletor
const CORES = ['#dc2626', '#ea580c', '#d97706', '#eab308', '#65a30d', '#16a34a', '#0d9488', '#0891b2',
    '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#a16207', '#64748b', '#6b7280', '#111827'];
const ICONES = [
    'tag', 'thumbtack', 'star', 'heart', 'bolt', 'fire-flame-simple', 'house', 'house-chimney', 'building', 'door-open',
    'people-group', 'user', 'user-gear', 'champagne-glasses', 'cake-candles', 'gift', 'music', 'futbol', 'gamepad', 'film',
    'tv', 'wifi', 'mobile-screen', 'laptop', 'key', 'lock', 'building-columns', 'money-bill', 'credit-card', 'receipt',
    'basket-shopping', 'cart-shopping', 'bag-shopping', 'bottle-water', 'wine-bottle', 'mug-hot', 'utensils', 'pizza-slice', 'apple-whole', 'carrot',
    'spray-can-sparkles', 'pump-soap', 'soap', 'broom', 'toilet-paper', 'shirt', 'box', 'boxes-stacked', 'screwdriver-wrench', 'hammer',
    'paint-roller', 'faucet-drip', 'plug', 'lightbulb', 'motorcycle', 'car', 'bus', 'plane', 'paw', 'leaf',
    'book', 'graduation-cap', 'briefcase', 'stethoscope', 'pills', 'dumbbell', 'calendar-day', 'clock', 'triangle-exclamation', 'circle-info'
].map(nome => `fa-solid fa-${nome}`);

// ===== LEITURA =====
export async function carregarCategorias(escopo, { forcar = false } = {}) {
    if (!forcar && cache.has(escopo)) return cache.get(escopo);
    const lista = await api(`/categorias/${escopo}`);
    cache.set(escopo, lista);
    return lista;
}

export const categoriasDe = (escopo) => cache.get(escopo) || [];

export function categoria(escopo, chave) {
    return categoriasDe(escopo).find(c => c.chave === chave)
        || (chave ? { ...RESERVA, chave, nome: chave } : { ...RESERVA, chave: null });
}

export const estiloCategoria = (c) => `--cat: ${c.cor}`;

// Chips de escolha para formulários; `nenhuma` = permite deixar sem categoria
export function htmlEscolhaCategoria({ escopo, nome = 'categoria', selecionada, desabilitado = false, nenhuma = false }) {
    const lista = categoriasDe(escopo);
    const marcada = selecionada ?? (nenhuma ? '' : lista[0]?.chave);
    const chip = (valor, c) => `
        <label class="chip" style="${estiloCategoria(c)}">
            <input type="radio" name="${nome}" value="${escaparHtml(valor)}" ${valor === marcada ? 'checked' : ''} ${desabilitado ? 'disabled' : ''}>
            <span><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>
        </label>`;
    return `
        <div class="chips" role="radiogroup" data-escolha-categoria="${escopo}" data-nome="${nome}" data-nenhuma="${nenhuma ? '1' : ''}">
            ${nenhuma ? chip('', { ...RESERVA, nome: 'Nenhum' }) : ''}
            ${lista.map(c => chip(c.chave, c)).join('')}
            ${!desabilitado && podeGerenciar(escopo) ? `<button type="button" class="chip-gerenciar" data-acao="gerenciar-categorias" data-escopo="${escopo}" aria-label="Gerenciar categorias"><i class="fa-solid fa-pen"></i> Editar</button>` : ''}
        </div>`;
}

// ===== GERENCIAR =====
let escopos = [];   // [{ escopo, nome, modulo, podeGerenciar }]

const podeGerenciar = (escopo) => escopos.find(e => e.escopo === escopo)?.podeGerenciar ?? temPermissao('*');

async function carregarEscopos() {
    try {
        escopos = await api('/categorias');
    } catch (error) {
        console.error('Erro ao carregar grupos de categorias:', error);
        escopos = [];
    }
    return escopos;
}

// Depois de mudar um grupo: recarrega, avisa os módulos e redesenha chips abertos em formulários
async function aposMudar(escopo) {
    await carregarCategorias(escopo, { forcar: true });
    document.querySelectorAll(`[data-escolha-categoria="${escopo}"]`).forEach(grupo => {
        const marcada = grupo.querySelector('input:checked')?.value;
        grupo.outerHTML = htmlEscolhaCategoria({ escopo, nome: grupo.dataset.nome, selecionada: marcada, nenhuma: Boolean(grupo.dataset.nenhuma) });
    });
    emitir('categorias:atualizadas', { escopo });
}

function htmlLinhas(escopo) {
    const lista = categoriasDe(escopo);
    return lista.map((c, i) => `
        <div class="categoria-linha" data-id="${c.id}">
            <span class="categoria-icone" style="${estiloCategoria(c)}"><i class="${c.icone}"></i></span>
            <span class="categoria-nome">${escaparHtml(c.nome)}</span>
            <button type="button" class="icon-btn" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir"><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="icon-btn" data-mover="1" ${i === lista.length - 1 ? 'disabled' : ''} aria-label="Descer"><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" class="icon-btn" data-editar aria-label="Editar ${escaparHtml(c.nome)}"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="icon-btn danger" data-excluir aria-label="Excluir ${escaparHtml(c.nome)}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

export async function abrirGerenciadorCategorias(escopo) {
    if (!escopos.length) await carregarEscopos();
    await carregarCategorias(escopo, { forcar: true });
    const grupo = escopos.find(e => e.escopo === escopo);

    const { corpo } = abrirPainel({
        titulo: `Categorias: ${grupo?.nome || escopo}`,
        classe: 'painel-categorias',
        html: `
            <p class="modulos-ajuda">Toque no lápis para mudar nome, cor e ícone. Use as setas para mudar a ordem em que aparecem.</p>
            <div class="categorias-lista">${htmlLinhas(escopo)}</div>
            <div class="painel-acoes"><button type="button" class="btn btn-primary" data-nova><i class="fa-solid fa-plus"></i> Nova categoria</button></div>
        `
    });
    const lista = corpo.querySelector('.categorias-lista');
    const redesenhar = () => { lista.innerHTML = htmlLinhas(escopo); };

    corpo.querySelector('[data-nova]').addEventListener('click', () => abrirFormularioCategoria(escopo, null, redesenhar));

    lista.addEventListener('click', async (e) => {
        const linha = e.target.closest('.categoria-linha');
        if (!linha) return;
        const atual = categoriasDe(escopo).find(c => c.id === linha.dataset.id);

        if (e.target.closest('[data-editar]')) {
            abrirFormularioCategoria(escopo, atual, redesenhar);
        } else if (e.target.closest('[data-excluir]')) {
            if (await excluirCategoria(escopo, atual)) redesenhar();
        } else if (e.target.closest('[data-mover]')) {
            const ids = categoriasDe(escopo).map(c => c.id);
            const de = ids.indexOf(atual.id);
            const para = de + Number(e.target.closest('[data-mover]').dataset.mover);
            [ids[de], ids[para]] = [ids[para], ids[de]];
            try {
                await api(`/categorias/${escopo}/ordem`, { metodo: 'PUT', corpo: { ids } });
                await aposMudar(escopo);
                redesenhar();
            } catch (error) {
                mostrarNotificacao(error.message || 'Erro ao reordenar', 'error');
            }
        }
    });
}

// Excluir: se houver registros usando, pergunta para qual categoria eles vão
async function excluirCategoria(escopo, alvo) {
    if (!(await mostrarConfirmacao(`Excluir a categoria "${alvo.nome}"?`, { titulo: 'Excluir categoria', confirmarTexto: 'Excluir' }))) return false;
    const tentar = (substituta) => api(`/categorias/${escopo}/${alvo.id}${substituta ? `?substituta=${encodeURIComponent(substituta)}` : ''}`, { metodo: 'DELETE' });
    try {
        await tentar();
    } catch (error) {
        if (error.status !== 409) {
            mostrarNotificacao(error.message || 'Erro ao excluir', 'error');
            return false;
        }
        const substituta = await mostrarEscolha(`${error.message}`, {
            titulo: `Mover para outra categoria`,
            opcoes: categoriasDe(escopo).filter(c => c.id !== alvo.id).map(c => ({ valor: c.chave, texto: escaparHtml(c.nome) }))
        });
        if (!substituta) return false;
        try {
            const { movidos } = await tentar(substituta);
            mostrarNotificacao(`${movidos} registro(s) movidos`, 'info');
        } catch (erro) {
            mostrarNotificacao(erro.message || 'Erro ao excluir', 'error');
            return false;
        }
    }
    await aposMudar(escopo);
    mostrarNotificacao('Categoria excluída', 'success');
    return true;
}

function abrirFormularioCategoria(escopo, atual, aoSalvar) {
    const valores = { nome: atual?.nome || '', cor: atual?.cor || CORES[8], icone: atual?.icone || ICONES[0] };
    const { corpo, fechar } = abrirPainel({
        titulo: atual ? `Editando: ${atual.nome}` : 'Nova categoria',
        classe: 'painel-categorias',
        html: `
            <form class="form-stack form-categoria" novalidate>
                <div class="categoria-previa"><span class="chip"><span><i></i> <b></b></span></span></div>
                <label class="field"><span>Nome</span>
                    <input type="text" name="nome" maxlength="30" value="${escaparHtml(valores.nome)}" required></label>
                <div class="field"><span>Cor</span>
                    <div class="categoria-cores">
                        ${CORES.map(cor => `<button type="button" class="categoria-cor" data-cor="${cor}" style="background: ${cor}" aria-label="Cor ${cor}"></button>`).join('')}
                        <label class="categoria-cor categoria-cor-livre" aria-label="Outra cor"><i class="fa-solid fa-eye-dropper"></i><input type="color" name="cor" value="${valores.cor}"></label>
                    </div>
                </div>
                <div class="field"><span>Ícone</span>
                    <input type="search" class="categoria-busca-icone" placeholder="Filtrar ícones (em inglês: cake, car, wifi...)" autocomplete="off">
                    <div class="categoria-icones">
                        ${ICONES.map(icone => `<button type="button" class="categoria-icone-opcao" data-icone="${icone}" aria-label="${icone.replace('fa-solid fa-', '')}"><i class="${icone}"></i></button>`).join('')}
                    </div>
                </div>
                <div class="painel-acoes"><button type="submit" class="btn btn-primary">${atual ? 'Salvar' : 'Criar categoria'}</button></div>
            </form>
        `
    });
    const form = corpo.querySelector('form');

    const atualizarPrevia = () => {
        const chip = form.querySelector('.categoria-previa .chip');
        chip.style.setProperty('--cat', valores.cor);
        chip.querySelector('i').className = valores.icone;
        chip.querySelector('b').textContent = form.elements.nome.value.trim() || 'Nova categoria';
        form.querySelectorAll('.categoria-cor[data-cor]').forEach(b => b.classList.toggle('selecionada', b.dataset.cor === valores.cor));
        form.querySelectorAll('.categoria-icone-opcao').forEach(b => b.classList.toggle('selecionada', b.dataset.icone === valores.icone));
        form.querySelector('.categoria-icones').style.setProperty('--cat', valores.cor);
    };
    atualizarPrevia();
    if (!atual) form.elements.nome.focus();

    form.elements.nome.addEventListener('input', atualizarPrevia);
    form.elements.cor.addEventListener('input', (e) => { valores.cor = e.target.value; atualizarPrevia(); });
    form.querySelector('.categoria-cores').addEventListener('click', (e) => {
        const botao = e.target.closest('[data-cor]');
        if (!botao) return;
        valores.cor = botao.dataset.cor;
        form.elements.cor.value = valores.cor;
        atualizarPrevia();
    });
    form.querySelector('.categoria-icones').addEventListener('click', (e) => {
        const botao = e.target.closest('[data-icone]');
        if (!botao) return;
        valores.icone = botao.dataset.icone;
        atualizarPrevia();
    });
    form.querySelector('.categoria-busca-icone').addEventListener('input', (e) => {
        const termo = e.target.value.trim().toLowerCase();
        form.querySelectorAll('.categoria-icone-opcao').forEach(b => { b.hidden = termo && !b.dataset.icone.includes(termo); });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = { nome: form.elements.nome.value.trim(), cor: valores.cor, icone: valores.icone };
        if (!dados.nome) return mostrarNotificacao('Dê um nome para a categoria', 'warning');
        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            await api(atual ? `/categorias/${escopo}/${atual.id}` : `/categorias/${escopo}`, { metodo: atual ? 'PUT' : 'POST', corpo: dados });
            await aposMudar(escopo);
            mostrarNotificacao(atual ? 'Categoria atualizada' : 'Categoria criada', 'success');
            fechar();
            aoSalvar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao salvar a categoria', 'error');
            definirCarregando(botao, false);
        }
    });
}

// ===== AJUSTES =====
const HTML_SECAO = `
    <p class="modulos-ajuda">Nome, cor e ícone das categorias usadas na agenda, na lista de compras e nas anotações.</p>
    <div id="categorias-grupos" class="menu-usuario-itens"><p>Carregando...</p></div>
`;

async function renderizarGrupos() {
    const container = document.getElementById('categorias-grupos');
    if (!container) return;
    const grupos = (await carregarEscopos()).filter(g => g.podeGerenciar);
    container.innerHTML = grupos.length ? grupos.map(g => `
        <button type="button" class="modulo-bloco menu-usuario-item" data-acao="gerenciar-categorias" data-escopo="${escaparHtml(g.escopo)}">
            <span class="modulo-bloco-icone icon-gray"><i class="fa-solid fa-tags"></i></span>
            <span class="menu-usuario-texto"><span class="modulo-bloco-nome">${escaparHtml(g.nome)}</span></span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `).join('') : '<p class="empty-state">Nenhum grupo de categorias disponível.</p>';
}

export default {
    id: 'categorias',
    secoesAjustes: [
        { id: 'acc-categorias', titulo: 'Categorias', icone: 'fa-solid fa-tags', cor: 'icon-green', html: HTML_SECAO }
    ],

    iniciar() {
        registrarAcoes({ 'gerenciar-categorias': ({ escopo }) => abrirGerenciadorCategorias(escopo) });
        return renderizarGrupos();
    }
};
