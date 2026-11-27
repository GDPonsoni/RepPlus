import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { HttpError } from './http.js';

// Imagens enviadas (logo, fundo, cômodos, galeria de motivação) ficam num bucket PRIVADO do
// Cloudflare R2, acessado pela API compatível com S3. Ninguém acessa o bucket direto: o
// navegador pede /api/midia/<chave> e o servidor busca o arquivo no R2 (só para quem entrou,
// como o resto da API). O banco guarda esse caminho de cada imagem.
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY — token de API do R2
//   R2_BUCKET — nome do bucket
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
export const PREFIXO_MIDIA = '/api/midia/';

const configurado = () => Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

let cliente = null;
function r2() {
  if (!configurado()) {
    throw new HttpError(503, 'Envio de imagens não configurado: defina as variáveis R2_* (veja docs/deploy.md).');
  }
  cliente ??= new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    // O R2 não exige as somas de verificação que o SDK novo manda por padrão
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
  return cliente;
}

const urlDaChave = (key) => `${PREFIXO_MIDIA}${encodeURIComponent(key)}`;

// Chave dentro do bucket a partir do caminho gravado no banco
const chaveDaUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.startsWith(PREFIXO_MIDIA)) return null;
  try {
    return decodeURIComponent(url.slice(PREFIXO_MIDIA.length));
  } catch {
    return null;
  }
};

// Chaves aceitas em /api/midia: um nome de arquivo simples, sem pastas
const CHAVE_VALIDA = /^[\w.-]{1,200}$/;

// Grava um arquivo com a chave dada (também usado pela importação dos dados antigos)
export async function salvarArquivo(key, buffer, contentType) {
  await r2().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return urlDaChave(key);
}

// Tipo da imagem pelos primeiros bytes do arquivo: a extensão e o Content-Type vêm do navegador
// e podem mentir. Só aceita os formatos do upload (png, jpg, webp, gif)
function tipoDaImagem(buffer) {
  const comeca = (bytes, inicio = 0) => bytes.every((byte, i) => buffer[inicio + i] === byte);
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extensao: '.png', mimetype: 'image/png' };
  if (comeca([0xff, 0xd8, 0xff])) return { extensao: '.jpg', mimetype: 'image/jpeg' };
  if (comeca([0x47, 0x49, 0x46, 0x38])) return { extensao: '.gif', mimetype: 'image/gif' };
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return { extensao: '.webp', mimetype: 'image/webp' };
  return null;
}

// Documentos do mural: imagens ou PDF, também conferidos pelo conteúdo. O prefixo "doc-" separa
// esses arquivos da galeria de motivação, que lista as imagens soltas do bucket
export const PREFIXO_DOCUMENTO = 'doc-';

function tipoDoDocumento(buffer) {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return { extensao: '.pdf', mimetype: 'application/pdf' };
  return tipoDaImagem(buffer);
}

export async function uploadDocumento(buffer) {
  const tipo = tipoDoDocumento(buffer);
  if (!tipo) throw new HttpError(400, 'Tipo de arquivo não aceito. Envie PDF, png, jpg, webp ou gif.');
  const key = `${PREFIXO_DOCUMENTO}${randomUUID()}${tipo.extensao}`;
  return { filename: key, path: await salvarArquivo(key, buffer, tipo.mimetype), mimetype: tipo.mimetype };
}

export async function uploadImage(buffer) {
  const tipo = tipoDaImagem(buffer);
  if (!tipo) throw new HttpError(400, 'O arquivo não é uma imagem válida. Envie png, jpg, webp ou gif.');
  const key = `${randomUUID()}${tipo.extensao}`;
  return { filename: key, path: await salvarArquivo(key, buffer, tipo.mimetype) };
}

export async function deleteImage(imagePathOrUrl) {
  const key = chaveDaUrl(imagePathOrUrl);
  if (!key) return;
  await deleteImageByFilename(key);
}

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export async function listGalleryImages({ exclude = [] } = {}) {
  // Sem R2 não há galeria (gerar a escala continua funcionando, só sem imagem da semana)
  if (!configurado()) return [];
  const excludedKeys = new Set(exclude.map(chaveDaUrl).filter(Boolean));
  // O bucket lista em páginas de até 1000 arquivos
  const chaves = [];
  let continuacao;
  do {
    const pagina = await r2().send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: continuacao }));
    chaves.push(...(pagina.Contents || []).map(objeto => objeto.Key));
    continuacao = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (continuacao);

  return chaves
    .filter((key) => IMAGE_EXTENSION_REGEX.test(key))
    .filter((key) => !key.startsWith(PREFIXO_DOCUMENTO))
    .filter((key) => !excludedKeys.has(key))
    .map((key) => ({ filename: key, path: urlDaChave(key) }));
}

export async function deleteImageByFilename(filename) {
  await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: filename }));
}

export function getKeyFromUrl(url) {
  return chaveDaUrl(url);
}

// GET /api/midia/:chave — entrega a imagem do bucket privado. Fica atrás do login (app.js).
export async function enviarMidia(req, res) {
  const key = req.params.chave;
  if (!CHAVE_VALIDA.test(key) || key.startsWith('.')) throw new HttpError(404, 'Imagem não encontrada.');
  let objeto;
  try {
    objeto = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (erro) {
    if (erro.name === 'NoSuchKey' || erro.$metadata?.httpStatusCode === 404) throw new HttpError(404, 'Imagem não encontrada.');
    throw erro;
  }
  res.set({
    'Content-Type': objeto.ContentType || 'application/octet-stream',
    'Content-Length': objeto.ContentLength,
    // A chave nunca muda de conteúdo (UUID novo a cada envio). "private": só o navegador de
    // quem entrou guarda a cópia, nenhum cache no meio do caminho
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  });
  // Uma imagem (até um SVG antigo) aberta direto nunca roda script no endereço do app. O PDF
  // fica de fora: com essa política o leitor de PDF do Chrome se recusa a abrir o arquivo (e o
  // upload só aceita PDF de verdade, conferido pelo conteúdo)
  if (!String(objeto.ContentType).startsWith('application/pdf')) {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  if (objeto.ETag) res.set('ETag', objeto.ETag);
  objeto.Body.on('error', () => res.destroy());
  objeto.Body.pipe(res);
}
