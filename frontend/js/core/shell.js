import { escaparHtml, definirAccordionAberto } from './ui.js';
import { aplicarPermissoes } from './sessao.js';

// Monta a interface a partir dos módulos registrados e cuida da navegação entre abas.
//
// Contrato de um módulo do frontend (veja modules/escala/index.js):
//   {
//     id: 'escala',                 // mesmo id do módulo no backend
//     abas: [{ id, titulo, icone, html, aoAbrir() }],
//     secoesConfig: [{ id, titulo, icone, cor, html, permissao? }],  // viram seções em Config
//     iniciar()                     // liga eventos e carrega os dados iniciais (pode ser async)
//   }
//
// A aba de configurações é do núcleo e sempre fica por último, reunindo as seções de todos os módulos.

const ABA_CONFIG = { id: 'config', titulo: 'Config', icone: 'fa-solid fa-gear' };

let abas = [];

function htmlSecaoConfig(secao) {
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

export function montarInterface(modulos) {
    abas = [...modulos.flatMap(modulo => modulo.abas || []), ABA_CONFIG];
    const secoes = modulos.flatMap(modulo => modulo.secoesConfig || []);

    document.getElementById('nav-abas').innerHTML = abas.map(aba => `
        <button class="tab-btn" data-tab="${aba.id}">
            <i class="${aba.icone}"></i><span>${escaparHtml(aba.titulo)}</span>
        </button>
    `).join('');

    const conteudo = abas.filter(aba => aba !== ABA_CONFIG).map(aba => `
        <section id="${aba.id}" class="tab-content">${aba.html}</section>
    `).join('');

    document.getElementById('conteudo').innerHTML = `
        ${conteudo}
        <section id="${ABA_CONFIG.id}" class="tab-content">
            <h2 class="section-title">Ajustes do Sistema</h2>
            <div class="card settings-list">
                ${secoes.map(htmlSecaoConfig).join('')}
            </div>
        </section>
    `;

    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => {
            const acc = header.closest('.acc');
            definirAccordionAberto(acc, !acc.classList.contains('open'));
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            // Vai pelo endereço (#/historico) para o botão "voltar" do celular funcionar entre abas
            if (location.hash === `#/${tabName}`) mudarAba(tabName);
            else location.hash = `#/${tabName}`;
        });
    });

    aplicarPermissoes();
}

export function mudarAba(tabName) {
    const aba = abas.find(a => a.id === tabName) || abas[0];

    // Remover active de todos os tabs e conteúdo
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Adicionar active ao tab selecionado
    document.querySelector(`[data-tab="${aba.id}"]`).classList.add('active');
    document.getElementById(aba.id).classList.add('active');

    // Cada aba carrega seus dados ao ser aberta
    aba.aoAbrir?.();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function iniciarNavegacao() {
    const abaDoEndereco = () => location.hash.replace(/^#\/?/, '');
    window.addEventListener('hashchange', () => mudarAba(abaDoEndereco()));
    mudarAba(abaDoEndereco());
}
