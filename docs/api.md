# 🔌 Referência da API REST

O backend expõe a API sob o prefixo `/api`. Requisições com corpo usam `Content-Type: application/json`, exceto os uploads, que usam `multipart/form-data`. Erros de validação retornam `400` com `{ "error": string }`.

Cada rota exige uma permissão (veja [Módulos e Permissões](architecture.md#-módulos-e-permissões)). Com `AUTH_MODO=senha` (produção), toda rota responde `401` (`{ "error": "Entre com a senha da casa." }`) sem o cookie de login, menos `/api/auth/*`, `GET /api/versao` e o agendador das finanças; quem entrou tem todas as permissões. Com `AUTH_MODO=aberto` (testes locais) não há login. A falta de permissão retorna `403`.

---

## 🔑 Entrada (`/api/auth`, só com `AUTH_MODO=senha`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/entrar` | Confere a senha da casa e grava o cookie de login (30 dias) | `{ "senha": string }` → `{ "ok": true }`; `401` se errada, `429` depois de 10 erros em 15 minutos |
| `POST` | `/api/auth/sair` | Apaga o cookie deste aparelho | `{ "ok": true }` |

---

## ⚙️ Sistema (`/api/sessao`, `/api/versao`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessao` | Sessão atual: usuário, papel, permissões e módulos ativos | `{ "modo", "autenticado", "usuario", "papel", "permissoes", "modulos" }` |
| `GET` | `/api/versao` | Commit em execução (no Render, lido das variáveis `RENDER_GIT_*`; localmente, do git) | `{ "ambiente", "sha", "branch", "mensagem", "autor", "data", "url" }` |

O frontend chama `GET /api/sessao` ao abrir: ele traz o usuário, as permissões e a lista de módulos ativos que a interface monta.

---

## 🧩 Módulos (`/api/modulos`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/modulos` | Todos os módulos, ativos ou não | `[{ "id", "nome", "nucleo", "ativo" }]` |
| `PUT` | `/api/modulos/:id` | Liga ou desliga um módulo (os do núcleo não podem ser desligados) | `{ "ativo": boolean }` |

Ambos exigem a permissão `modulos:gerenciar`. Com um módulo desligado, as rotas dele respondem 404 (`{ "error": "Rota não encontrada." }`) e ele some de `GET /api/sessao`; os dados continuam no banco. A mudança é lida com cache de 15 segundos (com mais de uma instância do servidor, pode levar esse tempo para valer em todas as instâncias).

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

## 📅 Agenda (`/api/eventos`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/eventos?de=...&ate=...` | Eventos que acontecem no período (datas ISO 8601; máximo 62 dias) | Array de `Evento`, em ordem de início |
| `POST` | `/api/eventos` | Cria um evento | `{ "titulo", "inicio", "fim"?, "diaInteiro"?, "categoria"?, "local"?, "descricao"?, "recorrencia"?, "recorrenciaAte"? }` |
| `PUT` | `/api/eventos/:id` | Atualiza um evento ou a série inteira de um evento recorrente (só os campos enviados) | Mesmos campos |
| `POST` | `/api/eventos/:id/excecoes` | Cancela uma única repetição de um evento recorrente | `{ "data": "AAAA-MM-DD" }` |
| `DELETE` | `/api/eventos/:id` | Exclui um evento (ou a série inteira) | `{ "success": true }` |

`categoria`: a `chave` de uma categoria do escopo `agenda` (veja Categorias, mais abaixo); sem categoria, usa a primeira da ordem. As padrão são `geral`, `festa`, `reuniao`, `visita` e `manutencao`. As Atas reconhecem reuniões pela chave `reuniao`. O término não pode ser antes do início, e um evento dura no máximo 31 dias.

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

`status`: `falta` (acabou, comprar), `acabando` (avisado, ainda tem) ou `ok` (em casa). `categoria`: a `chave` de uma categoria do escopo `compras`; sem categoria, usa a primeira da ordem. As padrão são `mercado`, `limpeza`, `higiene`, `bebidas`, `casa` e `outros`. `pedidoPor` é o `id` de um morador. Ao entrar na lista, `pedidoEm` recebe a hora atual; ao voltar para `ok`, o pedido (quem, quando, quantidade) é limpo.

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
- `categoria`: a `chave` de uma categoria do escopo `anotacoes-contas` (tipo de conta: internet, streaming, consumo...) ou `anotacoes-contatos` (serviço do prestador: eletricista, encanador...). Notas não têm categoria.
- **`segredo`** é texto já cifrado pelo navegador (`v1.<iv>.<conteúdo>`, base64). Gravar, trocar ou remover um segredo exige `provaCofre`, que só quem destrancou o cofre consegue calcular (senão, 403).
- **Criptografia (no navegador, `frontend/js/modules/anotacoes/cofre.js`)**: senha do cofre → PBKDF2-SHA256 (600 mil iterações) → chave que cifra, com AES-256-GCM, a chave aleatória dos segredos. A prova é o SHA-256 dessa chave mais um texto fixo; o servidor guarda só o hash da prova. Trocar a senha re-cifra apenas a chave, não os segredos.

---

## 📝 Atas de Reunião (`/api/atas`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/atas` | Todas as atas | Array de `Ata` |
| `POST` | `/api/atas` | Cria uma ata | `{ "titulo", "data" (AAAA-MM-DD), "local"?, "participantes"? (ids de moradores), "pauta"?, "conteudo"?, "decisoes"? (textos), "tarefas"?, "eventoId"? }` |
| `PUT` | `/api/atas/:id` | Edita (só os campos enviados) | Mesmos campos |
| `PUT` | `/api/atas/:id/tarefas/:tarefaId` | Marca um encaminhamento como feito ou não | `{ "feito": boolean }` (sem corpo, inverte). Retorna a `Ata` |
| `DELETE` | `/api/atas/:id` | Apaga (permissão `atas:gerenciar`) | `{ "success": true }` |

`tarefas` (encaminhamentos): `[{ "id"?, "texto", "responsavelId"?, "prazo"? (AAAA-MM-DD), "feito"? }]`. Encaminhamento sem `id` ganha um; ao editar, mande o `id` de volta para mantê-lo. Até 50 decisões e 50 encaminhamentos por ata. `eventoId` liga a ata à reunião da agenda que a originou.

---

## 💰 Finanças (`/api/financas/...`)

Valores sempre em **centavos inteiros** (saída negativa, entrada positiva). Datas `AAAA-MM-DD`. Permissões: `financas:ver` (ler), `financas:lancar` (lançamentos manuais e divisões), `financas:gerenciar` (contas, bancos, regras, orçamentos, categorias).

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/financas/contas` | Contas com `saldo` calculado (conectada: o que o banco informou; manual: `saldoInicial` + lançamentos) |
| `POST` / `PUT` | `/api/financas/contas[/:id]` | `{ nome, tipo (corrente, cartao, dinheiro, caixinha, investimento), instituicao?, cor?, reserva?, saldoInicial?, arquivada? }` |
| `POST` | `/api/financas/contas/:id/ajuste` | `{ saldo }`: lança a diferença como "Ajuste de saldo" (só contas manuais) |
| `DELETE` | `/api/financas/contas/:id` | Só sem lançamentos (com lançamentos, arquive) |
| `GET` | `/api/financas/transacoes?de=&ate=` | Lançamentos de `[de, ate)` (até 400 dias) |
| `POST` / `PUT` | `/api/financas/transacoes[/:id]` | `{ contaId, data, descricao, valor, categoria?, observacao? }`. Importados do banco só aceitam `categoria`, `observacao` e `ignorada` |
| `DELETE` | `/api/financas/transacoes/:id` | Só lançamentos manuais |
| `GET` | `/api/financas/resumo?meses=6&ate=AAAA-MM` | Por mês: `{ mes, entradas, saidas, porCategoria }` (sem transferências, ajustes e ignorados) |
| `GET` / `POST` / `DELETE` | `/api/financas/regras[/:id]` | Regras `{ termo, categoria }`: "se a descrição contém o termo"; criar reaplica em tudo que não foi categorizado à mão |
| `POST` | `/api/financas/regras/sugeridas` | Adiciona regras prontas (iFood, Uber, contas de consumo...) |
| `GET` / `PUT` | `/api/financas/orcamentos[/:categoria]` | `{ valorMensal }` (0 remove) |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/financas/divisoes[/:id]` | `{ descricao, data, valorTotal, pagoPor, participantes: [{ integranteId, valor }], categoria?, transacaoId? }` — as partes precisam somar o total |
| `PUT` | `/api/financas/divisoes/:id/participantes/:integranteId` | `{ pago }` |
| `POST` | `/api/financas/acertos` | `{ de, para }`: quita tudo o que as duas pessoas devem uma à outra |
| `GET` | `/api/financas/provedores` | Provedores de Open Finance e se estão disponíveis |
| `GET` / `POST` / `DELETE` | `/api/financas/conexoes[/:id]` | Conectar `{ provedor, dados? }` (já sincroniza); desconectar mantém o histórico e torna as contas manuais |
| `POST` | `/api/financas/conexoes/:id/sincronizar` | Sincroniza uma conexão |
| `GET` / `POST` | `/api/financas/sincronizar` | Sincroniza tudo. O `GET` é para um agendador diário (aceita `Authorization: Bearer <CRON_SECRET>`) |

---

## 🏷️ Categorias (`/api/categorias`)

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/categorias` | Grupos de categorias dos módulos ligados | `[{ "escopo", "nome", "modulo", "podeGerenciar" }]` |
| `GET` | `/api/categorias/:escopo` | Categorias do grupo, em ordem | `[{ "id", "escopo", "chave", "nome", "cor", "icone", "ordem" }]` |
| `POST` | `/api/categorias/:escopo` | Cria | `{ "nome" (até 30), "cor" (#rrggbb), "icone" ("fa-solid fa-...") }` |
| `PUT` | `/api/categorias/:escopo/:id` | Edita nome, cor ou ícone (a `chave` nunca muda) | Mesmos campos |
| `PUT` | `/api/categorias/:escopo/ordem` | Nova ordem | `{ "ids": [todos os ids do grupo, na ordem] }` |
| `DELETE` | `/api/categorias/:escopo/:id?substituta=<chave>` | Exclui. Se houver registros usando, responde 409 com `emUso` até receber a `substituta` | `{ "success", "movidos" }` |

Escopos: `agenda` (eventos), `compras` (itens), `anotacoes-contas` (tipos de conta), `anotacoes-contatos` (serviços) e `financas` (lançamentos, divisões e orçamentos). Os registros guardam a `chave`; na primeira leitura de um grupo vazio, o backend cria as categorias padrão e também as que já estiverem em uso. Ver exige a permissão de ver do módulo; criar, editar e excluir, a de gerenciar (agenda: `agenda:gerenciar`; compras: `compras:editar`; anotações: `anotacoes:editar`; finanças: `financas:gerenciar`).

---

## 🎨 Configuração e Imagens

| Método | Endpoint | Descrição | Corpo / Retorno |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/config` | Configurações visuais | Objeto `Config` |
| `POST` | `/api/config/cores` | Define as cores | `{ "cores": { "primaria"?, "secundaria"?, "branca"?, "preta"? } }` no formato `#RRGGBB` |
| `PUT` | `/api/config/personalizacao` | Nome da república e estilo da interface (envie só o que mudar) | `{ "nome"? (até 40, vazio = "República"), "slogan"? (até 80, vazio = sem frase), "fonte"? (`inter`, `poppins`, `nunito`, `roboto-slab`, `sistema`), "cantos"? (`reto`, `suave`, `arredondado`, `redondo`), "cabecalho"? (`solido`, `degrade`, `escuro`), "cabecalhoTamanho"? (`amplo`, `compacto`), "fundoVisibilidade"? (0 a 60) }`. Retorna `{ "success", "config" }` |
| `POST` | `/api/config/logo` | Envia o logo (substitui o anterior) | `FormData` com o campo `logo` |
| `POST` | `/api/config/background` | Envia a imagem de fundo (substitui a anterior) | `FormData` com o campo `image` |
| `POST` | `/api/upload-motivacao-image` | Envia uma imagem para a galeria de motivação | `FormData` com o campo `image`. Retorna `{ "filename", "path" }` |
| `GET` | `/api/uploads/motivacao` | Lista a galeria de motivação (sem logo e fundo) | Array de `{ "filename", "path" }` |
| `POST` | `/api/config/motivacao-destaque` | Define a imagem em destaque na escala | `{ "path": string }` |
| `DELETE` | `/api/uploads/motivacao/:filename` | Remove uma imagem da galeria | `{ "success": true }` |

A cada geração de escala, uma nova imagem da galeria é sorteada como destaque.
