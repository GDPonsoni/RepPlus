import { banco } from '../../core/db/banco.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';
import { RECORRENCIAS, expandirOcorrencias } from './recorrencia.js';

// Eventos da agenda (tabela `eventos`). Datas são timestamptz (ISO 8601 com fuso).
const eventoFromDb = (row) => ({
  id: row.id,
  titulo: row.titulo,
  descricao: row.descricao,
  local: row.local,
  categoria: row.categoria,
  inicio: row.inicio,
  fim: row.fim,
  diaInteiro: row.dia_inteiro,
  recorrencia: row.recorrencia ?? null,
  recorrenciaAte: row.recorrencia_ate ?? null,
  excecoes: row.excecoes ?? [],
  criadoEm: row.criado_em
});

const eventoToDb = (evento) => {
  const colunas = {};
  if (evento.titulo !== undefined) colunas.titulo = evento.titulo;
  if (evento.descricao !== undefined) colunas.descricao = evento.descricao;
  if (evento.local !== undefined) colunas.local = evento.local;
  if (evento.categoria !== undefined) colunas.categoria = evento.categoria;
  if (evento.inicio !== undefined) colunas.inicio = evento.inicio;
  if (evento.fim !== undefined) colunas.fim = evento.fim;
  if (evento.diaInteiro !== undefined) colunas.dia_inteiro = evento.diaInteiro;
  if (evento.recorrencia !== undefined) colunas.recorrencia = evento.recorrencia;
  if (evento.recorrenciaAte !== undefined) colunas.recorrencia_ate = evento.recorrenciaAte;
  if (evento.excecoes !== undefined) colunas.excecoes = evento.excecoes;
  return colunas;
};

// Eventos de vários dias começam antes do período pedido: busca com essa folga e filtra pela sobreposição
export const DURACAO_MAXIMA_DIAS = 31;

export const EventosStore = {
  // Eventos que acontecem (total ou parcialmente) entre `de` (inclusive) e `ate` (exclusive).
  // Eventos recorrentes viram uma entrada por ocorrência (com `ocorrencia` = dia da repetição).
  async listPeriodo(de, ate) {
    const buscarDesde = new Date(new Date(de).getTime() - DURACAO_MAXIMA_DIAS * 86400000).toISOString();
    const inicioPeriodo = new Date(de).getTime();

    const [simples, series] = await Promise.all([
      selectAll(() => banco.from('eventos').select('*')
        .is('recorrencia', null)
        .gte('inicio', buscarDesde)
        .lt('inicio', ate)),
      // Séries que já começaram antes do fim do período (as encerradas antes dele são filtradas abaixo)
      selectAll(() => banco.from('eventos').select('*')
        .in('recorrencia', RECORRENCIAS)
        .lt('inicio', ate))
    ]);

    const eventosSimples = simples
      .map(eventoFromDb)
      .filter(evento => new Date(evento.fim || evento.inicio).getTime() >= inicioPeriodo);
    const ocorrencias = series
      .map(eventoFromDb)
      .flatMap(serie => expandirOcorrencias(serie, de, ate));

    return [...eventosSimples, ...ocorrencias].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  },
  async findById(id) {
    const row = await findRowById('eventos', id);
    return row ? eventoFromDb(row) : null;
  },
  async create(evento) {
    const row = check(await banco.from('eventos').insert(eventoToDb(evento)).select().single());
    return eventoFromDb(row);
  },
  async update(id, changes) {
    const row = check(await banco.from('eventos').update(eventoToDb(changes)).eq('id', id).select().maybeSingle());
    return row ? eventoFromDb(row) : null;
  },
  async remove(id) {
    const rows = check(await banco.from('eventos').delete().eq('id', id).select());
    return rows.length > 0;
  }
};
