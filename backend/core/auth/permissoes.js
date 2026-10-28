// Catálogo de permissões do sistema.
//
// Cada módulo declara as permissões que usa e quais papéis as recebem por padrão
// (veja `permissoes` em modules/*/index.js). O papel `admin` sempre pode tudo.
// Quando existir login, o papel de cada usuário virá do banco; até lá, todo acesso
// é tratado como admin (veja core/auth/sessao.js).

export const PAPEIS = {
  admin: 'Administrador',
  morador: 'Morador'
};

const catalogo = new Map(); // chave -> { descricao, papeis, modulo }

export function registrarPermissoes(moduloId, permissoes = {}) {
  for (const [chave, { descricao, papeis = [] }] of Object.entries(permissoes)) {
    if (catalogo.has(chave)) {
      throw new Error(`Permissão duplicada: ${chave} (módulos ${catalogo.get(chave).modulo} e ${moduloId})`);
    }
    catalogo.set(chave, { descricao, papeis, modulo: moduloId });
  }
}

export function listarPermissoes() {
  return [...catalogo.entries()].map(([chave, dados]) => ({ chave, ...dados }));
}

export function permissoesDoPapel(papel) {
  if (papel === 'admin') return ['*'];
  return listarPermissoes().filter(p => p.papeis.includes(papel)).map(p => p.chave);
}

export function temPermissao(contexto, chave) {
  const permissoes = contexto?.permissoes || [];
  return permissoes.includes('*') || permissoes.includes(chave);
}

// Middleware de rota: `router.post('/escala/gerar', exigirPermissao('escala:gerar'), ...)`
export const exigirPermissao = (chave) => {
  if (!catalogo.has(chave)) {
    // Falha cedo (na subida do servidor) se a rota usa uma permissão que nenhum módulo declarou
    throw new Error(`Permissão não declarada em nenhum módulo: ${chave}`);
  }
  return (req, res, next) => {
    if (temPermissao(req.contexto, chave)) return next();
    if (!req.contexto?.autenticado) {
      return res.status(401).json({ error: 'Faça login para continuar.' });
    }
    return res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
  };
};
