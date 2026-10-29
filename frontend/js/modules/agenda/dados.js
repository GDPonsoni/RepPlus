import { api } from '../../core/api.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { hoje, inicioDaSemana, instante, diaDoInstante, aniversarioNoAno } from '../../core/datas.js';

// Categorias de evento (as cores ficam no CSS, classes .cat-<id>)
export const CATEGORIAS = {
    geral: { nome: 'Geral', icone: 'fa-solid fa-thumbtack' },
    festa: { nome: 'Festa / rolê', icone: 'fa-solid fa-champagne-glasses' },
    reuniao: { nome: 'Reunião', icone: 'fa-solid fa-people-group' },
    visita: { nome: 'Visita', icone: 'fa-solid fa-door-open' },
    manutencao: { nome: 'Manutenção', icone: 'fa-solid fa-screwdriver-wrench' },
    aniversario: { nome: 'Aniversário', icone: 'fa-solid fa-cake-candles' }
};

// Repetições (o backend expande cada série em ocorrências, com o campo `ocorrencia` = dia)
export const RECORRENCIAS = {
    semanal: 'Toda semana',
    quinzenal: 'A cada 2 semanas',
    mensal: 'Todo mês',
    anual: 'Todo ano'
};

// Categorias que o usuário pode escolher (aniversário vem do cadastro de moradores)
export const CATEGORIAS_EDITAVEIS = ['geral', 'festa', 'reuniao', 'visita', 'manutencao'];

export const estado = {
    eventos: [],                         // eventos do período carregado (+ aniversários)
    mes: `${hoje().slice(0, 7)}-01`,     // primeiro dia do mês exibido na visão mensal
    diaSelecionado: hoje(),
    semana: inicioDaSemana(hoje()),      // segunda-feira da semana exibida na visão semanal
    visao: 'mes'
};

// Aniversários dos moradores ativos dentro de [de, ate) como eventos de dia inteiro, só leitura
function aniversariosNoPeriodo(de, ate) {
    const anos = [Number(de.slice(0, 4)), Number(ate.slice(0, 4))];
    const eventos = [];
    obterIntegrantes()
        .filter(integrante => integrante.ativo !== false && integrante.dataNascimento)
        .forEach(integrante => {
            for (let ano = anos[0]; ano <= anos[1]; ano++) {
                const dia = aniversarioNoAno(integrante.dataNascimento, ano);
                if (dia < de || dia >= ate) continue;
                eventos.push({
                    id: `aniversario-${integrante.id}-${ano}`,
                    titulo: `Aniversário de ${integrante.nome}`,
                    descricao: `Faz ${ano - Number(integrante.dataNascimento.slice(0, 4))} anos 🎉`,
                    categoria: 'aniversario',
                    inicio: instante(dia),
                    fim: null,
                    diaInteiro: true,
                    somenteLeitura: true
                });
            }
        });
    return eventos;
}

// Busca os eventos de [de, ate) (dias AAAA-MM-DD) e junta os aniversários
export async function carregarPeriodo(de, ate) {
    const parametros = new URLSearchParams({ de: instante(de), ate: instante(ate) });
    const eventos = await api(`/eventos?${parametros}`);
    estado.eventos = [...eventos, ...aniversariosNoPeriodo(de, ate)];
    return estado.eventos;
}

export const diaInicial = (evento) => diaDoInstante(evento.inicio);
export const diaFinal = (evento) => (evento.fim ? diaDoInstante(evento.fim) : diaInicial(evento));

// Eventos que acontecem num dia: dia inteiro primeiro, depois por horário
export function eventosDoDia(dia) {
    return estado.eventos
        .filter(evento => diaInicial(evento) <= dia && dia <= diaFinal(evento))
        .sort((a, b) => (b.diaInteiro - a.diaInteiro) || (new Date(a.inicio) - new Date(b.inicio)));
}

// Eventos recorrentes têm várias ocorrências com o mesmo id: `ocorrencia` diz qual
export function buscarEvento(id, ocorrencia) {
    return estado.eventos.find(evento => String(evento.id) === String(id) && (!ocorrencia || evento.ocorrencia === ocorrencia));
}
