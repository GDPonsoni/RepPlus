import { supabase } from '../../core/db/supabaseClient.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';

// Anotações da casa (tabela `anotacoes`): contas/senhas, contatos de prestadores e notas.
// `dados` guarda os campos abertos; `segredo` guarda os campos sigilosos já cifrados no
// navegador com a chave do cofre (o servidor nunca vê o texto original).
const anotacaoFromDb = (row) => ({
  id: row.id,
  tipo: row.tipo,
  titulo: row.titulo,
  categoria: row.categoria ?? null,
  dados: row.dados || {},
  segredo: row.segredo ?? null,
  fixado: row.fixado ?? false,
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em ?? row.criado_em
});

const anotacaoToDb = (anotacao) => {
  const colunas = {};
  for (const campo of ['tipo', 'titulo', 'categoria', 'dados', 'segredo', 'fixado']) {
    if (anotacao[campo] !== undefined) colunas[campo] = anotacao[campo];
  }
  return colunas;
};

export const AnotacoesStore = {
  async list() {
    const rows = await selectAll(() => supabase.from('anotacoes').select('*'));
    return rows.map(anotacaoFromDb);
  },
  async findById(id) {
    const row = await findRowById('anotacoes', id);
    return row ? anotacaoFromDb(row) : null;
  },
  async create(anotacao) {
    const row = check(await supabase.from('anotacoes').insert(anotacaoToDb(anotacao)).select().single());
    return anotacaoFromDb(row);
  },
  async update(id, changes) {
    const row = check(await supabase.from('anotacoes')
      .update({ ...anotacaoToDb(changes), atualizado_em: new Date().toISOString() })
      .eq('id', id).select().maybeSingle());
    return row ? anotacaoFromDb(row) : null;
  },
  async remove(id) {
    check(await supabase.from('anotacoes').delete().eq('id', id).select());
  },
  // Cofre apagado: os segredos ficam ilegíveis, então são descartados
  async limparSegredos() {
    const comSegredo = (await this.list()).filter(anotacao => anotacao.segredo);
    if (!comSegredo.length) return 0;
    check(await supabase.from('anotacoes').update({ segredo: null }).in('id', comSegredo.map(a => a.id)).select());
    return comSegredo.length;
  }
};

// Cofre (tabela `anotacoes_cofre`, linha única id = 1): a chave dos segredos, cifrada com a
// senha do cofre. `verificador_hash` = SHA-256 da prova que só quem destrancou consegue calcular.
const cofreFromDb = (row) => ({
  salt: row.salt,
  iteracoes: row.iteracoes,
  chaveCifrada: row.chave_cifrada,
  verificadorHash: row.verificador_hash
});

export const CofreStore = {
  async get() {
    const row = check(await supabase.from('anotacoes_cofre').select('*').eq('id', 1).maybeSingle());
    return row ? cofreFromDb(row) : null;
  },
  async save({ salt, iteracoes, chaveCifrada, verificadorHash }) {
    const row = check(await supabase.from('anotacoes_cofre').upsert({
      id: 1, salt, iteracoes, chave_cifrada: chaveCifrada, verificador_hash: verificadorHash,
      atualizado_em: new Date().toISOString()
    }).select().single());
    return cofreFromDb(row);
  },
  async remove() {
    check(await supabase.from('anotacoes_cofre').delete().eq('id', 1).select());
  }
};
