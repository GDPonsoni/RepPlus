import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { obterConfig } from '../../core/aparencia.js';
import { estado } from './estado.js';
import { HTML_ABA_ESCALA, HTML_ABA_HISTORICO, HTML_ABA_INFRACOES, HTML_SECAO_COMODOS, HTML_SECAO_GALERIA } from './views.js';
import { carregarEscalaAtual, gerarNovaEscala, alternarLimpeza } from './atual.js';
import { carregarHistorico, deletarHistoricoSemana } from './historico.js';
import { carregarInfracoes, registrarInfracao, marcarInfracaoRapido, deletarInfracao, atualizarSelectInfracao } from './infracoes.js';
import { carregarComodos, adicionarOuEditarComodo, editarComodo, cancelarEdicaoComodo, deletarComodo, uploadImagemComodo, removerImagemComodo } from './comodos.js';
import { uploadMotivacao, mostrarNomeArquivoMotivacao, definirMotivacaoDestaque, excluirMotivacao } from './motivacao.js';
import inicio from './inicio.js';
import avisos from './avisos.js';

// Módulo: escala de limpeza
export default {
    id: 'escala',
    nome: 'Escala de Limpeza',
    nomeCurto: 'Escala',
    descricao: 'Rodízio semanal e infrações',
    icone: 'fa-solid fa-broom',
    cor: 'icon-red',
    inicio,
    avisos,
    abas: [
        { id: 'atual', titulo: 'Atual', icone: 'fa-regular fa-clipboard', html: HTML_ABA_ESCALA, permissao: 'escala:ver', aoAbrir: carregarEscalaAtual },
        { id: 'historico', titulo: 'Histórico', icone: 'fa-solid fa-clock-rotate-left', html: HTML_ABA_HISTORICO, permissao: 'escala:ver', aoAbrir: carregarHistorico },
        { id: 'infracoes', titulo: 'Infrações', icone: 'fa-solid fa-triangle-exclamation', html: HTML_ABA_INFRACOES, permissao: 'infracoes:ver', aoAbrir: carregarInfracoes },
        {
            id: 'ajustes', titulo: 'Ajustes', tituloPagina: 'Ajustes da Escala', icone: 'fa-solid fa-sliders',
            secoes: [
                { id: 'acc-comodos', titulo: 'Cômodos e Tarefas', icone: 'fa-solid fa-broom', cor: 'icon-green', html: HTML_SECAO_COMODOS },
                { id: 'acc-imagens', titulo: 'Galeria de Imagens', icone: 'fa-regular fa-image', cor: 'icon-purple', html: HTML_SECAO_GALERIA, permissao: 'motivacao:gerenciar' }
            ]
        }
    ],

    async iniciar() {
        estado.motivacaoDestaque = obterConfig().motivacaoDestaque || null;

        document.getElementById('btn-gerar-escala').addEventListener('click', gerarNovaEscala);
        document.getElementById('form-infracao').addEventListener('submit', registrarInfracao);
        document.getElementById('form-comodo').addEventListener('submit', adicionarOuEditarComodo);
        document.getElementById('btn-comodo-cancel').addEventListener('click', cancelarEdicaoComodo);
        document.getElementById('comodo-imagem').addEventListener('change', uploadImagemComodo);
        document.getElementById('btn-comodo-imagem-remover').addEventListener('click', removerImagemComodo);
        document.getElementById('form-motivacao').addEventListener('submit', uploadMotivacao);
        document.getElementById('motivacao-imagem').addEventListener('change', mostrarNomeArquivoMotivacao);

        registrarAcoes({
            'marcar-limpeza': ({ id }) => alternarLimpeza(id),
            'marcar-x': ({ id }) => marcarInfracaoRapido(id),
            'excluir-semana': ({ ano, semana }) => deletarHistoricoSemana(Number(ano), Number(semana)),
            'remover-infracao': ({ id }) => deletarInfracao(id),
            'editar-comodo': ({ id }) => editarComodo(id),
            'remover-comodo': ({ id }) => deletarComodo(id),
            'destacar-motivacao': ({ path }) => definirMotivacaoDestaque(path),
            'excluir-motivacao': ({ filename }) => excluirMotivacao(filename)
        });

        // O select do formulário de infração acompanha a lista de moradores
        ouvir('moradores:atualizados', atualizarSelectInfracao);
        atualizarSelectInfracao();

        // Infrações antes da escala, para os contadores de X já aparecerem nos cards
        await Promise.all([carregarComodos(), carregarInfracoes()]);
    }
};
