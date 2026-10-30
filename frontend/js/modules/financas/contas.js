import { api } from '../../core/api.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarConfirmacao, mostrarPrompt } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { estado, TIPOS_CONTA, reais, lerReais, paraCampo } from './dados.js';

export const HTML_ABA_CONTAS = `
    <div class="pagina-topo">
        <h2 class="section-title">Contas e reserva</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="fin-nova-conta" data-permissao="financas:gerenciar"><i class="fa-solid fa-plus"></i> Conta</button>
    </div>
    <div id="fin-contas"></div>
    <div id="fin-conexoes"></div>
`;

const CORES = ['#2563eb', '#16a34a', '#0d9488', '#9333ea', '#db2777', '#dc2626', '#ea580c', '#a16207', '#64748b', '#111827'];

function quando(iso) {
    if (!iso) return 'nunca';
    const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutos < 2) return 'agora há pouco';
    if (minutos < 60) return `há ${minutos} min`;
    if (minutos < 60 * 24) return `há ${Math.round(minutos / 60)} h`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function htmlConta(c) {
    const tipo = TIPOS_CONTA[c.tipo] || TIPOS_CONTA.corrente;
    return `
        <article class="card fin-conta ${c.arquivada ? 'arquivada' : ''}" style="--cat: ${c.cor}">
            <span class="fin-conta-icone"><i class="${tipo.icone}"></i></span>
            <span class="fin-conta-texto">
                <strong>${escaparHtml(c.nome)}</strong>
                <small>${escaparHtml([c.instituicao, tipo.nome].filter(Boolean).join(' · '))}</small>
                <small class="fin-conta-origem">${c.conectada
                    ? `<i class="fa-solid fa-plug-circle-check"></i> Conectada · atualizada ${quando(c.saldoInformadoEm)}`
                    : '<i class="fa-solid fa-pen-to-square"></i> Manual'}${c.arquivada ? ' · arquivada' : ''}</small>
            </span>
            <span class="fin-conta-saldo ${c.saldo < 0 ? 'negativo' : ''}">${reais(c.saldo)}</span>
            <span class="fin-conta-acoes" data-permissao="financas:gerenciar">
                ${!c.conectada ? `<button type="button" class="icon-btn" data-acao="fin-ajustar-saldo" data-id="${c.id}" aria-label="Ajustar saldo" title="Ajustar saldo"><i class="fa-solid fa-scale-balanced"></i></button>` : ''}
                <button type="button" class="icon-btn" data-acao="fin-editar-conta" data-id="${c.id}" aria-label="Editar conta" title="Editar"><i class="fa-solid fa-pen"></i></button>
            </span>
        </article>`;
}

export function renderizarContas() {
    const container = document.getElementById('fin-contas');
    if (!container) return;
    const ativas = estado.contas.filter(c => !c.arquivada);
    const disponiveis = ativas.filter(c => !c.reserva);
    const reservas = ativas.filter(c => c.reserva);
    const arquivadas = estado.contas.filter(c => c.arquivada);
    const soma = (lista) => lista.reduce((s, c) => s + c.saldo, 0);

    container.innerHTML = estado.contas.length ? `
        <section class="fin-grupo-contas">
            <h3 class="fin-grupo-titulo"><span><i class="fa-solid fa-wallet"></i> Disponível</span><strong>${reais(soma(disponiveis))}</strong></h3>
            ${disponiveis.map(htmlConta).join('') || '<p class="empty-state">Nenhuma conta.</p>'}
        </section>
        <section class="fin-grupo-contas reserva">
            <h3 class="fin-grupo-titulo"><span><i class="fa-solid fa-piggy-bank"></i> Reserva de emergência</span><strong>${reais(soma(reservas))}</strong></h3>
            ${reservas.map(htmlConta).join('') || '<p class="empty-state">Marque caixinhas e investimentos como reserva para acompanhar aqui.</p>'}
        </section>
        ${arquivadas.length ? `<details class="fin-arquivadas"><summary>${arquivadas.length} conta(s) arquivada(s)</summary>${arquivadas.map(htmlConta).join('')}</details>` : ''}
    ` : '<div class="card"><p class="empty-state">Nenhuma conta ainda. Crie uma conta manual ou conecte um banco.</p></div>';

    renderizarConexoes();
    aplicarPermissoes(document.getElementById('aba-financas-contas'));
}

function renderizarConexoes() {
    const ativas = estado.conexoes.filter(c => c.status !== 'desconectada');
    document.getElementById('fin-conexoes').innerHTML = `
        <section class="card card-padded fin-conexoes">
            <h3 class="card-title"><i class="fa-solid fa-building-columns"></i> Bancos conectados (Open Finance)</h3>
            ${ativas.length ? `<ul class="fin-conexoes-lista">${ativas.map(c => `
                <li class="${c.status === 'erro' ? 'com-erro' : ''}">
                    <span class="fin-conexao-texto">
                        <strong>${escaparHtml(c.instituicao || c.provedor)}</strong>
                        <small>${c.status === 'erro' ? `<i class="fa-solid fa-triangle-exclamation"></i> ${escaparHtml(c.erro || 'Erro na última sincronização')}` : `Atualizado ${quando(c.ultimaSincronizacao)} · todo dia automaticamente`}</small>
                    </span>
                    <span data-permissao="financas:gerenciar">
                        <button type="button" class="icon-btn" data-acao="fin-sincronizar" data-id="${c.id}" aria-label="Sincronizar agora" title="Sincronizar agora"><i class="fa-solid fa-rotate"></i></button>
                        <button type="button" class="icon-btn danger" data-acao="fin-desconectar" data-id="${c.id}" aria-label="Desconectar" title="Desconectar"><i class="fa-solid fa-link-slash"></i></button>
                    </span>
                </li>`).join('')}</ul>` : '<p class="fin-ajuda">Nenhum banco conectado. Os lançamentos podem ser feitos à mão enquanto a conexão não estiver disponível.</p>'}
            <button type="button" class="btn btn-ghost" data-acao="fin-conectar" data-permissao="financas:gerenciar"><i class="fa-solid fa-plug"></i> Conectar banco</button>
        </section>`;
}

// ===== CONTA (criar/editar) =====
export function abrirConta({ id, aoMudar } = {}) {
    const c = id ? estado.contas.find(x => x.id === id) : null;
    const cor = c?.cor || CORES[0];
    const { corpo, fechar } = abrirPainel({
        titulo: c ? `Conta: ${c.nome}` : 'Nova conta manual',
        html: `
            <form class="form-stack" novalidate>
                <label class="field"><span>Nome *</span>
                    <input type="text" name="nome" maxlength="60" value="${escaparHtml(c?.nome || '')}" placeholder="Ex.: Nubank da casa" required></label>
                <div class="field-row">
                    <label class="field"><span>Tipo</span>
                        <select name="tipo">${Object.entries(TIPOS_CONTA).map(([chave, t]) => `<option value="${chave}" ${chave === (c?.tipo || 'corrente') ? 'selected' : ''}>${t.nome}</option>`).join('')}</select></label>
                    <label class="field"><span>Instituição</span>
                        <input type="text" name="instituicao" maxlength="60" value="${escaparHtml(c?.instituicao || '')}" placeholder="Banco"></label>
                </div>
                ${!c?.conectada ? `<label class="field"><span>Saldo inicial (R$)</span>
                    <input type="text" name="saldoInicial" inputmode="decimal" value="${c ? (c.saldoInicial < 0 ? '-' : '') + paraCampo(c.saldoInicial) : ''}" placeholder="0,00">
                    <small>Saldo antes do primeiro lançamento no app.</small></label>` : ''}
                <div class="field"><span>Cor</span>
                    <div class="categoria-cores">${CORES.map(x => `<button type="button" class="categoria-cor ${x === cor ? 'selecionada' : ''}" data-cor="${x}" style="background: ${x}" aria-label="Cor ${x}"></button>`).join('')}</div>
                </div>
                <label class="checkbox-label"><input type="checkbox" name="reserva" ${c ? (c.reserva ? 'checked' : '') : ''}> Faz parte da reserva de emergência</label>
                ${c ? `<label class="checkbox-label"><input type="checkbox" name="arquivada" ${c.arquivada ? 'checked' : ''}> Arquivada (some dos totais; o histórico continua)</label>` : ''}
                <div class="painel-acoes">
                    ${c && !c.conectada ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i></button>' : ''}
                    <button type="submit" class="btn btn-primary">${c ? 'Salvar' : 'Criar conta'}</button>
                </div>
            </form>`
    });
    const form = corpo.querySelector('form');
    let corEscolhida = cor;
    form.querySelector('.categoria-cores').addEventListener('click', (e) => {
        const botao = e.target.closest('[data-cor]');
        if (!botao) return;
        corEscolhida = botao.dataset.cor;
        form.querySelectorAll('.categoria-cor').forEach(b => b.classList.toggle('selecionada', b === botao));
    });
    // Caixinha/investimento já vem marcado como reserva
    form.elements.tipo.addEventListener('change', () => {
        if (!c) form.elements.reserva.checked = ['caixinha', 'investimento'].includes(form.elements.tipo.value);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            nome: form.elements.nome.value.trim(), tipo: form.elements.tipo.value, instituicao: form.elements.instituicao.value.trim(),
            cor: corEscolhida, reserva: form.elements.reserva.checked
        };
        if (!dados.nome) return mostrarNotificacao('Dê um nome para a conta', 'warning');
        if (form.elements.saldoInicial) {
            const texto = form.elements.saldoInicial.value.trim();
            const valor = lerReais(texto.replace('-', '')) || 0;
            dados.saldoInicial = texto.startsWith('-') ? -valor : valor;
        }
        if (form.elements.arquivada) dados.arquivada = form.elements.arquivada.checked;
        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            await api(c ? `/financas/contas/${c.id}` : '/financas/contas', { metodo: c ? 'PUT' : 'POST', corpo: dados });
            mostrarNotificacao(c ? 'Conta atualizada' : 'Conta criada', 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao salvar', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Excluir a conta "${c.nome}"?`, { titulo: 'Excluir conta', confirmarTexto: 'Excluir' }))) return;
        try {
            await api(`/financas/contas/${c.id}`, { metodo: 'DELETE' });
            mostrarNotificacao('Conta excluída', 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao excluir', 'error');
        }
    });
}

// Informar o saldo real de uma conta manual (ex.: caixinha que rendeu): o app lança a diferença
export async function ajustarSaldo({ id }) {
    const c = estado.contas.find(x => x.id === id);
    const texto = await mostrarPrompt(`Saldo atual: ${reais(c.saldo)}. Qual é o saldo real agora? A diferença entra como "Ajuste de saldo" (não conta como gasto).`, paraCampo(c.saldo), { titulo: `Ajustar ${c.nome}`, confirmarTexto: 'Ajustar', placeholder: '0,00' });
    if (texto === null) return false;
    const saldo = lerReais(texto.replace('-', ''));
    if (saldo === null) {
        mostrarNotificacao('Valor inválido', 'warning');
        return false;
    }
    const { diferenca } = await api(`/financas/contas/${id}/ajuste`, { metodo: 'POST', corpo: { saldo: texto.trim().startsWith('-') ? -saldo : saldo } });
    mostrarNotificacao(diferenca ? `Ajuste de ${reais(diferenca)} lançado` : 'O saldo já estava certo', 'success');
    return true;
}

// ===== CONEXÕES =====
export function abrirConectar({ aoMudar } = {}) {
    const { corpo, fechar } = abrirPainel({
        titulo: 'Conectar banco',
        html: `
            <p class="fin-ajuda">Pelo <strong>Open Finance</strong>, o app lê saldos e lançamentos do banco (sem poder mexer no dinheiro) e atualiza uma vez por dia.</p>
            <div class="menu-usuario-itens">${estado.provedores.map(p => `
                <div class="fin-provedor ${p.disponivel ? '' : 'indisponivel'}">
                    <span class="fin-provedor-texto"><strong>${escaparHtml(p.nome)}</strong><small>${escaparHtml(p.disponivel ? p.descricao : p.comoConfigurar)}</small></span>
                    ${p.disponivel ? `<button type="button" class="btn btn-primary btn-sm" data-provedor="${escaparHtml(p.id)}">Conectar</button>` : '<span class="fin-em-breve">Em breve</span>'}
                </div>`).join('')}
            </div>`
    });
    corpo.querySelectorAll('[data-provedor]').forEach(botao => botao.addEventListener('click', async () => {
        definirCarregando(botao, true, '⏳');
        try {
            const { resultado } = await api('/financas/conexoes', { metodo: 'POST', corpo: { provedor: botao.dataset.provedor } });
            mostrarNotificacao(resultado.erro ? `Conectado, mas a sincronização falhou: ${resultado.erro}` : `Banco conectado! ${resultado.novas} lançamento(s) importados`, resultado.erro ? 'warning' : 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao conectar', 'error');
            definirCarregando(botao, false);
        }
    }));
}

export async function sincronizar({ id }) {
    const resultado = await api(`/financas/conexoes/${id}/sincronizar`, { metodo: 'POST' });
    mostrarNotificacao(resultado.erro ? `Falhou: ${resultado.erro}` : `${resultado.novas} lançamento(s) novos`, resultado.erro ? 'error' : 'success');
}

export async function desconectar({ id }) {
    const conexao = estado.conexoes.find(c => c.id === id);
    if (!(await mostrarConfirmacao(`Desconectar ${conexao?.instituicao || 'o banco'}? As contas viram manuais, com o último saldo, e todo o histórico continua no app.`, { titulo: 'Desconectar banco', confirmarTexto: 'Desconectar' }))) return false;
    await api(`/financas/conexoes/${id}`, { metodo: 'DELETE' });
    mostrarNotificacao('Banco desconectado', 'success');
    return true;
}
