import { api } from '../../core/api.js';
import { escaparHtml } from '../../core/ui.js';
import { hoje, somarDias, instante, diaDoInstante, horaDoInstante, formatarDia } from '../../core/datas.js';
import { estiloCategoria } from '../../core/categorias.js';
import { categoriaDoEvento, aniversariosNoPeriodo } from './dados.js';

const DIAS = 7;
const MAXIMO = 5;

function rotuloDia(dia) {
    if (dia === hoje()) return 'Hoje';
    if (dia === somarDias(hoje(), 1)) return 'Amanhã';
    return formatarDia(dia, { weekday: 'short', day: 'numeric' }).replace('.', '');
}

// Resumo no Início: o que vem pela frente nos próximos 7 dias
export default {
    titulo: 'Próximos 7 dias',
    rota: 'agenda/semana',
    permissao: 'agenda:ver',

    async conteudo() {
        const de = hoje();
        const ate = somarDias(de, DIAS);
        const eventos = await api(`/eventos?${new URLSearchParams({ de: instante(de), ate: instante(ate) })}`);
        // Eventos que já terminaram hoje não interessam mais
        const agora = Date.now();
        const proximos = [...eventos.filter(e => new Date(e.fim || e.inicio).getTime() >= agora || e.diaInteiro), ...aniversariosNoPeriodo(de, ate)]
            .map(e => ({ ...e, dia: diaDoInstante(e.inicio) < de ? de : diaDoInstante(e.inicio) }))
            .sort((a, b) => a.dia.localeCompare(b.dia) || (b.diaInteiro - a.diaInteiro) || new Date(a.inicio) - new Date(b.inicio));

        if (!proximos.length) return '<p class="inicio-vazio">Nada marcado para os próximos dias.</p>';

        const extras = proximos.length - MAXIMO;
        return `
            <ul class="inicio-eventos">
                ${proximos.slice(0, MAXIMO).map(e => `
                    <li style="${estiloCategoria(categoriaDoEvento(e))}">
                        <span class="inicio-evento-quando"><strong>${rotuloDia(e.dia)}</strong>${e.diaInteiro ? 'dia todo' : horaDoInstante(e.inicio)}</span>
                        <span class="inicio-evento-titulo"><i class="${categoriaDoEvento(e).icone}"></i> ${escaparHtml(e.titulo)}</span>
                    </li>
                `).join('')}
            </ul>
            ${extras > 0 ? `<p class="inicio-mais">+ ${extras} ${extras === 1 ? 'evento' : 'eventos'} na semana</p>` : ''}
        `;
    }
};
