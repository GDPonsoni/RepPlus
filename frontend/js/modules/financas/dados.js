import { api } from '../../core/api.js';
import { hoje } from '../../core/datas.js';
import { categoria } from '../../core/categorias.js';
import { obterIntegrantes } from '../../core/moradores.js';

// Finanças: valores em CENTAVOS (inteiros) em toda a API. Saída < 0, entrada > 0.
export const ESCOPO = 'financas';
// Não contam como gasto nem entrada (o dinheiro só mudou de lugar)
export const NEUTRAS = ['transferencia', 'ajuste'];

export const TIPOS_CONTA = {
    corrente: { nome: 'Conta corrente', icone: 'fa-solid fa-building-columns' },
    cartao: { nome: 'Cartão de crédito', icone: 'fa-solid fa-credit-card' },
    dinheiro: { nome: 'Dinheiro', icone: 'fa-solid fa-money-bill' },
    caixinha: { nome: 'Caixinha / poupança', icone: 'fa-solid fa-piggy-bank' },
    investimento: { nome: 'Investimento', icone: 'fa-solid fa-chart-line' }
};

export const estado = {
    mes: hoje().slice(0, 7),       // mês exibido (AAAA-MM)
    contas: [],
    transacoes: [],                // do mês exibido
    transacoesAnterior: [],        // do mês anterior (comparação no gráfico)
    resumo: [],                    // últimos meses (gráficos)
    divisoes: [],
    regras: [],
    orcamentos: [],
    provedores: [],
    conexoes: [],
    filtros: { busca: '', conta: '', categoria: '', tipo: '' }
};

// ===== FORMATAÇÃO =====
const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => formatador.format((centavos || 0) / 100);
export const reaisCurto = (centavos) => {
    const valor = Math.abs(centavos) / 100;
    const sinal = centavos < 0 ? '-' : '';
    if (valor >= 1000) return `${sinal}R$ ${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return `${sinal}R$ ${Math.round(valor)}`;
};

// "1.234,56", "1234.56", "R$ 12" -> centavos (null se inválido)
export function lerReais(texto) {
    let limpo = String(texto || '').replace(/[R$\s]/g, '');
    if (!limpo) return null;
    if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
    const numero = Number(limpo);
    return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

// Centavos -> texto para campo de formulário ("1234,56")
export const paraCampo = (centavos) => (centavos ? (Math.abs(centavos) / 100).toFixed(2).replace('.', ',') : '');

export const nomeDoMes = (mes, formato = 'long') => {
    const texto = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: formato, year: formato === 'long' ? 'numeric' : '2-digit', timeZone: 'UTC' });
    return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.', '').replace(' de ', ' ');
};

export function somarMeses(mes, n) {
    const [ano, m] = mes.split('-').map(Number);
    return new Date(Date.UTC(ano, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export const nomeDoMorador = (id) => obterIntegrantes().find(i => String(i.id) === String(id))?.nome || '—';
export const categoriaFin = (chave) => (chave ? categoria(ESCOPO, chave) : { chave: null, nome: 'Sem categoria', cor: '#9ca3af', icone: 'fa-solid fa-circle-question' });
export const buscarConta = (id) => estado.contas.find(c => c.id === id);

// Gastos e entradas de verdade: sem transferências, ajustes e lançamentos ignorados
export const conta = (t) => !t.ignorada && !NEUTRAS.includes(t.categoria);

// ===== API =====
// Mês exibido + o anterior (uma consulta só), contas, resumo dos últimos 6 meses e orçamentos
export async function carregarMes() {
    const mes = estado.mes;
    const de = `${somarMeses(mes, -1)}-01`;
    const ate = `${somarMeses(mes, 1)}-01`;
    const [contas, transacoes, resumo, orcamentos] = await Promise.all([
        api('/financas/contas'),
        api(`/financas/transacoes?de=${de}&ate=${ate}`),
        api(`/financas/resumo?meses=6&ate=${mes}`),
        api('/financas/orcamentos')
    ]);
    if (mes !== estado.mes) return false;   // trocaram de mês enquanto carregava
    Object.assign(estado, {
        contas, resumo, orcamentos,
        transacoes: transacoes.filter(t => t.data.startsWith(mes)),
        transacoesAnterior: transacoes.filter(t => !t.data.startsWith(mes))
    });
    return true;
}

export async function carregarDivisoes() {
    estado.divisoes = await api('/financas/divisoes');
}

export async function carregarAjustes() {
    [estado.regras, estado.orcamentos, estado.provedores, estado.conexoes] = await Promise.all([
        api('/financas/regras'), api('/financas/orcamentos'), api('/financas/provedores'), api('/financas/conexoes')
    ]);
}

export async function carregarContas() {
    [estado.contas, estado.provedores, estado.conexoes] = await Promise.all([
        api('/financas/contas'), api('/financas/provedores'), api('/financas/conexoes')
    ]);
}

// ===== DIVISÕES: quem deve para quem =====
// Soma o que cada pessoa deve a cada outra e compensa os dois sentidos (A deve 30 a B e B deve 10 a A -> A deve 20)
export function saldosEntreMoradores() {
    const dividas = new Map();   // "devedor|credor" -> centavos
    estado.divisoes.forEach(divisao => divisao.participantes
        .filter(p => !p.pago && p.integranteId !== divisao.pagoPor)
        .forEach(p => {
            const chave = `${p.integranteId}|${divisao.pagoPor}`;
            dividas.set(chave, (dividas.get(chave) || 0) + p.valor);
        }));
    const resultado = [];
    const vistos = new Set();
    for (const [chave, valor] of dividas) {
        const [devedor, credor] = chave.split('|');
        const par = [devedor, credor].sort().join('|');
        if (vistos.has(par)) continue;
        vistos.add(par);
        const contrario = dividas.get(`${credor}|${devedor}`) || 0;
        const liquido = valor - contrario;
        if (liquido > 0) resultado.push({ devedor, credor, valor: liquido });
        else if (liquido < 0) resultado.push({ devedor: credor, credor: devedor, valor: -liquido });
    }
    return resultado.sort((a, b) => b.valor - a.valor);
}

// Divide `total` igualmente; os centavos que sobram vão para os primeiros
export function dividirIgual(total, quantos) {
    return Array.from({ length: quantos }, (_, i) => Math.floor(total / quantos) + (i < total % quantos ? 1 : 0));
}
