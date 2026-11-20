import { api } from '../../core/api.js';
import { moduloAtivo, temPermissao } from '../../core/sessao.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { hoje, somarDias, instante, diaDoInstante, diasEntre } from '../../core/datas.js';

// Reuniões da agenda dos últimos dias que ainda não têm ata viram sugestão
const DIAS_SUGESTAO = 45;

export const estado = {
    atas: [],
    carregado: false,
    reunioesSemAta: [],
    filtroResponsavel: ''   // '' = todos, 'ninguem' = sem responsável, ou id do morador
};

export const buscarAta = (id) => estado.atas.find(ata => String(ata.id) === String(id));
export const atasOrdenadas = () => [...estado.atas].sort((a, b) => b.data.localeCompare(a.data) || new Date(b.criadoEm) - new Date(a.criadoEm));

export const nomeDoMorador = (id) => obterIntegrantes().find(i => String(i.id) === String(id))?.nome || null;

export const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Encaminhamentos em aberto de todas as atas, com prazo vencido primeiro e sem prazo no fim
export function pendencias() {
    return estado.atas
        .flatMap(ata => ata.tarefas.filter(tarefa => !tarefa.feito).map(tarefa => ({ ...tarefa, ata })))
        .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || b.ata.data.localeCompare(a.ata.data));
}

// "atrasado 2 dias", "vence hoje", "vence em 3 dias"
export function situacaoPrazo(prazo) {
    if (!prazo) return null;
    const dias = diasEntre(hoje(), prazo);
    if (dias < 0) return { classe: 'atrasado', texto: `atrasado ${-dias} ${dias === -1 ? 'dia' : 'dias'}` };
    if (dias === 0) return { classe: 'hoje', texto: 'vence hoje' };
    if (dias === 1) return { classe: 'perto', texto: 'vence amanhã' };
    return { classe: dias <= 3 ? 'perto' : '', texto: `vence em ${dias} dias` };
}

function substituir(ata) {
    const i = estado.atas.findIndex(atual => String(atual.id) === String(ata.id));
    if (i >= 0) estado.atas[i] = ata;
    else estado.atas.push(ata);
    return ata;
}

// ===== API =====
export async function carregarAtas() {
    estado.atas = await api('/atas');
    estado.carregado = true;
    await carregarReunioesSemAta();
    return estado.atas;
}

// Reuniões (categoria "reuniao") que já aconteceram e não têm ata ligada ao evento naquele dia
async function carregarReunioesSemAta() {
    estado.reunioesSemAta = [];
    if (!moduloAtivo('agenda') || !temPermissao('agenda:ver')) return;
    try {
        const parametros = new URLSearchParams({ de: instante(somarDias(hoje(), -DIAS_SUGESTAO)), ate: new Date().toISOString() });
        const eventos = await api(`/eventos?${parametros}`);
        const comAta = new Set(estado.atas.filter(ata => ata.eventoId).map(ata => `${ata.eventoId}|${ata.data}`));
        estado.reunioesSemAta = eventos
            .filter(evento => evento.categoria === 'reuniao')
            .map(evento => ({ ...evento, dia: diaDoInstante(evento.inicio) }))
            .filter(evento => !comAta.has(`${evento.id}|${evento.dia}`))
            .sort((a, b) => b.dia.localeCompare(a.dia));
    } catch (error) {
        // Sem agenda, só não mostra sugestões
        console.error('Erro ao buscar reuniões da agenda:', error);
    }
}

export async function salvarAta(id, dados) {
    const ata = substituir(id
        ? await api(`/atas/${id}`, { metodo: 'PUT', corpo: dados })
        : await api('/atas', { metodo: 'POST', corpo: dados }));
    await carregarReunioesSemAta();
    return ata;
}

export async function marcarTarefa(ataId, tarefaId, feito) {
    return substituir(await api(`/atas/${ataId}/tarefas/${tarefaId}`, { metodo: 'PUT', corpo: { feito } }));
}

export async function excluirAta(id) {
    await api(`/atas/${id}`, { metodo: 'DELETE' });
    estado.atas = estado.atas.filter(ata => String(ata.id) !== String(id));
    await carregarReunioesSemAta();
}
