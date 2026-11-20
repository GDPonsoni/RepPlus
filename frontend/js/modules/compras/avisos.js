import { api } from '../../core/api.js';

// Aviso do sino: o que acabou (um aviso novo sempre que a lista muda)
export default async function avisos() {
    const faltando = (await api('/compras/itens')).filter(item => item.status === 'falta')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!faltando.length) return [];
    const nomes = faltando.slice(0, 3).map(item => item.nome).join(', ') + (faltando.length > 3 ? ` e mais ${faltando.length - 3}` : '');
    return [{
        id: `compras:falta:${faltando.map(item => item.id).join(',')}`,
        icone: 'fa-solid fa-cart-shopping',
        texto: `${faltando.length === 1 ? 'Acabou' : 'Acabaram'}: ${nomes}`,
        rota: 'compras/lista'
    }];
}
