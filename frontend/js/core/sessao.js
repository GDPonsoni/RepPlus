import { api } from './api.js';

// Sessão atual: quem está usando, quais permissões tem e quais módulos estão ativos.
// No modo aberto todos são admin (permissão '*'); no modo senha, a rota responde 401 até a
// pessoa entrar com a senha da casa, e aí carregarSessao() devolve null (veja main.js).
let sessao = { modo: 'aberto', autenticado: false, usuario: null, permissoes: [], modulos: [] };

export async function carregarSessao() {
    try {
        sessao = await api('/sessao', { cache: 'no-store' });
    } catch (error) {
        if (error.status === 401) return null;
        console.error('Erro ao carregar sessão:', error);
        // Esconder botões é só conveniência visual: quem barra de verdade é o backend.
        // Sem resposta, mostra tudo e deixa o backend recusar o que não for permitido.
        sessao = { ...sessao, permissoes: ['*'], modulos: null };
    }
    return sessao;
}

export function obterSessao() {
    return sessao;
}

export function temPermissao(chave) {
    return sessao.permissoes.includes('*') || sessao.permissoes.includes(chave);
}

// Módulo ativo no backend? (sem a lista, considera todos ativos)
export function moduloAtivo(id) {
    return !Array.isArray(sessao.modulos) || sessao.modulos.some(modulo => modulo.id === id);
}

// Esconde os elementos marcados com data-permissao="..." que o usuário não pode usar.
// Chame depois de renderizar HTML dinâmico que tenha botões com permissão.
export function aplicarPermissoes(raiz = document) {
    raiz.querySelectorAll('[data-permissao]').forEach(elemento => {
        elemento.hidden = !temPermissao(elemento.dataset.permissao);
    });
}
