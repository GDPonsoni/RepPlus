// Copia os dados do Supabase antigo para o banco novo (DATABASE_URL) e as imagens do Storage
// para o R2, trocando as URLs das imagens gravadas no banco. Não apaga nada no Supabase e pode
// ser rodado de novo: linhas com a mesma chave são atualizadas, não duplicadas.
//
// Antes: rode `npm run db:migrar` no banco novo. Depois, com estas variáveis no .env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (do projeto antigo)
//   DATABASE_URL, R2_*                         (do esquema novo: Neon e bucket R2 privado)
// rode: npm run db:importar-supabase
import 'dotenv/config';
import { pool, banco } from '../backend/core/db/banco.js';
import { check } from '../backend/core/db/helpers.js';
import { salvarArquivo, PREFIXO_MIDIA } from '../backend/core/storage.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const { SUPABASE_SERVICE_ROLE_KEY } = process.env;
const BUCKET = 'uploads';

// Ordem respeita as referências entre tabelas (moradores antes de quem aponta para eles)
const TABELAS = [
  'config', 'integrantes', 'comodos', 'escalas', 'infracoes', 'eventos', 'categorias',
  'compras_itens', 'anotacoes', 'anotacoes_cofre', 'atas',
  'fin_conexoes', 'fin_contas', 'fin_transacoes', 'fin_regras', 'fin_orcamentos', 'fin_divisoes'
];
const LOTE = 200;

// Tabelas que o banco novo já pode ter preenchido com outro id: as categorias padrão são
// criadas pelo backend na primeira vez que cada grupo abre. Os registros apontam para a
// categoria pela chave (texto), não pelo id, então a linha antiga substitui a nova pela chave.
const CHAVE_NATURAL = { categorias: ['escopo', 'chave'] };

const cabecalhos = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

async function supabase(caminho, opcoes = {}) {
  const resposta = await fetch(`${SUPABASE_URL}${caminho}`, { ...opcoes, headers: { ...cabecalhos, ...opcoes.headers } });
  if (!resposta.ok) {
    const erro = new Error(`${resposta.status} em ${caminho}: ${(await resposta.text()).slice(0, 200)}`);
    erro.status = resposta.status;
    throw erro;
  }
  return resposta;
}

// URL pública antiga -> caminho do bucket privado (/api/midia/...), em qualquer texto
// (inclusive dentro de JSON)
const PREFIXO_ANTIGO = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const trocarUrls = (valor) => {
  if (typeof valor === 'string') return valor.split(PREFIXO_ANTIGO).join(PREFIXO_MIDIA);
  if (Array.isArray(valor)) return valor.map(trocarUrls);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trocarUrls(v)]));
  return valor;
};

async function estruturaDestino(tabela) {
  const { rows: colunas } = await pool.query(
    'select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1', [tabela]);
  const { rows: chave } = await pool.query(
    `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = $1::regclass and i.indisprimary`, [tabela]);
  return { colunas: new Set(colunas.map(c => c.column_name)), chave: chave.map(c => c.attname) };
}

async function copiarTabela(tabela) {
  const { colunas, chave } = await estruturaDestino(tabela);
  const ignoradas = new Set();
  let total = 0;
  for (let inicio = 0; ; inicio += LOTE) {
    let linhas;
    try {
      const ordem = chave.map(coluna => `${coluna}.asc`).join(',');
      linhas = await (await supabase(`/rest/v1/${tabela}?select=*&order=${ordem}&limit=${LOTE}&offset=${inicio}`)).json();
    } catch (erro) {
      // Tabela de um módulo que o app antigo ainda não tinha
      if (inicio === 0 && (erro.status === 404 || /PGRST205|does not exist/.test(erro.message))) return console.log(`  ${tabela}: não existe no Supabase, pulando`);
      throw erro;
    }
    if (linhas.length === 0) break;
    const copia = linhas.map((linha) => {
      const nova = {};
      for (const [coluna, valor] of Object.entries(linha)) {
        if (colunas.has(coluna)) nova[coluna] = trocarUrls(valor);
        else ignoradas.add(coluna);
      }
      return nova;
    });
    check(await banco.from(tabela).upsert(copia, { onConflict: (CHAVE_NATURAL[tabela] || chave).join(',') }));
    total += linhas.length;
  }
  console.log(`  ${tabela}: ${total} linha(s)${ignoradas.size ? ` (colunas antigas ignoradas: ${[...ignoradas].join(', ')})` : ''}`);
}

async function copiarArquivos() {
  const nomes = [];
  for (let offset = 0; ; offset += 1000) {
    const pagina = await (await supabase(`/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000, offset })
    })).json();
    // Entradas sem id são pastas
    nomes.push(...pagina.filter(item => item.id).map(item => item.name));
    if (pagina.length < 1000) break;
  }
  for (const [i, nome] of nomes.entries()) {
    const resposta = await supabase(`/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`);
    const tipo = resposta.headers.get('content-type') || 'application/octet-stream';
    await salvarArquivo(nome, Buffer.from(await resposta.arrayBuffer()), tipo);
    process.stdout.write(`\r  imagens: ${i + 1}/${nomes.length}`);
  }
  console.log(nomes.length ? '' : '  imagens: nenhuma');
}

try {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (do projeto antigo).');
  if (!process.env.R2_BUCKET) throw new Error('Defina as variáveis R2_* antes de importar (as imagens vão para o R2).');
  console.log('Imagens (Storage -> R2):');
  await copiarArquivos();
  console.log('Tabelas (Supabase -> banco novo):');
  for (const tabela of TABELAS) await copiarTabela(tabela);
  console.log('Importação concluída.');
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
