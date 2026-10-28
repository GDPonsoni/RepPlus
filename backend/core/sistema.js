import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { listarModulos } from './modulos.js';
import { PAPEIS } from './auth/permissoes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== VERSÃO EM EXECUÇÃO =====
// Na Vercel, o commit vem das variáveis de sistema VERCEL_GIT_*. Localmente, do git.
function lerVersao() {
  if (process.env.VERCEL) {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || null;
    const dono = process.env.VERCEL_GIT_REPO_OWNER;
    const repo = process.env.VERCEL_GIT_REPO_SLUG;
    return {
      ambiente: process.env.VERCEL_ENV || 'vercel',
      sha,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      mensagem: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      autor: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN || null,
      data: null,
      url: sha && dono && repo ? `https://github.com/${dono}/${repo}/commit/${sha}` : null
    };
  }

  try {
    const git = (args) => execSync(`git ${args}`, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const [sha, autor, data, mensagem] = git('log -1 --format=%H%n%an%n%cI%n%s').split('\n');
    return { ambiente: 'local', sha, branch: git('rev-parse --abbrev-ref HEAD'), mensagem, autor, data, url: null };
  } catch {
    return { ambiente: 'local', sha: null, branch: null, mensagem: null, autor: null, data: null, url: null };
  }
}

const VERSAO = lerVersao();

// Informações do sistema: versão em execução e sessão atual (usuário, permissões e módulos ativos)
export default {
  id: 'sistema',
  nome: 'Sistema',
  nucleo: true,
  permissoes: {},

  rotas(router) {
    router.get('/versao', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(VERSAO);
    });

    // O frontend chama esta rota ao abrir para saber quem está usando e o que mostrar
    router.get('/sessao', (req, res) => {
      const { modo, autenticado, usuario, permissoes } = req.contexto;
      res.set('Cache-Control', 'no-store');
      res.json({
        modo,
        autenticado,
        usuario,
        papel: usuario ? { id: usuario.papel, nome: PAPEIS[usuario.papel] || usuario.papel } : null,
        permissoes,
        modulos: listarModulos()
      });
    });
  }
};
