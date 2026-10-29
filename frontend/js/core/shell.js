import { escaparHtml, iniciais, definirAccordionAberto } from './ui.js';
import { aplicarPermissoes, temPermissao, obterSessao } from './sessao.js';
import { registrarAcoes } from './acoes.js';
import { abrirPainel } from './painel.js';
import { nomeDaRepublica } from './aparencia.js';

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
// Hoje mostra o acesso aberto; com login, aqui entram "Meu perfil" e "Sair".
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
        'ir-para': ({ rota }) => navegar(rota)
    });

    aplicarPermissoes();
}

export function navegar(rota) {
    if (location.hash === `#/${rota}`) mostrarRota(rota);
    else location.hash = `#/${rota}`;
}

// Resolve "modulo/aba" (qualquer parte pode faltar ou não existir) para um módulo e uma aba válidos
function resolverRota(rota) {
    const [idModulo, idAba] = String(rota || '').split('/');
    const modulo = modulos.find(m => m.id === idModulo) || modulos[0];
    const aba = modulo.abas.find(a => a.id === idAba) || modulo.abas[0];
    return { modulo, aba };
}

function mostrarRota(rota) {
    const { modulo, aba } = resolverRota(rota);
    const mudouModulo = rotaAtual?.modulo !== modulo;
    rotaAtual = { modulo, aba };

    // Cabeçalho: nome e ícone do módulo atual
    document.getElementById('modulo-atual-icone').className = modulo.icone;
    document.getElementById('modulo-atual-nome').textContent = modulo.nome;
    document.title = `${modulo.nome} · ${nomeDaRepublica()}`;
    marcarAtivo(modulo);

    // Abas do módulo (a barra some quando o módulo tem uma aba só)
    const nav = document.getElementById('nav-abas');
    if (mudouModulo) {
        nav.innerHTML = modulo.abas.map(a => `
            <button class="tab-btn" data-acao="ir-para" data-rota="${modulo.id}/${a.id}" data-tab="${a.id}">
                <i class="${a.icone}"></i><span>${escaparHtml(a.titulo)}</span>
            </button>
        `).join('');
        nav.closest('.nav-tabs').hidden = modulo.abas.length < 2;
    }
    nav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === aba.id));

    document.querySelectorAll('.tab-content').forEach(secao => secao.classList.remove('active'));
    document.getElementById(`aba-${modulo.id}-${aba.id}`).classList.add('active');

    // Cada aba carrega seus dados ao ser aberta
    aba.aoAbrir?.();

    window.scrollTo({ top: 0, behavior: mudouModulo ? 'auto' : 'smooth' });
}

export function iniciarNavegacao() {
    const rotaDoEndereco = () => location.hash.replace(/^#\/?/, '');
    window.addEventListener('hashchange', () => mostrarRota(rotaDoEndereco()));
    mostrarRota(rotaDoEndereco());
}
