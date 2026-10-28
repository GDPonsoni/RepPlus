import { asyncHandler } from '../http.js';
import { exigirPermissao } from '../auth/permissoes.js';
import { normalizeBoolean } from '../db/helpers.js';
import { IntegrantesStore } from './store.js';

export default {
  id: 'moradores',
  nome: 'Moradores',
  nucleo: true,
  permissoes: {
    'moradores:ver': { descricao: 'Ver a lista de moradores', papeis: ['morador'] },
    'moradores:gerenciar': { descricao: 'Adicionar, editar e remover moradores', papeis: [] }
  },

  rotas(router) {
    router.get('/integrantes', exigirPermissao('moradores:ver'), asyncHandler(async (req, res) => {
      res.json(await IntegrantesStore.list());
    }));

    router.post('/integrantes', exigirPermissao('moradores:gerenciar'), asyncHandler(async (req, res) => {
      const { nome, isSuite } = req.body;

      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'O nome do integrante é obrigatório.' });
      }

      if (await IntegrantesStore.findByNome(nome)) {
        return res.status(400).json({ error: 'Já existe um integrante com esse nome.' });
      }

      const novoIntegrante = await IntegrantesStore.create({ nome, isSuite });
      res.json(novoIntegrante);
    }));

    router.put('/integrantes/:id', exigirPermissao('moradores:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await IntegrantesStore.findById(req.params.id);
      if (!existente) {
        return res.status(404).json({ error: 'Integrante não encontrado' });
      }

      const { nome, isSuite, ativo } = req.body;
      const changes = {};

      if (nome !== undefined) {
        if (!String(nome).trim()) {
          return res.status(400).json({ error: 'O nome do integrante é obrigatório.' });
        }
        if (await IntegrantesStore.findByNome(nome, { excludeId: existente.id })) {
          return res.status(400).json({ error: 'Já existe um integrante com esse nome.' });
        }
        changes.nome = String(nome).trim();
      }
      if (isSuite !== undefined) changes.isSuite = normalizeBoolean(isSuite, existente.isSuite);
      if (ativo !== undefined) changes.ativo = normalizeBoolean(ativo, existente.ativo);

      const atualizado = await IntegrantesStore.update(req.params.id, changes);
      res.json(atualizado);
    }));

    router.delete('/integrantes/:id', exigirPermissao('moradores:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await IntegrantesStore.findById(req.params.id);
      if (!existente) {
        return res.status(404).json({ error: 'Integrante não encontrado' });
      }
      await IntegrantesStore.remove(req.params.id);
      res.json({ success: true });
    }));
  }
};
