import { banco } from '../../core/db/banco.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';

// Documentos do mural (tabela `documentos`). O arquivo em si fica no R2; `arquivo` guarda o
// caminho /api/midia/<chave>.
const documentoFromDb = (row) => ({
  id: row.id,
  titulo: row.titulo,
  descricao: row.descricao ?? null,
  categoria: row.categoria ?? null,
  arquivo: row.arquivo,
  nomeArquivo: row.nome_arquivo,
  tipo: row.tipo,
  tamanho: row.tamanho ?? 0,
  ataId: row.ata_id ?? null,
  criadoEm: row.criado_em
});

const COLUNAS = {
  titulo: 'titulo', descricao: 'descricao', categoria: 'categoria', arquivo: 'arquivo',
  nomeArquivo: 'nome_arquivo', tipo: 'tipo', tamanho: 'tamanho', ataId: 'ata_id'
};

const documentoToDb = (documento) => {
  const colunas = {};
  for (const [campo, coluna] of Object.entries(COLUNAS)) {
    if (documento[campo] !== undefined) colunas[coluna] = documento[campo];
  }
  return colunas;
};

export const DocumentosStore = {
  async list() {
    const rows = await selectAll(() => banco.from('documentos').select('*'));
    return rows.map(documentoFromDb);
  },
  async listByAta(ataId) {
    const rows = check(await banco.from('documentos').select('*').eq('ata_id', ataId));
    return rows.map(documentoFromDb);
  },
  async findById(id) {
    const row = await findRowById('documentos', id);
    return row ? documentoFromDb(row) : null;
  },
  async create(documento) {
    const row = check(await banco.from('documentos').insert(documentoToDb(documento)).select().single());
    return documentoFromDb(row);
  },
  async update(id, changes) {
    const row = check(await banco.from('documentos').update(documentoToDb(changes)).eq('id', id).select().maybeSingle());
    return row ? documentoFromDb(row) : null;
  },
  async remove(id) {
    check(await banco.from('documentos').delete().eq('id', id).select());
  }
};

// Título e data das atas citadas, para o mural mostrar de qual reunião veio cada anexo. Lê a
// tabela direto (o módulo Atas pode estar desligado; o vínculo é só uma chave estrangeira)
export async function resumoDasAtas(ids) {
  if (!ids.length) return new Map();
  const rows = check(await banco.from('atas').select('id,titulo,data').in('id', ids));
  return new Map(rows.map(row => [row.id, { id: row.id, titulo: row.titulo, data: row.data }]));
}

export const ataExiste = async (id) => Boolean(await findRowById('atas', id));

// ===== CONEXÃO COM O GOOGLE DRIVE (linha única, id = 1) =====
const conexaoFromDb = (row) => ({
  refreshToken: row.refresh_token,
  email: row.email ?? null,
  pastaId: row.pasta_id ?? null,
  pastaNome: row.pasta_nome ?? null,
  erro: row.erro ?? null,
  conectadoEm: row.conectado_em
});

export const DriveConexaoStore = {
  async get() {
    const row = check(await banco.from('documentos_drive').select('*').eq('id', 1).maybeSingle());
    return row ? conexaoFromDb(row) : null;
  },
  // Nova conexão: troca a conta e começa sem pasta escolhida (a da conta anterior pode não existir)
  async conectar({ refreshToken, email }) {
    const row = check(await banco.from('documentos_drive').upsert({
      id: 1, refresh_token: refreshToken, email, pasta_id: null, pasta_nome: null, erro: null,
      conectado_em: new Date().toISOString()
    }).select().single());
    return conexaoFromDb(row);
  },
  async update(changes) {
    const dbChanges = {};
    if (changes.pastaId !== undefined) dbChanges.pasta_id = changes.pastaId;
    if (changes.pastaNome !== undefined) dbChanges.pasta_nome = changes.pastaNome;
    if (changes.erro !== undefined) dbChanges.erro = changes.erro;
    const row = check(await banco.from('documentos_drive').update(dbChanges).eq('id', 1).select().maybeSingle());
    return row ? conexaoFromDb(row) : null;
  },
  async remove() {
    check(await banco.from('documentos_drive').delete().eq('id', 1).select());
  }
};
