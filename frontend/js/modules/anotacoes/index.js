import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { carregarCategorias } from '../../core/categorias.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { mostrarNotificacao } from '../../core/ui.js';
import { cofreDisponivel, cofreExiste, cofreDestrancado, carregarCofre, trancarCofre, apagarCofre } from './cofre.js';
import { estado, carregarAnotacoes } from './dados.js';
import { HTML_ABA_SENHAS, HTML_ABA_CONTATOS, HTML_ABA_NOTAS, renderizarTudo, renderizarTipo } from './telas.js';
import { abrirFormularioAnotacao, abrirCriarCofre, pedirSenhaDoCofre, abrirTrocarSenha } from './formulario.js';
import inicio from './inicio.js';

const HTML_AJUSTES_COFRE = `
    <div id="cofre-status" class="form-stack"></div>
`;

function renderizarAjustesCofre() {
    const container = document.getElementById('cofre-status');
    if (!container) return;
    if (!cofreDisponivel()) {
        container.innerHTML = '<p class="cofre-explicacao">O cofre só funciona em conexão segura (https ou localhost).</p>';
        return;
    }
    container.innerHTML = cofreExiste()
        ? `
            <p class="cofre-explicacao"><i class="fa-solid fa-shield-halved"></i> Logins, senhas e notas secretas são criptografados no aparelho com a senha do cofre (AES-256). O servidor só guarda o texto embaralhado.</p>
            <p><strong>Situação neste aparelho:</strong> ${cofreDestrancado() ? '🔓 aberto' : '🔒 trancado'}</p>
            <div class="btn-row">
                ${cofreDestrancado() ? '<button type="button" class="btn btn-ghost" data-acao="trancar-cofre"><i class="fa-solid fa-lock"></i> Trancar</button>' : ''}
                <button type="button" class="btn btn-dark" data-acao="trocar-senha-cofre"><i class="fa-solid fa-key"></i> Trocar senha</button>
            </div>
            <hr class="divider">
            <p class="cofre-explicacao">Esqueceram a senha? Não há como recuperar. Dá para apagar o cofre e criar outro: <strong>todas as senhas guardadas são perdidas</strong> (títulos, sites e contatos ficam).</p>
            <button type="button" class="btn btn-ghost btn-perigo" data-acao="apagar-cofre"><i class="fa-solid fa-trash"></i> Apagar cofre e senhas</button>
        `
        : `
            <p class="cofre-explicacao">Ainda não há cofre. Crie um para guardar logins e senhas criptografados.</p>
            <button type="button" class="btn btn-primary" data-acao="criar-cofre"><i class="fa-solid fa-vault"></i> Criar cofre</button>
        `;
}

function atualizarTudo() {
    renderizarTudo();
    renderizarAjustesCofre();
}

async function recarregar() {
    try {
        await Promise.all([carregarAnotacoes(), carregarCofre()]);
        atualizarTudo();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar as anotações', 'error');
    }
}

async function copiarSegredo(dataset, botao) {
    const valor = botao.closest('.segredo-linha').querySelector('.segredo-valor').dataset.valor;
    try {
        await navigator.clipboard.writeText(valor);
        mostrarNotificacao(`${dataset.rotulo} copiado`, 'success', 1500);
    } catch {
        mostrarNotificacao('Não foi possível copiar', 'error');
    }
}

function mostrarSegredo(dataset, botao) {
    const campo = botao.closest('.segredo-linha').querySelector('.segredo-valor');
    const mascarado = campo.classList.toggle('mascarado');
    campo.textContent = mascarado ? '••••••••' : campo.dataset.valor;
    botao.querySelector('i').className = mascarado ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

async function confirmarApagarCofre() {
    const ok = await mostrarConfirmacao('Apagar o cofre? TODAS as senhas e notas secretas guardadas serão perdidas para sempre. Use só se ninguém lembra a senha.', { titulo: 'Apagar cofre', confirmarTexto: 'Apagar tudo' });
    if (!ok) return;
    try {
        const { segredosApagados } = await apagarCofre();
        await carregarAnotacoes();
        atualizarTudo();
        mostrarNotificacao(`Cofre apagado (${segredosApagados} segredo(s) perdidos)`, 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao apagar o cofre', 'error');
    }
}

// Módulo: anotações da casa (contas/senhas no cofre, contatos de prestadores, notas)
export default {
    id: 'anotacoes',
    nome: 'Anotações',
    descricao: 'Senhas, contatos de serviço e notas',
    icone: 'fa-solid fa-book-bookmark',
    cor: 'icon-orange',
    inicio,
    abas: [
        { id: 'senhas', titulo: 'Senhas', icone: 'fa-solid fa-key', html: HTML_ABA_SENHAS, permissao: 'anotacoes:ver', aoAbrir: recarregar },
        { id: 'contatos', titulo: 'Contatos', icone: 'fa-solid fa-address-book', html: HTML_ABA_CONTATOS, permissao: 'anotacoes:ver', aoAbrir: recarregar },
        { id: 'notas', titulo: 'Notas', icone: 'fa-solid fa-note-sticky', html: HTML_ABA_NOTAS, permissao: 'anotacoes:ver', aoAbrir: recarregar }
    ],
    secoesAjustes: [
        { id: 'acc-cofre', titulo: 'Cofre de Senhas', icone: 'fa-solid fa-vault', cor: 'icon-orange', html: HTML_AJUSTES_COFRE, permissao: 'anotacoes:cofre' }
    ],

    async iniciar() {
        document.querySelectorAll('.anotacoes-busca').forEach(campo => {
            campo.addEventListener('input', () => renderizarTipo(campo.dataset.busca));
        });

        registrarAcoes({
            'nova-anotacao': ({ tipo }) => abrirFormularioAnotacao({ tipo, aoSalvar: renderizarTipo }),
            'abrir-anotacao': ({ id }) => abrirFormularioAnotacao({ id, aoSalvar: renderizarTipo }),
            'destrancar-cofre': pedirSenhaDoCofre,
            'criar-cofre': abrirCriarCofre,
            'trancar-cofre': () => {
                trancarCofre();
                mostrarNotificacao('Cofre trancado', 'info', 1500);
            },
            'trocar-senha-cofre': abrirTrocarSenha,
            'apagar-cofre': confirmarApagarCofre,
            'copiar-segredo': copiarSegredo,
            'mostrar-segredo': mostrarSegredo
        });

        // Abriu/trancou o cofre: some ou aparece o que é sigiloso
        ouvir('categorias:atualizadas', ({ escopo }) => {
            if (escopo.startsWith('anotacoes-')) renderizarTudo();
        });
        await Promise.all(['anotacoes-contas', 'anotacoes-contatos'].map(escopo => carregarCategorias(escopo).catch(error => console.error(error))));

        ouvir('cofre:mudou', () => {
            if (!cofreDestrancado()) estado.segredos.clear();
            atualizarTudo();
        });

        // A seção de Ajustes precisa saber se o cofre existe
        try {
            await carregarCofre();
        } catch (error) {
            console.error('Erro ao carregar o cofre:', error);
        }
        renderizarAjustesCofre();
    }
};
