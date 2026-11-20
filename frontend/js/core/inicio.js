import { registrarAcoes } from './acoes.js';
import { temPermissao } from './sessao.js';
import { abrirPainel } from './painel.js';
import { escaparHtml } from './ui.js';
import { hoje, formatarDia } from './datas.js';
import { nomeDaRepublica } from './aparencia.js';

// Página inicial (núcleo): um cartão de resumo por módulo ligado, com o mais importante de cada um.
//
// Um módulo entra no Início exportando `inicio`:
//   inicio: {
//     titulo: 'Lista de compras',
//     rota: 'compras/lista',                 // para onde o "Abrir" leva
//     permissao: 'compras:ver',              // sem ela, o cartão não aparece
//     async conteudo() { return '<html>' },  // busca os dados e devolve o HTML do cartão
//     aoMontar(elemento, atualizar)          // opcional: liga eventos (ex.: formulário rápido)
//   }
//
// Quais cartões aparecem e em que ordem é escolha de cada pessoa, salva neste aparelho.

const CHAVE_PREFERENCIAS = 'escala:inicio';

let modulos = [];

export function definirModulosDoInicio(ativos) {
    modulos = ativos;
}

const HTML_PAGINA = `
    <div id="inicio-saudacao" class="inicio-saudacao"></div>
    <div id="inicio-cartoes" class="inicio-cartoes"></div>
    <div class="inicio-rodape">
        <button type="button" class="btn btn-ghost btn-sm" data-acao="personalizar-inicio"><i class="fa-solid fa-sliders"></i> Personalizar início</button>
    </div>
`;

// ===== PREFERÊNCIAS (localStorage) =====
function lerPreferencias() {
    try {
        const salvas = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || '{}');
        return { ordem: Array.isArray(salvas.ordem) ? salvas.ordem : [], ocultos: Array.isArray(salvas.ocultos) ? salvas.ocultos : [] };
    } catch {
        return { ordem: [], ocultos: [] };
    }
}

function salvarPreferencias(preferencias) {
    try { localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias)); } catch { /* sem armazenamento: vale até recarregar */ }
}

// Cartões disponíveis para esta pessoa, na ordem escolhida (novos módulos entram no fim)
function cartoesDisponiveis() {
    const { ordem } = lerPreferencias();
    const posicao = (id) => (ordem.includes(id) ? ordem.indexOf(id) : ordem.length + modulos.findIndex(m => m.id === id));
    return modulos
        .filter(modulo => modulo.inicio && (!modulo.inicio.permissao || temPermissao(modulo.inicio.permissao)))
        .sort((a, b) => posicao(a.id) - posicao(b.id));
}

// ===== PÁGINA =====
function renderizarSaudacao() {
    const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()));
    const saudacao = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const data = formatarDia(hoje(), { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('inicio-saudacao').innerHTML = `
        <h2>${saudacao}! 👋</h2>
        <p>${escaparHtml(data.charAt(0).toUpperCase() + data.slice(1))} · ${escaparHtml(nomeDaRepublica())}</p>
    `;
}

async function preencherCartao(modulo, elemento) {
    const corpo = elemento.querySelector('.inicio-cartao-corpo');
    try {
        corpo.innerHTML = await modulo.inicio.conteudo();
        modulo.inicio.aoMontar?.(corpo, () => preencherCartao(modulo, elemento));
    } catch (error) {
        console.error(`Erro no resumo de ${modulo.id}:`, error);
        corpo.innerHTML = '<p class="inicio-vazio">Não foi possível carregar agora.</p>';
    }
}

function renderizarCartoes() {
    renderizarSaudacao();
    const { ocultos } = lerPreferencias();
    const visiveis = cartoesDisponiveis().filter(modulo => !ocultos.includes(modulo.id));
    const container = document.getElementById('inicio-cartoes');

    if (!visiveis.length) {
        container.innerHTML = '<div class="card"><p class="empty-state">Nenhum resumo escolhido. Toque em <strong>Personalizar início</strong> para escolher o que aparece aqui.</p></div>';
        return;
    }

    container.innerHTML = visiveis.map(modulo => `
        <section class="card inicio-cartao" data-modulo="${modulo.id}">
            <div class="inicio-cartao-topo">
                <span class="acc-icon ${modulo.cor}"><i class="${modulo.icone}"></i></span>
                <h3>${escaparHtml(modulo.inicio.titulo || modulo.nome)}</h3>
                <button type="button" class="btn btn-ghost btn-sm inicio-abrir" data-acao="ir-para" data-rota="${modulo.inicio.rota || modulo.id}">Abrir <i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="inicio-cartao-corpo"><div class="esqueleto" aria-label="Carregando"><span></span><span></span><span></span></div></div>
        </section>
    `).join('');

    // Cada cartão carrega por conta própria: um módulo lento ou com erro não segura os outros
    visiveis.forEach(modulo => preencherCartao(modulo, container.querySelector(`[data-modulo="${modulo.id}"]`)));
}

// ===== PERSONALIZAR =====
function abrirPersonalizacao() {
    const htmlLista = () => {
        const { ocultos } = lerPreferencias();
        const cartoes = cartoesDisponiveis();
        return cartoes.map((modulo, i) => `
            <div class="inicio-config-item" data-modulo="${modulo.id}">
                <span class="acc-icon ${modulo.cor}"><i class="${modulo.icone}"></i></span>
                <span class="inicio-config-nome">${escaparHtml(modulo.inicio.titulo || modulo.nome)}</span>
                <button type="button" class="icon-btn" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="icon-btn" data-mover="1" ${i === cartoes.length - 1 ? 'disabled' : ''} aria-label="Descer"><i class="fa-solid fa-arrow-down"></i></button>
                <span class="interruptor">
                    <input type="checkbox" role="switch" ${ocultos.includes(modulo.id) ? '' : 'checked'} aria-label="Mostrar ${escaparHtml(modulo.nome)}">
                    <span class="interruptor-trilho"></span>
                </span>
            </div>
        `).join('');
    };

    const { corpo } = abrirPainel({
        titulo: 'Personalizar início',
        html: `
            <p class="modulos-ajuda">Escolha os resumos que aparecem no início e a ordem deles. Vale só para este aparelho.</p>
            <div id="inicio-config" class="inicio-config">${htmlLista()}</div>
        `,
        aoFechar: renderizarCartoes
    });
    const lista = corpo.querySelector('#inicio-config');

    lista.addEventListener('change', (e) => {
        const id = e.target.closest('[data-modulo]').dataset.modulo;
        const preferencias = lerPreferencias();
        preferencias.ocultos = e.target.checked ? preferencias.ocultos.filter(o => o !== id) : [...new Set([...preferencias.ocultos, id])];
        salvarPreferencias(preferencias);
        renderizarCartoes();
    });

    lista.addEventListener('click', (e) => {
        const botao = e.target.closest('[data-mover]');
        if (!botao) return;
        const id = botao.closest('[data-modulo]').dataset.modulo;
        const ordem = cartoesDisponiveis().map(m => m.id);
        const de = ordem.indexOf(id);
        const para = de + Number(botao.dataset.mover);
        [ordem[de], ordem[para]] = [ordem[para], ordem[de]];
        salvarPreferencias({ ...lerPreferencias(), ordem });
        lista.innerHTML = htmlLista();
        lista.querySelector(`[data-modulo="${id}"] [data-mover="${botao.dataset.mover}"]`)?.focus();
        renderizarCartoes();
    });
}

export default {
    id: 'inicio',
    nome: 'Início',
    descricao: 'Resumo da casa',
    icone: 'fa-solid fa-house',
    cor: 'icon-red',
    global: true,
    semBackend: true,
    abas: [
        { id: 'resumo', titulo: 'Início', icone: 'fa-solid fa-house', html: HTML_PAGINA, aoAbrir: renderizarCartoes }
    ],

    iniciar() {
        registrarAcoes({ 'personalizar-inicio': abrirPersonalizacao });
    }
};
