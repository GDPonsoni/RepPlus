import { asyncHandler, HttpError } from '../../core/http.js';
import { categoriaExiste, categoriaPadrao } from '../../core/categorias/index.js';
import { exigirPermissao } from '../../core/auth/permissoes.js';
import { IntegrantesStore } from '../../core/moradores/store.js';
import { ComprasStore } from './store.js';

export const STATUS = ['falta', 'acabando', 'ok'];
const LIMITES = { nome: 60, quantidade: 30, observacao: 200 };

// Valida o corpo de criação/edição (campos ausentes não mudam)
async function lerItem(body, { criando = false } = {}) {
  const item = {};

  for (const campo of Object.keys(LIMITES)) {
    if (body[campo] === undefined) continue;
    const valor = body[campo] === null ? '' : String(body[campo]).trim().replace(/\s+/g, ' ');
    if (valor.length > LIMITES[campo]) throw new HttpError(400, `${campo} pode ter no máximo ${LIMITES[campo]} caracteres.`);
    item[campo] = valor || null;
  }
  if ((criando || body.nome !== undefined) && !item.nome) throw new HttpError(400, 'Diga o que precisa comprar.');

  if (body.categoria !== undefined) {
    if (!(await categoriaExiste('compras', body.categoria))) throw new HttpError(400, 'Categoria inválida.');
    item.categoria = body.categoria;
  }
  if (body.status !== undefined) {
    if (!STATUS.includes(body.status)) throw new HttpError(400, `Status inválido. Use: ${STATUS.join(', ')}.`);
    item.status = body.status;
  }
  if (body.pedidoPor !== undefined) {
    if (body.pedidoPor === null || body.pedidoPor === '') item.pedidoPor = null;
    else if (!(await IntegrantesStore.findById(body.pedidoPor))) throw new HttpError(400, 'Morador não encontrado.');
    else item.pedidoPor = body.pedidoPor;
  }
  return item;
}

// Ao entrar na lista (falta/acabando) marca quando foi pedido; ao voltar para "em casa", limpa o pedido
function ajustarPedido(item, existente = null) {
  if (item.status === undefined || item.status === existente?.status) return item;
  if (item.status === 'ok') {
    return { ...item, pedidoEm: null, pedidoPor: null, quantidade: null, observacao: item.observacao ?? null };
  }
  // falta <-> acabando mantém a data do pedido original
  if (existente && existente.status !== 'ok') return item;
  return { ...item, pedidoEm: new Date().toISOString() };
}

// Módulo: lista de compras da casa
export default {
  id: 'compras',
  nome: 'Lista de Compras',
  categorias: {
    compras: {
      nome: 'Itens de compra',
      permissaoVer: 'compras:ver', permissaoGerenciar: 'compras:editar',
      tabela: 'compras_itens', coluna: 'categoria',
      padrao: [
        { chave: 'mercado', nome: 'Mercado', cor: '#ea580c', icone: 'fa-solid fa-basket-shopping' },
        { chave: 'limpeza', nome: 'Limpeza', cor: '#0891b2', icone: 'fa-solid fa-spray-can-sparkles' },
        { chave: 'higiene', nome: 'Higiene', cor: '#9333ea', icone: 'fa-solid fa-pump-soap' },
        { chave: 'bebidas', nome: 'Bebidas', cor: '#2563eb', icone: 'fa-solid fa-bottle-water' },
        { chave: 'casa', nome: 'Casa', cor: '#65a30d', icone: 'fa-solid fa-house-chimney' },
        { chave: 'outros', nome: 'Outros', cor: '#6b7280', icone: 'fa-solid fa-box' }
      ]
    }
  },
  permissoes: {
    'compras:ver': { descricao: 'Ver a lista de compras', papeis: ['morador'] },
    'compras:editar': { descricao: 'Adicionar itens, avisar que está acabando e marcar como comprado', papeis: ['morador'] },
    'compras:gerenciar': { descricao: 'Apagar itens salvos da lista de compras', papeis: [] }
  },

  rotas(router) {
    router.get('/compras/itens', exigirPermissao('compras:ver'), asyncHandler(async (req, res) => {
      res.json(await ComprasStore.list());
    }));

    // Adicionar: se o item já existe (mesmo nome), reaproveita o registro e o coloca na lista
    router.post('/compras/itens', exigirPermissao('compras:editar'), asyncHandler(async (req, res) => {
      const dados = await lerItem(req.body || {}, { criando: true });
      dados.status = dados.status || 'falta';

      const existente = await ComprasStore.findByNome(dados.nome);
      if (existente) {
        const mudancas = { ...dados };
        delete mudancas.nome; // mantém a grafia já salva
        const atualizado = await ComprasStore.update(existente.id, ajustarPedido(mudancas, existente));
        return res.json({ ...atualizado, reaproveitado: true, jaEstavaNaLista: existente.status !== 'ok' });
      }

      const novo = await ComprasStore.create(ajustarPedido({ categoria: await categoriaPadrao('compras'), ...dados }));
      res.status(201).json(novo);
    }));

    router.put('/compras/itens/:id', exigirPermissao('compras:editar'), asyncHandler(async (req, res) => {
      const existente = await ComprasStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Item não encontrado.');

      const dados = await lerItem(req.body || {});
      if (dados.nome && await ComprasStore.findByNome(dados.nome, { excludeId: existente.id })) {
        throw new HttpError(400, 'Já existe um item com esse nome.');
      }
      res.json(await ComprasStore.update(existente.id, ajustarPedido(dados, existente)));
    }));

    // Comprei: volta para "em casa", guarda a data e conta a compra
    router.post('/compras/itens/:id/comprar', exigirPermissao('compras:editar'), asyncHandler(async (req, res) => {
      const existente = await ComprasStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Item não encontrado.');
      if (existente.status === 'ok') throw new HttpError(400, 'Esse item não está na lista.');

      res.json(await ComprasStore.update(existente.id, {
        status: 'ok',
        compradoEm: new Date().toISOString(),
        vezesComprado: existente.vezesComprado + 1,
        pedidoEm: null,
        pedidoPor: null,
        quantidade: null
      }));
    }));

    // Desfazer "comprei" (tocou sem querer): restaura o estado de antes, enviado pelo app
    router.post('/compras/itens/:id/desfazer-compra', exigirPermissao('compras:editar'), asyncHandler(async (req, res) => {
      const existente = await ComprasStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Item não encontrado.');
      const anterior = req.body?.anterior || {};
      if (!['falta', 'acabando'].includes(anterior.status)) throw new HttpError(400, 'Estado anterior inválido.');

      res.json(await ComprasStore.update(existente.id, {
        status: anterior.status,
        compradoEm: anterior.compradoEm ?? null,
        vezesComprado: Math.max(0, existente.vezesComprado - 1),
        pedidoEm: anterior.pedidoEm ?? new Date().toISOString(),
        pedidoPor: anterior.pedidoPor ?? null,
        quantidade: anterior.quantidade ?? null
      }));
    }));

    router.delete('/compras/itens/:id', exigirPermissao('compras:gerenciar'), asyncHandler(async (req, res) => {
      if (!(await ComprasStore.findById(req.params.id))) throw new HttpError(404, 'Item não encontrado.');
      await ComprasStore.remove(req.params.id);
      res.json({ success: true });
    }));
  }
};
