import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { navegar } from '../../core/shell.js';
import { mostrarNotificacao } from '../../core/ui.js';
import { hoje } from '../../core/datas.js';
import { carregarCategorias } from '../../core/categorias.js';
import { estado, ESCOPO, somarMeses, limparFiltros, carregarMes, carregarDivisoes, carregarAjustes, carregarContas } from './dados.js';
import { HTML_ABA_VISAO, renderizarVisao } from './visao.js';
import { HTML_ABA_LANCAMENTOS, renderizarLancamentos, abrirLancamento } from './lancamentos.js';
import { HTML_ABA_CONTAS, renderizarContas, abrirConta, ajustarSaldo, abrirConectar, sincronizar, desconectar } from './contas.js';
import { HTML_ABA_DIVISOES, renderizarDivisoes, abrirDivisao, marcarParte, acertar } from './divisoes.js';
import { SECOES_AJUSTES, renderizarAjustes, filtrarRegras, regrasSugeridas, salvarOrcamento } from './ajustes.js';
import { abrirEditorRegra, excluirRegra } from './regras.js';
import inicio from './inicio.js';
import avisos from './avisos.js';

// Cada aba sabe carregar e desenhar a si mesma; depois de qualquer mudança, recarrega a aba aberta
const ABAS = {
    visao: async () => { if (await carregarMes()) renderizarVisao(); },
    lancamentos: async () => { if (await carregarMes()) renderizarLancamentos(); },
    contas: async () => { await carregarContas(); renderizarContas(); },
    divisoes: async () => { await carregarDivisoes(); renderizarDivisoes(); },
    ajustes: async () => { await carregarAjustes(); renderizarAjustes(); }
};
let abaAtual = 'visao';

async function abrirAba(aba) {
    abaAtual = aba;
    try {
        await ABAS[aba]();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar as finanças', 'error');
    }
}

const recarregar = () => abrirAba(abaAtual);

// Executa uma ação que fala com a API e recarrega a aba (mensagens de erro padronizadas)
const executar = (acao) => async (dados, elemento) => {
    try {
        if (await acao(dados, elemento) !== false) await recarregar();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro', 'error');
    }
};

const dividir = (lancamento) => abrirDivisao({ lancamento, aoMudar: () => navegar('financas/divisoes') });

// Módulo: finanças da casa
export default {
    id: 'financas',
    nome: 'Finanças',
    descricao: 'Gastos, contas, reserva e divisões',
    icone: 'fa-solid fa-sack-dollar',
    cor: 'icon-blue',
    inicio,
    avisos,
    abas: [
        { id: 'visao', titulo: 'Visão geral', icone: 'fa-solid fa-chart-pie', html: HTML_ABA_VISAO, permissao: 'financas:ver', aoAbrir: () => abrirAba('visao') },
        { id: 'lancamentos', titulo: 'Lançamentos', icone: 'fa-solid fa-list', html: HTML_ABA_LANCAMENTOS, permissao: 'financas:ver', aoAbrir: () => abrirAba('lancamentos') },
        { id: 'contas', titulo: 'Contas', icone: 'fa-solid fa-building-columns', html: HTML_ABA_CONTAS, permissao: 'financas:ver', aoAbrir: () => abrirAba('contas') },
        { id: 'divisoes', titulo: 'Divisões', icone: 'fa-solid fa-people-arrows', html: HTML_ABA_DIVISOES, permissao: 'financas:ver', aoAbrir: () => abrirAba('divisoes') },
        { id: 'ajustes', titulo: 'Ajustes', icone: 'fa-solid fa-sliders', secoes: SECOES_AJUSTES, tituloPagina: 'Ajustes das Finanças', permissao: 'financas:ver', aoAbrir: () => abrirAba('ajustes') }
    ],

    async iniciar() {
        registrarAcoes({
            // Mês (Visão geral e Lançamentos)
            'fin-mes': ({ passo }) => { estado.mes = somarMeses(estado.mes, Number(passo)); recarregar(); },
            'fin-mes-atual': () => { estado.mes = hoje().slice(0, 7); recarregar(); },
            'fin-filtrar-categoria': ({ categoria }) => {
                limparFiltros({ categoria, tipo: 'gastos' });
                navegar('financas/lancamentos');
            },
            'fin-filtrar-dia': ({ dia }) => {
                const numero = String(Number(dia.slice(8)));
                limparFiltros({ diaDe: numero, diaAte: numero, tipo: 'gastos' });
                navegar('financas/lancamentos');
            },
            // Filtros dos lançamentos
            'fin-mais-filtros': (dados, botao) => {
                const painel = document.getElementById('fin-filtros-mais');
                painel.hidden = !painel.hidden;
                botao.setAttribute('aria-expanded', String(!painel.hidden));
            },
            'fin-limpar-filtro': ({ chave }) => {
                const campos = { dias: ['diaDe', 'diaAte'], valor: ['valorMin', 'valorMax'], ordem: [] }[chave] || [chave];
                campos.forEach(campo => { estado.filtros[campo] = ''; });
                if (chave === 'ordem') estado.filtros.ordem = 'recentes';
                renderizarLancamentos();
            },
            'fin-limpar-filtros': () => { limparFiltros(); renderizarLancamentos(); },
            'fin-filtrar-sem-categoria': () => { estado.filtros.categoria = 'sem'; renderizarLancamentos(); },
            // Lançamentos
            'fin-novo-lancamento': () => abrirLancamento({ aoMudar: recarregar }),
            'fin-abrir-lancamento': ({ id }) => abrirLancamento({ id, aoMudar: recarregar, aoDividir: dividir }),
            // Divisões
            'fin-nova-divisao': () => abrirDivisao({ aoMudar: recarregar }),
            'fin-abrir-divisao': ({ id }) => abrirDivisao({ id, aoMudar: recarregar }),
            'fin-marcar-parte': executar(marcarParte),
            'fin-acertar': executar(acertar),
            // Contas e bancos
            'fin-nova-conta': () => abrirConta({ aoMudar: recarregar }),
            'fin-editar-conta': ({ id }) => abrirConta({ id, aoMudar: recarregar }),
            'fin-ajustar-saldo': executar(ajustarSaldo),
            'fin-conectar': () => abrirConectar({ aoMudar: recarregar }),
            'fin-sincronizar': executar(sincronizar),
            'fin-desconectar': executar(desconectar),
            // Ajustes
            'fin-regras-sugeridas': executar(regrasSugeridas),
            'fin-nova-regra': ({ termo = '', sentido = '', categoria = '' }) => abrirEditorRegra({ termo, sentido, categoria, aoMudar: recarregar }),
            'fin-editar-regra': ({ id }) => {
                const regra = estado.regras.find(r => r.id === id);
                if (regra) abrirEditorRegra({ regra, aoMudar: recarregar });
            },
            'fin-excluir-regra': executar(excluirRegra)
        });

        // Filtros dos lançamentos: qualquer campo com data-filtro guarda o valor e redesenha a lista
        const aoFiltrar = (e) => {
            const chave = e.target.dataset?.filtro;
            if (!chave || estado.filtros[chave] === e.target.value) return;
            estado.filtros[chave] = e.target.value;
            renderizarLancamentos();
        };
        document.getElementById('fin-filtros')?.addEventListener('input', aoFiltrar);
        document.getElementById('fin-filtros')?.addEventListener('change', aoFiltrar);
        document.getElementById('fin-regras-busca')?.addEventListener('input', filtrarRegras);

        document.querySelector('[name="fin-divisoes-filtro"]')?.closest('.chips').addEventListener('change', renderizarDivisoes);
        document.getElementById('fin-orcamentos-campos')?.addEventListener('change', (e) => {
            if (e.target.dataset.categoria) executar(() => salvarOrcamento(e.target))();
        });

        // Categorias editadas (cores, nomes) e moradores (nomes nas divisões): redesenha a aba aberta
        ouvir('categorias:atualizadas', ({ escopo }) => {
            if (escopo === ESCOPO && document.querySelector('[id^="aba-financas-"].active')) recarregar();
        });
        ouvir('moradores:atualizados', () => {
            if (document.getElementById('aba-financas-divisoes')?.classList.contains('active')) renderizarDivisoes();
        });

        await carregarCategorias(ESCOPO);
    }
};
