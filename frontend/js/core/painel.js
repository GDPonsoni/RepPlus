import { escaparHtml } from './ui.js';

// Painel deslizante (bottom sheet no celular, janela centralizada no computador) para
// formulários e listas. Uso:
//   const { corpo, fechar } = abrirPainel({ titulo: 'Novo evento', html: '<form>...</form>' });
// `aoFechar` é chamado quando o painel fecha por qualquer motivo (botão, Esc, toque fora).
export function abrirPainel({ titulo, html, classe = '', aoFechar } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    overlay.innerHTML = `
        <div class="app-modal-card painel ${classe}" role="dialog" aria-modal="true" aria-label="${escaparHtml(titulo)}">
            <div class="painel-topo">
                <h3 class="app-modal-title">${escaparHtml(titulo)}</h3>
                <button type="button" class="icon-btn painel-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="painel-corpo">${html}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('com-painel');
    requestAnimationFrame(() => overlay.classList.add('visible'));

    let aberto = true;
    const fechar = () => {
        if (!aberto) return;
        aberto = false;
        document.removeEventListener('keydown', onKeydown);
        overlay.classList.remove('visible');
        if (!document.querySelectorAll('.app-modal-overlay.visible').length) document.body.classList.remove('com-painel');
        setTimeout(() => overlay.remove(), 150);
        aoFechar?.();
    };
    const onKeydown = (e) => {
        // Esc fecha só o painel do topo (uma confirmação aberta por cima tem prioridade)
        if (e.key === 'Escape' && overlay === [...document.querySelectorAll('.app-modal-overlay')].pop()) fechar();
    };

    overlay.querySelector('.painel-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fechar();
    });
    document.addEventListener('keydown', onKeydown);

    const corpo = overlay.querySelector('.painel-corpo');
    return { corpo, fechar };
}
