-- Módulos desativados pela república (Ajustes > Módulos). Lista de ids, ex.: ["agenda"].
-- Desativar só esconde o módulo e bloqueia as rotas dele; os dados continuam nas tabelas.
alter table config add column if not exists modulos_desativados jsonb not null default '[]'::jsonb;
