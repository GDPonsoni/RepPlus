import { api } from '../../core/api.js';
import { categoria } from '../../core/categorias.js';
import { cofreDestrancado, decifrar, provaDoCofre } from './cofre.js';

export const TIPOS = {
    conta: { nome: 'Senhas e contas', novo: 'Nova conta', icone: 'fa-solid fa-key' },
    contato: { nome: 'Contatos', novo: 'Novo contato', icone: 'fa-solid fa-address-book' },
    nota: { nome: 'Notas', novo: 'Nova nota', icone: 'fa-solid fa-note-sticky' }
};

// Categorias gerenciáveis (Ajustes > Categorias): tipos de conta e serviços dos contatos. Notas não têm.
export const ESCOPO_POR_TIPO = { conta: 'anotacoes-contas', contato: 'anotacoes-contatos' };

export const categoriaDaAnotacao = (anotacao) => categoria(ESCOPO_POR_TIPO[anotacao.tipo], anotacao.categoria);

export const estado = {
    anotacoes: [],
    carregado: false,
    // Segredos já decifrados (id -> objeto); some quando o cofre tranca
    segredos: new Map()
};

export const anotacoesDoTipo = (tipo) => estado.anotacoes.filter(anotacao => anotacao.tipo === tipo);
export const buscarAnotacao = (id) => estado.anotacoes.find(anotacao => String(anotacao.id) === String(id));

export const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Decifra (uma vez) os segredos das anotações informadas, se o cofre estiver aberto
export async function decifrarSegredos(anotacoes) {
    if (!cofreDestrancado()) return;
    await Promise.all(anotacoes
        .filter(anotacao => anotacao.segredo && !estado.segredos.has(anotacao.id))
        .map(async anotacao => {
            try {
                estado.segredos.set(anotacao.id, await decifrar(anotacao.segredo));
            } catch (error) {
                console.error('Segredo ilegível:', anotacao.id, error);
                estado.segredos.set(anotacao.id, { ilegivel: true });
            }
        }));
}

function substituir(anotacao) {
    const i = estado.anotacoes.findIndex(atual => String(atual.id) === String(anotacao.id));
    if (i >= 0) estado.anotacoes[i] = anotacao;
    else estado.anotacoes.push(anotacao);
    estado.segredos.delete(anotacao.id);
    return anotacao;
}

// ===== API =====
export async function carregarAnotacoes() {
    estado.anotacoes = await api('/anotacoes');
    estado.carregado = true;
    return estado.anotacoes;
}

// Quem grava um segredo manda junto a prova de que destrancou o cofre
const comProva = (dados) => (dados.segredo !== undefined ? { ...dados, provaCofre: provaDoCofre() } : dados);

export async function salvarAnotacao(id, dados) {
    return substituir(id
        ? await api(`/anotacoes/${id}`, { metodo: 'PUT', corpo: comProva(dados) })
        : await api('/anotacoes', { metodo: 'POST', corpo: comProva(dados) }));
}

export async function excluirAnotacao(id) {
    await api(`/anotacoes/${id}`, { metodo: 'DELETE' });
    estado.anotacoes = estado.anotacoes.filter(anotacao => String(anotacao.id) !== String(id));
    estado.segredos.delete(id);
}
