import { aplicarPermissoes } from '../../core/sessao.js';
import { escaparHtml, mostrarNotificacao } from '../../core/ui.js';
import { hoje, somarDias, inicioDaSemana, formatarDia, horaDoInstante } from '../../core/datas.js';
import { estiloCategoria } from '../../core/categorias.js';
import { estado, categoriaDoEvento, RECORRENCIAS, carregarPeriodo, eventosDoDia, diaInicial, diaFinal } from './dados.js';

const NOMES_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MAXIMO_PINS = 3;

export const HTML_ABA_MES = `
    <div class="agenda-toolbar">
        <button type="button" class="icon-btn" data-acao="agenda-navegar" data-passo="-1" aria-label="Mês anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <h2 class="agenda-titulo" id="agenda-mes-titulo"></h2>
        <button type="button" class="icon-btn" data-acao="agenda-navegar" data-passo="1" aria-label="Próximo mês"><i class="fa-solid fa-chevron-right"></i></button>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="agenda-hoje">Hoje</button>
    </div>
    <div class="card calendario">
        <div class="cal-nomes">${NOMES_DIAS.map(nome => `<span>${nome}</span>`).join('')}</div>
        <div class="cal-grade" id="cal-grade"></div>
    </div>
    <div id="agenda-dia-detalhe" class="agenda-dia-detalhe"></div>
    <button type="button" class="fab" data-acao="novo-evento" data-permissao="agenda:criar" aria-label="Novo evento"><i class="fa-solid fa-plus"></i></button>
`;

export const HTML_ABA_SEMANA = `
    <div class="agenda-toolbar">
        <button type="button" class="icon-btn" data-acao="agenda-navegar" data-passo="-1" aria-label="Semana anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <h2 class="agenda-titulo" id="agenda-semana-titulo"></h2>
        <button type="button" class="icon-btn" data-acao="agenda-navegar" data-passo="1" aria-label="Próxima semana"><i class="fa-solid fa-chevron-right"></i></button>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="agenda-hoje">Hoje</button>
    </div>
    <div id="agenda-semana-dias" class="semana-lista"></div>
    <button type="button" class="fab" data-acao="novo-evento" data-permissao="agenda:criar" aria-label="Novo evento"><i class="fa-solid fa-plus"></i></button>
`;

// Horário do evento visto a partir de um dia (eventos de vários dias mostram início/fim só nas pontas)
function textoHorario(evento, dia) {
    if (evento.diaInteiro) return 'Dia todo';
    const inicio = diaInicial(evento) === dia ? horaDoInstante(evento.inicio) : null;
    const fim = evento.fim && diaFinal(evento) === dia ? horaDoInstante(evento.fim) : null;
    if (inicio && fim) return `${inicio}<span class="evento-hora-fim">${fim}</span>`;
    if (inicio) return evento.fim ? `${inicio}<span class="evento-hora-fim">segue</span>` : inicio;
    if (fim) return `<span class="evento-hora-fim">até</span>${fim}`;
    return 'Dia todo';
}

function htmlEvento(evento, dia, { detalhado = true } = {}) {
    const categoria = categoriaDoEvento(evento);
    const variosDias = diaInicial(evento) !== diaFinal(evento);
    const periodo = variosDias
        ? `<span class="evento-extra"><i class="fa-regular fa-calendar"></i> ${formatarDia(diaInicial(evento), { day: '2-digit', month: '2-digit' })} a ${formatarDia(diaFinal(evento), { day: '2-digit', month: '2-digit' })}</span>`
        : '';
    const conteudo = `
        <span class="evento-hora">${textoHorario(evento, dia)}</span>
        <span class="evento-info">
            <span class="evento-titulo"><i class="${categoria.icone}"></i> ${escaparHtml(evento.titulo)}</span>
            ${evento.local ? `<span class="evento-extra"><i class="fa-solid fa-location-dot"></i> ${escaparHtml(evento.local)}</span>` : ''}
            ${periodo}
            ${evento.recorrencia ? `<span class="evento-extra evento-repete"><i class="fa-solid fa-repeat"></i> ${RECORRENCIAS[evento.recorrencia]}</span>` : ''}
            ${detalhado && evento.descricao ? `<span class="evento-descricao">${escaparHtml(evento.descricao)}</span>` : ''}
        </span>
    `;
    // Aniversários vêm do cadastro de moradores: não abrem o formulário
    return evento.somenteLeitura
        ? `<div class="evento-card" style="${estiloCategoria(categoria)}">${conteudo}</div>`
        : `<button type="button" class="evento-card" style="${estiloCategoria(categoria)}" data-acao="abrir-evento" data-id="${escaparHtml(evento.id)}" ${evento.ocorrencia ? `data-ocorrencia="${evento.ocorrencia}"` : ''}>${conteudo}</button>`;
}

// ===== MÊS =====
export async function renderizarMes() {
    const mes = estado.mes;
    const primeiroDaGrade = inicioDaSemana(mes);
    const dias = Array.from({ length: 42 }, (_, i) => somarDias(primeiroDaGrade, i));

    const titulo = formatarDia(mes, { month: 'long', year: 'numeric' });
    document.getElementById('agenda-mes-titulo').textContent = titulo.charAt(0).toUpperCase() + titulo.slice(1);

    try {
        await carregarPeriodo(dias[0], somarDias(dias[41], 1));
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar a agenda', 'error');
    }
    // Outra navegação começou enquanto carregava: deixa a mais recente desenhar
    if (mes !== estado.mes) return;

    const diaHoje = hoje();
    document.getElementById('cal-grade').innerHTML = dias.map(dia => {
        const eventos = eventosDoDia(dia);
        const extras = eventos.length - MAXIMO_PINS;
        const classes = [
            'cal-dia',
            dia.slice(0, 7) !== mes.slice(0, 7) ? 'fora-do-mes' : '',
            dia === diaHoje ? 'hoje' : '',
            dia === estado.diaSelecionado ? 'selecionado' : '',
            eventos.length ? 'com-eventos' : ''
        ].join(' ');
        return `
            <button type="button" class="${classes}" data-acao="agenda-selecionar-dia" data-dia="${dia}" aria-label="${formatarDia(dia, { day: 'numeric', month: 'long' })}, ${eventos.length} evento(s)">
                <span class="cal-dia-numero">${Number(dia.slice(8))}</span>
                <span class="cal-pins">
                    ${eventos.slice(0, MAXIMO_PINS).map(e => `<span class="cal-pin" style="${estiloCategoria(categoriaDoEvento(e))}"><span class="cal-pin-texto">${escaparHtml(e.titulo)}</span></span>`).join('')}
                    ${extras > 0 ? `<span class="cal-mais">+${extras}</span>` : ''}
                </span>
            </button>
        `;
    }).join('');

    renderizarDiaSelecionado();
}

function renderizarDiaSelecionado() {
    const dia = estado.diaSelecionado;
    const eventos = eventosDoDia(dia);
    const titulo = formatarDia(dia, { weekday: 'long', day: 'numeric', month: 'long' });
    const container = document.getElementById('agenda-dia-detalhe');

    container.innerHTML = `
        <div class="agenda-dia-topo">
            <h3>${titulo.charAt(0).toUpperCase() + titulo.slice(1)}${dia === hoje() ? ' <span class="badge-hoje">Hoje</span>' : ''}</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-acao="novo-evento" data-dia="${dia}" data-permissao="agenda:criar"><i class="fa-solid fa-plus"></i> Evento</button>
        </div>
        <div class="evento-lista">
            ${eventos.length ? eventos.map(e => htmlEvento(e, dia)).join('') : '<p class="agenda-vazio">Nada marcado para este dia.</p>'}
        </div>
    `;
    aplicarPermissoes(container);
}

export function selecionarDia(dia) {
    estado.diaSelecionado = dia;
    // Tocar num dia de outro mês leva para aquele mês
    if (dia.slice(0, 7) !== estado.mes.slice(0, 7)) {
        estado.mes = `${dia.slice(0, 7)}-01`;
        renderizarMes();
        return;
    }
    document.querySelectorAll('#cal-grade .cal-dia').forEach(celula => {
        celula.classList.toggle('selecionado', celula.dataset.dia === dia);
    });
    renderizarDiaSelecionado();
}

// ===== SEMANA =====
export async function renderizarSemana() {
    const semana = estado.semana;
    const dias = Array.from({ length: 7 }, (_, i) => somarDias(semana, i));

    const inicio = formatarDia(dias[0], { day: 'numeric', month: 'short' }).replace('.', '');
    const fim = formatarDia(dias[6], { day: 'numeric', month: 'short' }).replace('.', '');
    document.getElementById('agenda-semana-titulo').textContent = `${inicio} – ${fim}`;

    try {
        await carregarPeriodo(dias[0], somarDias(dias[6], 1));
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar a agenda', 'error');
    }
    if (semana !== estado.semana) return;

    const diaHoje = hoje();
    const container = document.getElementById('agenda-semana-dias');
    container.innerHTML = dias.map((dia, i) => {
        const eventos = eventosDoDia(dia);
        return `
            <section class="semana-dia ${dia === diaHoje ? 'hoje' : ''} ${eventos.length ? '' : 'vazio'}">
                <div class="semana-dia-topo">
                    <span class="semana-dia-numero">${Number(dia.slice(8))}</span>
                    <span class="semana-dia-nome">${NOMES_DIAS[i]}${dia === diaHoje ? ' <span class="badge-hoje">Hoje</span>' : ''}</span>
                    <button type="button" class="icon-btn" data-acao="novo-evento" data-dia="${dia}" data-permissao="agenda:criar" aria-label="Novo evento neste dia"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="evento-lista">
                    ${eventos.length ? eventos.map(e => htmlEvento(e, dia)).join('') : '<p class="agenda-vazio">Livre</p>'}
                </div>
            </section>
        `;
    }).join('');
    aplicarPermissoes(container);
}

// Avança/volta um mês ou uma semana, conforme a visão aberta
export function navegarPeriodo(passo) {
    if (estado.visao === 'mes') {
        const [ano, mes] = estado.mes.split('-').map(Number);
        const novo = new Date(Date.UTC(ano, mes - 1 + passo, 1)).toISOString().slice(0, 10);
        estado.mes = novo;
        // Mantém o "dia selecionado" no mês exibido: hoje, se for o mês atual; senão o dia 1
        estado.diaSelecionado = hoje().slice(0, 7) === novo.slice(0, 7) ? hoje() : novo;
        renderizarMes();
    } else {
        estado.semana = somarDias(estado.semana, 7 * passo);
        renderizarSemana();
    }
}

export function irParaHoje() {
    estado.mes = `${hoje().slice(0, 7)}-01`;
    estado.diaSelecionado = hoje();
    estado.semana = inicioDaSemana(hoje());
    return estado.visao === 'mes' ? renderizarMes() : renderizarSemana();
}

export function atualizarVisao() {
    return estado.visao === 'mes' ? renderizarMes() : renderizarSemana();
}
