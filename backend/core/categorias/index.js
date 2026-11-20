import { asyncHandler, HttpError } from '../http.js';
import { exigirPermissao, temPermissao } from '../auth/permissoes.js';
import { modulosDesativados } from '../modulos.js';
import { CategoriasStore } from './store.js';

// Categorias gerenciáveis (núcleo). Um módulo declara os seus escopos assim:
//
//   categorias: {
//     compras: {
//       nome: 'Itens de compra',
//       permissaoVer: 'compras:ver', permissaoGerenciar: 'compras:editar',
//       tabela: 'compras_itens', coluna: 'categoria', filtro: { tipo: 'conta' }?,   // onde a chave é usada
//       padrao: [{ chave: 'mercado', nome: 'Mercado', cor: '#ea580c', icone: 'fa-solid fa-basket-shopping' }],
//       subcategorias: true?   // permite categorias dentro de outras (um nível): { ..., pai: 'mercado' }
//     }
//   }
//
// Na primeira leitura de um escopo vazio, entram as categorias padrão e também os valores
// já usados nos registros (assim dados antigos ganham uma categoria editável).

const escopos = new Map();

export function registrarCategorias(moduloId, definicoes = {}) {
  for (const [escopo, definicao] of Object.entries(definicoes)) {
    if (escopos.has(escopo)) throw new Error(`Escopo de categorias duplicado: ${escopo}`);
    escopos.set(escopo, { ...definicao, escopo, modulo: moduloId });
  }
}

const COR_REGEX = /^#[0-9a-fA-F]{6}$/;
const ICONE_REGEX = /^fa-(solid|regular|brands) fa-[a-z0-9-]+$/;
const COR_PADRAO = '#6b7280';
const ICONE_PADRAO = 'fa-solid fa-tag';
const LIMITE_NOME = 30;
const LIMITE_POR_ESCOPO = 40;
const LIMITE_COM_SUBCATEGORIAS = 80;

const semAcento = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
const paraChave = (nome) => semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'categoria';

async function definicaoAtiva(escopo) {
  const definicao = escopos.get(escopo);
  if (!definicao || (await modulosDesativados()).includes(definicao.modulo)) throw new HttpError(404, 'Grupo de categorias não encontrado.');
  return definicao;
}

// Lista do escopo, criando as padrão (e as já usadas nos registros) na primeira vez
export async function listarCategorias(escopo) {
  const definicao = escopos.get(escopo);
  const atuais = await CategoriasStore.list(escopo);
  if (atuais.length || !definicao) return atuais;

  const padrao = definicao.padrao || [];
  const emUso = (await CategoriasStore.valoresEmUso(definicao)).filter(valor => !padrao.some(p => p.chave === valor));
  const novas = [
    ...padrao,
    ...emUso.map(valor => ({ chave: valor, nome: String(valor).slice(0, LIMITE_NOME), cor: COR_PADRAO, icone: ICONE_PADRAO }))
  ].map((categoria, ordem) => ({ ...categoria, escopo, ordem }));
  if (!novas.length) return [];
  try {
    await CategoriasStore.createMany(novas);
  } catch (error) {
    // Outra requisição criou ao mesmo tempo (chave única): basta reler
    console.error('Categorias padrão já criadas por outra requisição:', error.message);
  }
  return CategoriasStore.list(escopo);
}

// Para os módulos validarem o que recebem
export async function categoriaExiste(escopo, chave) {
  return (await listarCategorias(escopo)).some(categoria => categoria.chave === chave);
}

export async function categoriaPadrao(escopo) {
  return (await listarCategorias(escopo))[0]?.chave ?? null;
}

// Categoria principal válida para ser `pai` (do mesmo grupo e que não é subcategoria)
function lerPai(body, definicao, atuais, existente = null) {
  if (body.pai === undefined) return undefined;
  const pai = body.pai || null;
  if (!pai) return null;
  if (!definicao.subcategorias) throw new HttpError(400, 'Este grupo não tem subcategorias.');
  const principal = atuais.find(c => c.chave === pai);
  if (!principal || principal.pai) throw new HttpError(400, 'Escolha uma categoria principal.');
  if (existente && (principal.id === existente.id || atuais.some(c => c.pai === existente.chave))) {
    throw new HttpError(400, 'Uma categoria com subcategorias não pode ficar dentro de outra.');
  }
  return pai;
}

function lerCategoria(body, { criando = false } = {}) {
  const dados = {};
  if (criando || body.nome !== undefined) {
    const nome = String(body.nome ?? '').trim();
    if (!nome) throw new HttpError(400, 'Dê um nome para a categoria.');
    if (nome.length > LIMITE_NOME) throw new HttpError(400, `O nome pode ter no máximo ${LIMITE_NOME} caracteres.`);
    dados.nome = nome;
  }
  if (criando || body.cor !== undefined) {
    if (!COR_REGEX.test(String(body.cor ?? ''))) throw new HttpError(400, 'Cor inválida. Use #RRGGBB.');
    dados.cor = body.cor.toLowerCase();
  }
  if (criando || body.icone !== undefined) {
    if (!ICONE_REGEX.test(String(body.icone ?? ''))) throw new HttpError(400, 'Ícone inválido.');
    dados.icone = body.icone;
  }
  return dados;
}

const exigirDoEscopo = (tipo) => asyncHandler(async (req, res, next) => {
  const definicao = await definicaoAtiva(req.params.escopo);
  exigirPermissao(tipo === 'ver' ? definicao.permissaoVer : definicao.permissaoGerenciar)(req, res, next);
});

export default {
  id: 'categorias',
  nome: 'Categorias',
  nucleo: true,
  permissoes: {},

  rotas(router) {
    // Escopos que esta pessoa pode ver (só de módulos ligados), para a tela de Ajustes
    router.get('/categorias', asyncHandler(async (req, res) => {
      const desativados = await modulosDesativados();
      res.json([...escopos.values()]
        .filter(d => !desativados.includes(d.modulo) && temPermissao(req.contexto, d.permissaoVer))
        .map(d => ({ escopo: d.escopo, nome: d.nome, modulo: d.modulo, subcategorias: Boolean(d.subcategorias), podeGerenciar: temPermissao(req.contexto, d.permissaoGerenciar) })));
    }));

    router.get('/categorias/:escopo', exigirDoEscopo('ver'), asyncHandler(async (req, res) => {
      res.json(await listarCategorias(req.params.escopo));
    }));

    router.post('/categorias/:escopo', exigirDoEscopo('gerenciar'), asyncHandler(async (req, res) => {
      const { escopo } = req.params;
      const definicao = escopos.get(escopo);
      const dados = lerCategoria(req.body || {}, { criando: true });
      const atuais = await listarCategorias(escopo);
      const limite = definicao.subcategorias ? LIMITE_COM_SUBCATEGORIAS : LIMITE_POR_ESCOPO;
      if (atuais.length >= limite) throw new HttpError(400, `Máximo de ${limite} categorias por grupo.`);
      const pai = lerPai(req.body || {}, definicao, atuais);
      if (pai) dados.pai = pai;
      if (atuais.some(c => semAcento(c.nome).toLowerCase() === semAcento(dados.nome).toLowerCase())) throw new HttpError(400, 'Já existe uma categoria com esse nome.');

      // Chave estável a partir do nome (não muda se a categoria for renomeada depois)
      let chave = paraChave(dados.nome);
      for (let n = 2; atuais.some(c => c.chave === chave); n++) chave = `${paraChave(dados.nome)}-${n}`;
      const [criada] = await CategoriasStore.createMany([{ ...dados, escopo, chave, ordem: Math.max(-1, ...atuais.map(c => c.ordem)) + 1 }]);
      res.status(201).json(criada);
    }));

    // Nova ordem: lista de ids na ordem desejada (antes de /:id, senão "ordem" seria lido como id)
    router.put('/categorias/:escopo/ordem', exigirDoEscopo('gerenciar'), asyncHandler(async (req, res) => {
      const ids = req.body?.ids;
      const atuais = await listarCategorias(req.params.escopo);
      if (!Array.isArray(ids) || ids.length !== atuais.length || !atuais.every(c => ids.includes(c.id))) {
        throw new HttpError(400, 'Envie todos os ids do grupo, na nova ordem.');
      }
      await Promise.all(ids.map((id, ordem) => CategoriasStore.update(id, { ordem })));
      res.json(await CategoriasStore.list(req.params.escopo));
    }));

    router.put('/categorias/:escopo/:id', exigirDoEscopo('gerenciar'), asyncHandler(async (req, res) => {
      const existente = await CategoriasStore.findById(req.params.id);
      if (!existente || existente.escopo !== req.params.escopo) throw new HttpError(404, 'Categoria não encontrada.');
      const dados = lerCategoria(req.body || {});
      const atuais = await listarCategorias(existente.escopo);
      if (dados.nome) {
        const outras = atuais.filter(c => c.id !== existente.id);
        if (outras.some(c => semAcento(c.nome).toLowerCase() === semAcento(dados.nome).toLowerCase())) throw new HttpError(400, 'Já existe uma categoria com esse nome.');
      }
      const pai = lerPai(req.body || {}, escopos.get(existente.escopo), atuais, existente);
      if (pai !== undefined) dados.pai = pai;
      res.json(await CategoriasStore.update(existente.id, dados));
    }));

    // Apagar: se estiver em uso, os registros passam para a categoria `substituta`
    router.delete('/categorias/:escopo/:id', exigirDoEscopo('gerenciar'), asyncHandler(async (req, res) => {
      const definicao = escopos.get(req.params.escopo);
      const existente = await CategoriasStore.findById(req.params.id);
      if (!existente || existente.escopo !== definicao.escopo) throw new HttpError(404, 'Categoria não encontrada.');
      const atuais = await listarCategorias(definicao.escopo);
      if (atuais.length <= 1) throw new HttpError(400, 'O grupo precisa ter pelo menos uma categoria.');
      const filhas = atuais.filter(c => c.pai === existente.chave);
      if (filhas.length) throw new HttpError(400, `"${existente.nome}" tem ${filhas.length} subcategoria(s). Exclua ou mova as subcategorias antes.`);

      const emUso = await CategoriasStore.contarUso(definicao, existente.chave);
      const substituta = req.query.substituta;
      if (emUso) {
        if (!substituta) throw new HttpError(409, `${emUso} registro(s) usam esta categoria. Escolha para qual categoria eles vão.`, { emUso });
        if (substituta === existente.chave || !atuais.some(c => c.chave === substituta)) throw new HttpError(400, 'Categoria substituta inválida.');
        await CategoriasStore.substituir(definicao, existente.chave, substituta);
      }
      await CategoriasStore.remove(existente.id);
      res.json({ success: true, movidos: emUso });
    }));
  }
};
