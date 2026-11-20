import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { temPermissao } from '../../core/sessao.js';
import { iconeCategoria, carregarItens, itensComStatus, adicionarItem, comprarItem } from './dados.js';
import { animarSaida, comemorar, vibrar } from '../../core/movimento.js';

const MAXIMO = 8;

// Uma linha da lista, no mesmo visual da aba Lista (círculo = "comprei")
function htmlLinha(item, podeEditar) {
    const detalhes = [item.quantidade && `<strong>${escaparHtml(item.quantidade)}</strong>`, item.observacao && escaparHtml(item.observacao)].filter(Boolean);
    return `
        <div class="compra-item cstatus-${item.status}">
            ${podeEditar
                ? `<button type="button" class="compra-check" data-comprar="${escaparHtml(item.id)}" aria-label="Comprei ${escaparHtml(item.nome)}"><i class="fa-solid fa-check"></i></button>`
                : '<span class="compra-check"></span>'}
            <span class="compra-info">
                <span class="compra-nome">${iconeCategoria(item)} ${escaparHtml(item.nome)}</span>
                ${detalhes.length ? `<span class="compra-meta">${detalhes.join(' · ')}</span>` : ''}
            </span>
            ${item.status === 'acabando' ? '<span class="compra-status-tag cstatus-acabando"><i class="fa-solid fa-hourglass-half"></i> Acabando</span>' : ''}
        </div>
    `;
}

// Resumo no Início: a lista do que comprar (acabou primeiro, depois acabando), com um campo
// para avisar que algo acabou e o círculo para marcar como comprado
export default {
    titulo: 'Lista de compras',
    rota: 'compras/lista',
    permissao: 'compras:ver',

    async conteudo() {
        await carregarItens();
        const podeEditar = temPermissao('compras:editar');
        const itens = [...itensComStatus('falta'), ...itensComStatus('acabando')];
        const extras = itens.length - MAXIMO;

        return `
            ${itens.length ? `
                <div class="inicio-compras">${itens.slice(0, MAXIMO).map(item => htmlLinha(item, podeEditar)).join('')}</div>
                ${extras > 0 ? `<button type="button" class="inicio-link inicio-mais" data-acao="ir-para" data-rota="compras/lista">+ ${extras} ${extras === 1 ? 'item' : 'itens'} na lista</button>` : ''}
            ` : '<p class="inicio-vazio">Nada para comprar 🎉</p>'}
            ${podeEditar ? `
                <form class="inicio-form-rapido" autocomplete="off">
                    <input type="text" name="nome" maxlength="60" placeholder="Acabou alguma coisa?" aria-label="Item que acabou" enterkeyhint="done">
                    <button type="submit" class="btn btn-primary" aria-label="Adicionar à lista"><i class="fa-solid fa-plus"></i></button>
                </form>
            ` : ''}
        `;
    },

    aoMontar(elemento, atualizar) {
        elemento.querySelector('.inicio-form-rapido')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = e.target.elements.nome.value.trim();
            if (!nome) return;
            try {
                const { item, jaEstavaNaLista } = await adicionarItem({ nome, status: 'falta' });
                mostrarNotificacao(jaEstavaNaLista ? `${item.nome} já estava na lista` : `${item.nome} na lista!`, 'success');
                atualizar();
            } catch (error) {
                console.error('Erro:', error);
                mostrarNotificacao(error.message || 'Erro ao adicionar', 'error');
            }
        });

        // Comprei: some da lista (dá para desfazer na aba Lista, em "Comprados agora há pouco").
        // O ouvinte fica na lista, que é recriada a cada atualização (não acumula)
        elemento.querySelector('.inicio-compras')?.addEventListener('click', async (e) => {
            const botao = e.target.closest('[data-comprar]');
            if (!botao) return;
            botao.disabled = true;
            vibrar(12);
            try {
                await animarSaida(botao.closest('.compra-item'), 'saindo-comprado', 380);
                const item = await comprarItem(botao.dataset.comprar);
                if (!itensComStatus('falta').length && !itensComStatus('acabando').length) {
                    comemorar(botao);
                    mostrarNotificacao('Lista zerada! Valeu pela compra 🎉', 'success', 2600);
                } else {
                    mostrarNotificacao(`${item.nome} comprado ✔`, 'success', 1800);
                }
                atualizar();
            } catch (error) {
                console.error('Erro:', error);
                mostrarNotificacao(error.message || 'Erro ao marcar como comprado', 'error');
                botao.closest('.compra-item')?.classList.remove('saindo-comprado');
                botao.disabled = false;
            }
        });
    }
};
