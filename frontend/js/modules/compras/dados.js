import { api } from '../../core/api.js';
import { hoje, diaDoInstante, diasEntre } from '../../core/datas.js';
import { categoria, categoriasDe } from '../../core/categorias.js';
import { escaparHtml } from '../../core/ui.js';

// Categorias gerenciáveis em Ajustes > Categorias (escopo 'compras'); a ordem delas é a dos grupos na tela
export const categoriaDoItem = (item) => categoria('compras', item.categoria);

// Ícone da categoria na cor dela (a linha do item usa --cat para a cor do status)
export const iconeCategoria = (item) => {
    const c = categoriaDoItem(item);
    return `<i class="${c.icone} compra-cat-icone" style="--ccat: ${c.cor}" title="${escaparHtml(c.nome)}"></i>`;
};

// falta = acabou (comprar); acabando = avisado, ainda tem; ok = em casa (fica salvo no catálogo)
export const STATUS = {
    falta: { nome: 'Acabou', icone: 'fa-solid fa-circle-exclamation' },
    acabando: { nome: 'Acabando', icone: 'fa-solid fa-hourglass-half' },
    ok: { nome: 'Em casa', icone: 'fa-solid fa-check' }
};

// Compras das últimas horas aparecem em "Comprados agora há pouco" (para desfazer um toque errado)
const HORAS_RECENTES = 24;

export const estado = {
    itens: [],
    carregado: false,
    // Estado de antes do "comprei", por id, para o desfazer
    antesDaCompra: new Map()
};

// Categoria desconhecida vai para o fim
const ordemCategoria = (item) => {
    const i = categoriasDe('compras').findIndex(c => c.chave === item.categoria);
    return i < 0 ? Infinity : i;
};
const porCategoriaENome = (a, b) => (ordemCategoria(a) - ordemCategoria(b)) || a.nome.localeCompare(b.nome, 'pt-BR');

export const itensComStatus = (status) => estado.itens.filter(item => item.status === status).sort(porCategoriaENome);

export function compradosRecentes() {
    const limite = Date.now() - HORAS_RECENTES * 3600000;
    return estado.itens
        .filter(item => item.status === 'ok' && item.compradoEm && new Date(item.compradoEm).getTime() >= limite)
        .sort((a, b) => new Date(b.compradoEm) - new Date(a.compradoEm));
}

// Sugestões para adicionar rápido: itens em casa que a casa mais compra (e há mais tempo)
export function sugestoes(limite = 8) {
    return estado.itens
        .filter(item => item.status === 'ok')
        .sort((a, b) => (b.vezesComprado - a.vezesComprado) || (new Date(a.compradoEm || 0) - new Date(b.compradoEm || 0)))
        .slice(0, limite);
}

export const buscarItem = (id) => estado.itens.find(item => String(item.id) === String(id));

// "hoje", "ontem", "há 3 dias"
export function haQuantoTempo(iso) {
    if (!iso) return '';
    const dias = diasEntre(diaDoInstante(iso), hoje());
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    return `há ${dias} dias`;
}

function substituir(item) {
    const { reaproveitado, jaEstavaNaLista, ...limpo } = item;
    const i = estado.itens.findIndex(atual => String(atual.id) === String(limpo.id));
    if (i >= 0) estado.itens[i] = limpo;
    else estado.itens.push(limpo);
    return { item: limpo, reaproveitado, jaEstavaNaLista };
}

// ===== API =====
export async function carregarItens() {
    estado.itens = await api('/compras/itens');
    estado.carregado = true;
    return estado.itens;
}

// Adiciona pelo nome; se já existir um item com esse nome, a API o reaproveita
export async function adicionarItem(dados) {
    return substituir(await api('/compras/itens', { metodo: 'POST', corpo: dados }));
}

export async function atualizarItem(id, dados) {
    return substituir(await api(`/compras/itens/${id}`, { metodo: 'PUT', corpo: dados })).item;
}

export async function comprarItem(id) {
    const antes = buscarItem(id);
    const { item } = substituir(await api(`/compras/itens/${id}/comprar`, { metodo: 'POST' }));
    estado.antesDaCompra.set(String(id), {
        status: antes.status, compradoEm: antes.compradoEm, pedidoEm: antes.pedidoEm,
        pedidoPor: antes.pedidoPor, quantidade: antes.quantidade
    });
    return item;
}

// Desfaz o "comprei": volta exatamente como estava (se foi nesta sessão) ou põe na lista de novo
export async function desfazerCompra(id) {
    const anterior = estado.antesDaCompra.get(String(id));
    if (!anterior) return adicionarItem({ nome: buscarItem(id).nome, status: 'falta' }).then(r => r.item);
    const { item } = substituir(await api(`/compras/itens/${id}/desfazer-compra`, { metodo: 'POST', corpo: { anterior } }));
    estado.antesDaCompra.delete(String(id));
    return item;
}

export async function excluirItem(id) {
    await api(`/compras/itens/${id}`, { metodo: 'DELETE' });
    estado.itens = estado.itens.filter(item => String(item.id) !== String(id));
}
