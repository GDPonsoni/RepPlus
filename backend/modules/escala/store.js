import { banco } from '../../core/db/banco.js';
import { check, selectAll, findRowById, normalizeBoolean, normalizeNumber } from '../../core/db/helpers.js';

// ===== COMODOS =====
const DEFAULT_COMODO_CONFIG = {
  imagem: null,
  apenassuiteMembers: false,
  pessoasNecessarias: 1,
  obrigatorio: true,
  ordem: 0
};

const normalizeComodo = (comodo = {}, index = 0) => ({
  ...DEFAULT_COMODO_CONFIG,
  ...comodo,
  pessoasNecessarias: Math.max(1, Math.min(10, normalizeNumber(comodo.pessoasNecessarias, 1))),
  obrigatorio: normalizeBoolean(comodo.obrigatorio, true),
  ordem: Math.max(0, Math.trunc(normalizeNumber(comodo.ordem, index)))
});

const comodoFromDb = (row) => ({
  id: row.id,
  nome: row.nome,
  imagem: row.imagem,
  apenassuiteMembers: row.apenas_suite_members,
  pessoasNecessarias: row.pessoas_necessarias,
  obrigatorio: row.obrigatorio,
  ordem: row.ordem
});

const comodoChangesToDb = (changes) => {
  const dbChanges = {};
  if (changes.nome !== undefined) dbChanges.nome = changes.nome;
  if (changes.imagem !== undefined) dbChanges.imagem = changes.imagem;
  if (changes.apenassuiteMembers !== undefined) dbChanges.apenas_suite_members = normalizeBoolean(changes.apenassuiteMembers, false);
  if (changes.pessoasNecessarias !== undefined) dbChanges.pessoas_necessarias = Math.max(1, Math.min(10, normalizeNumber(changes.pessoasNecessarias, 1)));
  if (changes.obrigatorio !== undefined) dbChanges.obrigatorio = normalizeBoolean(changes.obrigatorio, true);
  if (changes.ordem !== undefined) dbChanges.ordem = Math.max(0, Math.trunc(normalizeNumber(changes.ordem, 0)));
  return dbChanges;
};

export const ComodosStore = {
  async list() {
    const rows = await selectAll(() => banco.from('comodos').select('*'));
    return rows.map((row, index) => normalizeComodo(comodoFromDb(row), index));
  },
  async findById(id) {
    const row = await findRowById('comodos', id);
    return row ? normalizeComodo(comodoFromDb(row)) : null;
  },
  async create(data) {
    const novo = normalizeComodo(data);
    const row = check(await banco.from('comodos').insert({
      nome: novo.nome,
      imagem: novo.imagem,
      apenas_suite_members: novo.apenassuiteMembers,
      pessoas_necessarias: novo.pessoasNecessarias,
      permitir_multiplas_atribuicoes: false, // coluna legada: o rodízio nunca dá dois cômodos à mesma pessoa
      obrigatorio: novo.obrigatorio,
      ordem: novo.ordem
    }).select().single());
    return normalizeComodo(comodoFromDb(row));
  },
  async update(id, changes) {
    const row = check(await banco.from('comodos').update(comodoChangesToDb(changes)).eq('id', id).select().maybeSingle());
    return row ? normalizeComodo(comodoFromDb(row)) : null;
  },
  async remove(id) {
    const rows = check(await banco.from('comodos').delete().eq('id', id).select());
    return rows.length > 0;
  }
};

// ===== INFRAÇÕES =====
const infracaoFromDb = (row) => ({
  id: row.id,
  integranteId: row.integrante_id,
  integranteNome: row.integrante_nome,
  descricao: row.descricao,
  dataSemana: row.data_semana,
  dataRegistro: row.data_registro
});

export const InfracoesStore = {
  async list() {
    const rows = await selectAll(() => banco.from('infracoes').select('*'));
    return rows.map(infracaoFromDb);
  },
  async findById(id) {
    const row = await findRowById('infracoes', id);
    return row ? infracaoFromDb(row) : null;
  },
  async listByIntegranteId(integranteId) {
    const rows = await selectAll(() => banco.from('infracoes').select('*').eq('integrante_id', String(integranteId)));
    return rows.map(infracaoFromDb);
  },
  async create({ integranteId, integranteNome, descricao, dataSemana }) {
    const row = check(await banco.from('infracoes').insert({
      integrante_id: String(integranteId),
      integrante_nome: integranteNome,
      descricao: descricao.trim(),
      data_semana: dataSemana || new Date().toISOString()
    }).select().single());
    return infracaoFromDb(row);
  },
  async update(id, changes) {
    const dbChanges = {};
    if (changes.descricao !== undefined) dbChanges.descricao = changes.descricao;
    if (changes.dataSemana !== undefined) dbChanges.data_semana = changes.dataSemana;

    const row = check(await banco.from('infracoes').update(dbChanges).eq('id', id).select().maybeSingle());
    return row ? infracaoFromDb(row) : null;
  },
  async remove(id) {
    const rows = check(await banco.from('infracoes').delete().eq('id', id).select());
    return rows.length > 0;
  }
};

// ===== ESCALAS =====
const escalaFromDb = (row) => ({
  id: row.id,
  ano: row.ano,
  semana: row.semana,
  integranteId: row.integrante_id,
  integranteNome: row.integrante_nome,
  folga: row.folga,
  comodos: row.comodos,
  cumpridos: Array.isArray(row.cumpridos) ? row.cumpridos : [],
  dataInicio: row.data_inicio,
  dataFim: row.data_fim,
  alerta: row.alerta
});

const escalaToDb = (escala) => ({
  id: escala.id,
  ano: escala.ano,
  semana: escala.semana,
  integrante_id: escala.integranteId,
  integrante_nome: escala.integranteNome,
  folga: escala.folga,
  comodos: escala.comodos,
  cumpridos: escala.cumpridos || [],
  data_inicio: escala.dataInicio,
  data_fim: escala.dataFim,
  alerta: escala.alerta
});

export const EscalasStore = {
  async list() {
    const rows = await selectAll(() => banco.from('escalas').select('*'));
    return rows.map(escalaFromDb);
  },
  // Escalas a partir de uma semana (inclusive), para quem só precisa do histórico recente
  async listDesde(ano, semana) {
    const rows = await selectAll(() => banco.from('escalas').select('*')
      .or(`ano.gt.${ano},and(ano.eq.${ano},semana.gte.${semana})`));
    return rows.map(escalaFromDb);
  },
  async findById(id) {
    const row = await findRowById('escalas', id);
    return row ? escalaFromDb(row) : null;
  },
  async listBySemana(ano, semana) {
    const rows = check(await banco.from('escalas').select('*').eq('ano', ano).eq('semana', semana));
    return rows.map(escalaFromDb);
  },
  async replaceSemana(ano, semana, novasLinhas) {
    // Delegado a uma função Postgres (replace_semana_escala) que faz delete+insert
    // dentro de uma única transação serializada por advisory lock, evitando duplicação
    // de linhas quando duas gerações de escala da mesma semana rodam ao mesmo tempo.
    const rows = check(await banco.rpc('replace_semana_escala', {
      p_ano: ano,
      p_semana: semana,
      p_linhas: novasLinhas.map(escalaToDb)
    }));
    return rows.map(escalaFromDb);
  },
  async removeSemana(ano, semana) {
    const rows = check(await banco.from('escalas').delete().eq('ano', ano).eq('semana', semana).select());
    return rows.length;
  },
  async update(id, changes) {
    const dbChanges = {};
    if (changes.comodos !== undefined) dbChanges.comodos = changes.comodos;
    if (changes.folga !== undefined) dbChanges.folga = changes.folga;
    if (changes.cumpridos !== undefined) dbChanges.cumpridos = changes.cumpridos;

    const row = check(await banco.from('escalas').update(dbChanges).eq('id', id).select().maybeSingle());
    return row ? escalaFromDb(row) : null;
  },
  // O histórico guarda o nome do cômodo: ao renomear, as escalas antigas acompanham para o
  // rodízio continuar reconhecendo quem já fez aquele cômodo
  async renomearComodo(nomeAntigo, nomeNovo) {
    const afetadas = (await this.list())
      .filter(escala => Array.isArray(escala.comodos) && escala.comodos.includes(nomeAntigo))
      .map(escala => ({
        ...escala,
        comodos: escala.comodos.map(nome => (nome === nomeAntigo ? nomeNovo : nome)),
        cumpridos: (escala.cumpridos || []).map(nome => (nome === nomeAntigo ? nomeNovo : nome))
      }));
    return afetadas.length > 0 ? this.saveMany(afetadas) : [];
  },
  // Grava várias linhas completas num único upsert: ou todas mudam, ou nenhuma
  async saveMany(escalas) {
    const rows = check(await banco.from('escalas').upsert(escalas.map(escalaToDb)).select());
    return rows.map(escalaFromDb);
  }
};
