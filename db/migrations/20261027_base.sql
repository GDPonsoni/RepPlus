-- Tabelas originais do app (escala de limpeza), anteriores às demais migrações: moradores,
-- cômodos, escalas semanais, infrações e a configuração da república (linha única id = 1).
-- Num banco novo, esta é a primeira migração. As tabelas usam "if not exists"; a função
-- replace_semana_escala é sempre recriada com esta definição.

create table if not exists integrantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  is_suite boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists comodos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  imagem text,
  apenas_suite_members boolean not null default false,
  pessoas_necessarias integer not null default 1,
  permitir_multiplas_atribuicoes boolean not null default false, -- legado: o rodízio não usa mais
  obrigatorio boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

-- Uma linha por morador por semana. O histórico guarda nome do morador e dos cômodos
-- (texto), para continuar legível mesmo depois que o cadastro mudar ou for apagado.
create table if not exists escalas (
  id uuid primary key default gen_random_uuid(),
  ano integer not null,
  semana integer not null,
  integrante_id text,
  integrante_nome text,
  folga boolean not null default false,
  comodos jsonb not null default '[]'::jsonb,
  data_inicio timestamptz,
  data_fim timestamptz,
  alerta text,
  created_at timestamptz not null default now()
);
create index if not exists escalas_ano_semana_idx on escalas (ano, semana);

create table if not exists infracoes (
  id uuid primary key default gen_random_uuid(),
  integrante_id text,
  integrante_nome text,
  descricao text not null,
  data_semana timestamptz,
  data_registro timestamptz not null default now()
);
create index if not exists infracoes_integrante_idx on infracoes (integrante_id);

create table if not exists config (
  id integer primary key default 1 check (id = 1),
  logo text,
  background text,
  motivacao_destaque text,
  cores jsonb not null default '{}'::jsonb
);
insert into config (id) values (1) on conflict (id) do nothing;

-- Troca a escala de uma semana inteira numa transação só. O advisory lock faz duas gerações
-- simultâneas da mesma semana rodarem uma depois da outra, sem duplicar linhas.
create or replace function replace_semana_escala(p_ano integer, p_semana integer, p_linhas jsonb)
returns setof escalas
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('replace_semana_escala'), p_ano * 100 + p_semana);
  delete from escalas where ano = p_ano and semana = p_semana;
  return query
    insert into escalas (id, ano, semana, integrante_id, integrante_nome, folga, comodos, data_inicio, data_fim, alerta)
    select
      coalesce((linha->>'id')::uuid, gen_random_uuid()),
      p_ano,
      p_semana,
      linha->>'integrante_id',
      linha->>'integrante_nome',
      coalesce((linha->>'folga')::boolean, false),
      coalesce(linha->'comodos', '[]'::jsonb),
      (linha->>'data_inicio')::timestamptz,
      (linha->>'data_fim')::timestamptz,
      linha->>'alerta'
    from jsonb_array_elements(p_linhas) as linha
    returning *;
end;
$$;
