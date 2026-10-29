import { api } from './api.js';
import { emitir } from './eventos.js';
import { registrarAcoes } from './acoes.js';
import { aplicarPermissoes, temPermissao } from './sessao.js';
import { mostrarConfirmacao } from './modal.js';
import { abrirPainel } from './painel.js';
import { escaparHtml, iniciais, mostrarNotificacao, definirCarregando } from './ui.js';
import { formatarDia, idadeEm, proximoAniversario } from './datas.js';

// Moradores (integrantes) são do núcleo: cadastro global usado por todos os módulos.
// Outros módulos leem com obterIntegrantes() e reagem a mudanças com ouvir('moradores:atualizados').
const estado = {
    integrantes: []
};

export function obterIntegrantes() {
    return estado.integrantes;
}

const HTML_PAGINA = `
    <div class="pagina-topo">
        <h2 class="section-title">Moradores</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="novo-morador" data-permissao="moradores:gerenciar">
            <i class="fa-solid fa-user-plus"></i> Novo
        </button>
    </div>
    <div id="aniversarios-proximos"></div>
    <div id="integrantes-list" class="morador-lista">
        <!-- Preenchido dinamicamente -->
    </div>
`;

async function carregarIntegrantes() {
    try {
        estado.integrantes = await api('/integrantes');
        renderizarIntegrantes();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados', 'error');
    }
}

const ordenarPorNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

function textoAniversario(integrante) {
    if (!integrante.dataNascimento) return '';
    const data = formatarDia(integrante.dataNascimento, { day: '2-digit', month: '2-digit' });
    return `<span><i class="fa-solid fa-cake-candles"></i> ${data} · ${idadeEm(integrante.dataNascimento)} anos</span>`;
}

// Contato de emergência no card; morador ativo sem contato ganha um aviso para completar o cadastro
function textoEmergencia(integrante) {
    if (integrante.emergenciaTelefone) {
        const quem = [integrante.emergenciaNome, integrante.emergenciaParentesco && `(${integrante.emergenciaParentesco})`].filter(Boolean).join(' ');
        return `<span class="morador-emergencia"><i class="fa-solid fa-truck-medical"></i> ${escaparHtml(quem || 'Emergência')}: ${escaparHtml(integrante.emergenciaTelefone)}</span>`;
    }
    if (integrante.ativo === false) return '';
    return '<span class="morador-emergencia faltando"><i class="fa-solid fa-triangle-exclamation"></i> Sem contato de emergência</span>';
}

function renderizarIntegrantes() {
    const container = document.getElementById('integrantes-list');
    // Sem a página (usuário sem permissão de ver), só avisa os outros módulos
    if (!container) {
        emitir('moradores:atualizados', estado.integrantes);
        return;
    }

    if (estado.integrantes.length === 0) {
        container.innerHTML = '<div class="card"><p class="empty-state">Nenhum morador cadastrado.</p></div>';
    } else {
        // Ativos primeiro, depois inativos; cada grupo em ordem alfabética
        const ordenados = [...estado.integrantes].sort((a, b) => (a.ativo === false) - (b.ativo === false) || ordenarPorNome(a, b));
        container.innerHTML = ordenados.map(integrante => {
            const inativo = integrante.ativo === false;
            return `
                <button type="button" class="morador-card ${inativo ? 'inativo' : ''}" data-acao="abrir-morador" data-id="${escaparHtml(integrante.id)}">
                    <span class="avatar avatar-lg">${escaparHtml(iniciais(integrante.nome))}</span>
                    <span class="morador-info">
                        <span class="morador-nome">
                            ${escaparHtml(integrante.nome)}
                            ${integrante.isSuite ? '<span class="list-item-badge">Suíte</span>' : ''}
                            ${inativo ? '<span class="list-item-badge list-item-badge-muted">Inativo</span>' : ''}
                        </span>
                        ${integrante.nomeCompleto ? `<span class="morador-nome-completo">${escaparHtml(integrante.nomeCompleto)}</span>` : ''}
                        <span class="morador-meta">
                            ${textoAniversario(integrante)}
                            ${integrante.telefone ? `<span><i class="fa-solid fa-phone"></i> ${escaparHtml(integrante.telefone)}</span>` : ''}
                        </span>
                        ${textoEmergencia(integrante)}
                    </span>
                    <i class="fa-solid fa-chevron-right morador-seta"></i>
                </button>
            `;
        }).join('');
    }

    renderizarAniversarios();
    emitir('moradores:atualizados', estado.integrantes);
}

// Próximos 3 aniversários (só moradores ativos)
function renderizarAniversarios() {
    const container = document.getElementById('aniversarios-proximos');
    const proximos = estado.integrantes
        .filter(i => i.ativo !== false && i.dataNascimento)
        .map(i => ({ integrante: i, ...proximoAniversario(i.dataNascimento) }))
        .sort((a, b) => a.emDias - b.emDias)
        .slice(0, 3);

    if (proximos.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="card card-padded aniversarios-card">
            <h3 class="card-title"><i class="fa-solid fa-cake-candles"></i> Próximos aniversários</h3>
            <div class="aniversarios-lista">
                ${proximos.map(({ integrante, dia, emDias, idade }) => `
                    <div class="aniversario-item ${emDias === 0 ? 'hoje' : ''}">
                        <span class="aniversario-data">${formatarDia(dia, { day: '2-digit', month: 'short' }).replace(' de ', ' ').replace('.', '')}</span>
                        <span class="aniversario-nome">${escaparHtml(integrante.nome)}</span>
                        <span class="aniversario-quando">${emDias === 0 ? 'Hoje! 🎉' : emDias === 1 ? 'Amanhã' : `em ${emDias} dias`} · ${idade} anos</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ===== FORMULÁRIO (painel) =====
function htmlFormulario(integrante, podeEditar) {
    const v = (campo) => escaparHtml(integrante?.[campo] ?? '');
    const desabilitado = podeEditar ? '' : 'disabled';
    return `
        <form id="form-morador" class="form-stack" novalidate>
            <label class="field">
                <span>Nome na casa (apelido) *</span>
                <input type="text" name="nome" value="${v('nome')}" maxlength="60" required ${desabilitado}>
            </label>
            <label class="field">
                <span>Nome completo</span>
                <input type="text" name="nomeCompleto" value="${v('nomeCompleto')}" maxlength="120" autocomplete="name" ${desabilitado}>
            </label>
            <div class="field-row">
                <label class="field">
                    <span>Nascimento</span>
                    <input type="date" name="dataNascimento" value="${v('dataNascimento')}" ${desabilitado}>
                </label>
                <label class="field">
                    <span>Entrou na casa em</span>
                    <input type="date" name="dataEntrada" value="${v('dataEntrada')}" ${desabilitado}>
                </label>
            </div>
            <div class="field-row">
                <label class="field">
                    <span>Telefone</span>
                    <input type="tel" name="telefone" value="${v('telefone')}" maxlength="30" inputmode="tel" autocomplete="tel" ${desabilitado}>
                </label>
                <label class="field">
                    <span>E-mail</span>
                    <input type="email" name="email" value="${v('email')}" maxlength="120" inputmode="email" autocomplete="email" ${desabilitado}>
                </label>
            </div>
            <fieldset class="form-grupo form-grupo-emergencia">
                <legend><i class="fa-solid fa-truck-medical"></i> Contato de emergência</legend>
                <div class="field-row">
                    <label class="field">
                        <span>Nome</span>
                        <input type="text" name="emergenciaNome" value="${v('emergenciaNome')}" maxlength="120" placeholder="Ex.: Maria Silva" ${desabilitado}>
                    </label>
                    <label class="field">
                        <span>Parentesco</span>
                        <input type="text" name="emergenciaParentesco" value="${v('emergenciaParentesco')}" maxlength="40" placeholder="Ex.: Mãe" list="parentescos" ${desabilitado}>
                    </label>
                </div>
                <label class="field">
                    <span>Telefone</span>
                    <span class="campo-com-acao">
                        <input type="tel" name="emergenciaTelefone" value="${v('emergenciaTelefone')}" maxlength="30" inputmode="tel" ${desabilitado}>
                        ${integrante?.emergenciaTelefone ? `<a class="btn btn-ghost btn-ligar" href="tel:${escaparHtml(integrante.emergenciaTelefone.replace(/[^\d+]/g, ''))}"><i class="fa-solid fa-phone"></i> Ligar</a>` : ''}
                    </span>
                </label>
                <datalist id="parentescos">
                    <option value="Mãe"><option value="Pai"><option value="Irmão(ã)"><option value="Avó/Avô">
                    <option value="Tio(a)"><option value="Cônjuge"><option value="Namorado(a)"><option value="Amigo(a)">
                </datalist>
            </fieldset>
            <fieldset class="form-grupo" data-permissao="moradores:documentos">
                <legend><i class="fa-solid fa-id-card"></i> Documentos</legend>
                <div class="field-row">
                    <label class="field">
                        <span>CPF</span>
                        <input type="text" name="cpf" value="${v('cpf')}" maxlength="20" inputmode="numeric" ${desabilitado}>
                    </label>
                    <label class="field">
                        <span>RG</span>
                        <input type="text" name="rg" value="${v('rg')}" maxlength="20" ${desabilitado}>
                    </label>
                </div>
            </fieldset>
            <div class="check-row">
                <label class="checkbox-label"><input type="checkbox" name="isSuite" ${integrante?.isSuite ? 'checked' : ''} ${desabilitado}> É da suíte?</label>
                <label class="checkbox-label"><input type="checkbox" name="ativo" ${integrante?.ativo === false ? '' : 'checked'} ${desabilitado}> Está ativo?</label>
            </div>
            <label class="field">
                <span>Observações</span>
                <textarea name="observacoes" maxlength="500" rows="3" placeholder="Alergias, medicamentos, plano de saúde..." ${desabilitado}>${v('observacoes')}</textarea>
            </label>
            ${podeEditar ? `
                <div class="painel-acoes">
                    ${integrante ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                    <button type="submit" class="btn btn-primary">${integrante ? 'Salvar alterações' : 'Adicionar morador'}</button>
                </div>
            ` : ''}
        </form>
    `;
}

function abrirFormulario(id = null) {
    const integrante = id ? estado.integrantes.find(i => String(i.id) === String(id)) : null;
    if (id && !integrante) return;
    const podeEditar = temPermissao('moradores:gerenciar');

    const { corpo, fechar } = abrirPainel({
        titulo: integrante ? (podeEditar ? `Editando: ${integrante.nome}` : integrante.nome) : 'Novo morador',
        html: htmlFormulario(integrante, podeEditar)
    });
    aplicarPermissoes(corpo);

    const form = corpo.querySelector('#form-morador');
    if (!integrante) form.elements.nome.focus();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = Object.fromEntries(['nome', 'nomeCompleto', 'dataNascimento', 'dataEntrada', 'telefone', 'email', 'observacoes', 'emergenciaNome', 'emergenciaParentesco', 'emergenciaTelefone']
            .map(campo => [campo, form.elements[campo].value.trim()]));
        dados.isSuite = form.elements.isSuite.checked;
        dados.ativo = form.elements.ativo.checked;
        if (temPermissao('moradores:documentos')) {
            dados.cpf = form.elements.cpf.value.trim();
            dados.rg = form.elements.rg.value.trim();
        }

        if (!dados.nome) {
            mostrarNotificacao('Digite um nome', 'warning');
            form.elements.nome.focus();
            return;
        }

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            if (integrante) {
                const atualizado = await api(`/integrantes/${integrante.id}`, { metodo: 'PUT', corpo: dados });
                estado.integrantes = estado.integrantes.map(i => (i.id === integrante.id ? atualizado : i));
                mostrarNotificacao(`${dados.nome} atualizado!`, 'success');
            } else {
                const novo = await api('/integrantes', { metodo: 'POST', corpo: dados });
                estado.integrantes.push(novo);
                mostrarNotificacao(`${dados.nome} adicionado!`, 'success');
            }
            renderizarIntegrantes();
            fechar();
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar integrante', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Remover ${integrante.nome} do cadastro? O histórico da escala é mantido.`, { titulo: 'Remover morador', confirmarTexto: 'Remover' }))) return;
        try {
            await api(`/integrantes/${integrante.id}`, { metodo: 'DELETE' });
            estado.integrantes = estado.integrantes.filter(i => i.id !== integrante.id);
            renderizarIntegrantes();
            fechar();
            mostrarNotificacao('Integrante removido', 'success');
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao remover', 'error');
        }
    });
}

export default {
    id: 'moradores',
    nome: 'Moradores',
    descricao: 'Cadastro, contatos e aniversários',
    icone: 'fa-solid fa-users',
    cor: 'icon-blue',
    global: true,
    abas: [
        { id: 'lista', titulo: 'Moradores', icone: 'fa-solid fa-users', html: HTML_PAGINA, permissao: 'moradores:ver' }
    ],

    async iniciar() {
        registrarAcoes({
            'novo-morador': () => abrirFormulario(),
            'abrir-morador': ({ id }) => abrirFormulario(id)
        });
        await carregarIntegrantes();
    }
};
