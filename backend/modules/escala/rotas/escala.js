import { randomUUID } from 'crypto';
import { asyncHandler } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { normalizeBoolean, normalizeNumber } from '../../../core/db/helpers.js';
import { getSemanaAtual, getSemanaSeguinte, getISOWeek, DIA_MS } from '../../../core/semana.js';
import { ConfigStore } from '../../../core/configuracao/store.js';
import { IntegrantesStore } from '../../../core/moradores/store.js';
import { ComodosStore, EscalasStore } from '../store.js';
import { montarEscala } from '../rodizio.js';
import { sortByOrderThenName } from './comodos.js';
import { sortearMotivacaoDestaque } from './motivacao.js';

// Quantas semanas de histórico o rodízio considera: cobre com folga um ciclo completo de
// folgas, suíte e cômodos, e mantém a geração rápida mesmo com anos de histórico
const SEMANAS_HISTORICO_RODIZIO = 52;

const chaveSemana = (ano, semana) => ano * 100 + semana;

// Escala em uso: a última gerada, se for desta semana ou adiantada (gerada antes de a semana
// começar). Sem nenhuma, fica a semana atual sem linhas.
async function semanaVigente() {
  const atual = getSemanaAtual();
  const linhas = await EscalasStore.listDesde(atual.ano, atual.semana);
  if (linhas.length === 0) return { ...atual, linhas: [] };
  const ultima = Math.max(...linhas.map(e => chaveSemana(e.ano, e.semana)));
  const daUltima = linhas.filter(e => chaveSemana(e.ano, e.semana) === ultima);
  const { ano, semana, dataInicio, dataFim } = daUltima[0];
  return { ano, semana, dataInicio: new Date(dataInicio), dataFim: new Date(dataFim), linhas: daUltima };
}

const ehDaSemana = (escala, semana) => escala.ano === semana.ano && escala.semana === semana.semana;

export function rotasEscala(router) {
  router.get('/escala/atual', exigirPermissao('escala:ver'), asyncHandler(async (req, res) => {
    res.json((await semanaVigente()).linhas);
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

    if (!ehDaSemana(existente, await semanaVigente())) {
      return res.status(400).json({ error: 'Só é possível editar a escala em uso' });
    }

    const changes = {};
    if (req.body.comodos !== undefined) {
      if (!Array.isArray(req.body.comodos) || req.body.comodos.some(item => typeof item !== 'string')) {
        return res.status(400).json({ error: 'comodos deve ser uma lista de textos' });
      }
      changes.comodos = req.body.comodos;
      changes.cumpridos = existente.cumpridos.filter(nome => req.body.comodos.includes(nome));
      changes.folga = req.body.comodos.includes('FOLGA');
    }
    if (req.body.folga !== undefined && changes.folga === undefined) {
      changes.folga = normalizeBoolean(req.body.folga, existente.folga);
    }

    const atualizado = await EscalasStore.update(req.params.id, changes);
    res.json(atualizado);
  }));

  // Marca (ou desmarca) como limpos os cômodos de uma pessoa na escala da semana atual.
  // Sem `comodo`, vale para todos os cômodos dela.
  router.post('/escala/:id/limpeza', exigirPermissao('escala:marcar'), asyncHandler(async (req, res) => {
    const { comodo, feito } = req.body;

    const existente = await EscalasStore.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Registro de escala não encontrado' });
    }

    if (!ehDaSemana(existente, await semanaVigente())) {
      return res.status(400).json({ error: 'Só é possível marcar a limpeza da escala em uso' });
    }

    const tarefas = existente.comodos.filter(nome => nome !== 'FOLGA');
    const alvo = comodo === undefined ? tarefas : [comodo];
    if (alvo.length === 0 || alvo.some(nome => typeof nome !== 'string' || !tarefas.includes(nome))) {
      return res.status(400).json({ error: 'Essa pessoa não tem cômodo para limpar nesta semana' });
    }

    const outros = existente.cumpridos.filter(nome => !alvo.includes(nome));
    const cumpridos = normalizeBoolean(feito, true) ? [...outros, ...alvo] : outros;
    res.json(await EscalasStore.update(req.params.id, { cumpridos }));
  }));

  router.post('/escala/atual/trocar', exigirPermissao('escala:gerenciar'), asyncHandler(async (req, res) => {
    const { integranteAId, integranteBId } = req.body;

    if (!integranteAId || !integranteBId) {
      return res.status(400).json({ error: 'Informe integranteAId e integranteBId' });
    }
    if (String(integranteAId) === String(integranteBId)) {
      return res.status(400).json({ error: 'Selecione dois integrantes diferentes' });
    }

    const escalasSemana = (await semanaVigente()).linhas;
    const linhaA = escalasSemana.find(e => String(e.integranteId) === String(integranteAId));
    const linhaB = escalasSemana.find(e => String(e.integranteId) === String(integranteBId));

    if (!linhaA || !linhaB) {
      return res.status(404).json({ error: 'Um dos integrantes não está na escala em uso' });
    }

    const resultados = await EscalasStore.saveMany([
      { ...linhaA, comodos: linhaB.comodos, folga: linhaB.folga, cumpridos: [] },
      { ...linhaB, comodos: linhaA.comodos, folga: linhaA.folga, cumpridos: [] }
    ]);

    res.json({ success: true, escala: resultados });
  }));

  // Semana da faxineira: a escala em uso passa inteira para a semana seguinte, sem limpeza
  // nesta. Fica um buraco no histórico, mas o rodízio conta só as semanas que têm escala
  // (rodizio.js numera as semanas existentes), então a sequência continua de onde parou.
  router.post('/escala/atual/adiar', exigirPermissao('escala:gerenciar'), asyncHandler(async (req, res) => {
    const vigente = await semanaVigente();
    if (vigente.linhas.length === 0) {
      return res.status(404).json({ error: 'Não há escala em uso para adiar' });
    }

    // A vigente é a última gerada, então a semana seguinte está sempre vazia. Mesmo id: o
    // upsert move as linhas de uma vez. Marcações de limpeza zeram, pois ninguém limpou.
    const destino = getSemanaSeguinte(vigente);
    const movidas = await EscalasStore.saveMany(vigente.linhas.map(linha => ({
      ...linha,
      ano: destino.ano,
      semana: destino.semana,
      dataInicio: destino.dataInicio,
      dataFim: destino.dataFim,
      cumpridos: []
    })));

    res.json({ escala: movidas, de: { ano: vigente.ano, semana: vigente.semana } });
  }));

  router.post('/escala/gerar', exigirPermissao('escala:gerar'), asyncHandler(async (req, res) => {
    const integrantes = await IntegrantesStore.list();
    const comodos = (await ComodosStore.list()).sort(sortByOrderThenName);
    // Semana gerada, sem depender do dia: a seguinte à escala desta semana, para adiantar a
    // próxima (ex.: no domingo, com tudo limpo). Sem escala nesta semana, gera a atual. Se a
    // próxima já foi adiantada, refaz ela em vez de pular mais uma.
    const vigente = await semanaVigente();
    const atual = getSemanaAtual();
    const semanaAlvo = vigente.linhas.length === 0
      ? atual
      : ehDaSemana(vigente, atual) ? getSemanaSeguinte(atual) : vigente;

    // Histórico = último ano de escalas antes da semana gerada (a escala que está sendo refeita não conta)
    const inicioHistorico = getISOWeek(new Date(semanaAlvo.dataInicio - SEMANAS_HISTORICO_RODIZIO * 7 * DIA_MS));
    const historico = (await EscalasStore.listDesde(inicioHistorico.year, inicioHistorico.week)).filter(e =>
      chaveSemana(e.ano, e.semana) < chaveSemana(semanaAlvo.ano, semanaAlvo.semana)
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
        ano: semanaAlvo.ano,
        semana: semanaAlvo.semana,
        integranteId: integrante.id,
        integranteNome: integrante.nome,
        folga: comodosIntegrante.includes('FOLGA'),
        comodos: comodosIntegrante,
        cumpridos: [],
        dataInicio: new Date(semanaAlvo.dataInicio),
        dataFim: new Date(semanaAlvo.dataFim),
        alerta: null
      };
    });

    await EscalasStore.replaceSemana(semanaAlvo.ano, semanaAlvo.semana, novaEscala);

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
