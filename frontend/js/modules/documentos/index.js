import { registrarAcoes } from '../../core/acoes.js';
import { ouvir } from '../../core/eventos.js';
import { mostrarNotificacao } from '../../core/ui.js';
import { carregarCategorias } from '../../core/categorias.js';
import { estado, carregarDocumentos } from './dados.js';
import { HTML_ABA_MURAL, renderizarMural, abrirDocumento, abrirFormularioDocumento } from './mural.js';
import {
    HTML_ABA_DRIVE, abrirPastaDrive, recarregarDrive, abrirArquivoDrive, ligarFalhaDeMiniatura,
    abrirEscolhaDePasta, usarPasta, cancelarEscolha, desconectar, avisarRetornoDoLogin
} from './drive.js';

async function recarregarMural() {
    try {
        await carregarDocumentos();
        renderizarMural();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(error.message || 'Erro ao carregar os documentos', 'error');
    }
}

// Módulo: documentos da casa (mural de fotos e PDFs + pasta do Google Drive)
export default {
    id: 'documentos',
    nome: 'Documentos',
    nomeCurto: 'Docs',
    descricao: 'Mural de arquivos e Drive da rep',
    icone: 'fa-solid fa-folder-open',
    cor: 'icon-orange',
    abas: [
        { id: 'mural', titulo: 'Mural', icone: 'fa-solid fa-thumbtack', html: HTML_ABA_MURAL, permissao: 'documentos:ver', aoAbrir: recarregarMural },
        { id: 'drive', titulo: 'Drive', icone: 'fa-brands fa-google-drive', html: HTML_ABA_DRIVE, permissao: 'documentos:ver', aoAbrir: recarregarDrive }
    ],

    async iniciar() {
        document.getElementById('docs-busca')?.addEventListener('input', renderizarMural);
        document.getElementById('docs-filtro')?.addEventListener('change', (e) => {
            estado.filtro = e.target.value;
            renderizarMural();
        });
        ligarFalhaDeMiniatura();

        registrarAcoes({
            'enviar-documento': () => abrirFormularioDocumento(),
            'abrir-documento': ({ id }) => abrirDocumento(id),
            'drive-pasta': ({ id }) => abrirPastaDrive(id),
            'drive-arquivo': ({ id }) => abrirArquivoDrive(id),
            'drive-escolha': ({ id, nome }) => abrirEscolhaDePasta(id, nome),
            'drive-escolha-inicio': ({ id, nome }) => abrirEscolhaDePasta(id, nome, { reiniciar: true }),
            'drive-trocar-pasta': () => abrirEscolhaDePasta('root', 'Meu Drive', { reiniciar: true }),
            'drive-usar-pasta': ({ id }) => usarPasta(id),
            'drive-escolha-cancelar': () => cancelarEscolha(),
            'drive-desconectar': () => desconectar()
        });
        avisarRetornoDoLogin();

        // Categoria renomeada ou com outra cor: redesenha o mural
        ouvir('categorias:atualizadas', ({ escopo } = {}) => {
            if (escopo === 'documentos') renderizarMural();
        });

        await carregarCategorias('documentos');
    }
};
