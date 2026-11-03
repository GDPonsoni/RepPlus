import { PROVEDORES } from './provedores/index.js';
import { ContasStore, ConexoesStore, TransacoesStore, RegrasStore } from './store.js';
import { categorizar } from './regras.js';

// Sincronização com o Open Finance: roda uma vez por dia (um agendador chamando
// GET /api/financas/sincronizar com CRON_SECRET) e também pelo botão "Sincronizar agora".

const DIAS_PRIMEIRA_CARGA = 90;
const DIAS_DE_FOLGA = 10;   // reimporta os últimos dias: bancos às vezes lançam com atraso

const hojeNaCasa = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diasAtras = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

export async function sincronizarConexao(conexao) {
  const provedor = PROVEDORES[conexao.provedor];
  try {
    if (!provedor?.configurado()) throw new Error(`Provedor ${conexao.provedor} não está configurado.`);
    const regras = await RegrasStore.list();
    const minhasContas = (await ContasStore.list()).filter(c => c.conexaoId === conexao.id);
    const desde = conexao.ultimaSincronizacao
      ? diasAtras(new Date(conexao.ultimaSincronizacao).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), DIAS_DE_FOLGA)
      : diasAtras(hojeNaCasa(), DIAS_PRIMEIRA_CARGA);

    let novas = 0;
    for (const externa of await provedor.contas(conexao)) {
      // Conta nova no banco vira conta no app; as existentes só atualizam o saldo
      let conta = minhasContas.find(c => c.externoId === externa.externoId);
      const saldo = { saldoInformado: externa.saldo, saldoInformadoEm: new Date().toISOString() };
      conta = conta
        ? await ContasStore.update(conta.id, saldo)
        : await ContasStore.create({
          nome: externa.nome, instituicao: externa.instituicao, tipo: externa.tipo,
          reserva: ['caixinha', 'investimento'].includes(externa.tipo),
          cor: externa.tipo === 'caixinha' || externa.tipo === 'investimento' ? '#16a34a' : '#2563eb',
          conexaoId: conexao.id, externoId: externa.externoId, ...saldo
        });

      const jaImportadas = new Set((await TransacoesStore.daConta(conta.id)).map(t => t.externoId).filter(Boolean));
      const chegaram = (await provedor.transacoes(conexao, conta, desde)).filter(t => !jaImportadas.has(t.externoId));
      await TransacoesStore.createMany(chegaram.map(t => ({
        contaId: conta.id, data: t.data, descricao: t.descricao, valor: t.valor,
        categoria: categorizar(t, regras), origem: 'importado', externoId: t.externoId
      })));
      novas += chegaram.length;
    }

    await ConexoesStore.update(conexao.id, { status: 'ativa', erro: null, ultimaSincronizacao: new Date().toISOString() });
    return { conexao: conexao.id, novas };
  } catch (error) {
    console.error(`Erro ao sincronizar a conexão ${conexao.id}:`, error);
    await ConexoesStore.update(conexao.id, { status: 'erro', erro: error.message });
    return { conexao: conexao.id, erro: error.message };
  }
}

export async function sincronizarTudo() {
  const conexoes = (await ConexoesStore.list()).filter(c => c.status !== 'desconectada');
  const resultados = [];
  for (const conexao of conexoes) resultados.push(await sincronizarConexao(conexao));
  return resultados;
}
