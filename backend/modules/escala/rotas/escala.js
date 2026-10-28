import { randomUUID } from 'crypto';
import { asyncHandler } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeBoolean, normalizeNumber } from '../../../core/db/helpers.js';
import { getSemanaAtual, getISOWeek, DIA_MS } from '../../../core/semana.js';
import { ConfigStore } from '../../../core/configuracao/store.js';
import { IntegrantesStore } from '../../../core/moradores/store.js';
import { ComodosStore, EscalasStore } from '../store.js';
import { montarEscala } from '../rodizio.js';
import { sortByOrderThenName } from './comodos.js';
import { sortearMotivacaoDestaque } from './motivacao.js';

// Quantas semanas de histórico o rodízio considera: cobre com folga um ciclo completo de
// folgas, suíte e cômodos, e mantém a geração rápida mesmo com anos de histórico
const SEMANAS_HISTORICO_RODIZIO = 52;

export function rotasEscala(router) {
  router.get('/escala/atual', exigirPermissao('escala:ver'), asyncHandler(async (req, res) => {
    const semanaAtual = getSemanaAtual();
    res.json(await EscalasStore.listBySemana(semanaAtual.ano, semanaAtual.semana));
  }));

  router.get('/escala/historico', exigirPermissao('escala:ver'), asyncHandler(async (req, res) => {
    const escalas = await EscalasStore.list();
    const escalaPorSemana = {};

    escalas.forEach(escala => {
      const semana = `${escala.ano}-${String(escala.semana).padStart(2, '0')}`;
      if (!escalaPorSemana[semana]) {
        escalaPorSemana[semana] = [];
      }
      escalaPorSemana[semana].push(escala);
    });

    res.json(escalaPorSemana);
  }));

  router.delete('/escala/historico/:ano/:semana', exigirPermissao('escala:gerenciar'), asyncHandler(async (req, res) => {
    const ano = normalizeNumber(req.params.ano, null);
    const semana = normalizeNumber(req.params.semana, null);

    if (!ano || !semana) {
      return res.status(400).json({ error: 'Ano e semana são obrigatórios' });
    }

    const removed = await EscalasStore.removeSemana(ano, semana);

    res.json({ success: true, removed });
  }));

  router.put('/escala/:id', exigirPermissao('escala:gerenciar'), asyncHandler(async (req, res) => {
    const existente = await EscalasStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Registro de escala não encontrado' });
    }

    const semanaAtual = getSemanaAtual();
    if (existente.ano !== semanaAtual.ano || existente.semana !== semanaAtual.semana) {
      return res.status(400).json({ error: 'Só é possível editar a escala da semana atual' });
    }

    const changes = {};
    if (req.body.comodos !== undefined) {
      if (!Array.isArray(req.body.comodos) || req.body.comodos.some(item => typeof item !== 'string')) {
        return res.status(400).json({ error: 'comodos deve ser uma lista de textos' });
      }
      changes.comodos = req.body.comodos;
      changes.folga = req.body.comodos.includes('FOLGA');
    }
    if (req.body.folga !== undefined && changes.folga === undefined) {
      changes.folga = normalizeBoolean(req.body.folga, existente.folga);
    }

    const atualizado = await EscalasStore.update(req.params.id, changes);
    res.json(atualizado);
  }));

  router.post('/escala/atual/trocar', exigirPermissao('escala:gerenciar'), asyncHandler(async (req, res) => {
    const { integranteAId, integranteBId } = req.body;

    if (!integranteAId || !integranteBId) {
      return res.status(400).json({ error: 'Informe integranteAId e integranteBId' });
    }
    if (String(integranteAId) === String(integranteBId)) {
      return res.status(400).json({ error: 'Selecione dois integrantes diferentes' });
    }

    const semanaAtual = getSemanaAtual();
    const escalasSemana = await EscalasStore.listBySemana(semanaAtual.ano, semanaAtual.semana);
    const linhaA = escalasSemana.find(e => String(e.integranteId) === String(integranteAId));
    const linhaB = escalasSemana.find(e => String(e.integranteId) === String(integranteBId));

    if (!linhaA || !linhaB) {
      return res.status(404).json({ error: 'Um dos integrantes não está na escala da semana atual' });
    }

    const resultados = await EscalasStore.saveMany([
      { ...linhaA, comodos: linhaB.comodos, folga: linhaB.folga },
      { ...linhaB, comodos: linhaA.comodos, folga: linhaA.folga }
    ]);

    res.json({ success: true, escala: resultados });
  }));

  router.post('/escala/gerar', exigirPermissao('escala:gerar'), asyncHandler(async (req, res) => {
    const integrantes = await IntegrantesStore.list();
    const comodos = (await ComodosStore.list()).sort(sortByOrderThenName);
    const semanaAtual = getSemanaAtual();

    // Histórico = último ano de escalas, exceto a semana atual (que está sendo regerada)
    const inicioHistorico = getISOWeek(new Date(semanaAtual.dataInicio - SEMANAS_HISTORICO_RODIZIO * 7 * DIA_MS));
    const historico = (await EscalasStore.listDesde(inicioHistorico.year, inicioHistorico.week)).filter(e =>
      !(e.ano === semanaAtual.ano && e.semana === semanaAtual.semana)
    );

    const integrantesAtivos = integrantes.filter(i => i.ativo);

    if (integrantesAtivos.length === 0) {
      return res.status(400).json({
        error: 'Nenhum integrante ativo',
        criticas: ['Ative ao menos um integrante para gerar a escala.']
      });
    }

    const mandatoryRooms = comodos.filter(comodo => comodo.obrigatorio !== false);
    if (mandatoryRooms.length === 0) {
      return res.status(400).json({
        error: 'Nenhum cômodo obrigatório configurado',
        criticas: ['Marque ao menos um cômodo como obrigatório antes de gerar a escala.']
      });
    }

    const { erro, resultado, totalFolgas } = montarEscala({
      integrantes: integrantesAtivos,
      comodos: mandatoryRooms,
      historico
    });

    if (erro) {
      return res.status(400).json({ error: erro, criticas: [erro] });
    }

    const novaEscala = integrantesAtivos.map(integrante => {
      const comodosIntegrante = resultado.get(integrante.id);
      return {
        id: randomUUID(),
        ano: semanaAtual.ano,
        semana: semanaAtual.semana,
        integranteId: integrante.id,
        integranteNome: integrante.nome,
        folga: comodosIntegrante.includes('FOLGA'),
        comodos: comodosIntegrante,
        dataInicio: new Date(semanaAtual.dataInicio),
        dataFim: new Date(semanaAtual.dataFim),
        alerta: null
      };
    });

    await EscalasStore.replaceSemana(semanaAtual.ano, semanaAtual.semana, novaEscala);

    // Sorteia uma nova "motivação da semana" a cada geração de escala
    const config = await ConfigStore.get();
    config.motivacaoDestaque = await sortearMotivacaoDestaque(config);
    await ConfigStore.save(config);

    res.json({
      escala: novaEscala,
      alerta: totalFolgas === 0
        ? 'Quantidade exata: ninguém ficou de folga nesta semana.'
        : `${totalFolgas} pessoa(s) ficaram de folga porque há ${integrantesAtivos.length} integrantes para ${integrantesAtivos.length - totalFolgas} vagas obrigatórias.`,
      criticas: [],
      motivacaoDestaque: config.motivacaoDestaque
    });
  }));
}
