import { api } from './api.js';
import { registrarAcoes } from './acoes.js';
import { mostrarNotificacao, validarArquivoImagem, definirCarregando, escaparHtml } from './ui.js';
import { temPermissao } from './sessao.js';

// Aparência da república (núcleo): nome, logo, fundo, cores e estilo (valem para todos)
// e as preferências deste aparelho (tema claro/escuro e tamanho do texto, no localStorage).
// A configuração é carregada antes dos módulos, pois a tela inteira depende dela.
let config = {};

export function obterConfig() {
    return config;
}

export function atualizarConfig(novaConfig) {
    if (novaConfig) config = novaConfig;
}

const LOGO_PADRAO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="%23FFD700" stroke="%23000" stroke-width="4"/><rect x="40" y="50" width="120" height="100" fill="%23DC0000"/><text x="100" y="130" font-size="80" font-weight="bold" text-anchor="middle" font-family="Arial" fill="%23FFD700">B</text><circle cx="75" cy="75" r="15" fill="%23FFF"/><circle cx="125" cy="75" r="15" fill="%23FFF"/><circle cx="75" cy="80" r="8" fill="%23000"/><circle cx="125" cy="80" r="8" fill="%23000"/></svg>';

const CORES_PADRAO = {
    primaria: '#DC0000',
    secundaria: '#FFD700',
    branca: '#FFFFFF',
    preta: '#000000'
};

// Campos do formulário de cores: chave em config.cores -> id do input
const CAMPOS_COR = { primaria: 'cor-primaria', secundaria: 'cor-secundaria', branca: 'cor-branca', preta: 'cor-preta' };

// Paletas prontas: só preenchem o formulário de cores (é preciso salvar)
const PALETAS = [
    { nome: 'Clássica', cores: CORES_PADRAO },
    { nome: 'Oceano', cores: { primaria: '#0369A1', secundaria: '#38BDF8', branca: '#F8FAFC', preta: '#0F172A' } },
    { nome: 'Floresta', cores: { primaria: '#166534', secundaria: '#FACC15', branca: '#FAFAF9', preta: '#1C1917' } },
    { nome: 'Uva', cores: { primaria: '#7E22CE', secundaria: '#F472B6', branca: '#FFFFFF', preta: '#1E1B4B' } },
    { nome: 'Pôr do sol', cores: { primaria: '#EA580C', secundaria: '#FDE047', branca: '#FFFBF5', preta: '#27272A' } },
    { nome: 'Grafite', cores: { primaria: '#27272A', secundaria: '#F59E0B', branca: '#FAFAFA', preta: '#09090B' } }
];

const PERSONALIZACAO_PADRAO = {
    nome: 'República',
    slogan: 'Organização com responsabilidade! 🏠',
    fonte: 'inter',
    cantos: 'arredondado',
    cabecalho: 'solido',
    cabecalhoTamanho: 'amplo',
    fundoVisibilidade: 14
};

// google = nome da família no Google Fonts (null = já carregada ou fonte do sistema)
const FONTES = {
    inter: { nome: 'Inter', familia: "'Inter', system-ui, sans-serif", google: null },
    poppins: { nome: 'Poppins', familia: "'Poppins', system-ui, sans-serif", google: 'Poppins' },
    nunito: { nome: 'Nunito', familia: "'Nunito', system-ui, sans-serif", google: 'Nunito' },
    'roboto-slab': { nome: 'Roboto Slab', familia: "'Roboto Slab', Georgia, serif", google: 'Roboto+Slab' },
    sistema: { nome: 'Do aparelho', familia: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", google: null }
};

const CANTOS = { reto: 'Retos', suave: 'Suaves', arredondado: 'Arredondados', redondo: 'Bem redondos' };
const CABECALHOS = { solido: 'Cor sólida', degrade: 'Degradê', escuro: 'Escuro' };
const TAMANHOS_CABECALHO = { amplo: 'Amplo, logo grande', compacto: 'Compacto' };

const TEMAS = {
    auto: { nome: 'Automático', icone: 'fa-solid fa-circle-half-stroke' },
    claro: { nome: 'Claro', icone: 'fa-solid fa-sun' },
    escuro: { nome: 'Escuro', icone: 'fa-solid fa-moon' }
};
const TAMANHOS_TEXTO = { normal: { nome: 'Normal', escala: 0.85 }, grande: { nome: 'Grande', escala: 1 }, maior: { nome: 'Maior', escala: 1.15 } };
const CHAVE_APARELHO = 'escala:aparelho';
const ANIMACOES = {
    completas: { nome: 'Completas', icone: 'fa-solid fa-wand-magic-sparkles' },
    reduzidas: { nome: 'Reduzidas', icone: 'fa-solid fa-pause' }
};
const VIBRACAO = {
    sim: { nome: 'Vibrar ao tocar', icone: 'fa-solid fa-mobile-screen-button' },
    nao: { nome: 'Sem vibração', icone: 'fa-solid fa-ban' }
};
const PREFERENCIAS_PADRAO = { tema: 'auto', texto: 'normal', animacoes: 'completas', vibracao: 'sim' };

// Grupo de opções em blocos (radio escondido + amostra visual)
function htmlOpcoes(nome, opcoes, amostra) {
    return `<div class="opcoes-visuais" role="radiogroup">${Object.entries(opcoes).map(([valor, rotulo]) => `
        <label class="opcao-visual">
            <input type="radio" name="${nome}" value="${valor}">
            ${amostra(valor)}
            <span>${escaparHtml(typeof rotulo === 'string' ? rotulo : rotulo.nome)}</span>
        </label>`).join('')}
    </div>`;
}

const HTML_SECAO_IDENTIDADE = `
    <form id="form-personalizacao" class="form-stack">
        <label class="field">Nome da república
            <input type="text" id="pers-nome" maxlength="40" placeholder="República">
        </label>
        <label class="field">Frase do rodapé
            <input type="text" id="pers-slogan" maxlength="80" placeholder="Organização com responsabilidade! 🏠">
        </label>

        <h4 class="form-title">Fonte</h4>
        ${htmlOpcoes('pers-fonte', FONTES, valor => `<span class="opcao-fonte-amostra" style="font-family: ${FONTES[valor].familia}">Aa</span>`)}

        <h4 class="form-title">Cantos</h4>
        ${htmlOpcoes('pers-cantos', CANTOS, valor => `<span class="opcao-cantos-amostra" data-amostra-cantos="${valor}"></span>`)}

        <h4 class="form-title">Cabeçalho</h4>
        ${htmlOpcoes('pers-cabecalho', CABECALHOS, valor => `<span class="opcao-cabecalho-amostra amostra-${valor}"></span>`)}

        <h4 class="form-title">Tamanho do cabeçalho</h4>
        ${htmlOpcoes('pers-cabecalho-tamanho', TAMANHOS_CABECALHO, valor => `<span class="opcao-cabecalho-amostra amostra-tamanho-${valor}"><i></i></span>`)}

        <h4 class="form-title">Imagem de fundo</h4>
        <label class="field">Quanto a imagem aparece (precisa de um fundo enviado em "Logo, Fundo e Cores")
            <span class="campo-faixa">
                <input type="range" id="pers-fundo" min="0" max="60" step="2">
                <output id="pers-fundo-valor" for="pers-fundo"></output>
            </span>
        </label>

        <p class="aviso-previa"><i class="fa-solid fa-eye"></i> As mudanças aparecem na hora como prévia. Salve para valer para todos.</p>
        <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-acao="descartar-personalizacao">Descartar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>
`;

const HTML_SECAO_APARELHO = `
    <form id="form-aparelho" class="form-stack">
        <h4 class="form-title">Tema</h4>
        ${htmlOpcoes('aparelho-tema', TEMAS, valor => `<i class="${TEMAS[valor].icone} opcao-tema-amostra"></i>`)}

        <h4 class="form-title">Tamanho do texto</h4>
        ${htmlOpcoes('aparelho-texto', TAMANHOS_TEXTO, valor => `<span class="opcao-fonte-amostra" style="font-size: ${TAMANHOS_TEXTO[valor].escala}rem">Aa</span>`)}

        <h4 class="form-title">Animações</h4>
        ${htmlOpcoes('aparelho-animacoes', ANIMACOES, valor => `<i class="${ANIMACOES[valor].icone} opcao-tema-amostra"></i>`)}

        <h4 class="form-title">Vibração (celulares Android)</h4>
        ${htmlOpcoes('aparelho-vibracao', VIBRACAO, valor => `<i class="${VIBRACAO[valor].icone} opcao-tema-amostra"></i>`)}

        <p class="aviso-previa"><i class="fa-solid fa-mobile-screen"></i> Vale só para este aparelho e é salvo automaticamente.</p>
    </form>
`;

const HTML_SECAO = `
    <h4 class="form-title">Logo da República</h4>
    <div id="logo-preview" class="image-preview">
        <p class="empty-state">Nenhuma logo definida</p>
    </div>
    <form id="form-logo" class="form-stack">
        <input type="file" id="logo-upload" accept="image/png,image/jpeg" required>
        <button type="submit" class="btn btn-dark">Enviar Logo</button>
    </form>

    <hr class="divider">

    <h4 class="form-title">Fundo da Aplicação</h4>
    <div id="background-preview" class="image-preview">
        <p class="empty-state">Nenhum fundo definido</p>
    </div>
    <form id="form-background" class="form-stack">
        <input type="file" id="background-upload" accept="image/*" required>
        <button type="submit" class="btn btn-dark">Aplicar Fundo</button>
    </form>

    <hr class="divider">

    <h4 class="form-title">Esquema de Cores</h4>
    <form id="form-cores" class="form-stack">
        <div class="paletas" aria-label="Paletas prontas">
            ${PALETAS.map((paleta, i) => `
                <button type="button" class="paleta" data-acao="aplicar-paleta" data-indice="${i}">
                    <span class="paleta-cores">${Object.values(paleta.cores).map(cor => `<span style="background: ${cor}"></span>`).join('')}</span>
                    ${escaparHtml(paleta.nome)}
                </button>`).join('')}
        </div>
        <div class="color-grid">
            <label class="color-group">
                <input type="color" id="cor-primaria" value="#DC0000">
                <span>Primária<input type="text" id="cor-primaria-hex" value="#DC0000" readonly tabindex="-1"></span>
            </label>
            <label class="color-group">
                <input type="color" id="cor-secundaria" value="#FFD700">
                <span>Secundária<input type="text" id="cor-secundaria-hex" value="#FFD700" readonly tabindex="-1"></span>
            </label>
            <label class="color-group">
                <input type="color" id="cor-branca" value="#FFFFFF">
                <span>Clara<input type="text" id="cor-branca-hex" value="#FFFFFF" readonly tabindex="-1"></span>
            </label>
            <label class="color-group">
                <input type="color" id="cor-preta" value="#000000">
                <span>Escura<input type="text" id="cor-preta-hex" value="#000000" readonly tabindex="-1"></span>
            </label>
        </div>
        <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-acao="restaurar-cores">Restaurar Padrão</button>
            <button type="submit" class="btn btn-primary">Salvar Cores</button>
        </div>
    </form>
`;

function preencherCampoCor(chave, valor) {
    document.getElementById(CAMPOS_COR[chave]).value = valor;
    document.getElementById(`${CAMPOS_COR[chave]}-hex`).value = valor;
}

// Busca a configuração e aplica logo, fundo e cores na tela (chamado antes dos módulos iniciarem)
export async function carregarConfig() {
    try {
        config = await api('/config');

        aplicarLogo(config.logo);
        aplicarFundo(config.background);
        aplicarPersonalizacao(config.personalizacao);

        if (config.cores) {
            aplicarCores(config.cores);
        }
    } catch (error) {
        console.error('Erro ao carregar config:', error);
    }
    return config;
}

// Preenche os previews e o formulário de cores (depende da seção de Config já montada)
function preencherFormularios() {
    if (config.logo) {
        document.getElementById('logo-preview').innerHTML = `
            <img src="${config.logo}" alt="Logo da república">
            <p>Logo atual</p>
        `;
    } else {
        document.getElementById('logo-preview').innerHTML = '<p class="empty-state">Nenhuma logo definida</p>';
    }

    if (config.background) {
        document.getElementById('background-preview').innerHTML = `
            <img src="${config.background}" alt="Fundo da aplicação">
            <p>Fundo atual</p>
        `;
    } else {
        document.getElementById('background-preview').innerHTML = '<p class="empty-state">Nenhum fundo definido</p>';
    }

    if (config.cores) {
        Object.keys(CAMPOS_COR).forEach(chave => preencherCampoCor(chave, config.cores[chave] || CORES_PADRAO[chave]));
    }

    preencherPersonalizacao(personalizacaoSalva());
}

function aplicarLogo(logoPath) {
    const logoTop = document.getElementById('logo-top');
    if (logoTop) {
        logoTop.src = logoPath || LOGO_PADRAO;
    }
    aplicarIconeDaGuia(logoPath || LOGO_PADRAO);
}

// Ícone da guia do navegador: o logo recortado em círculo com o anel da cor secundária,
// como no cabeçalho. Se a imagem não puder ser lida no canvas, usa o logo como está.
const CHAVE_FAVICON = 'escala:favicon';

function aplicarIconeDaGuia(src) {
    const link = document.getElementById('favicon');
    if (!link) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        let icone = src;
        try {
            const tamanho = 64;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = tamanho;
            const ctx = canvas.getContext('2d');
            const anel = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim() || '#FFD700';
            ctx.beginPath();
            ctx.arc(32, 32, 32, 0, Math.PI * 2);
            ctx.fillStyle = anel;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(32, 32, 28, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.arc(32, 32, 27, 0, Math.PI * 2);
            ctx.clip();
            // Preenche o círculo como object-fit: cover
            const escala = Math.max(54 / img.width, 54 / img.height);
            const largura = img.width * escala;
            const altura = img.height * escala;
            ctx.drawImage(img, 32 - largura / 2, 32 - altura / 2, largura, altura);
            ctx.restore();
            icone = canvas.toDataURL('image/png');
        } catch { /* imagem de outro domínio sem CORS: fica o logo original */ }
        link.href = icone;
        try { localStorage.setItem(CHAVE_FAVICON, icone); } catch { /* sem armazenamento */ }
    };
    img.onerror = () => { link.href = src; };
    img.src = src;
}

function aplicarFundo(backgroundPath) {
    document.documentElement.style.setProperty('--app-background-image', backgroundPath ? `url("${backgroundPath}")` : 'none');
}

function aplicarCores(cores) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', cores.primaria || '#DC0000');
    root.style.setProperty('--secondary-color', cores.secundaria || '#FFD700');
    // --light-color/--dark-color derivam destas no CSS (o tema escuro as inverte)
    root.style.setProperty('--cor-clara', cores.branca || '#FFFFFF');
    root.style.setProperty('--cor-escura', cores.preta || '#000000');
    root.style.setProperty('--danger-color', cores.primaria || '#DC0000');
    root.style.setProperty('--border-color', cores.primaria || '#DC0000');
    atualizarCorDoNavegador();
}

// Barra do navegador no celular acompanha o cabeçalho
function atualizarCorDoNavegador() {
    const estilos = getComputedStyle(document.documentElement);
    const cor = document.documentElement.dataset.cabecalho === 'escuro'
        ? estilos.getPropertyValue('--cor-escura')
        : estilos.getPropertyValue('--primary-color');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor.trim() || '#DC0000');
}

// ===== NOME E ESTILO (valem para todos) =====
const personalizacaoSalva = () => ({ ...PERSONALIZACAO_PADRAO, ...(config.personalizacao || {}) });

export function nomeDaRepublica() {
    return personalizacaoSalva().nome;
}

function carregarFonteGoogle(id, consulta) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${consulta}&display=swap`;
    document.head.appendChild(link);
}

function aplicarPersonalizacao(dados) {
    const p = { ...PERSONALIZACAO_PADRAO, ...(dados || {}) };
    const root = document.documentElement;
    const fonte = FONTES[p.fonte] || FONTES.inter;

    if (fonte.google) carregarFonteGoogle(`fonte-${p.fonte}`, `family=${fonte.google}:wght@400;500;600;700;800`);
    root.style.setProperty('--fonte', fonte.familia);
    root.style.setProperty('--fundo-veu', `${100 - p.fundoVisibilidade}%`);
    root.dataset.cantos = p.cantos;
    root.dataset.cabecalho = p.cabecalho;
    root.dataset.cabecalhoTamanho = p.cabecalhoTamanho;

    document.getElementById('nome-republica').textContent = p.nome;
    document.getElementById('rodape-texto').textContent = p.slogan ? `${p.nome} · ${p.slogan}` : p.nome;
    document.getElementById('logo-top').alt = `Logo da ${p.nome}`;
    document.title = document.title.includes(' · ') ? `${document.title.split(' · ')[0]} · ${p.nome}` : p.nome;
    atualizarCorDoNavegador();
}

function preencherPersonalizacao(p) {
    const form = document.getElementById('form-personalizacao');
    document.getElementById('pers-nome').value = p.nome;
    document.getElementById('pers-slogan').value = p.slogan;
    form.elements['pers-fonte'].value = p.fonte;
    form.elements['pers-cantos'].value = p.cantos;
    form.elements['pers-cabecalho'].value = p.cabecalho;
    form.elements['pers-cabecalho-tamanho'].value = p.cabecalhoTamanho;
    document.getElementById('pers-fundo').value = p.fundoVisibilidade;
    document.getElementById('pers-fundo-valor').textContent = `${p.fundoVisibilidade}%`;
}

function lerPersonalizacao() {
    const form = document.getElementById('form-personalizacao');
    return {
        nome: document.getElementById('pers-nome').value.trim() || PERSONALIZACAO_PADRAO.nome,
        slogan: document.getElementById('pers-slogan').value.trim(),
        fonte: form.elements['pers-fonte'].value,
        cantos: form.elements['pers-cantos'].value,
        cabecalho: form.elements['pers-cabecalho'].value,
        cabecalhoTamanho: form.elements['pers-cabecalho-tamanho'].value,
        fundoVisibilidade: Number(document.getElementById('pers-fundo').value)
    };
}

// Prévia ao vivo enquanto o formulário muda
function previaPersonalizacao() {
    const dados = lerPersonalizacao();
    document.getElementById('pers-fundo-valor').textContent = `${dados.fundoVisibilidade}%`;
    aplicarPersonalizacao(dados);
}

function descartarPersonalizacao() {
    preencherPersonalizacao(personalizacaoSalva());
    aplicarPersonalizacao(personalizacaoSalva());
    mostrarNotificacao('Alterações descartadas', 'info');
}

async function salvarPersonalizacao(e) {
    e.preventDefault();
    const botao = e.target.querySelector('button[type="submit"]');
    definirCarregando(botao, true);
    try {
        const resultado = await api('/config/personalizacao', { metodo: 'PUT', corpo: lerPersonalizacao() });
        atualizarConfig(resultado.config);
        preencherPersonalizacao(personalizacaoSalva());
        aplicarPersonalizacao(personalizacaoSalva());
        mostrarNotificacao('Personalização salva!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao salvar a personalização', 'error');
    } finally {
        definirCarregando(botao, false);
    }
}

// ===== NESTE APARELHO (localStorage) =====
// O index.html aplica o tema antes de desenhar a tela (evita piscar claro); aqui ficam as mudanças
function lerPreferenciasAparelho() {
    try {
        return { ...PREFERENCIAS_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_APARELHO) || '{}') };
    } catch {
        return { ...PREFERENCIAS_PADRAO };
    }
}

const temaEscuroDoSistema = window.matchMedia('(prefers-color-scheme: dark)');

function aplicarPreferenciasAparelho(prefs) {
    const root = document.documentElement;
    const escuro = prefs.tema === 'escuro' || (prefs.tema === 'auto' && temaEscuroDoSistema.matches);
    root.dataset.tema = escuro ? 'escuro' : 'claro';
    root.dataset.texto = prefs.texto;
    root.dataset.animacoes = prefs.animacoes;
    root.dataset.vibracao = prefs.vibracao;
}

function salvarPreferenciasAparelho() {
    const form = document.getElementById('form-aparelho');
    const prefs = {
        tema: form.elements['aparelho-tema'].value,
        texto: form.elements['aparelho-texto'].value,
        animacoes: form.elements['aparelho-animacoes'].value,
        vibracao: form.elements['aparelho-vibracao'].value
    };
    try { localStorage.setItem(CHAVE_APARELHO, JSON.stringify(prefs)); } catch { /* sem armazenamento: vale até recarregar */ }
    aplicarPreferenciasAparelho(prefs);
}

// Upload de logo ou fundo: mesma sequência para os dois, mudam só os campos
async function enviarImagemConfig(e, { inputId, campoArquivo, rota, chave, aplicar, previewId, alt, sucesso, erroPadrao }) {
    e.preventDefault();

    const file = document.getElementById(inputId).files[0];
    if (!file) {
        mostrarNotificacao(chave === 'logo' ? 'Selecione um arquivo' : 'Selecione uma imagem', 'warning');
        return;
    }

    const erroValidacao = validarArquivoImagem(file);
    if (erroValidacao) {
        mostrarNotificacao(erroValidacao, 'error');
        return;
    }

    const formData = new FormData();
    formData.append(campoArquivo, file);

    const botao = e.target.querySelector('button[type="submit"]');
    definirCarregando(botao, true);

    try {
        const resultado = await api(rota, { metodo: 'POST', formData });
        atualizarConfig(resultado.config);
        aplicar(resultado[chave]);

        document.getElementById(previewId).innerHTML = `
            <img src="${resultado[chave]}" alt="${alt}">
            <p>${sucesso.preview}</p>
        `;

        e.target.reset();
        mostrarNotificacao(sucesso.notificacao, 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || erroPadrao, 'error');
    } finally {
        definirCarregando(botao, false);
    }
}

function uploadLogo(e) {
    return enviarImagemConfig(e, {
        inputId: 'logo-upload', campoArquivo: 'logo', rota: '/config/logo', chave: 'logo',
        aplicar: aplicarLogo, previewId: 'logo-preview', alt: 'Logo da república',
        sucesso: { preview: 'Logo atualizado com sucesso!', notificacao: 'Logo enviado com sucesso!' },
        erroPadrao: 'Erro ao enviar logo'
    });
}

function uploadBackground(e) {
    return enviarImagemConfig(e, {
        inputId: 'background-upload', campoArquivo: 'image', rota: '/config/background', chave: 'background',
        aplicar: aplicarFundo, previewId: 'background-preview', alt: 'Fundo da aplicação',
        sucesso: { preview: 'Fundo atualizado com sucesso!', notificacao: 'Fundo enviado com sucesso!' },
        erroPadrao: 'Erro ao enviar fundo'
    });
}

async function salvarCores(e) {
    e.preventDefault();

    const cores = lerCoresDoFormulario();

    try {
        const resultado = await api('/config/cores', { metodo: 'POST', corpo: { cores } });
        atualizarConfig(resultado.config);
        aplicarCores(cores);
        mostrarNotificacao('Cores salvas com sucesso!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao salvar cores', 'error');
    }
}

function lerCoresDoFormulario() {
    return Object.fromEntries(Object.entries(CAMPOS_COR).map(([chave, id]) => [chave, document.getElementById(id).value]));
}

function aplicarPaleta({ indice }) {
    const paleta = PALETAS[Number(indice)];
    Object.entries(paleta.cores).forEach(([chave, valor]) => preencherCampoCor(chave, valor));
    aplicarCores(paleta.cores);
    mostrarNotificacao(`Prévia da paleta ${paleta.nome}. Salve as cores para manter.`, 'info');
}

function resetarCores() {
    Object.entries(CORES_PADRAO).forEach(([chave, valor]) => preencherCampoCor(chave, valor));
    aplicarCores(CORES_PADRAO);
    mostrarNotificacao('Cores restauradas ao padrão', 'info');
}

export default {
    id: 'configuracao',
    secoesAjustes: [
        { id: 'acc-identidade', titulo: 'Nome e Estilo', icone: 'fa-solid fa-wand-magic-sparkles', cor: 'icon-purple', html: HTML_SECAO_IDENTIDADE, permissao: 'aparencia:gerenciar' },
        { id: 'acc-aparencia', titulo: 'Logo, Fundo e Cores', icone: 'fa-solid fa-palette', cor: 'icon-orange', html: HTML_SECAO, permissao: 'aparencia:gerenciar' },
        { id: 'acc-aparelho', titulo: 'Neste Aparelho', icone: 'fa-solid fa-mobile-screen', cor: 'icon-blue', html: HTML_SECAO_APARELHO }
    ],

    iniciar() {
        document.getElementById('form-logo').addEventListener('submit', uploadLogo);
        document.getElementById('form-background').addEventListener('submit', uploadBackground);
        document.getElementById('form-cores').addEventListener('submit', salvarCores);
        document.getElementById('form-personalizacao').addEventListener('submit', salvarPersonalizacao);
        document.getElementById('form-personalizacao').addEventListener('input', previaPersonalizacao);

        // Seletores de cor: atualiza o hex e mostra a prévia na hora
        Object.values(CAMPOS_COR).forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                document.getElementById(`${id}-hex`).value = e.target.value;
                aplicarCores(lerCoresDoFormulario());
            });
        });

        // Preferências do aparelho: aplicam e salvam na hora; "automático" segue o celular
        const prefs = lerPreferenciasAparelho();
        const formAparelho = document.getElementById('form-aparelho');
        formAparelho.elements['aparelho-tema'].value = prefs.tema;
        formAparelho.elements['aparelho-texto'].value = prefs.texto;
        formAparelho.elements['aparelho-animacoes'].value = prefs.animacoes;
        formAparelho.elements['aparelho-vibracao'].value = prefs.vibracao;
        formAparelho.addEventListener('change', salvarPreferenciasAparelho);
        temaEscuroDoSistema.addEventListener('change', () => aplicarPreferenciasAparelho(lerPreferenciasAparelho()));

        // Amostras das fontes no formulário (só as letras "Aa", bem leve)
        if (temPermissao('aparencia:gerenciar')) {
            const familias = Object.values(FONTES).filter(f => f.google).map(f => `family=${f.google}:wght@700`).join('&');
            carregarFonteGoogle('fonte-amostras', `${familias}&text=Aa`);
        }

        registrarAcoes({
            'restaurar-cores': resetarCores,
            'aplicar-paleta': aplicarPaleta,
            'descartar-personalizacao': descartarPersonalizacao
        });
        preencherFormularios();
    }
};
