# 📚 Documentação do Projeto Escala

Bem-vindo à documentação do **Escala**, app de organização da república: escala de limpeza, agenda, lista de compras, anotações, atas de reunião e finanças, em módulos que cada casa liga ou desliga.

## 📁 Estrutura de Documentos

| Documento | Descrição |
| :--- | :--- |
| 🏗️ [**Arquitetura do Sistema**](architecture.md) | Backend (Node/Express), frontend (SPA Vanilla), Supabase, contrato dos módulos, permissões, Open Finance e o algoritmo do rodízio. |
| 🔌 [**Referência de APIs**](api.md) | Todas as rotas REST em `/api`: sessão e módulos, moradores, escala, agenda, compras, anotações, atas, finanças, categorias e configuração. |
| 🗄️ [**Modelos de Dados**](data-models.md) | Tabelas do Supabase, o bucket de imagens e o que fica guardado em cada aparelho. |
| 📖 [**Guia do Usuário**](user-guide.md) | Uso no dia a dia de cada módulo, ajustes e personalização. |
| 🗃️ [**Migrações do banco**](../db/README.md) | Alterações no esquema do Supabase, na ordem de aplicação. |
| ⚡ [**Guia Rápido**](../QUICK_START.md) | Instalação e primeira execução. |

---

## 🗺️ Mapa da Estrutura do Código

```
escala/
├── backend/
│   ├── core/                     # Núcleo: usado por todos os módulos
│   │   ├── auth/                 # Sessão (req.contexto) e permissões (exigirPermissao)
│   │   ├── categorias/           # Categorias com nome, cor e ícone, por escopo dos módulos
│   │   ├── configuracao/         # Aparência: nome, cores, logo, fundo e estilo (tabela config)
│   │   ├── db/                   # Cliente Supabase e helpers de consulta (paginação etc.)
│   │   ├── moradores/            # Integrantes da república
│   │   ├── http.js               # asyncHandler, HttpError, upload (multer) e erros
│   │   ├── modulos.js            # Contrato e montagem dos módulos em /api (liga/desliga)
│   │   ├── semana.js             # Semana ISO no horário de Brasília
│   │   ├── sistema.js            # /api/versao, /api/sessao e /api/modulos
│   │   └── storage.js            # Imagens no Supabase Storage
│   ├── modules/
│   │   ├── agenda/               # Módulo da agenda (eventos)
│   │   ├── anotacoes/            # Módulo de anotações (contas, contatos, notas e cofre)
│   │   ├── atas/                 # Módulo de atas de reunião
│   │   ├── compras/              # Módulo da lista de compras
│   │   ├── financas/             # Módulo de finanças (contas, lançamentos, divisões, Open Finance)
│   │   │   ├── rotas/            # Contas, lançamentos, divisões e ajustes
│   │   │   ├── provedores/       # Open Finance: contrato, banco de demonstração e Pluggy
│   │   │   ├── regras.js         # Categorização automática por "contém"
│   │   │   └── sincronizacao.js  # Importa dos bancos sem duplicar
│   │   └── escala/               # Módulo da escala de limpeza
│   │       ├── rotas/            # Cômodos, escala, infrações e motivação
│   │       ├── rodizio.js        # Algoritmo do rodízio semanal (folgas, suíte, cômodos)
│   │       ├── store.js          # Tabelas comodos, escalas e infracoes
│   │       └── index.js          # Definição do módulo (permissões e rotas)
│   ├── app.js                    # Monta o Express com os módulos (lista MODULOS)
│   └── server.js                 # Ponto de entrada (local e Vercel)
├── frontend/
│   ├── css/
│   │   └── style.css             # Estilos responsivos e tema com variáveis CSS
│   ├── js/
│   │   ├── core/                 # Núcleo: navegação (shell), início, avisos, painéis, animações,
│   │   │                         # categorias, moradores, aparência, ajustes do sistema...
│   │   ├── modules/
│   │   │   ├── agenda/           # Mês, semana e formulário de evento
│   │   │   ├── anotacoes/        # Senhas (cofre criptografado), contatos e notas
│   │   │   ├── atas/             # Atas, pendências e formulário da ata
│   │   │   ├── compras/          # Lista, itens salvos e formulário de item
│   │   │   ├── financas/         # Visão geral, lançamentos, contas, divisões e ajustes
│   │   │   └── escala/           # Abas da escala (atual, histórico, infrações, ajustes)
│   │   └── main.js               # Inicialização (lista MODULOS)
│   └── index.html                # Casca da aplicação (cabeçalho, menus, abas e conteúdo)
├── db/
│   └── migrations/               # Alterações no esquema do Supabase (aplicar antes do deploy)
├── docs/                         # Esta documentação
├── package.json                  # Dependências e scripts (npm start)
├── vercel.json                   # Deploy na Vercel e sincronização diária das finanças
├── QUICK_START.md                # Guia rápido
└── README.md
```
