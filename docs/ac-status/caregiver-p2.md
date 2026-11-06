# Aplicativo do cuidador: status dos critérios de aceite do Dev P2

Áreas: `care` (C7 Cuidar de mim e C8 Conversar com um psicólogo), `my-wellbeing` (C9 Como estou), `help` (C3 Ajuda agora e C19 Falar com a Nexus) e `privacy` (C21 Privacidade e meus dados). Fonte dos critérios: `docs/10-cuidador-ux.md`. Contrato da Base: `docs/11-cuidador-arquitetura.md`.

Status: PRONTO. Validação por testes, typecheck, `node scripts/check-core.mjs` e `ng build`, sem servidor e sem navegador (regra de RAM). O que só um navegador mostra (visual em 360 px e nas três letras, contraste, alvo de 48 px de cada controle) NÃO foi conferido aqui e está listado em "Não verificado".

Rotas (todas por `loadComponent`, com `data.title` mantido): `/cuidador/cuidar-de-mim` (porta), `/cuidador/cuidar-de-mim/atendimento`, `/cuidador/cuidar-de-mim/como-estou`, `/cuidador/ajuda-agora` (abre sem sessão), `/cuidador/mais/ajuda`, `/cuidador/mais/privacidade`.

## Alterações em arquivos compartilhados

Prefiro arquivos novos. O que foi extraído do que a equipe já tinha (decisão 1 do contexto: o cuidador usa a MESMA regra, sem cópia) está em 4 arquivos novos do `core`; a equipe passou a delegar a eles com edição mínima.

| Arquivo | Tipo | O quê e por quê |
|---|---|---|
| `src/app/core/care/session-booking.service.ts` (+ spec) | NOVO | O miolo de agendar, cancelar e remarcar uma sessão (RN-ATD-02 a 05, 09, 10, 12, 16, 19), sem checagem de perfil, extraído de `CareSessionsService`. Ganhou a opção `homeSafetyPending` (conversa em casa pedida pelo cuidador: a segurança do local nasce NÃO confirmada e o psicólogo confirma depois, RN-ATD-09). |
| `src/app/features/care-sessions/state/care-sessions.service.ts` | EDIÇÃO | `CareSessionsService` delega ao `SessionBookingService` as leituras (`activePsychologists`, `startOf`, `activeSessionOfSlot`, `isSlotFree`, `hasYellowAlert`, `canSeePriority`, `freeSlots`, `quote`, `hoursUntil`, `hasStarted`) e os três atos (`schedule`, `cancel`, `reschedule`). A checagem de perfil ficou na borda (no `reschedule` entrou também a de criar, que antes vinha do `schedule` interno). Importações que ficaram sem uso saíram. Os 31 testes de `features/care-sessions` seguem verdes. |
| `src/app/core/care/review-request.service.ts` (+ spec) | NOVO | O miolo do pedido de revisão de uma decisão (RN-ZRT-20), sem checagem de perfil. |
| `src/app/features/zarit/state/zarit.service.ts` | EDIÇÃO | `registerReviewRequest` delega a `ReviewRequestService.register` depois de conferir que o caso é do psicólogo; saiu o `addDays` que ficou sem uso. Os testes de `features/zarit` seguem verdes. |
| `src/app/core/care/caregiver-messages.service.ts` (+ spec) | NOVO | Mensagem do cuidador para a equipe pelo aplicativo (canal `app`, prazo de 24 horas úteis pelo `messageDueAt`) e a conversa do cuidador. |
| `src/app/core/privacy/subject-rights.service.ts` (+ spec) | NOVO | Pedir cópia dos dados, pedir a eliminação e retirar o pedido, em cima de `DataSubjectRequestService`. Não toca em `CaregiverService.requestClosure` (arquivo que o P1 editava): a regra de "encerramento pedido" aparece nos dois, ver pedido 3 ao líder. |

Nenhum seed foi alterado. Nenhum `index.ts` foi tocado (importo pelos caminhos dos arquivos novos). `core/privacy` e `core/care` não exportam os arquivos novos pelo barril.

## Reuso entre áreas

- `my-wellbeing` usa `WellbeingCheckService` do P1 (`today/state/wellbeing-check.service.ts`) para gravar o humor em Como estou (o UX C9 pede o mesmo seletor de Hoje e AC-CG-98 manda ter o mesmo comportamento de AC-CG-50). É importação entre áreas, contra a regra do doc 11. Ver pedido 2 ao líder.
- `my-wellbeing` usa `MessagesService.setSupportRequest` (`features/messages`, sem checagem de perfil) para marcar "Combinar um horário" como pedido de apoio (S-16), como a equipe faz.
- Dentro das minhas 4 áreas: `help/state/copy-text.ts` e `help/state/help-numbers.ts` só são usados por `help`; as outras áreas usam serviços do `core`.

## Suposições novas (além das S-01 a S-37 do UX)

1. **S-P2-01** "Retirar o pedido" encerra o pedido do titular como `rejected_with_reason` com o motivo "Retirado pelo titular." e a tela diz "Pedido retirado por você." (não existe um estado "retirado" em `DsrStatus` e não se mexeu no modelo). O AC-CG-180 fala em o pedido "voltar a `open`": entendido como "sem efeito"; o cadastro volta a `active` (ou a `paused_by_consent_revocation`, se a autorização de saúde continua retirada).
2. **S-P2-02** "Pedir uma cópia dos meus dados" abre um pedido do tipo `access` (confirmação e acesso, RN-LGPD-18). "Baixar o arquivo" gera o JSON de `DataSubjectRequestService.exportSubjectJson` quando a equipe conclui.
3. **S-P2-03** O pedido de revisão de uma decisão (`decision_review`, da equipe) não aparece em "Meus pedidos" de Privacidade: o UX manda ficar em Como estou ("Maria: o pedido de revisão aparece em Como estou, não aqui").
4. **S-P2-04** Em casa: o cuidador informa o endereço e a segurança do local fica "não confirmada" até o psicólogo (`homeSafetyPending`). Quem agenda pela equipe continua confirmando na hora.
5. **S-P2-05** No coworking o aplicativo atribui a primeira sala reservável por nome (os 4 itens de acessibilidade, RN-ATD-10); sem sala reservável o formato não tem horário.
6. **S-P2-06** "Combinar um horário" aparece com a nota "vai falar com você hoje" e com a "ainda não conseguiu" (em ambas o contato ainda não aconteceu). Cria uma mensagem do aplicativo (assunto "Combinar um horário", texto "Prefiro que falem comigo de manhã.") marcada como pedido de apoio.
7. **S-P2-07** Datas de outro ano mostram o ano, pela convenção do UX ("ano só quando não é o corrente"): "A próxima conversa de acompanhamento deve acontecer até 04/02/2027." (o exemplo do UX traz "04/02").
8. **S-P2-08** O prazo do pedido de revisão é de 15 dias corridos (`settings.dsrDeadlineDays`, o mesmo da equipe); o "10/11" do UX é o pedido do seed da Maria.
9. **S-P2-09** A autorização do piloto só aparece para quem já decidiu sobre ela ou está no piloto, e a pessoa só pode retirá-la (quem inclui no piloto é a equipe, S-12). Para voltar: "fale com a gente".
10. **S-P2-10** Textos de efeito de retirar as autorizações que não são de saúde (números somados, família, imagem, WhatsApp, piloto) escritos na voz do aplicativo; a de saúde é o texto literal do UX. Nenhum fala em plano (RN-PLN-19).
11. **S-P2-11** "Com quem os meus dados foram compartilhados" lista todos os pedidos de serviço da pessoa (nome do profissional e data), qualquer que seja a situação do pedido, e diz "Nada mais é compartilhado." (a leitura mais completa e mais honesta com o titular).
12. **S-P2-12** Cancelar a menos de 24 horas segue o núcleo (RN-ATD-16): a conversa vira falta ("Você não compareceu") e o horário NÃO volta a ficar aberto; o AC-CG-83 ("Cancelada por você" e horário aberto) vale para 24 horas ou mais. A folha diz isso ANTES.
13. **S-P2-13** Uma conversa registrada pela equipe por telefone ou WhatsApp aparece em "Suas mensagens" com a situação "Registrada pela equipe".
14. **S-P2-14** Sem sessão, "Ajuda agora" mostra o telefone como canal em destaque (não há preferência a respeitar e é o que funciona sem o aplicativo, RN-CAN-05).
15. **S-P2-15** "Não sei" em "O que você procura?" grava orientação psicológica (S-07) e a conversa passa a mostrar esse caráter.

## Pedidos ao líder

**Status na integração (`docs/12-cuidador-integracao.md`):** 1 feito (o diálogo "Como falar com a gente" seleciona o número e usa a frase do AC-CG-161, com o helper único `shared/ui/util/clipboard.ts`; AC-CG-161 passa a atendido); 2 feito (`WellbeingCheckService` em `core/care`); 3 feito (`requestClosure` delega a `SubjectRightsService`); 4 feito (rótulo por item em `app-cg-trend`); 5 feito (Ana tem conversa agendada com o Dr. Rafael e Lourdes, confirmada com a Dra. Letícia).

1. **Contato "Como falar com a gente" (Base, `ui/cg-contact-dialog.component.ts`)**: com a área de transferência negada o texto é "Não consegui copiar sozinho. Segure sobre o número e escolha Copiar." e o número não fica selecionado; o AC-CG-161 pede "Não foi possível copiar. Segure sobre o número e escolha Copiar." com o número SELECIONADO. A folha de número da "Ajuda agora" (minha, `help/ui/call-number-sheet.component.ts`) já faz isso; `help/state/copy-text.ts` tem `copyToClipboard` e `selectContents` prontos para a Base reaproveitar.
2. **Humor**: mover `WellbeingCheckService` (P1) para `core/care` (como o `DoseCheckService`), para Hoje e Como estou usarem o mesmo serviço sem importar entre áreas. Hoje `my-wellbeing` importa de `../../today/state/wellbeing-check.service`.
3. **`CaregiverService.requestClosure`** (`features/caregivers/state`, arquivo do P1 em andamento) pode delegar a `SubjectRightsService` do núcleo (`requestErasure`) quando o P1 terminar; hoje a regra de "encerramento pedido" existe nos dois, com a diferença de que o do cuidador devolve "já existe" em vez de reaproveitar o pedido aberto.
4. **Kit (`ui/cg-trend.component.ts`)**: o `<li>` da linha do tempo não tem rótulo próprio; o UX pede que leia "04/11, sobrecarga severa, 63 pontos". Hoje cada pedaço é um elemento e os leitores de tela leem separados.
5. **Seed**: nenhuma das pessoas de demonstração tem conversa futura com psicólogo, exceto Raimunda (`cg_0018`, sex 06/11 às 14:00, confirmada); a "porta" e o "cartão da próxima conversa" ficam sem demonstração para Ana, Maria e João. Sugestão: uma sessão agendada para Ana (psicóloga Beatriz) para a demonstração.

## Não verificado (precisa de navegador)

Layout em 360, 768 e 1280 px e nas três letras; alvos de 48 px de cada controle (AC-CG-01); contraste do cartão de emergência e dos textos (AC-CG-06); nenhum número com mais de 18 px na linha do tempo (AC-CG-88: o kit usa a legenda de 14 px; conferido só pelo código); o foco ao abrir e fechar as folhas no navegador de verdade (testado no jsdom, que não tem `showModal`).

## Critérios de aceite

Legenda: **atendido** (testado), **parcial** (com o motivo), **não atendido** (com o motivo). Os testes estão em `<area>/<area>.spec.ts`.

### Ajuda agora (C3), `help/help.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-34 | atendido | `/cuidador/ajuda-agora`: 3 cartões na ordem (Emergência 192, CVV 188, equipe da Nexus) e "Mais contatos" recolhido (Disque 100 e CRAS). |
| AC-CG-35 | atendido | Tocar no número abre a folha com 40 px, "Copiar número" e a frase de que a ligação não é feita; nenhum `tel:` nem `wa.me`. Com a área de transferência negada o número fica selecionado. |
| AC-CG-36 | atendido | Sem vermelho, sirene, animação, contagem, pergunta de consentimento, preço nem plano (teste de texto e de classes); fundo `--cg-emergency-bg`. |
| AC-CG-37 | atendido | Abre sem sessão (e Sônia, sem autorização de saúde). |
| AC-CG-38 | atendido | João (telefone): o telefone no cartão da equipe com o número à vista. |
| AC-CG-39 | atendido | 20:00: "Fechado agora. Abrimos amanhã às 8h. Deixe uma mensagem pelo WhatsApp." |
| AC-CG-40 | atendido | Rodapé com a frase literal de RN-CAN-06. |

### Cuidar de mim (C7), `care/care.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-72 | atendido | 4 cartões `--link` na ordem e nas rotas certas, em `.cg-grid` (1 coluna, 2 x 2 de 768 px em diante: CSS da Base). |
| AC-CG-73 | atendido | Testado com 7 pessoas e 4 planos: nenhum cadeado, preço, selo de plano ou número. |
| AC-CG-74 | atendido | Raimunda: "Você tem uma conversa marcada: sex, 06/11, às 14:00."; Sônia: "Acompanhamento pausado." |
| AC-CG-75 | atendido | Lourdes: "Você está na lista de espera de 1 grupo."; nenhum cartão com pontuação, faixa ou alerta. |

### Conversar com um psicólogo (C8), `care/care.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-76 | atendido | Vazio com o botão primário e o aviso de emergência; com conversa futura o cartão "Sua próxima conversa" vem antes do botão (Raimunda). |
| AC-CG-77 | atendido | 3 formatos; um toque leva aos horários; só psicólogos com CRP ativo; coworking só com sala de 4 itens (nunca a Jacarandá). |
| AC-CG-78 | atendido | Folha de resumo antes de gravar; "O que você procura?" vazio e sem gravar sem escolha. |
| AC-CG-79 | atendido | Livre só "Total: R$ 120,00."; Cuida 15% e R$ 102,00; Essencial 10%; Sustenta 20%. |
| AC-CG-80 | atendido | Grava formato, horário, tipo e preço do plano; o horário sai da lista; "Conversa marcada: ..." e "Aguardando confirmação do psicólogo". |
| AC-CG-81 | atendido | Vaga tomada no instante de gravar: "Esse horário acabou de ser reservado. Escolha outro."; a folha continua. |
| AC-CG-82 | atendido | 24 horas ou mais: "Cancelar libera o horário. Não há custo."; menos: registrado como falta; "Remarcar em vez de cancelar" e "Voltar" (foco inicial) na folha. |
| AC-CG-83 | atendido, com nuance | 24 horas ou mais: horário volta a abrir e "Cancelada por você"; remarcar muda a conversa de horário. A menos de 24 horas vale RN-ATD-16 (S-P2-12). |
| AC-CG-84 | atendido | Em casa: endereço obrigatório, aviso de segurança do local, segurança gravada como não confirmada; on-line: aviso de pertinência do formato. |
| AC-CG-85 | atendido | O caráter aparece em cada conversa; horários de prioridade sem etiqueta, sem texto e sem atributo diferente (Rita vê mais horários que Marlene; nada os distingue). |
| AC-CG-86 | atendido | Sem pontuação, faixa, alerta nem "paciente" (texto da tela e da folha). |

### Como estou (C9), `my-wellbeing/my-wellbeing.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-87 | atendido | Ordem: h1 com apoio, nota de cuidado, humor, linha do tempo, "Pedir revisão de uma decisão"; "Não é um diagnóstico." junto da linha do tempo. |
| AC-CG-88 | atendido (visual não medido) | Data, faixa por extenso e pontuação só como legenda; rampa de azul (`data-band` 1 a 4); sem octógono, triângulo, termômetro, gráfico, vermelho ou âmbar. O tamanho da legenda (14 px) é do kit. |
| AC-CG-89 | atendido | Sem "alerta", "eficácia", "melhorou", "piorou" nem percentual (Ana, Maria, João, Terezinha). |
| AC-CG-90 | atendido | Ana: "A equipe de psicologia vai falar com você hoje." e 63 e 48 com as faixas por extenso. |
| AC-CG-91 | atendido | Maria: nota "ainda não conseguiu", "Combinar um horário" (cria a mensagem do aplicativo, marcada como pedido de apoio, que aparece em Falar com a Nexus) e "Seu pedido de revisão está com a Dra. Beatriz. Resposta até 10/11." |
| AC-CG-92 | atendido | Pedido gravado com o psicólogo e o prazo; "Pedido enviado. O psicólogo responde até 19/11."; texto vazio mostra a frase e o texto digitado continua. |
| AC-CG-93 | atendido | Só as 5 opções do humor; nenhum campo da escala. |
| AC-CG-94 | atendido | Sônia: sem humor e sem linha do tempo, "O acompanhamento está pausado" com "Autorizar de novo"; Hoje também não mostra o humor (teste em Privacidade). |
| AC-CG-95 | atendido | Sem conversa: "Ainda não houve uma conversa de acompanhamento" e nenhuma linha do tempo. |
| AC-CG-96 | atendido | "Entender as faixas": 4 faixas com os intervalos e a frase final "Em qualquer faixa, a equipe está aqui para conversar com você." |
| AC-CG-97 | atendido | Nenhum convite de grupo, plano, desconto, upgrade nem link para eles (4 pessoas). |
| AC-CG-98 | atendido | Humor grava na hora, "Anotado para hoje: Bem." com "Mudar" (um registro por dia) e o humor da semana na folha "Os últimos 7 dias". |

### Falar com a Nexus (C19), `help/help.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-159 | atendido | 4 canais, o preferido primeiro com "Seu canal preferido", prazos certos e o aviso de emergência. |
| AC-CG-160 | atendido | Telefone e WhatsApp abrem o diálogo da Base com o número e "Copiar número"; nenhum `tel:` nem `wa.me`. O "28 px" é do CSS da Base. |
| AC-CG-161 | atendido | O diálogo "Como falar com a gente" (Base) seleciona o número e diz "Não foi possível copiar. Segure sobre o número e escolha Copiar." quando a área de transferência é negada (ajustado na integração). A folha de número da Ajuda agora também cumpre. |
| AC-CG-162 | atendido | Grava mensagem do canal aplicativo com prazo de 24 horas úteis, mostra a confirmação e ela aparece em "Suas mensagens"; vazia mostra "Escreva a sua mensagem para enviar." |
| AC-CG-163 | atendido | Marcos: vazio com os 3 assuntos à vista e nada marcado. |
| AC-CG-164 | atendido | Fora do horário: "Fechado agora. Abrimos amanhã às 8h." e a sugestão de WhatsApp ou mensagem. |
| AC-CG-165 | atendido | Aviso de que os canais não substituem atendimento de saúde e SAMU 192. |

### Privacidade e meus dados (C21), `privacy/privacy.spec.ts`

| AC | Status | Onde ver / observação |
|---|---|---|
| AC-CG-173 | atendido | Autorizações independentes, cada uma com o estado em texto e a data; o piloto só para quem decidiu. |
| AC-CG-174 | atendido | Folha de efeito literal, foco em "Voltar", evento `revoked` do canal aplicativo, cadastro pausado, Hoje e Como estou sem blocos de saúde. |
| AC-CG-175 | atendido | Imagem, WhatsApp, números somados e família: só a própria muda; plano e cadastro intactos. |
| AC-CG-176 | atendido | Sônia: "Autorizar de novo" grava `granted` e reativa o cadastro. |
| AC-CG-177 | atendido | Histórico com autorizou, retirou e autorizou de novo, com a versão do termo; sem editar nem apagar. |
| AC-CG-178 | atendido | Protocolo e 15 dias, "Faltam 15 dias" sem vermelho; depois de concluído, "Baixar o arquivo" (JSON só do titular). |
| AC-CG-179 | atendido | Duas colunas de efeito, caixa de entendimento, botão desligado até marcar; `closure_requested` e a pessoa continua no app. |
| AC-CG-180 | atendido, com nuance | Retirar volta o cadastro a ativo e nada é eliminado; o pedido fica "retirado pelo titular" (S-P2-01). |
| AC-CG-181 | atendido | Lista os profissionais que receberam pedido (nome, data, o que foi enviado) e "Nada mais é compartilhado." |
| AC-CG-182 | atendido | "Você já tem um pedido de cópia em andamento (DSR-xxxx)." e o mesmo para eliminação (Raimunda); não cria outro. |
| AC-CG-183 | atendido | Um único botão vermelho (`btn--danger`), dentro da folha de eliminação; nenhum outro vermelho. |
| AC-CG-184 | atendido | Política com o nome e o e-mail do encarregado, linguagem simples e o aviso de protótipo literal na folha. |
