-- Regras de categoria podem valer só para saídas ou só para entradas (null = as duas)
alter table fin_regras add column if not exists sentido text check (sentido in ('saida', 'entrada'));
