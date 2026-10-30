import { asyncHandler, HttpError } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../../core/db/helpers.js';
import { ContasStore, TransacoesStore, RegrasStore } from '../store.js';
import { categorizar } from '../regras.js';
import { lerTexto, lerCentavos, lerDia, lerCategoria, diaValido, hojeNaCasa, CATEGORIAS_NEUTRAS } from '../validacao.js';

const MAXIMO_DIAS_CONSULTA = 400;
const DIA_MS = 86400000;

// Primeiro dia do mês `n` meses antes de 'AAAA-MM'
function mesAnterior(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, m - 1 - n, 1)).toISOString().slice(0, 7);
}

// Campos editáveis: lançamento manual muda tudo; importado do banco só categoria, observação e "ignorar"
async function lerTransacao(body, existente = null) {
  const t = {};
  const manual = !existente || existente.origem === 'manual';
  const camposDoBanco = ['contaId', 'data', 'descricao', 'valor'].filter(campo => body[campo] !== undefined);
  if (!manual && camposDoBanco.length) throw new HttpError(400, 'Lançamentos importados do banco só mudam categoria, observação ou "ignorar".');

  if (!existente || body.contaId !== undefined) {
    const conta = await ContasStore.findById(body.contaId);
    if (!conta) throw new HttpError(400, 'Conta não encontrada.');
    if (conta.conexaoId) throw new HttpError(400, 'Contas conectadas recebem lançamentos do banco; use uma conta manual.');
    t.contaId = conta.id;
  }
  if (!existente || body.data !== undefined) t.data = lerDia(body.data, 'Data');
  if (!existente || body.descricao !== undefined) t.descricao = lerTexto(body.descricao, 'a descrição', 120, { obrigatorio: true });
  if (!existente || body.valor !== undefined) t.valor = lerCentavos(body.valor, 'Valor');
  if (body.observacao !== undefined) t.observacao = lerTexto(body.observacao, 'a observação', 300);
  if (body.ignorada !== undefined) t.ignorada = normalizeBoolean(body.ignorada, false);
  // Escolher categoria à mão "trava" o lançamento: as regras não mexem mais nele
  if (body.categoria !== undefined) {
    t.categoria = await lerCategoria(body.categoria);
    t.categoriaManual = Boolean(t.categoria);
  }
  return t;
}

export default function rotasLancamentos(router) {
  // ?de=AAAA-MM-DD&ate=AAAA-MM-DD (ate exclusivo)
  router.get('/financas/transacoes', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    const { de, ate } = req.query;
    if (!diaValido(de) || !diaValido(ate) || ate <= de) throw new HttpError(400, 'Informe de e ate (AAAA-MM-DD).');
    if ((Date.parse(ate) - Date.parse(de)) / DIA_MS > MAXIMO_DIAS_CONSULTA) throw new HttpError(400, `Período máximo de ${MAXIMO_DIAS_CONSULTA} dias.`);
    const lista = await TransacoesStore.periodo(de, ate);
    res.json(lista.sort((a, b) => b.data.localeCompare(a.data) || String(b.criadoEm).localeCompare(String(a.criadoEm))));
  }));

  router.post('/financas/transacoes', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const t = await lerTransacao(req.body || {});
    // Sem categoria escolhida: tenta pelas regras
    if (!t.categoria) t.categoria = categorizar(t.descricao, await RegrasStore.list());
    res.status(201).json(await TransacoesStore.create({ ...t, origem: 'manual' }));
  }));

  router.put('/financas/transacoes/:id', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const existente = await TransacoesStore.findById(req.params.id);
    if (!existente) throw new HttpError(404, 'Lançamento não encontrado.');
    const t = await lerTransacao(req.body || {}, existente);
    // Tirou a categoria: volta a valer o que as regras disserem
    if (t.categoria === null) t.categoria = categorizar(t.descricao ?? existente.descricao, await RegrasStore.list());
    res.json(await TransacoesStore.update(existente.id, t));
  }));

  // Importados não são apagados (voltariam na próxima sincronização): use "ignorar"
  router.delete('/financas/transacoes/:id', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const existente = await TransacoesStore.findById(req.params.id);
    if (!existente) throw new HttpError(404, 'Lançamento não encontrado.');
    if (existente.origem !== 'manual') throw new HttpError(400, 'Lançamentos do banco não são apagados: marque como "ignorar".');
    await TransacoesStore.remove(existente.id);
    res.json({ success: true });
  }));

  // Resumo mensal para gráficos: ?meses=6&ate=AAAA-MM (último mês, inclusive)
  router.get('/financas/resumo', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    const quantos = Math.min(Math.max(Number(req.query.meses) || 6, 1), 24);
    const ultimo = /^\d{4}-\d{2}$/.test(String(req.query.ate)) ? req.query.ate : hojeNaCasa().slice(0, 7);
    const meses = Array.from({ length: quantos }, (_, i) => mesAnterior(ultimo, quantos - 1 - i));
    const de = `${meses[0]}-01`;
    const ate = `${mesAnterior(ultimo, -1)}-01`;

    const porMes = new Map(meses.map(mes => [mes, { mes, entradas: 0, saidas: 0, porCategoria: {} }]));
    (await TransacoesStore.periodo(de, ate))
      .filter(t => !t.ignorada && !CATEGORIAS_NEUTRAS.includes(t.categoria))
      .forEach(t => {
        const resumo = porMes.get(t.data.slice(0, 7));
        if (!resumo) return;
        if (t.valor > 0) resumo.entradas += t.valor;
        else {
          resumo.saidas += -t.valor;
          const chave = t.categoria || '';
          resumo.porCategoria[chave] = (resumo.porCategoria[chave] || 0) - t.valor;
        }
      });
    res.json([...porMes.values()]);
  }));
}
