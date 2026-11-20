import { api } from '../../core/api.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { carregarEscalaAtual } from './atual.js';

// Aba "Histórico": semanas anteriores

export async function carregarHistorico() {
    try {
        const escalaPorSemana = await api('/escala/historico');

        const container = document.getElementById('historico-container');
        container.innerHTML = '';

        if (Object.keys(escalaPorSemana).length === 0) {
            container.innerHTML = '<div class="card"><p class="empty-state">Nenhum histórico disponível</p></div>';
            return;
        }

        // Ordenar semanas (mais recentes primeiro)
        const semanas = Object.keys(escalaPorSemana).sort().reverse();

        semanas.forEach(semana => {
            const escalas = escalaPorSemana[semana];
            const primeira = escalas[0];

            const formatarData = (data) => new Date(data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
            const periodo = primeira.dataFim
                ? `${formatarData(primeira.dataInicio)} a ${formatarData(primeira.dataFim)}`
                : formatarData(primeira.dataInicio);

            const div = document.createElement('div');
            div.className = 'historico-semana';
            div.innerHTML = `
                <div class="historico-semana-header">
                    <div>
                        <span class="historico-semana-titulo">Semana ${primeira.semana}/${primeira.ano}</span>
                        <span class="historico-semana-datas">${periodo}</span>
                    </div>
                    <button class="icon-btn danger" title="Excluir semana" aria-label="Excluir semana ${primeira.semana}/${primeira.ano}" data-acao="excluir-semana" data-ano="${primeira.ano}" data-semana="${primeira.semana}" data-permissao="escala:gerenciar"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            const itensDiv = document.createElement('div');
            itensDiv.className = 'historico-semana-itens';

            escalas.forEach(escala => {
                const comodos = Array.isArray(escala.comodos) ? escala.comodos : [];
                const isFolga = comodos.includes('FOLGA');
                const item = document.createElement('div');
                item.className = `historico-item ${isFolga ? 'folga' : ''}`;
                item.innerHTML = `
                    <div class="historico-item-comodo">${isFolga ? 'Folga' : (comodos.length > 0 ? escaparHtml(comodos.join(' + ')) : 'Sem cômodos')}</div>
                    <div class="historico-item-integrante">${escaparHtml(escala.integranteNome)}</div>
                `;
                itensDiv.appendChild(item);
            });

            div.appendChild(itensDiv);
            container.appendChild(div);
        });

        aplicarPermissoes(container);
    } catch (error) {
        console.error('Erro:', error);
    }
}

export async function deletarHistoricoSemana(ano, semana) {
    if (!(await mostrarConfirmacao(`Excluir toda a semana ${semana}/${ano} do histórico?`))) return;

    try {
        await api(`/escala/historico/${ano}/${semana}`, { metodo: 'DELETE' });
        carregarHistorico();
        carregarEscalaAtual();
        mostrarNotificacao('Histórico excluído', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao excluir histórico', 'error');
    }
}
