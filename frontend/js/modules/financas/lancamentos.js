import { api } from '../../core/api.js';
import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { hoje, formatarDia } from '../../core/datas.js';
import { estiloCategoria, categoriasDe, htmlEscolhaCategoria } from '../../core/categorias.js';
import { estado, ESCOPO, reais, lerReais, paraCampo, categoriaFin, buscarConta, conta, NEUTRAS } from './dados.js';
import { htmlNavegadorMes } from './visao.js';
import { termoParecido } from './regras.js';

export const HTML_ABA_LANCAMENTOS = `
    <div class="fin-topo">
        <div id="fin-lanc-mes"></div>
        <button type="button" class="btn btn-primary btn-sm" data-acao="fin-novo-lancamento" data-permissao="financas:lancar"><i class="fa-solid fa-plus"></i> Lançar</button>
    </div>
    <div class="fin-filtros" id="fin-filtros">
        <input type="search" data-filtro="busca" placeholder="Buscar descrição ou observação..." aria-label="Buscar" autocomplete="off">
        <select data-filtro="conta" aria-label="Conta"></select>
        <select data-filtro="categoria" aria-label="Categoria"></select>
        <select data-filtro="tipo" aria-label="Tipo">
            <option value="">Gastos e entradas</option>
            <option value="gastos">Só gastos</option>
            <option value="entradas">Só entradas</option>
            <option value="neutros">Transferências e ajustes</option>
            <option value="ignorados">Ignorados</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm fin-btn-filtros" data-acao="fin-mais-filtros" aria-expanded="false" aria-controls="fin-filtros-mais">
            <i class="fa-solid fa-sliders"></i> Filtros <span class="fin-filtros-contador" hidden></span>
        </button>
        <div class="fin-filtros-mais" id="fin-filtros-mais" hidden>
            <fieldset><legend>Dias do mês</legend>
                <input type="number" data-filtro="diaDe" min="1" max="31" inputmode="numeric" placeholder="de" aria-label="Do dia">
                <span>a</span>
                <input type="number" data-filtro="diaAte" min="1" max="31" inputmode="numeric" placeholder="até" aria-label="Até o dia">
            </fieldset>
            <fieldset><legend>Valor (R$)</legend>
                <input type="text" data-filtro="valorMin" inputmode="decimal" placeholder="mínimo" aria-label="Valor mínimo">
                <span>a</span>
                <input type="text" data-filtro="valorMax" inputmode="decimal" placeholder="máximo" aria-label="Valor máximo">
            </fieldset>
            <label class="field"><span>Origem</span>
                <select data-filtro="origem">
                    <option value="">Banco e manuais</option>
                    <option value="importado">Só do banco</option>
                    <option value="manual">Só manuais</option>
                </select></label>
            <label class="field"><span>Ordenar</span>
                <select data-filtro="ordem">
                    <option value="recentes">Mais recentes primeiro</option>
                    <option value="antigos">Mais antigos primeiro</option>
                    <option value="maiores-gastos">Maiores gastos</option>
                    <option value="maiores-entradas">Maiores entradas</option>
                    <option value="valor">Maior valor (gasto ou entrada)</option>
                </select></label>
        </div>
    </div>
    <div id="fin-filtros-ativos" class="fin-filtros-ativos"></div>
    <div id="fin-lanc-resumo" class="fin-lanc-resumo"></div>
    <div id="fin-lancamentos"></div>
`;

const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ROTULOS_TIPO = { gastos: 'Só gastos', entradas: 'Só entradas', neutros: 'Transferências e ajustes', ignorados: 'Ignorados' };
const ROTULOS_ORDEM = { antigos: 'Mais antigos', 'maiores-gastos': 'Maiores gastos', 'maiores-entradas': 'Maiores entradas', valor: 'Maior valor' };
const ORDENAR = {
    antigos: (a, b) => a.data.localeCompare(b.data),
    'maiores-gastos': (a, b) => a.valor - b.valor,
    'maiores-entradas': (a, b) => b.valor - a.valor,
    valor: (a, b) => Math.abs(b.valor) - Math.abs(a.valor)
};

function preencherFiltros() {
    const { filtros } = estado;
    const raiz = document.getElementById('fin-filtros');
    raiz.querySelector('[data-filtro="conta"]').innerHTML = `<option value="">Todas as contas</option>${estado.contas.map(c => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`).join('')}`;
    raiz.querySelector('[data-filtro="categoria"]').innerHTML = `<option value="">Todas as categorias</option><option value="sem">Sem categoria</option>${categoriasDe(ESCOPO).map(c => `<option value="${escaparHtml(c.chave)}">${escaparHtml(c.nome)}</option>`).join('')}`;
    // Só reescreve o que mudou, para não atrapalhar quem está digitando
    raiz.querySelectorAll('[data-filtro]').forEach(campo => {
        const valor = filtros[campo.dataset.filtro] ?? '';
        if (campo.value !== valor) campo.value = valor;
    });
}

function filtrar() {
    const { busca, conta: contaId, categoria, tipo, diaDe, diaAte, valorMin, valorMax, origem } = estado.filtros;
    const termo = semAcento(busca);
    const minimo = valorMin ? lerReais(valorMin) : null;
    const maximo = valorMax ? lerReais(valorMax) : null;
    return estado.transacoes.filter(t => {
        if (tipo === 'ignorados' ? !t.ignorada : t.ignorada) return false;
        if (tipo === 'gastos' && !(conta(t) && t.valor < 0)) return false;
        if (tipo === 'entradas' && !(conta(t) && t.valor > 0)) return false;
        if (tipo === 'neutros' && !NEUTRAS.includes(t.categoria)) return false;
        if (contaId && t.contaId !== contaId) return false;
        if (categoria && (categoria === 'sem' ? t.categoria : t.categoria !== categoria)) return false;
        const dia = Number(t.data.slice(8));
        if (diaDe && dia < Number(diaDe)) return false;
        if (diaAte && dia > Number(diaAte)) return false;
        if (minimo !== null && Math.abs(t.valor) < minimo) return false;
        if (maximo !== null && Math.abs(t.valor) > maximo) return false;
        if (origem && t.origem !== origem) return false;
        return !termo || semAcento(`${t.descricao} ${t.observacao || ''}`).includes(termo);
    });
}

// Filtros em uso viram chips removíveis; os do painel "Filtros" também contam no botão
function htmlFiltrosAtivos() {
    const f = estado.filtros;
    const chips = [];
    if (f.busca) chips.push(['busca', `“${f.busca}”`]);
    if (f.conta) chips.push(['conta', buscarConta(f.conta)?.nome || 'Conta']);
    if (f.categoria) chips.push(['categoria', f.categoria === 'sem' ? 'Sem categoria' : categoriaFin(f.categoria).nome]);
    if (f.tipo) chips.push(['tipo', ROTULOS_TIPO[f.tipo]]);
    if (f.diaDe || f.diaAte) chips.push(['dias', f.diaDe && f.diaDe === f.diaAte ? `Dia ${f.diaDe}` : `Dias ${f.diaDe || 1} a ${f.diaAte || 31}`]);
    if (f.valorMin || f.valorMax) chips.push(['valor', f.valorMin && f.valorMax ? `R$ ${f.valorMin} a R$ ${f.valorMax}` : f.valorMin ? `A partir de R$ ${f.valorMin}` : `Até R$ ${f.valorMax}`]);
    if (f.origem) chips.push(['origem', f.origem === 'importado' ? 'Só do banco' : 'Só manuais']);
    if (f.ordem !== 'recentes') chips.push(['ordem', `Ordem: ${ROTULOS_ORDEM[f.ordem]}`]);

    const doPainel = ['dias', 'valor', 'origem', 'ordem'].filter(chave => chips.some(([c]) => c === chave)).length;
    const contador = document.querySelector('.fin-filtros-contador');
    contador.hidden = !doPainel;
    contador.textContent = doPainel;
    if (!chips.length) return '';
    return `${chips.map(([chave, rotulo]) => `
        <button type="button" class="fin-filtro-ativo" data-acao="fin-limpar-filtro" data-chave="${chave}" aria-label="Remover filtro ${escaparHtml(rotulo)}">
            ${escaparHtml(rotulo)} <i class="fa-solid fa-xmark"></i></button>`).join('')}
        ${chips.length > 1 ? '<button type="button" class="btn btn-ghost btn-sm" data-acao="fin-limpar-filtros">Limpar tudo</button>' : ''}`;
}

function htmlLancamento(t, { comData = false } = {}) {
    const c = categoriaFin(t.categoria);
    const contaDoLancamento = buscarConta(t.contaId);
    const neutro = NEUTRAS.includes(t.categoria);
    return `
        <button type="button" class="fin-lancamento ${t.ignorada ? 'ignorado' : ''}" data-acao="fin-abrir-lancamento" data-id="${escaparHtml(t.id)}" style="${estiloCategoria(c)}">
            <span class="fin-lancamento-icone"><i class="${c.icone}"></i></span>
            <span class="fin-lancamento-texto">
                <span class="fin-lancamento-descricao">${escaparHtml(t.descricao)}</span>
                <span class="fin-lancamento-meta">
                    ${comData ? `${formatarDia(t.data, { day: '2-digit', month: 'short' }).replace('.', '')} · ` : ''}${escaparHtml(c.nome)} · ${escaparHtml(contaDoLancamento?.nome || 'Conta removida')}
                    ${t.origem === 'importado' ? '<i class="fa-solid fa-building-columns" title="Veio do banco"></i>' : ''}
                    ${t.observacao ? '<i class="fa-regular fa-comment" title="Tem observação"></i>' : ''}
                </span>
            </span>
            <span class="fin-valor ${t.valor < 0 ? 'saida' : 'entrada'} ${neutro ? 'neutro' : ''}">${t.valor > 0 ? '+' : ''}${reais(t.valor)}</span>
        </button>`;
}

export function renderizarLancamentos() {
    const container = document.getElementById('fin-lancamentos');
    if (!container) return;
    document.getElementById('fin-lanc-mes').innerHTML = htmlNavegadorMes();
    preencherFiltros();
    document.getElementById('fin-filtros-ativos').innerHTML = htmlFiltrosAtivos();

    const lista = filtrar();
    const gastos = lista.filter(t => conta(t) && t.valor < 0).reduce((s, t) => s - t.valor, 0);
    const entradas = lista.filter(t => conta(t) && t.valor > 0).reduce((s, t) => s + t.valor, 0);
    const semCategoria = lista.filter(t => !t.categoria && !t.ignorada).length;
    const termo = estado.filtros.busca.trim();
    document.getElementById('fin-lanc-resumo').innerHTML = `
        <span>${lista.length} lançamento(s)</span>
        <span class="fin-valor saida">${reais(-gastos)}</span>
        <span class="fin-valor entrada">+${reais(entradas)}</span>
        ${semCategoria && estado.filtros.categoria !== 'sem' ? `<button type="button" class="fin-link" data-acao="fin-filtrar-sem-categoria">${semCategoria} sem categoria</button>` : ''}
        ${termo.length >= 3 && lista.length ? `<button type="button" class="fin-link" data-acao="fin-nova-regra" data-termo="${escaparHtml(termo)}" data-permissao="financas:gerenciar"><i class="fa-solid fa-wand-magic-sparkles"></i> Criar regra com “${escaparHtml(termo)}”</button>` : ''}`;
    aplicarPermissoes(document.getElementById('fin-lanc-resumo'));

    if (!lista.length) {
        container.innerHTML = `<div class="card"><p class="empty-state">${estado.transacoes.length ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês.'}</p></div>`;
        return;
    }

    // Ordenado por valor: uma lista só, com a data em cada lançamento
    const { ordem } = estado.filtros;
    if (ordem !== 'recentes' && ordem !== 'antigos') {
        container.innerHTML = `<div class="card fin-dia-itens">${[...lista].sort(ORDENAR[ordem]).map(t => htmlLancamento(t, { comData: true })).join('')}</div>`;
        return;
    }

    // Agrupado por dia, com o total gasto no dia
    const dias = new Map();
    lista.forEach(t => {
        if (!dias.has(t.data)) dias.set(t.data, []);
        dias.get(t.data).push(t);
    });
    container.innerHTML = [...dias.entries()].sort(([a], [b]) => (ordem === 'antigos' ? a.localeCompare(b) : b.localeCompare(a))).map(([dia, itens]) => {
        const totalDia = itens.filter(t => conta(t) && t.valor < 0).reduce((s, t) => s - t.valor, 0);
        const titulo = formatarDia(dia, { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
        return `
            <section class="fin-dia">
                <h3 class="fin-dia-titulo"><span>${dia === hoje() ? 'Hoje' : titulo}</span>${totalDia ? `<span>${reais(-totalDia)}</span>` : ''}</h3>
                <div class="card fin-dia-itens">${itens.map(t => htmlLancamento(t)).join('')}</div>
            </section>`;
    }).join('');
}

// ===== FORMULÁRIO =====
export function abrirLancamento({ id, aoMudar, aoDividir } = {}) {
    const t = id ? estado.transacoes.find(x => x.id === id) || estado.transacoesAnterior.find(x => x.id === id) : null;
    if (id && !t) return;
    const importado = t?.origem === 'importado';
    const podeEditar = temPermissao('financas:lancar');
    const contasManuais = estado.contas.filter(c => !c.conectada && !c.arquivada);
    const d = podeEditar ? '' : 'disabled';
    const tipo = t ? (t.valor > 0 ? 'entrada' : 'gasto') : 'gasto';

    if (!t && !contasManuais.length) {
        mostrarNotificacao('Crie uma conta manual em Contas para lançar gastos à mão.', 'warning');
        return;
    }

    const camposDoBanco = importado ? `
        <div class="fin-importado">
            <p><i class="fa-solid fa-building-columns"></i> Veio do banco: <strong>${escaparHtml(buscarConta(t.contaId)?.nome || '')}</strong></p>
            <p class="fin-importado-valor"><span>${escaparHtml(t.descricao)}</span><strong class="fin-valor ${t.valor < 0 ? 'saida' : 'entrada'}">${reais(t.valor)}</strong></p>
            <p class="fin-importado-data">${formatarDia(t.data, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>` : `
        <div class="chips" role="radiogroup">
            <label class="chip fin-tipo-gasto"><input type="radio" name="tipo" value="gasto" ${tipo === 'gasto' ? 'checked' : ''} ${d}><span><i class="fa-solid fa-arrow-trend-down"></i> Gasto</span></label>
            <label class="chip fin-tipo-entrada"><input type="radio" name="tipo" value="entrada" ${tipo === 'entrada' ? 'checked' : ''} ${d}><span><i class="fa-solid fa-arrow-trend-up"></i> Entrada</span></label>
        </div>
        <div class="field-row">
            <label class="field"><span>Valor (R$) *</span>
                <input type="text" name="valor" inputmode="decimal" placeholder="0,00" value="${paraCampo(t?.valor)}" required ${d}></label>
            <label class="field"><span>Data *</span>
                <input type="date" name="data" value="${t?.data || hoje()}" required ${d}></label>
        </div>
        <label class="field"><span>Descrição *</span>
            <input type="text" name="descricao" maxlength="120" value="${escaparHtml(t?.descricao || '')}" placeholder="Ex.: Feira do sábado" required ${d}></label>
        <label class="field"><span>Conta</span>
            <select name="contaId" ${d}>${contasManuais.map(c => `<option value="${c.id}" ${c.id === t?.contaId ? 'selected' : ''}>${escaparHtml(c.nome)}</option>`).join('')}</select></label>`;

    const { corpo, fechar } = abrirPainel({
        titulo: t ? (importado ? 'Lançamento do banco' : 'Editar lançamento') : 'Novo lançamento',
        html: `
            <form id="form-lancamento" class="form-stack" novalidate>
                ${camposDoBanco}
                <div class="field"><span>Categoria</span>
                    ${htmlEscolhaCategoria({ escopo: ESCOPO, selecionada: t ? (t.categoria || '') : '', nenhuma: true, desabilitado: !podeEditar })}
                </div>
                ${importado && temPermissao('financas:gerenciar') ? `
                    <div class="fin-regra-rapida" hidden>
                        <label class="checkbox-label"><input type="checkbox" name="criarRegra"> Classificar sempre assim o que contém:</label>
                        <input type="text" name="termoRegra" maxlength="60" value="${escaparHtml(termoParecido(t.descricao))}">
                    </div>` : ''}
                <label class="field"><span>Observação</span>
                    <input type="text" name="observacao" maxlength="300" value="${escaparHtml(t?.observacao || '')}" placeholder="Ex.: parte da festa do dia 12" ${d}></label>
                ${importado ? `<label class="checkbox-label"><input type="checkbox" name="ignorada" ${t.ignorada ? 'checked' : ''} ${d}> Ignorar nas contas (ex.: lançamento duplicado)</label>` : ''}
                ${podeEditar ? `
                    <div class="painel-acoes">
                        ${t && !importado ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i></button>' : ''}
                        ${t && t.valor < 0 ? '<button type="button" class="btn btn-ghost" data-papel="dividir"><i class="fa-solid fa-people-arrows"></i> Dividir</button>' : ''}
                        <button type="submit" class="btn btn-primary">${t ? 'Salvar' : 'Lançar'}</button>
                    </div>` : ''}
            </form>
        `
    });
    aplicarPermissoes(corpo);
    const form = corpo.querySelector('form');
    if (!t) form.elements.valor.focus();

    // Ao trocar a categoria de algo do banco, oferece criar a regra
    const regra = form.querySelector('.fin-regra-rapida');
    form.addEventListener('change', (e) => {
        if (regra && e.target.name === 'categoria') regra.hidden = !e.target.value;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoria = form.querySelector('input[name="categoria"]:checked')?.value || null;
        const corpoRequisicao = { categoria, observacao: form.elements.observacao.value.trim() };
        if (importado) {
            corpoRequisicao.ignorada = form.elements.ignorada.checked;
        } else {
            const valor = lerReais(form.elements.valor.value);
            if (!valor || valor <= 0) return mostrarNotificacao('Informe um valor maior que zero', 'warning');
            Object.assign(corpoRequisicao, {
                valor: form.elements.tipo.value === 'gasto' ? -valor : valor,
                data: form.elements.data.value,
                descricao: form.elements.descricao.value.trim(),
                contaId: form.elements.contaId.value
            });
            if (!corpoRequisicao.descricao) return mostrarNotificacao('Descreva o lançamento', 'warning');
        }

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            await api(t ? `/financas/transacoes/${t.id}` : '/financas/transacoes', { metodo: t ? 'PUT' : 'POST', corpo: corpoRequisicao });
            if (regra && !regra.hidden && form.elements.criarRegra.checked && categoria) {
                const { atualizadas } = await api('/financas/regras', { metodo: 'POST', corpo: { termo: form.elements.termoRegra.value.trim(), categoria } });
                mostrarNotificacao(`Regra criada: ${atualizadas} lançamento(s) reclassificados`, 'success');
            } else {
                mostrarNotificacao(t ? 'Lançamento atualizado' : 'Lançado!', 'success');
            }
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao salvar', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Apagar "${t.descricao}" (${reais(t.valor)})?`, { titulo: 'Apagar lançamento', confirmarTexto: 'Apagar' }))) return;
        try {
            await api(`/financas/transacoes/${t.id}`, { metodo: 'DELETE' });
            mostrarNotificacao('Lançamento apagado', 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao apagar', 'error');
        }
    });

    form.querySelector('[data-papel="dividir"]')?.addEventListener('click', () => {
        fechar();
        aoDividir?.(t);
    });
}
