# 🗄️ Modelos de Dados

Os dados ficam no **Supabase**: tabelas no Postgres e imagens no Storage. As mudanças no esquema ficam versionadas em [`db/migrations/`](../db/README.md). O acesso passa pelos `store.js` do núcleo (`backend/core/moradores/`, `backend/core/configuracao/`, `backend/core/categorias/`) e de cada módulo (`backend/modules/<módulo>/store.js`), que converte os nomes de coluna (`snake_case`) para os campos da API (`camelCase`).

---

## 👥 1. Integrantes (tabela `integrantes`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `nome` | `nome` | texto | Nome (único) |
| `is_suite` | `isSuite` | boolean | Mora na suíte (pode fazer cômodos "apenas suíte") |
| `ativo` | `ativo` | boolean | Participa da escala |
| `nome_completo` | `nomeCompleto` | texto | Nome completo |
| `data_nascimento` | `dataNascimento` | date | Nascimento (vira aniversário na agenda) |
| `data_entrada` | `dataEntrada` | date | Quando entrou na casa |
| `telefone` / `email` | `telefone` / `email` | texto | Contato |
| `observacoes` | `observacoes` | texto | Alergias, medicamentos, plano de saúde... |
| `emergencia_nome` / `emergencia_parentesco` / `emergencia_telefone` | `emergenciaNome` / `emergenciaParentesco` / `emergenciaTelefone` | texto | Contato de emergência |
| `cpf` / `rg` | `cpf` / `rg` | texto | Documentos (só com a permissão `moradores:documentos`) |

```json
{ "id": "9060c789-...", "nome": "Terezinha", "isSuite": true, "ativo": true, "nomeCompleto": "Teresa Cristina Almeida", "dataNascimento": "2001-10-30", "telefone": "(19) 99876-5432" }
```

---

## 🚪 2. Cômodos (tabela `comodos`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `nome` | `nome` | texto | Nome (único; é como o histórico identifica o cômodo) |
| `imagem` | `imagem` | texto \| null | URL pública da foto no Storage |
| `apenas_suite_members` | `apenassuiteMembers` | boolean | Só moradores da suíte podem fazer |
| `pessoas_necessarias` | `pessoasNecessarias` | inteiro (1–10) | Quantas pessoas o cômodo precisa por semana |
| `obrigatorio` | `obrigatorio` | boolean | Entra na geração da escala |
| `ordem` | `ordem` | inteiro ≥ 0 | Posição na sequência do rodízio |
| `permitir_multiplas_atribuicoes` | — | boolean | Coluna legada, sempre `false` (o rodízio nunca dá dois cômodos à mesma pessoa) |

```json
{
  "id": "e6a0f501-...",
  "nome": "WC Suíte",
  "imagem": null,
  "apenassuiteMembers": true,
  "pessoasNecessarias": 1,
  "obrigatorio": true,
  "ordem": 8
}
```

---

## 📋 3. Escalas (tabela `escalas`)

Uma linha por integrante por semana. O histórico do rodízio é lido daqui.

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador da linha |
| `ano` / `semana` | `ano` / `semana` | inteiro | Semana ISO 8601 |
| `integrante_id` | `integranteId` | UUID | Integrante |
| `integrante_nome` | `integranteNome` | texto | Nome no momento da geração |
| `comodos` | `comodos` | lista de textos | Nomes dos cômodos, ou `["FOLGA"]` |
| `folga` | `folga` | boolean | `true` quando `comodos` é `["FOLGA"]` |
| `data_inicio` / `data_fim` | `dataInicio` / `dataFim` | timestamp | Segunda e domingo da semana, 00:00 de Brasília |
| `alerta` | `alerta` | texto \| null | Reservado |

```json
{
  "id": "1b2c...",
  "ano": 2026,
  "semana": 44,
  "integranteId": "9060c789-...",
  "integranteNome": "Terezinha",
  "folga": false,
  "comodos": ["WC Suíte"],
  "dataInicio": "2026-10-26T03:00:00.000Z",
  "dataFim": "2026-11-01T03:00:00.000Z",
  "alerta": null
}
```

A função Postgres `replace_semana_escala(p_ano, p_semana, p_linhas)` substitui todas as linhas de uma semana numa única transação.

---

## ❌ 4. Infrações (tabela `infracoes`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `integrante_id` | `integranteId` | texto | Integrante |
| `integrante_nome` | `integranteNome` | texto | Nome no momento do registro |
| `descricao` | `descricao` | texto | O que aconteceu |
| `data_semana` | `dataSemana` | timestamp | Data de referência |
| `data_registro` | `dataRegistro` | timestamp | Quando foi registrada |

---

## 🎨 5. Configurações (tabela `config`, linha `id = 1`)

| Coluna | Campo na API | Descrição |
| :--- | :--- | :--- |
| `logo` | `logo` | URL do logo |
| `background` | `background` | URL da imagem de fundo |
| `motivacao_destaque` | `motivacaoDestaque` | URL da imagem em destaque na escala |
| `cores` | `cores` | `{ "primaria", "secundaria", "branca", "preta" }` em `#RRGGBB` |
| `modulos_desativados` (jsonb) | `modulosDesativados` | Ids dos módulos desligados em Ajustes > Módulos (ex.: `["agenda"]`) |
| `personalizacao` (jsonb) | `personalizacao` | `{ "nome", "slogan", "fonte", "cantos", "cabecalho", "cabecalhoTamanho", "fundoVisibilidade" }`. Campos ausentes usam o padrão do backend (`PERSONALIZACAO_PADRAO`) |

Tema, tamanho do texto, animações e vibração **não** ficam no banco: são preferências de cada
aparelho (veja [Dados guardados no aparelho](#-13-dados-guardados-no-aparelho)).

---

## 📅 6. Eventos da agenda (tabela `eventos`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `titulo` | `titulo` | texto | Título (obrigatório) |
| `descricao` / `local` | `descricao` / `local` | texto | Detalhes e local |
| `categoria` | `categoria` | texto | Chave de uma categoria do escopo `agenda` (padrão: `geral`, `festa`, `reuniao`, `visita`, `manutencao`) |
| `inicio` / `fim` | `inicio` / `fim` | timestamptz | Início e término (`fim` opcional) |
| `dia_inteiro` | `diaInteiro` | boolean | Evento sem horário |
| `recorrencia` | `recorrencia` | texto | `semanal`, `quinzenal`, `mensal`, `anual` ou `null` (não repete) |
| `recorrencia_ate` | `recorrenciaAte` | date | Último dia em que ainda repete (`null` = sem fim) |
| `excecoes` | `excecoes` | date[] | Dias em que uma repetição foi cancelada |
| `criado_em` | `criadoEm` | timestamptz | Quando foi criado |

Eventos recorrentes são guardados como **uma linha só** (a primeira ocorrência + a regra); as repetições são calculadas na consulta (`backend/modules/agenda/recorrencia.js`).

---

## 🛒 7. Lista de compras (tabela `compras_itens`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `nome` | `nome` | texto | Nome do item (único, ignorando maiúsculas, acentos e espaços) |
| `categoria` | `categoria` | texto | Chave de uma categoria do escopo `compras` (padrão: `mercado`, `limpeza`, `higiene`, `bebidas`, `casa`, `outros`) |
| `status` | `status` | texto | `falta` (acabou), `acabando` ou `ok` (em casa) |
| `quantidade` / `observacao` | `quantidade` / `observacao` | texto | Ex.: "2 un", "folha dupla" |
| `pedido_por` | `pedidoPor` | UUID | Morador que pediu (`integrantes.id`, opcional) |
| `pedido_em` | `pedidoEm` | timestamptz | Quando entrou na lista |
| `comprado_em` | `compradoEm` | timestamptz | Última compra |
| `vezes_comprado` | `vezesComprado` | inteiro | Quantas vezes foi comprado pelo app (ordena as sugestões) |
| `criado_em` | `criadoEm` | timestamptz | Quando foi salvo pela primeira vez |

Os itens nunca somem ao serem comprados: voltam para `ok` e viram o catálogo de "já compramos antes".

---

## 🔐 8. Anotações (tabelas `anotacoes` e `anotacoes_cofre`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `tipo` | `tipo` | texto | `conta`, `contato` ou `nota` |
| `titulo` | `titulo` | texto | Nome da conta, do prestador ou da nota |
| `categoria` | `categoria` | texto | Chave de uma categoria: tipo de conta (`anotacoes-contas`) ou serviço do contato (`anotacoes-contatos`) |
| `dados` | `dados` | jsonb | Campos abertos (site, telefone, observação, texto...) |
| `segredo` | `segredo` | texto | Login, senha, dados extras ou texto da nota secreta, **cifrados no navegador** |
| `fixado` | `fixado` | boolean | Nota fixada no topo |
| `criado_em` / `atualizado_em` | `criadoEm` / `atualizadoEm` | timestamptz | Datas |

`anotacoes_cofre` tem uma linha só (`id = 1`): `salt`, `iteracoes`, `chave_cifrada` (a chave dos segredos, cifrada com a senha do cofre) e `verificador_hash` (SHA-256 da prova). Sem a senha do cofre, nada disso permite ler os segredos.

---

## 📝 9. Atas de reunião (tabela `atas`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `titulo` / `data` / `local` | `titulo` / `data` / `local` | texto / date / texto | A reunião |
| `participantes` | `participantes` | jsonb | Ids dos moradores presentes |
| `pauta` / `conteudo` | `pauta` / `conteudo` | texto | Assuntos e o que foi discutido |
| `decisoes` | `decisoes` | jsonb | Lista de textos |
| `tarefas` | `tarefas` | jsonb | Encaminhamentos `{ id, texto, responsavelId, prazo, feito }` |
| `evento_id` | `eventoId` | UUID | Reunião da agenda que originou a ata (opcional) |
| `criado_em` / `atualizado_em` | `criadoEm` / `atualizadoEm` | timestamptz | Datas |

---

## 🏷️ 10. Categorias (tabela `categorias`)

| Coluna | Campo na API | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID | Identificador |
| `escopo` | `escopo` | texto | Grupo: `agenda`, `compras`, `anotacoes-contas`, `anotacoes-contatos`, `financas` |
| `chave` | `chave` | texto | O que os registros guardam em `categoria` (única por escopo; não muda ao renomear) |
| `nome` / `cor` / `icone` | `nome` / `cor` / `icone` | texto | Como aparece: nome, `#rrggbb` e classe do Font Awesome |
| `ordem` | `ordem` | inteiro | Ordem nos formulários e nos agrupamentos |

---

## 💰 11. Finanças (tabelas `fin_*`)

Valores em **centavos** (`bigint`): saída negativa, entrada positiva.

| Tabela | O que guarda |
| :--- | :--- |
| `fin_conexoes` | Conexão com um provedor de Open Finance: `provedor`, `externo_id`, `instituicao`, `status` (ativa, erro, desconectada), `erro`, `ultima_sincronizacao` |
| `fin_contas` | `nome`, `tipo` (corrente, cartao, dinheiro, caixinha, investimento), `cor`, `reserva`, `saldo_inicial` (manual), `saldo_informado` (do banco), `conexao_id`, `externo_id`, `arquivada` |
| `fin_transacoes` | `conta_id`, `data`, `descricao`, `valor`, `categoria`, `categoria_manual` (escolhida à mão: regras não mexem), `observacao`, `origem` (manual/importado), `externo_id` (evita duplicar), `ignorada` |
| `fin_regras` | `termo` → `categoria` |
| `fin_orcamentos` | `categoria` → `valor_mensal` |
| `fin_divisoes` | `descricao`, `data`, `valor_total`, `pago_por`, `participantes` (jsonb: `{ integranteId, valor, pago, pagoEm }`), `transacao_id`, `categoria` |

As categorias dos lançamentos ficam em `categorias` (escopo `financas`). `transferencia` e `ajuste` não contam como gasto nem entrada.

---

## 🖼️ 12. Imagens (Storage, bucket `uploads`)

Fotos de cômodos, logo, fundo e galeria de motivação ficam no bucket público `uploads`, cada uma com um nome aleatório (UUID + extensão). A galeria de motivação é tudo o que está no bucket, exceto o logo e o fundo atuais.

---

## 📱 13. Dados guardados no aparelho (`localStorage`)

Preferências de cada celular ou computador. Não vão para o servidor e não valem para os outros moradores.

| Chave | O que guarda |
| :--- | :--- |
| `escala:aparelho` | `{ "tema" (auto, claro, escuro), "texto" (normal, grande, maior), "animacoes" (completas, reduzidas), "vibracao" (sim, nao) }` |
| `escala:inicio` | Ordem e cartões escondidos do Início |
| `escala:avisos-vistos` | Ids dos avisos do sino já vistos (o contador mostra só os novos) |
| `escala:favicon` | Último ícone da guia gerado a partir do logo (para não piscar o padrão ao abrir) |

O cofre de senhas não guarda nada no aparelho: a chave fica só na memória enquanto ele está destrancado.

