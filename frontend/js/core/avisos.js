import { registrarAcoes } from './acoes.js';
import { abrirPainel } from './painel.js';
import { escaparHtml } from './ui.js';
import { temPermissao } from './sessao.js';
import { navegar } from './shell.js';
import { chacoalhar } from './movimento.js';

// Avisos do sino (canto superior direito). Cada módulo pode exportar:
//   avisos: async () => [{ id, texto, icone?, tipo?: 'alerta' | 'info', rota? }]
// O `id` deve ser estável (ex.: 'atas:atrasada:<id da tarefa>'): o contador mostra só os avisos
// que esta pessoa ainda não viu; abrir o sino marca todos como vistos (neste aparelho).

const CHAVE_VISTOS = 'escala:avisos-vistos';
const ATUALIZAR_A_CADA_MS = 5 * 60 * 1000;

let modulos = [];
let avisos = [];

export function definirModulosDosAvisos(ativos) {
    // Só módulos com alguma aba que a pessoa pode ver
    modulos = ativos.filter(modulo => modulo.avisos && (modulo.abas || []).some(aba => !aba.permissao || temPermissao(aba.permissao)));
}

function lerVistos() {
    try { return new Set(JSON.parse(localStorage.getItem(CHAVE_VISTOS) || '[]')); } catch { return new Set(); }
}

function salvarVistos(ids) {
    // Guarda só os avisos que ainda existem, para a lista não crescer para sempre
    try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...ids])); } catch { /* sem armazenamento */ }
}

function atualizarContador() {
    const vistos = lerVistos();
    const novos = avisos.filter(aviso => !vistos.has(aviso.id)).length;
    const contador = document.getElementById('avisos-contador');
    // Chegou aviso novo: o sino dá uma balançada (uma vez, sem insistir)
    if (novos > (Number(contador.dataset.total) || 0)) chacoalhar(contador.closest('button'));
    contador.dataset.total = novos;
    contador.hidden = novos === 0;
    contador.textContent = novos > 9 ? '9+' : String(novos);
    contador.closest('button').setAttribute('aria-label', novos ? `Avisos (${novos} novos)` : 'Avisos');
}

// Busca os avisos de todos os módulos; um módulo com erro não impede os outros
export async function carregarAvisos() {
    const resultados = await Promise.allSettled(modulos.map(async modulo =>
        (await modulo.avisos()).map(aviso => ({ ...aviso, modulo }))));
    avisos = resultados.flatMap((resultado, i) => {
        if (resultado.status === 'fulfilled') return resultado.value;
        console.error(`Erro nos avisos de ${modulos[i].id}:`, resultado.reason);
        return [];
    }).sort((a, b) => (a.tipo === 'alerta' ? 0 : 1) - (b.tipo === 'alerta' ? 0 : 1));
    atualizarContador();
    return avisos;
}

async function abrirAvisos() {
    const { corpo, fechar } = abrirPainel({
        titulo: 'Avisos',
        classe: 'painel-canto painel-avisos',
        html: '<div class="esqueleto" aria-label="Carregando"><span></span><span></span><span></span></div>'
    });
    await carregarAvisos();
    const vistos = lerVistos();

    corpo.innerHTML = avisos.length
        ? `<ul class="avisos-lista">${avisos.map((aviso, i) => `
            <li>
                <button type="button" class="aviso aviso-${aviso.tipo || 'info'} ${vistos.has(aviso.id) ? '' : 'novo'}" data-indice="${i}">
                    <span class="acc-icon ${aviso.modulo.cor}"><i class="${aviso.icone || aviso.modulo.icone}"></i></span>
                    <span class="aviso-texto">
                        <span>${escaparHtml(aviso.texto)}</span>
                        <small>${escaparHtml(aviso.modulo.nome)}</small>
                    </span>
                    ${vistos.has(aviso.id) ? '' : '<span class="aviso-ponto" aria-label="novo"></span>'}
                </button>
            </li>`).join('')}
        </ul>`
        : '<div class="avisos-vazio"><i class="fa-regular fa-bell"></i><p>Nenhum aviso agora.</p></div>';

    corpo.querySelectorAll('.aviso').forEach(botao => {
        botao.addEventListener('click', () => {
            const aviso = avisos[Number(botao.dataset.indice)];
            fechar();
            navegar(aviso.rota || aviso.modulo.id);
        });
    });

    salvarVistos(avisos.map(aviso => aviso.id));
    atualizarContador();
}

export function iniciarAvisos() {
    registrarAcoes({ 'abrir-avisos': abrirAvisos });
    carregarAvisos();
    setInterval(carregarAvisos, ATUALIZAR_A_CADA_MS);
}
