import { api } from '../../core/api.js';
import { hoje, somarDias, instante, horaDoInstante } from '../../core/datas.js';
import { CATEGORIAS } from './dados.js';

// Avisos do sino: eventos de hoje que ainda não terminaram (aniversários vêm dos moradores)
export default async function avisos() {
    const dia = hoje();
    const eventos = await api(`/eventos?${new URLSearchParams({ de: instante(dia), ate: instante(somarDias(dia, 1)) })}`);
    const agora = Date.now();
    return eventos
        .filter(evento => evento.diaInteiro || new Date(evento.fim || evento.inicio).getTime() >= agora)
        .map(evento => ({
            id: `agenda:${evento.id}:${dia}`,
            icone: (CATEGORIAS[evento.categoria] || CATEGORIAS.geral).icone,
            texto: `Hoje${evento.diaInteiro ? '' : ` às ${horaDoInstante(evento.inicio)}`}: ${evento.titulo}`,
            rota: 'agenda/semana'
        }));
}
