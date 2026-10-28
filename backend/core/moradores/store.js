import { supabase } from '../db/supabaseClient.js';
import { check, selectAll, findRowById, sameId, normalizeBoolean } from '../db/helpers.js';

// Moradores da república (tabela `integrantes`). São do núcleo: todo módulo que envolve
// pessoas (escala, financeiro, eventos...) referencia estes registros. No futuro, cada
// usuário com login será ligado a um integrante.

// ===== INTEGRANTES =====
const integranteFromDb = (row) => ({
  id: row.id,
  nome: row.nome,
  isSuite: row.is_suite,
  ativo: row.ativo
});

export const IntegrantesStore = {
  async list() {
    const rows = await selectAll(() => supabase.from('integrantes').select('*'));
    return rows.map(integranteFromDb);
  },
  async findById(id) {
    const row = await findRowById('integrantes', id);
    return row ? integranteFromDb(row) : null;
  },
  async findByNome(nome, { excludeId } = {}) {
    const alvo = String(nome || '').trim().toLowerCase();
    return (await this.list()).find((integrante) =>
      String(integrante.nome || '').trim().toLowerCase() === alvo &&
      !sameId(integrante.id, excludeId)
    ) || null;
  },
  async create({ nome, isSuite }) {
    const row = check(await supabase.from('integrantes').insert({
      nome: nome.trim(),
      is_suite: normalizeBoolean(isSuite, false),
      ativo: true
    }).select().single());
    return integranteFromDb(row);
  },
  async update(id, changes) {
    const dbChanges = {};
    if (changes.nome !== undefined) dbChanges.nome = changes.nome;
    if (changes.isSuite !== undefined) dbChanges.is_suite = changes.isSuite;
    if (changes.ativo !== undefined) dbChanges.ativo = changes.ativo;

    const row = check(await supabase.from('integrantes').update(dbChanges).eq('id', id).select().maybeSingle());
    return row ? integranteFromDb(row) : null;
  },
  async remove(id) {
    const rows = check(await supabase.from('integrantes').delete().eq('id', id).select());
    return rows.length > 0;
  }
};
