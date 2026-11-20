-- Eventos que se repetem (semanal, quinzenal, mensal, anual).
-- Aplicar (npm run db:migrar) depois de 20261028_moradores_perfil_e_agenda.sql.
-- Pode ser executado mais de uma vez sem efeito colateral.

alter table eventos add column if not exists recorrencia text
  check (recorrencia in ('semanal', 'quinzenal', 'mensal', 'anual'));
-- Último dia em que o evento ainda se repete (null = sem fim)
alter table eventos add column if not exists recorrencia_ate date;
-- Dias (no horário de Brasília) em que uma repetição foi cancelada individualmente
alter table eventos add column if not exists excecoes date[] not null default '{}';

create index if not exists eventos_recorrencia_idx on eventos (recorrencia) where recorrencia is not null;
