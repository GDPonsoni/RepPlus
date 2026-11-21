import { api } from '../../core/api.js';
import { escaparHtml } from '../../core/ui.js';
import { temPermissao } from '../../core/sessao.js';
import { xsNaSemana } from './atual.js';

// Resumo no Início: quem faz o quê nesta semana
export default {
    titulo: 'Escala da semana',
    rota: 'escala/atual',
    permissao: 'escala:ver',

    async conteudo() {
        const [escalas, infracoes] = await Promise.all([
            api('/escala/atual'),
            // Sem permissão (ou se falhar), o resumo só não mostra quem levou X
            temPermissao('infracoes:ver') ? api('/infracoes-resumo/todas').catch(() => ({})) : {}
        ]);
        if (!escalas.length) return '<p class="inicio-vazio">Nenhuma escala gerada nesta semana.</p>';

        const data = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
        const linhas = [...escalas]
            .sort((a, b) => a.integranteNome.localeCompare(b.integranteNome, 'pt-BR'))
            .map(escala => {
                const folga = (escala.comodos || []).includes('FOLGA');
                const tarefa = folga ? '<i class="fa-solid fa-mug-hot"></i> Folga' : escaparHtml((escala.comodos || []).join(' + ') || '—');
                const tarefas = (escala.comodos || []).filter(item => item !== 'FOLGA');
                const feitas = tarefas.filter(nome => (escala.cumpridos || []).includes(nome)).length;
                const completo = !folga && tarefas.length > 0 && feitas === tarefas.length;
                const xs = folga ? [] : xsNaSemana(escala, infracoes);
                const estadoLimpeza = folga || !tarefas.length ? ''
                    : completo ? '<i class="fa-solid fa-circle-check inicio-limpo" title="Concluído"></i>'
                    : xs.length ? `<i class="fa-solid fa-circle-xmark inicio-com-x" title="Levou X: ${escaparHtml(xs[xs.length - 1].descricao)}"></i>`
                    : `<i class="fa-regular fa-clock inicio-pendente" title="Pendente: ${feitas}/${tarefas.length}"></i>`;
                return `<li class="${folga ? 'folga' : ''} ${completo ? 'limpo' : ''}"><span>${escaparHtml(escala.integranteNome)}</span><span><span class="inicio-tarefa">${tarefa}</span><span class="inicio-estado">${estadoLimpeza}</span></span></li>`;
            }).join('');
        const tarefasTotal = escalas.reduce((n, e) => n + (e.comodos || []).filter(c => c !== 'FOLGA').length, 0);
        const feitasTotal = escalas.reduce((n, e) => n + (e.comodos || []).filter(c => c !== 'FOLGA' && (e.cumpridos || []).includes(c)).length, 0);

        return `
            <p class="inicio-sub">Semana ${escalas[0].semana} · ${data(escalas[0].dataInicio)} a ${data(escalas[0].dataFim)} · ${feitasTotal}/${tarefasTotal} limpos</p>
            <ul class="inicio-escala">${linhas}</ul>
        `;
    }
};
