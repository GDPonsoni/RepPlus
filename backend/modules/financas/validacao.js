import { HttpError } from '../../core/http.js';
import { categoriaExiste } from '../../core/categorias/index.js';

export const ESCOPO_CATEGORIAS = 'financas';
// Categorias que não contam como gasto nem como entrada (dinheiro só mudou de lugar)
export const CATEGORIAS_NEUTRAS = ['transferencia', 'ajuste'];

const DIA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const diaValido = (valor) => DIA_REGEX.test(String(valor)) && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
export const hojeNaCasa = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function lerTexto(valor, campo, limite, { obrigatorio = false } = {}) {
  const texto = String(valor ?? '').trim();
  if (obrigatorio && !texto) throw new HttpError(400, `Preencha ${campo}.`);
  if (texto.length > limite) throw new HttpError(400, `${campo} pode ter no máximo ${limite} caracteres.`);
  return texto || null;
}

// Centavos inteiros, sem zero; limite de 100 milhões de reais
export function lerCentavos(valor, campo, { positivo = false } = {}) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero === 0 || Math.abs(numero) > 1e10) throw new HttpError(400, `${campo} inválido (use centavos inteiros, diferente de zero).`);
  if (positivo && numero < 0) throw new HttpError(400, `${campo} deve ser positivo.`);
  return numero;
}

export function lerDia(valor, campo) {
  if (!diaValido(valor)) throw new HttpError(400, `${campo} inválida. Use AAAA-MM-DD.`);
  return valor;
}

export async function lerCategoria(valor) {
  if (valor === null || valor === '' || valor === undefined) return null;
  if (!(await categoriaExiste(ESCOPO_CATEGORIAS, valor))) throw new HttpError(400, 'Categoria inválida.');
  return valor;
}
