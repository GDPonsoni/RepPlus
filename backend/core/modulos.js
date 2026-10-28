import express from 'express';
import { registrarPermissoes } from './auth/permissoes.js';

// Contrato de um módulo (núcleo ou funcionalidade):
//
//   export default {
//     id: 'escala',                       // identificador único, usado no frontend também
//     nome: 'Escala de Limpeza',
//     nucleo: false,                      // true = sempre ativo (moradores, configuração...)
//     permissoes: {                       // permissões que as rotas do módulo exigem
//       'escala:gerar': { descricao: 'Gerar a escala da semana', papeis: ['admin'] }
//     },
//     rotas(router) { ... }               // registra as rotas em um express.Router (montado em /api)
//   };
//
// Para adicionar um módulo novo: criar modules/<nome>/index.js e incluí-lo em MODULOS no app.js.

let modulosMontados = [];

export function montarModulos(app, modulos) {
  // Primeiro registra todas as permissões, para que um módulo possa exigir permissões declaradas por outro
  modulos.forEach(modulo => registrarPermissoes(modulo.id, modulo.permissoes));

  modulos.forEach(modulo => {
    const router = express.Router();
    modulo.rotas(router);
    app.use('/api', router);
  });

  modulosMontados = modulos;
}

export function listarModulos() {
  return modulosMontados.map(({ id, nome, nucleo = false }) => ({ id, nome, nucleo }));
}
