// Aplica no banco as migrações de db/migrations/ que ainda não rodaram, em ordem de nome.
// Usa DATABASE_URL_UNPOOLED (conexão direta do Neon) ou, sem ela, DATABASE_URL. Cada
// migração roda numa transação e fica registrada na tabela migracoes_aplicadas.
// Uso: npm run db:migrar   (o Render roda isso a cada deploy, no comando de build)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { criarPool, pool as poolDoApp } from '../backend/core/db/banco.js';

// Migração não passa pelo pooler (PgBouncer em modo transação não guarda estado de sessão)
const pool = process.env.DATABASE_URL_UNPOOLED ? criarPool(process.env.DATABASE_URL_UNPOOLED) : poolDoApp;
const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function migrar() {
  await pool.query(`create table if not exists migracoes_aplicadas (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);
  const { rows } = await pool.query('select nome from migracoes_aplicadas');
  const aplicadas = new Set(rows.map(row => row.nome));
  const pendentes = fs.readdirSync(PASTA).filter(nome => nome.endsWith('.sql')).sort().filter(nome => !aplicadas.has(nome));

  if (pendentes.length === 0) {
    console.log('Banco em dia: nenhuma migração pendente.');
    return;
  }
  for (const nome of pendentes) {
    const conexao = await pool.connect();
    try {
      await conexao.query('begin');
      await conexao.query(fs.readFileSync(path.join(PASTA, nome), 'utf8'));
      await conexao.query('insert into migracoes_aplicadas (nome) values ($1)', [nome]);
      await conexao.query('commit');
      console.log(`✔ ${nome}`);
    } catch (erro) {
      await conexao.query('rollback');
      throw new Error(`Falha na migração ${nome}: ${erro.message}`);
    } finally {
      conexao.release();
    }
  }
}

try {
  await migrar();
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
  if (pool !== poolDoApp) await poolDoApp.end();
}
