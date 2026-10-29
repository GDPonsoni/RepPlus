-- Personalização da interface: nome da república, frase do rodapé, fonte, cantos,
-- estilo do cabeçalho e visibilidade da imagem de fundo (valores padrão ficam no backend).
alter table config add column if not exists personalizacao jsonb not null default '{}'::jsonb;
