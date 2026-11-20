import 'dotenv/config';
import pg from 'pg';

// Acesso ao banco Postgres (Neon em produção) pela variável DATABASE_URL.
//
// As stores montam as consultas com um encadeamento curto, no mesmo formato que o app usava
// com o Supabase:  banco.from('tabela').select('*').eq('id', id).maybeSingle()
// O resultado é sempre { data, error } (use check() de helpers.js). Só existe aqui o que o
// backend usa; para algo novo, acrescente o método na classe Consulta.

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error('Defina DATABASE_URL (endereço do banco Postgres/Neon) nas variáveis de ambiente.');
}

// Mesmos formatos que a API sempre devolveu: datas e horários como texto ISO, números como number
const lerHorario = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
const lerHorarioSemFuso = pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (valor) => lerHorario(valor).toISOString());
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (valor) => lerHorarioSemFuso(valor).toISOString());
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

// O pg já trata sslmode=require como verify-full (confere o certificado); deixar explícito
// mantém esse comportamento quando o pg mudar o significado de "require"
const comSslVerificado = (url) => url.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/, '$1sslmode=verify-full');

// Pool de conexões. O app usa DATABASE_URL (a do Neon com -pooler, que aguenta muitas conexões);
// as migrações usam a conexão direta (DATABASE_URL_UNPOOLED), como a Neon recomenda.
export function criarPool(connectionString) {
  const novo = new pg.Pool({
    connectionString: comSslVerificado(connectionString),
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30000
  });
  // O Neon desliga conexões paradas; sem este ouvinte o processo cairia junto
  novo.on('error', (erro) => console.error('Conexão com o banco encerrada:', erro.message));
  return novo;
}

export const pool = criarPool(DATABASE_URL);

// ===== COLUNAS DE CADA TABELA =====
// Lidas uma vez do próprio banco: validam os nomes usados nas consultas (nada de texto livre
// no SQL) e dizem quais colunas são jsonb (o valor vai como JSON, inclusive listas).
const colunasPorTabela = new Map();

function colunasDe(tabela) {
  if (!colunasPorTabela.has(tabela)) {
    const busca = pool.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = current_schema() and table_name = $1`,
      [tabela]
    ).then(({ rows }) => {
      if (rows.length === 0) throw new Error(`Tabela inexistente no banco: ${tabela}. Rode as migrações (npm run db:migrar).`);
      return new Map(rows.map(row => [row.column_name, row.data_type]));
    });
    busca.catch(() => colunasPorTabela.delete(tabela));
    colunasPorTabela.set(tabela, busca);
  }
  return colunasPorTabela.get(tabela);
}

const ehJson = (tipo) => tipo === 'jsonb' || tipo === 'json';

// ===== FILTROS DE .or() =====
// Mesma sintaxe do PostgREST, ex.: "ano.gt.2026,and(ano.eq.2026,semana.gte.40)"
const OPERADORES = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

function separarNoNivel(texto) {
  const partes = [];
  let profundidade = 0;
  let atual = '';
  for (const caractere of texto) {
    if (caractere === '(') profundidade++;
    if (caractere === ')') profundidade--;
    if (caractere === ',' && profundidade === 0) {
      partes.push(atual);
      atual = '';
    } else {
      atual += caractere;
    }
  }
  partes.push(atual);
  return partes.map(parte => parte.trim()).filter(Boolean);
}

function lerExpressao(texto, juncao = 'or') {
  const condicoes = separarNoNivel(texto).map((parte) => {
    const grupo = /^(and|or)\((.*)\)$/.exec(parte);
    if (grupo) return lerExpressao(grupo[2], grupo[1]);
    const [coluna, operador, ...resto] = parte.split('.');
    const valor = resto.join('.');
    if (operador === 'is') return { coluna, operador, valor: { null: null, true: true, false: false }[valor] };
    if (!OPERADORES[operador]) throw new Error(`Filtro .or() não suportado: ${parte}`);
    return { coluna, operador, valor };
  });
  return { juncao, condicoes };
}

// ===== CONSULTA =====
class Consulta {
  constructor(tabela) {
    this.tabela = tabela;
    this.acao = 'select';
    this.colunas = '*';
    this.retorno = null;
    this.filtros = [];
    this.ordem = [];
  }

  // Na leitura escolhe as colunas; depois de insert/update/upsert/delete, devolve as linhas afetadas
  select(colunas = '*') {
    if (this.acao === 'select') this.colunas = colunas;
    else this.retorno = colunas;
    return this;
  }
  insert(linhas) { this.acao = 'insert'; this.dados = [].concat(linhas); return this; }
  upsert(linhas, { onConflict = 'id' } = {}) {
    this.acao = 'upsert';
    this.dados = [].concat(linhas);
    this.conflito = onConflict.split(',').map(coluna => coluna.trim());
    return this;
  }
  update(mudancas) { this.acao = 'update'; this.dados = mudancas; return this; }
  delete() { this.acao = 'delete'; return this; }

  eq(coluna, valor) { return this.comparar(coluna, 'eq', valor); }
  neq(coluna, valor) { return this.comparar(coluna, 'neq', valor); }
  gt(coluna, valor) { return this.comparar(coluna, 'gt', valor); }
  gte(coluna, valor) { return this.comparar(coluna, 'gte', valor); }
  lt(coluna, valor) { return this.comparar(coluna, 'lt', valor); }
  lte(coluna, valor) { return this.comparar(coluna, 'lte', valor); }
  is(coluna, valor) { return this.comparar(coluna, 'is', valor); }
  in(coluna, valores) { return this.comparar(coluna, 'in', valores); }
  or(expressao) { this.filtros.push(lerExpressao(expressao)); return this; }
  comparar(coluna, operador, valor) {
    this.filtros.push({ coluna, operador, valor });
    return this;
  }

  order(coluna, { ascending = true } = {}) { this.ordem.push({ coluna, ascending }); return this; }
  limit(quantidade) { this.limite = quantidade; return this; }
  range(de, ate) { this.inicio = de; this.limite = ate - de + 1; return this; }
  single() { this.modo = 'single'; return this; }
  maybeSingle() { this.modo = 'maybe'; return this; }

  // Permite usar `await consulta` diretamente
  then(resolver, rejeitar) {
    return this.executar().then(resolver, rejeitar);
  }

  async executar() {
    try {
      const tipos = await colunasDe(this.tabela);
      const { rows } = await pool.query(...this.montar(tipos));
      return this.resposta(rows);
    } catch (erro) {
      return { data: null, error: { message: erro.message, code: erro.code } };
    }
  }

  resposta(linhas) {
    if (this.modo === 'single') {
      return linhas.length === 1
        ? { data: linhas[0], error: null }
        : { data: null, error: { message: `Esperava 1 linha em ${this.tabela}, vieram ${linhas.length}.` } };
    }
    if (this.modo === 'maybe') {
      return linhas.length > 1
        ? { data: null, error: { message: `Esperava no máximo 1 linha em ${this.tabela}, vieram ${linhas.length}.` } }
        : { data: linhas[0] ?? null, error: null };
    }
    const devolveLinhas = this.acao === 'select' || this.retorno !== null;
    return { data: devolveLinhas ? linhas : null, error: null };
  }

  // Monta o SQL com parâmetros ($1, $2...): valores nunca entram no texto da consulta
  montar(tipos) {
    const valores = [];
    const coluna = (nome) => {
      if (!tipos.has(nome)) throw new Error(`Coluna inexistente: ${this.tabela}.${nome}`);
      return `"${nome}"`;
    };
    const valor = (nome, dado) => {
      const convertido = dado !== null && dado !== undefined && ehJson(tipos.get(nome)) ? JSON.stringify(dado) : dado;
      valores.push(convertido === undefined ? null : convertido);
      return `$${valores.length}`;
    };
    const listaDeColunas = (texto) => (texto === '*' ? '*' : texto.split(',').map(nome => coluna(nome.trim())).join(', '));

    const condicao = (filtro) => {
      if (filtro.juncao) {
        const partes = filtro.condicoes.map(condicao);
        return `(${partes.join(filtro.juncao === 'and' ? ' and ' : ' or ')})`;
      }
      const { coluna: nome, operador, valor: dado } = filtro;
      if (operador === 'is') {
        if (![null, true, false].includes(dado)) throw new Error(`.is() aceita só null, true ou false (${nome})`);
        return `${coluna(nome)} is ${dado === null ? 'null' : dado}`;
      }
      if (operador === 'in') {
        if (!Array.isArray(dado) || dado.length === 0) return 'false';
        valores.push(dado);
        return `${coluna(nome)} = any($${valores.length})`;
      }
      return `${coluna(nome)} ${OPERADORES[operador]} ${valor(nome, dado)}`;
    };

    const tabela = `"${this.tabela}"`;
    const onde = () => (this.filtros.length ? ` where ${this.filtros.map(condicao).join(' and ')}` : '');
    const retornando = this.retorno === null ? '' : ` returning ${listaDeColunas(this.retorno)}`;

    // Alterar ou apagar sem filtro mexeria na tabela inteira: o Supabase também recusava
    if ((this.acao === 'update' || this.acao === 'delete') && this.filtros.length === 0) {
      throw new Error(`${this.acao} sem filtro em ${this.tabela}`);
    }

    if (this.acao === 'select') {
      let sql = `select ${listaDeColunas(this.colunas)} from ${tabela}${onde()}`;
      if (this.ordem.length) {
        sql += ` order by ${this.ordem.map(({ coluna: nome, ascending }) => `${coluna(nome)} ${ascending ? 'asc' : 'desc'}`).join(', ')}`;
      }
      if (this.limite !== undefined) sql += ` limit ${Math.max(0, Math.trunc(this.limite))}`;
      if (this.inicio !== undefined) sql += ` offset ${Math.max(0, Math.trunc(this.inicio))}`;
      return [sql, valores];
    }

    if (this.acao === 'insert' || this.acao === 'upsert') {
      if (this.dados.length === 0) return ['select 1 where false', []];
      const nomes = [...new Set(this.dados.flatMap(linha => Object.keys(linha)))];
      const linhas = this.dados.map(linha =>
        `(${nomes.map(nome => (linha[nome] === undefined ? 'default' : valor(nome, linha[nome]))).join(', ')})`
      );
      let sql = `insert into ${tabela} (${nomes.map(coluna).join(', ')}) values ${linhas.join(', ')}`;
      if (this.acao === 'upsert') {
        const atualizar = nomes.filter(nome => !this.conflito.includes(nome));
        sql += ` on conflict (${this.conflito.map(coluna).join(', ')}) do `;
        sql += atualizar.length
          ? `update set ${atualizar.map(nome => `${coluna(nome)} = excluded.${coluna(nome)}`).join(', ')}`
          : 'nothing';
      }
      return [sql + retornando, valores];
    }

    if (this.acao === 'update') {
      const nomes = Object.keys(this.dados).filter(nome => this.dados[nome] !== undefined);
      // Nada para mudar: devolve as linhas como estão
      if (nomes.length === 0) {
        return [`select ${this.retorno === null ? '1' : listaDeColunas(this.retorno)} from ${tabela}${onde()}`, valores];
      }
      const atribuicoes = nomes.map(nome => `${coluna(nome)} = ${valor(nome, this.dados[nome])}`).join(', ');
      return [`update ${tabela} set ${atribuicoes}${onde()}${retornando}`, valores];
    }

    return [`delete from ${tabela}${onde()}${retornando}`, valores];
  }
}

const NOME_SQL = /^[a-z_][a-z0-9_]*$/;

export const banco = {
  from: (tabela) => {
    if (!NOME_SQL.test(tabela)) throw new Error(`Nome de tabela inválido: ${tabela}`);
    return new Consulta(tabela);
  },

  // Chama uma função do banco com argumentos nomeados; objetos e listas vão como JSON
  async rpc(funcao, argumentos = {}) {
    try {
      const nomes = Object.keys(argumentos);
      if (![funcao, ...nomes].every(nome => NOME_SQL.test(nome))) throw new Error(`Nome inválido na chamada de ${funcao}`);
      const valores = nomes.map((nome) => {
        const dado = argumentos[nome];
        return dado !== null && typeof dado === 'object' && !(dado instanceof Date) ? JSON.stringify(dado) : dado;
      });
      const parametros = nomes.map((nome, i) => `"${nome}" => $${i + 1}`).join(', ');
      const { rows } = await pool.query(`select * from "${funcao}"(${parametros})`, valores);
      return { data: rows, error: null };
    } catch (erro) {
      return { data: null, error: { message: erro.message, code: erro.code } };
    }
  }
};
