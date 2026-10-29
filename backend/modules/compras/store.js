import { supabase } from '../../core/db/supabaseClient.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';

// Itens da lista de compras (tabela `compras_itens`). Cada item fica salvo para sempre:
// status `falta` (acabou, comprar), `acabando` (avisado, ainda tem) ou `ok` (em casa).
// Os itens `ok` formam o catálogo de "já compramos antes", usado nas sugestões.
const itemFromDb = (row) => ({
  id: row.id,
  nome: row.nome,
  categoria: row.categoria,
  status: row.status,
  quantidade: row.quantidade ?? null,
  observacao: row.observacao ?? null,
  pedidoPor: row.pedido_por ?? null,
  pedidoEm: row.pedido_em ?? null,
  compradoEm: row.comprado_em ?? null,
  vezesComprado: row.vezes_comprado ?? 0,
  criadoEm: row.criado_em
});

const COLUNAS = {
  nome: 'nome',
  categoria: 'categoria',
  status: 'status',
  quantidade: 'quantidade',
  observacao: 'observacao',
  pedidoPor: 'pedido_por',
  pedidoEm: 'pedido_em',
  compradoEm: 'comprado_em',
  vezesComprado: 'vezes_comprado'
};

const itemToDb = (item) => {
  const colunas = {};
  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (item[campo] !== undefined) colunas[coluna] = item[campo];
  }
  return colunas;
};

export const ComprasStore = {
  async list() {
    const rows = await selectAll(() => supabase.from('compras_itens').select('*'));
    return rows.map(itemFromDb);
  },
  async findById(id) {
    const row = await findRowById('compras_itens', id);
    return row ? itemFromDb(row) : null;
  },
  // Mesmo nome ignorando maiúsculas, acentos e espaços extras ("Detergente" = "detergente ")
  async findByNome(nome, { excludeId } = {}) {
    const alvo = normalizarNome(nome);
    return (await this.list()).find(item => normalizarNome(item.nome) === alvo && String(item.id) !== String(excludeId)) || null;
  },
  async create(item) {
    const row = check(await supabase.from('compras_itens').insert(itemToDb(item)).select().single());
    return itemFromDb(row);
  },
  async update(id, changes) {
    const row = check(await supabase.from('compras_itens').update(itemToDb(changes)).eq('id', id).select().maybeSingle());
    return row ? itemFromDb(row) : null;
  },
  async remove(id) {
    const rows = check(await supabase.from('compras_itens').delete().eq('id', id).select());
    return rows.length > 0;
  }
};

export const normalizarNome = (nome) => String(nome || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().replace(/\s+/g, ' ').toLowerCase();
