import { api } from '../../core/api.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarConfirmacao, mostrarPrompt } from '../../core/modal.js';
import { escaparHtml, iniciais, mostrarNotificacao } from '../../core/ui.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { estado } from './estado.js';
import { carregarEscalaAtual } from './atual.js';

// Aba "Infrações": quadro por integrante, registro e remoção

// Preenche o select do formulário com os moradores (chamado sempre que a lista de moradores muda)
export function atualizarSelectInfracao(integrantes = obterIntegrantes()) {
    const select = document.getElementById('infracao-integrante');
    select.innerHTML = '<option value="">Selecione o integrante...</option>';
    integrantes.forEach(integrante => {
        const option = document.createElement('option');
        option.value = integrante.id;
        option.textContent = integrante.nome;
        select.appendChild(option);
    });
}

export async function registrarInfracao(e) {
    e.preventDefault();

    const integranteId = document.getElementById('infracao-integrante').value;
    const descricao = document.getElementById('infracao-descricao').value.trim();
    const integrante = obterIntegrantes().find(i => i.id == integranteId);

    if (!integranteId || !descricao) {
        mostrarNotificacao('Preencha todos os campos', 'warning');
        return;
    }

    try {
        await api('/infracoes', {
            metodo: 'POST',
            corpo: {
                integranteId,
                integranteNome: integrante.nome,
                descricao,
                dataSemana: new Date().toISOString()
            }
        });
        document.getElementById('form-infracao').reset();
        carregarInfracoes();
        mostrarNotificacao('Infração registrada! ❌', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao registrar', 'error');
    }
}

export async function marcarInfracaoRapido(integranteId) {
    const integranteNome = obterIntegrantes().find(i => String(i.id) === String(integranteId))?.nome || '';
    const descricao = await mostrarPrompt(`Infração de ${integranteNome}:`, '', { titulo: 'Registrar infração', placeholder: 'Descreva brevemente...' });
    if (descricao === null) return;

    if (!descricao.trim()) {
        mostrarNotificacao('Digite uma descrição', 'warning');
        return;
    }

    try {
        await api('/infracoes', {
            metodo: 'POST',
            corpo: {
                integranteId,
                integranteNome,
                descricao: descricao.trim(),
                dataSemana: new Date().toISOString()
            }
        });

        mostrarNotificacao('Infração registrada! ❌', 'success');
        // Recarrega a escala também, para o contador de X do card atualizar na hora
        await carregarInfracoes();
        carregarEscalaAtual();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao registrar', 'error');
    }
}

export async function carregarInfracoes() {
    try {
        const resumo = await api('/infracoes-resumo/todas');
        estado.infracoes = resumo;

        const container = document.getElementById('infracoes-resumo-container');

        if (Object.keys(resumo).length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum integrante ativo</p>';
            return;
        }

        // Ordenar por total de infrações (maior primeiro), depois por nome
        const ids = Object.keys(resumo).sort((a, b) => {
            const diff = resumo[b].total - resumo[a].total;
            if (diff !== 0) return diff;
            return (resumo[a].integranteNome || '').localeCompare(resumo[b].integranteNome || '', 'pt-BR');
        });

        // Mantém abertos os itens que o usuário tinha expandido antes de recarregar
        const abertos = new Set([...container.querySelectorAll('.resumo-item[open]')].map(el => el.dataset.id));
        container.innerHTML = '';

        ids.forEach(id => {
            const dados = resumo[id];
            const div = document.createElement('details');
            div.className = 'resumo-item';
            div.dataset.id = id;
            div.open = abertos.has(id);

            const itens = dados.infracoes.map(inf => `
                <div class="infracao-item">
                    <div>
                        <div class="infracao-descricao">${escaparHtml(inf.descricao)}</div>
                        <div class="infracao-data">${new Date(inf.dataRegistro).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button class="icon-btn danger" title="Remover infração" aria-label="Remover infração" data-acao="remover-infracao" data-id="${escaparHtml(inf.id)}" data-permissao="infracoes:gerenciar"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');

            div.innerHTML = `
                <summary>
                    <span class="avatar">${escaparHtml(iniciais(dados.integranteNome))}</span>
                    <span class="resumo-nome">${escaparHtml(dados.integranteNome)}</span>
                    <span class="resumo-contador ${dados.total > 0 ? 'tem-infracao' : ''}">${dados.total} ${dados.total === 1 ? 'infração' : 'infrações'}</span>
                    <i class="fa-solid fa-chevron-down resumo-chevron"></i>
                </summary>
                <div class="infracao-lista">
                    ${itens || '<p class="infracao-vazia">Nenhuma infração registrada. 🎉</p>'}
                </div>
            `;
            container.appendChild(div);
        });

        aplicarPermissoes(container);
    } catch (error) {
        console.error('Erro:', error);
    }
}

export async function deletarInfracao(id) {
    if (!(await mostrarConfirmacao('Remover esta infração?'))) return;

    try {
        await api(`/infracoes/${id}`, { metodo: 'DELETE' });
        carregarInfracoes();
        mostrarNotificacao('Infração removida', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao remover infração', 'error');
    }
}
