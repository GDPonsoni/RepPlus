// Provedor de DEMONSTRAÇÃO: simula um banco com conta corrente e caixinha, para testar a
// sincronização, a deduplicação e as regras sem Open Finance. Só aparece com
// FINANCAS_PROVEDOR_DEMO=1 (o servidor local de testes liga; produção não).
//
// Os lançamentos são gerados a partir da data (sempre os mesmos para o mesmo dia), então
// sincronizar duas vezes não duplica nada.

const DIA_MS = 86400000;
const hojeNaCasa = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somarDias = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

// Número pseudo-aleatório estável a partir de um texto
function sorteio(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const DIA_A_DIA = [
  ['IFOOD *PIZZARIA BELLA', -4590], ['UBER *TRIP', -1890], ['PAO DE ACUCAR 1234', -18734], ['DROGASIL 0456', -3290],
  ['CARREFOUR HIPER', -26410], ['POSTO SHELL', -12000], ['IFOOD *MC DONALDS', -5280], ['PADARIA SAO JOSE', -2350],
  ['ZE DELIVERY', -8900], ['LOJA DE MATERIAIS SILVA', -7400], ['99APP *CORRIDA', -1430], ['MERCADINHO DO BAIRRO', -4120]
];
const MENSAIS = [
  [5, 'PIX ENVIADO ALUGUEL IMOVEIS LAR', -350000], [10, 'CPFL ENERGIA CONTA', -41230], [12, 'SANASA AGUA', -18950],
  [15, 'VIVO FIBRA INTERNET', -11990], [15, 'NETFLIX.COM', -5590], [20, 'COMGAS', -9870]
];

function gerarCorrente(dia) {
  const lista = [];
  const diaDoMes = Number(dia.slice(8));
  MENSAIS.filter(([d]) => d === diaDoMes).forEach(([, descricao, valor]) => lista.push({ descricao, valor }));
  // Rateio: moradores mandam a parte do mês nos primeiros dias
  if (diaDoMes >= 1 && diaDoMes <= 5) lista.push({ descricao: `PIX RECEBIDO MORADOR ${diaDoMes}`, valor: 145000 });
  const quantos = Math.floor(sorteio(`${dia}-qtd`) * 3);
  for (let i = 0; i < quantos; i++) {
    const [descricao, base] = DIA_A_DIA[Math.floor(sorteio(`${dia}-${i}`) * DIA_A_DIA.length)];
    lista.push({ descricao, valor: Math.round(base * (0.7 + sorteio(`${dia}-${i}-v`) * 0.6)) });
  }
  return lista.map((t, i) => ({ ...t, data: dia, externoId: `demo-cc-${dia}-${i}` }));
}

function gerarCaixinha(dia) {
  const diaDoMes = Number(dia.slice(8));
  const lista = [];
  if (diaDoMes === 6) lista.push({ descricao: 'APLICACAO CAIXINHA RESERVA', valor: 30000 });
  if (diaDoMes === 28) lista.push({ descricao: 'RENDIMENTO CAIXINHA', valor: Math.round(1800 + sorteio(dia) * 400) });
  return lista.map((t, i) => ({ ...t, data: dia, externoId: `demo-cx-${dia}-${i}` }));
}

const CONTAS = [
  { externoId: 'demo-cc', nome: 'Conta da casa', instituicao: 'Banco Demonstração', tipo: 'corrente', saldoBase: 450000, gerar: gerarCorrente },
  { externoId: 'demo-cx', nome: 'Caixinha reserva', instituicao: 'Banco Demonstração', tipo: 'caixinha', saldoBase: 800000, gerar: gerarCaixinha }
];
const INICIO = () => somarDias(hojeNaCasa(), -120);

function transacoesAte(conta, ate) {
  const lista = [];
  for (let dia = INICIO(); dia <= ate; dia = somarDias(dia, 1)) lista.push(...conta.gerar(dia));
  return lista;
}

export default {
  id: 'demo',
  nome: 'Banco de demonstração',
  descricao: 'Simula um banco com conta corrente e caixinha para testar a sincronização (só no ambiente de testes).',
  comoConfigurar: 'Disponível apenas no servidor local de testes (FINANCAS_PROVEDOR_DEMO=1).',
  configurado: () => process.env.FINANCAS_PROVEDOR_DEMO === '1',
  oculto: () => process.env.FINANCAS_PROVEDOR_DEMO !== '1',

  async conectar() {
    return { externoId: `demo-${Date.now()}`, instituicao: 'Banco Demonstração' };
  },
  async contas() {
    const hoje = hojeNaCasa();
    return CONTAS.map(({ externoId, nome, instituicao, tipo, saldoBase }, i) => ({
      externoId, nome, instituicao, tipo,
      saldo: saldoBase + transacoesAte(CONTAS[i], hoje).reduce((soma, t) => soma + t.valor, 0)
    }));
  },
  async transacoes(conexao, conta, desde) {
    const definicao = CONTAS.find(c => c.externoId === conta.externoId);
    return definicao ? transacoesAte(definicao, hojeNaCasa()).filter(t => t.data >= desde) : [];
  }
};
