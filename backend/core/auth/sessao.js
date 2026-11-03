import { permissoesDoPapel } from './permissoes.js';
import { conferirConfiguracao, sessaoValida } from './senha.js';

// Modo de autenticação, definido pela variável AUTH_MODO:
//   aberto (padrão) — sem login: todo acesso é tratado como admin, como sempre foi o app.
//   senha           — senha única da casa (SENHA_CASA); quem entra é admin. Veja auth/senha.js.
//
// Para um login por morador no futuro, crie outro modo aqui (ex.: conferindo a sessão numa
// tabela própria e buscando o papel do usuário numa tabela de perfis). As rotas não mudam:
// elas só olham para req.contexto e exigirPermissao().
export const AUTH_MODO = process.env.AUTH_MODO || 'aberto';

const resolvedores = {
  async aberto() {
    return { id: null, nome: 'Acesso aberto', papel: 'admin', integranteId: null };
  },
  async senha(req) {
    return sessaoValida(req) ? { id: null, nome: 'Moradores', papel: 'admin', integranteId: null } : null;
  }
};

if (!resolvedores[AUTH_MODO]) {
  throw new Error(`AUTH_MODO desconhecido: ${AUTH_MODO}. Modos disponíveis: ${Object.keys(resolvedores).join(', ')}`);
}
if (AUTH_MODO === 'senha') conferirConfiguracao();

// Rotas que respondem sem login: entrar/sair, a verificação de saúde do Render e o agendador
// das finanças (que confere o CRON_SECRET na própria rota)
const ROTAS_LIVRES = new Set(['/versao', '/financas/sincronizar']);

// Monta req.contexto em toda requisição da API: quem é o usuário e o que ele pode fazer.
// Num modo com login, quem não entrou só recebe 401 (o frontend mostra a tela de entrada).
// `republicaId` fica reservado para quando o app atender mais de uma república.
export async function carregarContexto(req, res, next) {
  try {
    const usuario = await resolvedores[AUTH_MODO](req);
    if (!usuario && !ROTAS_LIVRES.has(req.path)) {
      return res.status(401).json({ error: 'Entre com a senha da casa.' });
    }
    req.contexto = {
      modo: AUTH_MODO,
      autenticado: AUTH_MODO !== 'aberto' && Boolean(usuario),
      usuario,
      republicaId: null,
      permissoes: usuario ? permissoesDoPapel(usuario.papel) : []
    };
    next();
  } catch (err) {
    next(err);
  }
}
