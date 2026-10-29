# 📚 Documentação do Projeto Escala

Bem-vindo à documentação do **Escala**, sistema de gestão e rodízio de escalas de limpeza.

## 📁 Estrutura de Documentos

| Documento | Descrição |
| :--- | :--- |
| 🏗️ [**Arquitetura do Sistema**](architecture.md) | Backend (Node/Express), frontend (SPA Vanilla), Supabase e o algoritmo do rodízio. |
| 🔌 [**Referência de APIs**](api.md) | Todas as rotas REST (`/api/integrantes`, `/api/comodos`, `/api/escala`, `/api/infracoes`, `/api/config`, uploads). |
| 🗄️ [**Modelos de Dados**](data-models.md) | Tabelas do Supabase e o bucket de imagens. |
| 📖 [**Guia do Usuário**](user-guide.md) | Integrantes, cômodos, como o rodízio funciona, infrações e personalização. |
| ⚡ [**Guia Rápido**](../QUICK_START.md) | Instalação e primeira execução. |

---

## 🗺️ Mapa da Estrutura do Código

```
escala/
├── backend/
│   ├── core/                     # Núcleo: usado por todos os módulos
│   │   ├── auth/                 # Sessão (req.contexto) e permissões (exigirPermissao)
│   │   ├── configuracao/         # Aparência: nome, cores, logo, fundo e estilo (tabela config)
│   │   ├── db/                   # Cliente Supabase e helpers de consulta (paginação etc.)
│   │   ├── moradores/            # Integrantes da república
│   │   ├── http.js               # asyncHandler, HttpError, upload (multer) e erros
│   │   ├── modulos.js            # Contrato e montagem dos módulos em /api
│   │   ├── semana.js             # Semana ISO no horário de Brasília
│   │   ├── sistema.js            # /api/versao e /api/sessao
│   │   └── storage.js            # Imagens no Supabase Storage
│   ├── modules/
│   │   ├── agenda/               # Módulo da agenda (eventos)
│   │   ├── anotacoes/            # Módulo de anotações (contas, contatos, notas e cofre)
│   │   ├── compras/              # Módulo da lista de compras
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
│   │   ├── core/                 # Núcleo: api, sessão, abas, ações, moradores, aparência...
│   │   ├── modules/
│   │   │   ├── agenda/           # Mês, semana e formulário de evento
│   │   │   ├── anotacoes/        # Senhas (cofre criptografado), contatos e notas
│   │   │   ├── compras/          # Lista, itens salvos e formulário de item
│   │   │   └── escala/           # Abas da escala (atual, histórico, infrações, ajustes)
│   │   └── main.js               # Inicialização (lista MODULOS)
│   └── index.html                # Casca da aplicação (cabeçalho, abas e conteúdo)
├── db/
│   └── migrations/               # Alterações no esquema do Supabase (aplicar antes do deploy)
├── docs/                         # Esta documentação
├── package.json                  # Dependências e scripts (npm start)
├── vercel.json                   # Deploy na Vercel
└── README.md
```
