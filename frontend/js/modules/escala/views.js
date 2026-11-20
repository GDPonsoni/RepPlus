// HTML das abas e das seções de configuração do módulo de escala

export const HTML_ABA_ESCALA = `
    <div class="escala-topo">
        <div class="semana-card">
            <div class="semana-card-icon"><i class="fa-regular fa-calendar"></i></div>
            <div>
                <span id="semana-titulo" class="semana-titulo">Carregando...</span>
                <span id="semana-datas" class="semana-datas"></span>
            </div>
        </div>
        <button class="btn btn-primary btn-lg" id="btn-gerar-escala" data-permissao="escala:gerar">
            <i class="fa-solid fa-arrows-rotate"></i> Gerar Nova Escala
        </button>
    </div>

    <div id="criticas-escala-container" class="criticas-escala-container"></div>

    <div id="escala-container">
        <!-- Preenchido dinamicamente (inclui a imagem de motivação da semana) -->
    </div>
`;

export const HTML_ABA_HISTORICO = `
    <h2 class="section-title">Semanas Anteriores</h2>
    <div id="historico-container" class="historico-list">
        <!-- Preenchido dinamicamente -->
    </div>
`;

export const HTML_ABA_INFRACOES = `
    <h2 class="section-title">Quadro de Infrações</h2>
    <p class="section-help">Toque em um integrante para ver e remover as infrações.</p>

    <div id="infracoes-resumo-container" class="card resumo-container">
        <!-- Preenchido dinamicamente -->
    </div>

    <div class="card card-padded" data-permissao="infracoes:registrar">
        <h3 class="card-title"><i class="fa-solid fa-plus"></i> Registrar Nova Infração</h3>
        <form id="form-infracao" class="form-stack">
            <select id="infracao-integrante" required>
                <option value="">Selecione o integrante...</option>
            </select>
            <textarea id="infracao-descricao" placeholder="Motivo da infração..." required></textarea>
            <button type="submit" class="btn btn-secondary-color">Registrar Infração</button>
        </form>
    </div>
`;

export const HTML_SECAO_COMODOS = `
    <div id="comodos-list" class="item-list">
        <!-- Preenchido dinamicamente -->
    </div>
    <form id="form-comodo" class="form-stack form-divider" data-permissao="comodos:gerenciar">
        <h4 class="form-title" id="comodo-form-titulo">Novo cômodo/tarefa</h4>
        <input type="hidden" id="comodo-id">
        <input type="text" id="comodo-nome" placeholder="Nome do cômodo/tarefa" required>
        <div class="check-row">
            <label class="checkbox-label"><input type="checkbox" id="comodo-suite"> Apenas suíte?</label>
            <label class="checkbox-label"><input type="checkbox" id="comodo-obrigatorio" checked> Obrigatório?</label>
        </div>
        <div class="field-row">
            <label class="field">
                <span>Quantas pessoas?</span>
                <input type="number" id="comodo-pessoas" min="1" max="5" value="1" inputmode="numeric">
            </label>
            <label class="field">
                <span>Ordem na rotação</span>
                <input type="number" id="comodo-ordem" min="0" step="1" value="0" inputmode="numeric">
            </label>
        </div>
        <div class="upload-section">
            <label for="comodo-imagem" class="upload-drop upload-drop-sm">
                <i class="fa-solid fa-camera"></i>
                <span>Foto do cômodo (opcional)</span>
            </label>
            <input type="file" id="comodo-imagem" accept="image/*" class="visually-hidden">
            <span id="upload-status" class="upload-status"></span>
            <div id="comodo-imagem-preview" class="image-preview"></div>
            <button type="button" id="btn-comodo-imagem-remover" class="btn btn-ghost btn-sm" style="display:none;"><i class="fa-solid fa-trash"></i> Remover imagem</button>
        </div>
        <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="btn-comodo-cancel" style="display:none;">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-comodo-submit">Adicionar Cômodo</button>
        </div>
    </form>
`;

export const HTML_SECAO_GALERIA = `
    <form id="form-motivacao" class="form-stack">
        <label for="motivacao-imagem" class="upload-drop">
            <i class="fa-solid fa-upload"></i>
            <span id="motivacao-imagem-nome">Toque para selecionar uma imagem</span>
        </label>
        <input type="file" id="motivacao-imagem" accept="image/*" class="visually-hidden" required>
        <label class="checkbox-label">
            <input type="checkbox" id="motivacao-definir-destaque" checked>
            Usar como imagem em destaque na escala
        </label>
        <button type="submit" class="btn btn-primary">Enviar Imagem</button>
    </form>
    <p class="config-help">Toque em <strong>Destacar</strong> para mostrar a imagem na escala da semana.</p>
    <div id="motivacao-admin-galeria" class="motivacao-admin-galeria">
        <!-- Preenchido dinamicamente -->
    </div>
`;
