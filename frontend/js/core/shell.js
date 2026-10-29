import { escaparHtml, definirAccordionAberto } from './ui.js';
import { aplicarPermissoes, temPermissao } from './sessao.js';
import { registrarAcoes } from './acoes.js';
import { abrirPainel } from './painel.js';
import { nomeDaRepublica } from './aparencia.js';

// Monta a interface a partir dos módulos e cuida da navegação (seletor de módulos + abas).
//
// Contrato de um módulo do frontend (veja modules/agenda/index.js):
//   {
//     id: 'agenda',                     // mesmo id do módulo no backend
//     nome, descricao, icone, cor,      // como aparece no seletor de módulos (cor = classe icon-*)
//     global: false,                    // true = grupo "Geral" do seletor (moradores, ajustes)
//     abas: [{ id, titulo, icone, html | secoes, permissao?, aoAbrir() }],
//     secoesAjustes: [{ id, titulo, icone, cor, html, permissao? }],  // vão para a página global Ajustes
//     iniciar()                         // liga eventos e carrega os dados iniciais (pode ser async)
//   }
//
// Uma aba com `secoes` vira uma lista de seções recolhíveis (como a página de Ajustes).
// Endereços: #/<modulo>/<aba>. Módulos sem abas (ex.: aparência) só contribuem com secoesAjustes.

const CHAVE_ULTIMA_ROTA = 'escala:ultima-rota';

let modulos = [];
let rotaAtual = null;

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

export function montarInterface(modulosAtivos) {
    // A página de Ajustes é do núcleo: reúne as seções globais de todos os módulos
    const ajustes = {
        id: 'ajustes', nome: 'Ajustes', descricao: 'Aparência e sistema', icone: 'fa-solid fa-gear', cor: 'icon-gray', global: true,
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

    registrarAcoes({
        'abrir-seletor': abrirSeletorModulos,
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
    try { localStorage.setItem(CHAVE_ULTIMA_ROTA, `${modulo.id}/${aba.id}`); } catch { /* sem armazenamento: só não lembra */ }

    // Cabeçalho: nome e ícone do módulo atual
    document.getElementById('modulo-atual-icone').className = modulo.icone;
    document.getElementById('modulo-atual-nome').textContent = modulo.nome;
    document.title = `${modulo.nome} · ${nomeDaRepublica()}`;

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

    let inicial = rotaDoEndereco();
    if (!inicial) {
        try { inicial = localStorage.getItem(CHAVE_ULTIMA_ROTA) || ''; } catch { inicial = ''; }
    }
    mostrarRota(inicial);
}

// ===== SELETOR DE MÓDULOS =====
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

function abrirSeletorModulos() {
    const funcionalidades = modulos.filter(m => !m.global);
    const gerais = modulos.filter(m => m.global);

    const { corpo, fechar } = abrirPainel({
        titulo: 'Módulos',
        classe: 'painel-seletor',
        html: `
            ${funcionalidades.length ? `<p class="seletor-grupo">Módulos</p><div class="modulo-grade">${funcionalidades.map(htmlBlocoModulo).join('')}</div>` : ''}
            ${gerais.length ? `<p class="seletor-grupo">Geral</p><div class="modulo-grade">${gerais.map(htmlBlocoModulo).join('')}</div>` : ''}
        `
    });

    corpo.querySelectorAll('.modulo-bloco').forEach(bloco => {
        bloco.addEventListener('click', () => {
            fechar();
            if (bloco.dataset.modulo !== rotaAtual?.modulo.id) navegar(bloco.dataset.modulo);
        });
    });
    corpo.querySelector('.modulo-bloco.atual')?.focus();
}
