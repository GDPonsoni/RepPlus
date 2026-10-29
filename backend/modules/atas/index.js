import { randomUUID } from 'crypto';
import { asyncHandler, HttpError } from '../../core/http.js';
import { exigirPermissao } from '../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../core/db/helpers.js';
import { IntegrantesStore } from '../../core/moradores/store.js';
import { AtasStore } from './store.js';

const LIMITES = { titulo: 120, local: 120, pauta: 3000, conteudo: 20000 };
const MAXIMO_ITENS = 50;
const LIMITE_DECISAO = 500;
const LIMITE_TAREFA = 300;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const diaValido = (valor) => DIA_REGEX.test(valor) && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;

function lerLista(valor, campo) {
  if (!Array.isArray(valor)) throw new HttpError(400, `${campo} deve ser uma lista.`);
  if (valor.length > MAXIMO_ITENS) throw new HttpError(400, `${campo} pode ter no máximo ${MAXIMO_ITENS} itens.`);
  return valor;
}

// Encaminhamentos: cada um ganha um id (para marcar como feito depois) e mantém o seu se já tinha
function lerTarefas(tarefas, idsMoradores) {
  return lerLista(tarefas, 'tarefas').map(tarefa => {
    const texto = String(tarefa?.texto ?? '').trim();
    if (!texto) return null;
    if (texto.length > LIMITE_TAREFA) throw new HttpError(400, `Cada encaminhamento pode ter no máximo ${LIMITE_TAREFA} caracteres.`);
    const responsavelId = tarefa.responsavelId || null;
    if (responsavelId && !idsMoradores.has(String(responsavelId))) throw new HttpError(400, 'Responsável não encontrado.');
    const prazo = tarefa.prazo || null;
    if (prazo && !diaValido(prazo)) throw new HttpError(400, 'Prazo inválido. Use AAAA-MM-DD.');
    return {
      id: UUID_REGEX.test(String(tarefa.id)) ? tarefa.id : randomUUID(),
      texto, responsavelId, prazo,
      feito: normalizeBoolean(tarefa.feito, false)
    };
  }).filter(Boolean);
}

// Valida criação/edição. Em edição, campos ausentes mantêm o valor atual.
async function lerAta(body, { criando = false } = {}) {
  const ata = {};

  for (const [campo, limite] of Object.entries(LIMITES)) {
    if (body[campo] === undefined) continue;
    const valor = String(body[campo] ?? '').trim();
    if (valor.length > limite) throw new HttpError(400, `${campo} pode ter no máximo ${limite} caracteres.`);
    ata[campo] = valor || null;
  }
  if ((criando || body.titulo !== undefined) && !ata.titulo) throw new HttpError(400, 'Dê um título para a reunião.');

  if (criando || body.data !== undefined) {
    if (!diaValido(String(body.data ?? ''))) throw new HttpError(400, 'Informe a data da reunião (AAAA-MM-DD).');
    ata.data = body.data;
  }

  if (body.participantes !== undefined || body.tarefas !== undefined) {
    const idsMoradores = new Set((await IntegrantesStore.list()).map(integrante => String(integrante.id)));
    if (body.participantes !== undefined) {
      const participantes = [...new Set(lerLista(body.participantes, 'participantes').map(String))];
      if (participantes.some(id => !idsMoradores.has(id))) throw new HttpError(400, 'Participante não encontrado.');
      ata.participantes = participantes;
    }
    if (body.tarefas !== undefined) ata.tarefas = lerTarefas(body.tarefas, idsMoradores);
  }

  if (body.decisoes !== undefined) {
    ata.decisoes = lerLista(body.decisoes, 'decisoes').map(decisao => String(decisao ?? '').trim()).filter(Boolean);
    if (ata.decisoes.some(decisao => decisao.length > LIMITE_DECISAO)) {
      throw new HttpError(400, `Cada decisão pode ter no máximo ${LIMITE_DECISAO} caracteres.`);
    }
  }

  if (body.eventoId !== undefined) {
    if (body.eventoId && !UUID_REGEX.test(String(body.eventoId))) throw new HttpError(400, 'eventoId inválido.');
    ata.eventoId = body.eventoId || null;
  }
  return ata;
}

// Módulo: atas de reunião da casa
export default {
  id: 'atas',
  nome: 'Atas de Reunião',
  permissoes: {
    'atas:ver': { descricao: 'Ler as atas e as pendências', papeis: ['morador'] },
    'atas:editar': { descricao: 'Escrever e editar atas e marcar encaminhamentos como feitos', papeis: ['morador'] },
    'atas:gerenciar': { descricao: 'Apagar atas', papeis: [] }
  },

  rotas(router) {
    router.get('/atas', exigirPermissao('atas:ver'), asyncHandler(async (req, res) => {
      res.json(await AtasStore.list());
    }));

    router.post('/atas', exigirPermissao('atas:editar'), asyncHandler(async (req, res) => {
      const ata = await lerAta(req.body || {}, { criando: true });
      res.status(201).json(await AtasStore.create({ participantes: [], decisoes: [], tarefas: [], ...ata }));
    }));

    router.put('/atas/:id', exigirPermissao('atas:editar'), asyncHandler(async (req, res) => {
      const existente = await AtasStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Ata não encontrada.');
      res.json(await AtasStore.update(existente.id, await lerAta(req.body || {})));
    }));

    // Marcar um encaminhamento como feito (ou desfazer) sem reenviar a ata inteira
    router.put('/atas/:id/tarefas/:tarefaId', exigirPermissao('atas:editar'), asyncHandler(async (req, res) => {
      const ata = await AtasStore.findById(req.params.id);
      if (!ata) throw new HttpError(404, 'Ata não encontrada.');
      if (!ata.tarefas.some(tarefa => tarefa.id === req.params.tarefaId)) throw new HttpError(404, 'Encaminhamento não encontrado.');
      const tarefas = ata.tarefas.map(tarefa => (tarefa.id === req.params.tarefaId
        ? { ...tarefa, feito: normalizeBoolean(req.body?.feito, !tarefa.feito) }
        : tarefa));
      res.json(await AtasStore.update(ata.id, { tarefas }));
    }));

    router.delete('/atas/:id', exigirPermissao('atas:gerenciar'), asyncHandler(async (req, res) => {
      if (!(await AtasStore.findById(req.params.id))) throw new HttpError(404, 'Ata não encontrada.');
      await AtasStore.remove(req.params.id);
      res.json({ success: true });
    }));
  }
};
