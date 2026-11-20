import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { errorHandler, asyncHandler } from './core/http.js';
import { carregarContexto, AUTH_MODO } from './core/auth/sessao.js';
import { rotasLogin } from './core/auth/senha.js';
import { enviarMidia } from './core/storage.js';
import { montarModulos } from './core/modulos.js';
import sistema from './core/sistema.js';
import moradores from './core/moradores/index.js';
import configuracao from './core/configuracao/index.js';
import categorias from './core/categorias/index.js';
import escala from './modules/escala/index.js';
import agenda from './modules/agenda/index.js';
import compras from './modules/compras/index.js';
import anotacoes from './modules/anotacoes/index.js';
import atas from './modules/atas/index.js';
import financas from './modules/financas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Núcleo primeiro, depois os módulos de funcionalidade. Para adicionar um módulo novo
// (financeiro, eventos...), crie modules/<nome>/index.js e inclua-o aqui.
const MODULOS = [sistema, moradores, configuracao, categorias, escala, agenda, compras, anotacoes, atas, financas];

export function createApp() {
  const app = express();

  // No Render o app fica atrás de um proxy HTTPS: assim req.secure e req.ip são os do usuário
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
    next();
  });

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../frontend')));

  // Entrar e sair com a senha da casa (só no AUTH_MODO=senha); respondem sem estar logado
  if (AUTH_MODO === 'senha') app.use('/api/auth', rotasLogin());

  // Toda rota da API recebe req.contexto (usuário, permissões) antes de chegar ao módulo.
  // Num modo com login, quem não entrou para aqui com 401
  app.use('/api', carregarContexto);

  // Imagens do bucket privado (R2), só para quem entrou
  app.get('/api/midia/:chave', asyncHandler(enviarMidia));
  montarModulos(app, MODULOS);

  // Nenhuma rota respondeu (endereço errado ou módulo desativado)
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  app.use(errorHandler);
  return app;
}
