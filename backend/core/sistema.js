import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { listarModulos, definirModuloAtivo } from './modulos.js';
import { PAPEIS, exigirPermissao } from './auth/permissoes.js';
import { asyncHandler, HttpError } from './http.js';

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

// Informações do sistema: versão em execução, sessão atual e quais módulos estão ligados
export default {
  id: 'sistema',
  nome: 'Sistema',
  nucleo: true,
  permissoes: {
    'modulos:gerenciar': { descricao: 'Ativar e desativar módulos', papeis: [] }
  },

  rotas(router) {
    router.get('/versao', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(VERSAO);
    });

    // O frontend chama esta rota ao abrir para saber quem está usando e o que mostrar
    // `modulos` traz só os ativos: o frontend monta apenas esses
    router.get('/sessao', asyncHandler(async (req, res) => {
      const { modo, autenticado, usuario, permissoes } = req.contexto;
      res.set('Cache-Control', 'no-store');
      res.json({
        modo,
        autenticado,
        usuario,
        papel: usuario ? { id: usuario.papel, nome: PAPEIS[usuario.papel] || usuario.papel } : null,
        permissoes,
        modulos: (await listarModulos()).filter(modulo => modulo.ativo)
      });
    }));

    // Todos os módulos, ativos ou não (para a tela Ajustes > Módulos)
    router.get('/modulos', exigirPermissao('modulos:gerenciar'), asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await listarModulos());
    }));

    router.put('/modulos/:id', exigirPermissao('modulos:gerenciar'), asyncHandler(async (req, res) => {
      const modulo = (await listarModulos()).find(m => m.id === req.params.id);
      if (!modulo) throw new HttpError(404, 'Módulo não encontrado.');
      if (modulo.nucleo) throw new HttpError(400, `${modulo.nome} faz parte do núcleo e não pode ser desativado.`);
      if (typeof req.body?.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo: true ou false.');
      await definirModuloAtivo(modulo.id, req.body.ativo);
      res.json({ ...modulo, ativo: req.body.ativo });
    }));
  }
};
