import { aplicarPermissoes, temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { hoje } from '../../core/datas.js';
import { obterIntegrantes } from '../../core/moradores.js';
import { nomeDaRepublica } from '../../core/aparencia.js';
import { buscarAta, nomeDoMorador, salvarAta, excluirAta } from './dados.js';
import { htmlTarefa, dataLonga } from './telas.js';

// ===== LEITURA =====
const paragrafos = (texto) => escaparHtml(texto).replace(/\n/g, '<br>');

function htmlLeitura(ata) {
    const participantes = ata.participantes.map(nomeDoMorador).filter(Boolean);
    return `
        <div class="ata-leitura">
            <p class="ata-leitura-data"><i class="fa-regular fa-calendar"></i> ${dataLonga(ata.data)}${ata.local ? ` · <i class="fa-solid fa-location-dot"></i> ${escaparHtml(ata.local)}` : ''}</p>
            ${participantes.length ? `<div class="ata-bloco"><h4>Participantes (${participantes.length})</h4>
                <div class="ata-participantes">${participantes.map(nome => `<span>${escaparHtml(nome)}</span>`).join('')}</div></div>` : ''}
            ${ata.pauta ? `<div class="ata-bloco"><h4>Pauta</h4><p>${paragrafos(ata.pauta)}</p></div>` : ''}
            ${ata.conteudo ? `<div class="ata-bloco"><h4>O que foi discutido</h4><p>${paragrafos(ata.conteudo)}</p></div>` : ''}
            ${ata.decisoes.length ? `<div class="ata-bloco"><h4>Decisões</h4>
                <ul class="ata-decisoes">${ata.decisoes.map(d => `<li><i class="fa-solid fa-gavel"></i> ${escaparHtml(d)}</li>`).join('')}</ul></div>` : ''}
            ${ata.tarefas.length ? `<div class="ata-bloco"><h4>Encaminhamentos</h4>
                <div class="tarefas-lista">${ata.tarefas.map(t => htmlTarefa(t, ata)).join('')}</div></div>` : ''}
            ${!ata.pauta && !ata.conteudo && !ata.decisoes.length && !ata.tarefas.length ? '<p class="empty-state">Ata sem conteúdo ainda.</p>' : ''}
        </div>
        <div class="painel-acoes">
            <button type="button" class="btn btn-ghost" data-papel="compartilhar"><i class="fa-solid fa-share-nodes"></i> Enviar</button>
            <button type="button" class="btn btn-primary" data-papel="editar" data-permissao="atas:editar"><i class="fa-solid fa-pen"></i> Editar</button>
        </div>
    `;
}

// Texto da ata para o grupo da casa
function textoDaAta(ata) {
    const participantes = ata.participantes.map(nomeDoMorador).filter(Boolean);
    const blocos = [
        `📝 Ata · ${ata.titulo}`,
        `${dataLonga(ata.data)}${ata.local ? ` · ${ata.local}` : ''} · ${nomeDaRepublica()}`,
        participantes.length ? `Presentes: ${participantes.join(', ')}` : '',
        ata.pauta ? `\nPauta:\n${ata.pauta}` : '',
        ata.conteudo ? `\nDiscussão:\n${ata.conteudo}` : '',
        ata.decisoes.length ? `\nDecisões:\n${ata.decisoes.map(d => `• ${d}`).join('\n')}` : '',
        ata.tarefas.length ? `\nEncaminhamentos:\n${ata.tarefas.map(t => `${t.feito ? '✅' : '⬜'} ${t.texto}${t.responsavelId ? ` (${nomeDoMorador(t.responsavelId)})` : ''}${t.prazo ? ` até ${t.prazo.split('-').reverse().join('/')}` : ''}`).join('\n')}` : ''
    ];
    return blocos.filter(Boolean).join('\n');
}

async function compartilhar(ata) {
    const texto = textoDaAta(ata);
    try {
        if (navigator.share) {
            await navigator.share({ title: ata.titulo, text: texto });
            return;
        }
        await navigator.clipboard.writeText(texto);
        mostrarNotificacao('Ata copiada! É só colar no grupo.', 'success');
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Erro:', error);
        mostrarNotificacao('Não foi possível compartilhar', 'error');
    }
}

export function abrirAta(id, { aoMudar } = {}) {
    const ata = buscarAta(id);
    if (!ata) return;
    const { corpo, fechar } = abrirPainel({ titulo: ata.titulo, html: htmlLeitura(ata), classe: 'painel-ata' });
    aplicarPermissoes(corpo);
    corpo.querySelector('[data-papel="compartilhar"]').addEventListener('click', () => compartilhar(buscarAta(id)));
    corpo.querySelector('[data-papel="editar"]').addEventListener('click', () => {
        fechar();
        abrirFormularioAta({ id, aoMudar });
    });
}

// ===== FORMULÁRIO =====
const opcoesResponsavel = (moradores, selecionado) => `<option value="">Responsável</option>${moradores.map(m =>
    `<option value="${escaparHtml(m.id)}" ${String(m.id) === String(selecionado) ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('')}`;

const htmlLinhaDecisao = (texto = '') => `
    <div class="linha-dinamica">
        <input type="text" name="decisao" value="${escaparHtml(texto)}" maxlength="500" placeholder="Ex.: Visitas só até 23h em dia de semana">
        <button type="button" class="icon-btn danger" data-papel="remover-linha" aria-label="Remover"><i class="fa-solid fa-xmark"></i></button>
    </div>`;

const htmlLinhaTarefa = (tarefa = {}, moradores = []) => `
    <div class="linha-dinamica linha-tarefa" data-tarefa-id="${escaparHtml(tarefa.id || '')}">
        <div class="linha-tarefa-campos">
            <input type="text" name="tarefa-texto" value="${escaparHtml(tarefa.texto || '')}" maxlength="300" placeholder="O que precisa ser feito">
            <div class="linha-tarefa-detalhes">
                <select name="tarefa-responsavel" aria-label="Responsável">${opcoesResponsavel(moradores, tarefa.responsavelId)}</select>
                <input type="date" name="tarefa-prazo" value="${escaparHtml(tarefa.prazo || '')}" aria-label="Prazo">
                <label class="checkbox-label"><input type="checkbox" name="tarefa-feito" ${tarefa.feito ? 'checked' : ''}> Feito</label>
            </div>
        </div>
        <button type="button" class="icon-btn danger" data-papel="remover-linha" aria-label="Remover"><i class="fa-solid fa-xmark"></i></button>
    </div>`;

// `evento` = reunião da agenda que originou a ata (preenche título, data, local e pauta)
export function abrirFormularioAta({ id, evento, aoMudar } = {}) {
    const ata = id ? buscarAta(id) : null;
    if (id && !ata) return;
    const ativos = obterIntegrantes().filter(i => i.ativo !== false || ata?.participantes.includes(String(i.id)));
    const moradores = obterIntegrantes().filter(i => i.ativo !== false || ata?.tarefas.some(t => String(t.responsavelId) === String(i.id)));
    const participantes = new Set((ata?.participantes || []).map(String));
    const inicial = ata || {
        titulo: evento?.titulo || 'Reunião da casa',
        data: evento?.dia || hoje(),
        local: evento?.local || '',
        pauta: evento?.descricao || ''
    };

    const { corpo, fechar } = abrirPainel({
        titulo: ata ? `Editando: ${ata.titulo}` : 'Nova ata',
        classe: 'painel-ata',
        html: `
            <form id="form-ata" class="form-stack" novalidate>
                <label class="field"><span>Reunião *</span>
                    <input type="text" name="titulo" value="${escaparHtml(inicial.titulo)}" maxlength="120" required></label>
                <div class="field-row">
                    <label class="field"><span>Data *</span>
                        <input type="date" name="data" value="${escaparHtml(inicial.data)}" required></label>
                    <label class="field"><span>Local</span>
                        <input type="text" name="local" value="${escaparHtml(inicial.local || '')}" maxlength="120" placeholder="Sala"></label>
                </div>
                <div class="field"><span>Quem participou</span>
                    <div class="chips">
                        ${ativos.map(m => `<label class="chip chip-participante"><input type="checkbox" name="participante" value="${escaparHtml(m.id)}" ${participantes.has(String(m.id)) ? 'checked' : ''}><span>${escaparHtml(m.nome)}</span></label>`).join('')}
                        <button type="button" class="btn btn-ghost btn-sm" data-papel="todos">Todos</button>
                    </div>
                </div>
                <label class="field"><span>Pauta</span>
                    <textarea name="pauta" rows="3" maxlength="3000" placeholder="Assuntos da reunião, um por linha">${escaparHtml(inicial.pauta || '')}</textarea></label>
                <label class="field"><span>O que foi discutido</span>
                    <textarea name="conteudo" rows="7" maxlength="20000" placeholder="Resumo da conversa, opiniões, números...">${escaparHtml(ata?.conteudo || '')}</textarea></label>

                <fieldset class="form-grupo">
                    <legend><i class="fa-solid fa-gavel"></i> Decisões</legend>
                    <div id="ata-decisoes" class="linhas-dinamicas">${(ata?.decisoes || []).map(d => htmlLinhaDecisao(d)).join('')}</div>
                    <button type="button" class="btn btn-ghost btn-sm" data-papel="add-decisao"><i class="fa-solid fa-plus"></i> Decisão</button>
                </fieldset>

                <fieldset class="form-grupo">
                    <legend><i class="fa-solid fa-list-check"></i> Encaminhamentos</legend>
                    <div id="ata-tarefas" class="linhas-dinamicas">${(ata?.tarefas || []).map(t => htmlLinhaTarefa(t, moradores)).join('')}</div>
                    <button type="button" class="btn btn-ghost btn-sm" data-papel="add-tarefa"><i class="fa-solid fa-plus"></i> Encaminhamento</button>
                </fieldset>

                <div class="painel-acoes">
                    ${ata ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir" data-permissao="atas:gerenciar"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                    <button type="submit" class="btn btn-primary">${ata ? 'Salvar' : 'Salvar ata'}</button>
                </div>
            </form>
        `
    });
    aplicarPermissoes(corpo);
    const form = corpo.querySelector('#form-ata');

    const adicionarLinha = (containerId, html) => {
        const container = form.querySelector(containerId);
        container.insertAdjacentHTML('beforeend', html);
        container.lastElementChild.querySelector('input').focus();
    };
    form.querySelector('[data-papel="add-decisao"]').addEventListener('click', () => adicionarLinha('#ata-decisoes', htmlLinhaDecisao()));
    form.querySelector('[data-papel="add-tarefa"]').addEventListener('click', () => adicionarLinha('#ata-tarefas', htmlLinhaTarefa({}, moradores)));
    form.addEventListener('click', (e) => {
        e.target.closest('[data-papel="remover-linha"]')?.closest('.linha-dinamica').remove();
    });
    form.querySelector('[data-papel="todos"]').addEventListener('click', () => {
        const caixas = [...form.querySelectorAll('input[name="participante"]')];
        const marcar = caixas.some(c => !c.checked);
        caixas.forEach(c => { c.checked = marcar; });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            titulo: form.elements.titulo.value.trim(),
            data: form.elements.data.value,
            local: form.elements.local.value.trim(),
            pauta: form.elements.pauta.value.trim(),
            conteudo: form.elements.conteudo.value.trim(),
            participantes: [...form.querySelectorAll('input[name="participante"]:checked')].map(c => c.value),
            decisoes: [...form.querySelectorAll('input[name="decisao"]')].map(c => c.value.trim()).filter(Boolean),
            tarefas: [...form.querySelectorAll('.linha-tarefa')].map(linha => ({
                id: linha.dataset.tarefaId || undefined,
                texto: linha.querySelector('[name="tarefa-texto"]').value.trim(),
                responsavelId: linha.querySelector('[name="tarefa-responsavel"]').value || null,
                prazo: linha.querySelector('[name="tarefa-prazo"]').value || null,
                feito: linha.querySelector('[name="tarefa-feito"]').checked
            })).filter(t => t.texto)
        };
        if (!ata && evento) dados.eventoId = evento.id;
        if (!dados.titulo) return mostrarNotificacao('Dê um título para a reunião', 'warning');
        if (!dados.data) return mostrarNotificacao('Informe a data da reunião', 'warning');

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            const salva = await salvarAta(ata?.id, dados);
            mostrarNotificacao(ata ? 'Ata atualizada!' : 'Ata salva!', 'success');
            fechar();
            aoMudar?.();
            abrirAta(salva.id, { aoMudar });
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar a ata', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (!(await mostrarConfirmacao(`Apagar a ata "${ata.titulo}" de ${dataLonga(ata.data)}? Não dá para desfazer.`, { titulo: 'Apagar ata', confirmarTexto: 'Apagar' }))) return;
        try {
            await excluirAta(ata.id);
            fechar();
            mostrarNotificacao('Ata apagada', 'success');
            aoMudar?.();
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao apagar', 'error');
        }
    });

    if (!temPermissao('atas:editar')) form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; });
}
