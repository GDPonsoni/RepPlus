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
const ICONES_NOTIFICACAO = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
};

export function mostrarNotificacao(mensagem, tipo = 'info', duracao = 3000) {
    const area = document.getElementById('toast-area');
    const notification = document.createElement('div');
    notification.className = `toast toast-${ICONES_NOTIFICACAO[tipo] ? tipo : 'info'}`;
    notification.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

    const icone = document.createElement('i');
    icone.className = `fa-solid ${ICONES_NOTIFICACAO[tipo] || ICONES_NOTIFICACAO.info}`;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    notification.append(icone, texto);

    area.appendChild(notification);

    const fechar = () => {
        notification.classList.add('saindo');
        setTimeout(() => notification.remove(), 250);
    };
    notification.addEventListener('click', fechar);
    setTimeout(fechar, duracao);
}

// ===== ACCORDION (CONFIGURAÇÕES) =====
export function definirAccordionAberto(acc, aberto) {
    acc.classList.toggle('open', aberto);
    acc.querySelector('.acc-header').setAttribute('aria-expanded', String(aberto));
}

export function abrirAccordion(id) {
    definirAccordionAberto(document.getElementById(id), true);
}
