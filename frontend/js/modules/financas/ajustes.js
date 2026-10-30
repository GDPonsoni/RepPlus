import { api } from '../../core/api.js';
import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { estiloCategoria, categoriasDe } from '../../core/categorias.js';
import { estado, ESCOPO, NEUTRAS, reais, lerReais, paraCampo, categoriaFin } from './dados.js';

// Seções da aba Ajustes do módulo (regras, orçamentos, categorias)
export const SECOES_AJUSTES = [
    {
        id: 'acc-fin-regras', titulo: 'Regras de categoria', icone: 'fa-solid fa-wand-magic-sparkles', cor: 'icon-purple',
        html: `
            <p class="fin-ajuda">Se a descrição do lançamento <strong>contém</strong> o termo, ele vai para a categoria. Vale para o que vem do banco e para lançamentos manuais sem categoria. Escolher a categoria à mão sempre vence a regra.</p>
            <form id="form-fin-regra" class="fin-regra-form" data-permissao="financas:gerenciar">
                <input type="text" name="termo" maxlength="60" placeholder="Ex.: IFOOD" aria-label="Termo">
                <select name="categoria" aria-label="Categoria"></select>
                <button type="submit" class="btn btn-primary" aria-label="Adicionar regra"><i class="fa-solid fa-plus"></i></button>
            </form>
            <div id="fin-regras" class="fin-regras"></div>
            <button type="button" class="btn btn-ghost btn-sm" data-acao="fin-regras-sugeridas" data-permissao="financas:gerenciar"><i class="fa-solid fa-lightbulb"></i> Adicionar regras sugeridas (iFood, Uber, contas de luz...)</button>`
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

const categoriasDeGasto = () => categoriasDe(ESCOPO).filter(c => !NEUTRAS.includes(c.chave) && c.chave !== 'receitas');

export function renderizarAjustes() {
    const lista = document.getElementById('fin-regras');
    if (!lista) return;
    const select = document.querySelector('#form-fin-regra select');
    select.innerHTML = categoriasDe(ESCOPO).map(c => `<option value="${escaparHtml(c.chave)}">${escaparHtml(c.nome)}</option>`).join('');

    lista.innerHTML = estado.regras.length ? estado.regras.map(r => {
        const c = categoriaFin(r.categoria);
        return `
            <div class="fin-regra" style="${estiloCategoria(c)}">
                <code>${escaparHtml(r.termo)}</code>
                <i class="fa-solid fa-arrow-right"></i>
                <span class="fin-regra-categoria"><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>
                <button type="button" class="icon-btn danger" data-acao="fin-excluir-regra" data-id="${r.id}" data-permissao="financas:gerenciar" aria-label="Excluir regra"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
    }).join('') : '<p class="empty-state">Nenhuma regra ainda.</p>';

    const orcamento = new Map(estado.orcamentos.map(o => [o.categoria, o.valorMensal]));
    document.getElementById('fin-orcamentos-campos').innerHTML = categoriasDeGasto().map(c => `
        <label class="fin-orcamento-campo" style="${estiloCategoria(c)}">
            <span><i class="${c.icone}"></i> ${escaparHtml(c.nome)}</span>
            <input type="text" inputmode="decimal" data-categoria="${escaparHtml(c.chave)}" value="${paraCampo(orcamento.get(c.chave))}" placeholder="sem limite" ${temPermissao('financas:gerenciar') ? '' : 'disabled'}>
        </label>`).join('');
    aplicarPermissoes(document.getElementById('aba-financas-ajustes'));
}

export async function adicionarRegra(form) {
    const termo = form.elements.termo.value.trim();
    if (termo.length < 3) {
        mostrarNotificacao('Use um termo com pelo menos 3 letras', 'warning');
        return false;
    }
    const { atualizadas } = await api('/financas/regras', { metodo: 'POST', corpo: { termo, categoria: form.elements.categoria.value } });
    form.reset();
    mostrarNotificacao(`Regra salva. ${atualizadas} lançamento(s) reclassificados`, 'success');
    return true;
}

export async function regrasSugeridas() {
    const { criadas, atualizadas } = await api('/financas/regras/sugeridas', { metodo: 'POST' });
    mostrarNotificacao(`${criadas} regra(s) adicionadas, ${atualizadas} lançamento(s) reclassificados`, 'success');
}

export async function excluirRegra({ id }) {
    await api(`/financas/regras/${id}`, { metodo: 'DELETE' });
    mostrarNotificacao('Regra excluída', 'success');
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
