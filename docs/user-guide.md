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
- **Lista de Compras**: o que acabou ou está acabando, para quem for ao mercado.
- **Atas de Reunião**: o que foi discutido e decidido nas reuniões, e as pendências de cada um.
- **Anotações**: senhas e contas (num cofre criptografado), contatos de prestadores e notas da casa.
- **Moradores**: cadastro de todos os moradores (usado por todos os módulos).
- **Ajustes**: nome da república, aparência (logo, fundo, cores, fonte, estilo), tema claro/escuro deste aparelho e versão do sistema.

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

## 🛒 7. Lista de Compras

- **Acabou alguma coisa?** Digite no campo do topo (ex.: "detergente"), escolha **Acabou** ou **Tá acabando** e toque em **+**.
- **Já compramos antes**: os itens que a casa costuma comprar aparecem como sugestão; um toque coloca na lista. O campo também completa o nome sozinho.
- **No mercado**: abra a lista e toque no **círculo** de cada item ao pegá-lo. Ele vai para **Comprados agora há pouco**, onde dá para **Desfazer** um toque errado.
- **Está acabando**: aviso para quem passar no mercado; o botão **Acabou** muda o item para a lista principal.
- **Enviar lista**: manda a lista em texto para o grupo da casa (no computador, copia para colar).
- **Toque no item** para editar: quantidade, quem pediu, observação (marca, tamanho...) e categoria.
- **Itens salvos**: tudo que já passou pela lista, por categoria, com a última compra e quantas vezes foi comprado. **+ Lista** coloca de volta; **Novo** cadastra um item sem pôr na lista.

---

## 🔐 8. Anotações

- **Senhas**: Wi-Fi, streaming, conta de luz, banco/caixinha... Login, senha e dados sigilosos (PIN, nº do cliente) ficam no **cofre**; site e observação ficam visíveis para todos.
  - **Cofre**: na primeira vez, toque em **Criar** e defina a senha do cofre (mínimo 8 caracteres). Combine com a casa e guarde fora do app: **não dá para recuperar**.
  - Para ver as senhas, toque em **Destrancar** e digite a senha do cofre. O cofre tranca sozinho depois de 10 minutos parado, ao recarregar a página ou no botão **Trancar**.
  - Com o cofre aberto: o **olho** mostra a senha, o botão de **copiar** copia login ou senha, e o **dado** no formulário gera uma senha forte.
  - Os segredos são criptografados **no aparelho** antes de ir para o servidor: nem quem acessa o banco de dados consegue lê-los. O cofre só funciona pelo endereço seguro (https) ou em localhost.
- **Contatos**: eletricista, encanador, gás, imobiliária... agrupados por serviço, com botões de **Ligar**, **WhatsApp**, **E-mail**, **Site** e **Mapa**. A busca procura também nas observações (ex.: "chuveiro").
- **Notas**: regras da casa, onde fica o registro... **Fixar no topo** destaca a nota. **Nota secreta** guarda o texto no cofre (ex.: código do portão, alarme).
- **Ajustes → Cofre de Senhas**: trocar a senha do cofre ou, se ninguém lembrar, **apagar o cofre** (as senhas guardadas são perdidas; títulos, sites e contatos ficam).

---

## 📝 9. Atas de Reunião

- **Nova ata**: título, data, local, quem participou (botão **Todos** marca a casa inteira), pauta, o que foi discutido, **decisões** e **encaminhamentos** (o que alguém ficou de fazer, com responsável e prazo).
- **Reuniões da agenda sem ata**: reuniões (categoria Reunião) dos últimos 45 dias que ainda não têm ata aparecem no topo; **Escrever ata** já preenche título, data, local e a pauta (da descrição do evento).
- **Buscar**: procura no que foi discutido, nas decisões e nos encaminhamentos (ex.: "geladeira" acha a reunião em que isso foi combinado).
- **Ler**: toque na ata. Dá para marcar encaminhamentos como feitos ali mesmo e **Enviar** a ata em texto para o grupo.
- **Pendências**: todos os encaminhamentos ainda não feitos, de todas as atas, com os atrasados primeiro. Filtre por responsável e marque como feito com um toque.

---

## 🎨 10. Personalização Visual

- **Escala de Limpeza → Ajustes → Galeria de Imagens**: envie imagens para a galeria. A cada escala gerada, uma delas é sorteada como destaque; você também pode escolher uma na galeria.
- **Ajustes → Nome e Estilo** (vale para todos):
  - **Nome da república**: aparece no topo, no rodapé e no título da aba do navegador.
  - **Frase do rodapé**: deixe vazia para mostrar só o nome.
  - **Fonte**, **cantos** (retos a bem redondos) e **cabeçalho** (cor sólida, degradê ou escuro).
  - **Imagem de fundo**: quanto a imagem enviada aparece atrás do conteúdo.
  - As mudanças aparecem na hora como prévia; **Salvar** aplica para todos e **Descartar** volta ao que estava salvo.
- **Ajustes → Logo, Fundo e Cores** (vale para todos):
  - **Logo**: imagem do cabeçalho.
  - **Fundo**: imagem de plano de fundo da aplicação.
  - **Esquema de cores**: cor primária, secundária, clara e escura, com prévia ao vivo. As **paletas prontas** (Clássica, Oceano, Floresta...) preenchem as quatro cores; é preciso **Salvar Cores** para manter. **Restaurar Padrão** volta às cores originais.
- **Ajustes → Neste Aparelho** (só no seu celular/computador, salvo na hora):
  - **Tema**: automático (segue o aparelho), claro ou escuro.
  - **Tamanho do texto**: normal, grande ou maior.
