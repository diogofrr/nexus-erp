# Aplicativo do cuidador: status do Dev P3 (Rede, Cartão, Plano, Grupos e Conteúdos)

Status: PRONTO. Telas de C10, C11, C12, C13, C14, C15, C16 e C18 implementadas, sem `ng serve` (validação por testes, typecheck e build). 19 arquivos de teste e 252 testes próprios, todos verdes.

Áreas em `src/app/features/caregiver-app/`: `network` (porta de Rede, Buscar, Profissional, Meus pedidos), `card` (Cartão Nexus), `plan` (Meu plano), `groups` (Grupos e capacitações), `content` (Conteúdos).

Rotas e parâmetros de entrada (acordos com P1 e P2):

| Rota | Parâmetros honrados |
|---|---|
| `/cuidador/rede` | nenhum (a porta) |
| `/cuidador/rede/buscar` | `?categoria=` (uma das 10 necessidades, em inglês: `physiotherapy`, `professional_caregiver`, `home_care`, `nursing`, `pharmacy`, `clinic`, `psychology`, `nutrition`, `legal`, `specialized_service`) e `?casa=1` (só quem atende em casa). O texto da busca por nome nunca vai à URL |
| `/cuidador/rede/profissional/:id` | o id do prestador (`prv_01`) |
| `/cuidador/rede/pedidos` | `?avaliar=<id do pedido>` (abre a avaliação; de Hoje) e `?pedido=<id>` (abre o pedido; da ficha) |
| `/cuidador/rede/cartao` | nenhum |
| `/cuidador/mais/plano` | `?ver=planos` (quadro dos 4 planos) |
| `/cuidador/cuidar-de-mim/grupos` | `?atividade=<id>` (detalhe; de Hoje e de Cuidar de mim) |
| `/cuidador/cuidar-de-mim/conteudos` | `?conteudo=<id>` (leitura; de Hoje) |

O bloqueio por plano do kit (`<app-cg-plan-lock>`) leva a `/cuidador/mais/plano`; nenhuma página importa página de outro dev.

## Alterações em arquivos compartilhados

| Arquivo | O quê | Por quê | Teste |
|---|---|---|---|
| `core/commerce/subscription.service.ts` | `changePlan`, `keepPlan`, `reactivate` e `startSubscription` ganharam o último parâmetro opcional `author` (id de quem fez). Sem ele vale a sessão da equipe e, sem sessão, `system`, como antes. Nada mais mudou | Decisão do líder: a troca feita pelo cuidador fica no histórico de trocas em nome dele (antes gravava `system`) | `core/commerce/subscription-author.spec.ts` (novo); `subscription.service.spec.ts` e `shared/ui/plan` seguem verdes |
| `features/network/state/network-admin.service.ts` | 3 edições mínimas: importa `serviceRequestProblem` e `isValidRating` de `core/rules/service-requests.ts`; `createRequest` usa `serviceRequestProblem` (mesma ordem de checagem, mesmas frases da equipe); `registerEvaluation` usa `isValidRating` no lugar do validador local | Extração do miolo para o núcleo (decisão 1 do contexto): a regra do pedido e da nota é uma só, a equipe e o cuidador só traduzem a frase. Comportamento da equipe idêntico | `features/network/network.spec.ts` (30 testes) segue verde |

Não foram alterados: `core/rules/index.ts` e os demais barris (os arquivos novos são importados pelo caminho), o seed, o SCSS, as rotas de `caregiver-areas.ts`, o kit visual, o contexto do cuidador e os arquivos de outros devs.

### Arquivos NOVOS fora das minhas pastas (nada existente foi alterado)

| Arquivo | O que é |
|---|---|
| `core/rules/service-requests.ts` (+ spec) | Miolo puro do pedido de serviço e da avaliação (RN-REDE-18, 25, 26, RN-ARP-02, 16, RN-LGPD-13, S-19) |
| `core/network/caregiver-network.service.ts` (+ spec) | A rede vista pelo cuidador: busca, ficha pública (o tipo NÃO carrega faixa de monitoramento, taxa de recusa, comissão nem disponibilidade), pedidos, cancelamento, avaliação e correção em até 7 dias |
| `core/groups/caregiver-activities.service.ts` (+ spec) | Programação, situação da pessoa em cada atividade, inscrição com sigilo carimbado, lista de espera e saída, sobre o `GroupMembershipService` |
| `core/rules/benefit-card.ts` (+ spec) | Economia do Cartão no mês e no total; parceiros ativos (RN-CRT-10 e 11) |
| `core/rules/guidance-content.ts` (+ spec) | Conteúdos publicados, exclusivos, ordem, tempo de leitura (RN-USR-07, RN-PLN-04 e 05, RN-POP-09) |
| `shared/ui/util/clipboard.ts` (+ spec) | `copyToClipboard`: devolve falso quando o navegador nega (plano B de seleção) |

## Estados dos critérios de aceite

Legenda: **atendido**, **parcial** (com motivo), **não atendido** (com motivo). A coluna de teste aponta o arquivo e o bloco.

### C10 Grupos e capacitações (`groups`)

| AC | Status | Onde ver / teste |
|---|---|---|
| AC-CG-99 | atendido | `/cuidador/cuidar-de-mim/grupos`, qualquer pessoa. `groups.spec.ts` "a programação" (tipo, caráter, próximo encontro, formato, vagas; rascunho, cancelada e encerrada não aparecem) |
| AC-CG-100 | atendido | Ana (Cuida) em "Organização da rotina": **Quero participar** abre "Contrato de sigilo do grupo" com o texto do grupo e a caixa; sem marcar mostra "Marque que você leu o contrato de sigilo para entrar." e não inscreve. `groups.spec.ts` "entrar" |
| AC-CG-101 | atendido | Carimbo "Aceito em 04/11/2026, às 12:00", `confidentialityAcceptedAt` gravado, atividade em "Minhas inscrições" com o próximo encontro. Mesmo teste |
| AC-CG-102 | atendido | Lotada: **Entrar na lista de espera**, folha "Você entra na posição 3.", depois "Você está na lista de espera, posição 3." Lourdes e Elza já na fila (posições 1 e 2). `groups.spec.ts` "lista de espera" |
| AC-CG-103 | atendido | Maria (Essencial) e João (Livre): "Disponível no plano Cuida" no lugar do botão, sem vermelho nem preço; rodas abertas com **Quero participar** |
| AC-CG-104 | atendido | Maria, Terezinha, Sônia e Marcos (todas Essencial, com situações de acompanhamento diferentes) veem o MESMO texto de bloqueio; nenhuma palavra de pontuação, faixa, alerta ou ARBE |
| AC-CG-105 | atendido | Terapia de grupo: "Psicoterapia", "Conduzido por Dra. Letícia Amaral, psicóloga (CRP-04/00104, fictício)."; sem indicação: "Esta atividade começa com a indicação do seu psicólogo. Fale com a gente." sem motivo clínico, com **Falar com a gente** (abre o diálogo da Base). Ver suposição S-P3-05 |
| AC-CG-106 | atendido | **Sair do grupo**: "Você deixa de participar. A sua vaga volta para outra pessoa."; cancela e promove o primeiro da fila (Lourdes). Também "Sair da lista" |
| AC-CG-107 | atendido | Detalhe de sala presencial: nome, endereço e "Sala com acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços." (só os itens que a sala tem) |
| AC-CG-108 | atendido | Teste de texto em 5 telas e pessoas: sem zarit, pontuação, faixa, alerta, ARBE, "vai melhorar", "vai aliviar" |

Erro "Não foi possível abrir a programação. Tente de novo.": **não implementado**, os dados são locais e síncronos (ver "Estados de carregamento e erro").

### C11 Conteúdos (`content`)

| AC | Status | Onde ver / teste |
|---|---|---|
| AC-CG-109 | atendido | "Para todos": 4 publicados não exclusivos, do mais novo ao mais antigo, "Leitura de N minuto(s)"; revisão e rascunho não aparecem. `content.spec.ts` |
| AC-CG-110 | atendido | Livre: UM cartão "Disponível no plano Essencial" sem listar o título exclusivo; Essencial em diante: lista "Do seu plano" |
| AC-CG-111 | atendido | Leitura em `?conteudo=` com título, parágrafos, tempo de leitura, o aviso de que não substitui profissional nem orienta remédio e Voltar. O tamanho (18 px, 22 px em Bem grande) e as 66 colunas vêm do CSS global do shell (`.cg-app`, `p { max-inline-size: 66ch }`); o jsdom não mede CSS, então o teste confere a estrutura |
| AC-CG-112 | atendido | A lista é a mesma para Ana, Maria, Elza e Lourdes (alertas e pontuações diferentes) e a ordem não lê nada disso |

### C12 a C15 Rede (`network`)

| AC | Status | Onde ver / teste |
|---|---|---|
| AC-CG-113 | atendido | `/cuidador/rede`: 3 cartões na ordem Buscar, Meus pedidos, Cartão Nexus, cada um à sua rota, na grade de 1 coluna do kit. `network.spec.ts` |
| AC-CG-114 | atendido | Seis pessoas de planos diferentes: 3 cartões, sem cadeado e sem preço; Livre: "Um benefício dos planos pagos."; Elza: "Seu número e onde usar." |
| AC-CG-115 | atendido | Aviso literal "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional." |
| AC-CG-116 | atendido | h1 "Buscar", campo "Buscar pelo nome", 10 necessidades, `?categoria=` e "5 opções em Fisioterapia." `search.spec.ts` |
| AC-CG-117 | atendido | Home care, enfermagem, psicologia e advocacia: "Única opção disponível no momento." e a opção aparece; clínica, nutrição e serviço especializado: "Nenhuma opção em ... por enquanto" com **Falar com a gente** |
| AC-CG-118 | atendido | Suspenso, descredenciado, reprovado e candidato nunca aparecem (varredura das 10 necessidades); nenhuma etiqueta de monitoramento, risco de saída, recusa ou comissão; o tipo `ProviderPublicView` do núcleo nem carrega esses campos |
| AC-CG-119 | atendido | Em destaque primeiro, depois ordem alfabética, ninguém some, nenhum "recomendado" |
| AC-CG-120 | atendido | "Nota 4,5 (N avaliações)" com 5 ou mais; "Ainda sem nota (menos de 5 avaliações)" com menos |
| AC-CG-121 | atendido | 1 caixa: sem barra; 2: "Comparar escolhidos (2)" e folha "Lado a lado"; 3: as outras caixas ficam sem uso com "Você já escolheu 3. Desmarque um para comparar outro." A folha usa colunas lado a lado em grade; no celular as colunas empilham (a UX A.3 sugere um profissional por vez com abas: **parcial só no layout** do celular, o critério está atendido). Ver S-P3-07 |
| AC-CG-122 | atendido | "Só quem atende em casa" com `aria-pressed`, contagem acompanha, `casa=1` na URL; o texto digitado não vai à URL |
| AC-CG-123 | atendido | Livre compara, mas a linha de condições diz "Condições especiais: a partir do plano Essencial." |
| AC-CG-124 | atendido | Ficha: nome, especialidade, cidade, registro e conselho (com "(fictício)"), em destaque, atende em casa, nota, condições (Essencial em diante), aviso. Sem faixa, taxa de recusa, comissão, disponibilidade nem comentários (S-18, S-30). `provider.spec.ts` |
| AC-CG-125 | atendido | **Pedir serviço** (todos os planos) cria o pedido `requested`, mostra "Pedido enviado. A equipe avisa você quando o profissional responder." com **Ver meus pedidos**; 7 toques a partir de Hoje (Rede, Buscar, necessidade, profissional, Pedir serviço, local, Enviar) |
| AC-CG-126 | atendido | Livre tem o botão como os demais, a linha de condições muda, o pedido não carrega nada além do essencial, e o telefone com **Copiar número** aparece para todos |
| AC-CG-127 | atendido | Prestador sem a cláusula de proteção de dados (Cuidadora Rosimeire Tavares, `prv_20`): sem botão, nota neutra e **Falar com a gente**; assinada a cláusula, o botão volta |
| AC-CG-128 | atendido | Suspenso, descredenciado, candidato, reprovado e inexistente: a MESMA tela "Não encontramos este profissional." (teste confere que as seis telas são idênticas) |
| AC-CG-129 | atendido | João com pedido em andamento: "Você já tem um pedido em andamento com este profissional." e **Ver pedido** (leva a `?pedido=`) no lugar de Pedir serviço |
| AC-CG-130 | atendido | Resumo "Enviamos ao profissional só o seu nome, o seu contato e o que você precisa."; o pedido gravado só tem os campos essenciais (teste confere as chaves) |
| AC-CG-131 | atendido | `orders.spec.ts`: Precisa da sua avaliação (Rita), Em andamento (João), Anteriores recolhido (`<details>`), situação em texto e ícone |
| AC-CG-132 | atendido | Cancelar pedido enviado ou aceito: a folha diz o efeito antes (foco no Voltar), vai a "Cancelado por você" |
| AC-CG-133 | atendido | Duas notas e Enviar avaliação (nota = média); sem as duas, "Falta escolher as duas notas" / "Falta escolher a nota do serviço" / "Falta escolher a nota da pontualidade e do atendimento" acima do botão, que fica desabilitado |
| AC-CG-134 | atendido | Até 7 dias (inclusive): "Você pode corrigir até 11/11." e **Corrigir minha avaliação** (notas atuais já marcadas); depois: "Prazo de correção encerrado." |
| AC-CG-135 | atendido | Recusado: "O profissional não pôde atender." sem culpa e "Ver outras opções de Nutrição" (leva a `?categoria=nutrition`) |
| AC-CG-136 | atendido | Uma avaliação por serviço (o domínio recusa a segunda); a folha mostra só a avaliação da própria pessoa; nenhum nome ou comentário de outra pessoa |
| AC-CG-137 | atendido | Maria (sem pedidos): "Você ainda não fez pedidos" com **Buscar profissionais** |
| AC-CG-138 | atendido | Varredura de texto em 4 pessoas: nada de monitoramento, taxa, comissão, disponibilidade ou faixa |

### C16 Cartão Nexus (`card`)

| AC | Status | Onde ver / teste |
|---|---|---|
| AC-CG-139 | atendido | Número `NX-0000-1007` etc., "Mostre o número no balcão do parceiro.", **Copiar número** com "Número copiado." (toast de 8 s) ou o plano B "Não foi possível copiar. Segure sobre o número e escolha Copiar." `card.spec.ts` |
| AC-CG-140 | atendido | "Onde usar": só os 5 parceiros ativos, cada um com o seu percentual; suspenso, encerrado, em revisão e prospecto não aparecem; tocar mostra a cidade e a frase do balcão |
| AC-CG-141 | atendido | Elza: os 8 usos (parceiro, data, desconto) e a economia. Ver S-P3-03 (mês sem compras) |
| AC-CG-142 | atendido | Livre: só o convite calmo, sem percentual, parceiro, preço nem número |
| AC-CG-143 | atendido | Marcos: "Seu cartão vale até 13/11, quando o plano muda para o Livre."; no dia 13/11 (relógio simulado) o cartão some e vira o convite |
| AC-CG-144 | atendido | Nenhuma leitura de pontuação, alerta ou ARBE; teste de texto com 3 pessoas |

### C18 Meu plano (`plan`)

| AC | Status | Onde ver / teste |
|---|---|---|
| AC-CG-149 | atendido | Cartão do plano atual (etiqueta, preço, situação, o que inclui), **Ver outros planos** (Livre: **Ver os planos**) e **Cancelar plano** só em plano pago. `plan.spec.ts` |
| AC-CG-150 | atendido | `?ver=planos`: R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90 por mês, itens da Figura 1, "Seu plano agora", "A mensalidade não inclui serviços da rede nem atendimento psicológico." e "Você pode cancelar em qualquer mês, sem multa."; nenhum `<small>` na tela |
| AC-CG-151 | atendido | Subir: folha "Vale hoje. O Cartão Nexus é emitido agora. A cobrança de R$ 119,90 começa no próximo ciclo, em 04/12/2026."; ao confirmar o plano muda na hora, o cartão é emitido e vem "Plano alterado para o Cuida. Cartão NX-... emitido." |
| AC-CG-152 | atendido | Descer: vale no fim do ciclo, com a data e as turmas que a pessoa deixa; a assinatura fica `cancel_scheduled` com o plano de destino e o atual continua |
| AC-CG-153 | atendido | Cancelar: a folha diz o efeito; depois aparece "Cancelamento agendado para 06/11/2026." com **Manter meu plano** |
| AC-CG-154 | atendido | **Manter meu plano**: um toque, sem folha, "Plano mantido." (toast de 8 s) |
| AC-CG-155 | atendido | Primeira contratação paga: passo "Antes de confirmar" com o aviso de emergência e "Li e entendi"; sem o aceite, **Confirmar mudança de plano** mostra "Marque que você leu o aviso para continuar."; com ele grava `emergencyNoticeAcceptedAt` com data e hora. Quem já aceitou não aceita de novo |
| AC-CG-156 | atendido | Teste confere que, em todo o fluxo, o único campo é a caixa "Li e entendi" e que nenhum texto fala de cartão de crédito, validade ou código de segurança |
| AC-CG-157 | atendido | Plano pago pela empresa: nota "Este plano é pago pela empresa ... A mudança é feita pelo contrato da empresa." sem botões de troca nem de cancelamento (nem no quadro) |
| AC-CG-158 | atendido | Nenhuma frase de plano cita pontuação, faixa, alerta ou ARBE (3 pessoas, quadro e folhas). Teste também confere que Hoje, Como estou e Ajuda agora (de P1 e P2) não trazem "Ver os planos", "Mudar para o", "upgrade" nem "Assine" |

Os AC-CG-145 a 148 (Mais) são da Base.

## Estados de carregamento e erro

C13, C14, C10 e C16 listam "carregando em esqueleto" e "erro com Tentar de novo". Não foram implementados: todos os dados vêm do `Database` local, síncrono, então não existe espera nem falha de rede para mostrar. Se o líder quiser os estados mesmo assim (por exemplo para o futuro com servidor), basta envolver o `computed` de cada tela; as frases já estão no UX.

## Suposições novas (de protótipo, para o líder e o PM confirmarem)

1. **S-P3-01** O detalhe de grupo, a leitura de conteúdo e o quadro dos 4 planos abrem como "folha de tela cheia" trocando o conteúdo da própria página (o `h1` passa a ser o da folha, com Voltar e foco no título), e não como `<dialog>` de tela cheia. Mantém a URL com `?atividade=`, `?conteudo=` e `?ver=planos` (S-21), o botão Voltar do navegador fecha a folha e não há segunda pilha de foco. As folhas de confirmação e de formulário curto usam o `app-cg-sheet` do kit.
2. **S-P3-02** Em "Meus pedidos", um pedido antigo a um profissional que saiu da busca (suspenso, por exemplo) mantém o nome do profissional (é o histórico da própria pessoa) mas não leva à ficha. A ficha, a busca e a lista de resultados continuam sem ele (RN-REDE-18).
3. **S-P3-03** "O que você já economizou" mostra "Neste mês: R$ 38,40 em 3 compras." quando há compras no mês de hoje; sem compras no mês diz "Neste mês: ainda sem compras com o cartão." e, havendo histórico, "Ao todo: R$ 169,99 em 8 compras." (Elza, hoje 04/11, não tem compra em novembro).
4. **S-P3-04** O tempo de leitura vem do texto (150 palavras por minuto, no mínimo 1 minuto): "Leitura de 1 minuto". Os textos do seed são curtos, então todos dizem 1 minuto.
5. **S-P3-05** Terapia de grupo: o cuidador nunca entra sozinho. A "indicação do psicólogo" é a inscrição feita pelo psicólogo (RN-GRP-14); sem ela a tela mostra a frase neutra e **Falar com a gente**, sem motivo clínico. Quem já foi inscrito pelo psicólogo vê "Você está no grupo." e pode sair.
6. **S-P3-06** Subir de plano tem dois passos na mesma folha: o efeito (botão "Mudar para o Cuida") e, só na primeira contratação paga, "Antes de confirmar" com o aviso de emergência, a caixa "Li e entendi" e **Confirmar mudança de plano**. Sem a necessidade do aceite, o botão do efeito já confirma. Cancelar usa o botão de perigo suave (UX A.2.7), com Voltar embaixo.
7. **S-P3-07** A folha "Lado a lado" é uma grade que se ajusta à largura (colunas lado a lado quando cabem, empilhadas no celular), em vez de "um profissional por vez com abas".
8. **S-P3-08** Frases novas onde o UX não deu texto: "Compare as opções por necessidade." (cartão Buscar da porta), "N serviços para avaliar." e "Acompanhe os seus pedidos." (cartão Meus pedidos quando não há pedido esperando), "Você já escolheu 3. Desmarque um para comparar outro.", "Ninguém atende em casa em {necessidade}" com "Ver todas as opções", "Pedido cancelado. Você pode pedir de novo quando quiser." e "Você saiu do grupo. A sua vaga voltou para outra pessoa."
9. **S-P3-09** O cartão de bloqueio de conteúdo do Livre e a lista "Do seu plano" só aparecem se existir conteúdo exclusivo publicado (não faz sentido bloquear o que não existe).
10. **S-P3-10** Em "Meus pedidos", tocar num serviço concluído sem avaliação abre direto a folha de avaliação (a ação principal); os demais pedidos abrem os detalhes com as ações.
11. **S-P3-11** No quadro dos planos o botão de cada plano já diz o efeito ("Mudar para o Cuida", "Agendar mudança para o Essencial", "Agendar cancelamento"); o Livre, a partir de um plano pago, é o cancelamento.
12. **S-P3-12** Assinatura cancelada ou inexistente: a tela trata como Livre e, ao contratar, cria a assinatura nova em nome do cuidador (`reactivate` ou `startSubscription`).
13. **S-P3-13** Nos textos, a atividade se chama pelo tipo: "Entrar no grupo", "Entrar na capacitação", "Entrar na roda".

## Onde o seed diverge do UX (D.1), para o QA

- Elza (`cg_0027`) tem 1 pedido "enviado" e nenhum serviço avaliado; o UX fala de uma nutricionista avaliada. Ana tem o "Avaliado" (`srq_0092`, fora do prazo de correção) e Rita o serviço a avaliar. O caso "profissional suspenso na lista de pedidos" aparece com Lourdes (`srq_0206`, Nutri Camila Rezende, recusado).
- O UX diz "lista vazia" para João e Marlene, mas o seed dá pedidos a eles: João tem 3 (1 em andamento e 2 avaliados) e Marlene tem 1 serviço concluído sem avaliação (como Sônia e Lourdes, que também têm um a avaliar). Só Maria tem a lista de pedidos vazia (use-a para o estado vazio).
- "Neste mês: R$ 38,40 em 3 compras" do UX não existe nos dados de hoje (os 8 usos de Elza vão de agosto a 31/10).
- A atividade lotada "Sobrecarga e autocuidado" tem 8 vagas (o UX diz 12), 1º encontro em 07/11 (não 12/11), e Lourdes e Elza estão na fila (posições 1 e 2).
- Ciclo de cobrança de Ana: 06/11 (os exemplos do UX usam 18/11).
- O registro vem do cadastro: "CREFITO-MG 00001-F (fictício)", não "CREFITO-4/00000-F".

## O que o QA e o CS/CX devem testar primeiro

1. Rita: Hoje leva a `/cuidador/rede/pedidos?avaliar=srq_0126`, as duas notas, correção em 7 dias.
2. João (Livre): pedir serviço a um profissional (todos os planos pedem), plano com o aviso de emergência na primeira contratação paga, `Cartão Nexus` como convite calmo.
3. Marcos: "Manter meu plano" em um toque; cartão "vale até 13/11".
4. Maria e João: bloqueio por plano de grupos, idêntico, com a roda aberta liberada.
5. Lourdes: lista de espera de "Sobrecarga e autocuidado", posição visível.
6. Elza: os 8 usos do Cartão e a cópia do número (com e sem área de transferência).
7. Letra Bem grande em 360 px na ficha, na folha "Lado a lado" e no quadro dos planos (não foi verificado visualmente: sem servidor, só por estrutura e tokens).
