// Pluggy (https://pluggy.ai) — AINDA NÃO IMPLEMENTADO. Este arquivo marca o lugar da integração.
//
// Roteiro (conferir na documentação da Pluggy antes de implementar):
//   1. Credenciais em variáveis de ambiente: PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.
//   2. Backend troca as credenciais por uma API key e gera um "connect token" para o app.
//   3. O app abre o widget Pluggy Connect com esse token; o morador entra no banco e o widget
//      devolve um itemId -> conectar({ itemId }) guarda como externoId da conexão.
//   4. contas(): lista as contas do item (corrente, cartão, investimentos) com saldo.
//   5. transacoes(): lista as transações de cada conta desde a data pedida, convertendo valores
//      para centavos (saída negativa) e datas para AAAA-MM-DD.
// A sincronização diária, a deduplicação (externoId) e a categorização por regras já existem.

const naoImplementado = () => { throw new Error('A integração com a Pluggy ainda não foi implementada.'); };

export default {
  id: 'pluggy',
  nome: 'Pluggy (Open Finance)',
  descricao: 'Conecta contas de bancos brasileiros pelo Open Finance e atualiza uma vez por dia.',
  comoConfigurar: 'Em breve: a integração será ligada quando houver credenciais da Pluggy (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).',
  configurado: () => false,
  conectar: naoImplementado,
  contas: naoImplementado,
  transacoes: naoImplementado
};
