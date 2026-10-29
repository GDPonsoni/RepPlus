# 🔌 Referência da API REST

O backend expõe a API sob o prefixo `/api`. Requisições com corpo usam `Content-Type: application/json`, exceto os uploads, que usam `multipart/form-data`. Erros de validação retornam `400` com `{ "error": string }`.

Cada rota exige uma permissão (veja [Módulos e Permissões](architecture.md#-módulos-e-permissões)). No modo atual (`AUTH_MODO=aberto`, sem login) todo acesso tem todas as permissões; quando houver login, a falta de login retorna `401` e a falta de permissão retorna `403`.

---

## 👥 Integrantes (`/api/integrantes`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/integrantes` | Lista todos os integrantes | Array de `Integrante` |
| `POST` | `/api/integrantes` | Cria um integrante | `{ "nome": string, "isSuite"?, "ativo"?, ...cadastro }` |
| `PUT` | `/api/integrantes/:id` | Atualiza um integrante (só os campos enviados) | `{ "nome"?, "isSuite"?, "ativo"?, ...cadastro }` |
| `DELETE` | `/api/integrantes/:id` | Remove um integrante | `{ "success": true }` |

Nomes de integrantes não podem se repetir (sem diferenciar maiúsculas).

**Campos do cadastro** (todos opcionais; `""` ou `null` apaga o campo): `nomeCompleto`, `dataNascimento` e `dataEntrada` (`AAAA-MM-DD`), `telefone`, `email`, `observacoes`, `emergenciaNome`, `emergenciaParentesco`, `emergenciaTelefone`, `cpf`, `rg`. `cpf` e `rg` só aparecem nas respostas e só podem ser alterados com a permissão `moradores:documentos`.

---

## 📅 Agenda (`/api/eventos`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/eventos?de=...&ate=...` | Eventos que acontecem no período (datas ISO 8601; máximo 62 dias) | Array de `Evento`, em ordem de início |
| `POST` | `/api/eventos` | Cria um evento | `{ "titulo", "inicio", "fim"?, "diaInteiro"?, "categoria"?, "local"?, "descricao"?, "recorrencia"?, "recorrenciaAte"? }` |
| `PUT` | `/api/eventos/:id` | Atualiza um evento ou a série inteira de um evento recorrente (só os campos enviados) | Mesmos campos |
| `POST` | `/api/eventos/:id/excecoes` | Cancela uma única repetição de um evento recorrente | `{ "data": "AAAA-MM-DD" }` |
| `DELETE` | `/api/eventos/:id` | Exclui um evento (ou a série inteira) | `{ "success": true }` |

`categoria`: `geral` (padrão), `festa`, `reuniao`, `visita` ou `manutencao`. O término não pode ser antes do início, e um evento dura no máximo 31 dias.

**Repetição**: `recorrencia` pode ser `semanal`, `quinzenal`, `mensal` ou `anual` (`null` = não repete); `recorrenciaAte` (`AAAA-MM-DD`, opcional) é o último dia em que ainda repete. No `GET`, cada repetição dentro do período vem como uma entrada separada, com o mesmo `id` da série e os campos extras `ocorrencia` (dia da repetição), `serieInicio` e `serieFim` (datas da primeira). Repetições mensais no dia 29, 30 ou 31 caem no último dia dos meses mais curtos. Cada repetição dura no máximo 6 dias (semanal), 13 (quinzenal), 27 (mensal) ou 31 (anual). Aniversários não são eventos: o frontend os monta a partir do cadastro de moradores.

---

## 🛒 Lista de Compras (`/api/compras/itens`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/compras/itens` | Todos os itens salvos (na lista e em casa) | Array de `ItemCompra` |
| `POST` | `/api/compras/itens` | Adiciona à lista. Se já existe um item com o mesmo nome (ignorando maiúsculas, acentos e espaços), reaproveita esse registro | `{ "nome", "status"? (padrão `falta`), "categoria"?, "quantidade"?, "observacao"?, "pedidoPor"? }`. Retorna o item, com `reaproveitado` e `jaEstavaNaLista` quando reaproveitou |
| `PUT` | `/api/compras/itens/:id` | Edita (só os campos enviados) | Mesmos campos |
| `POST` | `/api/compras/itens/:id/comprar` | Marca como comprado: volta para `ok`, grava `compradoEm`, soma 1 em `vezesComprado` e limpa o pedido | `ItemCompra` |
| `POST` | `/api/compras/itens/:id/desfazer-compra` | Desfaz um "comprei" | `{ "anterior": { "status", "compradoEm"?, "pedidoEm"?, "pedidoPor"?, "quantidade"? } }` |
| `DELETE` | `/api/compras/itens/:id` | Apaga o item dos salvos (permissão `compras:gerenciar`) | `{ "success": true }` |

`status`: `falta` (acabou, comprar), `acabando` (avisado, ainda tem) ou `ok` (em casa). `categoria`: `mercado` (padrão), `limpeza`, `higiene`, `bebidas`, `casa` ou `outros`. `pedidoPor` é o `id` de um morador. Ao entrar na lista, `pedidoEm` recebe a hora atual; ao voltar para `ok`, o pedido (quem, quando, quantidade) é limpo.

---

## 🔐 Anotações (`/api/anotacoes`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/anotacoes` | Todas as anotações (segredos vêm cifrados) | Array de `Anotacao` |
| `POST` | `/api/anotacoes` | Cria | `{ "tipo", "titulo", "categoria"?, "dados"?, "segredo"?, "fixado"?, "provaCofre"? }` |
| `PUT` | `/api/anotacoes/:id` | Edita (só os campos enviados; o tipo não muda) | Mesmos campos, sem `tipo` |
| `DELETE` | `/api/anotacoes/:id` | Apaga | `{ "success": true }` |
| `GET` | `/api/anotacoes/cofre` | Dados para destrancar o cofre no navegador | `{ "existe": false }` ou `{ "existe": true, "salt", "iteracoes", "chaveCifrada" }` |
| `POST` | `/api/anotacoes/cofre` | Cria o cofre (409 se já existe) | `{ "salt", "iteracoes", "chaveCifrada", "prova" }` |
| `PUT` | `/api/anotacoes/cofre` | Troca a senha do cofre (exige a `prova` atual) | `{ "salt", "iteracoes", "chaveCifrada", "prova" }` |
| `DELETE` | `/api/anotacoes/cofre` | Apaga o cofre e todos os segredos (senha esquecida) | `{ "success": true, "segredosApagados" }` |

- `tipo`: `conta`, `contato` ou `nota`. Campos aceitos em `dados` (o resto é descartado): conta `site`, `observacao`; contato `telefone`, `whatsapp` (boolean), `email`, `site`, `endereco`, `observacao`; nota `texto`.
- `categoria`: na conta, `internet`, `streaming`, `consumo`, `banco`, `compras` ou `outros`; no contato, o serviço em texto livre (ex.: "Eletricista").
- **`segredo`** é texto já cifrado pelo navegador (`v1.<iv>.<conteúdo>`, base64). Gravar, trocar ou remover um segredo exige `provaCofre`, que só quem destrancou o cofre consegue calcular (senão, 403).
- **Criptografia (no navegador, `frontend/js/modules/anotacoes/cofre.js`)**: senha do cofre → PBKDF2-SHA256 (600 mil iterações) → chave que cifra, com AES-256-GCM, a chave aleatória dos segredos. A prova é o SHA-256 dessa chave mais um texto fixo; o servidor guarda só o hash da prova. Trocar a senha re-cifra apenas a chave, não os segredos.

---

## 🚪 Cômodos (`/api/comodos`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/comodos` | Lista os cômodos ordenados por `ordem` e nome | Array de `Comodo` |
| `POST` | `/api/comodos` | Cria um cômodo | `{ "nome": string, "imagem"?: string, "apenassuiteMembers"?: boolean, "pessoasNecessarias"?: number (1–10), "obrigatorio"?: boolean, "ordem"?: number }` |
| `PUT` | `/api/comodos/:id` | Atualiza um cômodo; renomear atualiza o histórico das escalas | Mesmos campos do `POST`, todos opcionais |
| `DELETE` | `/api/comodos/:id` | Remove o cômodo e sua imagem | `{ "success": true }` |
| `POST` | `/api/upload-comodo-image` | Envia a foto de um cômodo | `FormData` com o campo `image`. Retorna `{ "filename", "path" }` |

Nomes de cômodos não podem se repetir.

---

## 📋 Escala (`/api/escala`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/escala/atual` | Linhas da escala da semana atual | Array de `Escala` |
| `POST` | `/api/escala/gerar` | Gera (ou refaz) a escala da semana atual | `{ "escala": Escala[], "alerta": string, "criticas": string[], "motivacaoDestaque": string }` |
| `PUT` | `/api/escala/:id` | Edita uma linha da semana atual | `{ "comodos"?: string[], "folga"?: boolean }` |
| `POST` | `/api/escala/atual/trocar` | Troca os cômodos de dois integrantes na semana atual | `{ "integranteAId": string, "integranteBId": string }` |
| `GET` | `/api/escala/historico` | Todas as escalas agrupadas por semana | `{ "AAAA-SS": Escala[] }` |
| `DELETE` | `/api/escala/historico/:ano/:semana` | Apaga uma semana do histórico | `{ "success": true, "removed": number }` |

Ao gerar, cada integrante ativo recebe uma linha. Quem está de folga tem `comodos: ["FOLGA"]` e `folga: true`. Em caso de erro (sem integrantes ativos, sem cômodos obrigatórios, vagas demais), a resposta é `400` com `{ "error", "criticas" }`.

---

## ❌ Infrações (`/api/infracoes`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/infracoes/:integranteId` | Infrações de um integrante | Array de `Infracao` |
| `GET` | `/api/infracoes-resumo/todas` | Resumo por integrante | `{ [integranteId]: { integranteId, integranteNome, total, infracoes } }` |
| `POST` | `/api/infracoes` | Registra uma infração | `{ "integranteId": string, "descricao": string, "dataSemana"?: string }` |
| `PUT` | `/api/infracoes/:id` | Edita uma infração | `{ "descricao"?: string, "dataSemana"?: string }` |
| `DELETE` | `/api/infracoes/:id` | Remove uma infração | `{ "success": true }` |

---

## 🎨 Configuração e Imagens

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/config` | Configurações visuais | Objeto `Config` |
| `POST` | `/api/config/cores` | Define as cores | `{ "cores": { "primaria"?, "secundaria"?, "branca"?, "preta"? } }` no formato `#RRGGBB` |
| `PUT` | `/api/config/personalizacao` | Nome da república e estilo da interface (envie só o que mudar) | `{ "nome"? (até 40, vazio = "República"), "slogan"? (até 80, vazio = sem frase), "fonte"? (`inter`, `poppins`, `nunito`, `roboto-slab`, `sistema`), "cantos"? (`reto`, `suave`, `arredondado`, `redondo`), "cabecalho"? (`solido`, `degrade`, `escuro`), "fundoVisibilidade"? (0 a 60) }`. Retorna `{ "success", "config" }` |
| `POST` | `/api/config/logo` | Envia o logo (substitui o anterior) | `FormData` com o campo `logo` |
| `POST` | `/api/config/background` | Envia a imagem de fundo (substitui a anterior) | `FormData` com o campo `image` |
| `POST` | `/api/upload-motivacao-image` | Envia uma imagem para a galeria de motivação | `FormData` com o campo `image`. Retorna `{ "filename", "path" }` |
| `GET` | `/api/uploads/motivacao` | Lista a galeria de motivação (sem logo e fundo) | Array de `{ "filename", "path" }` |
| `POST` | `/api/config/motivacao-destaque` | Define a imagem em destaque na escala | `{ "path": string }` |
| `DELETE` | `/api/uploads/motivacao/:filename` | Remove uma imagem da galeria | `{ "success": true }` |
| `GET` | `/api/sessao` | Sessão atual: usuário, papel, permissões e módulos ativos | `{ "modo", "autenticado", "usuario", "papel", "permissoes", "modulos" }` |
| `GET` | `/api/versao` | Commit em execução (na Vercel, lido das variáveis `VERCEL_GIT_*`; localmente, do git) | `{ "ambiente", "sha", "branch", "mensagem", "autor", "data", "url" }` |

A cada geração de escala, uma nova imagem da galeria é sorteada como destaque.
