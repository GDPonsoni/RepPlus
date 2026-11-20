-- Módulo Atas de Reunião. Participantes (ids de integrantes), decisões (textos) e
-- encaminhamentos ({ id, texto, responsavelId, prazo, feito }) ficam em jsonb na própria ata.
-- Pode ser executado mais de uma vez sem efeito colateral.

create table if not exists atas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date not null,
  local text,
  participantes jsonb not null default '[]'::jsonb,
  pauta text,
  conteudo text,
  decisoes jsonb not null default '[]'::jsonb,
  tarefas jsonb not null default '[]'::jsonb,
  -- Reunião da agenda que originou a ata (opcional; some se o evento for apagado)
  evento_id uuid references eventos(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists atas_data_idx on atas (data desc);
