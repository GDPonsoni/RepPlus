import { asyncHandler, upload } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeNumber } from '../../../core/db/helpers.js';
import { uploadImage, deleteImage } from '../../../core/storage.js';
import { ComodosStore, EscalasStore } from '../store.js';

export const sortByOrderThenName = (a, b) => {
  const orderDiff = normalizeNumber(a.ordem, 0) - normalizeNumber(b.ordem, 0);
  if (orderDiff !== 0) return orderDiff;
  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
};

function validarComodoPayload(body, { parcial = false } = {}) {
  const erros = [];
  if (!parcial || body.nome !== undefined) {
    if (!body.nome || !String(body.nome).trim()) {
      erros.push('O nome do cômodo é obrigatório.');
    }
  }
  if (body.pessoasNecessarias !== undefined) {
    const pessoas = Number(body.pessoasNecessarias);
    if (!Number.isFinite(pessoas) || pessoas < 1 || pessoas > 10) {
      erros.push('pessoasNecessarias deve ser um número entre 1 e 10.');
    }
  }
  if (body.ordem !== undefined) {
    const ordem = Number(body.ordem);
    if (!Number.isInteger(ordem) || ordem < 0) {
      erros.push('ordem deve ser um número inteiro maior ou igual a 0.');
    }
  }
  return erros;
}

// O rodízio identifica cômodos pelo nome, então dois cômodos não podem ter o mesmo
const comodoComMesmoNome = async (nome, excludeId) => {
  const alvo = String(nome).trim().toLowerCase();
  return (await ComodosStore.list()).find(comodo =>
    String(comodo.nome || '').trim().toLowerCase() === alvo && String(comodo.id) !== String(excludeId)
  ) || null;
};

export function rotasComodos(router) {
  router.get('/comodos', exigirPermissao('escala:ver'), asyncHandler(async (req, res) => {
    res.json((await ComodosStore.list()).sort(sortByOrderThenName));
  }));

  router.post('/comodos', exigirPermissao('comodos:gerenciar'), asyncHandler(async (req, res) => {
    const erros = validarComodoPayload(req.body, { parcial: false });
    if (erros.length > 0) {
      return res.status(400).json({ error: erros[0], erros });
    }

    const { nome, imagem, apenassuiteMembers, pessoasNecessarias, obrigatorio, ordem } = req.body;
    if (await comodoComMesmoNome(nome)) {
      return res.status(400).json({ error: 'Já existe um cômodo com esse nome.' });
    }

    const novoComodo = await ComodosStore.create({
      nome: String(nome).trim(),
      imagem: imagem || null,
      apenassuiteMembers,
      pessoasNecessarias,
      obrigatorio,
      ordem
    });
    res.json(novoComodo);
  }));

  router.put('/comodos/:id', exigirPermissao('comodos:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await ComodosStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Cômodo não encontrado' });
    }

    const erros = validarComodoPayload(req.body, { parcial: true });
    if (erros.length > 0) {
      return res.status(400).json({ error: erros[0], erros });
    }

    const { nome, imagem, apenassuiteMembers, pessoasNecessarias, obrigatorio, ordem } = req.body;
    const changes = {};
    if (nome !== undefined) {
      if (await comodoComMesmoNome(nome, existente.id)) {
        return res.status(400).json({ error: 'Já existe um cômodo com esse nome.' });
      }
      changes.nome = String(nome).trim();
    }
    if (apenassuiteMembers !== undefined) changes.apenassuiteMembers = apenassuiteMembers;
    if (pessoasNecessarias !== undefined) changes.pessoasNecessarias = pessoasNecessarias;
    if (obrigatorio !== undefined) changes.obrigatorio = obrigatorio;
    if (ordem !== undefined) changes.ordem = ordem;

    if (imagem !== undefined && imagem !== existente.imagem) {
      await deleteImage(existente.imagem);
      changes.imagem = imagem || null;
    }

    const atualizado = await ComodosStore.update(req.params.id, changes);
    if (changes.nome !== undefined && changes.nome !== existente.nome) {
      await EscalasStore.renomearComodo(existente.nome, changes.nome);
    }
    res.json(atualizado);
  }));

  router.delete('/comodos/:id', exigirPermissao('comodos:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await ComodosStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Cômodo não encontrado' });
    }
    await deleteImage(existente.imagem);
    await ComodosStore.remove(req.params.id);
    res.json({ success: true });
  }));

  // Upload de imagem para cômodo
  router.post('/upload-comodo-image', exigirPermissao('comodos:gerenciar'), upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }
    const { filename, path: imagePath } = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ filename, path: imagePath });
  }));
}
