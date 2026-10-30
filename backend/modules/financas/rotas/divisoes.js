import { asyncHandler, HttpError } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../../core/db/helpers.js';
import { IntegrantesStore } from '../../../core/moradores/store.js';
import { DivisoesStore, TransacoesStore } from '../store.js';
import { lerTexto, lerCentavos, lerDia, lerCategoria } from '../validacao.js';

// Divisão de despesas: alguém pagou `valorTotal` e cada participante deve a sua parte a essa pessoa.
// A parte de quem pagou já nasce quitada.
async function lerDivisao(body, existente = null) {
  const d = {};
  if (!existente || body.descricao !== undefined) d.descricao = lerTexto(body.descricao, 'a descrição', 120, { obrigatorio: true });
  if (!existente || body.data !== undefined) d.data = lerDia(body.data, 'Data');
  if (!existente || body.valorTotal !== undefined) d.valorTotal = lerCentavos(body.valorTotal, 'Valor total', { positivo: true });
  if (body.categoria !== undefined) d.categoria = await lerCategoria(body.categoria);
  if (body.transacaoId !== undefined) {
    if (body.transacaoId && !(await TransacoesStore.findById(body.transacaoId))) throw new HttpError(400, 'Lançamento não encontrado.');
    d.transacaoId = body.transacaoId || null;
  }

  const ids = new Set((await IntegrantesStore.list()).map(i => String(i.id)));
  if (!existente || body.pagoPor !== undefined) {
    if (!ids.has(String(body.pagoPor))) throw new HttpError(400, 'Informe quem pagou.');
    d.pagoPor = String(body.pagoPor);
  }

  if (!existente || body.participantes !== undefined) {
    const lista = body.participantes;
    if (!Array.isArray(lista) || !lista.length) throw new HttpError(400, 'Escolha quem participa da divisão.');
    const vistos = new Set();
    const anteriores = new Map((existente?.participantes || []).map(p => [p.integranteId, p]));
    const pagoPor = d.pagoPor ?? existente.pagoPor;
    d.participantes = lista.map(p => {
      const id = String(p.integranteId);
      if (!ids.has(id) || vistos.has(id)) throw new HttpError(400, 'Participante inválido ou repetido.');
      vistos.add(id);
      const valor = lerCentavos(p.valor, 'Parte de cada um', { positivo: true });
      const anterior = anteriores.get(id);
      const pago = id === pagoPor || Boolean(anterior?.pago);
      return { integranteId: id, valor, pago, pagoEm: pago ? (anterior?.pagoEm || new Date().toISOString()) : null };
    });
  }

  const total = d.valorTotal ?? existente.valorTotal;
  const participantes = d.participantes ?? existente.participantes;
  const soma = participantes.reduce((s, p) => s + p.valor, 0);
  if (soma !== total) throw new HttpError(400, `As partes somam ${soma} centavos, mas o total é ${total}.`);
  return d;
}

export default function rotasDivisoes(router) {
  router.get('/financas/divisoes', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    res.json((await DivisoesStore.list()).sort((a, b) => b.data.localeCompare(a.data)));
  }));

  router.post('/financas/divisoes', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    res.status(201).json(await DivisoesStore.create(await lerDivisao(req.body || {})));
  }));

  router.put('/financas/divisoes/:id', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const existente = await DivisoesStore.findById(req.params.id);
    if (!existente) throw new HttpError(404, 'Divisão não encontrada.');
    res.json(await DivisoesStore.update(existente.id, await lerDivisao(req.body || {}, existente)));
  }));

  // Marcar a parte de alguém como paga (ou desfazer)
  router.put('/financas/divisoes/:id/participantes/:integranteId', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const divisao = await DivisoesStore.findById(req.params.id);
    if (!divisao) throw new HttpError(404, 'Divisão não encontrada.');
    if (!divisao.participantes.some(p => p.integranteId === req.params.integranteId)) throw new HttpError(404, 'Participante não encontrado.');
    const pago = normalizeBoolean(req.body?.pago, true);
    const participantes = divisao.participantes.map(p => (p.integranteId === req.params.integranteId
      ? { ...p, pago, pagoEm: pago ? new Date().toISOString() : null }
      : p));
    res.json(await DivisoesStore.update(divisao.id, { participantes }));
  }));

  // Acertar as contas entre duas pessoas: quita tudo o que uma deve à outra, nos dois sentidos
  router.post('/financas/acertos', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    const { de, para } = req.body || {};
    if (!de || !para || de === para) throw new HttpError(400, 'Informe as duas pessoas.');
    let quitadas = 0;
    for (const divisao of await DivisoesStore.list()) {
      const entre = (p) => !p.pago && ((p.integranteId === de && divisao.pagoPor === para) || (p.integranteId === para && divisao.pagoPor === de));
      if (!divisao.participantes.some(entre)) continue;
      const participantes = divisao.participantes.map(p => {
        if (!entre(p)) return p;
        quitadas++;
        return { ...p, pago: true, pagoEm: new Date().toISOString() };
      });
      await DivisoesStore.update(divisao.id, { participantes });
    }
    res.json({ success: true, quitadas });
  }));

  router.delete('/financas/divisoes/:id', exigirPermissao('financas:lancar'), asyncHandler(async (req, res) => {
    if (!(await DivisoesStore.findById(req.params.id))) throw new HttpError(404, 'Divisão não encontrada.');
    await DivisoesStore.remove(req.params.id);
    res.json({ success: true });
  }));
}
