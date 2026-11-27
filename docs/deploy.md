# ☁️ Deploy: Render + Neon + Cloudflare R2

O app está publicado em **https://repplus.onrender.com**, a partir do repositório [GDPonsoni/RepPlus](https://github.com/GDPonsoni/RepPlus).

Em produção o RepPlus usa três serviços, todos com plano gratuito:

| Serviço | Para quê | Variáveis |
| :--- | :--- | :--- |
| **Neon** | Banco Postgres (todas as tabelas) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| **Cloudflare R2** | Imagens enviadas (logo, fundo, cômodos, galeria) e os documentos do mural (fotos e PDFs), num bucket **privado** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| **Google Drive** (opcional) | Aba **Drive** do módulo Documentos: lê a pasta da rep, que continua privada, com login da conta Google da rep feito uma vez | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (veja a [seção 7](#7-pasta-do-google-drive-opcional)) |
| **Render** | Servidor Node que entrega o site, a API e as imagens | as de cima, mais `AUTH_MODO`, `SENHA_CASA`, `SESSAO_SEGREDO`, `CRON_SECRET` e, para o Open Finance, `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` |

**Nada fica público.** O app pede a senha da casa (`SENHA_CASA`) antes de mostrar qualquer dado. O bucket do R2 não tem endereço público: o navegador pede `/api/midia/<arquivo>` ao servidor, que busca a imagem no R2 só para quem entrou.

Faça na ordem abaixo: o Render precisa do banco e do bucket já criados.

---

## 1. Banco no Neon

O projeto **RepPlus** (região AWS **us-east-1**, a mesma do Render em Virginia) está ligado a este repositório pelo `neon.ts` e pelo arquivo local `.neon`, que não vai para o git.

- **Criar o projeto do zero** (só se precisar): `npx neon@latest init` na raiz, escolhendo a região `aws-us-east-1`.
- **Pegar as URLs**: `npx neon@latest env pull` grava `DATABASE_URL` (com `-pooler`, usada pelo app) e `DATABASE_URL_UNPOOLED` (direta, usada pelas migrações) no `.env`. Também dá para copiar no painel da Neon, em **Connect**, com *Connection pooling* ligado e desligado.

As tabelas não precisam ser criadas à mão: o Render roda `npm run db:migrar` a cada deploy. Veja as [migrações](../db/README.md).

## 2. Imagens no Cloudflare R2 (bucket privado)

1. No painel da Cloudflare, abra **R2 → Create bucket** e crie o bucket (ex.: `repplus-uploads`). Esse é o `R2_BUCKET`.
   - **Não** ative o *r2.dev subdomain* nem um *Custom Domain* em **Settings → Public access**. O bucket fica privado.
   - Não precisa configurar CORS: o navegador nunca fala direto com o R2.
2. Em **R2 → Manage API tokens → Create API token** (ou *Create Account API token*), crie um token com:
   - permissão **Object Read & Write**;
   - **Apply to specific buckets only**, marcando só o bucket criado;
   - sem validade, ou com uma data que você vá lembrar de renovar.

   Ao criar, a Cloudflare mostra o **Access Key ID** (`R2_ACCESS_KEY_ID`) e o **Secret Access Key** (`R2_SECRET_ACCESS_KEY`). O segredo aparece **uma vez só**: copie direto para o `.env`.
3. O **Account ID** (`R2_ACCOUNT_ID`) aparece na página inicial do R2, em *Account Details*.

## 3. Servidor no Render

O repositório já tem um [`render.yaml`](../render.yaml) (Blueprint) com:
- o serviço web;
- o comando de build, que instala as dependências e aplica as migrações;
- o comando de início;
- a verificação de saúde (`/api/versao`);
- `AUTH_MODO=senha` e os segredos `SESSAO_SEGREDO` e `CRON_SECRET`, que o Render gera sozinho.

1. Em [render.com](https://render.com), entre com o GitHub e abra **New → Blueprint**.
2. Escolha o repositório `GDPonsoni/RepPlus`. O Render lê o `render.yaml` e pede as variáveis marcadas com `sync: false`: `SENHA_CASA`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e as quatro `R2_*`.
   - Outra opção: em **Environment → Add from .env**, cole o seu `.env` local **sem** as linhas do Supabase.
3. Confirme. O primeiro deploy cria as tabelas no Neon e publica o app em `https://repplus.onrender.com` (o endereço atual), ou em um nome parecido se esse já estiver em uso.

O Blueprint publica a branch `main` (campo `branch:` no `render.yaml`, ou em Settings no Render). Cada push nela publica sozinho.

**Plano gratuito:** o servidor dorme depois de 15 minutos sem acesso, e o primeiro acesso depois disso leva cerca de 1 minuto. Os dados não se perdem, porque ficam no Neon e no R2.

**Trocar a senha da casa:** em **Environment**, mude `SENHA_CASA` e salve. Todos os aparelhos precisam entrar de novo.

## 3b. Cópia na Vercel (opcional)

O mesmo app também roda na Vercel (https://repplus-one.vercel.app), com o mesmo banco e o mesmo bucket. O `vercel.json` publica `frontend/` pela CDN e manda `/api/*` para a função `api/index.js`, que usa o mesmo `createApp()` do Render.

- **Branch de produção:** `main` (Settings → Environments → Production). Cada push na `main` publica no Render e na Vercel.
- **Variáveis:** as mesmas do Render (Settings → Environment Variables). Sem `DATABASE_URL` ou, no `AUTH_MODO=senha`, sem `SENHA_CASA`/`SESSAO_SEGREDO`, a função falha ao subir.
- **Migrações:** só o build do Render roda `db:migrar`. Num deploy com migração nova, a Vercel pode ficar no ar alguns instantes antes do banco ser atualizado.
- **Limites da função:** o corpo da requisição e da resposta na Vercel vai até 4,5 MB. Imagens entre 4,5 MB e 5 MB e documentos do mural acima de 4,5 MB (o limite é 10 MB) só sobem pelo Render, e arquivos do Drive maiores que isso só abrem pelo Render (ou pelo botão **Abrir no Drive**). O bloqueio de tentativas de login fica na memória de cada instância.
- O login vale por endereço: entrar no Render não entra na Vercel, e vice-versa.

## 4. Trazer os dados do app antigo (Supabase)

Rode uma vez, **no computador**, antes de a casa começar a usar o endereço novo:

1. No `.env` (veja o [`.env.example`](../.env.example)), coloque:
   - as variáveis novas: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `R2_*`;
   - as do Supabase antigo: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Elas estão no painel do Supabase (Project Settings → API) ou nas variáveis de ambiente da Vercel.
2. Rode:
   ```bash
   npm install
   npm run db:migrar            # garante as tabelas (o deploy do Render já faz isso)
   npm run db:importar-supabase
   ```

O importador:
- copia as imagens do bucket `uploads` para o R2;
- copia todas as tabelas, trocando as URLs das imagens pelo caminho privado `/api/midia/...`;
- pula as tabelas que o app antigo ainda não tinha;
- avisa sobre as colunas antigas que não existem mais.

Ele **não apaga nada** no Supabase e pode ser rodado de novo sem duplicar linhas. Mas uma linha com o mesmo id volta a ficar como estava no Supabase, então não rode de novo depois que a casa já estiver usando o app novo.

Depois de conferir o app novo, apague `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do `.env`. O bucket `uploads` do Supabase antigo é **público**: desligue o Supabase e a Vercel assim que tiver certeza de que não precisa mais deles.

## 5. Sincronização diária das finanças (opcional)

Só faz diferença quando houver um banco conectado por Open Finance (veja a seção 6).

Configure um agendador gratuito (ex.: [cron-job.org](https://cron-job.org)) para chamar uma vez por dia:

```
GET https://repplus.onrender.com/api/financas/sincronizar
Authorization: Bearer <CRON_SECRET>
```

O valor de `CRON_SECRET` está nas variáveis de ambiente do serviço no Render.

## 6. Open Finance com a Pluggy (Meu Pluggy)

O app lê saldos e lançamentos dos bancos pelo **Meu Pluggy**, o caminho **gratuito** da Pluggy para quem lê as **próprias** contas:
- até **5 conexões**, só para uso pessoal;
- os bancos atualizam sozinhos **uma vez a cada 24h** (não dá para forçar);
- a autorização vale **1 ano**.

O plano comercial, em que cada morador conecta o próprio banco direto, sem passar pelo Meu Pluggy, custa a partir de R$ 2.500/mês e não é usado.

**Uma vez (dentro dos 15 dias do trial da conta Pluggy, por garantia):**
1. Crie a conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. Em **Applications**, crie uma aplicação. Copie o **Client ID** e gere o **Client Secret**: ele aparece **uma vez só**. Esses dois valores são `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, no `.env` e no Render (**Environment**).
3. Em **Customization → Connectors**, confira se o conector **MeuPluggy** está ligado.

**Para cada banco:**
1. Em [meu.pluggy.ai](https://meu.pluggy.ai), entre com a **mesma conta** e autorize o banco pelo Open Finance. Você é levado ao app do banco para aprovar.
2. No app, abra **Finanças → Contas → Conectar banco → Pluggy** e, se quiser, dê um nome (ex.: "Nubank da casa").
3. Toque em **Conectar**. Abre o widget da Pluggy, que mostra só o conector **MeuPluggy**. Entre com a conta do Meu Pluggy e escolha o banco.
4. Ao terminar, as contas, o cartão e os investimentos aparecem com os lançamentos dos últimos 90 dias.

Também dá para conectar um item criado no Dashboard (**Applications → Demo → Connect Account**): em **Já tenho o Item ID**, cole o ID copiado de **Connected Items**.

**Para testar sem dados reais:** com `PLUGGY_SANDBOX=1` no `.env`, o widget mostra também o **Pluggy Bank** (sandbox), com usuário `user-ok` e senha `password-ok`. Não ligue essa variável no Render.

**Quando a autorização vencer** (1 ano), a conexão mostra o erro. Autorize de novo no Meu Pluggy, conecte de novo pelo app e desconecte a conexão antiga. Os lançamentos já importados continuam no app.

## 7. Pasta do Google Drive (opcional)

A aba **Documentos → Drive** mostra a pasta da rep no Google Drive dentro do app, **só para ler**: navegar nas pastas, ver imagens, abrir PDFs e documentos do Google (convertidos em PDF) e baixar arquivos.

Funciona com **login com Google**: alguém da administração toca em **Conectar com Google**, entra **uma vez** com a conta Google da rep e escolhe a pasta. A autorização fica guardada no banco e vale para todos: os moradores não fazem login no Google. A pasta **não** precisa ficar pública: o navegador pede tudo ao servidor (`/api/documentos/drive/...`), que só responde a quem entrou com a senha da casa, e o app recusa qualquer arquivo fora da pasta escolhida.

**Uma vez no Google Cloud (gratuito, uns 10 minutos), de preferência logado com a conta da rep:**
1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: `repplus`).
2. Em **APIs e serviços → Biblioteca**, procure **Google Drive API** e clique em **Ativar**.
3. Em **APIs e serviços → Tela de permissão OAuth** (ou **Google Auth Platform**):
   - Tipo de usuário **Externo**, nome do app `RepPlus` e o seu e-mail de suporte.
   - Em **Acesso a dados** (escopos), adicione `.../auth/drive.readonly`.
   - Em **Público-alvo**, clique em **Publicar app** (status **Em produção**). **Não deixe em "Teste"**: nesse modo o Google desfaz a conexão a cada 7 dias.
   - O app não precisa ser verificado. No login aparece o aviso "O Google não verificou este app": clique em **Avançado → Acessar RepPlus (não seguro)**. Só quem conecta vê esse aviso, uma vez.
4. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo **Aplicativo da Web**.
   - Em **URIs de redirecionamento autorizados**, adicione um por endereço do app:
     - `https://repplus.onrender.com/api/documentos/drive/callback`
     - `https://repplus-one.vercel.app/api/documentos/drive/callback` (se usar a Vercel)
     - `http://localhost:3000/api/documentos/drive/callback` (testes locais; o servidor de teste usa a porta 4000)
   - Copie o **ID do cliente** e a **Chave secreta do cliente**.

**Variáveis** (no `.env`, no Render em **Environment** e na Vercel se usar):
- `GOOGLE_CLIENT_ID`: o ID do cliente.
- `GOOGLE_CLIENT_SECRET`: a chave secreta. Ela também protege a autorização guardada no banco (que fica criptografada): **trocar a chave exige conectar de novo**.

**No app:** **Documentos → Drive → Conectar com Google**, entre com a conta da rep, permita o acesso ao Drive e escolha a pasta (em **Meu Drive** ou **Compartilhados comigo**) com **Usar "..."**. Pronto: todos passam a ver a pasta. A conexão é feita pelo endereço em que você está (Render ou Vercel), mas vale para os dois, porque o banco é o mesmo.

**Trocar a pasta ou a conta:** na aba Drive, **Trocar pasta** ou **Desconectar** (só quem tem a permissão de gerenciar documentos). Desconectar também revoga o acesso no Google. Para tirar o acesso pelo lado do Google: [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → RepPlus → remover.

**Se a conexão cair** (senha da conta da rep trocada, acesso removido, app em modo Teste), a aba Drive avisa e mostra **Conectar de novo**. Reconectando com a mesma conta, a pasta escolhida continua a mesma.

**Atenção:** a autorização permite **ler todo o Drive da conta da rep**. O app só mostra a pasta escolhida, mas proteja o banco e o `GOOGLE_CLIENT_SECRET` como as outras senhas do servidor. Se a conta da rep tiver coisas que não são da casa, prefira usar uma conta Google só para a rep.
