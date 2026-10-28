import { api } from './api.js';
import { emitir } from './eventos.js';
import { registrarAcoes } from './acoes.js';
import { aplicarPermissoes } from './sessao.js';
import { mostrarConfirmacao } from './modal.js';
import { escaparHtml, mostrarNotificacao, abrirAccordion } from './ui.js';

// Moradores (integrantes) são do núcleo: todos os módulos usam esta lista.
// Outros módulos leem com obterIntegrantes() e reagem a mudanças com ouvir('moradores:atualizados').
const estado = {
    integrantes: [],
    editandoIntegranteId: null
};

export function obterIntegrantes() {
    return estado.integrantes;
}

const HTML_SECAO = `
    <div id="integrantes-list" class="item-list">
        <!-- Preenchido dinamicamente -->
    </div>
    <form id="form-integrante" class="form-stack form-divider" data-permissao="moradores:gerenciar">
        <h4 class="form-title" id="integrante-form-titulo">Novo integrante</h4>
        <input type="hidden" id="integrante-id">
        <input type="text" id="integrante-nome" placeholder="Nome do integrante" required>
        <div class="check-row">
            <label class="checkbox-label"><input type="checkbox" id="integrante-suite"> É da suíte?</label>
            <label class="checkbox-label"><input type="checkbox" id="integrante-ativo" checked> Está ativo?</label>
        </div>
        <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="btn-integrante-cancel" style="display:none;">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-integrante-submit">Adicionar Integrante</button>
        </div>
    </form>
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

async function adicionarOuEditarIntegrante(e) {
    e.preventDefault();

    const integranteId = document.getElementById('integrante-id').value;
    const nome = document.getElementById('integrante-nome').value.trim();
    const isSuite = document.getElementById('integrante-suite').checked;
    const ativo = document.getElementById('integrante-ativo').checked;

    if (!nome) {
        mostrarNotificacao('Digite um nome', 'warning');
        return;
    }

    try {
        if (integranteId) {
            // Edição
            const integranteAtualizado = await api(`/integrantes/${integranteId}`, { metodo: 'PUT', corpo: { nome, isSuite, ativo } });
            const idx = estado.integrantes.findIndex(i => i.id == integranteId);
            if (idx !== -1) estado.integrantes[idx] = integranteAtualizado;
            cancelarEdicaoIntegrante();
            mostrarNotificacao(`${nome} atualizado!`, 'success');
        } else {
            // Novo
            const novoIntegrante = await api('/integrantes', { metodo: 'POST', corpo: { nome, isSuite } });
            estado.integrantes.push(novoIntegrante);
            renderizarIntegrantes();
            document.getElementById('form-integrante').reset();
            mostrarNotificacao(`${nome} adicionado!`, 'success');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao salvar integrante', 'error');
    }
}

function editarIntegrante(id) {
    const integrante = estado.integrantes.find(i => i.id == id);
    if (!integrante) {
        console.error('Integrante não encontrado:', id);
        return;
    }

    document.getElementById('integrante-id').value = id;
    document.getElementById('integrante-nome').value = integrante.nome;
    document.getElementById('integrante-suite').checked = integrante.isSuite;
    document.getElementById('integrante-ativo').checked = integrante.ativo !== false;
    document.getElementById('integrante-form-titulo').textContent = `Editando: ${integrante.nome}`;
    document.getElementById('btn-integrante-submit').textContent = 'Salvar Alterações';
    document.getElementById('btn-integrante-cancel').style.display = '';
    document.getElementById('form-integrante').classList.add('form-editando');
    estado.editandoIntegranteId = String(id);
    renderizarIntegrantes();
    abrirAccordion('acc-integrantes');

    // Scroll para o formulário
    setTimeout(() => {
        document.getElementById('form-integrante').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function cancelarEdicaoIntegrante() {
    document.getElementById('integrante-id').value = '';
    document.getElementById('form-integrante').reset();
    document.getElementById('integrante-form-titulo').textContent = 'Novo integrante';
    document.getElementById('btn-integrante-submit').textContent = 'Adicionar Integrante';
    document.getElementById('btn-integrante-cancel').style.display = 'none';
    document.getElementById('integrante-ativo').checked = true;
    document.getElementById('form-integrante').classList.remove('form-editando');
    estado.editandoIntegranteId = null;
    renderizarIntegrantes();
}

async function deletarIntegrante(id) {
    if (!(await mostrarConfirmacao('Tem certeza que deseja remover este integrante?'))) return;

    try {
        await api(`/integrantes/${id}`, { metodo: 'DELETE' });
        estado.integrantes = estado.integrantes.filter(i => i.id !== id);
        if (estado.editandoIntegranteId === String(id)) cancelarEdicaoIntegrante();
        renderizarIntegrantes();
        mostrarNotificacao('Integrante removido', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao remover', 'error');
    }
}

function renderizarIntegrantes() {
    const container = document.getElementById('integrantes-list');
    container.innerHTML = '';

    if (estado.integrantes.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum integrante cadastrado.</p>';
    }

    estado.integrantes.forEach(integrante => {
        const inativo = integrante.ativo === false;
        const editando = estado.editandoIntegranteId === String(integrante.id);
        const item = document.createElement('div');
        item.className = `list-item ${inativo ? 'inativo' : ''} ${editando ? 'editando' : ''}`;
        item.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-name">${escaparHtml(integrante.nome)}</span>
                <div class="list-item-meta">
                    ${editando ? '<span class="list-item-badge badge-editando"><i class="fa-solid fa-pen"></i> Editando</span>' : ''}
                    ${integrante.isSuite ? '<span class="list-item-badge">Suíte</span>' : ''}
                    <span class="list-item-badge list-item-badge-muted">${inativo ? 'Inativo' : 'Ativo'}</span>
                </div>
            </div>
            <div class="list-item-actions" data-permissao="moradores:gerenciar">
                <button class="icon-btn" title="Editar" aria-label="Editar" data-acao="editar-integrante" data-id="${escaparHtml(integrante.id)}"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" title="Remover" aria-label="Remover" data-acao="remover-integrante" data-id="${escaparHtml(integrante.id)}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(item);
    });

    aplicarPermissoes(container);
    emitir('moradores:atualizados', estado.integrantes);
}

export default {
    id: 'moradores',
    secoesConfig: [
        { id: 'acc-integrantes', titulo: 'Integrantes da República', icone: 'fa-solid fa-users', cor: 'icon-blue', html: HTML_SECAO }
    ],

    async iniciar() {
        document.getElementById('form-integrante').addEventListener('submit', adicionarOuEditarIntegrante);
        document.getElementById('btn-integrante-cancel').addEventListener('click', cancelarEdicaoIntegrante);
        registrarAcoes({
            'editar-integrante': ({ id }) => editarIntegrante(id),
            'remover-integrante': ({ id }) => deletarIntegrante(id)
        });
        await carregarIntegrantes();
    }
};
