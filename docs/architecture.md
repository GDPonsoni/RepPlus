# 🏗️ Arquitetura do Sistema

O **Escala** é uma aplicação monolítica leve: um servidor Node.js/Express expõe uma API REST e serve o frontend em JavaScript puro. Dados e imagens ficam no Supabase.

O código é dividido em **núcleo** (o que todo módulo usa: moradores, aparência, sessão/permissões, semana, uploads) e **módulos** de funcionalidade. Hoje existe um módulo, a escala de limpeza; novos módulos (financeiro, eventos...) entram sem mexer no núcleo. Veja [Módulos e Permissões](#-módulos-e-permissões).

---

## 📐 Visão Geral

```
+-------------------------------------------------------+
|                   Navegador (SPA)                     |
|  index.html (casca) + js/main.js                      |
|  js/core/  (api, sessão, abas, moradores, aparência)  |
|  js/modules/escala/  (abas e seções do módulo)        |
+---------------------------+---------------------------+
                            |
                    HTTP / JSON (REST /api)
                            |
+---------------------------v---------------------------+
|        Backend Node.js (server.js -> app.js)          |
|                                                       |
|  core/auth (req.contexto + exigirPermissao)           |
|  core/modulos.js monta cada módulo em /api:           |
|  sistema · moradores · configuracao · escala ·        |
|  agenda · compras · anotacoes · atas · financas       |
|        │                                              |
|        ├── */store.js ─────────┐                      |
|        └── core/storage.js ─┐  │   Multer (memória)   |
+-----------------------------|--|----------------------+
                              |  |
               +--------------v--v--------------+
               |            Supabase            |
               |  Storage (bucket "uploads")    |
               |  Postgres (tabelas do app)     |
               +--------------------------------+
```

Em produção, a Vercel roda `backend/server.js` como função serverless para `/api/*` e serve `frontend/` como arquivos estáticos (veja `vercel.json`). Localmente, o próprio Express serve o frontend.

---

## ⚙️ Backend

- **Runtime**: Node.js com ES Modules (`"type": "module"`).
- **Framework**: Express, na porta `3000` ou na variável `PORT`.
- **Estrutura** (`backend/`):
  - `server.js`: ponto de entrada (sobe o servidor localmente; na Vercel, exporta o app).
  - `app.js`: monta o Express, a sessão e a lista de módulos (`MODULOS`).
  - `core/`: `http.js` (asyncHandler, HttpError, upload, tratamento de erros), `semana.js` (semana ISO no horário de Brasília), `storage.js` (imagens), `db/` (cliente Supabase e helpers de consulta), `auth/` (sessão e permissões), `modulos.js` (contrato e montagem dos módulos) e os módulos do núcleo `sistema.js`, `moradores/` e `configuracao/`.
  - `modules/escala/`: rotas (`rotas/`), acesso às tabelas (`store.js`) e o rodízio (`rodizio.js`).
- **Persistência** (`store.js` de cada módulo): um objeto por tabela (`IntegrantesStore`, `ComodosStore`, `EscalasStore`, `InfracoesStore`, `ConfigStore`) que converte entre o formato do banco (`snake_case`) e o da API (`camelCase`).
  - A troca da escala de uma semana (`replaceSemana`) usa a função Postgres `replace_semana_escala`, que apaga e insere numa única transação.
  - Trocas e renomeações gravam várias linhas num único `upsert`.
  - O Supabase devolve no máximo 1000 linhas por consulta, então as listagens são paginadas (`selectAll`) até vir uma página vazia. A listagem de imagens do Storage também é paginada.
- **Imagens** (`backend/core/storage.js`): o Multer recebe o arquivo em memória (png, jpg, jpeg, webp ou gif, até 5MB) e ele é enviado ao bucket `uploads` do Supabase Storage. O banco guarda a URL pública.
- **Fuso horário**: a "semana atual" é calculada no horário de Brasília (`America/Sao_Paulo`), seguindo a semana ISO 8601 (segunda a domingo). A Vercel roda em UTC, então isso não depende do servidor.

### Algoritmo do Rodízio (`backend/modules/escala/rodizio.js`)

Nada é sorteado: cada semana é calculada a partir do histórico das anteriores.

1. **Vagas**: cada cômodo obrigatório gera `pessoasNecessarias` vagas. Cômodos marcados como "apenas suíte" geram vagas da suíte.
2. **Folgas**: `integrantes ativos − total de vagas`. Vão para quem está há mais tempo sem folgar (empate: ordem alfabética), sem deixar a suíte sem morador para o banheiro dela.
3. **Banheiro da suíte**: o morador da suíte há mais tempo sem fazê-lo, entre quem não está de folga.
4. **Demais cômodos**: cada pessoa vai para o cômodo seguinte ao último que fez, na ordem configurada (campo `ordem`). Se ele já estiver ocupado, vai para o próximo livre. Quem trabalhou num cômodo comum na semana anterior escolhe primeiro.

O rodízio lê só as últimas 52 semanas do histórico, o suficiente para cobrir um ciclo completo com folga, e a geração continua rápida mesmo com anos de histórico.

Se houver mais vagas que pessoas, ou mais vagas da suíte que moradores da suíte, a geração retorna erro em vez de dar dois cômodos à mesma pessoa.

O histórico identifica cômodos pelo **nome**: por isso não é permitido ter dois cômodos com o mesmo nome, e renomear um cômodo atualiza o nome em todas as escalas antigas.

---

## 🎨 Frontend

- **SPA**: uma página HTML com navegação por abas, sem recarregar e sem etapa de build (módulos JS nativos, `<script type="module">`).
- **Estrutura** (`frontend/js/`):
  - `main.js`: carrega a sessão, monta a interface com os módulos ativos, aplica a configuração e inicia cada módulo.
  - `core/`: `api.js` (cliente único da API), `sessao.js` (usuário, permissões e `data-permissao`), `shell.js` (seletor de módulos, abas e navegação por endereço `#/modulo/aba`), `painel.js` (painel deslizante para formulários), `datas.js` (datas no horário de Brasília), `acoes.js` (cliques via `data-acao`), `eventos.js` (avisos entre módulos), `ui.js`, `modal.js` e os módulos do núcleo `moradores.js` (cadastro global), `aparencia.js` e `sistema.js`.
  - `modules/escala/`: abas Atual, Histórico, Infrações e Ajustes (cômodos e galeria).
  - `modules/agenda/`: abas Mês e Semana, formulário de evento e os aniversários vindos do cadastro.
  - `modules/anotacoes/`: abas Senhas, Contatos e Notas; `cofre.js` faz toda a criptografia no navegador (Web Crypto), `dados.js` o estado e a API, `telas.js` as listas e `formulario.js` os formulários e as janelas do cofre.
  - `modules/atas/`: abas Atas e Pendências; `dados.js` (estado, API e reuniões da agenda sem ata), `telas.js` (listas) e `formulario.js` (leitura, formulário e envio da ata).
  - `modules/compras/`: abas Lista e Itens salvos; `dados.js` guarda o estado e fala com a API, `index.js` desenha as telas e o formulário.
- **Navegação**: o nome do módulo no topo abre o **seletor de módulos**; a barra de abas mostra só as abas do módulo atual. Moradores e Ajustes são páginas globais (grupo "Geral" do seletor).
- **Botões**: usam `data-acao="..."` (o módulo registra o que cada ação faz) em vez de `onclick` com funções globais.
- **Tema**: cores aplicadas via variáveis CSS (`style.setProperty()`); o resto da paleta deriva delas com `color-mix`. Estilo por atributos no `<html>`: `data-tema` (claro/escuro, do aparelho), `data-texto`, `data-cantos` e `data-cabecalho`. O `index.html` aplica o tema do aparelho antes de desenhar a tela, para não piscar.
- **Segurança de renderização**: todo texto vindo do banco passa por `escaparHtml` antes de entrar em `innerHTML`.

---

## 🧩 Módulos e Permissões

### Contrato de um módulo

**Backend** (`backend/modules/<nome>/index.js`, registrado em `MODULOS` no `backend/app.js`):

```js
export default {
  id: 'financeiro',
  nome: 'Financeiro',
  permissoes: {
    'financeiro:ver':     { descricao: 'Ver gastos e saldos', papeis: ['morador'] },
    'financeiro:lancar':  { descricao: 'Lançar gastos',       papeis: ['morador'] },
    'financeiro:gerenciar': { descricao: 'Editar e apagar lançamentos', papeis: [] }
  },
  rotas(router) {
    router.get('/financeiro/gastos', exigirPermissao('financeiro:ver'), asyncHandler(async (req, res) => { ... }));
  }
};
```

**Frontend** (`frontend/js/modules/<nome>/index.js`, registrado em `MODULOS` no `frontend/js/main.js`):

```js
export default {
  id: 'financeiro',                       // mesmo id do backend
  nome: 'Financeiro', descricao: 'Gastos e divisão de contas',   // como aparece no seletor de módulos
  icone: 'fa-solid fa-wallet', cor: 'icon-green',
  abas: [
    { id: 'gastos', titulo: 'Gastos', icone: 'fa-solid fa-receipt', html: '...', permissao: 'financeiro:ver', aoAbrir: carregarGastos },
    // uma aba com `secoes` vira uma lista de seções recolhíveis (ajustes do próprio módulo)
    { id: 'ajustes', titulo: 'Ajustes', icone: 'fa-solid fa-sliders', secoes: [{ id: 'acc-contas', titulo: 'Contas fixas', icone: '...', cor: 'icon-green', html: '...', permissao: 'financeiro:gerenciar' }] }
  ],
  secoesAjustes: [],                      // opcional: seções na página global de Ajustes
  // opcional: cartão de resumo no Início (core/inicio.js); conteudo() busca os dados e devolve o HTML
  inicio: { titulo: 'Gastos do mês', rota: 'financeiro/gastos', permissao: 'financeiro:ver', async conteudo() { return '...'; }, aoMontar(elemento, atualizar) {} },
  iniciar() { /* liga eventos, registrarAcoes(...), carrega dados */ }
};
```

O módulo aparece no seletor e suas abas na navegação automaticamente (endereços `#/financeiro/gastos`). Para formulários, use `abrirPainel()` (`core/painel.js`); para datas, `core/datas.js`. Um módulo lê os moradores com `obterIntegrantes()` e reage a mudanças com `ouvir('moradores:atualizados', ...)`, sem depender de outros módulos.

### Início

- `core/inicio.js` é a página de abertura (`#/inicio`, primeiro módulo da lista): mostra um cartão para cada módulo ativo que exporta `inicio` e cuja `permissao` o usuário tem.
- Cada cartão carrega sozinho (`conteudo()`); se um falhar, os outros continuam. `aoMontar(elemento, atualizar)` liga eventos do cartão (ex.: o campo rápido da lista de compras) e `atualizar()` recarrega só ele.
- Quais cartões aparecem e a ordem ficam no `localStorage` (`escala:inicio`), por aparelho.
- Módulos só do frontend, como o Início, usam `semBackend: true` para não depender de `GET /api/sessao`.

### Finanças e Open Finance

- `modules/financas/` (backend): `store.js` (tabelas `fin_*`), `regras.js` (categorização por "contém"), `sincronizacao.js` e `provedores/`.
- **Provedores** (`provedores/index.js`) seguem um contrato único: `configurado()`, `conectar(dados)`, `contas(conexao)` e `transacoes(conexao, conta, desde)`, sempre com valores em centavos. A sincronização, a deduplicação (`externo_id`) e as regras não dependem do provedor.
- `provedores/demo.js` simula um banco (só com `FINANCAS_PROVEDOR_DEMO=1`, ligado no servidor local de testes); `provedores/pluggy.js` marca onde entra a integração real com o roteiro do que implementar.
- A Vercel chama `GET /api/financas/sincronizar` uma vez por dia (`crons` no `vercel.json`); com `CRON_SECRET` definido, a chamada do agendador é aceita mesmo quando houver login.
- Frontend (`modules/financas/`): `dados.js` (estado, API e formatação), `graficos.js` (SVG sem biblioteca), uma tela por aba (`visao.js`, `lancamentos.js`, `contas.js`, `divisoes.js`, `ajustes.js`), `inicio.js` e `avisos.js`.

### Categorias

- `core/categorias` (backend e frontend) guarda categorias com nome, cor e ícone por **escopo**. Um módulo declara seus escopos em `categorias: { <escopo>: { nome, permissaoVer, permissaoGerenciar, tabela, coluna, filtro?, padrao: [...] } }`; o backend valida com `categoriaExiste(escopo, chave)` e usa `categoriaPadrao(escopo)` quando nada é enviado.
- No frontend: `carregarCategorias(escopo)` no `iniciar()`, `categoria(escopo, chave)` para nome/cor/ícone, `estiloCategoria(c)` para a variável CSS `--cat` e `htmlEscolhaCategoria({ escopo, selecionada })` para os chips de formulário (com o botão "Editar"). Mudanças emitem `categorias:atualizadas`.

### Navegação e avisos

- `core/shell.js` monta a navegação a partir da lista de módulos: **menu lateral** (≥ 900px) e **barra inferior** no celular (até 5 itens; a partir do 6º módulo, os últimos vão para "Mais"). A ordem é a de `MODULOS` no `main.js`; `nomeCurto` é o rótulo na barra inferior.
- Módulos com `menu: 'usuario'` (Moradores e Ajustes) ficam no **menu do canto superior direito**, junto do avatar. É o lugar previsto para perfil e "sair" quando o login existir (`obterSessao().usuario`).
- `core/avisos.js` junta os `avisos()` dos módulos ativos no **sino**. Cada aviso tem `id` estável; os já vistos ficam no `localStorage` (`escala:avisos-vistos`) e o contador mostra só os novos. A lista é recarregada a cada 5 minutos e ao abrir o sino.

### Ligar e desligar módulos

- Módulos com `nucleo: false` podem ser desligados em **Ajustes → Módulos** (`PUT /api/modulos/:id`). A lista fica em `config.modulos_desativados`.
- `core/modulos.js` monta cada módulo atrás de um filtro: se ele estiver desligado, a requisição pula o router do módulo e termina no 404 da API. `GET /api/sessao` devolve só os módulos ativos, e o frontend (`main.js`) monta apenas esses.
- Um módulo que usa outro deve checar `moduloAtivo('<id>')` no frontend (ex.: as Atas só sugerem reuniões se a Agenda estiver ligada).

### Sessão e permissões (pontes para o login)

- Toda requisição em `/api` recebe `req.contexto = { modo, autenticado, usuario, republicaId, permissoes }` (`backend/core/auth/sessao.js`).
- Cada rota declara a permissão que exige com `exigirPermissao('modulo:acao')`. Usar uma permissão que nenhum módulo declarou derruba o servidor na subida, para o erro aparecer cedo.
- Papéis: `admin` (pode tudo) e `morador` (recebe as permissões marcadas com `papeis: ['morador']`).
- **Modo atual: `AUTH_MODO=aberto` (padrão)**. Não há login; todo acesso é tratado como admin, exatamente como o app sempre funcionou.
- `GET /api/sessao` informa ao frontend o usuário, as permissões e os módulos ativos. O frontend esconde os elementos com `data-permissao="..."` que o usuário não pode usar. Isso é só conveniência visual: quem barra de verdade é o backend (401 sem login, 403 sem permissão).
- `republicaId` fica reservado (hoje `null`) para quando o app atender mais de uma república.

**Para ligar o login no futuro:**

1. Backend: criar um novo resolvedor em `core/auth/sessao.js` (ex.: `supabase`, que lê o token `Authorization: Bearer` com `supabase.auth.getUser` e busca o papel do usuário numa tabela de perfis ligada a `integrantes`), e definir `AUTH_MODO` com ele.
2. Frontend: criar a tela de login, chamar `definirToken()` (`core/api.js`) após entrar e tratar o evento `sessao:expirada` (hoje só mostra um aviso, em `main.js`).

As rotas e as telas dos módulos não precisam mudar.
