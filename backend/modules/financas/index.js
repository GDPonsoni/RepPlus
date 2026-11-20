import rotasContas from './rotas/contas.js';
import rotasLancamentos from './rotas/lancamentos.js';
import rotasDivisoes from './rotas/divisoes.js';
import rotasAjustes from './rotas/ajustes.js';
import { ESCOPO_CATEGORIAS } from './validacao.js';

// Módulo: finanças da casa — contas (manuais ou via Open Finance), lançamentos categorizados,
// orçamentos, reserva de emergência e divisão de despesas entre moradores.
export default {
  id: 'financas',
  nome: 'Finanças',
  categorias: {
    [ESCOPO_CATEGORIAS]: {
      nome: 'Finanças (lançamentos)',
      permissaoVer: 'financas:ver', permissaoGerenciar: 'financas:gerenciar',
      tabela: 'fin_transacoes', coluna: 'categoria',
      subcategorias: true,
      padrao: [
        { chave: 'mercado', nome: 'Mercado', cor: '#ea580c', icone: 'fa-solid fa-basket-shopping' },
        { chave: 'comida', nome: 'Comida', cor: '#ea580c', icone: 'fa-solid fa-apple-whole', pai: 'mercado' },
        { chave: 'limpeza', nome: 'Limpeza', cor: '#0891b2', icone: 'fa-solid fa-spray-can-sparkles', pai: 'mercado' },
        { chave: 'higiene', nome: 'Higiene', cor: '#0d9488', icone: 'fa-solid fa-pump-soap', pai: 'mercado' },
        { chave: 'bebidas', nome: 'Bebidas', cor: '#a16207', icone: 'fa-solid fa-bottle-water', pai: 'mercado' },
        { chave: 'alimentacao', nome: 'Delivery / restaurante', cor: '#dc2626', icone: 'fa-solid fa-utensils' },
        { chave: 'moradia', nome: 'Aluguel e condomínio', cor: '#4f46e5', icone: 'fa-solid fa-house' },
        { chave: 'contas', nome: 'Contas da casa', cor: '#d97706', icone: 'fa-solid fa-bolt' },
        { chave: 'energia', nome: 'Energia', cor: '#eab308', icone: 'fa-solid fa-lightbulb', pai: 'contas' },
        { chave: 'agua', nome: 'Água', cor: '#0891b2', icone: 'fa-solid fa-faucet-drip', pai: 'contas' },
        { chave: 'gas', nome: 'Gás', cor: '#ea580c', icone: 'fa-solid fa-fire-flame-simple', pai: 'contas' },
        { chave: 'internet', nome: 'Internet e telefone', cor: '#2563eb', icone: 'fa-solid fa-wifi', pai: 'contas' },
        { chave: 'servicos', nome: 'Serviços', cor: '#9333ea', icone: 'fa-solid fa-user-gear' },
        { chave: 'assinaturas', nome: 'Assinaturas', cor: '#9333ea', icone: 'fa-solid fa-tv', pai: 'servicos' },
        { chave: 'diarista', nome: 'Diarista / empregada', cor: '#db2777', icone: 'fa-solid fa-broom', pai: 'servicos' },
        { chave: 'manutencao', nome: 'Manutenção', cor: '#a16207', icone: 'fa-solid fa-screwdriver-wrench' },
        { chave: 'transporte', nome: 'Transporte', cor: '#2563eb', icone: 'fa-solid fa-car' },
        { chave: 'lazer', nome: 'Lazer / festas', cor: '#db2777', icone: 'fa-solid fa-champagne-glasses' },
        { chave: 'saude', nome: 'Saúde', cor: '#0d9488', icone: 'fa-solid fa-stethoscope' },
        { chave: 'outros', nome: 'Outros gastos', cor: '#6b7280', icone: 'fa-solid fa-tag' },
        { chave: 'receitas', nome: 'Entradas / rateio', cor: '#16a34a', icone: 'fa-solid fa-money-bill' },
        { chave: 'transferencia', nome: 'Transferência entre contas', cor: '#64748b', icone: 'fa-solid fa-arrow-right-arrow-left' },
        { chave: 'ajuste', nome: 'Ajuste de saldo', cor: '#64748b', icone: 'fa-solid fa-scale-balanced' }
      ]
    }
  },
  permissoes: {
    'financas:ver': { descricao: 'Ver saldos, lançamentos, gráficos e divisões', papeis: ['morador'] },
    'financas:lancar': { descricao: 'Lançar gastos manuais e registrar/quitar divisões', papeis: ['morador'] },
    'financas:gerenciar': { descricao: 'Contas, conexões com bancos, regras, orçamentos e categorias', papeis: [] }
  },

  rotas(router) {
    rotasContas(router);
    rotasLancamentos(router);
    rotasDivisoes(router);
    rotasAjustes(router);
  }
};
