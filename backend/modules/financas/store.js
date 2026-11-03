import { banco } from '../../core/db/banco.js';
import { check, selectAll, findRowById } from '../../core/db/helpers.js';

// Finanças: valores sempre em centavos (inteiros). Saída < 0, entrada > 0.

// Converte linha do banco <-> objeto da API a partir de um mapa campo -> coluna
const conversor = (mapa) => ({
  deDb: (row) => Object.fromEntries(Object.entries(mapa).map(([campo, coluna]) => [campo, row[coluna] ?? null])),
  paraDb: (obj) => Object.fromEntries(Object.entries(mapa).filter(([campo]) => obj[campo] !== undefined).map(([campo, coluna]) => [coluna, obj[campo]]))
});

const CONTA = conversor({
  id: 'id', nome: 'nome', instituicao: 'instituicao', tipo: 'tipo', cor: 'cor', reserva: 'reserva',
  saldoInicial: 'saldo_inicial', saldoInformado: 'saldo_informado', saldoInformadoEm: 'saldo_informado_em',
  conexaoId: 'conexao_id', externoId: 'externo_id', arquivada: 'arquivada', criadoEm: 'criado_em'
});
const TRANSACAO = conversor({
  id: 'id', contaId: 'conta_id', data: 'data', descricao: 'descricao', valor: 'valor', categoria: 'categoria',
  categoriaManual: 'categoria_manual', observacao: 'observacao', origem: 'origem', externoId: 'externo_id',
  ignorada: 'ignorada', criadoEm: 'criado_em'
});
const CONEXAO = conversor({
  id: 'id', provedor: 'provedor', externoId: 'externo_id', instituicao: 'instituicao', status: 'status',
  erro: 'erro', ultimaSincronizacao: 'ultima_sincronizacao', criadoEm: 'criado_em'
});
const DIVISAO = conversor({
  id: 'id', descricao: 'descricao', data: 'data', valorTotal: 'valor_total', pagoPor: 'pago_por',
  participantes: 'participantes', transacaoId: 'transacao_id', categoria: 'categoria', criadoEm: 'criado_em'
});
const REGRA = conversor({ id: 'id', termo: 'termo', categoria: 'categoria', sentido: 'sentido', criadoEm: 'criado_em' });

// CRUD genérico de uma tabela
function tabela(nome, { deDb, paraDb }) {
  return {
    async list(filtrar = (q) => q) {
      return (await selectAll(() => filtrar(banco.from(nome).select('*')))).map(deDb);
    },
    async findById(id) {
      const row = await findRowById(nome, id);
      return row ? deDb(row) : null;
    },
    async create(obj) {
      return deDb(check(await banco.from(nome).insert(paraDb(obj)).select().single()));
    },
    async createMany(lista) {
      if (!lista.length) return [];
      return check(await banco.from(nome).insert(lista.map(paraDb)).select()).map(deDb);
    },
    async update(id, changes) {
      const row = check(await banco.from(nome).update(paraDb(changes)).eq('id', id).select().maybeSingle());
      return row ? deDb(row) : null;
    },
    async remove(id) {
      check(await banco.from(nome).delete().eq('id', id).select('id'));
    }
  };
}

export const ContasStore = tabela('fin_contas', CONTA);
export const ConexoesStore = tabela('fin_conexoes', CONEXAO);
export const DivisoesStore = tabela('fin_divisoes', DIVISAO);
export const RegrasStore = tabela('fin_regras', REGRA);

export const TransacoesStore = {
  ...tabela('fin_transacoes', TRANSACAO),
  // Lançamentos de [de, ate) — datas AAAA-MM-DD
  async periodo(de, ate) {
    return this.list(q => q.gte('data', de).lt('data', ate));
  },
  async daConta(contaId) {
    return this.list(q => q.eq('conta_id', contaId));
  },
  // Muda várias de uma vez (ex.: aplicar uma regra de categoria)
  async atualizarVarias(ids, changes) {
    if (!ids.length) return;
    check(await banco.from('fin_transacoes').update(TRANSACAO.paraDb(changes)).in('id', ids).select('id'));
  }
};

export const OrcamentosStore = {
  async list() {
    return (await selectAll(() => banco.from('fin_orcamentos').select('*'), { chave: 'categoria' }))
      .map(row => ({ categoria: row.categoria, valorMensal: row.valor_mensal }));
  },
  async definir(categoria, valorMensal) {
    check(await banco.from('fin_orcamentos').delete().eq('categoria', categoria).select('categoria'));
    if (valorMensal > 0) check(await banco.from('fin_orcamentos').insert({ categoria, valor_mensal: valorMensal }).select());
  }
};
