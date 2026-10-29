# 📖 Guia do Usuário

Este guia explica como operar o **Escala** no dia a dia.

---

## 🚀 1. Primeiro Acesso

1. Configure o `.env` e inicie o servidor na raiz do projeto (veja o [README](../README.md)):
   ```bash
   npm install
   npm start
   ```
2. Abra o navegador em `http://localhost:3000` (ou na URL da Vercel).

---

## 🧭 2. Navegação

O app é dividido em **módulos**. Toque no nome do módulo no topo (ou no botão **Módulos**) para trocar:
- **Escala de Limpeza**: rodízio semanal, histórico, infrações e os ajustes da escala.
- **Agenda**: eventos da casa, visitas e aniversários.
- **Moradores**: cadastro de todos os moradores (usado por todos os módulos).
- **Ajustes**: aparência (logo, fundo, cores) e versão do sistema.

Cada módulo tem suas abas na barra logo abaixo do topo. O app lembra o último módulo aberto.

---

## ⚙️ 3. Configurações Iniciais

### A. Moradores
- No módulo **Moradores**, toque em **Novo** e preencha o cadastro: nome na casa (apelido), nome completo, nascimento, data de entrada, telefone, e-mail, **contato de emergência** (nome, parentesco e telefone), documentos e observações. Só o apelido é obrigatório.
- Toque num morador para editar ou excluir. Com o telefone de emergência preenchido, o botão **Ligar** já faz a chamada pelo celular.
- Moradores ativos sem contato de emergência aparecem com o aviso **"Sem contato de emergência"** na lista.
- Marque **"É da suíte?"** para quem mora na suíte: só essas pessoas fazem os cômodos "apenas suíte".
- Desmarque **"Está ativo?"** se alguém estiver viajando ou ausente. A pessoa sai da próxima escala gerada (a da semana atual só muda se você gerar de novo).
- Com a data de nascimento preenchida, o aniversário aparece em **Próximos aniversários** e na **Agenda**.
- ⚠️ **Documentos (CPF/RG)**: enquanto o app não tiver login, qualquer pessoa com o link consegue ver esses dados. Só preencha depois que o login estiver ativo.

### B. Cômodos
- Em **Escala de Limpeza → Ajustes → Cômodos e Tarefas**, cadastre os cômodos da casa (ex.: *Cozinha*, *Sala*, *Lavanderia*, *Sacada*). Os nomes não podem se repetir.
- **Quantas pessoas?**: quantas pessoas o cômodo precisa por semana.
- **Ordem na rotação**: a sequência que cada pessoa percorre (ordem 0 → 1 → 2...).
- **Apenas suíte?**: marque no banheiro da suíte.
- **Obrigatório?**: desmarque para tirar o cômodo da escala sem apagá-lo.
- Não cadastre "FOLGA": as folgas são calculadas automaticamente.
- Pode renomear um cômodo à vontade: o histórico acompanha o novo nome.

---

## 📋 4. Gerando a Escala

1. Na aba **📋 Atual**, toque em **Gerar Nova Escala**.
2. O rodízio é previsível e não tem sorteio:
   - **Folgas**: sobram `integrantes ativos − vagas obrigatórias` por semana. Vão para quem está há mais tempo sem folgar, então todos folgam o mesmo número de vezes.
   - **Banheiro da suíte**: um morador da suíte por semana, em revezamento.
   - **Demais cômodos**: cada pessoa vai para o cômodo seguinte ao último que fez. Ninguém repete o mesmo cômodo na semana seguinte.
3. Gerar de novo na mesma semana refaz a escala da semana com o mesmo resultado (a não ser que integrantes ou cômodos tenham mudado). O aviso após gerar diz se algo mudou, e quem mudou de tarefa aparece com a etiqueta **"NOVO"**.
4. Se faltar gente para as vagas, aparece um erro: ative mais integrantes ou desmarque cômodos obrigatórios.

A semana vai de segunda a domingo e vira à 0h de segunda, no horário de Brasília.

---

## ❌ 5. Registro de Infrações

1. Na escala, toque no **✕** do card da pessoa, ou vá na aba **⚠️ Infrações**.
2. Selecione o integrante, descreva o que aconteceu e clique em **Registrar Infração**.
3. O contador do integrante aumenta e aparece no resumo e no card da escala. No resumo, toque no nome da pessoa para ver ou remover as infrações dela.

---

## 📅 6. Agenda

- **Mês**: calendário com os eventos marcados em cada dia (bolinhas coloridas no celular, etiquetas com o título no computador). Toque num dia para ver a lista detalhada abaixo.
- **Semana**: os 7 dias com horário, local e descrição de cada evento.
- **Criar**: botão **+** no canto da tela, o **+ Evento** do dia selecionado ou o **+** de cada dia na semana.
- **Editar ou excluir**: toque no evento.
- Cada evento tem título, categoria (Geral, Festa/rolê, Reunião, Visita, Manutenção), data, horário de início e término (ou **dia inteiro**), local e descrição. Eventos podem durar vários dias (até 31).
- **Repetir**: toda semana, a cada 2 semanas, todo mês ou todo ano, opcionalmente até uma data (ex.: conta de luz todo mês no dia 10; fim do prazo da escala todo domingo). No mensal, quem marca o dia 31 cai no último dia dos meses mais curtos.
  - Editar um evento que se repete altera **todas** as repetições.
  - Ao excluir, escolha entre **só aquele dia** (ex.: pular uma semana) ou **todas as repetições**.
- Os **aniversários** dos moradores aparecem sozinhos, a partir do cadastro.

---

## 🎨 7. Personalização Visual

- **Escala de Limpeza → Ajustes → Galeria de Imagens**: envie imagens para a galeria. A cada escala gerada, uma delas é sorteada como destaque; você também pode escolher uma na galeria.
- **Ajustes → Aparência e Logo**: logo do cabeçalho, imagem de fundo e esquema de cores.
- **Logo**: imagem do cabeçalho.
- **Fundo**: imagem de plano de fundo da aplicação.
- **Esquema de cores**: cor primária, secundária, clara e escura. **Restaurar Padrão** volta às cores originais.
