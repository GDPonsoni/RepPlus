import { banco } from '../db/banco.js';
import { check, selectAll, findRowById, sameId, normalizeBoolean } from '../db/helpers.js';

// Moradores da república (tabela `integrantes`). São do núcleo: todo módulo que envolve
// pessoas (escala, agenda, financeiro...) referencia estes registros. No futuro, cada
// usuário com login será ligado a um integrante.

// Campos do cadastro além de nome/suíte/ativo: campo da API -> coluna do banco.
// Todos são opcionais (texto ou null); datas no formato AAAA-MM-DD.
export const CAMPOS_PERFIL = {
  nomeCompleto: 'nome_completo',
  dataNascimento: 'data_nascimento',
  telefone: 'telefone',
  email: 'email',
  dataEntrada: 'data_entrada',
  observacoes: 'observacoes',
  emergenciaNome: 'emergencia_nome',
  emergenciaParentesco: 'emergencia_parentesco',
  emergenciaTelefone: 'emergencia_telefone',
  cpf: 'cpf',
  rg: 'rg'
};

// Campos sensíveis: só saem na API para quem tem a permissão moradores:documentos
export const CAMPOS_DOCUMENTOS = ['cpf', 'rg'];

// ===== INTEGRANTES =====
const integranteFromDb = (row) => {
  const integrante = {
    id: row.id,
    nome: row.nome,
    isSuite: row.is_suite,
    ativo: row.ativo
  };
  for (const [campo, coluna] of Object.entries(CAMPOS_PERFIL)) {
    integrante[campo] = row[coluna] ?? null;
  }
  return integrante;
};

const perfilToDb = (dados) => {
  const colunas = {};
  for (const [campo, coluna] of Object.entries(CAMPOS_PERFIL)) {
    if (dados[campo] !== undefined) colunas[coluna] = dados[campo];
  }
  return colunas;
};

export const IntegrantesStore = {
  async list() {
    const rows = await selectAll(() => banco.from('integrantes').select('*'));
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
  async create({ nome, isSuite, ativo, ...perfil }) {
    const row = check(await banco.from('integrantes').insert({
      nome: nome.trim(),
      is_suite: normalizeBoolean(isSuite, false),
      ativo: normalizeBoolean(ativo, true),
      ...perfilToDb(perfil)
    }).select().single());
    return integranteFromDb(row);
  },
  async update(id, changes) {
    const dbChanges = perfilToDb(changes);
    if (changes.nome !== undefined) dbChanges.nome = changes.nome;
    if (changes.isSuite !== undefined) dbChanges.is_suite = changes.isSuite;
    if (changes.ativo !== undefined) dbChanges.ativo = changes.ativo;

    const row = check(await banco.from('integrantes').update(dbChanges).eq('id', id).select().maybeSingle());
    return row ? integranteFromDb(row) : null;
  },
  async remove(id) {
    const rows = check(await banco.from('integrantes').delete().eq('id', id).select());
    return rows.length > 0;
  }
};
