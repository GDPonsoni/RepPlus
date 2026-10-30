import { api } from '../../core/api.js';
import { temPermissao } from '../../core/sessao.js';
import { mostrarConfirmacao, mostrarEscolha } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { hoje, instante, horaDoInstante, formatarDia } from '../../core/datas.js';
import { htmlEscolhaCategoria } from '../../core/categorias.js';
import { RECORRENCIAS, diaInicial, diaFinal } from './dados.js';

// Texto de cada opção de repetição de acordo com a data escolhida (ex.: "Todo mês, no dia 10")
function rotuloRecorrencia(tipo, data) {
    if (!data) return RECORRENCIAS[tipo];
    if (tipo === 'semanal' || tipo === 'quinzenal') return `${RECORRENCIAS[tipo]} (${formatarDia(data, { weekday: 'long' })})`;
    if (tipo === 'mensal') return `${RECORRENCIAS[tipo]}, no dia ${Number(data.slice(8))}`;
    return `${RECORRENCIAS[tipo]}, em ${formatarDia(data, { day: 'numeric', month: 'long' })}`;
}

// Formulário de evento (criar/editar/excluir). `aoSalvar` recarrega a visão aberta.
export function abrirFormularioEvento({ evento = null, dia = hoje(), aoSalvar }) {
    const podeEditar = evento ? temPermissao('agenda:gerenciar') : temPermissao('agenda:criar');
    const desabilitado = podeEditar ? '' : 'disabled';

    // Numa ocorrência de evento recorrente, o formulário edita a série: datas da primeira ocorrência
    const serie = evento?.ocorrencia
        ? { ...evento, inicio: evento.serieInicio, fim: evento.serieFim }
        : evento;

    const valores = serie
        ? {
            titulo: serie.titulo,
            categoria: serie.categoria,
            diaInteiro: serie.diaInteiro,
            data: diaInicial(serie),
            horaInicio: serie.diaInteiro ? '' : horaDoInstante(serie.inicio),
            dataFim: serie.fim && diaFinal(serie) !== diaInicial(serie) ? diaFinal(serie) : '',
            horaFim: serie.fim && !serie.diaInteiro ? horaDoInstante(serie.fim) : '',
            local: serie.local || '',
            descricao: serie.descricao || '',
            recorrencia: serie.recorrencia || '',
            recorrenciaAte: serie.recorrenciaAte || ''
        }
        : { titulo: '', categoria: undefined, diaInteiro: false, data: dia, horaInicio: '19:00', dataFim: '', horaFim: '', local: '', descricao: '', recorrencia: '', recorrenciaAte: '' };

    const avisoSerie = evento?.ocorrencia && podeEditar
        ? `<p class="aviso-serie"><i class="fa-solid fa-repeat"></i> Este evento se repete (${RECORRENCIAS[evento.recorrencia].toLowerCase()}). As alterações valem para todas as repetições; a data abaixo é a da primeira.</p>`
        : '';

    const { corpo, fechar } = abrirPainel({
        titulo: evento ? (podeEditar ? 'Editar evento' : 'Evento') : 'Novo evento',
        html: `
            <form id="form-evento" class="form-stack" novalidate>
                ${avisoSerie}
                <label class="field">
                    <span>Título *</span>
                    <input type="text" name="titulo" value="${escaparHtml(valores.titulo)}" maxlength="120" required placeholder="Ex.: Reunião da casa" ${desabilitado}>
                </label>
                <div class="field">
                    <span>Categoria</span>
                    ${htmlEscolhaCategoria({ escopo: 'agenda', selecionada: valores.categoria, desabilitado: Boolean(desabilitado) })}
                </div>
                <label class="checkbox-label"><input type="checkbox" name="diaInteiro" ${valores.diaInteiro ? 'checked' : ''} ${desabilitado}> Dia inteiro</label>
                <div class="field-row">
                    <label class="field">
                        <span>Data *</span>
                        <input type="date" name="data" value="${valores.data}" required ${desabilitado}>
                    </label>
                    <label class="field" data-so-horario>
                        <span>Começa às *</span>
                        <input type="time" name="horaInicio" value="${valores.horaInicio}" ${desabilitado}>
                    </label>
                </div>
                <div class="field-row">
                    <label class="field">
                        <span>Termina em <small>(se outro dia)</small></span>
                        <input type="date" name="dataFim" value="${valores.dataFim}" ${desabilitado}>
                    </label>
                    <label class="field" data-so-horario>
                        <span>Termina às</span>
                        <input type="time" name="horaFim" value="${valores.horaFim}" ${desabilitado}>
                    </label>
                </div>
                <div class="field-row field-row-repetir">
                    <label class="field">
                        <span><i class="fa-solid fa-repeat"></i> Repetir</span>
                        <select name="recorrencia" ${desabilitado}>
                            <option value="">Não repete</option>
                            ${Object.keys(RECORRENCIAS).map(tipo => `<option value="${tipo}" ${valores.recorrencia === tipo ? 'selected' : ''}>${rotuloRecorrencia(tipo, valores.data)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="field" data-so-recorrente>
                        <span>Repetir até <small>(opcional)</small></span>
                        <input type="date" name="recorrenciaAte" value="${valores.recorrenciaAte}" ${desabilitado}>
                    </label>
                </div>
                <label class="field">
                    <span>Local</span>
                    <input type="text" name="local" value="${escaparHtml(valores.local)}" maxlength="120" placeholder="Ex.: Sala, quintal..." ${desabilitado}>
                </label>
                <label class="field">
                    <span>Descrição</span>
                    <textarea name="descricao" maxlength="1000" rows="3" placeholder="Detalhes, o que levar, quem participa..." ${desabilitado}>${escaparHtml(valores.descricao)}</textarea>
                </label>
                ${podeEditar ? `
                    <div class="painel-acoes">
                        ${evento ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir"><i class="fa-solid fa-trash"></i> Excluir</button>' : ''}
                        <button type="submit" class="btn btn-primary">${evento ? 'Salvar alterações' : 'Criar evento'}</button>
                    </div>
                ` : ''}
            </form>
        `
    });

    const form = corpo.querySelector('#form-evento');
    const campo = (nome) => form.elements[nome];

    // Dia inteiro esconde os horários
    const atualizarHorarios = () => {
        form.querySelectorAll('[data-so-horario]').forEach(el => { el.hidden = campo('diaInteiro').checked; });
    };
    campo('diaInteiro').addEventListener('change', atualizarHorarios);
    atualizarHorarios();

    // "Repetir até" só aparece com repetição; os rótulos acompanham a data (dia da semana / dia do mês)
    const atualizarRepeticao = () => {
        form.querySelector('[data-so-recorrente]').hidden = !campo('recorrencia').value;
        [...campo('recorrencia').options].forEach(opcao => {
            if (opcao.value) opcao.textContent = rotuloRecorrencia(opcao.value, campo('data').value);
        });
    };
    campo('recorrencia').addEventListener('change', atualizarRepeticao);
    campo('data').addEventListener('change', atualizarRepeticao);
    atualizarRepeticao();
    if (!evento) campo('titulo').focus();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = campo('titulo').value.trim();
        const data = campo('data').value;
        const dataFim = campo('dataFim').value;
        const diaInteiro = campo('diaInteiro').checked;
        const horaInicio = campo('horaInicio').value;
        const horaFim = campo('horaFim').value;

        if (!titulo) return avisar('Dê um título ao evento', 'titulo');
        if (!data) return avisar('Escolha a data do evento', 'data');
        if (!diaInteiro && !horaInicio) return avisar('Informe o horário de início (ou marque "Dia inteiro")', 'horaInicio');
        if (dataFim && dataFim < data) return avisar('O término não pode ser antes do início', 'dataFim');
        const recorrencia = campo('recorrencia').value || null;
        const recorrenciaAte = recorrencia ? campo('recorrenciaAte').value || null : null;
        if (recorrenciaAte && recorrenciaAte < data) return avisar('A repetição não pode terminar antes do primeiro dia', 'recorrenciaAte');

        let inicio;
        let fim = null;
        if (diaInteiro) {
            inicio = instante(data);
            fim = instante(dataFim || data, '23:59');
        } else {
            inicio = instante(data, horaInicio);
            if (horaFim) fim = instante(dataFim || data, horaFim);
            else if (dataFim) fim = instante(dataFim, '23:59');
            if (fim && fim < inicio) return avisar('O término não pode ser antes do início', 'horaFim');
        }

        const corpoRequisicao = {
            titulo,
            categoria: form.querySelector('input[name="categoria"]:checked')?.value || undefined,
            diaInteiro,
            inicio,
            fim,
            local: campo('local').value.trim(),
            descricao: campo('descricao').value.trim(),
            recorrencia,
            recorrenciaAte
        };

        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            if (evento) {
                await api(`/eventos/${evento.id}`, { metodo: 'PUT', corpo: corpoRequisicao });
                mostrarNotificacao('Evento atualizado!', 'success');
            } else {
                await api('/eventos', { metodo: 'POST', corpo: corpoRequisicao });
                mostrarNotificacao('Evento criado!', 'success');
            }
            fechar();
            // Editando uma repetição, continua no dia aberto (a série pode ter começado meses antes)
            aoSalvar?.(evento?.ocorrencia || data);
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao salvar evento', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        // Evento que se repete: excluir só o dia aberto (vira exceção da série) ou a série inteira
        let escolha;
        if (evento.ocorrencia) {
            const diaOcorrencia = formatarDia(evento.ocorrencia, { day: 'numeric', month: 'long' });
            escolha = await mostrarEscolha(`"${evento.titulo}" se repete ${RECORRENCIAS[evento.recorrencia].toLowerCase()}. O que você quer excluir?`, {
                titulo: 'Excluir evento',
                opcoes: [
                    { valor: 'ocorrencia', texto: `Só ${diaOcorrencia}`, classe: 'btn-secondary' },
                    { valor: 'serie', texto: 'Todas as repetições', classe: 'btn-danger' }
                ]
            });
        } else {
            escolha = (await mostrarConfirmacao(`Excluir "${evento.titulo}" da agenda?`, { titulo: 'Excluir evento', confirmarTexto: 'Excluir' })) ? 'serie' : null;
        }
        if (!escolha) return;

        try {
            if (escolha === 'ocorrencia') {
                await api(`/eventos/${evento.id}/excecoes`, { metodo: 'POST', corpo: { data: evento.ocorrencia } });
            } else {
                await api(`/eventos/${evento.id}`, { metodo: 'DELETE' });
            }
            fechar();
            mostrarNotificacao(escolha === 'ocorrencia' ? 'Repetição removida deste dia' : 'Evento excluído', 'success');
            aoSalvar?.();
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao(error.message || 'Erro ao excluir evento', 'error');
        }
    });

    function avisar(mensagem, nomeCampo) {
        mostrarNotificacao(mensagem, 'warning');
        campo(nomeCampo)?.focus();
    }
}
