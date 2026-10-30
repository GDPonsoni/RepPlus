import { escaparHtml } from '../../core/ui.js';
import { reais, reaisCurto } from './dados.js';

// Gráficos simples em SVG/HTML (sem biblioteca): seguem as cores do tema pelo CSS.

// Rosca: fatias [{ valor, cor, rotulo }] com o total no meio
export function rosca(fatias, { centro = '', sub = '' } = {}) {
    const total = fatias.reduce((s, f) => s + f.valor, 0);
    const raio = 42;
    const circunferencia = 2 * Math.PI * raio;
    let acumulado = 0;
    const arcos = total ? fatias.filter(f => f.valor > 0).map(f => {
        const tamanho = (f.valor / total) * circunferencia;
        const arco = `<circle r="${raio}" cx="60" cy="60" fill="none" stroke="${f.cor}" stroke-width="16"
            stroke-dasharray="${tamanho} ${circunferencia - tamanho}" stroke-dashoffset="${-acumulado}">
            <title>${escaparHtml(f.rotulo)}: ${reais(f.valor)} (${Math.round((f.valor / total) * 100)}%)</title></circle>`;
        acumulado += tamanho;
        return arco;
    }).join('') : `<circle r="${raio}" cx="60" cy="60" fill="none" class="grafico-vazio" stroke-width="16"></circle>`;

    return `
        <svg class="grafico-rosca" viewBox="0 0 120 120" role="img" aria-label="${escaparHtml(sub)} ${escaparHtml(centro)}">
            <g transform="rotate(-90 60 60)">${arcos}</g>
            <text x="60" y="58" class="rosca-centro">${escaparHtml(centro)}</text>
            <text x="60" y="74" class="rosca-sub">${escaparHtml(sub)}</text>
        </svg>`;
}

// Barras por mês: [{ rotulo, entradas, saidas, atual }]
export function barrasMensais(meses) {
    const maximo = Math.max(1, ...meses.flatMap(m => [m.entradas, m.saidas]));
    return `
        <div class="grafico-barras" role="img" aria-label="Entradas e gastos por mês">
            ${meses.map(m => `
                <div class="barra-mes ${m.atual ? 'atual' : ''}">
                    <div class="barra-par">
                        <span class="barra entrada" style="height: ${(m.entradas / maximo) * 100}%" title="Entradas: ${reais(m.entradas)}"></span>
                        <span class="barra saida" style="height: ${(m.saidas / maximo) * 100}%" title="Gastos: ${reais(m.saidas)}"></span>
                    </div>
                    <span class="barra-valor">${reaisCurto(m.saidas)}</span>
                    <span class="barra-rotulo">${escaparHtml(m.rotulo)}</span>
                </div>
            `).join('')}
        </div>
        <div class="grafico-legenda"><span><i class="legenda-cor entrada"></i> Entradas</span><span><i class="legenda-cor saida"></i> Gastos</span></div>`;
}

// Gasto acumulado dia a dia no mês, comparado com o mês anterior
export function linhaAcumulada({ atual, anterior, dias, ateDia }) {
    const largura = 300;
    const altura = 140;
    const margem = { esq: 4, dir: 4, topo: 10, base: 18 };
    const maximo = Math.max(1, atual[atual.length - 1] || 0, anterior[anterior.length - 1] || 0) * 1.08;
    const x = (dia) => margem.esq + ((dia - 1) / Math.max(1, dias - 1)) * (largura - margem.esq - margem.dir);
    const y = (valor) => altura - margem.base - (valor / maximo) * (altura - margem.topo - margem.base);
    const pontos = (serie, limite) => serie.slice(0, limite).map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const ultimo = Math.min(ateDia, atual.length);

    return `
        <svg class="grafico-linha" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gasto acumulado no mês">
            ${[0.25, 0.5, 0.75, 1].map(f => `<line class="grade" x1="${margem.esq}" x2="${largura - margem.dir}" y1="${y(maximo / 1.08 * f)}" y2="${y(maximo / 1.08 * f)}"></line>`).join('')}
            <polyline class="serie anterior" points="${pontos(anterior, dias)}"></polyline>
            <polyline class="serie atual" points="${pontos(atual, ultimo)}"></polyline>
            ${ultimo ? `<circle class="ponto-atual" cx="${x(ultimo)}" cy="${y(atual[ultimo - 1])}" r="3.5"><title>Até hoje: ${reais(atual[ultimo - 1])}</title></circle>` : ''}
            <text class="eixo" x="${margem.esq}" y="${altura - 4}">1</text>
            <text class="eixo" x="${largura - margem.dir}" y="${altura - 4}" text-anchor="end">${dias}</text>
        </svg>
        <div class="grafico-legenda">
            <span><i class="legenda-cor atual"></i> Este mês</span>
            <span><i class="legenda-cor anterior"></i> Mês anterior</span>
        </div>`;
}
