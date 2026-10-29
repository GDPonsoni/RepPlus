import { api } from '../../core/api.js';
import { escaparHtml } from '../../core/ui.js';

// Resumo no Início: quem faz o quê nesta semana
export default {
    titulo: 'Escala da semana',
    rota: 'escala/atual',
    permissao: 'escala:ver',

    async conteudo() {
        const escalas = await api('/escala/atual');
        if (!escalas.length) return '<p class="inicio-vazio">Nenhuma escala gerada nesta semana.</p>';

        const data = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
        const linhas = [...escalas]
            .sort((a, b) => a.integranteNome.localeCompare(b.integranteNome, 'pt-BR'))
            .map(escala => {
                const folga = (escala.comodos || []).includes('FOLGA');
                const tarefa = folga ? '<i class="fa-solid fa-mug-hot"></i> Folga' : escaparHtml((escala.comodos || []).join(' + ') || '—');
                return `<li class="${folga ? 'folga' : ''}"><span>${escaparHtml(escala.integranteNome)}</span><span>${tarefa}</span></li>`;
            }).join('');

        return `
            <p class="inicio-sub">Semana ${escalas[0].semana} · ${data(escalas[0].dataInicio)} a ${data(escalas[0].dataFim)}</p>
            <ul class="inicio-escala">${linhas}</ul>
        `;
    }
};
