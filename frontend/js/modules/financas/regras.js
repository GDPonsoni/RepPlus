import { api } from '../../core/api.js';
import { mostrarConfirmacao } from '../../core/modal.js';
import { abrirPainel } from '../../core/painel.js';
import { escaparHtml, mostrarNotificacao, definirCarregando } from '../../core/ui.js';
import { formatarDia } from '../../core/datas.js';
import { htmlEscolhaCategoria } from '../../core/categorias.js';
import { ESCOPO, reais, categoriaFin } from './dados.js';

// Criador de regras de categoria: "se a descrição contém <termo> (só saídas, só entradas ou as
// duas), a categoria é <categoria>", com a prévia ao vivo do que a regra pega antes de salvar.

// Mesmo critério do backend (regras.js → termoDoGrupo): palavras sem números, e depois de um
// começo genérico ("PIX ENVIADO") mais duas palavras, para o termo dizer de quem é o lançamento
const PREFIXOS_GENERICOS = ['pix enviado', 'pix recebido', 'pix', 'ted enviada', 'ted recebida', 'ted', 'doc', 'transferencia enviada',
    'transferencia recebida', 'transferencia', 'compra no debito', 'compra no credito', 'compra', 'pagamento de', 'pagamento', 'pagto',
    'pag', 'debito automatico', 'deb aut', 'boleto', 'pg', 'pgto'];
export function termoParecido(descricao) {
    const palavras = [];
    for (const palavra of String(descricao || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/)) {
        if (/[\d*#/]/.test(palavra) || !/[a-z]/.test(palavra)) break;
        palavras.push(palavra);
    }
    const texto = palavras.join(' ');
    const prefixo = PREFIXOS_GENERICOS.find(p => texto === p || texto.startsWith(`${p} `));
    return palavras.slice(0, (prefixo ? prefixo.split(' ').length : 0) + 2).join(' ') || String(descricao || '').slice(0, 20);
}

const SENTIDOS = [
    ['', 'Gastos e entradas', 'fa-solid fa-right-left'],
    ['saida', 'Só gastos', 'fa-solid fa-arrow-trend-down'],
    ['entrada', 'Só entradas', 'fa-solid fa-arrow-trend-up']
];

function htmlPrevia(p, categoria) {
    if (!p) return '<p class="fin-ajuda">Digite pelo menos 3 letras para ver o que a regra pega.</p>';
    if (!p.quantidade) return '<p class="fin-previa-vazia"><i class="fa-solid fa-circle-info"></i> Nenhum lançamento contém esse termo ainda. A regra vale para os próximos.</p>';
    const avisos = [
        p.manuais ? `${p.manuais} escolhido(s) à mão não mudam` : '',
        p.outrasRegras ? `${p.outrasRegras} ficam com uma regra mais específica` : ''
    ].filter(Boolean);
    return `
        <p class="fin-previa-total"><strong>${p.quantidade} lançamento(s)</strong> contêm o termo · ${reais(p.total)}
            ${categoria ? `<br><span>${p.mudam} vão para <strong>${escaparHtml(categoriaFin(categoria).nomeCompleto)}</strong></span>` : ''}
            ${avisos.length ? `<br><small>${avisos.join(' · ')}</small>` : ''}</p>
        <ul class="fin-previa-lista">${p.exemplos.map(t => `
            <li><span>${escaparHtml(t.descricao)}<small>${formatarDia(t.data, { day: '2-digit', month: 'short' }).replace('.', '')} · ${escaparHtml(categoriaFin(t.categoria).nomeCompleto)}</small></span>
                <strong class="fin-valor ${t.valor < 0 ? 'saida' : 'entrada'}">${reais(t.valor)}</strong></li>`).join('')}
        </ul>`;
}

// regra: existente (editar) ou valores iniciais { termo, sentido, categoria } para uma nova
export function abrirEditorRegra({ regra = null, termo = '', sentido = '', categoria = '', aoMudar } = {}) {
    const inicial = regra || { termo, sentido, categoria };
    const { corpo, fechar } = abrirPainel({
        titulo: regra ? 'Editar regra' : 'Nova regra',
        html: `
            <form class="form-stack" novalidate>
                <label class="field"><span>Se a descrição contém *</span>
                    <input type="text" name="termo" maxlength="60" value="${escaparHtml(inicial.termo || '')}" placeholder="Ex.: pix enviado alexandre" autocomplete="off" required>
                    <small>Maiúsculas e acentos não importam. Quanto mais longo o termo, mais específica a regra: "uber eats" vence "uber".</small></label>
                <div class="field"><span>Vale para</span>
                    <div class="chips" role="radiogroup">${SENTIDOS.map(([valor, nome, icone]) => `
                        <label class="chip"><input type="radio" name="sentido" value="${valor}" ${valor === (inicial.sentido || '') ? 'checked' : ''}><span><i class="${icone}"></i> ${nome}</span></label>`).join('')}
                    </div></div>
                <div class="field"><span>Categoria *</span>
                    ${htmlEscolhaCategoria({ escopo: ESCOPO, selecionada: inicial.categoria || '', nenhuma: true })}</div>
                <div class="fin-previa" aria-live="polite"></div>
                <div class="painel-acoes">
                    ${regra ? '<button type="button" class="btn btn-ghost btn-perigo" data-papel="excluir" aria-label="Excluir regra"><i class="fa-solid fa-trash"></i></button>' : ''}
                    <button type="submit" class="btn btn-primary">${regra ? 'Salvar' : 'Criar regra'}</button>
                </div>
            </form>`
    });
    const form = corpo.querySelector('form');
    const previa = corpo.querySelector('.fin-previa');
    const ler = () => ({
        termo: form.elements.termo.value.trim(),
        sentido: form.querySelector('input[name="sentido"]:checked')?.value || null,
        categoria: form.querySelector('input[name="categoria"]:checked')?.value || null
    });

    // Prévia ao vivo, esperando a pessoa parar de digitar; só a última resposta vale
    let espera;
    let pedido = 0;
    const atualizarPrevia = () => {
        clearTimeout(espera);
        espera = setTimeout(async () => {
            const dados = ler();
            if (dados.termo.length < 3) {
                previa.innerHTML = htmlPrevia(null);
                return;
            }
            const meu = ++pedido;
            try {
                const resposta = await api('/financas/regras/previa', { metodo: 'POST', corpo: { ...dados, ignorarId: regra?.id } });
                if (meu === pedido) previa.innerHTML = htmlPrevia(resposta, dados.categoria);
            } catch (error) {
                if (meu === pedido) previa.innerHTML = `<p class="fin-ajuda">${escaparHtml(error.message || 'Não foi possível calcular a prévia')}</p>`;
            }
        }, 250);
    };
    form.addEventListener('input', atualizarPrevia);
    form.addEventListener('change', atualizarPrevia);
    atualizarPrevia();
    if (!inicial.termo) form.elements.termo.focus();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = ler();
        if (dados.termo.length < 3) return mostrarNotificacao('Use um termo com pelo menos 3 letras', 'warning');
        if (!dados.categoria) return mostrarNotificacao('Escolha a categoria', 'warning');
        const botao = form.querySelector('button[type="submit"]');
        definirCarregando(botao, true, '⏳ Salvando...');
        try {
            const { atualizadas } = await api(regra ? `/financas/regras/${regra.id}` : '/financas/regras', { metodo: regra ? 'PUT' : 'POST', corpo: dados });
            mostrarNotificacao(`Regra salva. ${atualizadas} lançamento(s) reclassificados`, 'success');
            fechar();
            aoMudar?.();
        } catch (error) {
            mostrarNotificacao(error.message || 'Erro ao salvar a regra', 'error');
            definirCarregando(botao, false);
        }
    });

    form.querySelector('[data-papel="excluir"]')?.addEventListener('click', async () => {
        if (await excluirRegra({ id: regra.id, termo: regra.termo })) {
            fechar();
            aoMudar?.();
        }
    });
}

export async function excluirRegra({ id, termo }) {
    if (!(await mostrarConfirmacao(`Excluir a regra "${termo}"? Os lançamentos que ela categorizava voltam a seguir as outras regras (ou ficam sem categoria).`, { titulo: 'Excluir regra', confirmarTexto: 'Excluir' }))) return false;
    const { atualizadas } = await api(`/financas/regras/${id}`, { metodo: 'DELETE' });
    mostrarNotificacao(`Regra excluída${atualizadas ? `. ${atualizadas} lançamento(s) reclassificados` : ''}`, 'success');
    return true;
}
