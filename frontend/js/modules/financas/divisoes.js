import { api } from '../../core/api.js';
import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, iniciais, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { hoje, formatarDia } from '../../core/datas.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { comemorar } from '../../core/movimento.js';
import { estiloCategoria, htmlEscolhaCategoria } from '../../core/categorias.js';
import { estado, ESCOPO, reais, lerReais, paraCampo, categoriaFin, nomeDoMorador, saldosEntreMoradores, dividirIgual } from './dados.js';

export const HTML_ABA_DIVISOES = `
    <div class="pagina-topo">
        <h2 class="section-title">Divisão de despesas</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="fin-nova-divisao" data-permissao="financas:lancar"><i class="fa-solid fa-plus"></i> Dividir</button>
    </div>
    <div id="fin-saldos"></div>
    <div class="chips fin-divisoes-filtro" role="radiogroup">
        <label class="chip"><input type="radio" name="fin-divisoes-filtro" value="abertas" checked><span>Em aberto</span></label>
        <label class="chip"><input type="radio" name="fin-divisoes-filtro" value="todas"><span>Todas</span></label>
    </div>
    <div id="fin-divisoes" class="fin-divisoes"></div>
`;

const aberta = (divisao) => divisao.participantes.some(p => !p.pago);

function htmlSaldos() {
    const saldos = saldosEntreMoradores();
    return `
        <section class="card card-padded fin-saldos">
            <h3 class="card-title"><i class="fa-solid fa-scale-balanced"></i> Quem deve para quem</h3>
            ${saldos.length ? `<ul class="fin-saldos-lista">${saldos.map(s => `
                <li>
                    <span class="avatar">${escaparHtml(iniciais(nomeDoMorador(s.devedor)))}</span>
                    <span class="fin-saldo-texto"><strong>${escaparHtml(nomeDoMorador(s.devedor))}</strong> deve <strong class="fin-valor saida">${reais(s.valor)}</strong> para <strong>${escaparHtml(nomeDoMorador(s.credor))}</strong></span>
                    <button type="button" class="btn btn-ghost btn-sm" data-acao="fin-acertar" data-de="${s.devedor}" data-para="${s.credor}" data-permissao="financas:lancar"><i class="fa-solid fa-handshake"></i> Acertar</button>
                </li>`).join('')}</ul>` : '<p class="empty-state">Ninguém deve nada a ninguém 🎉</p>'}
            <p class="fin-ajuda">Os valores já compensam os dois sentidos: se A deve R$ 30 a B e B deve R$ 10 a A, aparece só "A deve R$ 20 a B".</p>
        </section>`;
}

function htmlDivisao(divisao) {
    const c = categoriaFin(divisao.categoria);
    const pagaram = divisao.participantes.filter(p => p.pago).length;
    const pendente = divisao.participantes.filter(p => !p.pago).reduce((s, p) => s + p.valor, 0);
    return `
        <article class="card fin-divisao ${aberta(divisao) ? '' : 'quitada'}" style="${estiloCategoria(c)}">
            <button type="button" class="fin-divisao-topo" data-acao="fin-abrir-divisao" data-id="${escaparHtml(divisao.id)}">
                <span class="fin-lancamento-icone"><i class="${c.icone}"></i></span>
                <span class="fin-lancamento-texto">
                    <span class="fin-lancamento-descricao">${escaparHtml(divisao.descricao)}</span>
                    <span class="fin-lancamento-meta">${formatarDia(divisao.data, { day: '2-digit', month: 'short' }).replace('.', '')} · pago por <strong>${escaparHtml(nomeDoMorador(divisao.pagoPor))}</strong></span>
                </span>
                <span class="fin-divisao-total"><strong>${reais(divisao.valorTotal)}</strong><small>${pagaram}/${divisao.participantes.length} pagaram</small></span>
            </button>
            <div class="fin-partes">
                ${divisao.participantes.map(p => {
                    const quemPagou = p.integranteId === divisao.pagoPor;
                    return `<button type="button" class="fin-parte ${p.pago ? 'paga' : ''}" ${quemPagou ? 'disabled' : `data-acao="fin-marcar-parte" data-id="${escaparHtml(divisao.id)}" data-integrante="${escaparHtml(p.integranteId)}" data-pago="${p.pago ? '' : '1'}" data-permissao="financas:lancar"`} title="${quemPagou ? 'Quem pagou' : p.pago ? 'Pago — toque para desfazer' : 'Toque quando pagar'}">
                        <i class="fa-solid ${p.pago ? 'fa-circle-check' : 'fa-clock'}"></i> ${escaparHtml(nomeDoMorador(p.integranteId))} <span>${reais(p.valor)}</span>
                    </button>`;
                }).join('')}
            </div>
            ${pendente ? `<p class="fin-divisao-pendente">Falta receber ${reais(pendente)}</p>` : ''}
        </article>`;
}

export function renderizarDivisoes() {
    const container = document.getElementById('fin-divisoes');
    if (!container) return;
    document.getElementById('fin-saldos').innerHTML = htmlSaldos();
    const mostrarTodas = document.querySelector('input[name="fin-divisoes-filtro"]:checked')?.value === 'todas';
    const lista = estado.divisoes.filter(d => mostrarTodas || aberta(d));
    container.innerHTML = lista.length
        ? lista.map(htmlDivisao).join('')
        : `<div class="card"><p class="empty-state">${mostrarTodas ? 'Nenhuma divisão registrada.' : 'Nenhuma divisão em aberto.'} Use <strong>Dividir</strong> para registrar uma conta paga por alguém e dividida com a casa.</p></div>`;
    aplicarPermissoes(document.getElementById('aba-financas-divisoes'));
}

// ===== FORMULÁRIO =====
// `base`: divisão existente; `lancamento`: gasto que originou a divisão (preenche valor, data e categoria)
export function abrirDivisao({ id, lancamento, aoMudar } = {}) {
    const divisao = id ? estado.divisoes.find(d => d.id === id) : null;
    if (id && !divisao) return;
    const podeEditar = temPermissao('financas:lancar');
    const moradores = obterIntegrantes().filter(i => i.ativo !== false || divisao?.participantes.some(p => p.integranteId === String(i.id)));
    const partes = new Map((divisao?.participantes || []).map(p => [p.integranteId, p.valor]));
    const total = divisao?.valorTotal ?? (lancamento ? -lancamento.valor : 0);
    const iguais = !divisao || new Set(divisao.participantes.map(p => p.valor)).size <= 1
        || Math.max(...divisao.participantes.map(p => p.valor)) - Math.min(...divisao.participantes.map(p => p.valor)) <= 1;

    const { corpo, fechar } = abrirPainel({
        titulo: divisao ? `Divisão: ${divisao.descricao}` : 'Dividir uma despesa',
        html: `
            <form id="form-divisao" class="form-stack" novalidate>
                <label class="field"><span>O que foi? *</span>
                    <input type="text" name="descricao" maxlength="120" value="${escaparHtml(divisao?.descricao || lancamento?.descricao || '')}" placeholder="Ex.: Pizza de sexta" required></label>
                <div class="field-row">
                    <label class="field"><span>Valor total (R$) *</span>
                        <input type="text" name="valor" inputmode="decimal" placeholder="0,00" value="${paraCampo(total)}" required></label>
                    <label class="field"><span>Data</span>
                        <input type="date" name="data" value="${divisao?.data || lancamento?.data || hoje()}"></label>
                </div>
                <label class="field"><span>Quem pagou? *</span>
                    <select name="pagoPor">${moradores.map(m => `<option value="${escaparHtml(m.id)}" ${String(m.id) === divisao?.pagoPor ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('')}</select></label>
                <div class="field"><span>Categoria</span>
                    ${htmlEscolhaCategoria({ escopo: ESCOPO, selecionada: divisao ? (divisao.categoria || '') : (lancamento?.categoria || ''), nenhuma: true })}
                </div>
                <div class="field"><span>Dividir entre</span>
                    <div class="chips fin-modo" role="radiogroup">
                        <label class="chip"><input type="radio" name="modo" value="igual" ${iguais ? 'checked' : ''}><span><i class="fa-solid fa-equals"></i> Partes iguais</span></label>
                        <label class="chip"><input type="radio" name="modo" value="livre" ${iguais ? '' : 'checked'}><span><i class="fa-solid fa-sliders"></i> Valores diferentes</span></label>
                        <button type="button" class="chip-gerenciar" data-papel="todos">Todos</button>
                    </div>
                    <div class="fin-participantes">
                        ${moradores.map(m => `
                            <label class="fin-participante">
                                <input type="checkbox" name="participante" value="${escaparHtml(m.id)}" ${partes.has(String(m.id)) ? 'checked' : ''}>
                                <span class="fin-participante-nome">${escaparHtml(m.nome)}</span>
                                <input type="text" class="fin-participante-valor" data-id="${escaparHtml(m.id)}" inputmode="decimal" value="${paraCampo(partes.get(String(m.id)))}" aria-label="Parte de ${escaparHtml(m.nome)}">
                            </label>`).join('')}
                    </div>
                    <p class="fin-ajuda" id="fin-divisao-conta"></p>
                </div>
                ${podeEditar ? `
                    <div class="painel-acoes">
                        ${divisao ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                        <button type="submit" class="btn btn-primary">${divisao ? 'Salvar' : 'Registrar divisão'}</button>
                    </div>` : ''}
            </form>
        `
    });
    const form = corpo.querySelector('form');
    const marcados = () => [...form.querySelectorAll('input[name="participante"]:checked')].map(c => c.value);
    const modo = () => form.elements.modo.value;

    // Recalcula as partes: no modo igual divide automaticamente; no livre mostra quanto falta
    const atualizar = () => {
        const valorTotal = lerReais(form.elements.valor.value) || 0;
        const ids = marcados();
        form.querySelectorAll('.fin-participante').forEach(linha => {
            const marcado = linha.querySelector('input[type="checkbox"]').checked;
            linha.classList.toggle('ativo', marcado);
            linha.querySelector('.fin-participante-valor').disabled = !marcado || modo() === 'igual';
        });
        if (modo() === 'igual') {
            const valores = dividirIgual(valorTotal, ids.length || 1);
            form.querySelectorAll('.fin-participante-valor').forEach(campo => {
                const i = ids.indexOf(campo.dataset.id);
                campo.value = i >= 0 ? paraCampo(valores[i]) : '';
            });
        }
        const soma = ids.reduce((s, id) => s + (lerReais(form.querySelector(`.fin-participante-valor[data-id="${id}"]`).value) || 0), 0);
        const resto = valorTotal - soma;
        form.querySelector('#fin-divisao-conta').innerHTML = !ids.length ? 'Marque quem participa.'
            : resto === 0 ? `<i class="fa-solid fa-check"></i> ${ids.length} pessoa(s), somando ${reais(soma)}`
                : `<span class="fin-valor saida">${resto > 0 ? `Faltam ${reais(resto)}` : `Passou ${reais(-resto)}`}</span> para fechar ${reais(valorTotal)}`;
    };
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    form.querySelector('[data-papel="todos"]').addEventListener('click', () => {
        const caixas = [...form.querySelectorAll('input[name="participante"]')];
        const marcar = caixas.some(c => !c.checked);
        caixas.forEach(c => { c.checked = marcar; });
        atualizar();
    });
    atualizar();
    if (!divisao) form.elements.descricao.focus();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valorTotal = lerReais(form.elements.valor.value);
        const participantes = marcados().map(id => ({ integranteId: id, valor: lerReais(form.querySelector(`.fin-participante-valor[data-id="${id}"]`).value) || 0 }));
        if (!form.elements.descricao.value.trim()) return mostrarNotificacao('Descreva a despesa', 'warning');
        if (!valorTotal || valorTotal <= 0) return mostrarNotificacao('Informe o valor total', 'warning');
        if (!participantes.length) return mostrarNotificacao('Marque quem participa', 'warning');
        if (participantes.reduce((s, p) => s + p.valor, 0) !== valorTotal) return mostrarNotificacao('As partes precisam somar o valor total', 'warning');

        const corpoRequisicao = {
            descricao: form.elements.descricao.value.trim(), valorTotal, data: form.elements.data.value || hoje(),
            pagoPor: form.elements.pagoPor.value, participantes,
            categoria: form.querySelector('input[name="categoria"]:checked')?.value || null
        };
        if (!divisao && lancamento) corpoRequisicao.transacaoId = lancamento.id;

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            await api(divisao ? `/financas/divisoes/${divisao.id}` : '/financas/divisoes', { metodo: divisao ? 'PUT' : 'POST', corpo: corpoRequisicao });
            mostrarNotificacao(divisao ? 'Divisão atualizada' : 'Divisão registrada!', 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao salvar', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Excluir a divisão "${divisao.descricao}"? Os pagamentos registrados nela somem junto.`, { titulo: 'Excluir divisão', confirmarTexto: 'Excluir' }))) return;
        try {
            await api(`/financas/divisoes/${divisao.id}`, { metodo: 'DELETE' });
            mostrarNotificacao('Divisão excluída', 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao excluir', 'error');
        }
    });
}

export async function marcarParte({ id, integrante, pago }) {
    await api(`/financas/divisoes/${id}/participantes/${integrante}`, { metodo: 'PUT', corpo: { pago: Boolean(pago) } });
}

export async function acertar({ de, para }) {
    if (!(await mostrarConfirmacao(`Marcar como pago tudo o que ${nomeDoMorador(de)} e ${nomeDoMorador(para)} devem um ao outro?`, { titulo: 'Acertar as contas', confirmarTexto: 'Acertar' }))) return false;
    const { quitadas } = await api('/financas/acertos', { metodo: 'POST', corpo: { de, para } });
    comemorar();
    mostrarNotificacao(`Contas acertadas! ${quitadas} parte(s) quitadas 🤝`, 'success');
    return true;
}
