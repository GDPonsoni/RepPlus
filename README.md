# 🏠 Escala - Sistema de Escalas de Limpeza

Aplicação web para organizar a república, dividida em módulos: **escala de limpeza** (rodízio automático de cômodos e folgas, regra do banheiro da suíte, infrações), **agenda conjunta** (eventos e aniversários), **lista de compras**, **anotações** (senhas num cofre criptografado, contatos de prestadores, notas), **atas de reunião**, **finanças** (gastos, contas, reserva e divisão de despesas, preparado para Open Finance) e **cadastro de moradores**, com personalização visual.

## ⚡ Como Rodar

1. Crie um arquivo `.env` na raiz do projeto:
   ```env
   SUPABASE_URL=https://<seu-projeto>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<chave service_role do projeto>
   # Opcional: protege a sincronização diária das finanças (a Vercel envia este segredo no agendamento)
   CRON_SECRET=<texto aleatório>
   ```
2. Instale e inicie (na raiz do projeto):
   ```bash
   npm install
   npm start
   ```
3. Aplique as migrações de [`db/migrations/`](db/README.md) no Supabase (SQL Editor), se ainda não aplicou.
4. Acesse **http://localhost:3000**

Em produção o app roda na Vercel (`vercel.json`), com as mesmas variáveis de ambiente configuradas no painel. O `vercel.json` também agenda `GET /api/financas/sincronizar` uma vez por dia (06:00 de Brasília) para atualizar os bancos conectados.

---

## ✨ Funcionalidades Principais

- 🔄 **Rodízio semanal sem sorteio**: cada pessoa passa pelos cômodos em sequência, sem repetir o mesmo cômodo na semana seguinte.
- 🛁 **Regra da suíte**: o banheiro da suíte é feito só por moradores da suíte, um por semana, em revezamento.
- ☕ **Folgas automáticas e iguais para todos**: sobram `integrantes ativos − vagas obrigatórias` folgas por semana, para quem está há mais tempo sem folgar.
- ❌ **Infrações** com contador e histórico por integrante.
- 🎨 **Personalização visual**: nome da república, logo, fundo, cores e paletas prontas, fonte, cantos, estilo do cabeçalho, galeria de imagens motivacionais e tema claro/escuro por aparelho.
- 📅 **Histórico** das escalas de semanas anteriores.
- 🗓️ **Agenda conjunta**: eventos com data, hora, local e descrição, em visão mensal e semanal; aniversários dos moradores entram sozinhos.
- 🛒 **Lista de compras**: o que acabou ou está acabando, sugestões dos itens já comprados, marcar como comprado no mercado e enviar a lista para o grupo.
- 🔐 **Anotações**: senhas e contas num cofre criptografado no próprio aparelho (AES-256, senha da casa), contatos de prestadores com ligar/WhatsApp/mapa e notas da casa.
- 📝 **Atas de reunião**: o que foi discutido, decisões e encaminhamentos com responsável e prazo; aba de pendências e sugestão de ata para as reuniões da agenda.
- 👥 **Cadastro de moradores** global: contatos, contato de emergência, nascimento, data de entrada, documentos e observações.
- 🏠 **Início**: resumo dos módulos ligados (escala da semana, próximos eventos, compras, pendências, aniversários), personalizável em cada aparelho.
- 💰 **Finanças**: contas e cartões (manuais ou conectados), lançamentos com categorização automática por regras, gráficos por período, orçamento por categoria, reserva de emergência e divisão de despesas entre moradores ("quem deve para quem"). A conexão com bancos via Open Finance (Pluggy) está preparada e será ligada quando houver credenciais.
- 🏷️ **Categorias gerenciáveis**: nome, cor e ícone das categorias da agenda, compras e anotações.
- 🧭 **Navegação** de app: barra inferior no celular, menu lateral no computador, sino de avisos e menu do usuário no canto.
- 🧩 **Módulos**: cada república liga só os módulos que usa (Ajustes → Módulos); novos módulos entram sem mexer no núcleo.

---

## 📚 Documentação

A documentação detalhada está na pasta [`docs/`](docs/README.md):

- 🏗️ [**Arquitetura**](docs/architecture.md) — backend, frontend, banco e o algoritmo do rodízio.
- 🔌 [**Referência da API**](docs/api.md) — endpoints REST `/api/*`.
- 🗄️ [**Modelos de Dados**](docs/data-models.md) — tabelas do Supabase.
- 📖 [**Guia do Usuário**](docs/user-guide.md) — uso no dia a dia.
- ⚡ [**Guia Rápido**](QUICK_START.md) — passo a passo resumido.

---

## 🔧 Stack de Tecnologias

- **Backend**: Node.js + Express + Multer (uploads em memória)
- **Frontend**: HTML5 + CSS3 (variáveis CSS dinâmicas) + JavaScript Vanilla
- **Banco de dados e arquivos**: Supabase (Postgres + Storage)
- **Deploy**: Vercel
