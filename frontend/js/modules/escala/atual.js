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

const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const comecaDepois = (escala) => new Date(escala.dataInicio).getTime() > Date.now();

function atualizarInfoSemana(primeira) {
    const titulo = document.getElementById('semana-titulo');
    const datas = document.getElementById('semana-datas');
    // Adiar só faz sentido com uma escala em uso
    document.getElementById('btn-adiar-escala').hidden = !primeira;

    if (!primeira) {
        titulo.textContent = 'Nenhuma escala gerada ainda';
        datas.textContent = '';
        return;
    }

    titulo.textContent = `Semana ${primeira.semana} de ${primeira.ano}`;
    // Escala adiantada ou adiada: avisa que ela ainda não começou
    datas.textContent = `${dataCurta(primeira.dataInicio)} a ${dataCurta(primeira.dataFim)}${comecaDepois(primeira) ? ' · ainda não começou' : ''}`;
}

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

// X que a pessoa levou na semana desta escala (a infração guarda o início da semana em dataSemana)
export function xsNaSemana(escala, resumo = estado.infracoes) {
    const inicio = new Date(escala.dataInicio).getTime();
    return (resumo?.[escala.integranteId]?.infracoes || []).filter(inf => {
        const quando = new Date(inf.dataSemana || inf.dataRegistro).getTime();
        return quando >= inicio && quando < inicio + SEMANA_MS;
    });
}

// Situação do card: limpo, levou X (não fica mais "pendente") ou pendente com o progresso
function htmlStatus(tarefas, cumpridos, completo, xs) {
    if (completo) return '<span class="escala-card-status ok"><i class="fa-solid fa-check"></i> Concluído</span>';
    if (xs.length) {
        const motivo = xs[xs.length - 1].descricao;
        return `<span class="escala-card-status com-x" title="${escaparHtml(motivo)}"><i class="fa-solid fa-xmark"></i> Levou X: ${escaparHtml(motivo)}</span>`;
    }
    return `<span class="escala-card-status pendente"><i class="fa-regular fa-clock"></i> Pendente (${tarefas.filter(nome => cumpridos.includes(nome)).length}/${tarefas.length})</span>`;
}

// `anterior` (opcional): escala de antes de gerar, para destacar quem mudou de tarefa
function renderizarEscalaTabela(escalas, anterior = null) {
    estado.escalaAtual = escalas;
    const tarefaAnterior = new Map((anterior || []).map(e => [String(e.integranteId), (e.comodos || []).join('|')]));
    const container = document.getElementById('escala-container');
    container.innerHTML = '';
    const resumoInfracoes = estado.infracoes || {};
    const totalFolgas = escalas.filter(escala => Array.isArray(escala.comodos) && escala.comodos.includes('FOLGA')).length;
    const tarefasDe = (e) => (Array.isArray(e.comodos) ? e.comodos.filter(item => item !== 'FOLGA') : []);
    const totalTarefas = escalas.reduce((soma, e) => soma + tarefasDe(e).length, 0);
    const totalFeitas = escalas.reduce((soma, e) => soma + tarefasDe(e).filter(nome => (e.cumpridos || []).includes(nome)).length, 0);
    const totalXs = Object.values(resumoInfracoes).reduce((sum, dados) => sum + (dados?.total || 0), 0);
    const destaqueMotivacao = estado.motivacaoDestaque || estado.motivacoes[0]?.path || null;

    atualizarInfoSemana(escalas[0]);

    // Guardado no estado para que renderizarMotivacaoDestaque() redesenhe os chips sobre a imagem
    estado.statsEscala = `
        <span class="stat-chip highlight"><i class="fa-solid fa-users"></i> ${escalas.length} pessoas</span>
        <span class="stat-chip ${totalTarefas > 0 && totalFeitas === totalTarefas ? 'highlight' : ''}" title="Cômodos já limpos nesta semana"><i class="fa-solid fa-broom"></i> ${totalFeitas}/${totalTarefas} limpo${totalFeitas === 1 ? '' : 's'}</span>
        <span class="stat-chip"><i class="fa-solid fa-mug-hot"></i> ${totalFolgas} folga${totalFolgas === 1 ? '' : 's'}</span>
        <span class="stat-chip" title="Total acumulado no histórico, não apenas desta semana"><i class="fa-solid fa-xmark"></i> ${totalXs} acumulado${totalXs === 1 ? '' : 's'}</span>
    `;

    const cards = escalas.map(escala => {
        const isFolga = Array.isArray(escala.comodos) && escala.comodos.includes('FOLGA');
        const totalInfracoes = resumoInfracoes[escala.integranteId]?.total || 0;
        const tarefas = Array.isArray(escala.comodos) ? escala.comodos.filter(item => item !== 'FOLGA') : [];

        const mudou = anterior !== null && tarefaAnterior.get(String(escala.integranteId)) !== (escala.comodos || []).join('|');

        const cumpridos = escala.cumpridos || [];
        const completo = !isFolga && tarefas.length > 0 && tarefas.every(nome => cumpridos.includes(nome));
        const xs = isFolga ? [] : xsNaSemana(escala);
        const rotulo = isFolga
            ? '<i class="fa-solid fa-mug-hot"></i> Folga'
            : escaparHtml(tarefas.length > 0 ? tarefas.join(' + ') : 'Nenhum cômodo');

        return `
            <article class="escala-card ${isFolga ? 'folga' : ''} ${completo ? 'limpo' : ''} ${!completo && xs.length ? 'com-x' : ''} ${anterior !== null ? 'recem-gerado' : ''} ${mudou ? 'mudou' : ''}">
                <div class="escala-card-info">
                    <span class="escala-card-name">
                        ${escaparHtml(escala.integranteNome)}
                        ${totalInfracoes > 0 ? `<span class="escala-card-badge" title="${totalInfracoes} infração(ões) acumulada(s)">${totalInfracoes}X</span>` : ''}
                        ${mudou ? '<span class="escala-card-novo">novo</span>' : ''}
                    </span>
                    <span class="escala-card-comodo ${isFolga ? 'is-folga' : ''}">${rotulo}</span>
                    ${!isFolga && tarefas.length > 0 ? htmlStatus(tarefas, cumpridos, completo, xs) : ''}
                </div>
                ${!isFolga ? `<div class="escala-card-acoes">
                    ${tarefas.length > 0 ? `<button class="escala-card-ok-btn ${completo ? 'feito' : ''}" title="${completo ? 'Desmarcar limpeza' : 'Marcar como limpo'}" aria-label="${completo ? 'Desmarcar limpeza de' : 'Marcar como limpo:'} ${escaparHtml(escala.integranteNome)}" aria-pressed="${completo}" data-acao="marcar-limpeza" data-id="${escaparHtml(escala.id)}"><i class="fa-solid fa-check"></i></button>` : ''}
                    <button class="escala-card-x-btn ${xs.length ? 'marcado' : ''}" title="${xs.length ? `${xs.length} X nesta semana: marcar outro` : 'Marcar X'}" aria-label="Marcar infração para ${escaparHtml(escala.integranteNome)}" data-acao="marcar-x" data-id="${escaparHtml(escala.integranteId)}" data-permissao="infracoes:registrar"><i class="fa-solid fa-xmark"></i></button>
                </div>` : ''}
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

// Marca ou desmarca a pessoa como tendo limpado tudo e redesenha os cards
export async function alternarLimpeza(id) {
    const linha = estado.escalaAtual.find(e => String(e.id) === String(id));
    if (!linha) return;
    const tarefas = (linha.comodos || []).filter(nome => nome !== 'FOLGA');
    const feito = !tarefas.every(nome => (linha.cumpridos || []).includes(nome));

    try {
        const atualizado = await api(`/escala/${encodeURIComponent(id)}/limpeza`, { metodo: 'POST', corpo: { feito } });
        linha.cumpridos = atualizado.cumpridos || [];
        renderizarEscalaTabela(estado.escalaAtual);
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao marcar a limpeza', 'error');
    }
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

// Semana da faxineira: a escala em uso passa para a semana seguinte, com o mesmo rodízio
export async function adiarEscala() {
    const emUso = estado.escalaAtual[0];
    if (!emUso) return;

    const marcadas = estado.escalaAtual.some(e => (e.cumpridos || []).length > 0);
    const confirmar = await mostrarConfirmacao(
        `Ninguém limpa na semana ${emUso.semana}: a escala inteira (mesmas pessoas e cômodos) passa para a semana seguinte, e o rodízio continua de onde parou.${marcadas ? ' As limpezas já marcadas serão desmarcadas.' : ''}`,
        { titulo: 'Adiar a escala 1 semana?', confirmarTexto: 'Adiar' }
    );
    if (!confirmar) return;

    const botao = document.getElementById('btn-adiar-escala');
    definirCarregando(botao, true, '⏳ Adiando...');
    try {
        const { escala } = await api('/escala/atual/adiar', { metodo: 'POST' });
        renderizarEscalaTabela(escala);
        renderizarCriticasEscala([]);
        mostrarNotificacao(`Escala adiada para a semana ${escala[0].semana} (${dataCurta(escala[0].dataInicio)} a ${dataCurta(escala[0].dataFim)}).`, 'success', 6000);
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao adiar a escala', 'error');
    } finally {
        definirCarregando(botao, false);
    }
}

export async function gerarNovaEscala() {
    if (obterIntegrantes().length === 0 || estado.comodos.length === 0) {
        mostrarNotificacao('Configure integrantes e cômodos primeiro!', 'warning');
        return;
    }

    // O backend gera a semana seguinte à escala em uso, sem esperar a semana começar
    const emUso = estado.escalaAtual[0];
    const adiantada = emUso && comecaDepois(emUso);
    const [titulo, mensagem] = !emUso
        ? ['Gerar escala desta semana?', 'O rodízio é calculado pelo histórico das semanas anteriores (não é sorteio).']
        : adiantada
            ? ['Refazer a escala adiantada?', `A escala da semana ${emUso.semana} já foi adiantada. Ela será refeita; se integrantes e cômodos não mudaram, o resultado será o mesmo.`]
            : ['Gerar escala da próxima semana?', `A escala da semana ${emUso.semana} sai da tela e a da próxima passa a valer, mesmo antes de a semana começar. O rodízio continua pelo histórico.`];
    const confirmar = await mostrarConfirmacao(mensagem, { titulo, confirmarTexto: 'Gerar' });
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
        const refeita = anterior.length > 0 && anterior[0].semana === novaEscala[0]?.semana && anterior[0].ano === novaEscala[0]?.ano;

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
        } else if (refeita && mudancas === 0) {
            mostrarNotificacao(`Escala refeita: a distribuição continua a mesma, pois nada mudou no histórico, integrantes ou cômodos.${detalhe}`, 'info', 6000);
        } else if (!refeita && anterior.length > 0) {
            mostrarNotificacao(`Escala da semana ${novaEscala[0].semana} gerada!${detalhe}`, 'success', 6000);
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
