import { asyncHandler, HttpError } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../../core/db/helpers.js';
import { ContasStore, ConexoesStore, TransacoesStore } from '../store.js';
import { PROVEDORES, listarProvedores } from '../provedores/index.js';
import { sincronizarConexao, sincronizarTudo } from '../sincronizacao.js';
import { lerTexto, lerCentavos, hojeNaCasa } from '../validacao.js';

const TIPOS = ['corrente', 'cartao', 'dinheiro', 'caixinha', 'investimento'];
const COR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Saldo: o que o banco informou (conta conectada) ou saldo inicial + lançamentos (manual)
export async function contasComSaldo() {
  const [contas, transacoes] = await Promise.all([ContasStore.list(), TransacoesStore.list()]);
  const somas = new Map();
  transacoes.filter(t => !t.ignorada).forEach(t => somas.set(t.contaId, (somas.get(t.contaId) || 0) + t.valor));
  return contas.map(conta => ({
    ...conta,
    saldo: conta.saldoInformado ?? (conta.saldoInicial + (somas.get(conta.id) || 0)),
    conectada: Boolean(conta.conexaoId)
  }));
}

function lerConta(body, existente = null) {
  const conta = {};
  if (!existente || body.nome !== undefined) conta.nome = lerTexto(body.nome, 'o nome da conta', 60, { obrigatorio: true });
  if (body.instituicao !== undefined) conta.instituicao = lerTexto(body.instituicao, 'a instituição', 60);
  if (body.tipo !== undefined || !existente) {
    const tipo = body.tipo || 'corrente';
    if (!TIPOS.includes(tipo)) throw new HttpError(400, `Tipo inválido. Use: ${TIPOS.join(', ')}.`);
    conta.tipo = tipo;
  }
  if (body.cor !== undefined) {
    if (!COR_REGEX.test(String(body.cor))) throw new HttpError(400, 'Cor inválida.');
    conta.cor = body.cor.toLowerCase();
  }
  if (body.reserva !== undefined) conta.reserva = normalizeBoolean(body.reserva, false);
  if (body.arquivada !== undefined) conta.arquivada = normalizeBoolean(body.arquivada, false);
  if (body.saldoInicial !== undefined) {
    if (existente?.conexaoId) throw new HttpError(400, 'O saldo de uma conta conectada vem do banco.');
    conta.saldoInicial = body.saldoInicial === 0 ? 0 : lerCentavos(body.saldoInicial, 'Saldo inicial');
  }
  return conta;
}

// Sincronização liberada para o agendador da Vercel (CRON_SECRET) ou para quem gerencia as finanças
function exigirCronOuPermissao(req, res, next) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.get('authorization') === `Bearer ${segredo}`) return next();
  return exigirPermissao('financas:gerenciar')(req, res, next);
}

export default function rotasContas(router) {
  router.get('/financas/contas', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    res.json(await contasComSaldo());
  }));

  router.post('/financas/contas', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const conta = lerConta(req.body || {});
    if (conta.reserva === undefined) conta.reserva = ['caixinha', 'investimento'].includes(conta.tipo);
    res.status(201).json(await ContasStore.create(conta));
  }));

  router.put('/financas/contas/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await ContasStore.findById(req.params.id);
    if (!existente) throw new HttpError(404, 'Conta não encontrada.');
    res.json(await ContasStore.update(existente.id, lerConta(req.body || {}, existente)));
  }));

  // Ajustar saldo de conta manual (ex.: caixinha rendeu): lança a diferença como "ajuste"
  router.post('/financas/contas/:id/ajuste', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const conta = (await contasComSaldo()).find(c => c.id === req.params.id);
    if (!conta) throw new HttpError(404, 'Conta não encontrada.');
    if (conta.conectada) throw new HttpError(400, 'O saldo de uma conta conectada vem do banco.');
    const novoSaldo = Number(req.body?.saldo);
    if (!Number.isInteger(novoSaldo)) throw new HttpError(400, 'Informe o saldo em centavos.');
    const diferenca = novoSaldo - conta.saldo;
    if (diferenca === 0) return res.json({ success: true, diferenca: 0 });
    await TransacoesStore.create({
      contaId: conta.id, data: hojeNaCasa(), descricao: diferenca > 0 ? 'Ajuste de saldo (rendimento/correção)' : 'Ajuste de saldo (correção)',
      valor: diferenca, categoria: 'ajuste', categoriaManual: true, origem: 'manual'
    });
    res.json({ success: true, diferenca });
  }));

  // Apagar só sem lançamentos; com lançamentos, arquive (o histórico continua nos gráficos)
  router.delete('/financas/contas/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const conta = await ContasStore.findById(req.params.id);
    if (!conta) throw new HttpError(404, 'Conta não encontrada.');
    if ((await TransacoesStore.daConta(conta.id)).length) throw new HttpError(400, 'A conta tem lançamentos. Arquive em vez de apagar.');
    await ContasStore.remove(conta.id);
    res.json({ success: true });
  }));

  // ===== OPEN FINANCE =====
  router.get('/financas/provedores', exigirPermissao('financas:ver'), (req, res) => {
    res.json(listarProvedores());
  });

  router.get('/financas/conexoes', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    res.json(await ConexoesStore.list());
  }));

  router.post('/financas/conexoes', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const provedor = PROVEDORES[req.body?.provedor];
    if (!provedor || provedor.oculto?.()) throw new HttpError(400, 'Provedor desconhecido.');
    if (!provedor.configurado()) throw new HttpError(400, provedor.comoConfigurar);
    const { externoId, instituicao } = await provedor.conectar(req.body?.dados || {});
    const conexao = await ConexoesStore.create({ provedor: provedor.id, externoId, instituicao, status: 'ativa' });
    const resultado = await sincronizarConexao(conexao);
    res.status(201).json({ conexao: await ConexoesStore.findById(conexao.id), resultado });
  }));

  // Desconectar: as contas viram manuais (com o último saldo) e o histórico fica
  router.delete('/financas/conexoes/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const conexao = await ConexoesStore.findById(req.params.id);
    if (!conexao) throw new HttpError(404, 'Conexão não encontrada.');
    try {
      await PROVEDORES[conexao.provedor]?.desconectar?.(conexao);
    } catch (error) {
      // Mesmo se o provedor falhar, a conexão sai do app
      console.error('Erro ao desconectar no provedor:', error);
    }
    const contas = (await contasComSaldo()).filter(c => c.conexaoId === conexao.id);
    for (const conta of contas) {
      const soma = (await TransacoesStore.daConta(conta.id)).filter(t => !t.ignorada).reduce((s, t) => s + t.valor, 0);
      await ContasStore.update(conta.id, { conexaoId: null, saldoInformado: null, saldoInicial: conta.saldo - soma });
    }
    await ConexoesStore.update(conexao.id, { status: 'desconectada' });
    res.json({ success: true, contas: contas.length });
  }));

  router.post('/financas/conexoes/:id/sincronizar', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const conexao = await ConexoesStore.findById(req.params.id);
    if (!conexao || conexao.status === 'desconectada') throw new HttpError(404, 'Conexão não encontrada.');
    res.json(await sincronizarConexao(conexao));
  }));

  // Agendador diário (Vercel Cron faz GET) e botão "sincronizar tudo"
  router.get('/financas/sincronizar', exigirCronOuPermissao, asyncHandler(async (req, res) => {
    res.json(await sincronizarTudo());
  }));
  router.post('/financas/sincronizar', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    res.json(await sincronizarTudo());
  }));
}
