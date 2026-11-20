-- Módulo Finanças: contas (manuais ou conectadas via Open Finance), lançamentos, regras de
-- categorização, orçamentos por categoria e divisão de despesas entre moradores.
-- Valores sempre em CENTAVOS (inteiros): saída negativa, entrada positiva.
-- Pode ser executado mais de uma vez sem efeito colateral.

-- Conexões com um provedor de Open Finance (ex.: Pluggy). `externo_id` = id da conexão no provedor.
create table if not exists fin_conexoes (
  id uuid primary key default gen_random_uuid(),
  provedor text not null,
  externo_id text,
  instituicao text,
  status text not null default 'ativa' check (status in ('ativa', 'erro', 'desconectada')),
  erro text,
  ultima_sincronizacao timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists fin_contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  instituicao text,
  tipo text not null default 'corrente'
    check (tipo in ('corrente', 'cartao', 'dinheiro', 'caixinha', 'investimento')),
  cor text not null default '#2563eb',
  reserva boolean not null default false,          -- conta como reserva de emergência
  saldo_inicial bigint not null default 0,         -- contas manuais: saldo = inicial + lançamentos
  saldo_informado bigint,                          -- contas conectadas: saldo que o banco informou
  saldo_informado_em timestamptz,
  conexao_id uuid references fin_conexoes(id) on delete set null,
  externo_id text,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists fin_transacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references fin_contas(id) on delete cascade,
  data date not null,
  descricao text not null,
  valor bigint not null,
  categoria text,
  categoria_manual boolean not null default false,  -- escolhida à mão: as regras não mexem mais
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'importado')),
  externo_id text,                                  -- id no provedor, evita importar duas vezes
  ignorada boolean not null default false,          -- fora das contas (ex.: lançamento duplicado do banco)
  criado_em timestamptz not null default now()
);

create index if not exists fin_transacoes_data_idx on fin_transacoes (data);
create index if not exists fin_transacoes_conta_idx on fin_transacoes (conta_id);
create unique index if not exists fin_transacoes_externo_idx on fin_transacoes (conta_id, externo_id) where externo_id is not null;

-- "Se a descrição contém <termo>, a categoria é <categoria>"
create table if not exists fin_regras (
  id uuid primary key default gen_random_uuid(),
  termo text not null,
  categoria text not null,
  criado_em timestamptz not null default now()
);

-- Limite de gasto por mês em cada categoria
create table if not exists fin_orcamentos (
  categoria text primary key,
  valor_mensal bigint not null check (valor_mensal > 0)
);

-- Despesa paga por um morador e dividida: participantes = [{ integranteId, valor, pago, pagoEm }]
create table if not exists fin_divisoes (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  data date not null,
  valor_total bigint not null check (valor_total > 0),
  pago_por uuid references integrantes(id) on delete set null,
  participantes jsonb not null default '[]'::jsonb,
  transacao_id uuid references fin_transacoes(id) on delete set null,
  categoria text,
  criado_em timestamptz not null default now()
);

create index if not exists fin_divisoes_data_idx on fin_divisoes (data desc);
