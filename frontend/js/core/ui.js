import { movimentoReduzido } from './movimento.js';

// Utilitários de interface compartilhados por todos os módulos

// Escapa texto vindo do banco (nomes, descrições) antes de colocá-lo em innerHTML
export function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

// Iniciais para o avatar (ex.: "Terezinha" -> "TE", "João Pedro" -> "JP")
export function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Valida tamanho/tipo de imagem no cliente antes de enviar (espelha os limites do multer no backend)
const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024;
const EXTENSOES_IMAGEM_PERMITIDAS = /\.(png|jpe?g|webp|gif)$/i;

export function validarArquivoImagem(file) {
    if (!EXTENSOES_IMAGEM_PERMITIDAS.test(file.name)) {
        return 'Tipo de arquivo não permitido. Envie png, jpg, jpeg, webp ou gif.';
    }
    if (file.size > TAMANHO_MAXIMO_IMAGEM) {
        return `Arquivo muito grande (${(file.size / (1024 * 1024)).toFixed(1)}MB). O limite é 5MB.`;
    }
    return null;
}

// Desabilita um botão e mostra texto de carregamento durante requisições (evita cliques duplicados)
export function definirCarregando(botao, carregando, textoCarregando = '⏳ Enviando...') {
    if (!botao) return;
    if (carregando) {
        botao.dataset.htmlOriginal = botao.dataset.htmlOriginal || botao.innerHTML;
        botao.disabled = true;
        botao.textContent = textoCarregando;
    } else {
        botao.disabled = false;
        if (botao.dataset.htmlOriginal) botao.innerHTML = botao.dataset.htmlOriginal;
        delete botao.dataset.htmlOriginal;
    }
}

// ===== NOTIFICAÇÕES =====
// Entram deslizando (de cima no celular, da direita no computador) e, ao sair, o espaço fecha
// devagar para as outras escorregarem para o lugar. A barrinha embaixo mostra o tempo que falta
// (pausa com o mouse em cima ou o dedo segurando); tocar fecha e arrastar para o lado descarta.
const ICONES_NOTIFICACAO = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
};
const MAXIMO_NOTIFICACOES = 3;
const MOLA = 'cubic-bezier(0.34, 1.32, 0.64, 1)';
const SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const noCanto = () => window.matchMedia('(min-width: 640px)').matches;

function fecharNotificacao(toast, direcao) {
    if (toast.classList.contains('saindo')) return;
    toast.classList.add('saindo');
    if (movimentoReduzido()) {
        toast.remove();
        return;
    }
    // 1) desliza para fora  2) o espaço que ocupava se fecha
    const destino = direcao ?? (noCanto() ? 'translateX(110%)' : 'translateY(-60%) scale(0.92)');
    const atual = getComputedStyle(toast).transform;
    toast.animate(
        [{ transform: atual === 'none' ? 'none' : atual, opacity: Number(getComputedStyle(toast).opacity) }, { transform: destino, opacity: 0 }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' }
    ).finished.then(() => toast.animate(
        [{ height: `${toast.offsetHeight}px`, marginBottom: '8px' }, { height: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }],
        { duration: 200, easing: SUAVE, fill: 'forwards' }
    ).finished).then(() => toast.remove());
}

// Arrastar para o lado descarta; um toque simples fecha
function permitirDescartar(toast) {
    let inicioX = null;
    let deslocamento = 0;
    toast.addEventListener('pointerdown', (e) => {
        inicioX = e.clientX;
        deslocamento = 0;
        toast.classList.add('segurando');
    });
    toast.addEventListener('pointermove', (e) => {
        if (inicioX === null) return;
        deslocamento = e.clientX - inicioX;
        if (Math.abs(deslocamento) < 4) return;
        try { toast.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
        toast.style.transform = `translateX(${deslocamento}px)`;
        toast.style.opacity = String(Math.max(0.2, 1 - Math.abs(deslocamento) / 220));
    });
    const soltar = () => {
        if (inicioX === null) return;
        inicioX = null;
        toast.classList.remove('segurando');
        if (Math.abs(deslocamento) > 70) {
            fecharNotificacao(toast, `translateX(${deslocamento > 0 ? 120 : -120}%)`);
        } else if (Math.abs(deslocamento) < 4) {
            fecharNotificacao(toast);
        } else {
            toast.animate([{ transform: toast.style.transform }, { transform: 'none' }], { duration: 260, easing: MOLA });
            toast.style.transform = '';
            toast.style.opacity = '';
        }
    };
    toast.addEventListener('pointerup', soltar);
    toast.addEventListener('pointercancel', soltar);
}

export function mostrarNotificacao(mensagem, tipo = 'info', duracao = 3000) {
    const area = document.getElementById('toast-area');
    const notification = document.createElement('div');
    notification.className = `toast toast-${ICONES_NOTIFICACAO[tipo] ? tipo : 'info'}`;
    notification.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

    const icone = document.createElement('i');
    icone.className = `fa-solid ${ICONES_NOTIFICACAO[tipo] || ICONES_NOTIFICACAO.info}`;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    const tempo = document.createElement('span');
    tempo.className = 'toast-tempo';
    tempo.style.animationDuration = `${duracao}ms`;
    notification.append(icone, texto, tempo);

    area.appendChild(notification);
    permitirDescartar(notification);

    // Muitas de uma vez: as mais antigas saem para não cobrir a tela
    const abertas = [...area.querySelectorAll('.toast:not(.saindo)')];
    abertas.slice(0, Math.max(0, abertas.length - MAXIMO_NOTIFICACOES)).forEach(antiga => fecharNotificacao(antiga));

    if (movimentoReduzido()) {
        setTimeout(() => fecharNotificacao(notification), duracao);
        return;
    }

    // Entrada: abre espaço suave (as outras se acomodam) e a notificação chega com uma molinha
    const altura = notification.offsetHeight;
    notification.animate(
        [{ height: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }, { height: `${altura}px`, marginBottom: '8px' }],
        { duration: 240, easing: SUAVE }
    );
    notification.animate(
        [{ transform: noCanto() ? 'translateX(60%) scale(0.96)' : 'translateY(-70%) scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, easing: MOLA }
    );
    icone.animate([{ transform: 'scale(0.3) rotate(-30deg)' }, { transform: 'none' }], { duration: 420, delay: 120, easing: MOLA, fill: 'backwards' });

    // A barrinha de tempo decide quando fechar (e pausa junto com ela)
    tempo.addEventListener('animationend', () => fecharNotificacao(notification));
}

// ===== ACCORDION (CONFIGURAÇÕES) =====
export function definirAccordionAberto(acc, aberto) {
    acc.classList.toggle('open', aberto);
    acc.querySelector('.acc-header').setAttribute('aria-expanded', String(aberto));
}

export function abrirAccordion(id) {
    definirAccordionAberto(document.getElementById(id), true);
}
