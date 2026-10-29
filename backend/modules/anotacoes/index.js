import { createHash, timingSafeEqual } from 'crypto';
import { asyncHandler, HttpError } from '../../core/http.js';
import { exigirPermissao } from '../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../core/db/helpers.js';
import { AnotacoesStore, CofreStore } from './store.js';

export const TIPOS = ['conta', 'contato', 'nota'];
export const CATEGORIAS_CONTA = ['internet', 'streaming', 'consumo', 'banco', 'compras', 'outros'];

// Campos abertos (`dados`) aceitos por tipo, com o limite de caracteres. Booleanos à parte.
const CAMPOS_DADOS = {
  conta: { site: 200, observacao: 500 },
  contato: { telefone: 30, email: 120, site: 200, endereco: 200, observacao: 500 },
  nota: { texto: 5000 }
};
const BOOLEANOS_DADOS = { contato: ['whatsapp'] };

// Texto cifrado no navegador: "v1.<iv base64>.<conteúdo base64>"
const CIFRADO_REGEX = /^v1\.[A-Za-z0-9+/=]{16,}\.[A-Za-z0-9+/=]+$/;
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;
const LIMITE_SEGREDO = 20000;

const hashProva = (prova) => createHash('sha256').update(String(prova)).digest('hex');

// Quem destrancou o cofre consegue calcular a prova; sem ela, ninguém troca a senha nem grava segredos
function conferirProva(cofre, prova) {
  if (!cofre) throw new HttpError(400, 'Crie o cofre antes de guardar senhas.');
  const esperado = Buffer.from(cofre.verificadorHash, 'hex');
  const recebido = Buffer.from(hashProva(prova || ''), 'hex');
  if (!prova || esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    throw new HttpError(403, 'Cofre trancado ou senha do cofre desatualizada. Destranque de novo.');
  }
}

function lerDados(tipo, dados = {}) {
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) throw new HttpError(400, 'dados deve ser um objeto.');
  const limpos = {};
  for (const [campo, limite] of Object.entries(CAMPOS_DADOS[tipo])) {
    const valor = String(dados[campo] ?? '').trim();
    if (valor.length > limite) throw new HttpError(400, `${campo} pode ter no máximo ${limite} caracteres.`);
    if (valor) limpos[campo] = valor;
  }
  for (const campo of BOOLEANOS_DADOS[tipo] || []) {
    if (dados[campo] !== undefined) limpos[campo] = normalizeBoolean(dados[campo], false);
  }
  return limpos;
}

// Valida criação/edição. Em edição, campos ausentes mantêm o valor atual.
async function lerAnotacao(body, existente = null) {
  const anotacao = {};
  const tipo = existente?.tipo ?? body.tipo;
  if (!TIPOS.includes(tipo)) throw new HttpError(400, `Tipo inválido. Use: ${TIPOS.join(', ')}.`);
  if (!existente) anotacao.tipo = tipo;

  if (!existente || body.titulo !== undefined) {
    const titulo = String(body.titulo ?? '').trim();
    if (!titulo) throw new HttpError(400, 'Dê um título.');
    if (titulo.length > 80) throw new HttpError(400, 'O título pode ter no máximo 80 caracteres.');
    anotacao.titulo = titulo;
  }

  if (body.categoria !== undefined) {
    const categoria = String(body.categoria ?? '').trim() || null;
    if (tipo === 'conta' && categoria && !CATEGORIAS_CONTA.includes(categoria)) {
      throw new HttpError(400, `Categoria inválida. Use: ${CATEGORIAS_CONTA.join(', ')}.`);
    }
    if (categoria && categoria.length > 40) throw new HttpError(400, 'A categoria pode ter no máximo 40 caracteres.');
    anotacao.categoria = categoria;
  }

  if (body.dados !== undefined) anotacao.dados = lerDados(tipo, body.dados);
  if (body.fixado !== undefined) anotacao.fixado = normalizeBoolean(body.fixado, false);

  // Qualquer mudança no segredo (gravar ou remover) exige o cofre destrancado
  if (body.segredo !== undefined) {
    const segredo = body.segredo || null;
    if (segredo && (segredo.length > LIMITE_SEGREDO || !CIFRADO_REGEX.test(segredo))) {
      throw new HttpError(400, 'Segredo em formato inválido.');
    }
    if (segredo || existente?.segredo) conferirProva(await CofreStore.get(), body.provaCofre);
    anotacao.segredo = segredo;
  }
  return anotacao;
}

function lerCofre(body) {
  const { salt, iteracoes, chaveCifrada } = body || {};
  if (typeof salt !== 'string' || !BASE64_REGEX.test(salt) || salt.length > 100) throw new HttpError(400, 'salt inválido.');
  if (!Number.isInteger(iteracoes) || iteracoes < 100000 || iteracoes > 5000000) throw new HttpError(400, 'iteracoes inválido.');
  if (typeof chaveCifrada !== 'string' || !CIFRADO_REGEX.test(chaveCifrada) || chaveCifrada.length > 500) throw new HttpError(400, 'chaveCifrada inválida.');
  return { salt, iteracoes, chaveCifrada };
}

// Módulo: anotações da casa (senhas no cofre, contatos de prestadores, notas)
export default {
  id: 'anotacoes',
  nome: 'Anotações',
  permissoes: {
    'anotacoes:ver': { descricao: 'Ver contas, contatos e notas (senhas só com a senha do cofre)', papeis: ['morador'] },
    'anotacoes:editar': { descricao: 'Criar, editar e apagar contas, contatos e notas', papeis: ['morador'] },
    'anotacoes:cofre': { descricao: 'Criar o cofre, trocar a senha do cofre ou apagá-lo', papeis: [] }
  },

  rotas(router) {
    // ===== COFRE ===== (antes de /anotacoes/:id, senão "cofre" seria lido como id)
    // O navegador precisa do salt e da chave cifrada para destrancar com a senha
    router.get('/anotacoes/cofre', exigirPermissao('anotacoes:ver'), asyncHandler(async (req, res) => {
      const cofre = await CofreStore.get();
      res.json(cofre ? { existe: true, salt: cofre.salt, iteracoes: cofre.iteracoes, chaveCifrada: cofre.chaveCifrada } : { existe: false });
    }));

    router.post('/anotacoes/cofre', exigirPermissao('anotacoes:cofre'), asyncHandler(async (req, res) => {
      if (await CofreStore.get()) throw new HttpError(409, 'O cofre já existe. Para trocar a senha, destranque-o primeiro.');
      const prova = req.body?.prova;
      if (typeof prova !== 'string' || !BASE64_REGEX.test(prova)) throw new HttpError(400, 'prova inválida.');
      await CofreStore.save({ ...lerCofre(req.body), verificadorHash: hashProva(prova) });
      res.status(201).json({ success: true });
    }));

    // Trocar a senha: a chave dos segredos é a mesma, só muda a senha que a protege
    router.put('/anotacoes/cofre', exigirPermissao('anotacoes:cofre'), asyncHandler(async (req, res) => {
      const cofre = await CofreStore.get();
      conferirProva(cofre, req.body?.prova);
      await CofreStore.save({ ...lerCofre(req.body), verificadorHash: cofre.verificadorHash });
      res.json({ success: true });
    }));

    // Esqueceram a senha: apaga o cofre e os segredos (que ficariam ilegíveis de qualquer jeito)
    router.delete('/anotacoes/cofre', exigirPermissao('anotacoes:cofre'), asyncHandler(async (req, res) => {
      const apagados = await AnotacoesStore.limparSegredos();
      await CofreStore.remove();
      res.json({ success: true, segredosApagados: apagados });
    }));

    // ===== ANOTAÇÕES =====
    router.get('/anotacoes', exigirPermissao('anotacoes:ver'), asyncHandler(async (req, res) => {
      res.json(await AnotacoesStore.list());
    }));

    router.post('/anotacoes', exigirPermissao('anotacoes:editar'), asyncHandler(async (req, res) => {
      const anotacao = await lerAnotacao(req.body || {});
      res.status(201).json(await AnotacoesStore.create({ dados: {}, ...anotacao }));
    }));

    router.put('/anotacoes/:id', exigirPermissao('anotacoes:editar'), asyncHandler(async (req, res) => {
      const existente = await AnotacoesStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Anotação não encontrada.');
      res.json(await AnotacoesStore.update(existente.id, await lerAnotacao(req.body || {}, existente)));
    }));

    router.delete('/anotacoes/:id', exigirPermissao('anotacoes:editar'), asyncHandler(async (req, res) => {
      if (!(await AnotacoesStore.findById(req.params.id))) throw new HttpError(404, 'Anotação não encontrada.');
      await AnotacoesStore.remove(req.params.id);
      res.json({ success: true });
    }));
  }
};
