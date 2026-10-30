import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { carregarCategorias } from '../../core/categorias.js';
import { estado, buscarEvento } from './dados.js';
import { HTML_ABA_MES, HTML_ABA_SEMANA, renderizarMes, renderizarSemana, selecionarDia, navegarPeriodo, irParaHoje, atualizarVisao } from './visualizacao.js';
import { abrirFormularioEvento } from './formulario.js';
import inicio from './inicio.js';
import avisos from './avisos.js';

// Depois de salvar: na visão mensal, seleciona o dia do evento salvo
function aposSalvar(dia) {
    if (dia && estado.visao === 'mes') {
        estado.diaSelecionado = dia;
        estado.mes = `${dia.slice(0, 7)}-01`;
    }
    atualizarVisao();
}

// Módulo: agenda conjunta da república
export default {
    id: 'agenda',
    nome: 'Agenda',
    descricao: 'Eventos, visitas e aniversários',
    icone: 'fa-solid fa-calendar-days',
    cor: 'icon-purple',
    inicio,
    avisos,
    abas: [
        { id: 'mes', titulo: 'Mês', icone: 'fa-regular fa-calendar', html: HTML_ABA_MES, permissao: 'agenda:ver', aoAbrir: () => { estado.visao = 'mes'; renderizarMes(); } },
        { id: 'semana', titulo: 'Semana', icone: 'fa-solid fa-list-ul', html: HTML_ABA_SEMANA, permissao: 'agenda:ver', aoAbrir: () => { estado.visao = 'semana'; renderizarSemana(); } }
    ],

    async iniciar() {
        registrarAcoes({
            'agenda-navegar': ({ passo }) => navegarPeriodo(Number(passo)),
            'agenda-hoje': irParaHoje,
            'agenda-selecionar-dia': ({ dia }) => selecionarDia(dia),
            'novo-evento': ({ dia }) => abrirFormularioEvento({ dia: dia || (estado.visao === 'mes' ? estado.diaSelecionado : undefined), aoSalvar: aposSalvar }),
            'abrir-evento': ({ id, ocorrencia }) => {
                const evento = buscarEvento(id, ocorrencia);
                if (evento) abrirFormularioEvento({ evento, aoSalvar: aposSalvar });
            }
        });

        // Aniversários vêm do cadastro: se ele mudar com a agenda aberta, redesenha
        ouvir('moradores:atualizados', () => {
            if (document.querySelector('[id^="aba-agenda-"].active')) atualizarVisao();
        });

        // Cores e ícones das categorias vêm do cadastro de categorias
        ouvir('categorias:atualizadas', ({ escopo }) => {
            if (escopo === 'agenda' && document.querySelector('[id^="aba-agenda-"].active')) atualizarVisao();
        });
        await carregarCategorias('agenda');
    }
};
