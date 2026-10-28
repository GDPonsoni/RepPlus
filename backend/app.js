import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { errorHandler } from './core/http.js';
import { carregarContexto } from './core/auth/sessao.js';
import { montarModulos } from './core/modulos.js';
import sistema from './core/sistema.js';
import moradores from './core/moradores/index.js';
import configuracao from './core/configuracao/index.js';
import escala from './modules/escala/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Núcleo primeiro, depois os módulos de funcionalidade. Para adicionar um módulo novo
// (financeiro, eventos...), crie modules/<nome>/index.js e inclua-o aqui.
const MODULOS = [sistema, moradores, configuracao, escala];

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../frontend')));

  // Toda rota da API recebe req.contexto (usuário, permissões) antes de chegar ao módulo
  app.use('/api', carregarContexto);
  montarModulos(app, MODULOS);

  app.use(errorHandler);
  return app;
}
