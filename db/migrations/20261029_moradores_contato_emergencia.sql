-- Contato de emergência no cadastro de moradores.
-- Aplicar no Supabase (SQL Editor) depois de 20261028_moradores_perfil_e_agenda.sql.
-- Pode ser executado mais de uma vez sem efeito colateral.

alter table integrantes add column if not exists emergencia_nome text;
alter table integrantes add column if not exists emergencia_parentesco text;
alter table integrantes add column if not exists emergencia_telefone text;
