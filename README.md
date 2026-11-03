# 🏠 RepPlus - Organização da República

Aplicação web para organizar a república, dividida em módulos que cada casa liga ou desliga: **escala de limpeza** (rodízio automático de cômodos e folgas, regra do banheiro da suíte, infrações), **agenda conjunta** (eventos e aniversários), **lista de compras**, **anotações** (senhas num cofre criptografado, contatos de prestadores, notas), **atas de reunião**, **finanças** (gastos, contas, reserva e divisão de despesas, preparado para Open Finance) e **cadastro de moradores**, com personalização visual.

## ⚡ Como Rodar

1. Copie o [`.env.example`](.env.example) para `.env` na raiz do projeto e preencha:
   ```env
   DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require   # banco Postgres (Neon)
   DATABASE_URL_UNPOOLED=postgresql://...neon.tech/neondb?sslmode=require    # conexão direta, para as migrações
   R2_ACCOUNT_ID=...            # imagens no Cloudflare R2, bucket privado (só para enviar logo, fundo e fotos)
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=repplus-uploads
   AUTH_MODO=senha              # pede a senha da casa para entrar
   SENHA_CASA=...
   SESSAO_SEGREDO=...           # 32+ caracteres aleatórios
   ```
2. Instale, crie as tabelas e inicie (na raiz do projeto):
   ```bash
   npm install
   npm run db:migrar
   npm start
   ```
3. Acesse **http://localhost:3000**

Sem as variáveis `R2_*` o app funciona normalmente; só o envio de imagens avisa que não está configurado. Sem `AUTH_MODO` o app abre sem senha, o que serve só para testar no computador.

### 📱 Testar no celular

Com o servidor rodando no computador e o celular **no mesmo Wi-Fi**, abra no celular o endereço que o `npm start` mostra ao subir (`No celular (mesmo Wi-Fi): http://192.168.x.x:3000`).

- Se não abrir, libere a porta no firewall do computador (no Linux com ufw: `sudo ufw allow 3000/tcp`).
- O **cofre de senhas** (Anotações) usa criptografia do navegador, que só funciona em **https** ou em `localhost`. Pelo endereço `http://192.168...` o resto do app funciona, mas o cofre não destranca. Para testar o cofre no celular, use o endereço https publicado no Render.

### ☁️ Publicar

Em produção o app roda no **Render**, com o banco no **Neon** e as imagens no **Cloudflare R2**. O passo a passo (criar cada serviço, variáveis de ambiente e importar os dados do Supabase antigo) está em [**docs/deploy.md**](docs/deploy.md).

---

## ✨ Funcionalidades Principais

- 🔄 **Rodízio semanal sem sorteio**: cada pessoa passa pelos cômodos em sequência, sem repetir o mesmo cômodo na semana seguinte.
- 🛁 **Regra da suíte**: o banheiro da suíte é feito só por moradores da suíte, um por semana, em revezamento.
- ☕ **Folgas automáticas e iguais para todos**: sobram `integrantes ativos − vagas obrigatórias` folgas por semana, para quem está há mais tempo sem folgar.
- ❌ **Infrações** com contador e histórico por integrante.
- 🎨 **Personalização visual**: nome da república, logo (também no ícone da guia do navegador), fundo, cores e paletas prontas, fonte, cantos, cabeçalho (cor, amplo com o logo em destaque ou compacto), galeria de imagens motivacionais e, por aparelho, tema claro/escuro, tamanho do texto, animações e vibração.
- 📅 **Histórico** das escalas de semanas anteriores.
- 🗓️ **Agenda conjunta**: eventos com data, hora, local e descrição, em visão mensal e semanal; aniversários dos moradores entram sozinhos.
- 🛒 **Lista de compras**: o que acabou ou está acabando, sugestões dos itens já comprados, marcar como comprado no mercado e enviar a lista para o grupo.
- 🔐 **Anotações**: senhas e contas num cofre criptografado no próprio aparelho (AES-256, senha da casa), contatos de prestadores com ligar/WhatsApp/mapa e notas da casa.
- 📝 **Atas de reunião**: o que foi discutido, decisões e encaminhamentos com responsável e prazo; aba de pendências e sugestão de ata para as reuniões da agenda.
- 👥 **Cadastro de moradores** global: contatos, contato de emergência, nascimento, data de entrada, documentos e observações.
- 🏠 **Início**: resumo dos módulos ligados (escala da semana, próximos eventos, compras, pendências, aniversários), personalizável em cada aparelho.
- 💰 **Finanças**: contas e cartões (manuais ou conectados), lançamentos com categorização automática por regras, gráficos por período, orçamento por categoria, reserva de emergência e divisão de despesas entre moradores ("quem deve para quem"). A conexão com bancos via Open Finance (Pluggy) está preparada e será ligada quando houver credenciais.
- 🏷️ **Categorias gerenciáveis**: nome, cor e ícone das categorias da agenda, compras, anotações e finanças.
- 🧭 **Navegação** de app: barra inferior no celular, menu lateral no computador, sino de avisos e menu do usuário no canto. Transições suaves entre telas, painéis que fecham arrastando, notificações animadas e pequenas comemorações (lista de compras zerada, contas acertadas), tudo respeitando o "reduzir movimento" do aparelho.
- 🧩 **Módulos**: cada república liga só os módulos que usa (Ajustes → Módulos); novos módulos entram sem mexer no núcleo.

---

## 📚 Documentação

A documentação detalhada está na pasta [`docs/`](docs/README.md):

- 🏗️ [**Arquitetura**](docs/architecture.md) — backend, frontend, banco e o algoritmo do rodízio.
- 🔌 [**Referência da API**](docs/api.md) — endpoints REST `/api/*`.
- 🗄️ [**Modelos de Dados**](docs/data-models.md) — tabelas do banco.
- ☁️ [**Deploy**](docs/deploy.md) — Render, Neon e Cloudflare R2.
- 📖 [**Guia do Usuário**](docs/user-guide.md) — uso no dia a dia.
- ⚡ [**Guia Rápido**](QUICK_START.md) — passo a passo resumido.

---

## 🔧 Stack de Tecnologias

- **Backend**: Node.js + Express + Multer (uploads em memória)
- **Frontend**: HTML5 + CSS3 (variáveis CSS dinâmicas) + JavaScript Vanilla (módulos ES nativos, sem etapa de build) + Font Awesome
- **Banco de dados**: Postgres no Neon (driver `pg`, migrações em [`db/`](db/README.md))
- **Imagens**: Cloudflare R2 (API compatível com S3)
- **Deploy**: Render (`render.yaml`)
