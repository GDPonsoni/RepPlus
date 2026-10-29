import express from 'express';
import { registrarPermissoes } from './auth/permissoes.js';
import { ConfigStore } from './configuracao/store.js';

// Contrato de um módulo (núcleo ou funcionalidade):
//
//   export default {
//     id: 'escala',                       // identificador único, usado no frontend também
//     nome: 'Escala de Limpeza',
//     nucleo: false,                      // true = sempre ativo; false = pode ser desativado em Ajustes > Módulos
//     permissoes: {                       // permissões que as rotas do módulo exigem
//       'escala:gerar': { descricao: 'Gerar a escala da semana', papeis: ['admin'] }
//     },
//     rotas(router) { ... }               // registra as rotas em um express.Router (montado em /api)
//   };
//
// Para adicionar um módulo novo: criar modules/<nome>/index.js e incluí-lo em MODULOS no app.js.

let modulosMontados = [];

// ===== MÓDULOS DESATIVADOS =====
// A lista fica na tabela config (coluna modulos_desativados). Cada requisição consulta o cache;
// na Vercel há várias instâncias, então uma mudança leva até CACHE_MS para valer em todas.
const CACHE_MS = 15000;
let cache = { desativados: [], valeAte: 0 };

export async function modulosDesativados() {
  if (Date.now() < cache.valeAte) return cache.desativados;
  try {
    const { modulosDesativados: lista } = await ConfigStore.get();
    cache = { desativados: lista, valeAte: Date.now() + CACHE_MS };
  } catch (error) {
    // Sem conseguir ler, mantém o último valor conhecido (ou todos ativos)
    console.error('Erro ao ler os módulos desativados:', error);
  }
  return cache.desativados;
}

export async function definirModuloAtivo(id, ativo) {
  const config = await ConfigStore.get();
  const desativados = new Set(config.modulosDesativados);
  if (ativo) desativados.delete(id);
  else desativados.add(id);
  config.modulosDesativados = [...desativados];
  await ConfigStore.save(config);
  cache = { desativados: config.modulosDesativados, valeAte: Date.now() + CACHE_MS };
}

export function montarModulos(app, modulos) {
  // Primeiro registra todas as permissões, para que um módulo possa exigir permissões declaradas por outro
  modulos.forEach(modulo => registrarPermissoes(modulo.id, modulo.permissoes));

  modulos.forEach(modulo => {
    const router = express.Router();
    modulo.rotas(router);
    if (modulo.nucleo) {
      app.use('/api', router);
      return;
    }
    // Módulo desativado: as rotas dele simplesmente não existem (a requisição segue adiante e
    // termina no 404 da API). Os dados continuam no banco para quando for reativado.
    app.use('/api', async (req, res, next) => {
      try {
        if ((await modulosDesativados()).includes(modulo.id)) return next();
        router(req, res, next);
      } catch (error) {
        next(error);
      }
    });
  });

  modulosMontados = modulos;
}

// Todos os módulos montados, com `ativo` conforme a configuração
export async function listarModulos() {
  const desativados = await modulosDesativados();
  return modulosMontados.map(({ id, nome, nucleo = false }) => ({ id, nome, nucleo, ativo: nucleo || !desativados.includes(id) }));
}
