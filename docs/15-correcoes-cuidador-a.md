# Correções do aplicativo do cuidador, parte A: regras, serviços e dados (Fix A)

Documento do Fix A. Corrige os achados de `docs/13-qa-cuidador.md` que são de regra, serviço e dado. Os achados de experiência (QAC-009, QAC-010 e QAC-011: títulos, aviso de armazenamento e zoom) são do Fix B e não estão aqui. Cada bug lista o que mudou, o teste e o que ficou de fora. O teste de regressão do QA (`src/app/qa/caregiver-regression.qa.spec.ts`) perdeu o `.fails` nos 19 testes dos bugs corrigidos aqui e passou a validar o comportamento certo; os três do Fix B seguem com `.fails`.

Rodada de 06/11/2026. Nada foi commitado. Sem servidor e sem navegador: validação por testes, typecheck, `check-core`, `check:a11y` e `ng build`.

## Peça nova: o guardião de posse

`src/app/core/auth/caregiver-ownership.ts` (`CaregiverOwnership`, `CaregiverOwnershipError`, `NOT_OWNER_TEXT`), exportado por `@core/auth`. Um serviço pequeno e único que a borda de cada serviço do cuidador chama, em vez de copiar um `if`.

- Com a sessão de um cuidador aberta, só vale o registro do dono da sessão: cadastro, pessoa idosa, remédio, marcação de dose, compromisso e conversa com o psicólogo. Registro que não existe conta como "de outro": a frase é a mesma ("Não encontramos este registro na sua conta.") e nada se revela.
- Sem sessão de cuidador (a equipe, o Começar, os testes do núcleo) o guardião deixa passar. A equipe segue com a checagem de perfil de sempre na borda dos serviços dela, e só existe uma sessão por vez (`AuthService.selectProfile` e `CaregiverSessionService.signIn` encerram a outra).
- Lê a sessão guardada, não o cadastro: uma sessão cujo cadastro deixou de poder entrar (encerrado no meio do uso) continua sem poder agir sobre os outros.
- Duas formas: `owns*` (devolve `true` ou `false`, para o serviço que responde `{ ok: false }`) e `assert*` (lança `CaregiverOwnershipError`, para o serviço que lança erro de domínio). Cada serviço mantém o formato de resposta que a tela já usava.
- Está documentado em `src/app/core/README.md` (seção 3, "Posse no aplicativo do cuidador").

## Por bug

### QAC-001 (P2): posse na borda dos serviços de gravação

- **O que mudou.** O guardião acima e a chamada dele na borda de: `DoseCheckService` (`mark`, `unmark`, `isGiven`, `forElder`), `MedicationService` e `AgendaService` (ler, adicionar, editar, lembrete, tirar e "Desfazer"), `CaregiverMessagesService` (`send`, `thread`), `SessionBookingService` (`schedule`, `cancel`, `reschedule`), `ConsentService` (`grant`, `refuse`, `revoke`), `SubjectRightsService` (`requestCopy`, `requestErasure`, `withdraw`, `requestsOf`), `DataSubjectRequestService` (`open`, `exportSubject`), `ReviewRequestService`, `WellbeingCheckService`, `SubscriptionService` (`changePlan`, `keepPlan`, `reactivate`, `startSubscription`), `CaregiverNetworkService`, `CaregiverActivitiesService` e `ProfileService`. `ConversationsService.isMine` passou a conferir o registro guardado pelo id, nunca o objeto recebido (a falha que o QA mostrou). `SignupService.create` e `CaregiverRegistrationService.register` tratam o caso de quem cria uma conta nova dentro da sessão de outra: a sessão antiga é encerrada antes (e volta se o cadastro falhar), e o miolo do cadastro recusa antes de gravar qualquer coisa.
- **Teste.** `QAC-001a` a `001f` (QA, sem `.fails`); `core/auth/caregiver-ownership.spec.ts` (o guardião); `features/caregiver-app/state/ownership-edges.spec.ts` (cada serviço usa o guardião, e sem sessão de cuidador tudo segue como antes); `core/care/caregiver-registration.service.spec.ts`.
- **Fora, e por quê.** Leituras sem conteúdo de pessoa (`quote`, `canSeePriority`, `ConsentService.status` e `history`) não passam pelo guardião: não devolvem dado de outra pessoa que a tela já não possa mostrar. Sem sessão de cuidador o guardião deixa passar por desenho (docs/11, seção 11: a checagem de perfil da equipe fica na borda dos serviços da equipe).

### QAC-002 (P2): autorização de saúde barra a leitura e o pedido de revisão na borda do serviço

- **O que mudou.** `WellbeingCheckService.forDay` devolve nada sem a autorização de saúde vigente (e ganhou `range`, a leitura de um período, com a mesma regra; a tela de Como estou passou a usar). `WellbeingViewService` (`timeline`, `lastText`, `nextText`) devolve vazio sem a autorização. `ReviewRequestService.register` recusa com `health_consent_required` (e `not_owner`); `ZaritService.registerReviewRequest` (equipe) traduz o novo motivo. Reconceder religa tudo, porque as leituras são reativas à autorização.
- **Teste.** `QAC-002a` a `002c` (QA); `core/care/*.spec.ts`; `ownership-edges.spec.ts`.
- **Fora, e por quê.** O cartão do pedido de revisão já feito segue visível em Como estou depois da retirada (é registro do que a pessoa pediu e do que a equipe respondeu, RN-LGPD-24). O QA só pediu barrar a criação.

### QAC-003 (P3): um só plano vigente

- **O que mudou.** `core/data/plan-lookup.ts` passou a ter o único cálculo (`currentSubscriptionOf` e `planIdOfCaregiver`); `SubscriptionService.current` e `planOf` delegam a ele. Assinatura única cancelada é Livre na tela, no preço da conversa e no acesso a grupos.
- **Teste.** `QAC-003` (QA); `core/commerce/subscription.service.spec.ts`.
- **Fora.** Nada.

### QAC-004 (P3): o dia de cobrança não escorrega

- **O que mudou.** Regra pura `nextBillingDate(startedAt, after)` em `core/rules/plans.ts` (RN-PLN-14): o ciclo é `addMonths(startedAt, n)`, nunca a partir da data já cortada. `applyDueChanges` (as duas rotas: ciclo vencido e mudança no fim do ciclo) e a previsão de `quote` e `changePlan` usam a regra; sem `nextCycleAt` numa assinatura paga, conta do início. 31/01 cobra 28/02, 31/03, 30/04. O seed já gerava assim (`nextCycle` do `build-commercial`).
- **Teste.** `QAC-004` (QA); `core/rules/plans.spec.ts` (31/01, bissexto, atraso de meses); `subscription.service.spec.ts` (ciclo, descida no fim do ciclo e previsão da tela).
- **Fora.** Dado antigo cujo `startedAt` não bate com o dia de `nextCycleAt` passa a seguir o dia do início. O seed é consistente; não há migração.

### QAC-005 (P2): WhatsApp só com a autorização de WhatsApp

- **O que mudou.** Regra pura `whatsappChannelNeedsConsent` e `effectivePreferredChannel` em `core/rules/lgpd.ts` (RN-LGPD-05 e). `ProfileService.updateDaily` recusa quem escolhe o WhatsApp sem a autorização, com `WHATSAPP_CONSENT_NEEDED` ("Para falar pelo WhatsApp, precisamos da sua autorização. Você pode dar em Privacidade."). `CaregiverService.update` (edição pela equipe) aplica a mesma regra e lança `CaregiverError` com a frase para a equipe; o diálogo de edição passou a mostrar a frase do erro. A nota fixa na tela do perfil usa o mesmo texto.
- **Teste.** `QAC-005` (QA); `start/state/profile.service.spec.ts`; `features/caregivers/state/caregiver.service.spec.ts`; `lgpd-governance.spec.ts` (regra).
- **Fora, e por quê.** A regra vale para quem **escolhe** o WhatsApp. Cadastro antigo que já estava com WhatsApp preferido e sem autorização (o seed sorteia canal e consentimento separados, então existe) não trava a correção das horas. O cadastro do Começar segue como era (vira aplicativo, S-40).

### QAC-006 (P2): corrigir as horas gera a nova avaliação da ARBE

- **O que mudou.** `ProfileService.updateDaily` e `CaregiverService.update` chamam `ArbeService.evaluateCaregiver` quando as horas mudam (RN-ARBE-10). É a avaliação que já respeita a autorização de saúde revogada (RN-ARBE-09) e não duplica alerta aberto do mesmo nível (RN-ARBE-08). Nada é dito à pessoa: o toast segue "Dados salvos." (S-25, AC-CG-190).
- **Teste.** `QAC-006` (QA); `profile.service.spec.ts` e `caregiver.service.spec.ts` (gera, não duplica, sem a autorização não avalia, só reavalia quando as horas mudam).
- **Fora.** `MessagesService.setSupportRequest` continua com a própria conta (já existia, mesma regra de `shouldGenerateArbeAlert`).

### QAC-007 (P3): "Abrimos na segunda às 8h"

- **O que mudou.** `phoneClosedNote` (só a função, em `state/nexus-contact.ts`): "amanhã" quando é amanhã, senão o dia da semana do próximo dia útil ("na segunda", "na terça" depois de feriado). Sexta à noite, sábado e domingo dizem "Abrimos na segunda às 8h".
- **Teste.** `QAC-007` (QA); `state/state.spec.ts` (frase antiga trocada).
- **Fora.** Nada.

### QAC-008 (P2): a eliminação leva o texto livre

- **O que mudou.** `RetentionService.erase` limpa o texto livre do titular e o registro fica: `serviceRequests.need` (vira `ERASED_TEXT`), `reviewRequests.text` (idem; a resposta da equipe fica), `providerEvaluations.comment` e `careSessions.homeAddress` (saem). `plan()` lista os quatro em "será eliminado" (`requestTexts`, `reviewTexts`, `evaluationComments`, `homeAddresses`), então a folha de eliminação do cuidador e a da equipe os mostram (AC-CG-179). A visão restrita da equipe (atendimento e gestão) agrupa os quatro em "Demais dados de uso..." como o resto que não é cadastral.
- **Teste.** `QAC-008` (QA); `core/privacy/privacy-services.spec.ts` (plano e eliminação, com marcadores).
- **Fora.** `consentEvents.evidence` e a descrição do pedido do titular (`dataSubjectRequests.description`) ficam: são prova de que o direito foi atendido (registro documental).

### QAC-012 (P3): prazo de correção da avaliação

- **Decisão do líder:** vale a RN-ARP-16 ("em até 7 dias"). O código já seguia (editável até D+7 inclusive).
- **O que mudou.** O texto do AC-CG-134 em `docs/10-cuidador-ux.md` ("7 dias ou menos"; "mais de 7 dias" encerra) e o teste do QA que guarda o comportamento (nome e comentário atualizados).
- **Fora.** `docs/13-qa-cuidador.md` não foi alterado (é do QA); `docs/ac-status/caregiver-p3.md` já descrevia "até 7 dias (inclusive)".

### QAC-013 (P3): sala livre no horário

- **O que mudou.** Regras puras `timeRangesOverlap`, `isRoomFreeAt` e `firstFreeRoom` em `core/rules/rooms.ts` (RN-ATD-10: só as 4 acessibilidades). `SessionBookingService` ganhou `roomBookings`, `isRoomFreeForSlot` e `freeRoomForSlot` (conversas que ocupam a vaga e encontros de grupo não cancelados nem encerrados), e `schedule` recusa sala ocupada no horário (campo `room`: "Esta sala já está reservada nesse horário.", vale também para a equipe). `ConversationsService.roomForSlot` escolhe a sala livre; `slotsFor('in_person_coworking')` só oferece horário com sala livre; sem sala livre o formato não aparece para aquele horário. A confirmação (`placeText` da tela de Conversar) cita a sala do horário escolhido.
- **Teste.** `QAC-013` (QA); `core/rules/rooms.spec.ts`; `core/care/session-booking.service.spec.ts` (duas conversas, sala cheia, cancelamento libera, encontro de grupo ocupa).
- **Fora, e por quê.** A nota genérica da etapa "Qual horário?" ainda cita a primeira sala reservável antes de a pessoa escolher o horário (texto da tela, do Fix B); a sala exata aparece na confirmação.

### QAC-014 (P3): a cópia do titular sem a triagem de risco

- **O que mudou.** `DataSubjectRequestService.exportSubject` tira `riskFlag`, `riskDoubt` e `assignedToUserId` das mensagens e `handledByUserId`, `completedByUserId` e `resolutionNote` dos pedidos. Fica o que é do titular (texto, canal, datas, o próprio pedido de apoio, protocolo, tipo e situação).
- **Teste.** `QAC-014` (QA); `privacy-services.spec.ts`.
- **Fora.** O pacote selado da equipe (`SubjectExportService`) usa o mesmo `exportSubject`, então também sai sem as marcas. A conversa com o encarregado sobre a marca de risco ser ou não dado do titular segue em aberto (por ora, fica de fora).

### QAC-015 (P3): limites de texto e datas que existem

- **O que mudou.** Constantes em `core/rules/text-limits.ts`: `NAME_MAX_CHARS = 120` (nomes e títulos) e `FREE_TEXT_MAX_CHARS = 500` (texto de pedido e de mensagem), mais `INVALID_DATE_TEXT` ("Escolha uma data que exista."). Aplicados em: título e "onde" do compromisso (`appointmentProblems`: `title_too_long`, `place_too_long`), nome e dose do remédio (`medicationProblems`: `name_too_long`, `dosage_too_long`), necessidade do pedido de serviço, comentário da avaliação, mensagem à equipe (assunto 120, texto 500), pedido de revisão, endereço de casa da conversa, nome e cidade no perfil, no cadastro (miolo do núcleo e Começar) e na edição pela equipe. Datas: perfil (quem cuida e a pessoa idosa), Começar (validadores `adultYou` e `notFuture`), miolo do cadastro e edição pela equipe recusam 30/02 e nascimento no futuro. Agenda já recusava dia que não existe.
- **Teste.** `QAC-015a` e `015b` (QA); `core/rules/text-limits.spec.ts`; `profile.service.spec.ts`; `caregiver.service.spec.ts`; `caregiver-registration.service.spec.ts`.
- **Fora.** Os campos das telas não ganharam atributo `maxlength` (é da tela); o limite vale no serviço e aparece como erro junto do campo nas telas de Agenda e Remédios. O pedido de serviço segue com o limite de 280 que a tela já tinha.

## Edições fora da posse do Fix A

Todas pequenas, feitas com `Edit` sobre texto relido logo antes, para o Fix B poder seguir:

- `features/caregiver-app/care/pages/psychologist.page.ts`: `placeText` usa a sala do horário escolhido (`roomForSlot`).
- `features/caregiver-app/start/pages/profile.page.ts`: a nota fixa do WhatsApp usa a frase da regra.
- `features/caregiver-app/routine/pages/agenda.page.ts` e `medications.page.ts`: a frase dos problemas novos (`title_too_long`, `place_too_long`, `name_too_long`, `dosage_too_long`), a ligação do erro ao campo "Onde ou com quem" e "Dose", e passar o texto desses campos à regra.
- `features/caregivers/components/caregiver-dialogs.component.ts` (edição pela equipe): mostra a frase do `CaregiverError`.
- Specs de outras áreas: `care/care.spec.ts` (a "outra pessoa" que toma o horário passou a ser simulada direto no banco, porque o serviço agora só agenda para quem está na sessão) e `state/state.spec.ts` (frase do telefone).
- `docs/10-cuidador-ux.md` (AC-CG-134) e `src/app/core/README.md`.

## Resultado

Execução final de 06/11/2026, com o Fix B trabalhando em paralelo no mesmo repositório:

- `pnpm exec ng test --watch=false`: **156 arquivos, 2 117 testes**: 2 114 passam e 3 são `it.fails` dos achados do Fix B (QAC-009, 010 e 011). Antes desta rodada eram 148 arquivos, 2 040 testes e 22 `it.fails`; os 19 testes dos bugs deste documento agora validam o comportamento certo.
- `pnpm run typecheck`, `node scripts/check-core.mjs` (683 arquivos de código, 103 do aplicativo do cuidador) e `pnpm run check:a11y` (108 conferências): limpos.
- `pnpm exec ng build`: limpo; pacote inicial 634,98 kB (160,27 kB transferidos), contra 631,85 kB do relatório do QA.
- Testes novos desta rodada: `core/auth/caregiver-ownership.spec.ts`, `core/rules/text-limits.spec.ts`, `features/caregiver-app/state/ownership-edges.spec.ts`, `features/caregiver-app/start/state/profile.service.spec.ts`, `features/caregiver-app/care/state/conversations.service.spec.ts`, `features/caregivers/state/caregiver.service.spec.ts`, e casos novos em `rules/plans.spec.ts`, `rules/rooms.spec.ts`, `rules/lgpd-governance.spec.ts`, `commerce/subscription.service.spec.ts`, `care/session-booking.service.spec.ts`, `care/caregiver-registration.service.spec.ts` e `privacy/privacy-services.spec.ts`.

## O que segue aberto

- QAC-009, 010 e 011: do Fix B.
- QAC-013: a nota genérica da etapa "Qual horário?" cita a primeira sala antes do horário escolhido (texto do Fix B).
- QAC-005: cadastro antigo com WhatsApp preferido e sem autorização não é corrigido sozinho (o seed sorteia os dois); a regra vale para quem escolhe o WhatsApp.
- QAC-014: decidir com o encarregado se a marca de risco da mensagem é dado do titular (por ora sai da cópia).
- Sem expiração de sessão do cuidador e a política de privacidade que cita "Escala de Zarit": decisões do QA, não tratadas aqui.
