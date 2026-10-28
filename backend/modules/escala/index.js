import { rotasComodos } from './rotas/comodos.js';
import { rotasEscala } from './rotas/escala.js';
import { rotasInfracoes } from './rotas/infracoes.js';
import { rotasMotivacao } from './rotas/motivacao.js';

// Módulo: escala de limpeza (cômodos, rodízio semanal, infrações e imagens motivacionais)
export default {
  id: 'escala',
  nome: 'Escala de Limpeza',
  permissoes: {
    'escala:ver': { descricao: 'Ver a escala atual, o histórico e os cômodos', papeis: ['morador'] },
    'escala:gerar': { descricao: 'Gerar a escala da semana', papeis: [] },
    'escala:gerenciar': { descricao: 'Editar, trocar ou excluir semanas da escala', papeis: [] },
    'comodos:gerenciar': { descricao: 'Adicionar, editar e remover cômodos', papeis: [] },
    'infracoes:ver': { descricao: 'Ver o quadro de infrações', papeis: ['morador'] },
    'infracoes:registrar': { descricao: 'Registrar infrações', papeis: ['morador'] },
    'infracoes:gerenciar': { descricao: 'Editar e remover infrações', papeis: [] },
    'motivacao:gerenciar': { descricao: 'Gerenciar a galeria de imagens motivacionais', papeis: [] }
  },

  rotas(router) {
    rotasComodos(router);
    rotasEscala(router);
    rotasInfracoes(router);
    rotasMotivacao(router);
  }
};
