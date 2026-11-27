import { randomBytes, timingSafeEqual } from 'crypto';
import { Readable } from 'stream';
import { asyncHandler, HttpError, uploadDocumento as receberArquivo } from '../../core/http.js';
import { exigirPermissao } from '../../core/auth/permissoes.js';
import { categoriaExiste, categoriaPadrao } from '../../core/categorias/index.js';
import { uploadDocumento, deleteImage } from '../../core/storage.js';
import { DocumentosStore, resumoDasAtas, ataExiste } from './store.js';
import {
  statusDrive, urlDeLogin, concluirLogin, desconectar, listarPasta, listarPastasParaEscolher, escolherPasta,
  abrirArquivo, abrirMiniatura
} from './drive.js';

const LIMITES = { titulo: 120, descricao: 1000 };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIA_DAS_ATAS = 'reunioes';

// Nome do arquivo sem a extensão, para sugerir o título
const semExtensao = (nome) => String(nome || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

// Valida criação/edição (multipart na criação, JSON na edição). Campos ausentes não mudam.
async function lerDocumento(body, { criando = false } = {}) {
  const documento = {};
  for (const [campo, limite] of Object.entries(LIMITES)) {
    if (body[campo] === undefined) continue;
    const valor = String(body[campo] ?? '').trim();
    if (valor.length > limite) throw new HttpError(400, `${campo} pode ter no máximo ${limite} caracteres.`);
    documento[campo] = valor || null;
  }
  if (!criando && body.titulo !== undefined && !documento.titulo) throw new HttpError(400, 'Dê um título para o documento.');

  if (body.ataId !== undefined) {
    const ataId = body.ataId || null;
    if (ataId && (!UUID_REGEX.test(String(ataId)) || !(await ataExiste(ataId)))) throw new HttpError(400, 'Ata não encontrada.');
    documento.ataId = ataId;
  }
  if (body.categoria !== undefined && body.categoria !== '') {
    if (!(await categoriaExiste('documentos', body.categoria))) throw new HttpError(400, 'Categoria inválida.');
    documento.categoria = body.categoria;
  }
  return documento;
}

// Anexo de ata entra em "Reuniões" (se essa categoria ainda existir); o resto, na primeira
async function categoriaInicial(documento) {
  if (documento.ataId && await categoriaExiste('documentos', CATEGORIA_DAS_ATAS)) return CATEGORIA_DAS_ATAS;
  return categoriaPadrao('documentos');
}

// Junta título e data da ata de cada anexo
async function comAtas(documentos) {
  const atas = await resumoDasAtas([...new Set(documentos.map(d => d.ataId).filter(Boolean))]);
  return documentos.map(documento => ({ ...documento, ata: atas.get(documento.ataId) || null }));
}

const inlineSeguro = (tipo) => tipo === 'application/pdf' || (tipo.startsWith('image/') && tipo !== 'image/svg+xml');

// Repassa ao navegador um arquivo vindo do Drive
function enviarDoDrive(res, resposta, { tipo, nome, cache = 'private, max-age=300' }) {
  const inline = inlineSeguro(tipo);
  res.set({
    'Content-Type': tipo,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    // Só imagem e PDF abrem na aba; o resto é baixado, para nada rodar no endereço do app
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`
  });
  // Mesmo motivo do /api/midia: o leitor de PDF do Chrome não abre com a política "sandbox"
  if (tipo !== 'application/pdf') res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  const tamanho = resposta.headers.get('content-length');
  if (tamanho) res.set('Content-Length', tamanho);
  const corpo = Readable.fromWeb(resposta.body);
  corpo.on('error', () => res.destroy());
  corpo.pipe(res);
}

// ===== LOGIN COM GOOGLE =====
// O "state" do OAuth vai num cookie de 10 minutos e volta na URL: confere que a volta do Google
// é o login que este navegador começou
const COOKIE_STATE = 'repplus_drive_state';
const CAMINHO_DRIVE = '/api/documentos/drive';
const enderecoDeRetorno = (req) => `${req.protocol}://${req.get('host')}${CAMINHO_DRIVE}/callback`;

function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) return valor.join('=');
  }
  return null;
}

const mesmoTexto = (a, b) => Boolean(a && b) && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Volta para a aba Drive com o resultado (?drive=conectado|cancelado|erro), lido pelo frontend
const voltarParaODrive = (res, resultado) => res.redirect(`/?drive=${resultado}#/documentos/drive`);

// Módulo: documentos da casa (mural de arquivos enviados + leitura da pasta do Google Drive da rep)
export default {
  id: 'documentos',
  nome: 'Documentos',
  categorias: {
    documentos: {
      nome: 'Documentos',
      permissaoVer: 'documentos:ver', permissaoGerenciar: 'documentos:gerenciar',
      tabela: 'documentos', coluna: 'categoria',
      padrao: [
        { chave: CATEGORIA_DAS_ATAS, nome: 'Reuniões', cor: '#0d9488', icone: 'fa-solid fa-file-signature' },
        { chave: 'contratos', nome: 'Contratos', cor: '#2563eb', icone: 'fa-solid fa-file-contract' },
        { chave: 'contas', nome: 'Contas e recibos', cor: '#ea580c', icone: 'fa-solid fa-receipt' },
        { chave: 'manuais', nome: 'Manuais e garantias', cor: '#9333ea', icone: 'fa-solid fa-book' },
        { chave: 'fotos', nome: 'Fotos', cor: '#db2777', icone: 'fa-solid fa-camera' },
        { chave: 'outros', nome: 'Outros', cor: '#6b7280', icone: 'fa-solid fa-file' }
      ]
    }
  },
  permissoes: {
    'documentos:ver': { descricao: 'Ver o mural de documentos e a pasta do Drive', papeis: ['morador'] },
    'documentos:enviar': { descricao: 'Enviar documentos e editar título, descrição e categoria', papeis: ['morador'] },
    'documentos:gerenciar': { descricao: 'Apagar documentos, gerenciar as categorias e conectar o Google Drive', papeis: [] }
  },

  rotas(router) {
    // ===== GOOGLE DRIVE (antes de /documentos/:id) =====
    router.get('/documentos/drive/status', exigirPermissao('documentos:ver'), asyncHandler(async (req, res) => {
      res.json(await statusDrive());
    }));

    // Abre a tela de login do Google (navegação do navegador, não fetch)
    router.get('/documentos/drive/conectar', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      const state = randomBytes(24).toString('base64url');
      const url = urlDeLogin({ redirectUri: enderecoDeRetorno(req), state });
      res.cookie(COOKIE_STATE, state, { httpOnly: true, secure: req.secure, sameSite: 'lax', path: CAMINHO_DRIVE, maxAge: 10 * 60 * 1000 });
      res.redirect(url);
    }));

    router.get('/documentos/drive/callback', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      const state = lerCookie(req, COOKIE_STATE);
      res.clearCookie(COOKIE_STATE, { path: CAMINHO_DRIVE });
      if (req.query.error) return voltarParaODrive(res, 'cancelado');
      if (!mesmoTexto(state, String(req.query.state || '')) || !req.query.code) return voltarParaODrive(res, 'erro');
      try {
        await concluirLogin({ code: String(req.query.code), redirectUri: enderecoDeRetorno(req) });
        voltarParaODrive(res, 'conectado');
      } catch (erro) {
        console.error('Drive: falha ao conectar:', erro.message);
        voltarParaODrive(res, erro.status === 400 ? 'sem-permissao' : 'erro');
      }
    }));

    router.delete('/documentos/drive/conexao', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      await desconectar();
      res.json(await statusDrive());
    }));

    // Escolher a pasta da rep: navega pelas pastas da conta conectada
    router.get('/documentos/drive/escolher', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      res.json(await listarPastasParaEscolher(req.query.pasta ? String(req.query.pasta) : undefined));
    }));

    router.put('/documentos/drive/pasta', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      res.json(await escolherPasta(String(req.body?.pastaId || '')));
    }));

    router.get('/documentos/drive', exigirPermissao('documentos:ver'), asyncHandler(async (req, res) => {
      res.json(await listarPasta(req.query.pasta ? String(req.query.pasta) : undefined));
    }));

    router.get('/documentos/drive/arquivo/:id', exigirPermissao('documentos:ver'), asyncHandler(async (req, res) => {
      const { resposta, tipo, nome } = await abrirArquivo(req.params.id);
      enviarDoDrive(res, resposta, { tipo, nome });
    }));

    router.get('/documentos/drive/miniatura/:id', exigirPermissao('documentos:ver'), asyncHandler(async (req, res) => {
      const resposta = await abrirMiniatura(req.params.id);
      const tipo = resposta.headers.get('content-type') || 'image/jpeg';
      if (!tipo.startsWith('image/') || tipo === 'image/svg+xml') throw new HttpError(404, 'Sem miniatura.');
      enviarDoDrive(res, resposta, { tipo, nome: 'miniatura', cache: 'private, max-age=3600' });
    }));

    // ===== MURAL =====
    // ?ata=<id>: só os anexos daquela ata
    router.get('/documentos', exigirPermissao('documentos:ver'), asyncHandler(async (req, res) => {
      const ata = req.query.ata ? String(req.query.ata) : null;
      if (ata && !UUID_REGEX.test(ata)) throw new HttpError(400, 'Ata inválida.');
      const documentos = ata ? await DocumentosStore.listByAta(ata) : await DocumentosStore.list();
      documentos.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      res.json(await comAtas(documentos));
    }));

    // multipart: arquivo + titulo?, descricao?, categoria?, ataId?
    router.post('/documentos', exigirPermissao('documentos:enviar'), receberArquivo.single('arquivo'), asyncHandler(async (req, res) => {
      if (!req.file) throw new HttpError(400, 'Escolha um arquivo para enviar.');
      const dados = await lerDocumento(req.body || {}, { criando: true });
      const titulo = dados.titulo || semExtensao(req.file.originalname).slice(0, LIMITES.titulo) || 'Documento';

      const { path, mimetype } = await uploadDocumento(req.file.buffer);
      try {
        const criado = await DocumentosStore.create({
          ...dados,
          titulo,
          categoria: dados.categoria ?? await categoriaInicial(dados),
          arquivo: path,
          nomeArquivo: String(req.file.originalname || 'arquivo').slice(0, 200),
          tipo: mimetype,
          tamanho: req.file.size
        });
        res.status(201).json((await comAtas([criado]))[0]);
      } catch (erro) {
        // Sem a linha no banco o arquivo ficaria órfão no bucket
        await deleteImage(path).catch(e => console.error('Erro ao apagar o arquivo enviado:', e.message));
        throw erro;
      }
    }));

    router.put('/documentos/:id', exigirPermissao('documentos:enviar'), asyncHandler(async (req, res) => {
      const existente = await DocumentosStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Documento não encontrado.');
      const atualizado = await DocumentosStore.update(existente.id, await lerDocumento(req.body || {}));
      res.json((await comAtas([atualizado]))[0]);
    }));

    router.delete('/documentos/:id', exigirPermissao('documentos:gerenciar'), asyncHandler(async (req, res) => {
      const existente = await DocumentosStore.findById(req.params.id);
      if (!existente) throw new HttpError(404, 'Documento não encontrado.');
      await DocumentosStore.remove(existente.id);
      // O registro já saiu; se o bucket falhar, sobra só um arquivo solto
      await deleteImage(existente.arquivo).catch(e => console.error('Erro ao apagar o arquivo do documento:', e.message));
      res.json({ success: true });
    }));
  }
};
