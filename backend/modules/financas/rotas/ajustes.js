import { asyncHandler, HttpError } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { categoriaExiste } from '../../../core/categorias/index.js';
import { RegrasStore, OrcamentosStore, TransacoesStore } from '../store.js';
import { categorizar, normalizar, regraBate, regraQueVence, sentidoDe, termoDoGrupo, REGRAS_SUGERIDAS } from '../regras.js';
import { lerTexto, lerCategoria, ESCOPO_CATEGORIAS } from '../validacao.js';

const SENTIDOS = ['saida', 'entrada'];

// Recategoriza tudo o que não foi escolhido à mão, com o conjunto atual de regras
// (inclusive tirando a categoria de quem deixou de bater em alguma regra)
async function reaplicarRegras() {
  const regras = await RegrasStore.list();
  const mudancas = new Map();
  (await TransacoesStore.list()).filter(t => !t.categoriaManual).forEach(t => {
    const nova = categorizar(t, regras);
    if (nova !== (t.categoria ?? null)) {
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

async function lerRegra(body) {
  const termo = lerTexto(body?.termo, 'o termo', 60, { obrigatorio: true });
  if (normalizar(termo).length < 3) throw new HttpError(400, 'Use um termo com pelo menos 3 letras.');
  const categoria = await lerCategoria(body?.categoria);
  if (!categoria) throw new HttpError(400, 'Escolha a categoria.');
  const sentido = body?.sentido || null;
  if (sentido && !SENTIDOS.includes(sentido)) throw new HttpError(400, 'Sentido inválido. Use saida, entrada ou deixe vazio.');
  return { termo, categoria, sentido };
}

const mesmaRegra = (a, b) => normalizar(a.termo) === normalizar(b.termo) && (a.sentido || null) === (b.sentido || null);
const exemplo = ({ id, descricao, data, valor, categoria }) => ({ id, descricao, data, valor, categoria });

export default function rotasAjustes(router) {
  // ===== REGRAS DE CATEGORIA =====
  // Cada regra vem com quantos lançamentos ela categoriza hoje (os escolhidos à mão não contam)
  router.get('/financas/regras', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    const [regras, transacoes] = await Promise.all([RegrasStore.list(), TransacoesStore.list()]);
    const usos = new Map();
    transacoes.filter(t => !t.categoriaManual && !t.ignorada).forEach(t => {
      const regra = regraQueVence(t, regras);
      if (regra) usos.set(regra.id, (usos.get(regra.id) || 0) + 1);
    });
    res.json(regras
      .map(regra => ({ ...regra, quantidade: usos.get(regra.id) || 0 }))
      .sort((a, b) => a.termo.localeCompare(b.termo, 'pt-BR')));
  }));

  // Mesmo termo e sentido de uma regra existente: só troca a categoria
  router.post('/financas/regras', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const nova = await lerRegra(req.body);
    const existente = (await RegrasStore.list()).find(r => mesmaRegra(r, nova));
    const regra = existente
      ? await RegrasStore.update(existente.id, { categoria: nova.categoria })
      : await RegrasStore.create(nova);
    res.status(existente ? 200 : 201).json({ regra, atualizadas: await reaplicarRegras() });
  }));

  router.put('/financas/regras/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const atual = await RegrasStore.findById(req.params.id);
    if (!atual) throw new HttpError(404, 'Regra não encontrada.');
    const mudanca = await lerRegra(req.body);
    if ((await RegrasStore.list()).some(r => r.id !== atual.id && mesmaRegra(r, mudanca))) throw new HttpError(400, 'Já existe uma regra com esse termo.');
    const regra = await RegrasStore.update(atual.id, mudanca);
    res.json({ regra, atualizadas: await reaplicarRegras() });
  }));

  // Prévia antes de salvar: o que a regra pegaria, quanto muda e o que outra regra mais específica segura
  router.post('/financas/regras/previa', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    const termo = normalizar(req.body?.termo);
    if (termo.length < 3) return res.json({ quantidade: 0, total: 0, mudam: 0, manuais: 0, outrasRegras: 0, exemplos: [] });
    const sentido = SENTIDOS.includes(req.body?.sentido) ? req.body.sentido : null;
    const candidata = { id: '__previa__', termo, sentido, categoria: req.body?.categoria || null };
    const [regras, transacoes] = await Promise.all([RegrasStore.list(), TransacoesStore.list()]);
    const conjunto = [...regras.filter(r => r.id !== req.body?.ignorarId && !mesmaRegra(r, candidata)), candidata];
    const batem = transacoes.filter(t => !t.ignorada && regraBate(candidata, normalizar(t.descricao), t.valor));
    const vence = batem.filter(t => !t.categoriaManual && regraQueVence(t, conjunto)?.id === candidata.id);
    res.json({
      quantidade: batem.length,
      total: batem.reduce((s, t) => s + t.valor, 0),
      mudam: vence.filter(t => t.categoria !== candidata.categoria).length,
      manuais: batem.filter(t => t.categoriaManual).length,
      outrasRegras: batem.length - vence.length - batem.filter(t => t.categoriaManual).length,
      exemplos: batem.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8).map(exemplo)
    });
  }));

  // Lançamentos parecidos ainda sem categoria, agrupados pelo começo da descrição: cada grupo
  // vira uma sugestão de regra (com a categoria que a casa já usou à mão para algo parecido)
  router.get('/financas/regras/sugestoes', exigirPermissao('financas:ver'), asyncHandler(async (req, res) => {
    const transacoes = (await TransacoesStore.list()).filter(t => !t.ignorada);
    const usadaAMao = new Map();
    transacoes.filter(t => t.categoriaManual && t.categoria).forEach(t => {
      const termo = termoDoGrupo(t.descricao);
      if (termo) usadaAMao.set(termo, t.categoria);
    });
    const grupos = new Map();
    transacoes.filter(t => !t.categoria).forEach(t => {
      const termo = termoDoGrupo(t.descricao);
      if (!termo) return;
      if (!grupos.has(termo)) grupos.set(termo, { termo, quantidade: 0, total: 0, sentidos: new Set(), exemplos: [] });
      const grupo = grupos.get(termo);
      grupo.quantidade++;
      grupo.total += t.valor;
      grupo.sentidos.add(sentidoDe(t.valor));
      if (grupo.exemplos.length < 3) grupo.exemplos.push(exemplo(t));
    });
    res.json([...grupos.values()]
      .map(({ sentidos, ...grupo }) => ({
        ...grupo,
        sentido: sentidos.size === 1 ? [...sentidos][0] : null,
        categoriaSugerida: usadaAMao.get(grupo.termo) || null
      }))
      .sort((a, b) => b.quantidade - a.quantidade || Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 40));
  }));

  router.post('/financas/regras/sugeridas', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    const atuais = await RegrasStore.list();
    const novas = [];
    for (const sugestao of REGRAS_SUGERIDAS) {
      if (!atuais.some(r => normalizar(r.termo) === normalizar(sugestao.termo)) && await categoriaExiste(ESCOPO_CATEGORIAS, sugestao.categoria)) novas.push(sugestao);
    }
    await RegrasStore.createMany(novas);
    res.json({ criadas: novas.length, atualizadas: await reaplicarRegras() });
  }));

  router.delete('/financas/regras/:id', exigirPermissao('financas:gerenciar'), asyncHandler(async (req, res) => {
    if (!(await RegrasStore.findById(req.params.id))) throw new HttpError(404, 'Regra não encontrada.');
    await RegrasStore.remove(req.params.id);
    res.json({ success: true, atualizadas: await reaplicarRegras() });
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
