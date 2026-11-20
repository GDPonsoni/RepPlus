// Categorização automática: "se a descrição contém <termo> (e, opcionalmente, é uma saída ou uma
// entrada), a categoria é <categoria>". Vale para lançamentos importados e para os manuais sem
// categoria. Quando duas regras batem, vence o termo mais longo (o mais específico: "UBER EATS"
// ganha de "UBER"); empatado, vence a que restringe o sentido.

export const normalizar = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export const sentidoDe = (valor) => (valor < 0 ? 'saida' : 'entrada');

export const regraBate = (regra, descricaoNormalizada, valor) =>
  descricaoNormalizada.includes(normalizar(regra.termo)) && (!regra.sentido || regra.sentido === sentidoDe(valor));

// A regra que decide a categoria de um lançamento { descricao, valor } (ou undefined)
export function regraQueVence(lancamento, regras) {
  const alvo = normalizar(lancamento.descricao);
  return regras
    .filter(regra => regraBate(regra, alvo, lancamento.valor))
    .sort((a, b) => normalizar(b.termo).length - normalizar(a.termo).length || Boolean(b.sentido) - Boolean(a.sentido))[0];
}

export const categorizar = (lancamento, regras) => regraQueVence(lancamento, regras)?.categoria ?? null;

// ===== AGRUPAR LANÇAMENTOS PARECIDOS (sugestões de regra) =====
// Começos genéricos que sozinhos não dizem nada ("PIX ENVIADO"): o termo inclui quem vem depois
const PREFIXOS_GENERICOS = [
  'pix enviado', 'pix recebido', 'pix', 'ted enviada', 'ted recebida', 'ted', 'doc', 'transferencia enviada',
  'transferencia recebida', 'transferencia', 'compra no debito', 'compra no credito', 'compra', 'pagamento de',
  'pagamento', 'pagto', 'pag', 'debito automatico', 'deb aut', 'boleto', 'pg', 'pgto'
];

// Termo que representa a descrição: palavras sem números nem símbolos, até 2 depois do prefixo
// genérico (ou as 2 primeiras). Precisa ser um trecho contínuo da descrição para a regra "contém" bater.
export function termoDoGrupo(descricao) {
  const palavras = [];
  for (const palavra of normalizar(descricao).split(' ')) {
    if (/[\d*#/]/.test(palavra) || !/[a-z]/.test(palavra)) break;
    palavras.push(palavra);
  }
  const texto = palavras.join(' ');
  const prefixo = PREFIXOS_GENERICOS.find(p => texto === p || texto.startsWith(`${p} `));
  const quantas = (prefixo ? prefixo.split(' ').length : 0) + 2;
  const termo = palavras.slice(0, quantas).join(' ');
  return termo.length >= 3 ? termo : null;
}

// Sugestões para começar (Ajustes > Regras > "Adicionar sugeridas")
export const REGRAS_SUGERIDAS = [
  ['ifood', 'alimentacao'], ['rappi', 'alimentacao'], ['uber eats', 'alimentacao'], ['ze delivery', 'alimentacao'],
  ['uber', 'transporte'], ['99app', 'transporte'], ['99 taxi', 'transporte'], ['posto', 'transporte'], ['shell', 'transporte'],
  ['carrefour', 'mercado'], ['pao de acucar', 'mercado'], ['assai', 'mercado'], ['atacadao', 'mercado'], ['supermercado', 'mercado'],
  ['enel', 'energia'], ['cpfl', 'energia'], ['cemig', 'energia'], ['light s', 'energia'], ['energisa', 'energia'],
  ['sabesp', 'agua'], ['sanasa', 'agua'], ['brk ambiental', 'agua'], ['sanepar', 'agua'], ['copasa', 'agua'], ['comgas', 'gas'],
  ['vivo', 'internet'], ['claro', 'internet'], ['tim ', 'internet'], ['oi fibra', 'internet'], ['telefonica', 'internet'],
  ['netflix', 'assinaturas'], ['spotify', 'assinaturas'], ['amazon prime', 'assinaturas'], ['disney', 'assinaturas'], ['hbo', 'assinaturas'],
  ['aluguel', 'moradia'], ['condominio', 'moradia'], ['drogasil', 'saude'], ['droga raia', 'saude'], ['farmacia', 'saude'],
  // Dinheiro que só muda de lugar: não é gasto nem entrada
  ['pagamento de fatura', 'transferencia'], ['pagto fatura', 'transferencia'], ['pagamento fatura', 'transferencia'],
  ['aporte', 'transferencia'], ['cofrinho', 'transferencia'], ['aplicacao', 'transferencia'], ['resgate', 'transferencia'],
  ['pix recebido', 'receitas', 'entrada'], ['ted recebida', 'receitas', 'entrada'], ['rendimento', 'receitas', 'entrada']
].map(([termo, categoria, sentido = null]) => ({ termo, categoria, sentido }));
