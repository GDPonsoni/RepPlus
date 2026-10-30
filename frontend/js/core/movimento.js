// Movimento e retorno ao toque: pequenas animações que dão vida ao app sem atrapalhar.
// Tudo respeita o "reduzir movimento" do sistema e as opções de Ajustes > Neste aparelho
// (data-animacoes e data-vibracao no <html>, aplicados pelo index.html e por aparencia.js).

const reduzirDoSistema = window.matchMedia('(prefers-reduced-motion: reduce)');

export const movimentoReduzido = () =>
    document.documentElement.dataset.animacoes === 'reduzidas' || reduzirDoSistema.matches;

// Vibração curtinha de confirmação (só Android; no iPhone e no computador não faz nada)
export function vibrar(padrao = 10) {
    if (document.documentElement.dataset.vibracao === 'nao') return;
    try { navigator.vibrate?.(padrao); } catch { /* navegador sem suporte */ }
}

const esperar = (ms) => new Promise(resolver => setTimeout(resolver, ms));

// Aplica uma classe de animação de saída e espera ela terminar (ou o tempo limite).
// Uso: await animarSaida(elementos, 'saindo-comprado'), antes de redesenhar a lista.
export async function animarSaida(elementos, classe, limite = 450) {
    const lista = [...(elementos?.length !== undefined ? elementos : [elementos])].filter(Boolean);
    if (!lista.length || movimentoReduzido()) return;
    lista.forEach(el => el.classList.add(classe));
    await esperar(limite);
}

// Conta de 0 até o valor (números do topo das telas). `formatar` recebe o número atual.
export function contarAte(elemento, valor, formatar = String, duracao = 700) {
    if (!elemento) return;
    if (movimentoReduzido() || !valor) {
        elemento.textContent = formatar(valor);
        return;
    }
    const inicio = performance.now();
    const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        const suave = 1 - Math.pow(1 - t, 3);
        elemento.textContent = formatar(t < 1 ? Math.round(valor * suave) : valor);
        if (t < 1 && elemento.isConnected) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
}

// Chacoalha um elemento (ex.: o sino quando chega aviso novo)
export function chacoalhar(elemento) {
    if (!elemento || movimentoReduzido()) return;
    elemento.classList.remove('chacoalhando');
    void elemento.offsetWidth;
    elemento.classList.add('chacoalhando');
    elemento.addEventListener('animationend', () => elemento.classList.remove('chacoalhando'), { once: true });
}

// Confete curtinho para conquistas (lista de compras zerada, contas acertadas).
// Sai do elemento de origem, ou do centro da tela.
const CORES_CONFETE = ['var(--primary-color)', 'var(--secondary-color)', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];

export function comemorar(origem) {
    vibrar([12, 40, 12]);
    if (movimentoReduzido()) return;
    const caixa = origem?.getBoundingClientRect?.();
    const x = caixa ? caixa.left + caixa.width / 2 : innerWidth / 2;
    const y = caixa ? caixa.top + caixa.height / 2 : innerHeight / 2;

    const camada = document.createElement('div');
    camada.className = 'confete';
    camada.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 36; i++) {
        const pedaco = document.createElement('i');
        const angulo = Math.random() * Math.PI * 2;
        const distancia = 70 + Math.random() * 110;
        pedaco.style.cssText = `
            left: ${x}px; top: ${y}px;
            background: ${CORES_CONFETE[i % CORES_CONFETE.length]};
            --dx: ${Math.cos(angulo) * distancia}px;
            --dy: ${Math.sin(angulo) * distancia - 60}px;
            --giro: ${Math.round(Math.random() * 720 - 360)}deg;
            animation-delay: ${Math.random() * 80}ms;
            ${i % 3 === 0 ? 'border-radius: 50%;' : ''}`;
        camada.appendChild(pedaco);
    }
    document.body.appendChild(camada);
    setTimeout(() => camada.remove(), 1400);
}

// ===== RETORNO AO TOQUE EM TODO O APP =====
// Vibração leve na navegação (barra inferior, abas e menu); o "afundar" ao toque é só CSS (:active).
document.addEventListener('click', (evento) => {
    if (evento.target.closest('.nav-inferior-item, .tab-btn, .modulo-bloco')) vibrar(8);
});

// Painel no celular: arrastar a barra do topo para baixo fecha (como os apps nativos).
// Recebe o cartão do painel e a função de fechar (usado por core/painel.js).
export function permitirArrastarParaFechar(cartao, fechar) {
    const alca = cartao.querySelector('.painel-topo');
    if (!alca) return;
    let inicioY = null;
    let inicioT = 0;
    let deslocamento = 0;

    alca.addEventListener('pointerdown', (e) => {
        // Só no formato "de baixo para cima" (celular) e fora do botão de fechar
        if (e.pointerType === 'mouse' || e.target.closest('button') || innerWidth >= 640) return;
        inicioY = e.clientY;
        inicioT = performance.now();
        deslocamento = 0;
        cartao.style.transition = 'none';
        try { alca.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
    });
    alca.addEventListener('pointermove', (e) => {
        if (inicioY === null) return;
        deslocamento = Math.max(0, e.clientY - inicioY);
        cartao.style.transform = `translateY(${deslocamento}px)`;
    });
    const soltar = () => {
        if (inicioY === null) return;
        const velocidade = deslocamento / Math.max(1, performance.now() - inicioT);
        inicioY = null;
        cartao.style.transition = '';
        if (deslocamento > 110 || (deslocamento > 30 && velocidade > 0.6)) {
            cartao.style.transform = 'translateY(100%)';
            vibrar(8);
            fechar();
        } else {
            cartao.style.transform = '';
        }
    };
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);
}
