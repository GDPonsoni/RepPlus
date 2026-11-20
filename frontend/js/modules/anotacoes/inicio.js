import { api } from '../../core/api.js';
import { escaparHtml } from '../../core/ui.js';

// Resumo no Início: notas fixadas e atalhos para senhas e contatos (nada sigiloso aparece aqui)
export default {
    titulo: 'Anotações',
    rota: 'anotacoes/notas',
    permissao: 'anotacoes:ver',

    async conteudo() {
        const anotacoes = await api('/anotacoes');
        const contar = (tipo) => anotacoes.filter(a => a.tipo === tipo).length;
        const fixadas = anotacoes.filter(a => a.tipo === 'nota' && a.fixado)
            .sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm)).slice(0, 2);

        return `
            ${fixadas.map(nota => `
                <div class="inicio-nota">
                    <strong><i class="fa-solid fa-thumbtack"></i> ${escaparHtml(nota.titulo)}</strong>
                    ${nota.segredo ? '<span class="inicio-nota-texto"><i class="fa-solid fa-lock"></i> Nota secreta</span>'
                        : nota.dados.texto ? `<span class="inicio-nota-texto">${escaparHtml(nota.dados.texto)}</span>` : ''}
                </div>
            `).join('')}
            <div class="inicio-atalhos">
                <button type="button" class="btn btn-ghost btn-sm" data-acao="ir-para" data-rota="anotacoes/senhas"><i class="fa-solid fa-key"></i> Senhas <small>${contar('conta')}</small></button>
                <button type="button" class="btn btn-ghost btn-sm" data-acao="ir-para" data-rota="anotacoes/contatos"><i class="fa-solid fa-address-book"></i> Contatos <small>${contar('contato')}</small></button>
                <button type="button" class="btn btn-ghost btn-sm" data-acao="ir-para" data-rota="anotacoes/notas"><i class="fa-solid fa-note-sticky"></i> Notas <small>${contar('nota')}</small></button>
            </div>
        `;
    }
};
