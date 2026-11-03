# ☁️ Deploy: Render + Neon + Cloudflare R2

O app está publicado em **https://repplus.onrender.com**, a partir do repositório [GDPonsoni/RepPlus](https://github.com/GDPonsoni/RepPlus).

Em produção o RepPlus usa três serviços, todos com plano gratuito:

| Serviço | Para quê | Variáveis |
| :--- | :--- | :--- |
| **Neon** | Banco Postgres (todas as tabelas) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| **Cloudflare R2** | Imagens enviadas (logo, fundo, cômodos, galeria), num bucket **privado** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| **Render** | Servidor Node que entrega o site, a API e as imagens | as de cima, mais `AUTH_MODO`, `SENHA_CASA`, `SESSAO_SEGREDO` e `CRON_SECRET` |

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

O Blueprint publica a branch `feat/modulos`. Quando ela for unida ao `main`, troque `branch:` no `render.yaml` (ou em Settings no Render). Cada push na branch publica sozinho.

**Plano gratuito:** o servidor dorme depois de 15 minutos sem acesso, e o primeiro acesso depois disso leva cerca de 1 minuto. Os dados não se perdem, porque ficam no Neon e no R2.

**Trocar a senha da casa:** em **Environment**, mude `SENHA_CASA` e salve. Todos os aparelhos precisam entrar de novo.

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

Só faz diferença quando houver um banco conectado por Open Finance (Pluggy), que ainda não está ligado.

Quando estiver, configure um agendador gratuito (ex.: [cron-job.org](https://cron-job.org)) para chamar uma vez por dia:

```
GET https://repplus.onrender.com/api/financas/sincronizar
Authorization: Bearer <CRON_SECRET>
```

O valor de `CRON_SECRET` está nas variáveis de ambiente do serviço no Render.
