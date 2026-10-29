-- Módulo Lista de Compras. Cada item fica salvo para ser reaproveitado:
-- status 'falta' (acabou), 'acabando' (avisado) ou 'ok' (em casa, fica no catálogo).
-- Pode ser executado mais de uma vez sem efeito colateral.

create table if not exists compras_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'mercado'
    check (categoria in ('mercado', 'limpeza', 'higiene', 'bebidas', 'casa', 'outros')),
  status text not null default 'falta'
    check (status in ('falta', 'acabando', 'ok')),
  quantidade text,
  observacao text,
  pedido_por uuid references integrantes(id) on delete set null,
  pedido_em timestamptz,
  comprado_em timestamptz,
  vezes_comprado integer not null default 0,
  criado_em timestamptz not null default now()
);

-- Nome único ignorando maiúsculas e espaços (a API também compara sem acentos)
create unique index if not exists compras_itens_nome_idx on compras_itens (lower(btrim(nome)));
create index if not exists compras_itens_status_idx on compras_itens (status);
