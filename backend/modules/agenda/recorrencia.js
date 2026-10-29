// Expansão de eventos que se repetem em ocorrências dentro de um período.
//
// A série guarda só o primeiro evento + a regra; cada ocorrência é calculada na consulta.
// As contas de calendário são feitas no horário da casa (Brasília, offset fixo -03:00):
// a ocorrência mantém o mesmo horário local e a mesma duração da primeira.

export const RECORRENCIAS = ['semanal', 'quinzenal', 'mensal', 'anual'];

// Duração máxima de cada ocorrência, para uma não sobrepor a seguinte
export const DURACAO_MAXIMA_POR_RECORRENCIA = { semanal: 6, quinzenal: 13, mensal: 27, anual: 31 };

const DIA_MS = 86400000;
const FUSO_CASA = 'America/Sao_Paulo';
const LIMITE_OCORRENCIAS = 5000; // trava de segurança (≈ 100 anos de um evento semanal)

export const diaNaCasa = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO_CASA });

const paraData = (dia) => new Date(`${dia}T00:00:00Z`);
const diasEntre = (de, ate) => Math.round((paraData(ate) - paraData(de)) / DIA_MS);
const somarDias = (dia, n) => new Date(paraData(dia).getTime() + n * DIA_MS).toISOString().slice(0, 10);

// Mesmo dia do mês `n` meses depois; se o mês for mais curto, cai no último dia (31 -> 30, 28/29)
function somarMeses(dia, n) {
  const [ano, mes, d] = dia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes - 1 + n, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

// n-ésima repetição (0 = o próprio primeiro dia)
function diaDaOcorrencia(primeiroDia, recorrencia, n) {
  if (recorrencia === 'semanal') return somarDias(primeiroDia, 7 * n);
  if (recorrencia === 'quinzenal') return somarDias(primeiroDia, 14 * n);
  if (recorrencia === 'mensal') return somarMeses(primeiroDia, n);
  return somarMeses(primeiroDia, 12 * n); // anual (29/02 vira 28/02 nos anos não bissextos)
}

// Primeiro n que pode cair no período, para não percorrer anos de histórico à toa
function primeiroIndice(primeiroDia, recorrencia, diaInicioPeriodo) {
  const dias = diasEntre(primeiroDia, diaInicioPeriodo);
  if (dias <= 0) return 0;
  const aproximado = { semanal: dias / 7, quinzenal: dias / 14, mensal: dias / 31, anual: dias / 366 }[recorrencia];
  return Math.max(0, Math.floor(aproximado) - 1);
}

// Ocorrências de um evento recorrente que acontecem (total ou parcialmente) em [de, ate)
export function expandirOcorrencias(evento, de, ate) {
  const inicioSerie = new Date(evento.inicio).getTime();
  const duracao = evento.fim ? new Date(evento.fim).getTime() - inicioSerie : 0;
  const primeiroDia = diaNaCasa(evento.inicio);
  const limiteDe = new Date(de).getTime();
  const limiteAte = new Date(ate).getTime();
  const excecoes = new Set(evento.excecoes || []);
  const ocorrencias = [];

  for (let n = primeiroIndice(primeiroDia, evento.recorrencia, diaNaCasa(de)), i = 0; i < LIMITE_OCORRENCIAS; n++, i++) {
    const dia = diaDaOcorrencia(primeiroDia, evento.recorrencia, n);
    if (evento.recorrenciaAte && dia > evento.recorrenciaAte) break;

    const inicio = inicioSerie + diasEntre(primeiroDia, dia) * DIA_MS;
    if (inicio >= limiteAte) break;
    if (inicio + duracao < limiteDe || excecoes.has(dia)) continue;

    ocorrencias.push({
      ...evento,
      inicio: new Date(inicio).toISOString(),
      fim: evento.fim ? new Date(inicio + duracao).toISOString() : null,
      ocorrencia: dia,
      serieInicio: evento.inicio,
      serieFim: evento.fim
    });
  }
  return ocorrencias;
}
