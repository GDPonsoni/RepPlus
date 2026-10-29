import { aplicarPermissoes } from '../../core/sessao.js';
import { escaparHtml } from '../../core/ui.js';
import { formatarDia } from '../../core/datas.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { estado, atasOrdenadas, pendencias, situacaoPrazo, nomeDoMorador, semAcento } from './dados.js';

export const HTML_ABA_ATAS = `
    <div class="pagina-topo">
        <h2 class="section-title">Atas de reunião</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="nova-ata" data-permissao="atas:editar"><i class="fa-solid fa-plus"></i> Nova</button>
    </div>
    <div id="atas-sugestoes"></div>
    <input type="search" id="atas-busca" class="atas-busca" placeholder="Buscar no que foi discutido..." aria-label="Buscar nas atas" autocomplete="off">
    <div id="atas-lista" class="atas-lista"></div>
`;

export const HTML_ABA_PENDENCIAS = `
    <h2 class="section-title">Pendências</h2>
    <p class="atas-ajuda">Encaminhamentos combinados nas reuniões que ainda não foram feitos.</p>
    <div id="pendencias-filtro" class="chips pendencias-filtro" role="radiogroup" aria-label="Filtrar por responsável"></div>
    <div id="pendencias-lista"></div>
`;

const dataCurta = (dia) => formatarDia(dia, { day: '2-digit', month: 'short' }).replace(' de ', ' ').replace('.', '');
export const dataLonga = (dia) => formatarDia(dia, { day: 'numeric', month: 'long', year: 'numeric' });

// ===== LISTA DE ATAS =====
function renderizarSugestoes() {
    const container = document.getElementById('atas-sugestoes');
    const reunioes = estado.reunioesSemAta.slice(0, 3);
    container.innerHTML = reunioes.length ? `
        <div class="card card-padded atas-sugestao" data-permissao="atas:editar">
            <p class="atas-sugestao-titulo"><i class="fa-solid fa-pen-to-square"></i> Reuniões da agenda sem ata</p>
            ${reunioes.map(evento => `
                <div class="atas-sugestao-item">
                    <span><strong>${escaparHtml(evento.titulo)}</strong><span class="atas-sugestao-data">${dataLonga(evento.dia)}</span></span>
                    <button type="button" class="btn btn-ghost btn-sm" data-acao="ata-de-evento" data-id="${escaparHtml(evento.id)}" data-dia="${evento.dia}">Escrever ata</button>
                </div>
            `).join('')}
        </div>
    ` : '';
    aplicarPermissoes(container);
}

// Busca em título, pauta, discussão, decisões e encaminhamentos
function textoBuscavel(ata) {
    return semAcento([ata.titulo, ata.local, ata.pauta, ata.conteudo, ...ata.decisoes, ...ata.tarefas.map(t => t.texto)].join(' '));
}

function trechoEncontrado(ata, busca) {
    const partes = [ata.conteudo, ata.pauta, ...ata.decisoes, ...ata.tarefas.map(t => t.texto)].filter(Boolean);
    const parte = partes.find(texto => semAcento(texto).includes(busca));
    if (!parte) return null;
    const inicio = Math.max(0, semAcento(parte).indexOf(busca) - 40);
    return `${inicio > 0 ? '…' : ''}${parte.slice(inicio, inicio + 140)}${parte.length > inicio + 140 ? '…' : ''}`;
}

function renderizarLista() {
    const container = document.getElementById('atas-lista');
    const busca = semAcento(document.getElementById('atas-busca').value.trim());
    const atas = atasOrdenadas().filter(ata => !busca || textoBuscavel(ata).includes(busca));

    if (!atas.length) {
        container.innerHTML = `<div class="card"><p class="empty-state">${busca
            ? 'Nada encontrado nas atas.'
            : 'Nenhuma ata ainda. Depois de cada reunião, registre o que foi discutido e decidido.'}</p></div>`;
        return;
    }

    container.innerHTML = atas.map(ata => {
        const feitas = ata.tarefas.filter(t => t.feito).length;
        const trecho = busca ? trechoEncontrado(ata, busca) : (ata.conteudo || ata.pauta);
        const [dia, mes] = dataCurta(ata.data).split(' ');
        return `
            <button type="button" class="card ata-card" data-acao="abrir-ata" data-id="${escaparHtml(ata.id)}">
                <span class="ata-data"><strong>${dia}</strong>${mes}<small>${ata.data.slice(0, 4)}</small></span>
                <span class="ata-resumo">
                    <span class="ata-titulo">${escaparHtml(ata.titulo)}</span>
                    ${trecho ? `<span class="ata-trecho">${escaparHtml(trecho)}</span>` : ''}
                    <span class="ata-meta">
                        ${ata.participantes.length ? `<span><i class="fa-solid fa-users"></i> ${ata.participantes.length}</span>` : ''}
                        ${ata.decisoes.length ? `<span><i class="fa-solid fa-gavel"></i> ${ata.decisoes.length} ${ata.decisoes.length === 1 ? 'decisão' : 'decisões'}</span>` : ''}
                        ${ata.tarefas.length ? `<span class="${feitas < ata.tarefas.length ? 'ata-meta-pendente' : 'ata-meta-ok'}"><i class="fa-solid fa-list-check"></i> ${feitas}/${ata.tarefas.length} feitos</span>` : ''}
                    </span>
                </span>
            </button>
        `;
    }).join('');
}

// ===== PENDÊNCIAS =====
export function htmlTarefa(tarefa, ata, { mostrarAta = false } = {}) {
    const responsavel = nomeDoMorador(tarefa.responsavelId);
    const prazo = !tarefa.feito && situacaoPrazo(tarefa.prazo);
    return `
        <div class="tarefa-item ${tarefa.feito ? 'feita' : ''}">
            <button type="button" class="tarefa-check" data-acao="marcar-tarefa" data-ata="${escaparHtml(ata.id)}" data-tarefa="${escaparHtml(tarefa.id)}" data-feito="${tarefa.feito ? '' : '1'}" data-permissao="atas:editar" aria-label="${tarefa.feito ? 'Marcar como não feito' : 'Marcar como feito'}">
                <i class="fa-solid fa-check"></i>
            </button>
            <span class="tarefa-info">
                <span class="tarefa-texto">${escaparHtml(tarefa.texto)}</span>
                <span class="tarefa-meta">
                    ${responsavel ? `<span><i class="fa-solid fa-user"></i> ${escaparHtml(responsavel)}</span>` : '<span class="tarefa-sem-dono">sem responsável</span>'}
                    ${tarefa.prazo ? `<span class="tarefa-prazo ${prazo?.classe || ''}"><i class="fa-regular fa-calendar"></i> ${dataCurta(tarefa.prazo)}${prazo ? ` · ${prazo.texto}` : ''}</span>` : ''}
                    ${mostrarAta ? `<button type="button" class="tarefa-origem" data-acao="abrir-ata" data-id="${escaparHtml(ata.id)}"><i class="fa-solid fa-file-lines"></i> ${escaparHtml(ata.titulo)} (${dataCurta(ata.data)})</button>` : ''}
                </span>
            </span>
        </div>
    `;
}

function renderizarPendencias() {
    const abertas = pendencias();
    const filtro = document.getElementById('pendencias-filtro');
    const lista = document.getElementById('pendencias-lista');

    // Filtro: só quem tem pendência aparece
    const contagem = new Map();
    abertas.forEach(t => contagem.set(t.responsavelId || 'ninguem', (contagem.get(t.responsavelId || 'ninguem') || 0) + 1));
    if (estado.filtroResponsavel && !contagem.has(estado.filtroResponsavel)) estado.filtroResponsavel = '';
    const opcoes = [['', 'Todos', abertas.length],
        ...obterIntegrantes().filter(i => contagem.has(String(i.id))).map(i => [String(i.id), i.nome, contagem.get(String(i.id))]),
        ...(contagem.has('ninguem') ? [['ninguem', 'Sem responsável', contagem.get('ninguem')]] : [])];
    filtro.innerHTML = abertas.length ? opcoes.map(([valor, nome, total]) => `
        <label class="chip"><input type="radio" name="pendencias-responsavel" value="${escaparHtml(valor)}" ${valor === estado.filtroResponsavel ? 'checked' : ''}>
            <span>${escaparHtml(nome)} <small>${total}</small></span></label>
    `).join('') : '';

    const visiveis = abertas.filter(t => !estado.filtroResponsavel || (t.responsavelId || 'ninguem') === estado.filtroResponsavel);
    lista.innerHTML = visiveis.length
        ? `<div class="card tarefas-lista">${visiveis.map(t => htmlTarefa(t, t.ata, { mostrarAta: true })).join('')}</div>`
        : `<div class="card atas-vazio"><i class="fa-solid fa-circle-check"></i><p><strong>Tudo em dia!</strong></p><p>${estado.atas.length ? 'Nenhum encaminhamento pendente.' : 'Os encaminhamentos das atas aparecem aqui.'}</p></div>`;
    aplicarPermissoes(lista);
}

export function renderizarTudo() {
    if (!estado.carregado) return;
    renderizarSugestoes();
    renderizarLista();
    renderizarPendencias();
}

export { renderizarLista, renderizarPendencias };
