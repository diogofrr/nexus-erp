# 17. Vida nas telas de serviço (V2)

O dono viu o app publicado e disse: "a UI está bonita mas pobre, está sem vida e sem elementos, como o **plano sem foco**". Também tinha dito antes: "tem MUITA informação, essa plataforma é para o CLIENTE". Este documento registra o que mudou nas telas de serviço (Meu plano, Cartão Nexus, Grupos, Conteúdos, Atendimento, Como estou, Rede e o resto) e por quê. O kit visual (cores por seção, ilustração, emblema, anel, herói, estado vazio, selo) é do V1 e está em `docs/17-vida-kit.md`.

> Vida aqui é **hierarquia, foco, cor, desenho e movimento suave**. Não é mais texto, mais cartões nem mais números. Cada tela tem uma ação principal.

Regras que valeram em tudo: nenhum travessão, nenhum "!", nenhum emoji; nenhuma pressão comercial (RN-PLN-19 e 22); nenhum alarme em tema de saúde emocional (sem vermelho nem laranja); alvo de toque de 48 px; `prefers-reduced-motion` respeitado (só se mexe o que o kit já move, mais a entrada dos destaques e a do cartão, que também param).

## Meu plano (`/cuidador/mais/plano`), a prioridade

**Antes:** um cartão com a etiqueta, o preço e uma lista de 12 marcadores sem destaque, dois botões do mesmo peso.

**Agora:**

- **Um único herói.** O plano atual num cartão com a **cor do plano** (Figura 1: Livre cinza-azulado, Essencial azul claro, Cuida azul médio, Sustenta dourado). De um lado a faixa colorida com "Seu plano agora", o **nome em serifa grande** ("Cuida"), o **preço** ("R$ 119,90 por mês"; no Livre, "Sem custo, sem prazo"; pago pela empresa, "Pago pela empresa") e a "Próxima cobrança em 08/11/2026". Do outro, **4 destaques com ícone** do que o plano dá (Cuida: Grupos de apoio, Capacitações, Maior suporte à organização, Descontos exclusivos do Cartão Nexus). O símbolo da marca aparece em traço na faixa. No celular a faixa fica em cima e os destaques embaixo; com a letra "Bem grande" continua cabendo.
- **A lista longa saiu de cara.** "Ver tudo que inclui" abre uma folha com os 12 itens (CXC-010 continua valendo: a lista completa traz o que vem dos planos anteriores).
- **Uma ação principal:** "Ver outros planos" (no Livre, "Ver os planos"), o único botão cheio da tela. **"Cancelar plano"** é um link de texto calmo, no fim, em cinza, só em plano pago e sem cancelamento agendado.
- **Mudança agendada** vira uma faixa clara acima do herói: "Mudança agendada / Seu plano muda para o Essencial em 18/11/2026." ou "Cancelamento agendado / Seu plano volta a ser o Livre em 18/11/2026.", com **Manter meu plano** (um toque, sem folha).

**Comparar planos** (`?ver=planos`, ao tocar em "Ver outros planos"; componente `plan/ui/plan-board.component.ts`):

- Quatro cartões, cada um com a **sua cor** (faixa com o nome em serifa), o **preço** e os **3 destaques próprios** (não a lista completa), mais a linha "Tudo do plano anterior, mais:". Em tela larga (1200 px ou mais) ficam **lado a lado**; abaixo disso é um **carrossel de rolagem horizontal com encaixe** (cada cartão ocupa cerca de 78% da largura, então o próximo aparece pela borda), que abre já com o **plano atual no meio**. A região rolável tem nome ("Os quatro planos. Role para o lado para ver todos.") e entra no teclado.
- O atual leva uma borda na cor do plano e a marca "Seu plano" no lugar do botão. Os outros têm o botão calmo **Escolher** (nome acessível "Escolher o plano Essencial").
- **Sem "recomendado", sem selo de oferta, sem urgência** (RN-PLN-19 e 22). O aviso "A mensalidade não inclui serviços da rede nem atendimento psicológico." e "Você pode cancelar em qualquer mês, sem multa." ficam logo abaixo, em duas linhas com ícone, no tamanho do corpo (nada abaixo de 16 px).
- **Trocar de plano continua em um passo só** (CXC-010): "Escolher" abre a folha com o efeito dito antes (subir vale hoje; descer e cancelar valem no fim do ciclo, com as turmas que a pessoa deixa) e, na primeira contratação paga, o aviso de emergência como UMA linha com a caixa "Li e entendi" na mesma folha. Os textos de efeito e os botões de confirmação ("Mudar para o Cuida", "Agendar mudança para o Essencial", "Agendar cancelamento") não mudaram. Pagamento simulado: nenhum campo de cartão (AC-CG-156).

**Cores e contraste.** O texto sobre a cor pura do plano passa 4,5:1: claro só no Cuida (5,4:1); no Livre, no Essencial e no Sustenta, que são claros, o texto é escuro (4,98:1, 4,70:1 e 6,11:1). O preço e o ícone usam o texto escuro do plano (`--plan-*-text`) sobre branco e sobre o fundo claro do plano (6,3:1 a 9,9:1). A borda do plano atual passa 3:1 (no Sustenta usa o dourado 600, porque o dourado puro dá 2,98:1). Os pares estão em `scripts/check-caregiver-a11y.mjs` (seção "Meu plano").

Decisões:

- As cores do plano são variáveis do próprio componente (`--tone`, `--tone-on`, `--tone-soft`, `--tone-text`, `--tone-line`, `--tone-2`), montadas a partir dos tokens `--plan-*` e dos primitivos `--nx-*`, sem hex novo. O Cartão Nexus usa as mesmas. Estão copiadas em três componentes (página, quadro e cartão): ver "Pedidos ao kit".
- Os destaques (`HIGHLIGHT_ORDER` em `plan-copy.ts`) são escolhidos a dedo por plano, mas só entram se o plano de fato inclui o benefício (o catálogo é editável em M15); se faltar um, completa com os outros benefícios do plano.
- "Escolher" no cartão do Livre, para quem tem plano pago, é o cancelamento (a folha abre "Cancelar o plano?"). O cancelamento também continua no link calmo da tela principal.
- O quadro virou componente próprio porque o CSS da página passava do orçamento de 4 kB por componente.

ACs de plano (AC-CG-149 a 158): todos continuam atendidos; os textos de 149, 150 e 154 e as seções C16 e C18 de `docs/10-cuidador-ux.md` foram ajustados à tela nova.

## Cartão Nexus (`/cuidador/rede/cartao`)

- O cartão agora **parece um cartão**: proporção de cartão (1,586:1), a **cor do plano**, o símbolo da marca (nítido no canto e em traço como marca d'água), o **chip** dourado, o número `NX-0000-0000` grande e o nome em caixa alta. Entra com um leve crescer. Em tela larga fica à esquerda, e à direita "Mostre o número no balcão do parceiro.", a validade e **Copiar número** (largura toda no celular).
- **Onde usar** ganhou ícone por tipo de parceiro (pílula, estetoscópio, loja, olho, atividade, coração, aperto de mão); a tinta vem da seção Rede.
- **O que você já economizou** ganhou um painel com o **valor em serifa** ("R$ 76,83 economizados neste mês, em 4 compras"); sem compras no mês, o destaque é o total ("R$ 25,55 economizados ao todo, em 2 compras") e a linha de apoio diz "Neste mês: ainda sem compras com o cartão." Só as **3 últimas compras** aparecem, com "Ver todas (N)".
- **Quem não tem plano pago** vê um **convite calmo**: o desenho de um cartão tracejado, vazio (sem número, sem percentual, sem parceiro, sem preço), a frase "O Cartão Nexus dá descontos em farmácias, clínicas e outros parceiros. Ele vem com os planos pagos." e o botão secundário "Ver os planos".

## Grupos e capacitações (`/cuidador/cuidar-de-mim/grupos`)

- Cabeçalho com o herói da seção (areia) e a ilustração dos três grupos. No detalhe o herói leva o título da atividade e **a ilustração do tipo** (grupo, livro, coração, balões).
- **Cada tipo tem a sua cor calma e o seu ícone**, no emblema do cartão e no selo: grupo de apoio em azul, capacitação em dourado, roda aberta em verde, grupo com psicólogo na tinta da seção. O nome do tipo continua escrito (nunca só cor).
- O cartão da atividade ganhou **estrutura**: emblema, título e seta na primeira linha; etiquetas ("Plano Cuida" com cadeado, quando é o caso) e as duas linhas de data e formato, com ícone, embaixo e na largura toda (no celular a coluna do texto tinha 205 px e agora tem 301). Quem não tem acesso continua vendo a roda aberta primeiro.
- No detalhe, "Encontros", "Onde", "Quem conduz" e "Vagas" ganharam emblema de ícone e, em tela larga, duas colunas.
- Estado vazio com desenho (`app-cg-empty`).

## Conteúdos (`/cuidador/cuidar-de-mim/conteudos`)

- Herói com o livro. As leituras são **cartões com desenho**: uma faixa no alto (três tintas calmas que se alternam, só para a lista não ficar monótona; não quer dizer nada) com o **tempo de leitura** numa pílula e o livro, e o título embaixo. Grade de 1, 2 e 3 colunas. Entram um depois do outro (`cg-enter`).
- A leitura aberta usa o herói com o livro e o texto de sempre (18 px, até 66 caracteres por linha). Sem leitura publicada, estado vazio com o livro. O cartão de bloqueio do Livre é o do kit, sem mudança.

## Conversar com um psicólogo (`/cuidador/cuidar-de-mim/atendimento`)

- Herói com os dois balões. **Sua próxima conversa** ganhou um **bloco de data** (mês curto sobre o dia em serifa) ao lado do horário, do psicólogo, do formato e da situação.
- Os passos (formato e horário) ganharam **"Passo 1 de 2" / "Passo 2 de 2"** com uma barra de duas partes e uma ilustração pequena (balões e calendário). Nos passos o herói grande dá lugar a um título simples, para o "Voltar" do passo não competir com o do herói. Cada dia de horários tem o emblema do calendário.
- O **resumo antes de gravar** ganhou um ícone por linha (calendário, pessoa, formato, local); os textos ("Quando:", "Com quem:", "Como:") não mudaram.
- Estados vazios com desenho.

## Como estou (`/cuidador/cuidar-de-mim/como-estou`)

- Herói com as mãos e o coração. "Como você está hoje?" e "Suas conversas com a equipe" ganharam um emblema de ícone.
- A linha do tempo ganhou uma **trilha de pontos** acima da lista: um ponto por conversa (até 6), do mais antigo ao mais novo, na **rampa de uma cor só (azul)**, a última com um anel. É só desenho (`aria-hidden`): sem número, sem rótulo, sem vermelho; a lista de baixo diz tudo. Os pontos entram em sequência, bem devagar.
- Sem conversas, o estado vazio ganhou o coração desenhado. Nada de novo em texto: continua "Não é um diagnóstico" e nenhum convite de plano (RN-PLN-19).

## Rede: ficha do profissional e Meus pedidos

- **Avatar do profissional** (`network/ui/provider-avatar.component.ts`): as iniciais num círculo de uma de quatro tintas calmas (azul, verde, dourado, cinza-azulado), sempre a mesma para o mesmo nome. Pula "Dra.", "Dr.", "Cuidadora" e as ligações ("Dra. Renata Sampaio" é RS). Nunca é foto.
- **Estrelas** (`network/ui/stars.component.ts`): cinco estrelas decorativas com a nota arredondada; o texto "Nota 4,8 (12 avaliações)" continua ao lado (a estrela nunca é a única informação) e sem nota (menos de 5 avaliações) não desenha nada.
- **Ficha**: herói com o avatar grande, a especialidade e a cidade, os selos "Em destaque" (dourado) e "Atende em casa" (azul), as estrelas e o registro. "Condições para quem é da Nexus" e o telefone ganharam emblema.
- **Meus pedidos**: herói com o aperto de mão; cada pedido leva o avatar do profissional e a situação num selo com ícone e cor calma ("Concluído: avalie" em dourado, "Aceito" em verde, "Enviado, aguardando resposta" em neutro). Estado vazio com desenho.

## Privacidade, Falar com a Nexus, Família e Meu perfil

Só o que cabia no tempo sem encher: **herói com ilustração** (cadeado e mãos, balões, grupo, boas-vindas) no lugar do cabeçalho simples e estado vazio com desenho em "Suas mensagens". Nenhum texto novo.

## O que ficou de fora

- **Começar** (o cadastro em 5 etapas, `start/pages/start.page.ts`, 1050 linhas) e o miolo de **Privacidade** e **Meu perfil** (formulários e listas) não ganharam nada além do herói: são telas de formulário, onde mais cor atrapalha. Se o dono quiser, o próximo passo é um herói por etapa no cadastro e o anel de progresso do V1 no lugar da barra.
- Não fiz **fotos** nem ilustração nova (peço só o que o kit pode dar; ver abaixo).
- O quadro de planos não tem **indicador de posição** (pontinhos) no carrossel do celular: o cartão seguinte aparecendo pela borda e o plano atual no meio já dizem que há mais.

## Números

Testes novos: Meu plano (herói por plano, "Ver tudo que inclui", comparar planos com cor e 3 destaques, sem "recomendado", "Escolher", mudança agendada), Cartão Nexus (cor por plano, ícone por parceiro, convite desenhado), Grupos (cor por tipo, fatos do detalhe), Conversa (bloco de data e passos), Como estou (trilha), avatar e estrelas. Conferências: `node scripts/check-core.mjs`, `pnpm run check:a11y` (com os pares das cores de plano), `pnpm run typecheck` e `pnpm exec ng build` (pacote inicial 659,8 kB, abaixo de 700 kB).

## Pedidos ao kit (V1)

Estão no fim de `docs/17-vida-kit.md` ("Pedidos do V2"): cores dos planos no kit, avatar e estrelas na Buscar, herói compacto nos passos, trilha dentro do `cg-trend`, e uma entrada de avatar no `app-cg-row`.
