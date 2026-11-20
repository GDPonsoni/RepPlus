-- Cadastro completo de moradores e módulo de agenda.
-- Aplicar (npm run db:migrar) ANTES de publicar o código que usa estes campos.
-- Pode ser executado mais de uma vez sem efeito colateral.

-- ===== Moradores: campos do cadastro =====
alter table integrantes add column if not exists nome_completo text;
alter table integrantes add column if not exists data_nascimento date;
alter table integrantes add column if not exists telefone text;
alter table integrantes add column if not exists email text;
alter table integrantes add column if not exists data_entrada date;
alter table integrantes add column if not exists observacoes text;
-- Documentos: a API só mostra/aceita para quem tem a permissão moradores:documentos
alter table integrantes add column if not exists cpf text;
alter table integrantes add column if not exists rg text;

-- ===== Agenda =====
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  local text,
  categoria text not null default 'geral'
    check (categoria in ('geral', 'festa', 'reuniao', 'visita', 'manutencao')),
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index if not exists eventos_inicio_idx on eventos (inicio);
