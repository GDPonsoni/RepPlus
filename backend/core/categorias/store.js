import { banco } from '../db/banco.js';
import { check, selectAll, findRowById } from '../db/helpers.js';

// Categorias gerenciáveis (tabela `categorias`), separadas por escopo ('agenda', 'compras'...).
// Os registros dos módulos guardam a `chave` da categoria; nome, cor e ícone podem mudar à vontade.
const categoriaFromDb = (row) => ({
  id: row.id,
  escopo: row.escopo,
  chave: row.chave,
  nome: row.nome,
  cor: row.cor,
  icone: row.icone,
  ordem: row.ordem ?? 0
});

// Aplica o filtro extra do escopo (ex.: só anotações do tipo "conta")
const comFiltro = (consulta, filtro = {}) =>
  Object.entries(filtro).reduce((q, [coluna, valor]) => q.eq(coluna, valor), consulta);

export const CategoriasStore = {
  async list(escopo) {
    const rows = await selectAll(() => banco.from('categorias').select('*').eq('escopo', escopo));
    return rows.map(categoriaFromDb).sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome, 'pt-BR'));
  },
  async findById(id) {
    const row = await findRowById('categorias', id);
    return row ? categoriaFromDb(row) : null;
  },
  async createMany(categorias) {
    const rows = check(await banco.from('categorias').insert(categorias).select());
    return rows.map(categoriaFromDb);
  },
  async update(id, changes) {
    const row = check(await banco.from('categorias').update(changes).eq('id', id).select().maybeSingle());
    return row ? categoriaFromDb(row) : null;
  },
  async remove(id) {
    check(await banco.from('categorias').delete().eq('id', id).select());
  },

  // ===== Uso nos registros do módulo (definição do escopo: { tabela, coluna, filtro }) =====
  async valoresEmUso({ tabela, coluna, filtro }) {
    const rows = await selectAll(() => comFiltro(banco.from(tabela).select(coluna), filtro));
    return [...new Set(rows.map(row => row[coluna]).filter(Boolean))];
  },
  async contarUso({ tabela, coluna, filtro }, chave) {
    const rows = await selectAll(() => comFiltro(banco.from(tabela).select('id').eq(coluna, chave), filtro));
    return rows.length;
  },
  async substituir({ tabela, coluna, filtro }, de, para) {
    check(await comFiltro(banco.from(tabela).update({ [coluna]: para }).eq(coluna, de), filtro).select('id'));
  }
};
