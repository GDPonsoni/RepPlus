import { aplicarPermissoes } from '../../core/sessao.js';
import { escaparHtml } from '../../core/ui.js';
import { cofreDisponivel, cofreExiste, cofreDestrancado } from './cofre.js';
import { estiloCategoria, categoriasDe } from '../../core/categorias.js';
import { TIPOS, ESCOPO_POR_TIPO, categoriaDaAnotacao, estado, anotacoesDoTipo, decifrarSegredos, semAcento } from './dados.js';

const htmlTopo = (tipo, titulo) => `
    <div class="pagina-topo">
        <h2 class="section-title">${titulo}</h2>
        <button type="button" class="btn btn-primary btn-sm" data-acao="nova-anotacao" data-tipo="${tipo}" data-permissao="anotacoes:editar"><i class="fa-solid fa-plus"></i> ${TIPOS[tipo].novo.split(' ')[0]}</button>
    </div>
    <input type="search" class="anotacoes-busca" data-busca="${tipo}" placeholder="Buscar..." aria-label="Buscar" autocomplete="off">
`;

export const HTML_ABA_SENHAS = `
    ${htmlTopo('conta', 'Senhas e contas')}
    <div id="cofre-barra"></div>
    <div id="anotacoes-conta" class="anotacoes-lista"></div>
`;

export const HTML_ABA_CONTATOS = `
    ${htmlTopo('contato', 'Contatos')}
    <div id="anotacoes-contato" class="anotacoes-lista"></div>
`;

export const HTML_ABA_NOTAS = `
    ${htmlTopo('nota', 'Notas')}
    <div id="cofre-barra-notas"></div>
    <div id="anotacoes-nota" class="anotacoes-lista"></div>
`;

// ===== BARRA DO COFRE =====
function htmlBarraCofre() {
    if (!cofreDisponivel()) {
        return `<div class="cofre-barra cofre-indisponivel"><i class="fa-solid fa-triangle-exclamation"></i>
            <span>O cofre só funciona em conexão segura (https). Abra o app pelo endereço oficial para ver as senhas.</span></div>`;
    }
    if (!cofreExiste()) {
        return `<div class="cofre-barra cofre-novo"><i class="fa-solid fa-vault"></i>
            <span><strong>Crie o cofre da casa</strong> para guardar logins e senhas criptografados.</span>
            <button type="button" class="btn btn-primary btn-sm" data-acao="criar-cofre" data-permissao="anotacoes:cofre">Criar</button></div>`;
    }
    if (!cofreDestrancado()) {
        return `<div class="cofre-barra cofre-trancado"><i class="fa-solid fa-lock"></i>
            <span><strong>Cofre trancado.</strong> Logins e senhas ficam escondidos.</span>
            <button type="button" class="btn btn-primary btn-sm" data-acao="destrancar-cofre"><i class="fa-solid fa-lock-open"></i> Destrancar</button></div>`;
    }
    return `<div class="cofre-barra cofre-aberto"><i class="fa-solid fa-lock-open"></i>
        <span><strong>Cofre aberto</strong> neste aparelho. Tranca sozinho após 10 min parado.</span>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="trancar-cofre"><i class="fa-solid fa-lock"></i> Trancar</button></div>`;
}

// Busca em título, categoria e campos abertos (nunca nos segredos)
function filtrar(tipo) {
    const busca = semAcento(document.querySelector(`[data-busca="${tipo}"]`)?.value.trim());
    return anotacoesDoTipo(tipo).filter(anotacao => !busca ||
        semAcento([anotacao.titulo, anotacao.categoria && categoriaDaAnotacao(anotacao).nome, ...Object.values(anotacao.dados || {})].join(' ')).includes(busca));
}

const vazio = (tipo, filtrado) => `<div class="card"><p class="empty-state">${filtrado ? 'Nada encontrado.' : {
    conta: 'Nenhuma conta salva. Guarde aqui o Wi-Fi, streaming, conta de luz...',
    contato: 'Nenhum contato salvo. Guarde eletricista, encanador, gás, imobiliária...',
    nota: 'Nenhuma nota. Regras da casa, código do portão, onde fica o registro...'
}[tipo]}</p></div>`;

const linkSeguro = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// Linha de um segredo: mascarado, com olho para mostrar e botão para copiar
function htmlSegredo(rotulo, valor, { mascarar = false } = {}) {
    if (!valor) return '';
    return `
        <div class="segredo-linha">
            <span class="segredo-rotulo">${rotulo}</span>
            <span class="segredo-valor ${mascarar ? 'mascarado' : ''}" data-valor="${escaparHtml(valor)}">${mascarar ? '••••••••' : escaparHtml(valor)}</span>
            ${mascarar ? '<button type="button" class="icon-btn" data-acao="mostrar-segredo" aria-label="Mostrar"><i class="fa-solid fa-eye"></i></button>' : ''}
            <button type="button" class="icon-btn" data-acao="copiar-segredo" data-rotulo="${rotulo}" aria-label="Copiar ${rotulo}"><i class="fa-regular fa-copy"></i></button>
        </div>
    `;
}

function htmlSegredosConta(anotacao) {
    if (!anotacao.segredo) return '';
    if (!cofreDestrancado()) {
        return `<button type="button" class="segredo-trancado" data-acao="destrancar-cofre"><i class="fa-solid fa-lock"></i> Login e senha no cofre · toque para destrancar</button>`;
    }
    const segredo = estado.segredos.get(anotacao.id) || {};
    if (segredo.ilegivel) return '<p class="segredo-erro"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível ler este segredo.</p>';
    return `<div class="segredos">
        ${htmlSegredo('Login', segredo.usuario)}
        ${htmlSegredo('Senha', segredo.senha, { mascarar: true })}
        ${segredo.extra ? `<p class="segredo-extra">${escaparHtml(segredo.extra)}</p>` : ''}
    </div>`;
}

// ===== CONTAS =====
async function renderizarContas() {
    const container = document.getElementById('anotacoes-conta');
    if (!container) return;
    document.getElementById('cofre-barra').innerHTML = htmlBarraCofre();
    const contas = filtrar('conta').sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    await decifrarSegredos(contas);

    container.innerHTML = contas.length ? contas.map(anotacao => {
        const categoria = categoriaDaAnotacao(anotacao);
        return `
            <article class="card anotacao-card" style="${estiloCategoria(categoria)}">
                <button type="button" class="anotacao-topo" data-acao="abrir-anotacao" data-id="${escaparHtml(anotacao.id)}">
                    <span class="anotacao-icone"><i class="${categoria.icone}"></i></span>
                    <span class="anotacao-titulos">
                        <span class="anotacao-titulo">${escaparHtml(anotacao.titulo)}</span>
                        <span class="anotacao-sub">${escaparHtml(categoria.nome)}</span>
                    </span>
                    <i class="fa-solid fa-pen anotacao-editar"></i>
                </button>
                ${anotacao.dados.site ? `<a class="anotacao-link" href="${escaparHtml(linkSeguro(anotacao.dados.site))}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escaparHtml(anotacao.dados.site)}</a>` : ''}
                ${htmlSegredosConta(anotacao)}
                ${anotacao.dados.observacao ? `<p class="anotacao-obs">${escaparHtml(anotacao.dados.observacao)}</p>` : ''}
            </article>
        `;
    }).join('') : vazio('conta', anotacoesDoTipo('conta').length);
    aplicarPermissoes(document.getElementById('aba-anotacoes-senhas'));
}

// ===== CONTATOS =====
// Número com DDI para o WhatsApp: (19) 99999-9999 -> 5519999999999
function numeroWhatsapp(telefone) {
    const digitos = String(telefone).replace(/\D/g, '');
    return digitos.length <= 11 ? `55${digitos}` : digitos;
}

function renderizarContatos() {
    const container = document.getElementById('anotacoes-contato');
    if (!container) return;
    const contatos = filtrar('contato');
    if (!contatos.length) {
        container.innerHTML = vazio('contato', anotacoesDoTipo('contato').length);
        return;
    }

    // Agrupados por serviço, na ordem do cadastro de categorias (sem serviço e desconhecidos no fim)
    const ordem = categoriasDe(ESCOPO_POR_TIPO.contato).map(c => c.chave);
    const posicao = (chave) => (ordem.includes(chave) ? ordem.indexOf(chave) : ordem.length + (chave ? 0 : 1));
    const grupos = new Map();
    contatos.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')).forEach(contato => {
        const chave = contato.categoria || '';
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(contato);
    });

    container.innerHTML = [...grupos.entries()].sort(([a], [b]) => posicao(a) - posicao(b) || a.localeCompare(b, 'pt-BR')).map(([chave, lista]) => {
        const servico = categoriaDaAnotacao(lista[0]);
        return `
        <section style="${estiloCategoria(servico)}">
            <h3 class="anotacoes-grupo-titulo"><i class="${servico.icone} anotacoes-grupo-icone"></i> ${escaparHtml(chave ? servico.nome : 'Sem serviço')} <span class="anotacoes-grupo-total">${lista.length}</span></h3>
            <div class="anotacoes-lista">
                ${lista.map(contato => {
                    const { telefone, whatsapp, email, site, endereco, observacao } = contato.dados;
                    return `
                        <article class="card anotacao-card">
                            <button type="button" class="anotacao-topo" data-acao="abrir-anotacao" data-id="${escaparHtml(contato.id)}">
                                <span class="anotacao-icone"><i class="${servico.icone}"></i></span>
                                <span class="anotacao-titulos">
                                    <span class="anotacao-titulo">${escaparHtml(contato.titulo)}</span>
                                    ${telefone ? `<span class="anotacao-sub">${escaparHtml(telefone)}</span>` : ''}
                                </span>
                                <i class="fa-solid fa-pen anotacao-editar"></i>
                            </button>
                            ${telefone || email || site || endereco ? `<div class="contato-acoes">
                                ${telefone ? `<a class="btn btn-ghost btn-sm" href="tel:${escaparHtml(telefone.replace(/[^\d+]/g, ''))}"><i class="fa-solid fa-phone"></i> Ligar</a>` : ''}
                                ${telefone && whatsapp ? `<a class="btn btn-ghost btn-sm btn-whatsapp" href="https://wa.me/${numeroWhatsapp(telefone)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                                ${email ? `<a class="btn btn-ghost btn-sm" href="mailto:${escaparHtml(email)}"><i class="fa-solid fa-envelope"></i> E-mail</a>` : ''}
                                ${site ? `<a class="btn btn-ghost btn-sm" href="${escaparHtml(linkSeguro(site))}" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Site</a>` : ''}
                                ${endereco ? `<a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i> Mapa</a>` : ''}
                            </div>` : ''}
                            ${observacao ? `<p class="anotacao-obs">${escaparHtml(observacao)}</p>` : ''}
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
    }).join('');
}

// ===== NOTAS =====
async function renderizarNotas() {
    const container = document.getElementById('anotacoes-nota');
    if (!container) return;
    const notas = filtrar('nota')
        .sort((a, b) => (b.fixado - a.fixado) || (new Date(b.atualizadoEm) - new Date(a.atualizadoEm)));
    const temSecreta = anotacoesDoTipo('nota').some(nota => nota.segredo);
    document.getElementById('cofre-barra-notas').innerHTML = temSecreta ? htmlBarraCofre() : '';
    await decifrarSegredos(notas);

    container.innerHTML = notas.length ? notas.map(nota => {
        let texto = nota.dados.texto ? `<p class="nota-texto">${escaparHtml(nota.dados.texto)}</p>` : '';
        if (nota.segredo) {
            const segredo = estado.segredos.get(nota.id);
            texto = !cofreDestrancado()
                ? '<button type="button" class="segredo-trancado" data-acao="destrancar-cofre"><i class="fa-solid fa-lock"></i> Nota secreta · toque para destrancar</button>'
                : segredo?.ilegivel ? '<p class="segredo-erro">Não foi possível ler esta nota.</p>'
                    : `<p class="nota-texto">${escaparHtml(segredo?.texto || '')}</p>`;
        }
        return `
            <article class="card anotacao-card nota-card ${nota.fixado ? 'fixada' : ''}">
                <button type="button" class="anotacao-topo" data-acao="abrir-anotacao" data-id="${escaparHtml(nota.id)}">
                    <span class="anotacao-titulos">
                        <span class="anotacao-titulo">${nota.fixado ? '<i class="fa-solid fa-thumbtack nota-fixada"></i> ' : ''}${nota.segredo ? '<i class="fa-solid fa-lock nota-secreta"></i> ' : ''}${escaparHtml(nota.titulo)}</span>
                    </span>
                    <i class="fa-solid fa-pen anotacao-editar"></i>
                </button>
                ${texto}
            </article>
        `;
    }).join('') : vazio('nota', anotacoesDoTipo('nota').length);
}

export async function renderizarTudo() {
    if (!estado.carregado) return;
    renderizarContatos();
    await Promise.all([renderizarContas(), renderizarNotas()]);
}

export function renderizarTipo(tipo) {
    return { conta: renderizarContas, contato: renderizarContatos, nota: renderizarNotas }[tipo]();
}
