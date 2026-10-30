import { asyncHandler, HttpError } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { categoriaExiste } from '../../../core/categorias/index.js';
import { RegrasStore, OrcamentosStore, TransacoesStore } from '../store.js';
import { categorizar, normalizar, REGRAS_SUGERIDAS } from '../regras.js';
import { lerTexto, lerCategoria, ESCOPO_CATEGORIAS } from '../validacao.js';

// Recategoriza tudo o que não foi escolhido à mão, com o conjunto atual de regras
async function reaplicarRegras() {
  const regras = await RegrasStore.list();
  const mudancas = new Map();
  (await TransacoesStore.list()).filter(t => !t.categoriaManual).forEach(t => {
    const nova = categorizar(t.descricao, regras);
    if (nova && nova !== t.categoria) {
      if (!mudancas.has(nova)) mudancas.set(nova, []);
      mudancas.get(nova).push(t.id);
    }
  });
  let total = 0;
  for (const [categoria, ids] of mudancas) {
    await TransacoesStore.atualizarVarias(ids, { categoria });
    total += ids.length;
  }
  return total;
}

export default function rotasAjustes(router) {
  // ===== REGRAS DE CATEGORIA =====
  router.get('/financas/regras', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    res.json((await RegrasStore.list()).sort((a, b) => a.termo.localeCompare(b.termo, 'pt-BR')));
  }));

  router.post('/financas/regras', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const termo = lerTexto(req.body?.termo, 'o termo', 60, { obrigatorio: true });
    if (normalizar(termo).length < 3) throw new HttpError(400, 'Use um termo com pelo menos 3 letras.');
    const categoria = await lerCategoria(req.body?.categoria);
    if (!categoria) throw new HttpError(400, 'Escolha a categoria.');
    const existente = (await RegrasStore.list()).find(r => normalizar(r.termo) === normalizar(termo));
    const regra = existente
      ? await RegrasStore.update(existente.id, { categoria })
      : await RegrasStore.create({ termo, categoria });
    res.status(existente ? 200 : 201).json({ regra, atualizadas: await reaplicarRegras() });
  }));

  router.post('/financas/regras/sugeridas', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const atuais = new Set((await RegrasStore.list()).map(r => normalizar(r.termo)));
    const novas = [];
    for (const sugestao of REGRAS_SUGERIDAS) {
      if (!atuais.has(normalizar(sugestao.termo)) && await categoriaExiste(ESCOPO_CATEGORIAS, sugestao.categoria)) novas.push(sugestao);
    }
    await RegrasStore.createMany(novas);
    res.json({ criadas: novas.length, atualizadas: await reaplicarRegras() });
  }));

  router.delete('/financas/regras/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    if (!(await RegrasStore.findById(req.params.id))) throw new HttpError(404, 'Regra não encontrada.');
    await RegrasStore.remove(req.params.id);
    res.json({ success: true });
  }));

  // ===== ORÇAMENTOS =====
  router.get('/financas/orcamentos', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    res.json(await OrcamentosStore.list());
  }));

  // valorMensal em centavos; 0 remove o orçamento da categoria
  router.put('/financas/orcamentos/:categoria', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const categoria = await lerCategoria(req.params.categoria);
    if (!categoria) throw new HttpError(400, 'Categoria inválida.');
    const valor = Number(req.body?.valorMensal);
    if (!Number.isInteger(valor) || valor < 0 || valor > 1e10) throw new HttpError(400, 'Valor inválido (centavos).');
    await OrcamentosStore.definir(categoria, valor);
    res.json(await OrcamentosStore.list());
  }));
}
