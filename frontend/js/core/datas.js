// Datas no horário da casa (Brasília), independente do fuso do aparelho.
// Dias são textos "AAAA-MM-DD"; a conta de calendário é feita em UTC para não sofrer com fuso.

export const FUSO_CASA = 'America/Sao_Paulo';
const OFFSET_CASA = '-03:00'; // sem horário de verão desde 2019
const DIA_MS = 86400000;

const paraData = (dia) => new Date(`${dia}T00:00:00Z`);
const paraDia = (data) => data.toISOString().slice(0, 10);

// Dia de hoje na casa
export function hoje() {
    return new Date().toLocaleDateString('en-CA', { timeZone: FUSO_CASA });
}

// Dia e hora (na casa) de um instante ISO vindo da API
export function diaDoInstante(iso) {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO_CASA });
}

export function horaDoInstante(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO_CASA, hour: '2-digit', minute: '2-digit' });
}

// Instante ISO (com o fuso da casa) para enviar à API
export function instante(dia, hora = '00:00') {
    return `${dia}T${hora}:00${OFFSET_CASA}`;
}

export function somarDias(dia, quantidade) {
    return paraDia(new Date(paraData(dia).getTime() + quantidade * DIA_MS));
}

export function diasEntre(de, ate) {
    return Math.round((paraData(ate) - paraData(de)) / DIA_MS);
}

// 0 = segunda ... 6 = domingo
export function diaDaSemana(dia) {
    return (paraData(dia).getUTCDay() + 6) % 7;
}

export function inicioDaSemana(dia) {
    return somarDias(dia, -diaDaSemana(dia));
}

// Formata um dia com as opções do toLocaleDateString (ex.: { weekday: 'long', day: 'numeric' })
export function formatarDia(dia, opcoes) {
    return paraData(dia).toLocaleDateString('pt-BR', { timeZone: 'UTC', ...opcoes });
}

const anoBissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

// Dia do aniversário num ano (quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos)
export function aniversarioNoAno(dataNascimento, ano) {
    const [, mes, dia] = dataNascimento.split('-');
    if (mes === '02' && dia === '29' && !anoBissexto(ano)) return `${ano}-02-28`;
    return `${ano}-${mes}-${dia}`;
}

export function idadeEm(dataNascimento, dia = hoje()) {
    const anoNascimento = Number(dataNascimento.slice(0, 4));
    const ano = Number(dia.slice(0, 4));
    return ano - anoNascimento - (dia < aniversarioNoAno(dataNascimento, ano) ? 1 : 0);
}

// Próximo aniversário a partir de hoje: { dia, emDias, idade (que vai completar) }
export function proximoAniversario(dataNascimento, apartirDe = hoje()) {
    const ano = Number(apartirDe.slice(0, 4));
    let dia = aniversarioNoAno(dataNascimento, ano);
    if (dia < apartirDe) dia = aniversarioNoAno(dataNascimento, ano + 1);
    return { dia, emDias: diasEntre(apartirDe, dia), idade: Number(dia.slice(0, 4)) - Number(dataNascimento.slice(0, 4)) };
}
