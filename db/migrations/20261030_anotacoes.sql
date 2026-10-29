-- Módulo Anotações: contas/senhas, contatos de prestadores e notas da casa.
-- Os campos sigilosos (`segredo`) chegam já cifrados pelo navegador com a chave do cofre;
-- o banco nunca guarda senha em texto puro. Pode ser executado mais de uma vez.

create table if not exists anotacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('conta', 'contato', 'nota')),
  titulo text not null,
  categoria text,
  dados jsonb not null default '{}'::jsonb,
  segredo text,
  fixado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists anotacoes_tipo_idx on anotacoes (tipo);

-- Cofre (linha única): chave dos segredos cifrada com a senha do cofre (PBKDF2 + AES-GCM)
create table if not exists anotacoes_cofre (
  id integer primary key default 1 check (id = 1),
  salt text not null,
  iteracoes integer not null,
  chave_cifrada text not null,
  verificador_hash text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
