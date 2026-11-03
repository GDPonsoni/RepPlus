import { banco } from './banco.js';

export const sameId = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

export const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return Boolean(value);
};

export const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Listas que crescem com o tempo são buscadas página por página (ordenadas pela chave, para
// nenhuma linha pular ou repetir entre páginas) até vir uma página menor que PAGINA.
const PAGINA = 1000;
export const selectAll = async (montarConsulta, { chave = 'id' } = {}) => {
  const linhas = [];
  for (;;) {
    const pagina = check(await montarConsulta().order(chave).range(linhas.length, linhas.length + PAGINA - 1));
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
};

// Busca uma linha pelo id direto no banco (ids que não são UUID nem chegam a consultar)
export const findRowById = async (table, id) => {
  if (!UUID_REGEX.test(String(id))) return null;
  return check(await banco.from(table).select('*').eq('id', id).maybeSingle());
};
