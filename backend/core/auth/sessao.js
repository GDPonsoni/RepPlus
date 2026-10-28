import { permissoesDoPapel } from './permissoes.js';

// Modo de autenticação, definido pela variável AUTH_MODO:
//   aberto (padrão) — sem login: todo acesso é tratado como admin, como sempre foi o app.
//
// Para ligar o login no futuro, basta criar outro modo aqui (ex.: 'supabase', lendo o token
// "Authorization: Bearer ..." com supabase.auth.getUser e buscando o papel do usuário numa
// tabela de perfis). As rotas não mudam: elas só olham para req.contexto e exigirPermissao().
const AUTH_MODO = process.env.AUTH_MODO || 'aberto';

const resolvedores = {
  async aberto() {
    return { id: null, nome: 'Acesso aberto', papel: 'admin', integranteId: null };
  }
};

if (!resolvedores[AUTH_MODO]) {
  throw new Error(`AUTH_MODO desconhecido: ${AUTH_MODO}. Modos disponíveis: ${Object.keys(resolvedores).join(', ')}`);
}

// Monta req.contexto em toda requisição da API: quem é o usuário e o que ele pode fazer.
// `republicaId` fica reservado para quando o app atender mais de uma república.
export async function carregarContexto(req, res, next) {
  try {
    const usuario = await resolvedores[AUTH_MODO](req);
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
