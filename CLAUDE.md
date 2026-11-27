# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

RepPlus: app web (pt-BR) para organizar uma república. Node ≥20 + Express (ES Modules) no backend, JavaScript puro sem build no frontend, Postgres no Neon, imagens no Cloudflare R2. Produção no Render (`render.yaml`) e na Vercel (`vercel.json` + `api/index.js`), as duas pela branch `main` e com o mesmo banco. Docs, comentários e UI estão em português; siga isso.

## Comandos

```bash
npm install
npm run db:migrar            # aplica db/migrations/*.sql pendentes (usa DATABASE_URL_UNPOOLED)
npm start                    # node backend/server.js -> http://localhost:3000
npm run db:importar-supabase # importa dados do app antigo
```

Não há testes, linter nem build. Config via `.env` (veja `.env.example`). Sem `AUTH_MODO=senha` o app abre sem login (todo acesso é admin).

Servidor de teste local (`local/`, fora do git via `.git/info/exclude`): `node local/mock-server.mjs` sobe o backend real com banco falso em memória e R2 falso, sem `.env`, em `http://localhost:4000` (`VAZIO=1` começa sem dados). `local/banco-local.mjs` sobe um Postgres PGlite real (exige instalar o pglite com `npm install --no-save`, versões no cabeçalho do arquivo).

## Arquitetura

Detalhe completo em `docs/architecture.md` (contrato de módulo, categorias, rodízio, finanças, auth). Resumo do que exige ler vários arquivos:

- **Núcleo + módulos plugáveis.** `backend/app.js` lista `MODULOS` (núcleo: `sistema`, `moradores`, `configuracao`, `categorias`; funcionalidades: `escala`, `agenda`, `compras`, `anotacoes`, `atas`, `documentos`, `financas`). `core/modulos.js` monta cada um atrás de um filtro que devolve 404 se o módulo estiver desligado (`config.modulos_desativados`). O frontend espelha isso: `frontend/js/main.js` tem seu próprio `MODULOS`, e a ordem dele define a navegação. Módulo novo = `backend/modules/<id>/index.js` + `frontend/js/modules/<id>/index.js` com o mesmo `id`, registrados nas duas listas.
- **Permissões.** Toda rota usa `exigirPermissao('modulo:acao')`; permissão não declarada por nenhum módulo derruba o servidor na subida. `req.contexto` vem de `core/auth/sessao.js`. O frontend só esconde elementos (`data-permissao`); quem barra é o backend.
- **Banco sem ORM.** `backend/core/db/banco.js` imita a API encadeada do Supabase (`banco.from('t').select().eq()...`) sobre `pg` e devolve `{ data, error }` (lido por `check()`). Só existem os métodos que o backend usa; `update`/`delete` sem filtro são recusados. Cada módulo acessa tabelas via `store.js`, que converte `snake_case` (banco) ↔ `camelCase` (API). Listagens grandes usam `selectAll` (paginado).
- **Migrações.** `db/migrations/AAAAMMDD_assunto.sql`, idempotentes (`if not exists`); o runner grava em `migracoes_aplicadas`. Ao criar uma, acrescente a linha na tabela de `db/README.md`. O Render roda `db:migrar` no build.
- **Imagens e documentos.** Bucket R2 privado; o banco guarda `/api/midia/<chave>`, servido por `core/storage.js` só a quem está logado. Sem `R2_*` só o upload falha. Documentos do mural usam o prefixo `doc-` (fora da galeria de motivação) e aceitam PDF.
- **Google Drive.** `modules/documentos/drive.js`: login OAuth com a conta da rep feito uma vez por um admin (`GOOGLE_CLIENT_ID`/`SECRET`); refresh token cifrado em `documentos_drive` serve a todos. Só leitura e só dentro da pasta escolhida; o servidor repassa os arquivos.
- **Semana** = ISO 8601 no fuso `America/Sao_Paulo` (`core/semana.js`), independente do fuso do servidor.
- **Escala sem sorteio.** `modules/escala/rodizio.js` calcula cada semana a partir das últimas 52 do histórico; o histórico identifica cômodos pelo **nome** (renomear atualiza escalas antigas; nomes duplicados são proibidos). `replace_semana_escala` é função Postgres transacional.
- **Finanças.** Provedores de Open Finance (`modules/financas/provedores/`: `pluggy`, `demo` com `FINANCAS_PROVEDOR_DEMO=1`) seguem um contrato único e valores em centavos; sincronização e regras de categorização não dependem do provedor. `GET /api/financas/sincronizar` serve a um cron externo (`CRON_SECRET`).
- **Categorias** gerenciáveis por escopo (`core/categorias`), com subcategorias de um nível em escopos que declaram `subcategorias: true`.

## Convenções do frontend

- SPA com rotas `#/modulo/aba`, módulos nativos `<script type="module">`, sem bundler.
- Botões usam `data-acao="..."` registrado via `registrarAcoes`, nunca `onclick` global.
- Todo texto vindo do banco passa por `escaparHtml` antes de `innerHTML`.
- Formulários: `abrirPainel()`; confirmações: `mostrarConfirmacao()`; datas: `core/datas.js`; animações respeitam `movimentoReduzido()`.
- Módulos se comunicam por eventos (`ouvir('moradores:atualizados', ...)`), sem importar uns aos outros; use `moduloAtivo('<id>')` para depender de outro módulo.
