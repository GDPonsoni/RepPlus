# 🏗️ Arquitetura do Sistema

O **RepPlus** é uma aplicação monolítica leve: um servidor Node.js/Express expõe uma API REST e serve o frontend em JavaScript puro. Os dados ficam num banco Postgres (Neon) e as imagens no Cloudflare R2.

O código é dividido em **núcleo** (o que todo módulo usa: moradores, aparência, categorias, sessão/permissões, navegação, semana, uploads) e **módulos** de funcionalidade: escala de limpeza, agenda, lista de compras, anotações, atas de reunião e finanças. Cada república liga só os módulos que usa, e um módulo novo entra sem mexer no núcleo. Veja [Módulos e Permissões](#-módulos-e-permissões).

---

## 📐 Visão Geral

```
+-------------------------------------------------------+
|                   Navegador (SPA)                     |
|  index.html (casca) + js/main.js                      |
|  js/core/  (navegação, início, avisos, moradores...)  |
|  js/modules/<módulo>/  (abas e telas de cada módulo)  |
+---------------------------+---------------------------+
                            |
                    HTTP / JSON (REST /api)
                            |
+---------------------------v---------------------------+
|        Backend Node.js (server.js -> app.js)          |
|                                                       |
|  core/auth (req.contexto + exigirPermissao)           |
|  core/modulos.js monta cada módulo em /api:           |
|  sistema · moradores · configuracao · categorias ·    |
|  escala · agenda · compras · anotacoes · atas ·       |
|  financas                                             |
|        │                                              |
|        ├── */store.js -> core/db/banco.js (pg)        |
|        └── core/storage.js (S3)   Multer (memória)    |
+------------|-----------------------|------------------+
             |                       |
   +---------v----------+   +--------v---------------+
   |  Postgres (Neon)   |   |  Cloudflare R2         |
   |  tabelas do app    |   |  bucket das imagens    |
   +--------------------+   +------------------------+
```

Em produção, o Render roda `npm start` como um servidor sempre igual ao local, e aplica as migrações a cada deploy (veja [deploy.md](deploy.md) e `render.yaml`). O próprio Express serve o frontend e escuta em todas as interfaces de rede, então o celular no mesmo Wi-Fi abre pelo IP do computador (o `npm start` mostra o endereço).

---

## ⚙️ Backend

- **Runtime**: Node.js com ES Modules (`"type": "module"`).
- **Framework**: Express, na porta `3000` ou na variável `PORT`.
- **Estrutura** (`backend/`):
  - `server.js`: ponto de entrada (sobe o servidor, localmente e no Render).
  - `app.js`: monta o Express, a sessão e a lista de módulos (`MODULOS`).
  - `core/`: `http.js` (asyncHandler, HttpError, upload, tratamento de erros), `semana.js` (semana ISO no horário de Brasília), `storage.js` (imagens), `db/` (acesso ao Postgres e helpers de consulta), `auth/` (sessão e permissões), `modulos.js` (contrato e montagem dos módulos) e os módulos do núcleo `sistema.js`, `moradores/`, `configuracao/` e `categorias/`.
  - `modules/<módulo>/`: `index.js` (definição: permissões, categorias e rotas), `store.js` (acesso às tabelas) e o que for próprio do módulo, como `rotas/` e `rodizio.js` na escala, `recorrencia.js` na agenda ou `provedores/` nas finanças.
- **Persistência** (`store.js` de cada módulo): um objeto por tabela (ex.: `IntegrantesStore`, `ComodosStore`, `EscalasStore`, `ConfigStore`) que converte entre o formato do banco (`snake_case`) e o da API (`camelCase`).
  - A troca da escala de uma semana (`replaceSemana`) usa a função Postgres `replace_semana_escala`, que apaga e insere numa única transação.
  - Trocas e renomeações gravam várias linhas num único `upsert`.
  - As listagens que crescem com o tempo são paginadas (`selectAll`, 1000 linhas por vez, ordenadas pela chave). A listagem de imagens do bucket também é paginada.
- **Banco** (`backend/core/db/banco.js`): um pool do `pg` ligado ao `DATABASE_URL` (no Neon, a conexão com `-pooler`; as migrações usam a direta, `DATABASE_URL_UNPOOLED`). As stores montam as consultas com um encadeamento curto (`banco.from('tabela').select('*').eq('id', id).maybeSingle()`), no mesmo formato que o app usava com o Supabase, e recebem `{ data, error }` (lido por `check()`).
  - Por baixo, cada chamada vira um SQL com parâmetros (`$1`, `$2`...). Os nomes de tabela e coluna são conferidos com os do próprio banco, e os campos `jsonb` recebem JSON.
  - Datas e horários saem como texto ISO, e números como `number`, como a API sempre devolveu.
  - Existem só os métodos que o backend usa (`select`, `insert`, `upsert`, `update`, `delete`, `eq`, `in`, `is`, `gte`, `lt`, `or`, `order`, `range`, `single`, `maybeSingle` e `rpc`); `update` e `delete` sem filtro são recusados.
- **Imagens** (`backend/core/storage.js`): o Multer recebe o arquivo em memória (png, jpg, jpeg, webp ou gif, até 5MB) e ele é enviado ao bucket **privado** do Cloudflare R2 pela API compatível com S3 (`@aws-sdk/client-s3`). O bucket não tem endereço público: o banco guarda o caminho `/api/midia/<chave>`, e essa rota busca o arquivo no R2 e o entrega só a quem entrou no app. Sem as variáveis `R2_*`, só os envios de imagem dão erro; o resto do app funciona.
- **Fuso horário**: a "semana atual" é calculada no horário de Brasília (`America/Sao_Paulo`), seguindo a semana ISO 8601 (segunda a domingo). O servidor roda em UTC, então isso não depende do fuso dele.

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

- **SPA**: uma página HTML com navegação por endereço (`#/modulo/aba`), sem recarregar e sem etapa de build (módulos JS nativos, `<script type="module">`).
- **Estrutura** (`frontend/js/`):
  - `main.js`: carrega a sessão, monta a interface com os módulos ativos, aplica a configuração e inicia cada módulo.
  - `core/`: `api.js` (cliente único da API), `sessao.js` (usuário, permissões e `data-permissao`), `shell.js` (menu lateral, barra inferior, menu do usuário, abas e navegação por endereço `#/modulo/aba`, com transições e rolagem lembrada por aba), `inicio.js` (página Início), `avisos.js` (sino), `categorias.js` (categorias e o gerenciador de nome, cor e ícone), `painel.js` (painel deslizante para formulários; no celular fecha arrastando o topo para baixo), `movimento.js` (animações e retorno ao toque: `vibrar`, `comemorar`, `animarSaida`, `contarAte`, `chacoalhar`; tudo respeita "reduzir movimento" e `data-animacoes`), `datas.js` (datas no horário de Brasília), `acoes.js` (cliques via `data-acao`), `eventos.js` (avisos entre módulos), `ui.js` (escape de HTML, notificações animadas, accordion), `modal.js` (confirmação e pergunta) e os módulos do núcleo `moradores.js` (cadastro global), `aparencia.js` (nome, logo, ícone da guia, cores, estilo e preferências do aparelho) e `sistema.js` (Ajustes → Módulos e versão).
  - `modules/escala/`: abas Atual, Histórico, Infrações e Ajustes (cômodos e galeria).
  - `modules/agenda/`: abas Mês e Semana, formulário de evento e os aniversários vindos do cadastro.
  - `modules/anotacoes/`: abas Senhas, Contatos e Notas; `cofre.js` faz toda a criptografia no navegador (Web Crypto), `dados.js` o estado e a API, `telas.js` as listas e `formulario.js` os formulários e as janelas do cofre.
  - `modules/atas/`: abas Atas e Pendências; `dados.js` (estado, API e reuniões da agenda sem ata), `telas.js` (listas) e `formulario.js` (leitura, formulário e envio da ata).
  - `modules/compras/`: abas Lista e Itens salvos; `dados.js` guarda o estado e fala com a API, `index.js` desenha as telas e o formulário.
  - `modules/financas/`: veja [Finanças e Open Finance](#finanças-e-open-finance).
  - Cada módulo pode ter `inicio.js` (cartão do Início) e `avisos.js` (avisos do sino).
- **Navegação**: menu lateral no computador e barra inferior no celular trocam de módulo; a barra de abas mostra só as abas do módulo atual. Moradores e Ajustes ficam no menu do canto superior direito. Veja [Navegação e avisos](#navegação-e-avisos).
- **Botões**: usam `data-acao="..."` (o módulo registra o que cada ação faz) em vez de `onclick` com funções globais.
- **Tema**: cores aplicadas via variáveis CSS (`style.setProperty()`); o resto da paleta deriva delas com `color-mix`. Estilo por atributos no `<html>`: `data-tema` (claro/escuro, do aparelho), `data-texto`, `data-cantos`, `data-cabecalho`, `data-cabecalho-tamanho` (amplo, com o logo em destaque, ou compacto), `data-animacoes` e `data-vibracao` (do aparelho). O `index.html` aplica as preferências do aparelho e o último ícone da guia antes de desenhar a tela, para não piscar.
- **Movimento**: animações curtas (entrada de abas, cartões em sequência, painéis, notificações) e retorno ao toque ficam em CSS e em `core/movimento.js`. Nenhuma segura o uso, e todas somem com o "reduzir movimento" do sistema ou com Animações: Reduzidas no aparelho. Use `movimentoReduzido()` antes de animar por JavaScript.
- **Segurança de renderização**: todo texto vindo do banco passa por `escaparHtml` antes de entrar em `innerHTML`.

---

## 🧩 Módulos e Permissões

### Contrato de um módulo

**Backend** (`backend/modules/<nome>/index.js`, registrado em `MODULOS` no `backend/app.js`):

```js
export default {
  id: 'manutencao',
  nome: 'Manutenção',
  nucleo: false,                          // pode ser desligado em Ajustes → Módulos
  permissoes: {
    'manutencao:ver':       { descricao: 'Ver chamados',            papeis: ['morador'] },
    'manutencao:abrir':     { descricao: 'Abrir chamados',          papeis: ['morador'] },
    'manutencao:gerenciar': { descricao: 'Fechar e apagar chamados', papeis: [] }
  },
  // opcional: grupos de categorias gerenciáveis (veja Categorias)
  categorias: { manutencao: { nome: 'Tipos de chamado', permissaoVer: 'manutencao:ver', permissaoGerenciar: 'manutencao:gerenciar', tabela: 'chamados', coluna: 'categoria', padrao: [...] } },
  rotas(router) {
    router.get('/manutencao/chamados', exigirPermissao('manutencao:ver'), asyncHandler(async (req, res) => { ... }));
  }
};
```

**Frontend** (`frontend/js/modules/<nome>/index.js`, registrado em `MODULOS` no `frontend/js/main.js`):

```js
export default {
  id: 'manutencao',                       // mesmo id do backend
  nome: 'Manutenção', nomeCurto: 'Reparos', descricao: 'Chamados de conserto da casa',
  icone: 'fa-solid fa-screwdriver-wrench', cor: 'icon-orange',
  abas: [
    { id: 'chamados', titulo: 'Chamados', icone: 'fa-solid fa-list', html: '...', permissao: 'manutencao:ver', aoAbrir: carregarChamados },
    // uma aba com `secoes` vira uma lista de seções recolhíveis (ajustes do próprio módulo)
    { id: 'ajustes', titulo: 'Ajustes', icone: 'fa-solid fa-sliders', secoes: [{ id: 'acc-prestadores', titulo: 'Prestadores', icone: '...', cor: 'icon-green', html: '...', permissao: 'manutencao:gerenciar' }] }
  ],
  secoesAjustes: [],                      // opcional: seções na página global de Ajustes
  // opcional: cartão de resumo no Início (core/inicio.js); conteudo() busca os dados e devolve o HTML
  inicio: { titulo: 'Chamados abertos', rota: 'manutencao/chamados', permissao: 'manutencao:ver', async conteudo() { return '...'; }, aoMontar(elemento, atualizar) {} },
  // opcional: avisos do sino (core/avisos.js), com id estável
  async avisos() { return [{ id: 'manutencao:atrasado:<id>', texto: 'Chuveiro sem conserto há 7 dias', tipo: 'alerta', rota: 'manutencao/chamados' }]; },
  iniciar() { /* liga eventos, registrarAcoes(...), carrega dados */ }
};
```

Outros campos opcionais do frontend: `menu: 'usuario'` (vai para o menu do canto em vez da navegação principal) e `semBackend: true` (módulo só de tela, como o Início).

O módulo aparece na navegação e suas abas automaticamente (endereços `#/manutencao/chamados`). Para formulários, use `abrirPainel()` (`core/painel.js`); para confirmações, `mostrarConfirmacao()` (`core/modal.js`); para datas, `core/datas.js`; para avisos rápidos, `mostrarNotificacao()` (`core/ui.js`). Um módulo lê os moradores com `obterIntegrantes()` e reage a mudanças com `ouvir('moradores:atualizados', ...)`, sem depender de outros módulos.

### Início

- `core/inicio.js` é a página de abertura (`#/inicio`, primeiro módulo da lista): mostra um cartão para cada módulo ativo que exporta `inicio` e cuja `permissao` o usuário tem.
- Cada cartão carrega sozinho (`conteudo()`); se um falhar, os outros continuam. `aoMontar(elemento, atualizar)` liga eventos do cartão (ex.: o campo rápido da lista de compras) e `atualizar()` recarrega só ele.
- Quais cartões aparecem e a ordem ficam no `localStorage` (`escala:inicio`), por aparelho.
- Módulos só do frontend, como o Início, usam `semBackend: true` para não depender de `GET /api/sessao`.

### Finanças e Open Finance

- `modules/financas/` (backend): `store.js` (tabelas `fin_*`), `regras.js` (categorização por "contém" com `sentido` opcional; vence o termo mais longo; `termoDoGrupo` agrupa descrições parecidas para as sugestões), `sincronizacao.js` e `provedores/`.
- Regras: `GET /financas/regras` traz quantos lançamentos cada uma categoriza; `GET /financas/regras/sugestoes` agrupa os sem categoria; `POST /financas/regras/previa` calcula o efeito de uma regra antes de salvar. Criar, editar ou excluir reaplica as regras a tudo que não foi categorizado à mão.
- **Provedores** (`provedores/index.js`) seguem um contrato único: `configurado()`, `conectar(dados)`, `contas(conexao)` e `transacoes(conexao, conta, desde)`, sempre com valores em centavos. A sincronização, a deduplicação (`externo_id`) e as regras não dependem do provedor.
- `provedores/demo.js` simula um banco e só aparece com a variável `FINANCAS_PROVEDOR_DEMO=1` (para testes); `provedores/pluggy.js` lê bancos do **Meu Pluggy** (plano gratuito): o app abre o widget **Pluggy Connect** (`widget()` devolve o script e um connect token de 30 min, limitado ao conector MeuPluggy) e recebe o `itemId` no `onSuccess`; também aceita colar o `itemId` (declarado em `campos`, que a tela de conectar mostra como formulário). A sincronização lê `/accounts`, `/investments` e `/transactions` da API da Pluggy. Lançamentos pendentes ficam de fora (ganham outro id ao confirmar); o valor usa o sinal de `amount` (saída negativa, como no app; o `type` não serve, porque compra no cartão chega como CREDIT), e um cartão com fatura positiva tem os sinais invertidos, por garantia.
- Um agendador externo pode chamar `GET /api/financas/sincronizar` uma vez por dia (veja [deploy.md](deploy.md#5-sincronização-diária-das-finanças-opcional)). Com `CRON_SECRET` definido, a chamada do agendador é aceita mesmo quando houver login.
- Frontend (`modules/financas/`): `dados.js` (estado, API e formatação), `graficos.js` (SVG sem biblioteca), uma tela por aba (`visao.js`, `lancamentos.js`, `contas.js`, `divisoes.js`, `ajustes.js`), `regras.js` (editor de regra com prévia), `inicio.js` e `avisos.js`.

### Categorias

- `core/categorias` (backend e frontend) guarda categorias com nome, cor e ícone por **escopo**. Um módulo declara seus escopos em `categorias: { <escopo>: { nome, permissaoVer, permissaoGerenciar, tabela, coluna, filtro?, padrao: [...] } }`; o backend valida com `categoriaExiste(escopo, chave)` e usa `categoriaPadrao(escopo)` quando nada é enviado.
- No frontend: `carregarCategorias(escopo)` no `iniciar()`, `categoria(escopo, chave)` para nome/cor/ícone, `estiloCategoria(c)` para a variável CSS `--cat` e `htmlEscolhaCategoria({ escopo, selecionada })` para os chips de formulário (com o botão "Editar"). Mudanças emitem `categorias:atualizadas`.
- **Subcategorias** (um nível): um escopo com `subcategorias: true` aceita `pai` (chave de uma categoria principal) na criação e na edição. O backend recusa subcategoria dentro de subcategoria, principal com filhas dentro de outra e excluir principal com filhas. Os registros guardam a chave mais específica; no frontend, `categoria()` traz `nomeCompleto` ("Mercado › Limpeza") e `emOrdemDeArvore`, `subcategoriasDe`, `categoriaRaiz` e `dentroDe(escopo, chave, alvo)` montam a árvore e as somas por categoria principal.

### Navegação e avisos

- `core/shell.js` monta a navegação a partir da lista de módulos: **menu lateral** (≥ 900px) e **barra inferior** no celular (até 5 itens; a partir do 6º módulo, os últimos vão para "Mais"). A ordem é a de `MODULOS` no `main.js`; `nomeCurto` é o rótulo na barra inferior.
- Módulos com `menu: 'usuario'` (Moradores e Ajustes) ficam no **menu do canto superior direito**, junto do avatar. Com a senha da casa ligada, o botão **Sair deste aparelho** fica aqui; é também o lugar previsto para o perfil quando houver login por morador (`obterSessao().usuario`).
- `core/avisos.js` junta os `avisos()` dos módulos ativos no **sino**. Cada aviso tem `id` estável; os já vistos ficam no `localStorage` (`escala:avisos-vistos`) e o contador mostra só os novos. A lista é recarregada a cada 5 minutos e ao abrir o sino.

### Ligar e desligar módulos

- Módulos com `nucleo: false` podem ser desligados em **Ajustes → Módulos** (`PUT /api/modulos/:id`). A lista fica em `config.modulos_desativados`.
- `core/modulos.js` monta cada módulo atrás de um filtro: se ele estiver desligado, a requisição pula o router do módulo e termina no 404 da API. `GET /api/sessao` devolve só os módulos ativos, e o frontend (`main.js`) monta apenas esses.
- Um módulo que usa outro deve checar `moduloAtivo('<id>')` no frontend (ex.: as Atas só sugerem reuniões se a Agenda estiver ligada).

### Sessão, login e permissões

- Toda requisição em `/api` recebe `req.contexto = { modo, autenticado, usuario, republicaId, permissoes }` (`backend/core/auth/sessao.js`).
- Cada rota declara a permissão que exige com `exigirPermissao('modulo:acao')`. Usar uma permissão que nenhum módulo declarou derruba o servidor na subida, para o erro aparecer cedo.
- Papéis: `admin` (pode tudo) e `morador` (recebe as permissões marcadas com `papeis: ['morador']`).
- **`AUTH_MODO=senha` (produção)**: a república tem uma senha única, `SENHA_CASA`. `POST /api/auth/entrar` confere a senha e grava um cookie `HttpOnly` (`Secure` em https, `SameSite=Lax`) assinado com `SESSAO_SEGREDO`, válido por 30 dias (`core/auth/senha.js`). Sem esse cookie, toda a API e as imagens respondem `401`, menos `/api/versao` (verificação de saúde do Render) e o agendador das finanças. Quem entra é admin. Depois de 10 senhas erradas em 15 minutos, o IP espera. Trocar `SENHA_CASA` ou `SESSAO_SEGREDO` desconecta todos os aparelhos.
- **`AUTH_MODO=aberto` (padrão, só para testes locais)**: sem login; todo acesso é tratado como admin.
- `GET /api/sessao` informa ao frontend o usuário, as permissões e os módulos ativos. O frontend esconde os elementos com `data-permissao="..."` que o usuário não pode usar. Isso é só conveniência visual: quem barra de verdade é o backend (401 sem login, 403 sem permissão).
- `republicaId` fica reservado (hoje `null`) para quando o app atender mais de uma república.

No frontend, quando `GET /api/sessao` (ou qualquer chamada) responde `401`, `main.js` troca a página pela tela de entrada (`core/entrada.js`); depois de entrar, a página recarrega.

**Para um login por morador no futuro:** criar outro resolvedor em `core/auth/sessao.js` (que confira a sessão numa tabela própria e busque o papel do usuário numa tabela de perfis ligada a `integrantes`) e definir `AUTH_MODO` com ele.

As rotas e as telas dos módulos não precisam mudar.
