import { api } from './api.js';
import { escaparHtml, mostrarNotificacao } from './ui.js';
import { temPermissao } from './sessao.js';
import { mostrarConfirmacao } from './modal.js';

// Informações do sistema (núcleo): módulos ligados/desligados e versão em execução

// ===== MÓDULOS =====
// Catálogo de todos os módulos do frontend (ativos ou não), passado pelo main.js
let catalogo = [];

export function definirCatalogoModulos(modulos) {
    catalogo = modulos;
}

const HTML_SECAO_MODULOS = `
    <p class="modulos-ajuda">Desligue o que a casa não usa: o módulo some do menu para todos. Os dados ficam guardados e voltam quando ele for religado.</p>
    <div id="modulos-config" class="modulos-config"><p>Carregando...</p></div>
`;

async function carregarModulosConfig() {
    const container = document.getElementById('modulos-config');
    if (!container || !temPermissao('modulos:gerenciar')) return;
    try {
        const doBackend = await api('/modulos');
        // Só módulos de funcionalidade (com telas próprias) que o backend permite desligar
        const desligaveis = catalogo
            .map(modulo => ({ modulo, backend: doBackend.find(b => b.id === modulo.id) }))
            .filter(({ modulo, backend }) => backend && !backend.nucleo && modulo.abas?.length && !modulo.global);

        container.innerHTML = desligaveis.map(({ modulo, backend }) => `
            <label class="modulo-config ${backend.ativo ? '' : 'desligado'}">
                <span class="acc-icon ${modulo.cor}"><i class="${modulo.icone}"></i></span>
                <span class="modulo-config-texto">
                    <span class="modulo-config-nome">${escaparHtml(modulo.nome)}</span>
                    <span class="modulo-config-descricao">${escaparHtml(modulo.descricao || '')}</span>
                </span>
                <span class="interruptor">
                    <input type="checkbox" role="switch" data-modulo="${escaparHtml(modulo.id)}" ${backend.ativo ? 'checked' : ''} aria-label="${escaparHtml(modulo.nome)} ativo">
                    <span class="interruptor-trilho"></span>
                </span>
            </label>
        `).join('') || '<p class="empty-state">Nenhum módulo pode ser desligado.</p>';
    } catch (error) {
        console.error('Erro ao carregar módulos:', error);
        container.innerHTML = '<p>Não foi possível carregar os módulos.</p>';
    }
}

// Ligar/desligar recarrega a página: a interface é montada só com os módulos ativos
async function alternarModulo(e) {
    const caixa = e.target.closest('input[data-modulo]');
    if (!caixa) return;
    const modulo = catalogo.find(m => m.id === caixa.dataset.modulo);
    const ativo = caixa.checked;

    if (!ativo && !(await mostrarConfirmacao(`Desligar "${modulo.nome}" para toda a casa? Ele some do menu, mas nada é apagado: religue aqui quando quiser.`, { titulo: 'Desligar módulo', confirmarTexto: 'Desligar' }))) {
        caixa.checked = true;
        return;
    }

    caixa.disabled = true;
    try {
        await api(`/modulos/${modulo.id}`, { metodo: 'PUT', corpo: { ativo } });
        mostrarNotificacao(`${modulo.nome} ${ativo ? 'ligado' : 'desligado'}. Atualizando...`, 'success', 1500);
        setTimeout(() => location.reload(), 900);
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao alterar o módulo', 'error');
        caixa.checked = !ativo;
        caixa.disabled = false;
    }
}

// ===== VERSÃO =====
const HTML_SECAO = `
    <div id="versao-info" class="versao-info">
        <p>Carregando...</p>
    </div>
`;

async function carregarVersao() {
    const container = document.getElementById('versao-info');
    try {
        const versao = await api('/versao', { cache: 'no-store' });
        if (!versao.sha) {
            container.innerHTML = '<p>Versão não identificada.</p>';
            return;
        }

        const shaCurto = escaparHtml(versao.sha.slice(0, 7));
        const commit = versao.url
            ? `<a href="${escaparHtml(versao.url)}" target="_blank" rel="noopener"><code>${shaCurto}</code></a>`
            : `<code>${shaCurto}</code>`;
        const data = versao.data
            ? new Date(versao.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : null;

        container.innerHTML = `
            <p><strong>Ambiente:</strong> ${escaparHtml(versao.ambiente)}</p>
            <p><strong>Commit:</strong> ${commit}${versao.branch ? ` (${escaparHtml(versao.branch)})` : ''}</p>
            ${versao.mensagem ? `<p><strong>Mensagem:</strong> ${escaparHtml(versao.mensagem)}</p>` : ''}
            ${versao.autor ? `<p><strong>Autor:</strong> ${escaparHtml(versao.autor)}</p>` : ''}
            ${data ? `<p><strong>Data:</strong> ${escaparHtml(data)}</p>` : ''}
        `;
    } catch (error) {
        console.error('Erro ao carregar versão:', error);
        container.innerHTML = '<p>Não foi possível carregar a versão.</p>';
    }
}

export default {
    id: 'sistema',
    secoesAjustes: [
        { id: 'acc-modulos', titulo: 'Módulos', icone: 'fa-solid fa-puzzle-piece', cor: 'icon-purple', html: HTML_SECAO_MODULOS, permissao: 'modulos:gerenciar' },
        { id: 'acc-versao', titulo: 'Versão em Execução', icone: 'fa-solid fa-code-branch', cor: 'icon-gray', html: HTML_SECAO }
    ],

    iniciar() {
        document.getElementById('modulos-config')?.addEventListener('change', alternarModulo);
        carregarModulosConfig();
        carregarVersao();
    }
};
