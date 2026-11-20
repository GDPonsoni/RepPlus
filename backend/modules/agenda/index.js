import { asyncHandler, HttpError } from '../../core/http.js';
import { categoriaExiste, categoriaPadrao } from '../../core/categorias/index.js';
import { exigirPermissao } from '../../core/auth/permissoes.js';
import { normalizeBoolean } from '../../core/db/helpers.js';
import { EventosStore, DURACAO_MAXIMA_DIAS } from './store.js';
import { RECORRENCIAS, DURACAO_MAXIMA_POR_RECORRENCIA, diaNaCasa } from './recorrencia.js';

const LIMITES = { titulo: 120, local: 120, descricao: 1000 };
const DIA_MS = 86400000;

const dataValida = (valor) => typeof valor === 'string' && valor.length > 0 && !Number.isNaN(Date.parse(valor));
const DIA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const NOMES_RECORRENCIA = { semanal: 'toda semana', quinzenal: 'a cada 2 semanas', mensal: 'todo mês', anual: 'todo ano' };

// Valida o corpo de criação/edição. Em edição (`existente`), campos ausentes mantêm o valor atual.
async function lerEvento(body, existente = null) {
  const evento = {};

  for (const campo of ['titulo', 'local', 'descricao']) {
    if (body[campo] === undefined) continue;
    const valor = body[campo] === null ? '' : String(body[campo]).trim();
    if (valor.length > LIMITES[campo]) {
      throw new HttpError(400, `${campo} pode ter no máximo ${LIMITES[campo]} caracteres.`);
    }
    evento[campo] = valor || null;
  }
  if (!existente || body.titulo !== undefined) {
    if (!evento.titulo) throw new HttpError(400, 'O título do evento é obrigatório.');
  }

  if (body.categoria !== undefined || !existente) {
    const categoria = body.categoria || await categoriaPadrao('agenda');
    if (!(await categoriaExiste('agenda', categoria))) throw new HttpError(400, 'Categoria inválida.');
    evento.categoria = categoria;
  }

  if (body.diaInteiro !== undefined || !existente) evento.diaInteiro = normalizeBoolean(body.diaInteiro, false);

  if (body.inicio !== undefined || !existente) {
    if (!dataValida(body.inicio)) throw new HttpError(400, 'Informe a data de início do evento.');
    evento.inicio = new Date(body.inicio).toISOString();
  }
  if (body.fim !== undefined) {
    if (body.fim === null || body.fim === '') evento.fim = null;
    else if (!dataValida(body.fim)) throw new HttpError(400, 'Data de término inválida.');
    else evento.fim = new Date(body.fim).toISOString();
  }

  const inicio = evento.inicio ?? existente?.inicio;
  const fim = evento.fim !== undefined ? evento.fim : existente?.fim;
  if (fim && new Date(fim) < new Date(inicio)) {
    throw new HttpError(400, 'O término não pode ser antes do início.');
  }
  if (fim && new Date(fim) - new Date(inicio) > DURACAO_MAXIMA_DIAS * DIA_MS) {
    throw new HttpError(400, `Um evento pode durar no máximo ${DURACAO_MAXIMA_DIAS} dias.`);
  }

  // Repetição: null (não repete), semanal, quinzenal, mensal ou anual; recorrenciaAte = último dia (opcional)
  if (body.recorrencia !== undefined) {
    const recorrencia = body.recorrencia || null;
    if (recorrencia && !RECORRENCIAS.includes(recorrencia)) {
      throw new HttpError(400, `Repetição inválida. Use: ${RECORRENCIAS.join(', ')}.`);
    }
    evento.recorrencia = recorrencia;
    if (!recorrencia) {
      evento.recorrenciaAte = null;
      evento.excecoes = [];
    }
  }
  if (body.recorrenciaAte !== undefined && evento.recorrencia !== null) {
    const ate = body.recorrenciaAte || null;
    if (ate && !DIA_REGEX.test(ate)) throw new HttpError(400, 'Data final da repetição inválida. Use AAAA-MM-DD.');
    evento.recorrenciaAte = ate;
  }

  const recorrencia = evento.recorrencia !== undefined ? evento.recorrencia : existente?.recorrencia;
  if (recorrencia) {
    const ate = evento.recorrenciaAte !== undefined ? evento.recorrenciaAte : existente?.recorrenciaAte;
    if (ate && ate < diaNaCasa(inicio)) {
      throw new HttpError(400, 'A repetição não pode terminar antes do primeiro dia do evento.');
    }
    const maximo = DURACAO_MAXIMA_POR_RECORRENCIA[recorrencia];
    if (fim && new Date(fim) - new Date(inicio) > maximo * DIA_MS) {
      throw new HttpError(400, `Um evento que se repete ${NOMES_RECORRENCIA[recorrencia]} pode durar no máximo ${maximo} dias.`);
    }
  }

  return evento;
}

// Módulo: agenda conjunta da república
export default {
  id: 'agenda',
  nome: 'Agenda',
  categorias: {
    agenda: {
      nome: 'Eventos da agenda',
      permissaoVer: 'agenda:ver', permissaoGerenciar: 'agenda:gerenciar',
      tabela: 'eventos', coluna: 'categoria',
      padrao: [
        { chave: 'geral', nome: 'Geral', cor: '#dc0000', icone: 'fa-solid fa-thumbtack' },
        { chave: 'festa', nome: 'Festa / rolê', cor: '#9333ea', icone: 'fa-solid fa-champagne-glasses' },
        { chave: 'reuniao', nome: 'Reunião', cor: '#2563eb', icone: 'fa-solid fa-people-group' },
        { chave: 'visita', nome: 'Visita', cor: '#16a34a', icone: 'fa-solid fa-door-open' },
        { chave: 'manutencao', nome: 'Manutenção', cor: '#ea580c', icone: 'fa-solid fa-screwdriver-wrench' }
      ]
    }
  },
  permissoes: {
    'agenda:ver': { descricao: 'Ver a agenda', papeis: ['morador'] },
    'agenda:criar': { descricao: 'Criar eventos', papeis: ['morador'] },
    'agenda:gerenciar': { descricao: 'Editar e excluir eventos', papeis: [] }
  },

  rotas(router) {
    // ?de=...&ate=... (ISO 8601): eventos que acontecem nesse intervalo
    router.get('/eventos', exigirPermissao('agenda:ver'), asyncHandler(async (req, res) => {
      const { de, ate } = req.query;
      if (!dataValida(de) || !dataValida(ate)) {
        throw new HttpError(400, 'Informe o período com ?de=...&ate=... (datas ISO).');
      }
      if (new Date(ate) - new Date(de) > 62 * DIA_MS) {
        throw new HttpError(400, 'O período pode ter no máximo 62 dias.');
      }
      res.json(await EventosStore.listPeriodo(new Date(de).toISOString(), new Date(ate).toISOString()));
    }));

    router.post('/eventos', exigirPermissao('agenda:criar'), asyncHandler(async (req, res) => {
      const evento = await lerEvento(req.body);
      res.json(await EventosStore.create({ fim: null, local: null, descricao: null, recorrencia: null, recorrenciaAte: null, excecoes: [], ...evento }));
    }));

    router.put('/eventos/:id', exigirPermissao('agenda:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await EventosStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Evento não encontrado');
      res.json(await EventosStore.update(req.params.id, await lerEvento(req.body, existente)));
    }));

    // Cancela uma única repetição de um evento recorrente: { "data": "AAAA-MM-DD" }
    router.post('/eventos/:id/excecoes', exigirPermissao('agenda:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await EventosStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Evento não encontrado');
      if (!existente.recorrencia) throw new HttpError(400, 'Este evento não se repete.');

      const { data } = req.body;
      if (!DIA_REGEX.test(data || '')) throw new HttpError(400, 'Informe a data da repetição (AAAA-MM-DD).');

      const excecoes = [...new Set([...(existente.excecoes || []), data])].sort();
      res.json(await EventosStore.update(req.params.id, { excecoes }));
    }));

    router.delete('/eventos/:id', exigirPermissao('agenda:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await EventosStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Evento não encontrado');
      await EventosStore.remove(req.params.id);
      res.json({ success: true });
    }));
  }
};
