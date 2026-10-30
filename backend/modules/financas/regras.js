// Categorização automática: "se a descrição contém <termo>, a categoria é <categoria>".
// Vale para lançamentos importados e para os manuais sem categoria. Quando duas regras batem,
// vence o termo mais longo (o mais específico: "UBER EATS" ganha de "UBER").

export const normalizar = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export function categorizar(descricao, regras) {
  const alvo = normalizar(descricao);
  const encontrada = regras
    .filter(regra => alvo.includes(normalizar(regra.termo)))
    .sort((a, b) => normalizar(b.termo).length - normalizar(a.termo).length)[0];
  return encontrada?.categoria ?? null;
}

// Sugestões para começar (Ajustes > Regras > "Adicionar sugeridas")
export const REGRAS_SUGERIDAS = [
  ['ifood', 'alimentacao'], ['rappi', 'alimentacao'], ['uber eats', 'alimentacao'], ['ze delivery', 'alimentacao'],
  ['uber', 'transporte'], ['99app', 'transporte'], ['99 taxi', 'transporte'], ['posto', 'transporte'], ['shell', 'transporte'],
  ['carrefour', 'mercado'], ['pao de acucar', 'mercado'], ['assai', 'mercado'], ['atacadao', 'mercado'], ['supermercado', 'mercado'],
  ['enel', 'contas'], ['cpfl', 'contas'], ['cemig', 'contas'], ['light s', 'contas'], ['sabesp', 'contas'], ['sanasa', 'contas'],
  ['comgas', 'contas'], ['vivo', 'contas'], ['claro', 'contas'], ['tim ', 'contas'], ['oi fibra', 'contas'],
  ['netflix', 'assinaturas'], ['spotify', 'assinaturas'], ['amazon prime', 'assinaturas'], ['disney', 'assinaturas'], ['hbo', 'assinaturas'],
  ['aluguel', 'moradia'], ['condominio', 'moradia'], ['drogasil', 'saude'], ['droga raia', 'saude'], ['farmacia', 'saude']
].map(([termo, categoria]) => ({ termo, categoria }));
