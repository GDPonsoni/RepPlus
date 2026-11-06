-- Controle de limpeza: nomes dos cômodos já limpos por cada pessoa na semana.
-- replace_semana_escala não precisa mudar: ao gerar a escala a coluna começa vazia.
alter table escalas add column if not exists cumpridos jsonb not null default '[]'::jsonb;
