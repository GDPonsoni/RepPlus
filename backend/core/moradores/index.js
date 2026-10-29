import { asyncHandler, HttpError } from '../http.js';
import { exigirPermissao, temPermissao } from '../auth/permissoes.js';
import { normalizeBoolean } from '../db/helpers.js';
import { IntegrantesStore, CAMPOS_PERFIL, CAMPOS_DOCUMENTOS } from './store.js';

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAMPOS_DATA = ['dataNascimento', 'dataEntrada'];
const LIMITE_TEXTO = { nomeCompleto: 120, telefone: 30, email: 120, observacoes: 500, emergenciaNome: 120, emergenciaParentesco: 40, emergenciaTelefone: 30, cpf: 20, rg: 20 };

// Data AAAA-MM-DD que existe de verdade (recusa 2026-02-31)
const dataValida = (valor) => {
  if (!DATA_REGEX.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};

// Valida e normaliza os campos do cadastro presentes no corpo ('' vira null = apagar o campo)
function lerPerfil(body, contexto) {
  const perfil = {};
  for (const campo of Object.keys(CAMPOS_PERFIL)) {
    if (body[campo] === undefined) continue;
    if (CAMPOS_DOCUMENTOS.includes(campo) && !temPermissao(contexto, 'moradores:documentos')) {
      throw new HttpError(403, 'Você não tem permissão para alterar documentos.');
    }

    const valor = body[campo] === null ? '' : String(body[campo]).trim();
    if (valor === '') {
      perfil[campo] = null;
      continue;
    }
    if (CAMPOS_DATA.includes(campo) && !dataValida(valor)) {
      throw new HttpError(400, `Data inválida em ${campo}. Use o formato AAAA-MM-DD.`);
    }
    if (campo === 'email' && !EMAIL_REGEX.test(valor)) {
      throw new HttpError(400, 'E-mail inválido.');
    }
    if (LIMITE_TEXTO[campo] && valor.length > LIMITE_TEXTO[campo]) {
      throw new HttpError(400, `${campo} pode ter no máximo ${LIMITE_TEXTO[campo]} caracteres.`);
    }
    perfil[campo] = valor;
  }
  return perfil;
}

// Remove CPF/RG da resposta para quem não pode vê-los
const semDocumentos = (integrante, contexto) => {
  if (!integrante || temPermissao(contexto, 'moradores:documentos')) return integrante;
  const copia = { ...integrante };
  CAMPOS_DOCUMENTOS.forEach(campo => delete copia[campo]);
  return copia;
};

export default {
  id: 'moradores',
  nome: 'Moradores',
  nucleo: true,
  permissoes: {
    'moradores:ver': { descricao: 'Ver a lista de moradores', papeis: ['morador'] },
    'moradores:gerenciar': { descricao: 'Adicionar, editar e remover moradores', papeis: [] },
    'moradores:documentos': { descricao: 'Ver e alterar documentos (CPF, RG) dos moradores', papeis: [] }
  },

  rotas(router) {
    router.get('/integrantes', exigirPermissao('moradores:ver'), asyncHandler(async (req, res) => {
      const integrantes = await IntegrantesStore.list();
      res.json(integrantes.map(integrante => semDocumentos(integrante, req.contexto)));
    }));

    router.post('/integrantes', exigirPermissao('moradores:gerenciar'), asyncHandler(async (req, res) => {
      const { nome, isSuite, ativo } = req.body;

      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'O nome do integrante é obrigatório.' });
      }

      if (await IntegrantesStore.findByNome(nome)) {
        return res.status(400).json({ error: 'Já existe um integrante com esse nome.' });
      }

      const perfil = lerPerfil(req.body, req.contexto);
      const novoIntegrante = await IntegrantesStore.create({ nome, isSuite, ativo, ...perfil });
      res.json(semDocumentos(novoIntegrante, req.contexto));
    }));

    router.put('/integrantes/:id', exigirPermissao('moradores:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await IntegrantesStore.findById(req.params.id);
      if (!existente) {
        return res.status(404).json({ error: 'Integrante não encontrado' });
      }

      const { nome, isSuite, ativo } = req.body;
      const changes = lerPerfil(req.body, req.contexto);

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
      res.json(semDocumentos(atualizado, req.contexto));
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
