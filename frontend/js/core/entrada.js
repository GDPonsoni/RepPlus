import { api } from './api.js';

// Tela de entrada com a senha da casa (backend em AUTH_MODO=senha). Aparece quando a API
// responde 401: no lugar do app inteiro, sem carregar nenhum dado da república.
// Depois de entrar, recarrega a página para montar o app já com a sessão.
export function mostrarEntrada() {
    if (document.getElementById('entrada')) return;
    const logo = document.getElementById('logo-top')?.getAttribute('src') || '';

    document.body.innerHTML = `
        <main class="entrada" id="entrada">
            <form class="card card-padded entrada-cartao" id="entrada-form" novalidate>
                <img class="entrada-logo" src="${logo}" alt="">
                <h1 class="entrada-titulo">RepPlus</h1>
                <p class="entrada-texto">Digite a senha da casa para entrar.</p>
                <div class="form-stack">
                    <label class="field">Senha da casa
                        <input type="password" name="senha" autocomplete="current-password" required autofocus>
                    </label>
                    <p class="entrada-erro" id="entrada-erro" role="alert"></p>
                    <button type="submit" class="btn btn-primary btn-lg"><i class="fa-solid fa-right-to-bracket"></i> Entrar</button>
                </div>
            </form>
        </main>
    `;

    const form = document.getElementById('entrada-form');
    const erro = document.getElementById('entrada-erro');
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const senha = form.senha.value;
        if (!senha) {
            erro.textContent = 'Digite a senha.';
            return;
        }
        const botao = form.querySelector('button');
        botao.disabled = true;
        erro.textContent = '';
        try {
            await api('/auth/entrar', { metodo: 'POST', corpo: { senha } });
            location.reload();
        } catch (falha) {
            erro.textContent = falha.message || 'Não foi possível entrar. Tente de novo.';
            form.senha.select();
            botao.disabled = false;
        }
    });
}

export async function sair() {
    await api('/auth/sair', { metodo: 'POST' }).catch(() => {});
    location.reload();
}
