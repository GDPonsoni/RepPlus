import { api } from './api.js';
import { escaparHtml } from './ui.js';

// Informações do sistema (núcleo): versão em execução
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
    secoesConfig: [
        { id: 'acc-versao', titulo: 'Versão em Execução', icone: 'fa-solid fa-code-branch', cor: 'icon-gray', html: HTML_SECAO }
    ],

    iniciar() {
        carregarVersao();
    }
};
