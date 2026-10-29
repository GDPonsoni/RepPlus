import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarNotificacao } from '../../core/ui.js';
import { estado, carregarAtas, marcarTarefa } from './dados.js';
import { HTML_ABA_ATAS, HTML_ABA_PENDENCIAS, renderizarTudo, renderizarLista, renderizarPendencias, htmlTarefa } from './telas.js';
import { abrirAta, abrirFormularioAta } from './formulario.js';
import inicio from './inicio.js';
import avisos from './avisos.js';

async function recarregar() {
    try {
        await carregarAtas();
        renderizarTudo();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar as atas', 'error');
    }
}

// Marcar encaminhamento: atualiza as listas e, se a ata estiver aberta no painel, o item dentro dela
async function alternarTarefa({ ata: ataId, tarefa: tarefaId, feito }, botao) {
    try {
        const ata = await marcarTarefa(ataId, tarefaId, Boolean(feito));
        const tarefa = ata.tarefas.find(t => t.id === tarefaId);
        const noPainel = botao.closest('.painel-ata .tarefa-item');
        if (noPainel) {
            noPainel.outerHTML = htmlTarefa(tarefa, ata);
            aplicarPermissoes(document.querySelector('.painel-ata'));
        }
        renderizarTudo();
        mostrarNotificacao(tarefa.feito ? 'Feito! ✔' : 'Voltou para pendente', tarefa.feito ? 'success' : 'info', 1500);
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao atualizar', 'error');
    }
}

// Módulo: atas de reunião (o que foi discutido, decidido e quem ficou de fazer o quê)
export default {
    id: 'atas',
    nome: 'Atas de Reunião',
    nomeCurto: 'Atas',
    descricao: 'O que foi discutido e decidido',
    icone: 'fa-solid fa-file-signature',
    cor: 'icon-teal',
    inicio,
    avisos,
    abas: [
        { id: 'lista', titulo: 'Atas', icone: 'fa-solid fa-file-lines', html: HTML_ABA_ATAS, permissao: 'atas:ver', aoAbrir: recarregar },
        { id: 'pendencias', titulo: 'Pendências', icone: 'fa-solid fa-list-check', html: HTML_ABA_PENDENCIAS, permissao: 'atas:ver', aoAbrir: recarregar }
    ],

    iniciar() {
        document.getElementById('atas-busca')?.addEventListener('input', renderizarLista);
        document.getElementById('pendencias-filtro')?.addEventListener('change', (e) => {
            estado.filtroResponsavel = e.target.value;
            renderizarPendencias();
        });

        registrarAcoes({
            'nova-ata': () => abrirFormularioAta({ aoMudar: renderizarTudo }),
            'abrir-ata': ({ id }) => abrirAta(id, { aoMudar: renderizarTudo }),
            'ata-de-evento': ({ id, dia }) => {
                const evento = estado.reunioesSemAta.find(e => String(e.id) === String(id) && e.dia === dia);
                if (evento) abrirFormularioAta({ evento, aoMudar: renderizarTudo });
            },
            'marcar-tarefa': alternarTarefa
        });

        // Nomes de participantes e responsáveis vêm do cadastro
        ouvir('moradores:atualizados', renderizarTudo);
    }
};
