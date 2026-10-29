import { escaparHtml } from '../../core/ui.js';
import { formatarDia } from '../../core/datas.js';
import { carregarAtas, pendencias, situacaoPrazo, nomeDoMorador, atasOrdenadas } from './dados.js';

const MAXIMO = 3;

// Resumo no Início: encaminhamentos pendentes (atrasados primeiro) e a última reunião
export default {
    titulo: 'Pendências das reuniões',
    rota: 'atas/pendencias',
    permissao: 'atas:ver',

    async conteudo() {
        await carregarAtas();
        const abertas = pendencias();
        const ultima = atasOrdenadas()[0];

        const linhas = abertas.slice(0, MAXIMO).map(tarefa => {
            const prazo = situacaoPrazo(tarefa.prazo);
            const responsavel = nomeDoMorador(tarefa.responsavelId);
            return `
                <li>
                    <span class="inicio-tarefa-texto">${escaparHtml(tarefa.texto)}</span>
                    <span class="inicio-tarefa-meta">${responsavel ? escaparHtml(responsavel) : 'sem responsável'}${prazo ? ` · <span class="tarefa-prazo ${prazo.classe}">${prazo.texto}</span>` : ''}</span>
                </li>
            `;
        }).join('');

        return `
            ${abertas.length
                ? `<p class="inicio-sub"><strong>${abertas.length}</strong> ${abertas.length === 1 ? 'encaminhamento pendente' : 'encaminhamentos pendentes'}</p><ul class="inicio-tarefas">${linhas}</ul>`
                : '<p class="inicio-vazio">Nenhum encaminhamento pendente ✔</p>'}
            ${ultima ? `<p class="inicio-rodape-cartao"><i class="fa-solid fa-file-lines"></i> Última reunião: <button type="button" class="inicio-link" data-acao="abrir-ata" data-id="${escaparHtml(ultima.id)}">${escaparHtml(ultima.titulo)}</button> · ${formatarDia(ultima.data, { day: 'numeric', month: 'short' }).replace('.', '')}</p>` : ''}
        `;
    }
};
