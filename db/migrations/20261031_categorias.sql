-- Categorias gerenciáveis (nome, cor e ícone) para agenda, compras e anotações.
-- As categorias padrão são criadas pelo backend na primeira vez que cada grupo é aberto,
-- junto com os valores que já estiverem em uso nos registros.
-- Pode ser executado mais de uma vez sem efeito colateral.

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  escopo text not null,          -- grupo: 'agenda', 'compras', 'anotacoes-contas', 'anotacoes-contatos'
  chave text not null,           -- o que os registros guardam; não muda ao renomear
  nome text not null,
  cor text not null,             -- #rrggbb
  icone text not null,           -- classe do Font Awesome, ex.: 'fa-solid fa-tag'
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (escopo, chave)
);

-- As categorias deixam de ser uma lista fixa no banco: a validação passa a ser feita pela API
alter table eventos drop constraint if exists eventos_categoria_check;
alter table compras_itens drop constraint if exists compras_itens_categoria_check;
