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
3. **No celular**: com o celular no mesmo Wi-Fi do computador, abra o endereço que aparece no terminal ao subir o servidor (`http://192.168.x.x:3000`). O cofre de senhas só funciona pelo endereço seguro (https) da Vercel ou em `localhost`; o resto do app funciona normalmente pelo IP. Veja [Testar no celular](../README.md#-testar-no-celular).

---

## 🧭 2. Navegação

O app abre no **Início**, com um resumo de cada módulo ligado. Toque na **logo** para voltar a ele de qualquer lugar.

- **No celular**: a **barra inferior** troca de módulo (Início e os primeiros módulos; se não couberem todos, o resto fica em **Mais**).
- **No computador**: o **menu lateral** à esquerda lista todos os módulos.
- **Canto superior direito**:
  - 🔔 **Avisos**: encaminhamentos atrasados ou vencendo, o que acabou na lista de compras, eventos de hoje, aniversários do dia, escala da semana não gerada e alertas das finanças (orçamento, banco, divisões em aberto). O número mostra os avisos que você ainda não viu, e o sino balança quando chega um novo; tocar num aviso leva até ele.
  - 👤 **Menu**: **Moradores** e **Ajustes**. Quando houver login, o perfil e o "sair" também ficarão aqui.
- Dentro de cada módulo, as **abas** ficam logo abaixo do topo.
- Cada aba lembra onde você parou de rolar; tocar de novo no módulo ou na aba que já está aberta volta ao topo.
- No celular, os painéis (formulários, Mais, Avisos) fecham também arrastando a barrinha do topo para baixo.

Os módulos:
- **Início**: o mais importante de cada módulo numa tela só.
- **Escala de Limpeza**: rodízio semanal, histórico, infrações e os ajustes da escala.
- **Agenda**: eventos da casa, visitas e aniversários.
- **Lista de Compras**: o que acabou ou está acabando, para quem for ao mercado.
- **Atas de Reunião**: o que foi discutido e decidido nas reuniões, e as pendências de cada um.
- **Finanças**: gastos, contas, reserva de emergência e divisão de despesas.
- **Anotações**: senhas e contas (num cofre criptografado), contatos de prestadores e notas da casa.
- **Moradores** (menu do canto): cadastro de todos os moradores (usado por todos os módulos).
- **Ajustes** (menu do canto): nome da república, aparência (logo, fundo, cores, fonte, cabeçalho), preferências deste aparelho (tema, texto, animações, vibração), categorias, módulos ligados e versão do sistema.


### Início

- **Escala da semana**: quem faz o quê e quem está de folga.
- **Próximos 7 dias**: eventos e aniversários que vêm pela frente.
- **Lista de compras**: o que acabou e o que está acabando, com um campo para avisar na hora que algo acabou.
- **Pendências das reuniões**: encaminhamentos em aberto (atrasados primeiro) e o link para a última ata.
- **Anotações**: notas fixadas e atalhos para senhas, contatos e notas.
- **Finanças do mês**: gasto do mês contra o orçamento, disponível, reserva e quem deve para quem.
- **Moradores**: aniversários dos próximos 30 dias e quem está sem contato de emergência.
- **Abrir** leva ao módulo completo. **Personalizar início** (no fim da página) escolhe quais resumos aparecem e em que ordem; vale só para o seu aparelho.
- Só aparecem resumos de módulos ligados (Ajustes → Módulos).

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
- **No mercado**: abra a lista (ou o cartão do Início) e toque no **círculo** de cada item ao pegá-lo. Ele vai para **Comprados agora há pouco**, onde dá para **Desfazer** um toque errado. Zerou a lista? Tem comemoração. 🎉
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

## 💰 10. Finanças

- **Visão geral**: gastos e entradas do mês (comparados ao mês anterior até o mesmo dia), disponível em contas, **reserva de emergência** (e quantos meses de gastos ela cobre), gastos por categoria (toque numa categoria para ver os lançamentos), gasto acumulado no mês contra o mês anterior, **orçamento** por categoria, últimos 6 meses e maiores gastos. As setas trocam o mês.
- **Lançamentos**: tudo do mês, agrupado por dia, com busca e filtros por conta, categoria e tipo. **Lançar** registra um gasto ou entrada à mão (em contas manuais). Num lançamento vindo do banco, dá para mudar a categoria (e marcar "classificar sempre assim" para criar uma regra), anotar ou **ignorar** (ex.: duplicado). **Dividir** transforma um gasto numa divisão.
- **Contas**: contas, cartões e dinheiro (disponível) e caixinhas/investimentos (reserva). Contas manuais têm **ajustar saldo** (ex.: a caixinha rendeu); a diferença entra como "Ajuste de saldo" e não conta como gasto. **Conectar banco** usa o Open Finance (em breve, via Pluggy); bancos conectados atualizam sozinhos uma vez por dia.
- **Divisões**: alguém pagou e a conta é dividida entre moradores, em partes iguais ou valores diferentes. **Quem deve para quem** já compensa os dois sentidos; toque no nome de alguém para marcar a parte como paga, ou **Acertar** para quitar tudo entre duas pessoas.
- **Ajustes**: regras de categoria ("se contém IFOOD → Delivery"), regras sugeridas, orçamento mensal por categoria e as categorias (nome, cor, ícone).
- O sino avisa quando um orçamento passa de 80% ou estoura, quando a atualização de um banco falha e quando uma divisão tem partes em aberto há mais de 15 dias.

> Sem login, qualquer pessoa com o link vê as finanças da casa. Quando houver login, cada morador verá só o que o papel dele permitir.

---

## 🎨 11. Ajustes e Personalização

- **Ajustes → Categorias**: nome, **cor** e **ícone** das categorias de eventos da agenda, itens de compra, tipos de conta, serviços dos contatos e lançamentos das finanças. Crie, edite, mude a ordem (setas) ou exclua; ao excluir uma categoria em uso, escolha para qual os registros vão. Também dá para abrir pelo botão **Editar** ao lado das categorias, dentro dos próprios formulários.
- **Ajustes → Módulos**: liga e desliga cada módulo (Escala, Agenda, Lista de Compras, Anotações, Atas, Finanças). Desligado, ele some do menu para todos e as rotas dele param de responder, mas **nada é apagado**: religando, tudo volta como estava. Moradores e Ajustes fazem parte do núcleo e estão sempre ligados.

- **Escala de Limpeza → Ajustes → Galeria de Imagens**: envie imagens para a galeria. A cada escala gerada, uma delas é sorteada como destaque; você também pode escolher uma na galeria.
- **Ajustes → Nome e Estilo** (vale para todos):
  - **Nome da república**: aparece no topo, no rodapé e no título da aba do navegador.
  - **Frase do rodapé**: deixe vazia para mostrar só o nome.
  - **Fonte**, **cantos** (retos a bem redondos) e **cabeçalho** (cor sólida, degradê ou escuro; amplo, com o logo em destaque, ou compacto, que deixa mais espaço para o conteúdo).
  - **Imagem de fundo**: quanto a imagem enviada aparece atrás do conteúdo.
  - As mudanças aparecem na hora como prévia; **Salvar** aplica para todos e **Descartar** volta ao que estava salvo.
- **Ajustes → Logo, Fundo e Cores** (vale para todos):
  - **Logo**: imagem do cabeçalho e ícone da guia do navegador.
  - **Fundo**: imagem de plano de fundo da aplicação.
  - **Esquema de cores**: cor primária, secundária, clara e escura, com prévia ao vivo. As **paletas prontas** (Clássica, Oceano, Floresta...) preenchem as quatro cores; é preciso **Salvar Cores** para manter. **Restaurar Padrão** volta às cores originais.
- **Ajustes → Neste Aparelho** (só no seu celular/computador, salvo na hora):
  - **Tema**: automático (segue o aparelho), claro ou escuro.
  - **Tamanho do texto**: normal, grande ou maior.
  - **Animações**: completas ou reduzidas (também seguem o "reduzir movimento" do celular).
  - **Vibração**: uma vibração curtinha ao navegar e ao concluir algo (só em Android).
