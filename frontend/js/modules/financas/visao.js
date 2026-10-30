import { escaparHtml } from '../../core/ui.js';
import { hoje, formatarDia } from '../../core/datas.js';
import { estiloCategoria } from '../../core/categorias.js';
import { estado, reais, reaisCurto, nomeDoMes, somarMeses, categoriaFin, conta } from './dados.js';
import { rosca, barrasMensais, linhaAcumulada } from './graficos.js';

// Barra de navegação de mês (usada na Visão geral e nos Lançamentos)
export const htmlNavegadorMes = () => `
    <div class="fin-mes">
        <button type="button" class="icon-btn" data-acao="fin-mes" data-passo="-1" aria-label="Mês anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <h2 class="fin-mes-titulo">${nomeDoMes(estado.mes)}</h2>
        <button type="button" class="icon-btn" data-acao="fin-mes" data-passo="1" aria-label="Próximo mês" ${estado.mes >= hoje().slice(0, 7) ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
        ${estado.mes !== hoje().slice(0, 7) ? '<button type="button" class="btn btn-ghost btn-sm" data-acao="fin-mes-atual">Hoje</button>' : ''}
    </div>`;

export const HTML_ABA_VISAO = `
    <div id="fin-visao-mes"></div>
    <div id="fin-visao"></div>
`;

const diasNoMes = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
const gastos = (lista) => lista.filter(t => conta(t) && t.valor < 0);
const somaGastos = (lista) => gastos(lista).reduce((s, t) => s - t.valor, 0);

// Gasto acumulado por dia do mês
function acumulado(lista, dias) {
    const porDia = Array(dias).fill(0);
    gastos(lista).forEach(t => { porDia[Number(t.data.slice(8)) - 1] -= t.valor; });
    let soma = 0;
    return porDia.map(v => (soma += v));
}

const variacao = (atual, anterior) => {
    if (!anterior) return '';
    const pct = Math.round(((atual - anterior) / anterior) * 100);
    if (pct === 0) return '<span class="fin-variacao">igual ao mês anterior</span>';
    return `<span class="fin-variacao ${pct > 0 ? 'pior' : 'melhor'}"><i class="fa-solid fa-arrow-${pct > 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}% vs. mês anterior</span>`;
};

function htmlIndicadores() {
    const mesAtual = estado.mes === hoje().slice(0, 7);
    const ateDia = mesAtual ? Number(hoje().slice(8)) : diasNoMes(estado.mes);
    const gastoMes = somaGastos(estado.transacoes);
    // Comparação justa: no mês corrente, o mês anterior só até o mesmo dia
    const gastoAnterior = somaGastos(estado.transacoesAnterior.filter(t => Number(t.data.slice(8)) <= ateDia));
    const entradas = estado.transacoes.filter(t => conta(t) && t.valor > 0).reduce((s, t) => s + t.valor, 0);

    const ativas = estado.contas.filter(c => !c.arquivada);
    const disponivel = ativas.filter(c => !c.reserva).reduce((s, c) => s + c.saldo, 0);
    const reserva = ativas.filter(c => c.reserva).reduce((s, c) => s + c.saldo, 0);
    // Quantos meses a reserva cobre, pela média de gastos dos últimos 3 meses fechados
    const fechados = estado.resumo.filter(m => m.mes < hoje().slice(0, 7) && m.saidas > 0).slice(-3);
    const media = fechados.length ? fechados.reduce((s, m) => s + m.saidas, 0) / fechados.length : 0;

    return `
        <div class="fin-indicadores">
            <div class="card fin-indicador gasto">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-arrow-trend-down"></i> Gastos ${mesAtual ? 'até hoje' : 'no mês'}</span>
                <strong>${reais(gastoMes)}</strong>
                ${variacao(gastoMes, gastoAnterior)}
            </div>
            <div class="card fin-indicador entrada">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-arrow-trend-up"></i> Entradas no mês</span>
                <strong>${reais(entradas)}</strong>
                <span class="fin-variacao">Saldo do mês: ${reais(entradas - gastoMes)}</span>
            </div>
            <div class="card fin-indicador">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-wallet"></i> Disponível em contas</span>
                <strong class="${disponivel < 0 ? 'negativo' : ''}">${reais(disponivel)}</strong>
                <span class="fin-variacao">${ativas.filter(c => !c.reserva).length} conta(s)</span>
            </div>
            <div class="card fin-indicador reserva">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-piggy-bank"></i> Reserva de emergência</span>
                <strong>${reais(reserva)}</strong>
                <span class="fin-variacao">${media ? `cobre ~${(reserva / media).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es) de gastos` : 'caixinhas e investimentos'}</span>
            </div>
        </div>`;
}

function htmlCategorias() {
    const porCategoria = new Map();
    gastos(estado.transacoes).forEach(t => porCategoria.set(t.categoria || '', (porCategoria.get(t.categoria || '') || 0) - t.valor));
    const total = [...porCategoria.values()].reduce((s, v) => s + v, 0);
    const linhas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([chave, valor]) => ({ c: categoriaFin(chave || null), chave, valor }));

    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-chart-pie"></i> Gastos por categoria</h3>
            ${total ? `
                <div class="fin-categorias">
                    ${rosca(linhas.map(l => ({ valor: l.valor, cor: l.c.cor, rotulo: l.c.nome })), { centro: reaisCurto(total), sub: 'gastos no mês' })}
                    <ul class="fin-legenda">
                        ${linhas.map(l => `
                            <li style="${estiloCategoria(l.c)}">
                                <button type="button" class="fin-legenda-item" data-acao="fin-filtrar-categoria" data-categoria="${escaparHtml(l.chave || 'sem')}">
                                    <i class="${l.c.icone}"></i>
                                    <span class="fin-legenda-nome">${escaparHtml(l.c.nome)}</span>
                                    <span class="fin-legenda-valor">${reais(l.valor)}</span>
                                    <span class="fin-legenda-pct">${Math.round((l.valor / total) * 100)}%</span>
                                </button>
                            </li>`).join('')}
                    </ul>
                </div>` : '<p class="empty-state">Nenhum gasto neste mês.</p>'}
        </section>`;
}

function htmlAcumulado() {
    const dias = diasNoMes(estado.mes);
    const mesAtual = estado.mes === hoje().slice(0, 7);
    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-chart-line"></i> Gasto acumulado no mês</h3>
            ${linhaAcumulada({
                atual: acumulado(estado.transacoes, dias),
                anterior: acumulado(estado.transacoesAnterior, diasNoMes(somarMeses(estado.mes, -1))),
                dias,
                ateDia: mesAtual ? Number(hoje().slice(8)) : dias
            })}
        </section>`;
}

function htmlOrcamentos() {
    if (!estado.orcamentos.length) {
        return `
            <section class="card card-padded fin-bloco">
                <h3 class="card-title"><i class="fa-solid fa-bullseye"></i> Orçamento do mês</h3>
                <p class="empty-state">Defina limites por categoria em <strong>Ajustes → Orçamentos</strong> para acompanhar aqui.</p>
            </section>`;
    }
    const gastosPor = new Map();
    gastos(estado.transacoes).forEach(t => gastosPor.set(t.categoria, (gastosPor.get(t.categoria) || 0) - t.valor));
    const mesAtual = estado.mes === hoje().slice(0, 7);
    // Quanto do mês já passou: ajuda a ver se o ritmo de gasto está acima do esperado
    const fracaoMes = mesAtual ? Number(hoje().slice(8)) / diasNoMes(estado.mes) : 1;

    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-bullseye"></i> Orçamento do mês</h3>
            <div class="fin-orcamentos">
                ${estado.orcamentos.map(o => {
                    const c = categoriaFin(o.categoria);
                    const gasto = gastosPor.get(o.categoria) || 0;
                    const pct = Math.round((gasto / o.valorMensal) * 100);
                    const situacao = pct >= 100 ? 'estourou' : pct >= fracaoMes * 100 + 10 ? 'acelerado' : 'ok';
                    return `
                        <div class="fin-orcamento ${situacao}" style="${estiloCategoria(c)}">
                            <div class="fin-orcamento-topo">
                                <span><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>
                                <span>${reais(gasto)} <small>de ${reais(o.valorMensal)}</small></span>
                            </div>
                            <div class="fin-progresso"><span style="width: ${Math.min(100, pct)}%"></span>${mesAtual ? `<i class="fin-progresso-hoje" style="left: ${fracaoMes * 100}%" title="Hoje"></i>` : ''}</div>
                            <small class="fin-orcamento-situacao">${pct >= 100 ? `Passou ${reais(gasto - o.valorMensal)} do limite` : `${pct}% usado · restam ${reais(o.valorMensal - gasto)}`}</small>
                        </div>`;
                }).join('')}
            </div>
        </section>`;
}

function htmlHistorico() {
    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-chart-column"></i> Últimos 6 meses</h3>
            ${barrasMensais(estado.resumo.map(m => ({ rotulo: nomeDoMes(m.mes, 'short'), entradas: m.entradas, saidas: m.saidas, atual: m.mes === estado.mes })))}
        </section>`;
}

function htmlMaiores() {
    const maiores = gastos(estado.transacoes).sort((a, b) => a.valor - b.valor).slice(0, 5);
    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-ranking-star"></i> Maiores gastos do mês</h3>
            ${maiores.length ? `<ul class="fin-maiores">${maiores.map(t => {
                const c = categoriaFin(t.categoria);
                return `<li style="${estiloCategoria(c)}"><button type="button" class="fin-maior" data-acao="fin-abrir-lancamento" data-id="${escaparHtml(t.id)}">
                    <i class="${c.icone}"></i><span class="fin-maior-texto">${escaparHtml(t.descricao)}<small>${formatarDia(t.data, { day: '2-digit', month: 'short' }).replace('.', '')}</small></span><strong>${reais(-t.valor)}</strong>
                </button></li>`;
            }).join('')}</ul>` : '<p class="empty-state">Nada por aqui.</p>'}
        </section>`;
}

export function renderizarVisao() {
    const container = document.getElementById('fin-visao');
    if (!container) return;
    document.getElementById('fin-visao-mes').innerHTML = htmlNavegadorMes();
    container.innerHTML = `
        ${htmlIndicadores()}
        <div class="fin-grade">
            ${htmlCategorias()}
            ${htmlAcumulado()}
            ${htmlOrcamentos()}
            ${htmlHistorico()}
            ${htmlMaiores()}
        </div>`;
}
