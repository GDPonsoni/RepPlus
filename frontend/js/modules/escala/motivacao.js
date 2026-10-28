import { api } from '../../core/api.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { escaparHtml, mostrarNotificacao, validarArquivoImagem, definirCarregando } from '../../core/ui.js';
import { atualizarConfig } from '../../core/aparencia.js';
import { estado } from './estado.js';
import { carregarEscalaAtual } from './atual.js';

// Imagens motivacionais: destaque na aba "Atual" e galeria em Config

export async function uploadMotivacao(e) {
    e.preventDefault();

    const fileInput = document.getElementById('motivacao-imagem');
    const file = fileInput.files[0];

    if (!file) {
        mostrarNotificacao('Selecione uma imagem', 'warning');
        return;
    }

    const erroValidacao = validarArquivoImagem(file);
    if (erroValidacao) {
        mostrarNotificacao(erroValidacao, 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const botao = e.target.querySelector('button[type="submit"]');
    definirCarregando(botao, true);

    try {
        const data = await api('/upload-motivacao-image', { metodo: 'POST', formData });
        const usarComoDestaque = document.getElementById('motivacao-definir-destaque')?.checked || !estado.motivacaoDestaque;
        if (usarComoDestaque) {
            await definirMotivacaoDestaque(data.path, false);
        }
        await carregarMotivacoes();
        document.getElementById('form-motivacao').reset();
        fileInput.dispatchEvent(new Event('change'));
        const checkboxDestaque = document.getElementById('motivacao-definir-destaque');
        if (checkboxDestaque) checkboxDestaque.checked = true;
        mostrarNotificacao('Imagem adicionada à galeria! 🎉', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao fazer upload', 'error');
    } finally {
        definirCarregando(botao, false);
    }
}

// Mostra o nome do arquivo escolhido na área de upload da galeria
export function mostrarNomeArquivoMotivacao(e) {
    const file = e.target.files[0];
    document.getElementById('motivacao-imagem-nome').textContent = file ? file.name : 'Toque para selecionar uma imagem';
    e.target.previousElementSibling.classList.toggle('has-file', Boolean(file));
}

export async function carregarMotivacoes() {
    try {
        const imagens = await api('/uploads/motivacao');
        estado.motivacoes = Array.isArray(imagens) ? imagens : [];

        const destaqueAtual = estado.motivacaoDestaque || estado.motivacoes[0]?.path || null;
        renderizarMotivacaoDestaque(destaqueAtual);
        renderizarGaleriaMotivacao(estado.motivacoes, destaqueAtual);
    } catch (error) {
        console.error('Erro:', error);
        renderizarMotivacaoDestaque(null);
        renderizarGaleriaMotivacao([], null);
    }
}

export function renderizarMotivacaoDestaque(imagemPath) {
    const container = document.getElementById('motivacao-destaque-container');
    if (!container) return;

    const stats = estado.statsEscala || '';
    container.closest('.escala-dashboard')?.classList.toggle('sem-imagem', !imagemPath);

    if (!imagemPath) {
        container.innerHTML = `<div class="escala-stats">${stats}</div>`;
        return;
    }

    container.innerHTML = `
        <div class="motivacao-destaque-card">
            <img src="${imagemPath}" alt="Imagem de motivação da semana">
            <div class="escala-stats overlay">${stats}</div>
        </div>
    `;
}

function renderizarGaleriaMotivacao(imagens, destaqueAtual) {
    const container = document.getElementById('motivacao-admin-galeria');
    if (!container) return;

    if (!Array.isArray(imagens) || imagens.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma imagem de motivação enviada ainda.</p>';
        return;
    }

    container.innerHTML = imagens.map(imagem => {
        const ativo = imagem.path === destaqueAtual;
        return `
            <figure class="motivacao-admin-item ${ativo ? 'active' : ''}">
                <img src="${imagem.path}" alt="Imagem motivacional" loading="lazy">
                <figcaption>
                    <span class="motivacao-admin-status">${ativo ? '★ Em destaque' : 'Galeria'}</span>
                    <div class="motivacao-admin-actions">
                        ${ativo ? '' : `<button type="button" class="btn btn-secondary-color" data-acao="destacar-motivacao" data-path="${escaparHtml(imagem.path)}">Destacar</button>`}
                        <button type="button" class="btn btn-ghost" title="Excluir" aria-label="Excluir imagem" data-acao="excluir-motivacao" data-filename="${escaparHtml(imagem.filename)}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </figcaption>
            </figure>
        `;
    }).join('');
}

export async function definirMotivacaoDestaque(imagemPath, mostrarFeedback = true) {
    try {
        const resultado = await api('/config/motivacao-destaque', { metodo: 'POST', corpo: { path: imagemPath } });
        atualizarConfig(resultado.config);
        estado.motivacaoDestaque = resultado.motivacaoDestaque || imagemPath;
        await carregarMotivacoes();
        carregarEscalaAtual();
        if (mostrarFeedback) {
            mostrarNotificacao('Imagem de motivação definida em destaque', 'success');
        }
    } catch (error) {
        console.error('Erro:', error);
        if (mostrarFeedback) {
            mostrarNotificacao('Erro ao definir destaque', 'error');
        }
    }
}

export async function excluirMotivacao(filename) {
    if (!(await mostrarConfirmacao('Excluir esta imagem da galeria?'))) return;

    try {
        await api(`/uploads/motivacao/${encodeURIComponent(filename)}`, { metodo: 'DELETE' });

        if (estado.motivacaoDestaque && estado.motivacaoDestaque.endsWith(`/${filename}`)) {
            estado.motivacaoDestaque = null;
        }

        await carregarMotivacoes();
        carregarEscalaAtual();
        mostrarNotificacao('Imagem excluída', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao excluir imagem', 'error');
    }
}
