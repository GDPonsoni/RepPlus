import { asyncHandler } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { IntegrantesStore } from '../../../core/moradores/store.js';
import { InfracoesStore } from '../store.js';

export function rotasInfracoes(router) {
  router.get('/infracoes/:integranteId', exigirPermissao('infracoes:ver'), asyncHandler(async (req, res) => {
    res.json(await InfracoesStore.listByIntegranteId(req.params.integranteId));
  }));

  router.post('/infracoes', exigirPermissao('infracoes:registrar'), asyncHandler(async (req, res) => {
    const { integranteId, descricao, dataSemana } = req.body;

    if (!integranteId) {
      return res.status(400).json({ error: 'integranteId é obrigatório' });
    }

    const integrante = await IntegrantesStore.findById(integranteId);
    if (!integrante) {
      return res.status(400).json({ error: 'Integrante não encontrado' });
    }

    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ error: 'A descrição da infração é obrigatória' });
    }

    const novaInfracao = await InfracoesStore.create({
      integranteId: integrante.id,
      integranteNome: integrante.nome,
      descricao,
      dataSemana
    });

    res.json(novaInfracao);
  }));

  router.put('/infracoes/:id', exigirPermissao('infracoes:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await InfracoesStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Infração não encontrada' });
    }

    const { descricao, dataSemana } = req.body;
    const changes = {};

    if (descricao !== undefined) {
      if (!String(descricao).trim()) {
        return res.status(400).json({ error: 'A descrição da infração é obrigatória' });
      }
      changes.descricao = String(descricao).trim();
    }
    if (dataSemana !== undefined) changes.dataSemana = dataSemana;

    const atualizada = await InfracoesStore.update(req.params.id, changes);
    res.json(atualizada);
  }));

  router.delete('/infracoes/:id', exigirPermissao('infracoes:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await InfracoesStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Infração não encontrada' });
    }
    await InfracoesStore.remove(req.params.id);
    res.json({ success: true });
  }));

  router.get('/infracoes-resumo/todas', exigirPermissao('infracoes:ver'), asyncHandler(async (req, res) => {
    const [infracoes, integrantes] = await Promise.all([InfracoesStore.list(), IntegrantesStore.list()]);
    const integrantesPorId = new Map(integrantes.map(integrante => [String(integrante.id), integrante]));
    const resumo = {};

    integrantes.filter(i => i.ativo !== false).forEach(integrante => {
      resumo[integrante.id] = {
        integranteId: integrante.id,
        integranteNome: integrante.nome,
        total: 0,
        infracoes: []
      };
    });

    infracoes.forEach(infracao => {
      const chave = String(infracao.integranteId);
      if (!resumo[chave]) {
        const integrante = integrantesPorId.get(chave);
        resumo[chave] = {
          integranteId: infracao.integranteId,
          integranteNome: integrante ? integrante.nome : infracao.integranteNome,
          total: 0,
          infracoes: []
        };
      }
      resumo[chave].total++;
      resumo[chave].infracoes.push(infracao);
    });

    res.json(resumo);
  }));
}
