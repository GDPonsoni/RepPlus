import { escaparHtml, iniciais, definirAccordionAberto } from './ui.js';
import { aplicarPermissoes, temPermissao, obterSessao } from './sessao.js';
import { sair } from './entrada.js';
import { registrarAcoes } from './acoes.js';
import { abrirPainel } from './painel.js';
import { nomeDaRepublica } from './aparencia.js';
import { movimentoReduzido } from './movimento.js';

// Monta a interface a partir dos módulos e cuida da navegação.
//
// Contrato de um módulo do frontend (veja modules/agenda/index.js):
//   {
//     id: 'agenda',                     // mesmo id do módulo no backend
//     nome, descricao, icone, cor,      // como aparece na navegação (cor = classe icon-*)
//     menu: 'usuario',                  // opcional: vai para o menu do canto (moradores, ajustes) em vez da navegação principal
//     abas: [{ id, titulo, icone, html | secoes, permissao?, aoAbrir() }],
//     secoesAjustes: [{ id, titulo, icone, cor, html, permissao? }],  // vão para a página global Ajustes
//     inicio: { titulo, rota, permissao, conteudo(), aoMontar? },    // cartão de resumo no Início (core/inicio.js)
//     avisos: async () => [{ id, texto, icone?, tipo?, rota? }],      // avisos do sino (core/avisos.js)
//     iniciar()                         // liga eventos e carrega os dados iniciais (pode ser async)
//   }
//
// Navegação: no computador, menu lateral com todos os módulos principais; no celular, barra
// inferior com os primeiros e "Mais" para o resto. Moradores e Ajustes ficam no menu do usuário
// (canto superior direito), onde também entrarão perfil e sair quando houver login.
//
// Uma aba com `secoes` vira uma lista de seções recolhíveis (como a página de Ajustes).
// Endereços: #/<modulo>/<aba>. Módulos sem abas (ex.: aparência) só contribuem com secoesAjustes.
// Sem endereço, abre o primeiro módulo da lista (o Início).

// Quantos itens cabem na barra inferior do celular (contando o "Mais", quando houver)
const ITENS_BARRA_INFERIOR = 5;

let modulos = [];
let rotaAtual = null;

// Onde cada aba estava rolada: voltar a uma aba devolve o lugar (tocar de novo no item atual sobe ao topo)
const rolagemPorAba = new Map();
const chaveDaAba = ({ modulo, aba }) => `${modulo.id}/${aba.id}`;

const principais = () => modulos.filter(modulo => modulo.menu !== 'usuario');
const doMenuUsuario = () => modulos.filter(modulo => modulo.menu === 'usuario');

// Na barra inferior: se todos cabem, mostra todos; senão, os primeiros e o "Mais"
function divisaoBarraInferior() {
    const lista = principais();
    if (lista.length <= ITENS_BARRA_INFERIOR) return { naBarra: lista, noMais: [] };
    return { naBarra: lista.slice(0, ITENS_BARRA_INFERIOR - 1), noMais: lista.slice(ITENS_BARRA_INFERIOR - 1) };
}

function htmlSecao(secao) {
    return `
        <div class="acc" id="${secao.id}" ${secao.permissao ? `data-permissao="${secao.permissao}"` : ''}>
            <button type="button" class="acc-header" aria-expanded="false">
                <span class="acc-icon ${secao.cor}"><i class="${secao.icone}"></i></span>
                <span class="acc-label">${escaparHtml(secao.titulo)}</span>
                <i class="fa-solid fa-chevron-down acc-chevron"></i>
            </button>
            <div class="acc-body"><div class="acc-inner">${secao.html}</div></div>
        </div>
    `;
}

function htmlAba(modulo, aba) {
    const conteudo = aba.secoes
        ? `<h2 class="section-title">${escaparHtml(aba.tituloPagina || aba.titulo)}</h2>
           <div class="card settings-list">${aba.secoes.map(htmlSecao).join('')}</div>`
        : aba.html;
    return `<section id="aba-${modulo.id}-${aba.id}" class="tab-content ${aba.secoes ? 'pagina-estreita' : ''}">${conteudo}</section>`;
}

// ===== NAVEGAÇÃO PRINCIPAL =====
function renderizarNavegacao() {
    document.getElementById('menu-lateral').innerHTML = `
        <div class="menu-lateral-itens">
            ${principais().map(modulo => `
                <button type="button" class="menu-lateral-item" data-acao="ir-para" data-rota="${modulo.id}" data-modulo="${modulo.id}">
                    <span class="acc-icon ${modulo.cor}"><i class="${modulo.icone}"></i></span>
                    <span>${escaparHtml(modulo.nome)}</span>
                </button>
            `).join('')}
        </div>
    `;

    const { naBarra, noMais } = divisaoBarraInferior();
    document.getElementById('nav-inferior').innerHTML = `
        ${naBarra.map(modulo => `
            <button type="button" class="nav-inferior-item" data-acao="ir-para" data-rota="${modulo.id}" data-modulo="${modulo.id}">
                <i class="${modulo.icone}"></i><span>${escaparHtml(modulo.nomeCurto || modulo.nome)}</span>
            </button>
        `).join('')}
        ${noMais.length ? `
            <button type="button" class="nav-inferior-item" data-acao="abrir-mais" data-modulo="mais">
                <i class="fa-solid fa-grip"></i><span>Mais</span>
            </button>
        ` : ''}
    `;
    document.body.classList.toggle('com-nav-inferior', principais().length > 1);
}

function marcarAtivo(modulo) {
    const { noMais } = divisaoBarraInferior();
    document.querySelectorAll('.menu-lateral-item, .nav-inferior-item').forEach(item => {
        const ativo = item.dataset.modulo === modulo.id || (item.dataset.modulo === 'mais' && noMais.includes(modulo));
        item.classList.toggle('ativo', ativo);
        if (ativo) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });
    document.querySelector('.header-usuario').classList.toggle('ativo', modulo.menu === 'usuario');
}

function htmlBlocoModulo(modulo) {
    const atual = rotaAtual?.modulo.id === modulo.id;
    return `
        <button type="button" class="modulo-bloco ${atual ? 'atual' : ''}" data-modulo="${modulo.id}" ${atual ? 'aria-current="true"' : ''}>
            <span class="modulo-bloco-icone ${modulo.cor}"><i class="${modulo.icone}"></i></span>
            <span class="modulo-bloco-nome">${escaparHtml(modulo.nome)}</span>
            <span class="modulo-bloco-descricao">${escaparHtml(modulo.descricao || '')}</span>
        </button>
    `;
}

// Painel com blocos de módulos; tocar em um navega até ele
function painelDeModulos({ titulo, classe, html }) {
    const { corpo, fechar } = abrirPainel({ titulo, classe, html });
    corpo.querySelectorAll('.modulo-bloco').forEach(bloco => {
        bloco.addEventListener('click', () => {
            fechar();
            if (bloco.dataset.modulo !== rotaAtual?.modulo.id) navegar(bloco.dataset.modulo);
        });
    });
    return { corpo, fechar };
}

function abrirMais() {
    painelDeModulos({
        titulo: 'Mais módulos',
        classe: 'painel-seletor',
        html: `<div class="modulo-grade">${divisaoBarraInferior().noMais.map(htmlBlocoModulo).join('')}</div>`
    });
}

// ===== MENU DO USUÁRIO (canto superior direito) =====
// Mostra quem está usando e os módulos do menu; com a senha da casa, também o botão Sair.
function abrirMenuUsuario() {
    const { usuario, papel, modo } = obterSessao();
    const nome = usuario?.nome || 'Visitante';
    painelDeModulos({
        titulo: nomeDaRepublica(),
        classe: 'painel-canto painel-usuario',
        html: `
            <div class="usuario-cartao">
                <span class="avatar avatar-lg">${usuario?.id ? escaparHtml(iniciais(nome)) : '<i class="fa-solid fa-user"></i>'}</span>
                <span class="usuario-info">
                    <strong>${escaparHtml(nome)}</strong>
                    <span>${escaparHtml(papel?.nome || '')}${modo === 'aberto' ? ' · sem login' : ''}</span>
                </span>
            </div>
            <div class="menu-usuario-itens">${doMenuUsuario().map(modulo => `
                <button type="button" class="modulo-bloco menu-usuario-item ${rotaAtual?.modulo.id === modulo.id ? 'atual' : ''}" data-modulo="${modulo.id}">
                    <span class="modulo-bloco-icone ${modulo.cor}"><i class="${modulo.icone}"></i></span>
                    <span class="menu-usuario-texto">
                        <span class="modulo-bloco-nome">${escaparHtml(modulo.nome)}</span>
                        <span class="modulo-bloco-descricao">${escaparHtml(modulo.descricao || '')}</span>
                    </span>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `).join('')}</div>
            ${modo === 'aberto' ? '<p class="menu-usuario-nota"><i class="fa-solid fa-circle-info"></i> O app ainda não tem login: todos acessam como administrador.</p>' : ''}
            ${modo === 'senha' ? '<button type="button" class="btn btn-ghost menu-usuario-sair" data-acao="sair"><i class="fa-solid fa-right-from-bracket"></i> Sair deste aparelho</button>' : ''}
        `
    });
}

function atualizarAvatar() {
    const { usuario } = obterSessao();
    if (usuario?.id) document.getElementById('usuario-avatar').textContent = iniciais(usuario.nome);
}

// ===== MONTAGEM =====
export function montarInterface(modulosAtivos) {
    // A página de Ajustes é do núcleo: reúne as seções globais de todos os módulos
    const ajustes = {
        id: 'ajustes', nome: 'Ajustes', descricao: 'Aparência, módulos e sistema', icone: 'fa-solid fa-gear', cor: 'icon-gray', menu: 'usuario',
        abas: [{ id: 'geral', titulo: 'Ajustes', tituloPagina: 'Ajustes do Sistema', icone: 'fa-solid fa-gear', secoes: modulosAtivos.flatMap(m => m.secoesAjustes || []) }]
    };

    modulos = [...modulosAtivos, ajustes]
        .map(modulo => ({ ...modulo, abas: (modulo.abas || []).filter(aba => !aba.permissao || temPermissao(aba.permissao)) }))
        .filter(modulo => modulo.abas.length > 0);

    document.getElementById('conteudo').innerHTML = modulos
        .flatMap(modulo => modulo.abas.map(aba => htmlAba(modulo, aba)))
        .join('');

    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => {
            const acc = header.closest('.acc');
            definirAccordionAberto(acc, !acc.classList.contains('open'));
        });
    });

    renderizarNavegacao();
    atualizarAvatar();

    registrarAcoes({
        'abrir-mais': abrirMais,
        'abrir-menu-usuario': abrirMenuUsuario,
        sair,
        'ir-para': ({ rota }) => navegar(rota)
    });

    aplicarPermissoes();
}

export function navegar(rota) {
    if (location.hash === `#/${rota}`) mostrarRota(rota, { repetida: true });
    else location.hash = `#/${rota}`;
}

// Barrinha que desliza até a aba ativa (e a aba ativa entra na tela quando a barra rola de lado)
function posicionarIndicadorDaAba() {
    const nav = document.getElementById('nav-abas');
    // Sem abas na página (ex.: tela de entrada)
    if (!nav) return;
    const ativa = nav.querySelector('.tab-btn.active');
    const indicador = nav.querySelector('.tab-indicador');
    if (!ativa || !indicador) return;
    indicador.style.width = `${ativa.offsetWidth}px`;
    indicador.style.transform = `translateX(${ativa.offsetLeft}px)`;
    const fora = ativa.offsetLeft < nav.scrollLeft || ativa.offsetLeft + ativa.offsetWidth > nav.scrollLeft + nav.clientWidth;
    if (fora) nav.scrollTo({ left: ativa.offsetLeft - (nav.clientWidth - ativa.offsetWidth) / 2, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
}
window.addEventListener('resize', posicionarIndicadorDaAba);
document.fonts?.ready.then(posicionarIndicadorDaAba);

// Resolve "modulo/aba" (qualquer parte pode faltar ou não existir) para um módulo e uma aba válidos
function resolverRota(rota) {
    const [idModulo, idAba] = String(rota || '').split('/');
    const modulo = modulos.find(m => m.id === idModulo) || modulos[0];
    const aba = modulo.abas.find(a => a.id === idAba) || modulo.abas[0];
    return { modulo, aba };
}

function mostrarRota(rota, { repetida = false } = {}) {
    const { modulo, aba } = resolverRota(rota);
    const anterior = rotaAtual;
    const mudouModulo = anterior?.modulo !== modulo;
    if (anterior) rolagemPorAba.set(chaveDaAba(anterior), window.scrollY);
    rotaAtual = { modulo, aba };

    // Cabeçalho: nome e ícone do módulo atual
    document.getElementById('modulo-atual-icone').className = modulo.icone;
    const nomeModulo = document.getElementById('modulo-atual-nome');
    nomeModulo.textContent = modulo.nome;
    // Nome curto na etiqueta do cabeçalho amplo no celular (ver CSS)
    nomeModulo.dataset.curto = modulo.nomeCurto || modulo.nome;
    document.title = `${modulo.nome} · ${nomeDaRepublica()}`;
    marcarAtivo(modulo);

    // Abas do módulo (a barra some quando o módulo tem uma aba só)
    const nav = document.getElementById('nav-abas');
    if (mudouModulo) {
        nav.innerHTML = modulo.abas.map(a => `
            <button class="tab-btn" data-acao="ir-para" data-rota="${modulo.id}/${a.id}" data-tab="${a.id}">
                <i class="${a.icone}"></i><span>${escaparHtml(a.titulo)}</span>
            </button>
        `).join('') + '<span class="tab-indicador" aria-hidden="true"></span>';
        nav.classList.add('sem-transicao');
        nav.closest('.nav-tabs').hidden = modulo.abas.length < 2;
    }
    nav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === aba.id));
    posicionarIndicadorDaAba();
    requestAnimationFrame(() => nav.classList.remove('sem-transicao'));

    // Entrada da aba: entre abas do mesmo módulo desliza para o lado da aba escolhida;
    // ao trocar de módulo sobe de leve, e os cartões aparecem em sequência (classe "entrando")
    const secao = document.getElementById(`aba-${modulo.id}-${aba.id}`);
    const mudouAba = anterior && anterior.aba !== aba;
    if (mudouAba || !anterior) {
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active', 'entrando'));
        const passo = mudouModulo ? 0 : modulo.abas.indexOf(aba) - modulo.abas.indexOf(anterior.aba);
        secao.dataset.entrada = passo > 0 ? 'direita' : passo < 0 ? 'esquerda' : 'acima';
        secao.classList.add('active', 'entrando');
        clearTimeout(secao.fimDaEntrada);
        secao.fimDaEntrada = setTimeout(() => secao.classList.remove('entrando'), 1000);
    }

    // Cada aba carrega seus dados ao ser aberta
    aba.aoAbrir?.();

    // Rolagem: tocar de novo no que já está aberto sobe ao topo; voltar a uma aba devolve o lugar
    const guardada = repetida ? 0 : (rolagemPorAba.get(chaveDaAba(rotaAtual)) ?? 0);
    window.scrollTo({ top: guardada, behavior: repetida && !movimentoReduzido() ? 'smooth' : 'auto' });
}

export function iniciarNavegacao() {
    const rotaDoEndereco = () => location.hash.replace(/^#\/?/, '');
    window.addEventListener('hashchange', () => mostrarRota(rotaDoEndereco()));
    mostrarRota(rotaDoEndereco());
}
