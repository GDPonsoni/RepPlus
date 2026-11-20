import { HttpError } from '../../../core/http.js';

// Pluggy (https://pluggy.ai), Open Finance pelo caminho GRATUITO "Meu Pluggy":
//   1. O titular autoriza os bancos em https://meu.pluggy.ai (até 5 conexões, uso pessoal).
//   2. No app, "Conectar banco" abre o widget Pluggy Connect (só com o conector MeuPluggy) e cada
//      banco vira um item. Também dá para colar o itemId de um item criado no Dashboard da Pluggy.
//   3. O backend autentica com PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET e lê contas e lançamentos.
// O Meu Pluggy atualiza os itens sozinho a cada 24h (não dá para forçar); a sincronização do app
// só lê o que já está lá. A autorização vale 1 ano: depois disso o item dá erro e é preciso
// autorizar de novo no Dashboard (o itemId pode mudar; conecte o novo e desconecte o antigo).
// O conector "Pluggy Bank" (sandbox, dados falsos) aparece no widget com PLUGGY_SANDBOX=1, para testar.

const API = 'https://api.pluggy.ai';
const WIDGET = 'https://cdn.pluggy.ai/pluggy-connect/v2.11.0/pluggy-connect.js';
const MEU_PLUGGY = 200;   // id do conector MeuPluggy (GET /connectors?name=MeuPluggy)
const SANDBOX = 2;        // "Pluggy Bank", banco de testes
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALIDADE_CHAVE_MS = 100 * 60 * 1000;   // a API key vale 2h; renova antes

const centavos = (valor) => Math.round(Number(valor || 0) * 100);
const diaNaCasa = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

let chave = null;   // { valor, expira }

async function obterChave() {
  if (chave && chave.expira > Date.now()) return chave.valor;
  const resposta = await fetch(`${API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    signal: AbortSignal.timeout(30000)
  });
  if (!resposta.ok) throw new Error(`A Pluggy recusou as credenciais (HTTP ${resposta.status}). Confira PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.`);
  chave = { valor: (await resposta.json()).apiKey, expira: Date.now() + VALIDADE_CHAVE_MS };
  return chave.valor;
}

async function pluggy(caminho, { metodo = 'GET', corpo, tentouDeNovo = false } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { 'X-API-KEY': await obterChave(), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  if (resposta.status === 401 && !tentouDeNovo) {
    chave = null;   // chave vencida antes da hora: pede outra uma vez
    return pluggy(caminho, { metodo, corpo, tentouDeNovo: true });
  }
  if (resposta.status === 404) throw new HttpError(404, 'Item não encontrado na Pluggy. Confira o itemId (Dashboard → Demo → Connected Items).');
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(`Pluggy respondeu HTTP ${resposta.status}${corpo.message ? `: ${corpo.message}` : ''}`);
  }
  return resposta.json();
}

// Erros do item que exigem ação de quem conectou (autorização vencida ou revogada)
function conferirItem(item) {
  const codigo = item.error?.code || item.executionStatus;
  if (codigo === 'USER_AUTHORIZATION_EXPIRED' || codigo === 'USER_AUTHORIZATION_REVOKED') {
    throw new Error('A autorização do banco venceu ou foi revogada. Autorize de novo no Meu Pluggy e no Dashboard da Pluggy, conecte o novo itemId e desconecte este.');
  }
  if (item.status === 'LOGIN_ERROR') throw new Error(`O banco recusou o acesso: ${item.error?.message || 'reconecte pelo Meu Pluggy'}.`);
}

// BANK/CHECKING -> corrente, BANK/SAVINGS -> caixinha, CREDIT -> cartão (saldo = fatura, sempre negativo)
function converterConta(conta, instituicao) {
  const cartao = conta.type === 'CREDIT';
  const tipo = cartao ? 'cartao' : conta.subtype === 'SAVINGS_ACCOUNT' ? 'caixinha' : 'corrente';
  const final = conta.number ? ` ${String(conta.number).slice(-4)}` : '';
  return {
    externoId: conta.id,
    nome: `${conta.marketingName || conta.name || 'Conta'}${cartao ? '' : final}`.slice(0, 60),
    instituicao,
    tipo,
    saldo: cartao ? -Math.abs(centavos(conta.balance)) : centavos(conta.balance)
  };
}

// Vários CDBs do mesmo banco vêm com o mesmo nome: tipo, taxa e vencimento diferenciam
function nomeInvestimento(i) {
  const taxa = i.rate ? ` ${i.rate}%${i.rateType ? ` ${i.rateType}` : ''}` : i.fixedAnnualRate ? ` ${i.fixedAnnualRate}% a.a.` : '';
  const vence = i.dueDate ? ` · vence ${diaNaCasa(i.dueDate).slice(5, 7)}/${diaNaCasa(i.dueDate).slice(0, 4)}` : '';
  return (i.subtype && (taxa || vence) ? `${i.subtype}${taxa}${vence}` : i.name || 'Investimento').slice(0, 60);
}

export default {
  id: 'pluggy',
  nome: 'Pluggy (Open Finance)',
  descricao: 'Bancos autorizados no Meu Pluggy (meu.pluggy.ai). Atualiza sozinho uma vez por dia.',
  comoConfigurar: 'Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET (Dashboard da Pluggy → Applications) no servidor.',
  configurado: () => Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET),
  // Pedidos ao conectar (o app mostra um campo para cada um)
  campos: [
    { id: 'nome', rotulo: 'Nome do banco (opcional)', ajuda: 'Ex.: Nubank da casa' },
    { id: 'itemId', rotulo: 'Item ID (opcional)', ajuda: 'Só se o item já foi criado no Dashboard da Pluggy. Vazio, abre o widget da Pluggy.', avancado: true }
  ],

  // Widget Pluggy Connect: o app carrega o script e abre com estas opções; o itemId volta no onSuccess
  async widget() {
    const { accessToken } = await pluggy('/connect_token', { metodo: 'POST', corpo: { options: { avoidDuplicates: true } } });
    const sandbox = process.env.PLUGGY_SANDBOX === '1';
    return {
      script: WIDGET,
      opcoes: { connectToken: accessToken, includeSandbox: sandbox, connectorIds: sandbox ? [MEU_PLUGGY, SANDBOX] : [MEU_PLUGGY] }
    };
  },

  async conectar(dados) {
    const itemId = String(dados.itemId || '').trim();
    if (!UUID_REGEX.test(itemId)) throw new HttpError(400, 'Item ID inválido. Ele tem o formato 0a1b2c3d-…, copie do Dashboard da Pluggy.');
    const item = await pluggy(`/items/${itemId}`);
    conferirItem(item);
    const nome = String(dados.nome || '').trim().slice(0, 60);
    return { externoId: item.id, instituicao: nome || item.connector?.name || 'Pluggy' };
  },

  async contas(conexao) {
    const item = await pluggy(`/items/${conexao.externoId}`);
    conferirItem(item);
    const instituicao = conexao.instituicao || item.connector?.name || 'Pluggy';
    const [{ results: contas }, investimentos] = await Promise.all([
      pluggy(`/accounts?itemId=${conexao.externoId}`),
      // Nem todo item tem investimentos (ou permissão para eles): sem isso, segue só com as contas
      pluggy(`/investments?itemId=${conexao.externoId}`).then(r => r.results || []).catch(() => [])
    ]);
    return [
      ...contas.map(conta => converterConta(conta, instituicao)),
      ...investimentos.filter(i => i.status !== 'TOTAL_WITHDRAWAL').map(i => ({
        externoId: i.id, nome: nomeInvestimento(i), instituicao, tipo: 'investimento', saldo: centavos(i.balance)
      }))
    ];
  },

  // Lançamentos confirmados desde `desde` (os pendentes ganham outro id quando confirmam).
  // Investimentos só têm saldo: o rendimento aparece na diferença, sem lançamentos.
  async transacoes(conexao, conta, desde) {
    if (conta.tipo === 'investimento') return [];
    // O "amount" já vem com o sinal do app (saída negativa), na conta e no cartão; o "type" não
    // serve (compra no cartão chega como CREDIT). Por garantia: cartão com fatura positiva usa a
    // convenção invertida, e aí os valores dele são invertidos
    const inverter = conta.tipo === 'cartao' && (await pluggy(`/accounts/${conta.externoId}`)).balance > 0;
    const lista = [];
    for (let pagina = 1, total = 1; pagina <= total; pagina++) {
      const resposta = await pluggy(`/transactions?accountId=${conta.externoId}&from=${desde}&pageSize=500&page=${pagina}`);
      total = resposta.totalPages || 1;
      lista.push(...resposta.results);
    }
    return lista
      .filter(t => t.status !== 'PENDING')
      .map(t => ({
        externoId: t.id,
        data: diaNaCasa(t.date),
        descricao: String(t.description || t.descriptionRaw || 'Lançamento').slice(0, 200),
        valor: inverter ? -centavos(t.amount) : centavos(t.amount)
      }));
  }
};
