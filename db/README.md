# Migrações do banco

Esquema do banco Postgres (Neon), em ordem de data. Cada arquivo pode ser executado mais de
uma vez sem efeito colateral (`if not exists`).

**Como aplicar:** `npm run db:migrar` (com `DATABASE_URL` no `.env`). O comando roda, em ordem, só
as migrações que ainda não rodaram naquele banco e anota cada uma na tabela `migracoes_aplicadas`.
No Render isso acontece sozinho a cada deploy (comando de build do [`render.yaml`](../render.yaml)).

**Migração nova:** crie `db/migrations/AAAAMMDD_assunto.sql` usando `if not exists` e similares, e
acrescente uma linha na tabela abaixo.

**Dados do app antigo:** `npm run db:importar-supabase` copia tabelas e imagens do Supabase (veja
[docs/deploy.md](../docs/deploy.md#4-trazer-os-dados-do-app-antigo-supabase)).

| Arquivo | O que faz |
| :--- | :--- |
| `20261027_base.sql` | Tabelas originais: `integrantes`, `comodos`, `escalas`, `infracoes`, `config` (linha única) e a função `replace_semana_escala` |
| `20261028_moradores_perfil_e_agenda.sql` | Campos do cadastro de moradores (nascimento, contato, documentos...) e tabela `eventos` da agenda |
| `20261029_agenda_recorrencia.sql` | Eventos que se repetem: `recorrencia`, `recorrencia_ate` e `excecoes` |
| `20261029_moradores_contato_emergencia.sql` | Contato de emergência dos moradores (nome, parentesco, telefone) |
| `20261029_config_personalizacao.sql` | Personalização da interface: nome da república, rodapé, fonte, cantos, cabeçalho, fundo |
| `20261030_compras.sql` | Módulo Lista de Compras: tabela `compras_itens` |
| `20261030_anotacoes.sql` | Módulo Anotações: tabelas `anotacoes` e `anotacoes_cofre` |
| `20261030_atas.sql` | Módulo Atas de Reunião: tabela `atas` |
| `20261030_config_modulos.sql` | Ativar/desativar módulos: coluna `modulos_desativados` em `config` |
| `20261031_categorias.sql` | Categorias gerenciáveis (nome, cor, ícone): tabela `categorias`; remove as listas fixas de `eventos` e `compras_itens` |
| `20261031_financas.sql` | Módulo Finanças: contas, lançamentos, regras, orçamentos, divisões e conexões de Open Finance |

