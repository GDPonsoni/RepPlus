-- Módulo Documentos: mural de arquivos (fotos e PDFs, ex.: ata em papel digitalizada).
-- O arquivo fica no bucket R2 (chave "doc-<uuid>.<ext>"); aqui ficam o caminho /api/midia/<chave>
-- e os dados para listar e baixar. Um documento pode ser anexo de uma ata.
-- Pode ser executado mais de uma vez sem efeito colateral.

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text,
  arquivo text not null,
  nome_arquivo text not null,
  tipo text not null,
  tamanho integer not null default 0,
  -- Ata de que o documento é anexo (apagar a ata mantém o documento no mural)
  ata_id uuid references atas(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists documentos_criado_idx on documentos (criado_em desc);
create index if not exists documentos_ata_idx on documentos (ata_id);

-- Conexão com o Google Drive da rep (linha única): alguém da administração entra uma vez com a
-- conta Google da rep e a autorização serve a todos. O refresh token fica criptografado
-- (AES-256-GCM com chave derivada de GOOGLE_CLIENT_SECRET): o banco sozinho não o revela.
create table if not exists documentos_drive (
  id integer primary key default 1 check (id = 1),
  refresh_token text not null,
  email text,
  pasta_id text,
  pasta_nome text,
  -- Preenchido quando o Google recusa a autorização (revogada, senha trocada...): pede reconexão
  erro text,
  conectado_em timestamptz not null default now()
);
