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

// Barras por mês: [{ rotulo, entradas, saidas, atual }]. Meses vazios do começo (antes de haver dados) somem
export function barrasMensais(todos) {
    const primeiro = todos.findIndex(m => m.entradas || m.saidas || m.atual);
    const meses = primeiro < 0 ? todos : todos.slice(primeiro);
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

// Dias marcados no eixo: 1, 5, 10, 15, 20, 25 e o último
const marcasDoMes = (dias) => [1, 5, 10, 15, 20, 25, dias].filter((d, i, lista) => d <= dias && lista.indexOf(d) === i && !(d !== dias && dias - d < 3));

// Gasto acumulado dia a dia no mês, comparado com o mês anterior. Cada dia tem uma faixa
// invisível com a dica (data-dica) do acumulado até ali
export function linhaAcumulada({ atual, anterior, dias, ateDia }) {
    const largura = 320;
    const altura = 160;
    const margem = { esq: 4, dir: 4, topo: 12, base: 20 };
    const topo = Math.max(1, atual[Math.min(ateDia, atual.length) - 1] || 0, anterior[anterior.length - 1] || 0) * 1.08;
    const passo = (largura - margem.esq - margem.dir) / Math.max(1, dias - 1);
    const x = (dia) => margem.esq + (dia - 1) * passo;
    const y = (valor) => altura - margem.base - (valor / topo) * (altura - margem.topo - margem.base);
    const pontos = (serie, limite) => serie.slice(0, limite).map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const ultimo = Math.min(ateDia, atual.length);
    const area = ultimo > 1 ? `${x(1)},${y(0)} ${pontos(atual, ultimo)} ${x(ultimo).toFixed(1)},${y(0)}` : '';

    return `
        <svg class="grafico-linha" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gasto acumulado no mês">
            ${[0.25, 0.5, 0.75, 1].map(f => `<line class="grade" x1="${margem.esq}" x2="${largura - margem.dir}" y1="${y(topo / 1.08 * f)}" y2="${y(topo / 1.08 * f)}"></line>
                <text class="eixo valor" x="${margem.esq + 2}" y="${y(topo / 1.08 * f) - 3}">${reaisCurto(topo / 1.08 * f)}</text>`).join('')}
            ${marcasDoMes(dias).map(d => `<line class="marca-dia" x1="${x(d)}" x2="${x(d)}" y1="${y(0)}" y2="${y(0) + 3}"></line>
                <text class="eixo" x="${x(d)}" y="${altura - 5}" text-anchor="${d === 1 ? 'start' : d === dias ? 'end' : 'middle'}">${d}</text>`).join('')}
            <polyline class="serie anterior" points="${pontos(anterior, dias)}"></polyline>
            ${area ? `<polygon class="area-atual" points="${area}"></polygon>` : ''}
            <polyline class="serie atual" points="${pontos(atual, ultimo)}"></polyline>
            ${ultimo ? `<circle class="ponto-atual" cx="${x(ultimo)}" cy="${y(atual[ultimo - 1])}" r="3.5"></circle>` : ''}
            ${Array.from({ length: dias }, (_, i) => {
                const dia = i + 1;
                const linhas = [`Dia ${dia}`];
                if (dia <= ultimo) linhas.push(`Este mês: ${reais(atual[i])}`);
                if (anterior.length) linhas.push(`Mês anterior: ${reais(anterior[Math.min(i, anterior.length - 1)])}`);
                return `<rect class="faixa-dia" x="${x(dia) - passo / 2}" y="0" width="${passo}" height="${altura - margem.base}" data-dica="${escaparHtml(linhas.join('\n'))}"></rect>`;
            }).join('')}
        </svg>
        <div class="grafico-legenda">
            <span><i class="legenda-cor atual"></i> Este mês</span>
            <span><i class="legenda-cor anterior"></i> Mês anterior</span>
        </div>`;
}

// Gasto de cada dia do mês em barras, com a média diária tracejada. Tocar num dia abre os
// lançamentos dele. dias: [{ dia: 'AAAA-MM-DD', valor, quantidade }]; ateDia: dias que já passaram
export function barrasDiarias({ dias, ateDia }) {
    const largura = 320;
    const altura = 130;
    const margem = { esq: 4, dir: 4, topo: 12, base: 20 };
    const passados = dias.slice(0, ateDia);
    const media = passados.length ? passados.reduce((s, d) => s + d.valor, 0) / passados.length : 0;
    const maior = Math.max(1, ...passados.map(d => d.valor));
    const topo = maior * 1.1;
    const passo = (largura - margem.esq - margem.dir) / dias.length;
    const y = (valor) => altura - margem.base - (valor / topo) * (altura - margem.topo - margem.base);
    const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    return `
        <svg class="grafico-dias" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gasto por dia">
            <line class="grade" x1="${margem.esq}" x2="${largura - margem.dir}" y1="${y(0)}" y2="${y(0)}"></line>
            ${dias.map((d, i) => {
                const numero = i + 1;
                const fds = [0, 6].includes(new Date(`${d.dia}T12:00:00Z`).getUTCDay());
                const classe = ['barra-dia', numero > ateDia ? 'futuro' : '', fds ? 'fds' : '', d.valor && d.valor === maior ? 'pico' : ''].join(' ');
                const dica = `${semana[new Date(`${d.dia}T12:00:00Z`).getUTCDay()]}, dia ${numero}\n${d.valor ? `${reais(d.valor)} em ${d.quantidade} gasto(s)` : 'Sem gastos'}`;
                const alturaBarra = d.valor ? Math.max(2, y(0) - y(d.valor)) : 0;
                return `<g class="${classe}" ${numero <= ateDia ? `data-acao="fin-filtrar-dia" data-dia="${d.dia}"` : ''} data-dica="${escaparHtml(dica)}">
                    <rect class="faixa-dia" x="${margem.esq + i * passo}" y="0" width="${passo}" height="${altura - margem.base}"></rect>
                    ${alturaBarra ? `<rect class="coluna" x="${margem.esq + i * passo + passo * 0.15}" y="${y(0) - alturaBarra}" width="${passo * 0.7}" height="${alturaBarra}" rx="1.5"></rect>` : ''}
                </g>`;
            }).join('')}
            ${media ? `<line class="media" x1="${margem.esq}" x2="${largura - margem.dir}" y1="${y(media)}" y2="${y(media)}"></line>
                <text class="eixo valor" x="${largura - margem.dir - 2}" y="${y(media) - 3}" text-anchor="end">média ${reaisCurto(media)}</text>` : ''}
            ${marcasDoMes(dias.length).map(n => `<text class="eixo" x="${margem.esq + (n - 0.5) * passo}" y="${altura - 5}" text-anchor="middle">${n}</text>`).join('')}
        </svg>`;
}

// Dica flutuante para qualquer [data-dica] dentro do contêiner (mouse e toque)
export function ativarDicas(container) {
    if (container.dataset.dicas) return;
    container.dataset.dicas = '1';
    const dica = document.createElement('div');
    dica.className = 'grafico-dica';
    dica.hidden = true;
    document.body.appendChild(dica);
    const esconder = () => { dica.hidden = true; };
    container.addEventListener('pointermove', (e) => {
        const alvo = e.target.closest?.('[data-dica]');
        if (!alvo || !container.contains(alvo)) return esconder();
        dica.textContent = alvo.dataset.dica;
        dica.hidden = false;
        const { width, height } = dica.getBoundingClientRect();
        const esquerda = Math.min(window.innerWidth - width - 8, Math.max(8, e.clientX - width / 2));
        const cima = e.clientY - height - 14 < 8 ? e.clientY + 18 : e.clientY - height - 14;
        dica.style.transform = `translate(${esquerda}px, ${cima}px)`;
    });
    container.addEventListener('pointerleave', esconder);
    window.addEventListener('scroll', esconder, { passive: true });
}
