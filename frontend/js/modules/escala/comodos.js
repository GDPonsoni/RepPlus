import { api } from '../../core/api.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { escaparHtml, mostrarNotificacao, validarArquivoImagem, abrirAccordion } from '../../core/ui.js';
import { estado } from './estado.js';

// Config > Cômodos e Tarefas

export async function carregarComodos() {
    try {
        estado.comodos = await api('/comodos');
        renderizarComodos();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados', 'error');
    }
}

function limparFormularioNovo() {
    document.getElementById('form-comodo').reset();
    document.getElementById('comodo-pessoas').value = '1';
    document.getElementById('comodo-ordem').value = '0';
    document.getElementById('comodo-obrigatorio').checked = true;
    estado.imagemComodoAtual = null;
    document.getElementById('upload-status').textContent = '';
    atualizarPreviewImagemComodo(null);
}

export async function adicionarOuEditarComodo(e) {
    e.preventDefault();

    const comodoId = document.getElementById('comodo-id').value;
    const nome = document.getElementById('comodo-nome').value.trim();
    const apenassuiteMembers = document.getElementById('comodo-suite').checked;
    const obrigatorio = document.getElementById('comodo-obrigatorio').checked;
    const pessoasNecessarias = parseInt(document.getElementById('comodo-pessoas').value) || 1;
    const ordem = parseInt(document.getElementById('comodo-ordem').value) || 0;
    const imagem = estado.imagemComodoAtual ?? null;

    if (!nome) {
        mostrarNotificacao('Digite um nome', 'warning');
        return;
    }

    const corpo = { nome, imagem, apenassuiteMembers, pessoasNecessarias, obrigatorio, ordem };

    try {
        if (comodoId) {
            // Edição
            const comodoAtualizado = await api(`/comodos/${comodoId}`, { metodo: 'PUT', corpo });
            const idx = estado.comodos.findIndex(c => c.id == comodoId);
            if (idx !== -1) estado.comodos[idx] = comodoAtualizado;
            cancelarEdicaoComodo();
            mostrarNotificacao(`${nome} atualizado!`, 'success');
        } else {
            // Novo
            const novoComodo = await api('/comodos', { metodo: 'POST', corpo });
            estado.comodos.push(novoComodo);
            renderizarComodos();
            limparFormularioNovo();
            mostrarNotificacao(`${nome} adicionado!`, 'success');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao salvar cômodo', 'error');
    }
}

export function editarComodo(id) {
    const comodo = estado.comodos.find(c => c.id == id);
    if (!comodo) {
        console.error('Comodo não encontrado:', id);
        return;
    }

    document.getElementById('comodo-id').value = id;
    document.getElementById('comodo-nome').value = comodo.nome;
    document.getElementById('comodo-suite').checked = comodo.apenassuiteMembers;
    document.getElementById('comodo-obrigatorio').checked = comodo.obrigatorio !== false;
    document.getElementById('comodo-pessoas').value = comodo.pessoasNecessarias || 1;
    document.getElementById('comodo-ordem').value = comodo.ordem || 0;
    document.getElementById('comodo-form-titulo').textContent = `Editando: ${comodo.nome}`;
    document.getElementById('btn-comodo-submit').textContent = 'Salvar Alterações';
    document.getElementById('btn-comodo-cancel').style.display = '';
    document.getElementById('form-comodo').classList.add('form-editando');
    estado.editandoComodoId = String(id);
    renderizarComodos();
    abrirAccordion('acc-comodos');

    estado.imagemComodoAtual = comodo.imagem || null;
    atualizarPreviewImagemComodo(estado.imagemComodoAtual);
    document.getElementById('upload-status').textContent = '';

    // Scroll para o formulário
    setTimeout(() => {
        document.getElementById('form-comodo').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

export function cancelarEdicaoComodo() {
    document.getElementById('comodo-id').value = '';
    document.getElementById('comodo-form-titulo').textContent = 'Novo cômodo/tarefa';
    document.getElementById('btn-comodo-submit').textContent = 'Adicionar Cômodo';
    document.getElementById('btn-comodo-cancel').style.display = 'none';
    limparFormularioNovo();
    document.getElementById('form-comodo').classList.remove('form-editando');
    estado.editandoComodoId = null;
    renderizarComodos();
}

function atualizarPreviewImagemComodo(imagemPath) {
    const preview = document.getElementById('comodo-imagem-preview');
    const btnRemover = document.getElementById('btn-comodo-imagem-remover');
    if (!preview || !btnRemover) return;

    if (imagemPath) {
        preview.innerHTML = `<img src="${imagemPath}" alt="Imagem do cômodo">`;
        btnRemover.style.display = '';
    } else {
        preview.innerHTML = '';
        btnRemover.style.display = 'none';
    }
}

export function removerImagemComodo() {
    estado.imagemComodoAtual = null;
    document.getElementById('comodo-imagem').value = '';
    document.getElementById('upload-status').textContent = '';
    atualizarPreviewImagemComodo(null);
}

export async function uploadImagemComodo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const erroValidacao = validarArquivoImagem(file);
    if (erroValidacao) {
        mostrarNotificacao(erroValidacao, 'error');
        e.target.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    document.getElementById('upload-status').textContent = '⏳ Enviando...';

    try {
        const data = await api('/upload-comodo-image', { metodo: 'POST', formData });
        estado.imagemComodoAtual = data.path;
        atualizarPreviewImagemComodo(data.path);
        document.getElementById('upload-status').textContent = '✅ Imagem selecionada';
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('upload-status').textContent = '';
        mostrarNotificacao(error.message || 'Erro ao fazer upload', 'error');
    }
}

export async function deletarComodo(id) {
    if (!(await mostrarConfirmacao('Tem certeza que deseja remover este cômodo?'))) return;

    try {
        await api(`/comodos/${id}`, { metodo: 'DELETE' });
        estado.comodos = estado.comodos.filter(c => c.id !== id);
        if (estado.editandoComodoId === String(id)) cancelarEdicaoComodo();
        renderizarComodos();
        mostrarNotificacao('Cômodo removido', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao remover', 'error');
    }
}

function renderizarComodos() {
    const container = document.getElementById('comodos-list');
    container.innerHTML = '';

    if (estado.comodos.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum cômodo cadastrado.</p>';
    }

    estado.comodos.forEach(comodo => {
        const pessoas = comodo.pessoasNecessarias || 1;
        const editando = estado.editandoComodoId === String(comodo.id);
        const item = document.createElement('div');
        item.className = `list-item ${editando ? 'editando' : ''}`;
        item.innerHTML = `
            ${comodo.imagem ? `<img class="list-item-thumb" src="${escaparHtml(comodo.imagem)}" alt="">` : ''}
            <div class="list-item-info">
                <span class="list-item-name">${escaparHtml(comodo.nome)}</span>
                <div class="list-item-meta">
                    ${editando ? '<span class="list-item-badge badge-editando"><i class="fa-solid fa-pen"></i> Editando</span>' : ''}
                    ${comodo.apenassuiteMembers ? '<span class="list-item-badge">Suíte</span>' : ''}
                    <span class="list-item-badge list-item-badge-muted">${comodo.obrigatorio === false ? 'Opcional' : 'Obrigatório'}</span>
                    <span class="list-item-badge list-item-badge-muted">${pessoas} pessoa${pessoas > 1 ? 's' : ''}</span>
                    <span class="list-item-badge list-item-badge-muted">Ordem ${comodo.ordem ?? 0}</span>
                </div>
            </div>
            <div class="list-item-actions" data-permissao="comodos:gerenciar">
                <button class="icon-btn" title="Editar" aria-label="Editar" data-acao="editar-comodo" data-id="${escaparHtml(comodo.id)}"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" title="Remover" aria-label="Remover" data-acao="remover-comodo" data-id="${escaparHtml(comodo.id)}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(item);
    });

    aplicarPermissoes(container);
}
