import { escaparHtml } from '../../core/ui.js';
import { hoje, formatarDia } from '../../core/datas.js';
import { estiloCategoria } from '../../core/categorias.js';
import { estado, reais, reaisCurto, nomeDoMes, somarMeses, categoriaFin, conta, raiz, dentro } from './dados.js';
import { rosca, barrasMensais, linhaAcumulada, barrasDiarias, ativarDicas } from './graficos.js';
import { contarAte } from '../../core/movimento.js';

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
                <strong data-centavos="${gastoMes}">${reais(gastoMes)}</strong>
                ${variacao(gastoMes, gastoAnterior)}
            </div>
            <div class="card fin-indicador entrada">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-arrow-trend-up"></i> Entradas no mês</span>
                <strong data-centavos="${entradas}">${reais(entradas)}</strong>
                <span class="fin-variacao">Saldo do mês: ${reais(entradas - gastoMes)}</span>
            </div>
            <div class="card fin-indicador">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-wallet"></i> Disponível em contas</span>
                <strong class="${disponivel < 0 ? 'negativo' : ''}" data-centavos="${disponivel}">${reais(disponivel)}</strong>
                <span class="fin-variacao">${ativas.filter(c => !c.reserva).length} conta(s)</span>
            </div>
            <div class="card fin-indicador reserva">
                <span class="fin-indicador-rotulo"><i class="fa-solid fa-piggy-bank"></i> Reserva de emergência</span>
                <strong data-centavos="${reserva}">${reais(reserva)}</strong>
                <span class="fin-variacao">${media ? `cobre ~${(reserva / media).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es) de gastos` : 'caixinhas e investimentos'}</span>
            </div>
        </div>`;
}

// Rosca pelas categorias principais; na legenda, cada principal mostra as subcategorias dela
function htmlCategorias() {
    const porPrincipal = new Map();   // principal -> { valor, partes: Map(chave -> valor) }
    gastos(estado.transacoes).forEach(t => {
        const chave = t.categoria || '';
        const principal = chave ? raiz(chave) : '';
        if (!porPrincipal.has(principal)) porPrincipal.set(principal, { valor: 0, partes: new Map() });
        const grupo = porPrincipal.get(principal);
        grupo.valor -= t.valor;
        grupo.partes.set(chave, (grupo.partes.get(chave) || 0) - t.valor);
    });
    const total = [...porPrincipal.values()].reduce((s, g) => s + g.valor, 0);
    const linhas = [...porPrincipal.entries()].sort((a, b) => b[1].valor - a[1].valor)
        .map(([chave, g]) => ({ c: categoriaFin(chave || null), chave, valor: g.valor, partes: g.partes }));
    const pct = (valor) => `${Math.round((valor / total) * 100)}%`;

    // Detalhe: só quando algum gasto está numa subcategoria; o lançado direto na principal vira "Sem subcategoria"
    const htmlPartes = (l) => {
        if (![...l.partes.keys()].some(chave => chave !== l.chave)) return '';
        return `<ul class="fin-legenda-sub">${[...l.partes.entries()].sort((a, b) => b[1] - a[1]).map(([chave, valor]) => {
            const c = chave === l.chave ? { ...l.c, nome: 'Sem subcategoria' } : categoriaFin(chave);
            return `<li style="${estiloCategoria(c)}"><button type="button" class="fin-legenda-item" data-acao="fin-filtrar-categoria" data-categoria="${escaparHtml(chave)}">
                <i class="${c.icone}"></i><span class="fin-legenda-nome">${escaparHtml(c.nome)}</span>
                <span class="fin-legenda-valor">${reais(valor)}</span><span class="fin-legenda-pct">${pct(valor)}</span></button></li>`;
        }).join('')}</ul>`;
    };

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
                                    <span class="fin-legenda-pct">${pct(l.valor)}</span>
                                </button>
                                ${htmlPartes(l)}
                            </li>`).join('')}
                    </ul>
                </div>` : '<p class="empty-state">Nenhum gasto neste mês.</p>'}
        </section>`;
}

function htmlAcumulado() {
    const dias = diasNoMes(estado.mes);
    const mesAtual = estado.mes === hoje().slice(0, 7);
    const ateDia = mesAtual ? Number(hoje().slice(8)) : dias;
    const atual = acumulado(estado.transacoes, dias);
    const anterior = acumulado(estado.transacoesAnterior, diasNoMes(somarMeses(estado.mes, -1)));
    // No começo do mês a linha ainda é curta: o texto deixa a comparação clara
    const anteriorNoDia = anterior[Math.min(ateDia, anterior.length) - 1] || 0;
    if (!atual[dias - 1] && !anterior[anterior.length - 1]) {
        return `
            <section class="card card-padded fin-bloco">
                <h3 class="card-title"><i class="fa-solid fa-chart-line"></i> Gasto acumulado no mês</h3>
                <p class="empty-state">Nenhum gasto neste mês nem no anterior.</p>
            </section>`;
    }
    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-chart-line"></i> Gasto acumulado no mês</h3>
            <p class="fin-acumulado-resumo">${mesAtual ? `Até o dia ${ateDia}` : 'No mês'}: <strong>${reais(atual[ateDia - 1])}</strong>
                <span>· mês anterior ${mesAtual ? 'no mesmo dia' : 'inteiro'}: ${reais(anteriorNoDia)}</span></p>
            ${linhaAcumulada({ atual, anterior, dias, ateDia })}
        </section>`;
}

// Gasto de cada dia, com média, dia mais caro e, no mês corrente, a projeção para o mês inteiro
function htmlPorDia() {
    const dias = diasNoMes(estado.mes);
    const mesAtual = estado.mes === hoje().slice(0, 7);
    const ateDia = mesAtual ? Number(hoje().slice(8)) : dias;
    const porDia = Array.from({ length: dias }, (_, i) => ({ dia: `${estado.mes}-${String(i + 1).padStart(2, '0')}`, valor: 0, quantidade: 0 }));
    gastos(estado.transacoes).forEach(t => {
        const d = porDia[Number(t.data.slice(8)) - 1];
        d.valor -= t.valor;
        d.quantidade++;
    });
    const total = porDia.reduce((s, d) => s + d.valor, 0);
    if (!total) {
        return `
            <section class="card card-padded fin-bloco">
                <h3 class="card-title"><i class="fa-solid fa-calendar-day"></i> Gasto por dia</h3>
                <p class="empty-state">Nenhum gasto neste mês.</p>
            </section>`;
    }
    const pico = porDia.reduce((a, b) => (b.valor > a.valor ? b : a));
    const comGasto = porDia.slice(0, ateDia).filter(d => d.valor).length;
    const media = total / ateDia;
    return `
        <section class="card card-padded fin-bloco">
            <h3 class="card-title"><i class="fa-solid fa-calendar-day"></i> Gasto por dia</h3>
            <div class="fin-dias-resumo">
                <span><small>Média por dia</small><strong>${reais(media)}</strong></span>
                <span><small>Dia mais caro</small><strong>${reais(pico.valor)}</strong><small>dia ${Number(pico.dia.slice(8))}</small></span>
                <span><small>Dias com gasto</small><strong>${comGasto} de ${ateDia}</strong></span>
                ${mesAtual && ateDia < dias ? `<span><small>No ritmo atual</small><strong>${reais(media * dias)}</strong><small>no mês</small></span>` : ''}
            </div>
            ${barrasDiarias({ dias: porDia, ateDia })}
            <p class="fin-ajuda">Toque num dia para ver os lançamentos. Barras mais claras são fins de semana.</p>
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
    // Orçamento de uma principal conta também as subcategorias dela
    const gastosPor = new Map(estado.orcamentos.map(o => [o.categoria, gastos(estado.transacoes).filter(t => dentro(t.categoria, o.categoria)).reduce((s, t) => s - t.valor, 0)]));
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
                                <span><i class="${c.icone}"></i> ${escaparHtml(c.nomeCompleto)}</span>
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
            ${estado.resumo.some(m => m.entradas || m.saidas)
                ? barrasMensais(estado.resumo.map(m => ({ rotulo: nomeDoMes(m.mes, 'short'), entradas: m.entradas, saidas: m.saidas, atual: m.mes === estado.mes })))
                : '<p class="empty-state">Sem movimentação nos últimos meses.</p>'}
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
            ${htmlPorDia()}
            ${htmlOrcamentos()}
            ${htmlHistorico()}
            ${htmlMaiores()}
        </div>`;
    ativarDicas(container);
    // Ao abrir a aba, os valores do topo "sobem" até o total
    if (container.closest('.entrando')) {
        container.querySelectorAll('[data-centavos]').forEach(el => contarAte(el, Number(el.dataset.centavos), reais));
    }
}
