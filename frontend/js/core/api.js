import { emitir } from './eventos.js';

// API Base URL — usa o próprio host (o mesmo servidor entrega o site e a API, localmente e em produção)
export const API_URL = `${window.location.origin}/api`;

// Token de login (ponte para a autenticação futura): quando existir login, a tela de entrada
// chama definirToken() e todas as requisições passam a enviar "Authorization: Bearer <token>".
let token = null;

export function definirToken(novoToken) {
    token = novoToken || null;
}

// Cliente único da API: monta a requisição, converte a resposta e transforma erro HTTP em exceção.
// Uso: api('/integrantes'), api('/integrantes', { metodo: 'POST', corpo: {...} }),
//      api('/config/logo', { metodo: 'POST', formData })
// Em erro, lança Error com a mensagem do backend (vazia se não houver), `status` e `dados` da resposta.
export async function api(caminho, { metodo = 'GET', corpo, formData, cache } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const opcoes = { method: metodo, headers };
    if (cache) opcoes.cache = cache;
    if (formData) {
        opcoes.body = formData;
    } else if (corpo !== undefined) {
        headers['Content-Type'] = 'application/json';
        opcoes.body = JSON.stringify(corpo);
    }

    const resposta = await fetch(`${API_URL}${caminho}`, opcoes);
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        const erro = new Error(dados.error || '');
        erro.status = resposta.status;
        erro.dados = dados;
        if (resposta.status === 401) emitir('sessao:expirada');
        throw erro;
    }
    return dados;
}
