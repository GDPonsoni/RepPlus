import { api } from './api.js';
import { registrarAcoes } from './acoes.js';
import { mostrarNotificacao, validarArquivoImagem, definirCarregando } from './ui.js';

// Aparência da república (núcleo): logo, fundo e esquema de cores.
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
}

function aplicarLogo(logoPath) {
    const logoTop = document.getElementById('logo-top');
    if (logoTop) {
        logoTop.src = logoPath || LOGO_PADRAO;
    }
}

function aplicarFundo(backgroundPath) {
    document.documentElement.style.setProperty('--app-background-image', backgroundPath ? `url("${backgroundPath}")` : 'none');
}

function aplicarCores(cores) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', cores.primaria || '#DC0000');
    root.style.setProperty('--secondary-color', cores.secundaria || '#FFD700');
    root.style.setProperty('--light-color', cores.branca || '#FFFFFF');
    root.style.setProperty('--dark-color', cores.preta || '#000000');
    root.style.setProperty('--danger-color', cores.primaria || '#DC0000');
    root.style.setProperty('--border-color', cores.primaria || '#DC0000');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cores.primaria || '#DC0000');
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

    const cores = Object.fromEntries(
        Object.entries(CAMPOS_COR).map(([chave, id]) => [chave, document.getElementById(id).value])
    );

    try {
        await api('/config/cores', { metodo: 'POST', corpo: { cores } });
        aplicarCores(cores);
        mostrarNotificacao('Cores salvas com sucesso!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao salvar cores', 'error');
    }
}

function resetarCores() {
    Object.entries(CORES_PADRAO).forEach(([chave, valor]) => preencherCampoCor(chave, valor));
    aplicarCores(CORES_PADRAO);
    mostrarNotificacao('Cores restauradas ao padrão', 'info');
}

export default {
    id: 'configuracao',
    secoesAjustes: [
        { id: 'acc-aparencia', titulo: 'Aparência e Logo', icone: 'fa-solid fa-palette', cor: 'icon-orange', html: HTML_SECAO, permissao: 'aparencia:gerenciar' }
    ],

    iniciar() {
        document.getElementById('form-logo').addEventListener('submit', uploadLogo);
        document.getElementById('form-background').addEventListener('submit', uploadBackground);
        document.getElementById('form-cores').addEventListener('submit', salvarCores);

        // Seletores de cor (para atualizar display de hex)
        Object.values(CAMPOS_COR).forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                document.getElementById(`${id}-hex`).value = e.target.value;
            });
        });

        registrarAcoes({ 'restaurar-cores': resetarCores });
        preencherFormularios();
    }
};
