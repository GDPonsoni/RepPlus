import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { HttpError } from '../../core/http.js';
import { DriveConexaoStore } from './store.js';

// Leitura da pasta da rep no Google Drive (só leitura), sem biblioteca do Google.
// Alguém da administração toca em "Conectar com Google" e entra UMA vez com a conta da rep
// (OAuth 2.0 com acesso offline). O refresh token fica no banco, criptografado, e serve a
// todos os moradores: o navegador nunca fala com o Google, pede tudo a /api/documentos/drive/...
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — cliente OAuth "Aplicativo da Web" do Google Cloud
// Endereço de retorno cadastrado no Google: <endereço do app>/api/documentos/drive/callback

const API = 'https://www.googleapis.com/drive/v3';
const URL_AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_REVOGAR = 'https://oauth2.googleapis.com/revoke';
const ESCOPO = 'https://www.googleapis.com/auth/drive.readonly';
export const TIPO_PASTA = 'application/vnd.google-apps.folder';
const CAMPOS = 'id,name,mimeType,size,modifiedTime,parents,webViewLink,thumbnailLink';
const ID_VALIDO = /^[\w-]{10,200}$/;

// Documentos, planilhas, apresentações e desenhos do Google não têm arquivo: saem em PDF
const EXPORTA_PDF = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing'
]);

const cliente = () => ({ id: process.env.GOOGLE_CLIENT_ID?.trim(), segredo: process.env.GOOGLE_CLIENT_SECRET?.trim() });
export const oauthConfigurado = () => Boolean(cliente().id && cliente().segredo);

function exigirOauth() {
  if (!oauthConfigurado()) {
    throw new HttpError(503, 'Login com Google não configurado: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (veja docs/deploy.md).');
  }
}

// ===== REFRESH TOKEN CRIPTOGRAFADO =====
// Chave derivada do segredo do cliente OAuth: quem lê só o banco não consegue usar o token
const chave = () => createHash('sha256').update(`repplus-drive:${cliente().segredo}`).digest();

function cifrar(texto) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return [iv, cifra.getAuthTag(), dados].map(parte => parte.toString('base64url')).join('.');
}

function decifrar(guardado) {
  try {
    const [iv, tag, dados] = guardado.split('.').map(parte => Buffer.from(parte, 'base64url'));
    const decifra = createDecipheriv('aes-256-gcm', chave(), iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8');
  } catch {
    return null; // GOOGLE_CLIENT_SECRET trocado: precisa conectar de novo
  }
}

// ===== LOGIN (OAuth) =====
export function urlDeLogin({ redirectUri, state }) {
  exigirOauth();
  const parametros = new URLSearchParams({
    client_id: cliente().id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPO,
    // offline + consent: o Google sempre devolve um refresh token, mesmo reconectando
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state
  });
  return `${URL_AUTORIZAR}?${parametros}`;
}

async function pedirToken(parametros) {
  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cliente().id, client_secret: cliente().segredo, ...parametros })
  });
  const dados = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok && Boolean(dados.access_token), dados };
}

// Volta do Google: troca o código pelos tokens e guarda a conexão
export async function concluirLogin({ code, redirectUri }) {
  exigirOauth();
  const { ok, dados } = await pedirToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  if (!ok) {
    console.error('Drive: o Google recusou o código de login:', dados.error, dados.error_description);
    throw new HttpError(502, 'O Google recusou o login. Tente conectar de novo.');
  }
  if (!dados.refresh_token) throw new HttpError(502, 'O Google não devolveu o acesso permanente. Tente conectar de novo.');
  if (!String(dados.scope || '').includes(ESCOPO)) {
    throw new HttpError(400, 'É preciso permitir o acesso ao Google Drive. Conecte de novo e marque a permissão.');
  }

  const sobre = await (await chamar(urlApi('/about', { fields: 'user(emailAddress)' }), { token: dados.access_token })).json();
  const email = sobre.user?.emailAddress || null;
  const anterior = await DriveConexaoStore.get();
  let conexao = await DriveConexaoStore.conectar({ refreshToken: cifrar(dados.refresh_token), email });
  // Reconectou a mesma conta (ex.: a conexão caiu): continua na pasta que já estava escolhida
  if (anterior?.pastaId && email && anterior.email === email) {
    conexao = await DriveConexaoStore.update({ pastaId: anterior.pastaId, pastaNome: anterior.pastaNome });
  }
  guardarToken(conexao, dados);
  return conexao;
}

export async function desconectar() {
  const conexao = await DriveConexaoStore.get();
  if (!conexao) return;
  await DriveConexaoStore.remove();
  tokenEmCache = null;
  // Também tira o acesso no Google (se falhar, a autorização some da lista da conta mesmo assim
  // quando não for usada por 6 meses; dá para remover em myaccount.google.com/permissions)
  const refresh = decifrar(conexao.refreshToken);
  if (refresh) {
    await fetch(URL_REVOGAR, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }) })
      .catch(erro => console.error('Drive: erro ao revogar no Google:', erro.message));
  }
}

// ===== TOKEN DE ACESSO (vale 1 hora, renovado com o refresh token) =====
// Guardado por conexão (data de conexão): reconectar com outra conta invalida o anterior
let tokenEmCache = null;
const marcaDa = (conexao) => String(conexao.conectadoEm);

function guardarToken(conexao, dados) {
  tokenEmCache = { marca: marcaDa(conexao), valor: dados.access_token, expira: Date.now() + (dados.expires_in || 3600) * 1000 };
}

async function conexaoAtiva() {
  exigirOauth();
  const conexao = await DriveConexaoStore.get();
  if (!conexao) throw new HttpError(409, 'O Google Drive ainda não foi conectado.');
  if (conexao.erro) throw new HttpError(409, conexao.erro);
  return conexao;
}

async function obterToken(conexao) {
  if (tokenEmCache?.marca === marcaDa(conexao) && tokenEmCache.expira > Date.now() + 60_000) return tokenEmCache.valor;
  const refresh = decifrar(conexao.refreshToken);
  const { ok, dados } = refresh ? await pedirToken({ grant_type: 'refresh_token', refresh_token: refresh }) : { ok: false, dados: { error: 'invalid_grant' } };
  if (!ok) {
    console.error('Drive: não foi possível renovar o acesso:', dados.error, dados.error_description);
    if (dados.error === 'invalid_grant') {
      // Acesso revogado, senha da conta trocada, app em modo "Teste" (vence em 7 dias)...
      const erro = 'O Google desfez a conexão com o Drive. Conecte de novo em Documentos → Drive.';
      await DriveConexaoStore.update({ erro });
      throw new HttpError(409, erro);
    }
    throw new HttpError(502, 'O Google Drive não respondeu. Tente de novo em instantes.');
  }
  guardarToken(conexao, dados);
  return dados.access_token;
}

// ===== CHAMADAS À API =====
async function chamar(url, { token }) {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resposta.status === 404) throw new HttpError(404, 'Arquivo não encontrado no Drive.');
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    console.error('Drive: erro', resposta.status, url.toString().split('?')[0], corpo.slice(0, 300));
    if (resposta.status === 403 && corpo.includes('exportSizeLimitExceeded')) {
      throw new HttpError(400, 'Arquivo grande demais para converter em PDF. Abra no Google Drive.');
    }
    throw new HttpError(502, 'O Google Drive não respondeu. Tente de novo em instantes.');
  }
  return resposta;
}

const urlApi = (caminho, parametros) => {
  const url = new URL(`${API}${caminho}`);
  for (const [nome, valor] of Object.entries(parametros)) url.searchParams.set(nome, valor);
  return url;
};

// Metadados (pastas guardadas por 5 minutos: são consultadas a cada verificação de caminho)
const cache = new Map();
const VALIDADE_CACHE = 5 * 60 * 1000;
async function metadados(id, token) {
  const guardado = cache.get(id);
  if (guardado && guardado.expira > Date.now()) return guardado.item;
  const item = await (await chamar(urlApi(`/files/${encodeURIComponent(id)}`, { fields: CAMPOS, supportsAllDrives: 'true' }), { token })).json();
  if (item.mimeType === TIPO_PASTA) {
    if (cache.size > 500) cache.clear();
    cache.set(id, { item, expira: Date.now() + VALIDADE_CACHE });
  }
  return item;
}

// Caminho da pasta da rep até o item ([raiz, ..., pai]). O token enxerga o Drive inteiro da
// conta: o que estiver fora da pasta escolhida responde 404, como se não existisse
async function caminhoAte(item, raiz, token) {
  if (item.id === raiz) return [];
  const caminho = [];
  let atual = item;
  for (let nivel = 0; nivel < 20; nivel++) {
    const paiId = atual.parents?.[0];
    if (!paiId) break;
    const pai = await metadados(paiId, token);
    caminho.unshift(pai);
    if (pai.id === raiz) return caminho;
    atual = pai;
  }
  throw new HttpError(404, 'Arquivo não encontrado no Drive.');
}

async function itemDaRep(id) {
  const conexao = await conexaoAtiva();
  if (!conexao.pastaId) throw new HttpError(409, 'Falta escolher a pasta da rep no Drive.');
  if (!ID_VALIDO.test(String(id))) throw new HttpError(404, 'Arquivo não encontrado no Drive.');
  const token = await obterToken(conexao);
  const item = await metadados(id, token);
  const caminho = await caminhoAte(item, conexao.pastaId, token);
  return { item, caminho, token };
}

const pastaResumida = (pasta) => ({ id: pasta.id, nome: pasta.name });

function formatar(arquivo) {
  const pasta = arquivo.mimeType === TIPO_PASTA;
  return {
    id: arquivo.id,
    nome: arquivo.name,
    tipo: arquivo.mimeType,
    pasta,
    tamanho: arquivo.size ? Number(arquivo.size) : null,
    modificadoEm: arquivo.modifiedTime || null,
    link: arquivo.webViewLink || null,
    miniatura: Boolean(arquivo.thumbnailLink),
    // Abre dentro do app: imagens, PDFs e os documentos do Google (convertidos em PDF)
    visualizavel: !pasta && (arquivo.mimeType.startsWith('image/') || arquivo.mimeType === 'application/pdf' || EXPORTA_PDF.has(arquivo.mimeType)),
    baixavel: !pasta && (!arquivo.mimeType.startsWith('application/vnd.google-apps.') || EXPORTA_PDF.has(arquivo.mimeType))
  };
}

async function listar(q, token, { limite = 1000 } = {}) {
  const arquivos = [];
  let pagina;
  do {
    const parametros = {
      q, fields: `nextPageToken,files(${CAMPOS})`, orderBy: 'folder,name_natural', pageSize: '200',
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'
    };
    if (pagina) parametros.pageToken = pagina;
    const dados = await (await chamar(urlApi('/files', parametros), { token })).json();
    arquivos.push(...(dados.files || []));
    pagina = dados.nextPageToken;
  } while (pagina && arquivos.length < limite);
  return arquivos;
}

// ===== O QUE AS ROTAS USAM =====
export async function statusDrive() {
  if (!oauthConfigurado()) return { configurado: false, conectado: false };
  const conexao = await DriveConexaoStore.get();
  return {
    configurado: true,
    conectado: Boolean(conexao),
    email: conexao?.email || null,
    pasta: conexao?.pastaId ? { id: conexao.pastaId, nome: conexao.pastaNome } : null,
    erro: conexao?.erro || null
  };
}

// Conteúdo de uma pasta da rep (a raiz, se não vier id): pastas primeiro, depois por nome
export async function listarPasta(id) {
  const conexao = await conexaoAtiva();
  const { item: pasta, caminho, token } = await itemDaRep(id || conexao.pastaId);
  if (pasta.mimeType !== TIPO_PASTA) throw new HttpError(400, 'Isso não é uma pasta.');
  const arquivos = await listar(`'${pasta.id}' in parents and trashed = false`, token);
  return {
    pasta: { ...pastaResumida(pasta), link: pasta.webViewLink || null },
    caminho: caminho.map(pastaResumida),
    itens: arquivos.map(formatar)
  };
}

// Escolha da pasta da rep (só administração): navega por todo o Drive da conta, só pastas.
// 'root' = Meu Drive; 'compartilhados' = pastas compartilhadas com a conta
export async function listarPastasParaEscolher(id = 'root') {
  const conexao = await conexaoAtiva();
  const token = await obterToken(conexao);
  if (id === 'compartilhados') {
    const pastas = await listar(`sharedWithMe and mimeType = '${TIPO_PASTA}' and trashed = false`, token, { limite: 400 });
    return { pasta: { id: 'compartilhados', nome: 'Compartilhados comigo' }, itens: pastas.map(formatar) };
  }
  if (id !== 'root' && !ID_VALIDO.test(String(id))) throw new HttpError(404, 'Pasta não encontrada.');
  const pasta = await metadados(id, token);
  if (pasta.mimeType !== TIPO_PASTA) throw new HttpError(400, 'Isso não é uma pasta.');
  const pastas = await listar(`'${pasta.id}' in parents and mimeType = '${TIPO_PASTA}' and trashed = false`, token, { limite: 400 });
  return { pasta: { id: pasta.id, nome: id === 'root' ? 'Meu Drive' : pasta.name }, itens: pastas.map(formatar) };
}

export async function escolherPasta(id) {
  const conexao = await conexaoAtiva();
  if (!ID_VALIDO.test(String(id))) throw new HttpError(400, 'Pasta inválida.');
  const pasta = await metadados(id, await obterToken(conexao));
  if (pasta.mimeType !== TIPO_PASTA) throw new HttpError(400, 'Isso não é uma pasta.');
  await DriveConexaoStore.update({ pastaId: pasta.id, pastaNome: pasta.name });
  return statusDrive();
}

// Conteúdo de um arquivo da rep, para o servidor repassar ao navegador
export async function abrirArquivo(id) {
  const { item, token } = await itemDaRep(id);
  if (item.mimeType === TIPO_PASTA) throw new HttpError(400, 'Isso é uma pasta.');
  const idUrl = encodeURIComponent(item.id);

  if (EXPORTA_PDF.has(item.mimeType)) {
    const resposta = await chamar(urlApi(`/files/${idUrl}/export`, { mimeType: 'application/pdf' }), { token });
    return { resposta, tipo: 'application/pdf', nome: `${item.name}.pdf` };
  }
  if (item.mimeType.startsWith('application/vnd.google-apps.')) {
    throw new HttpError(400, 'Esse tipo de arquivo só abre no Google Drive.');
  }
  const resposta = await chamar(urlApi(`/files/${idUrl}`, { alt: 'media', supportsAllDrives: 'true' }), { token });
  return { resposta, tipo: item.mimeType, nome: item.name };
}

// Miniatura gerada pelo Google (o link dele é temporário e exige o token)
export async function abrirMiniatura(id) {
  const { item, token } = await itemDaRep(id);
  if (!item.thumbnailLink) throw new HttpError(404, 'Sem miniatura.');
  return chamar(item.thumbnailLink.replace(/=s\d+$/, '=s400'), { token });
}
