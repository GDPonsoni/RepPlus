import { api } from '../../core/api.js';
import { situacaoPrazo, nomeDoMorador } from './dados.js';

// Avisos do sino: encaminhamentos das reuniões atrasados ou vencendo hoje/amanhã
export default async function avisos() {
    const atas = await api('/atas');
    return atas.flatMap(ata => ata.tarefas
        .filter(tarefa => !tarefa.feito && tarefa.prazo)
        .map(tarefa => ({ tarefa, situacao: situacaoPrazo(tarefa.prazo) }))
        .filter(({ situacao }) => ['atrasado', 'hoje'].includes(situacao.classe) || situacao.texto === 'vence amanhã')
        .map(({ tarefa, situacao }) => {
            const responsavel = nomeDoMorador(tarefa.responsavelId);
            return {
                id: `atas:${tarefa.id}:${situacao.classe || 'amanha'}`,
                tipo: situacao.classe === 'atrasado' ? 'alerta' : 'info',
                icone: 'fa-solid fa-list-check',
                texto: `${tarefa.texto}${responsavel ? ` (${responsavel})` : ''}: ${situacao.texto}`,
                rota: 'atas/pendencias'
            };
        }));
}
