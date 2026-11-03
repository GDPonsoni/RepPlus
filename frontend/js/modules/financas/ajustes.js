import { api } from '../../core/api.js';
import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { estiloCategoria, emOrdemDeArvore } from '../../core/categorias.js';
import { formatarDia } from '../../core/datas.js';
import { estado, ESCOPO, NEUTRAS, reais, lerReais, paraCampo, categoriaFin } from './dados.js';

const ICONE_SENTIDO = { saida: ['fa-solid fa-arrow-trend-down', 'Só gastos'], entrada: ['fa-solid fa-arrow-trend-up', 'Só entradas'] };

// Seções da aba Ajustes do módulo (regras, orçamentos, categorias)
export const SECOES_AJUSTES = [
    {
        id: 'acc-fin-regras', titulo: 'Regras de categoria', icone: 'fa-solid fa-wand-magic-sparkles', cor: 'icon-purple',
        html: `
            <p class="fin-ajuda">Se a descrição do lançamento <strong>contém</strong> o termo (e, se você quiser, só em gastos ou só em entradas), ele vai para a categoria. Vale para o que vem do banco e para lançamentos manuais sem categoria. Escolher a categoria à mão sempre vence a regra.</p>
            <div class="fin-regras-acoes" data-permissao="financas:gerenciar">
                <button type="button" class="btn btn-primary btn-sm" data-acao="fin-nova-regra"><i class="fa-solid fa-plus"></i> Nova regra</button>
                <button type="button" class="btn btn-ghost btn-sm" data-acao="fin-regras-sugeridas"><i class="fa-solid fa-lightbulb"></i> Adicionar sugeridas (iFood, contas, PIX recebido...)</button>
            </div>
            <div id="fin-regras-sugestoes"></div>
            <div class="fin-regras-topo">
                <h4>Regras da casa <span id="fin-regras-contagem"></span></h4>
                <input type="search" id="fin-regras-busca" placeholder="Buscar regra..." aria-label="Buscar regra" autocomplete="off">
            </div>
            <div id="fin-regras" class="fin-regras"></div>`
    },
    {
        id: 'acc-fin-orcamentos', titulo: 'Orçamentos por categoria', icone: 'fa-solid fa-bullseye', cor: 'icon-orange',
        html: `
            <p class="fin-ajuda">Limite de gasto por mês. Deixe vazio para não acompanhar a categoria. O total aparece na Visão geral e no gráfico de gasto acumulado.</p>
            <div id="fin-orcamentos-campos" class="fin-orcamentos-campos"></div>`
    },
    {
        id: 'acc-fin-categorias', titulo: 'Categorias', icone: 'fa-solid fa-tags', cor: 'icon-green',
        html: `
            <p class="fin-ajuda">Nome, cor e ícone das categorias dos lançamentos. "Transferência entre contas" e "Ajuste de saldo" não contam como gasto.</p>
            <button type="button" class="btn btn-ghost" data-acao="gerenciar-categorias" data-escopo="${ESCOPO}" data-permissao="financas:gerenciar"><i class="fa-solid fa-pen"></i> Editar categorias</button>`
    }
];

// Na ordem da árvore (principal e logo abaixo as subcategorias), sem as que não são gasto
const categoriasDeGasto = () => emOrdemDeArvore(ESCOPO).filter(c => ![...NEUTRAS, 'receitas'].includes(c.pai || c.chave));

// Grupos de lançamentos parecidos ainda sem categoria: cada um vira uma regra com um toque
function htmlSugestoes() {
    const sugestoes = estado.regrasSugestoes;
    if (!sugestoes.length) return '';
    const item = (g) => {
        const c = g.categoriaSugerida ? categoriaFin(g.categoriaSugerida) : null;
        return `
            <li class="fin-sugestao">
                <span class="fin-sugestao-texto">
                    <code>${escaparHtml(g.termo)}</code>
                    <small>${g.quantidade} lançamento(s) · ${reais(g.total)} · ex.: ${escaparHtml(g.exemplos[0]?.descricao || '')}, ${formatarDia(g.exemplos[0]?.data, { day: '2-digit', month: 'short' }).replace('.', '')}</small>
                    ${c ? `<small class="fin-sugestao-categoria" style="${estiloCategoria(c)}"><i class="${c.icone}"></i> Você já usou ${escaparHtml(c.nomeCompleto)} para algo parecido</small>` : ''}
                </span>
                <button type="button" class="btn btn-ghost btn-sm" data-acao="fin-nova-regra" data-termo="${escaparHtml(g.termo)}" data-sentido="${g.sentido || ''}" data-categoria="${escaparHtml(g.categoriaSugerida || '')}" data-permissao="financas:gerenciar">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Criar regra</button>
            </li>`;
    };
    const total = sugestoes.reduce((s, g) => s + g.quantidade, 0);
    return `
        <div class="fin-sugestoes">
            <h4><i class="fa-solid fa-lightbulb"></i> ${total} lançamento(s) sem categoria, agrupados por semelhança</h4>
            <ul>${sugestoes.slice(0, 6).map(item).join('')}</ul>
            ${sugestoes.length > 6 ? `<details><summary>Ver mais ${sugestoes.length - 6} grupo(s)</summary><ul>${sugestoes.slice(6).map(item).join('')}</ul></details>` : ''}
        </div>`;
}

export function renderizarAjustes() {
    const lista = document.getElementById('fin-regras');
    if (!lista) return;
    document.getElementById('fin-regras-sugestoes').innerHTML = htmlSugestoes();
    document.getElementById('fin-regras-contagem').textContent = estado.regras.length ? `(${estado.regras.length})` : '';

    // As que mais categorizam primeiro
    const regras = [...estado.regras].sort((a, b) => b.quantidade - a.quantidade || a.termo.localeCompare(b.termo, 'pt-BR'));
    lista.innerHTML = regras.length ? regras.map(r => {
        const c = categoriaFin(r.categoria);
        const sentido = ICONE_SENTIDO[r.sentido];
        return `
            <div class="fin-regra" style="${estiloCategoria(c)}" data-busca="${escaparHtml(`${r.termo} ${c.nomeCompleto}`.toLowerCase())}">
                <code>${escaparHtml(r.termo)}</code>
                ${sentido ? `<i class="${sentido[0]} fin-regra-sentido" title="${sentido[1]}" aria-label="${sentido[1]}"></i>` : ''}
                <i class="fa-solid fa-arrow-right"></i>
                <span class="fin-regra-categoria"><i class="${c.icone}"></i> ${escaparHtml(c.nomeCompleto)}</span>
                <span class="fin-regra-uso ${r.quantidade ? '' : 'zero'}" title="Lançamentos categorizados por esta regra">${r.quantidade}</span>
                <span class="fin-regra-botoes" data-permissao="financas:gerenciar">
                    <button type="button" class="icon-btn" data-acao="fin-editar-regra" data-id="${r.id}" aria-label="Editar regra"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn danger" data-acao="fin-excluir-regra" data-id="${r.id}" data-termo="${escaparHtml(r.termo)}" aria-label="Excluir regra"><i class="fa-solid fa-xmark"></i></button>
                </span>
            </div>`;
    }).join('') : '<p class="empty-state">Nenhuma regra ainda.</p>';
    filtrarRegras();

    const orcamento = new Map(estado.orcamentos.map(o => [o.categoria, o.valorMensal]));
    document.getElementById('fin-orcamentos-campos').innerHTML = categoriasDeGasto().map(c => `
        <label class="fin-orcamento-campo ${c.pai ? 'sub' : ''}" style="${estiloCategoria(c)}">
            <span><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>
            <input type="text" inputmode="decimal" data-categoria="${escaparHtml(c.chave)}" value="${paraCampo(orcamento.get(c.chave))}" placeholder="sem limite" ${temPermissao('financas:gerenciar') ? '' : 'disabled'}>
        </label>`).join('');
    aplicarPermissoes(document.getElementById('aba-financas-ajustes'));
}

export async function regrasSugeridas() {
    const { criadas, atualizadas } = await api('/financas/regras/sugeridas', { metodo: 'POST' });
    mostrarNotificacao(`${criadas} regra(s) adicionadas, ${atualizadas} lançamento(s) reclassificados`, 'success');
}

// Busca na lista de regras (pelo termo ou pelo nome da categoria), sem ir ao servidor
export function filtrarRegras() {
    const termo = (document.getElementById('fin-regras-busca')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#fin-regras .fin-regra').forEach(linha => { linha.hidden = Boolean(termo) && !linha.dataset.busca.includes(termo); });
}

// Orçamento salvo ao sair do campo
export async function salvarOrcamento(campo) {
    const valor = campo.value.trim() ? lerReais(campo.value) : 0;
    if (valor === null || valor < 0) {
        mostrarNotificacao('Valor inválido', 'warning');
        return;
    }
    estado.orcamentos = await api(`/financas/orcamentos/${campo.dataset.categoria}`, { metodo: 'PUT', corpo: { valorMensal: valor } });
    campo.value = paraCampo(valor);
    mostrarNotificacao(valor ? `Orçamento: ${reais(valor)} por mês` : 'Orçamento removido', 'success', 1500);
}
