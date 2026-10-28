// A casa fica no Brasil, mas a Vercel roda em UTC: a semana é sempre calculada no horário
// de Brasília (sem horário de verão desde 2019, então o offset é fixo).
const FUSO_CASA = 'America/Sao_Paulo';
const OFFSET_CASA = '-03:00';
export const DIA_MS = 86400000;

// Data de hoje (00:00 UTC) segundo o calendário de Brasília
export function hojeNaCasa() {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_CASA })
    .format(new Date())
    .split('-')
    .map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// Ano/semana no padrão ISO 8601 (correto em viradas de ano e anos bissextos)
export function getISOWeek(dataUtc) {
  const d = new Date(dataUtc);
  const dayNum = d.getUTCDay() || 7; // domingo=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // quinta é o dia de referência do ISO 8601
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / DIA_MS) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function getSemanaAtual() {
  const hoje = hojeNaCasa();
  const segunda = new Date(hoje - ((hoje.getUTCDay() || 7) - 1) * DIA_MS);
  const domingo = new Date(segunda.getTime() + 6 * DIA_MS);
  const meiaNoiteNaCasa = (dataUtc) => new Date(`${dataUtc.toISOString().slice(0, 10)}T00:00:00${OFFSET_CASA}`);
  const { year: ano, week: semana } = getISOWeek(segunda);
  return { ano, semana, dataInicio: meiaNoiteNaCasa(segunda), dataFim: meiaNoiteNaCasa(domingo) };
}
