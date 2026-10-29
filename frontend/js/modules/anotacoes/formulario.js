import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { cofreDisponivel, cofreExiste, cofreDestrancado, criarCofre, destrancarCofre, trocarSenhaDoCofre, cifrar } from './cofre.js';
import { TIPOS, CATEGORIAS_CONTA, SERVICOS, estado, buscarAnotacao, decifrarSegredos, salvarAnotacao, excluirAnotacao } from './dados.js';

const SENHA_MINIMA = 8;

// ===== SENHA DO COFRE =====
// Painel com campo de senha; resolve true quando a ação deu certo, false se fechou
function painelSenha({ titulo, explicacao, confirmar, botao, aoEnviar }) {
    return new Promise((resolve) => {
        let resolvido = false;
        const terminar = (valor) => { if (!resolvido) { resolvido = true; resolve(valor); } };
        const { corpo, fechar } = abrirPainel({
            titulo,
            aoFechar: () => terminar(false),
            html: `
                <form class="form-stack form-cofre" novalidate>
                    ${explicacao ? `<div class="cofre-explicacao">${explicacao}</div>` : ''}
                    <label class="field"><span>Senha do cofre</span>
                        <input type="password" name="senha" autocomplete="${confirmar ? 'new-password' : 'current-password'}" required>
                    </label>
                    ${confirmar ? `<label class="field"><span>Repita a senha</span>
                        <input type="password" name="confirmacao" autocomplete="new-password" required></label>` : ''}
                    <div class="painel-acoes"><button type="submit" class="btn btn-primary">${botao}</button></div>
                </form>
            `
        });
        const form = corpo.querySelector('form');
        form.elements.senha.focus();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const senha = form.elements.senha.value;
            if (confirmar) {
                if (senha.length < SENHA_MINIMA) return mostrarNotificacao(`Use pelo menos ${SENHA_MINIMA} caracteres`, 'warning');
                if (senha !== form.elements.confirmacao.value) return mostrarNotificacao('As senhas não são iguais', 'warning');
            }
            const botaoEnviar = form.querySelector('button[type="submit"]');
            definirCarregando(botaoEnviar, true, '⏳ Processando...');
            try {
                await aoEnviar(senha);
                terminar(true);
                fechar();
            } catch (error) {
                console.error('Erro:', error);
                mostrarNotificacao(error.message || 'Erro no cofre', 'error');
                definirCarregando(botaoEnviar, false);
                form.elements.senha.select();
            }
        });
    });
}

export function abrirCriarCofre() {
    return painelSenha({
        titulo: 'Criar o cofre da casa',
        confirmar: true,
        botao: 'Criar cofre',
        explicacao: `
            <p><i class="fa-solid fa-shield-halved"></i> Logins e senhas são criptografados <strong>neste aparelho</strong> com esta senha antes de ir para o servidor. Nem quem acessa o banco consegue ler.</p>
            <p><i class="fa-solid fa-triangle-exclamation"></i> <strong>Não dá para recuperar</strong> esta senha. Combine com a casa e guarde fora do app também.</p>`,
        aoEnviar: async (senha) => {
            await criarCofre(senha);
            mostrarNotificacao('Cofre criado e aberto!', 'success');
        }
    });
}

export function pedirSenhaDoCofre() {
    if (!cofreDisponivel()) {
        mostrarNotificacao('O cofre só funciona em conexão segura (https)', 'warning');
        return Promise.resolve(false);
    }
    if (!cofreExiste()) return abrirCriarCofre();
    if (cofreDestrancado()) return Promise.resolve(true);
    return painelSenha({
        titulo: 'Destrancar cofre',
        botao: 'Destrancar',
        aoEnviar: async (senha) => {
            await destrancarCofre(senha);
            mostrarNotificacao('Cofre aberto', 'success', 1500);
        }
    });
}

export async function abrirTrocarSenha() {
    if (!(await pedirSenhaDoCofre())) return;
    await painelSenha({
        titulo: 'Nova senha do cofre',
        confirmar: true,
        botao: 'Trocar senha',
        explicacao: '<p>As senhas guardadas continuam as mesmas; só muda a senha que abre o cofre. Avise a casa.</p>',
        aoEnviar: async (senha) => {
            await trocarSenhaDoCofre(senha);
            mostrarNotificacao('Senha do cofre trocada!', 'success');
        }
    });
}

// ===== FORMULÁRIO DE ANOTAÇÃO =====
function htmlCofreConta(segredo, podeEditar) {
    if (!cofreDestrancado()) {
        return `<div class="cofre-campos-trancados">
            <p><i class="fa-solid fa-lock"></i> Login e senha ficam no cofre.</p>
            <button type="button" class="btn btn-ghost btn-sm" data-papel="destrancar"><i class="fa-solid fa-lock-open"></i> ${cofreExiste() ? 'Destrancar para ver/editar' : 'Criar cofre'}</button>
        </div>`;
    }
    const v = (campo) => escaparHtml(segredo?.[campo] ?? '');
    const d = podeEditar ? '' : 'disabled';
    return `
        <label class="field"><span>Login / usuário / e-mail</span>
            <input type="text" name="usuario" value="${v('usuario')}" autocomplete="off" ${d}></label>
        <label class="field"><span>Senha</span>
            <span class="campo-com-acao">
                <input type="password" name="senha" value="${v('senha')}" autocomplete="new-password" ${d}>
                <button type="button" class="btn btn-ghost" data-papel="ver-senha" aria-label="Mostrar senha"><i class="fa-solid fa-eye"></i></button>
                ${podeEditar ? '<button type="button" class="btn btn-ghost" data-papel="gerar-senha" aria-label="Gerar senha forte"><i class="fa-solid fa-dice"></i></button>' : ''}
            </span></label>
        <label class="field"><span>Outros dados sigilosos</span>
            <textarea name="extra" rows="2" maxlength="1000" placeholder="PIN, nº do cliente, perguntas de segurança..." ${d}>${v('extra')}</textarea></label>
    `;
}

function htmlCampos(tipo, anotacao, segredo, podeEditar) {
    const dados = anotacao?.dados || {};
    const v = (campo) => escaparHtml(dados[campo] ?? '');
    const d = podeEditar ? '' : 'disabled';

    if (tipo === 'conta') {
        return `
            <div class="field"><span>Tipo</span>
                <div class="chips" role="radiogroup">
                    ${Object.entries(CATEGORIAS_CONTA).map(([id, c]) => `
                        <label class="chip acat-${id}"><input type="radio" name="categoria" value="${id}" ${id === (anotacao?.categoria || 'outros') ? 'checked' : ''} ${d}><span><i class="${c.icone}"></i> ${c.nome}</span></label>
                    `).join('')}
                </div>
            </div>
            <label class="field"><span>Site ou app</span>
                <input type="text" name="site" value="${v('site')}" maxlength="200" placeholder="netflix.com" inputmode="url" ${d}></label>
            <fieldset class="form-grupo form-grupo-cofre">
                <legend><i class="fa-solid fa-vault"></i> No cofre (criptografado)</legend>
                <div id="campos-cofre">${htmlCofreConta(segredo, podeEditar)}</div>
            </fieldset>
            <label class="field"><span>Observação (visível para todos)</span>
                <textarea name="observacao" rows="2" maxlength="500" placeholder="Vence dia 10, plano de 300 MB, no nome do Dias..." ${d}>${v('observacao')}</textarea></label>
        `;
    }
    if (tipo === 'contato') {
        return `
            <label class="field"><span>Serviço</span>
                <input type="text" name="categoria" value="${escaparHtml(anotacao?.categoria ?? '')}" maxlength="40" list="servicos-contato" placeholder="Ex.: Eletricista" ${d}>
                <datalist id="servicos-contato">${SERVICOS.map(s => `<option value="${s}">`).join('')}</datalist></label>
            <div class="field-row">
                <label class="field"><span>Telefone</span>
                    <input type="tel" name="telefone" value="${v('telefone')}" maxlength="30" inputmode="tel" ${d}></label>
                <label class="checkbox-label campo-whatsapp"><input type="checkbox" name="whatsapp" ${dados.whatsapp ? 'checked' : ''} ${d}> Tem WhatsApp</label>
            </div>
            <label class="field"><span>E-mail</span>
                <input type="email" name="email" value="${v('email')}" maxlength="120" inputmode="email" ${d}></label>
            <label class="field"><span>Site / Instagram</span>
                <input type="text" name="site" value="${v('site')}" maxlength="200" inputmode="url" ${d}></label>
            <label class="field"><span>Endereço</span>
                <input type="text" name="endereco" value="${v('endereco')}" maxlength="200" ${d}></label>
            <label class="field"><span>Observação</span>
                <textarea name="observacao" rows="3" maxlength="500" placeholder="Preço que cobrou, se foi bom, horário que atende..." ${d}>${v('observacao')}</textarea></label>
        `;
    }
    // nota
    const secreta = Boolean(anotacao?.segredo);
    const textoTrancado = secreta && !cofreDestrancado();
    return `
        ${textoTrancado
            ? `<div class="cofre-campos-trancados"><p><i class="fa-solid fa-lock"></i> O texto desta nota está no cofre.</p>
                <button type="button" class="btn btn-ghost btn-sm" data-papel="destrancar"><i class="fa-solid fa-lock-open"></i> Destrancar para ver/editar</button></div>`
            : `<label class="field"><span>Texto</span>
                <textarea name="texto" rows="8" maxlength="5000" ${d}>${escaparHtml(secreta ? segredo?.texto ?? '' : dados.texto ?? '')}</textarea></label>`}
        <div class="check-row">
            <label class="checkbox-label"><input type="checkbox" name="secreta" ${secreta ? 'checked' : ''} ${textoTrancado ? 'disabled' : d}> <i class="fa-solid fa-lock"></i> Nota secreta (no cofre)</label>
            <label class="checkbox-label"><input type="checkbox" name="fixado" ${anotacao?.fixado ? 'checked' : ''} ${d}> <i class="fa-solid fa-thumbtack"></i> Fixar no topo</label>
        </div>
    `;
}

function gerarSenha(tamanho = 16) {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    const sorteio = crypto.getRandomValues(new Uint32Array(tamanho));
    return Array.from(sorteio, n => caracteres[n % caracteres.length]).join('');
}

// Lê o formulário e monta o corpo da API (cifrando o que vai para o cofre)
async function lerFormulario(form, tipo, anotacao) {
    const valor = (nome) => form.elements[nome]?.value.trim() ?? '';
    const corpo = { titulo: valor('titulo') };

    if (tipo === 'conta') {
        corpo.categoria = form.elements.categoria.value;
        corpo.dados = { site: valor('site'), observacao: valor('observacao') };
        // Cofre trancado: o segredo não é enviado e continua como estava
        if (cofreDestrancado()) {
            corpo.segredo = await cifrar({ usuario: valor('usuario'), senha: form.elements.senha.value, extra: valor('extra') });
            if (!corpo.segredo && !anotacao?.segredo) delete corpo.segredo;
        }
    } else if (tipo === 'contato') {
        corpo.categoria = valor('categoria');
        corpo.dados = {
            telefone: valor('telefone'), whatsapp: form.elements.whatsapp.checked,
            email: valor('email'), site: valor('site'), endereco: valor('endereco'), observacao: valor('observacao')
        };
    } else {
        corpo.fixado = form.elements.fixado.checked;
        if (form.elements.texto) {
            const secreta = form.elements.secreta.checked;
            if (secreta && !cofreDestrancado()) throw new Error('Destranque o cofre para guardar uma nota secreta');
            corpo.dados = { texto: secreta ? '' : form.elements.texto.value.trim() };
            if (secreta) corpo.segredo = await cifrar({ texto: form.elements.texto.value.trim() }) || await cifrar({ texto: ' ' });
            else if (anotacao?.segredo) corpo.segredo = null;
        }
    }
    return corpo;
}

export async function abrirFormularioAnotacao({ id, tipo: tipoNovo, aoSalvar }) {
    const anotacao = id ? buscarAnotacao(id) : null;
    if (id && !anotacao) return;
    const tipo = anotacao?.tipo || tipoNovo;
    const podeEditar = temPermissao('anotacoes:editar');
    if (anotacao) await decifrarSegredos([anotacao]);
    const segredo = anotacao ? estado.segredos.get(anotacao.id) : null;

    const rotuloTitulo = { conta: 'Nome da conta *', contato: 'Nome / empresa *', nota: 'Título *' }[tipo];
    const exemploTitulo = { conta: 'Ex.: Wi-Fi da casa', contato: 'Ex.: Seu Zé', nota: 'Ex.: Código do portão' }[tipo];

    const { corpo, fechar } = abrirPainel({
        titulo: anotacao ? (podeEditar ? `Editando: ${anotacao.titulo}` : anotacao.titulo) : TIPOS[tipo].novo,
        html: `
            <form id="form-anotacao" class="form-stack" novalidate>
                <label class="field"><span>${rotuloTitulo}</span>
                    <input type="text" name="titulo" value="${escaparHtml(anotacao?.titulo ?? '')}" maxlength="80" placeholder="${exemploTitulo}" required ${podeEditar ? '' : 'disabled'}></label>
                ${htmlCampos(tipo, anotacao, segredo, podeEditar)}
                ${podeEditar ? `
                    <div class="painel-acoes">
                        ${anotacao ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                        <button type="submit" class="btn btn-primary">${anotacao ? 'Salvar' : 'Adicionar'}</button>
                    </div>` : ''}
            </form>
        `
    });
    aplicarPermissoes(corpo);
    const form = corpo.querySelector('#form-anotacao');
    if (!anotacao) form.elements.titulo.focus();

    // Destrancar dentro do formulário: reabre o mesmo formulário já com os campos do cofre
    form.querySelector('[data-papel="destrancar"]')?.addEventListener('click', async () => {
        if (!(await pedirSenhaDoCofre())) return;
        fechar();
        abrirFormularioAnotacao({ id, tipo, aoSalvar });
    });
    form.querySelector('[data-papel="ver-senha"]')?.addEventListener('click', (e) => {
        const campo = form.elements.senha;
        campo.type = campo.type === 'password' ? 'text' : 'password';
        e.currentTarget.querySelector('i').className = campo.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });
    form.querySelector('[data-papel="gerar-senha"]')?.addEventListener('click', () => {
        form.elements.senha.value = gerarSenha();
        form.elements.senha.type = 'text';
        mostrarNotificacao('Senha forte gerada. Salve para guardar.', 'info');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.elements.titulo.value.trim()) {
            mostrarNotificacao('Dê um título', 'warning');
            form.elements.titulo.focus();
            return;
        }
        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            const dados = await lerFormulario(form, tipo, anotacao);
            await salvarAnotacao(anotacao?.id, anotacao ? dados : { tipo, ...dados });
            mostrarNotificacao(anotacao ? 'Salvo!' : 'Adicionado!', 'success');
            fechar();
            aoSalvar?.(tipo);
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Apagar "${anotacao.titulo}"? Não dá para desfazer.`, { titulo: 'Apagar', confirmarTexto: 'Apagar' }))) return;
        try {
            await excluirAnotacao(anotacao.id);
            fechar();
            mostrarNotificacao('Apagado', 'success');
            aoSalvar?.(tipo);
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao apagar', 'error');
        }
    });
}
