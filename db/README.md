# Migrações do banco

Alterações no esquema do Supabase, em ordem de data. Cada arquivo pode ser executado mais de
uma vez sem efeito colateral (`if not exists`).

**Como aplicar:** Supabase → SQL Editor → cole o conteúdo do arquivo → Run. Aplique as migrações
**antes** de publicar o código que depende delas.

| Arquivo | O que faz |
| :--- | :--- |
| `20261028_moradores_perfil_e_agenda.sql` | Campos do cadastro de moradores (nascimento, contato, documentos...) e tabela `eventos` da agenda |
| `20261029_agenda_recorrencia.sql` | Eventos que se repetem: `recorrencia`, `recorrencia_ate` e `excecoes` |
| `20261029_moradores_contato_emergencia.sql` | Contato de emergência dos moradores (nome, parentesco, telefone) |
| `20261029_config_personalizacao.sql` | Personalização da interface: nome da república, rodapé, fonte, cantos, cabeçalho, fundo |
| `20261030_compras.sql` | Módulo Lista de Compras: tabela `compras_itens` |

As tabelas anteriores (`integrantes`, `comodos`, `escalas`, `infracoes`, `config` e a função
`replace_semana_escala`) foram criadas antes deste controle e ainda não têm migração aqui.
