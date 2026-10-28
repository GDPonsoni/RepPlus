import { api } from '../../core/api.js';
import { aplicarPermissoes } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { estado } from './estado.js';
import { carregarMotivacoes, renderizarMotivacaoDestaque } from './motivacao.js';

// Aba "Atual": escala da semana e geração de uma nova escala

export async function carregarEscalaAtual() {
    try {
        const escalas = await api('/escala/atual');

        if (escalas.length === 0) {
            estado.escalaAtual = [];
            document.getElementById('escala-container').innerHTML =
                '<div class="card"><p class="empty-state">Nenhuma escala gerada. Toque em "Gerar Nova Escala" para começar!</p></div>';
            atualizarInfoSemana(null);
            renderizarCriticasEscala([]);
            return;
        }

        renderizarEscalaTabela(escalas);
        renderizarCriticasEscala([]);
    } catch (error) {
        console.error('Erro:', error);
    }
}

function atualizarInfoSemana(primeira) {
    const titulo = document.getElementById('semana-titulo');
    const datas = document.getElementById('semana-datas');

    if (!primeira) {
        titulo.textContent = 'Nenhuma escala gerada ainda';
        datas.textContent = '';
        return;
    }

    const dataInicio = new Date(primeira.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dataFim = new Date(primeira.dataFim).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    titulo.textContent = `Semana ${primeira.semana} de ${primeira.ano}`;
    datas.textContent = `${dataInicio} a ${dataFim}`;
}

// `anterior` (opcional): escala de antes de gerar, para destacar quem mudou de tarefa
function renderizarEscalaTabela(escalas, anterior = null) {
    estado.escalaAtual = escalas;
    const tarefaAnterior = new Map((anterior || []).map(e => [String(e.integranteId), (e.comodos || []).join('|')]));
    const container = document.getElementById('escala-container');
    container.innerHTML = '';
    const resumoInfracoes = estado.infracoes || {};
    const totalFolgas = escalas.filter(escala => Array.isArray(escala.comodos) && escala.comodos.includes('FOLGA')).length;
    const totalXs = Object.values(resumoInfracoes).reduce((sum, dados) => sum + (dados?.total || 0), 0);
    const destaqueMotivacao = estado.motivacaoDestaque || estado.motivacoes[0]?.path || null;

    atualizarInfoSemana(escalas[0]);

    // Guardado no estado para que renderizarMotivacaoDestaque() redesenhe os chips sobre a imagem
    estado.statsEscala = `
        <span class="stat-chip highlight"><i class="fa-solid fa-users"></i> ${escalas.length} pessoas</span>
        <span class="stat-chip"><i class="fa-solid fa-mug-hot"></i> ${totalFolgas} folga${totalFolgas === 1 ? '' : 's'}</span>
        <span class="stat-chip" title="Total acumulado no histórico, não apenas desta semana"><i class="fa-solid fa-xmark"></i> ${totalXs} acumulado${totalXs === 1 ? '' : 's'}</span>
    `;

    const cards = escalas.map(escala => {
        const isFolga = Array.isArray(escala.comodos) && escala.comodos.includes('FOLGA');
        const totalInfracoes = resumoInfracoes[escala.integranteId]?.total || 0;
        const tarefas = Array.isArray(escala.comodos) ? escala.comodos.filter(item => item !== 'FOLGA') : [];

        const mudou = anterior !== null && tarefaAnterior.get(String(escala.integranteId)) !== (escala.comodos || []).join('|');

        const rotulo = isFolga
            ? '<i class="fa-solid fa-mug-hot"></i> Folga'
            : escaparHtml(tarefas.length > 0 ? tarefas.join(' + ') : 'Nenhum cômodo');

        return `
            <article class="escala-card ${isFolga ? 'folga' : ''} ${!isFolga && totalInfracoes > 0 ? 'com-x' : ''} ${anterior !== null ? 'recem-gerado' : ''} ${mudou ? 'mudou' : ''}">
                <div class="escala-card-info">
                    <span class="escala-card-name">
                        ${escaparHtml(escala.integranteNome)}
                        ${totalInfracoes > 0 ? `<span class="escala-card-badge" title="${totalInfracoes} infração(ões) acumulada(s)">${totalInfracoes}X</span>` : ''}
                        ${mudou ? '<span class="escala-card-novo">novo</span>' : ''}
                    </span>
                    <span class="escala-card-comodo ${isFolga ? 'is-folga' : ''}">${rotulo}</span>
                </div>
                ${!isFolga ? `<button class="escala-card-x-btn" title="Marcar X" aria-label="Marcar infração para ${escaparHtml(escala.integranteNome)}" data-acao="marcar-x" data-id="${escaparHtml(escala.integranteId)}" data-permissao="infracoes:registrar"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </article>
        `;
    }).join('');

    container.innerHTML = `
        <div class="escala-dashboard">
            <div id="motivacao-destaque-container" class="motivacao-destaque-container"></div>
            <div class="escala-cards-grid">
                ${cards}
            </div>
        </div>
    `;

    aplicarPermissoes(container);
    renderizarMotivacaoDestaque(destaqueMotivacao);
    carregarMotivacoes();
}

function renderizarCriticasEscala(criticas, tipo = 'warning') {
    const container = document.getElementById('criticas-escala-container');
    if (!container) return;

    if (!criticas || criticas.length === 0) {
        container.innerHTML = '';
        return;
    }

    const itens = criticas.map(critica => `<li>${escaparHtml(critica)}</li>`).join('');
    container.innerHTML = `
        <div class="criticas-box ${tipo}">
            <h3>⚠️ Críticas da geração</h3>
            <ul>${itens}</ul>
        </div>
    `;
}

export async function gerarNovaEscala() {
    if (obterIntegrantes().length === 0 || estado.comodos.length === 0) {
        mostrarNotificacao('Configure integrantes e cômodos primeiro!', 'warning');
        return;
    }

    const confirmar = await mostrarConfirmacao(
        'O rodízio é calculado pelo histórico das semanas anteriores (não é sorteio). Se integrantes e cômodos não mudaram, o resultado desta semana será o mesmo.',
        { titulo: 'Gerar escala desta semana?', confirmarTexto: 'Gerar' }
    );
    if (!confirmar) return;

    const botao = document.getElementById('btn-gerar-escala');
    definirCarregando(botao, true, '⏳ Gerando...');

    try {
        let resultado;
        try {
            resultado = await api('/escala/gerar', { metodo: 'POST' });
        } catch (erro) {
            const dados = erro.dados || {};
            const criticas = Array.isArray(dados.criticas) ? dados.criticas : (dados.error ? [dados.error] : ['Erro ao gerar escala']);
            renderizarCriticasEscala(criticas, 'error');
            throw erro;
        }

        const { escala: novaEscala, alerta } = resultado;
        const anterior = estado.escalaAtual;

        if (resultado.motivacaoDestaque !== undefined) {
            estado.motivacaoDestaque = resultado.motivacaoDestaque;
        }
        renderizarEscalaTabela(novaEscala, anterior);
        const criticas = Array.isArray(resultado.criticas) ? resultado.criticas : [];
        renderizarCriticasEscala(criticas, 'warning');

        const mudancas = document.querySelectorAll('#escala-container .escala-card.mudou').length;
        // `alerta` é informativo (quantas folgas e por quê); vai junto da mensagem principal
        const detalhe = alerta ? ` ${alerta}` : '';

        if (criticas.length > 0) {
            mostrarNotificacao('Escala gerada com críticas de configuração', 'warning');
        } else if (anterior.length > 0 && mudancas === 0) {
            mostrarNotificacao(`Escala refeita: a distribuição continua a mesma, pois nada mudou no histórico, integrantes ou cômodos.${detalhe}`, 'info', 6000);
        } else if (anterior.length > 0) {
            mostrarNotificacao(`Escala gerada! ${mudancas === 1 ? '1 pessoa mudou' : `${mudancas} pessoas mudaram`} de tarefa (marcadas como "novo").${detalhe}`, 'success', 6000);
        } else {
            mostrarNotificacao(`Escala gerada com sucesso!${detalhe}`, 'success', 6000);
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao gerar escala', 'error');
    } finally {
        definirCarregando(botao, false);
    }
}
