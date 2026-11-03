import { banco } from '../../core/db/banco.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';

// Atas de reunião (tabela `atas`). Participantes, decisões e encaminhamentos (tarefas)
// ficam em jsonb dentro da própria ata: são poucos por reunião e sempre lidos juntos.
const ataFromDb = (row) => ({
  id: row.id,
  titulo: row.titulo,
  data: row.data,
  local: row.local ?? null,
  participantes: row.participantes || [],
  pauta: row.pauta ?? null,
  conteudo: row.conteudo ?? null,
  decisoes: row.decisoes || [],
  tarefas: row.tarefas || [],
  eventoId: row.evento_id ?? null,
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em ?? row.criado_em
});

const COLUNAS = {
  titulo: 'titulo', data: 'data', local: 'local', participantes: 'participantes', pauta: 'pauta',
  conteudo: 'conteudo', decisoes: 'decisoes', tarefas: 'tarefas', eventoId: 'evento_id'
};

const ataToDb = (ata) => {
  const colunas = {};
  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (ata[campo] !== undefined) colunas[coluna] = ata[campo];
  }
  return colunas;
};

export const AtasStore = {
  async list() {
    const rows = await selectAll(() => banco.from('atas').select('*'));
    return rows.map(ataFromDb);
  },
  async findById(id) {
    const row = await findRowById('atas', id);
    return row ? ataFromDb(row) : null;
  },
  async create(ata) {
    const row = check(await banco.from('atas').insert(ataToDb(ata)).select().single());
    return ataFromDb(row);
  },
  async update(id, changes) {
    const row = check(await banco.from('atas')
      .update({ ...ataToDb(changes), atualizado_em: new Date().toISOString() })
      .eq('id', id).select().maybeSingle());
    return row ? ataFromDb(row) : null;
  },
  async remove(id) {
    check(await banco.from('atas').delete().eq('id', id).select());
  }
};
