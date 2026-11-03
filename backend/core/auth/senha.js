import crypto from 'crypto';
import express from 'express';

// Login pela senha da casa (AUTH_MODO=senha): uma senha única da república, na variável
// SENHA_CASA. Quem acerta recebe um cookie assinado com SESSAO_SEGREDO que vale 30 dias.
// Trocar a SENHA_CASA (ou o SESSAO_SEGREDO) desconecta todos os aparelhos.
const COOKIE = 'repplus_sessao';
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

// Tentativas erradas por IP: depois de 10 em 15 minutos, recusa até a janela passar
const JANELA_MS = 15 * 60 * 1000;
const MAX_ERROS = 10;
const erros = new Map(); // ip -> { quantidade, desde }

function chave() {
  return crypto.createHmac('sha256', process.env.SESSAO_SEGREDO).update(process.env.SENHA_CASA).digest();
}

const assinar = (texto) => crypto.createHmac('sha256', chave()).update(texto).digest('base64url');

export function conferirConfiguracao() {
  if (!process.env.SENHA_CASA) throw new Error('AUTH_MODO=senha: defina SENHA_CASA (a senha da república).');
  if ((process.env.SESSAO_SEGREDO || '').length < 32) {
    throw new Error('AUTH_MODO=senha: defina SESSAO_SEGREDO com pelo menos 32 caracteres aleatórios.');
  }
}

function lerCookie(req) {
  const cabecalho = req.headers.cookie || '';
  for (const parte of cabecalho.split(';')) {
    const [nome, ...valor] = parte.trim().split('=');
    if (nome === COOKIE) return valor.join('=');
  }
  return null;
}

// Token = "<expira em ms>.<assinatura>"; devolve true se a assinatura confere e não venceu
export function sessaoValida(req) {
  const token = lerCookie(req);
  if (!token) return false;
  const [expira, assinatura] = token.split('.');
  if (!expira || !assinatura || Number(expira) < Date.now()) return false;
  const esperada = Buffer.from(assinar(expira));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && crypto.timingSafeEqual(esperada, recebida);
}

function gravarCookie(req, res, valor, maxAgeMs) {
  res.cookie(COOKIE, valor, {
    httpOnly: true,
    // No Render a conexão chega por HTTPS no proxy (trust proxy em app.js); localmente é http
    secure: req.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs
  });
}

function senhaConfere(senha) {
  // Compara os resumos (mesmo tamanho) para não vazar o tamanho da senha pelo tempo de resposta
  const resumo = (texto) => crypto.createHash('sha256').update(String(texto)).digest();
  return crypto.timingSafeEqual(resumo(senha), resumo(process.env.SENHA_CASA));
}

function bloqueado(ip) {
  const registro = erros.get(ip);
  if (!registro) return false;
  if (Date.now() - registro.desde > JANELA_MS) {
    erros.delete(ip);
    return false;
  }
  return registro.quantidade >= MAX_ERROS;
}

function registrarErro(ip) {
  const registro = erros.get(ip);
  if (!registro || Date.now() - registro.desde > JANELA_MS) erros.set(ip, { quantidade: 1, desde: Date.now() });
  else registro.quantidade += 1;
}

// POST /api/auth/entrar { senha }  e  POST /api/auth/sair
export function rotasLogin() {
  const router = express.Router();

  router.post('/entrar', (req, res) => {
    if (bloqueado(req.ip)) {
      return res.status(429).json({ error: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.' });
    }
    const senha = req.body?.senha;
    if (typeof senha !== 'string' || !senha || !senhaConfere(senha)) {
      registrarErro(req.ip);
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    erros.delete(req.ip);
    const expira = String(Date.now() + VALIDADE_MS);
    gravarCookie(req, res, `${expira}.${assinar(expira)}`, VALIDADE_MS);
    res.json({ ok: true });
  });

  router.post('/sair', (req, res) => {
    gravarCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  return router;
}
