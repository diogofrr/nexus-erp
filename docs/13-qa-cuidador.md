# QA do aplicativo do cuidador: relatório

Documento do QA (dono: QA). Rodada de 05 e 06/11/2026 sobre o código integrado (22 telas, 3 devs de página, Base e integração). Sem navegador e sem servidor: leitura de código, testes em Node (jsdom, `bootCaregiverApp`), serviços do núcleo e scripts. Referências: `docs/10-cuidador-contexto.md`, `docs/10-cuidador-ux.md` (Partes C e D), `docs/11-cuidador-arquitetura.md`, `docs/12-cuidador-integracao.md`, `docs/ac-status/caregiver-p1.md`, `-p2.md`, `-p3.md`, `docs/01-regras-de-negocio.md` e `docs/05-qa.md` (método da rodada anterior da equipe).

## 1. Resumo e veredito

**Veredito: pronto com ressalvas.**

- **0 bugs P0, 0 P1, 7 P2, 8 P3** (15 achados, seção 3).
- A casca e as telas fazem o que o UX pede. O que o QA tentou quebrar e **não quebrou**: a matriz de sessão e de rotas (nenhuma tela `/app/**` abre para cuidador, nenhuma `/cuidador/**` abre para a equipe, só Começar e Ajuda agora abrem sem sessão), a adulteração de `?avaliar=`, `?pedido=`, `?atividade=`, `?conteudo=` e `/rede/profissional/<id>` (pedido de outro cuidador, rascunho, cancelada, exclusivo, suspenso, descredenciado, candidato, inexistente: nada abre e a frase é a mesma), o vazamento de dado de outro perfil (11 pessoas x 29 telas: nenhuma tela mostra faixa de monitoramento, taxa de recusa, comissão, disponibilidade, "Zarit", "ARBE", "alerta", pontuação fora de Como estou, plano ou preço em Hoje, Ajuda agora e Como estou; nenhum comentário de avaliação de outra pessoa; nenhuma condição de saúde da pessoa idosa), o texto e o tom (nenhum travessão, exclamação, emoji nem palavra proibida; `check-core` ok), os bloqueios por plano (por URL direta, upgrade na hora, descer e cancelar no fim do ciclo, "Manter meu plano", troca repetida, plano de empresa, Marcos) e a ida e volta com a equipe (agendar, cancelar com 24 h exatas e 1 minuto depois, remarcar, pedir serviço, avaliar e corrigir, grupo com lista de espera, mensagem com prazo, consentimento, pedido de dados, cadastro de quem é novo na lista do ERP).
- **O que precisa de decisão ou conserto antes de uma demonstração para pessoas de fora:**
  1. **QAC-010 (P2).** A cota ou o bloqueio do armazenamento do navegador não é avisado ao cuidador (o shell dele não monta as faixas de sistema da equipe). O "Dei" aparece como dado e some ao recarregar. É perda silenciosa de registro de remédio.
  2. **QAC-001 (P2).** Autorização de objeto só nas telas: com a sessão da Ana, os serviços de gravação aceitam o id de outra pessoa (marcar dose, editar remédio, tirar compromisso, cancelar a conversa da Lourdes, mandar mensagem como a Maria, pedir a eliminação ou retirar a autorização de saúde dela). Hoje nenhuma tela faz isso; falta a defesa no serviço.
  3. **QAC-002 (P2).** Com a autorização de saúde retirada, só a **gravação** do humor é barrada no serviço. A **leitura** do humor e da linha do tempo da escala não é (a tela esconde, o serviço entrega).
  4. **QAC-008 (P2).** A eliminação do titular apaga mensagens, humor, remédios e agenda, mas deixa o texto livre do pedido de serviço, do pedido de revisão, o comentário da avaliação e o endereço de casa da conversa.
  5. **QAC-011 (P2).** O zoom de pinça (comum no público de 40 a 68 anos com baixa visão) faz o shell esconder a barra inferior, como se fosse o teclado.
- **Números dos testes.** A suíte inteira passa: **148 arquivos, 2 040 testes** (1 882 dos devs mais 158 do QA, dos quais 22 são `it.fails` que guardam os bugs abaixo; resultado: 2 018 passam e 22 "falham como esperado"). `pnpm run typecheck`, `node scripts/check-core.mjs` e `pnpm run check:a11y` limpos. `pnpm exec ng build` limpo (pacote inicial 631,85 kB, 159,66 kB de transferência; cada área do cuidador é um pedaço de 8 a 28 kB carregado sob demanda; "Kit do cuidador" não está no pacote).
- **ACs.** Dos 190 critérios, **0 não atendidos**, **4 parciais** (AC-CG-05, 39, 134 e 164, ligados a QAC-011, QAC-007 e QAC-012) e **12 que só um navegador confirma** (AC-CG-01, 02, 14, 15, 21, 36, 41, 55, 88, 111, 150 e 183: letra, alvos, rolagem, cor). Os outros **174** estão atendidos, por teste do QA ou por teste do dev que o QA leu e conferiu com varredura própria (seção 4 diz qual).

**Recomendação.** Pode seguir para a demonstração com o grupo da CS/CX. Antes de mostrar a pessoas de fora, corrigir QAC-010 e QAC-011 (os dois são visíveis para quem usa) e decidir QAC-005 (WhatsApp sem autorização) e QAC-008. QAC-001 e QAC-002 não têm efeito hoje na tela, mas são o primeiro requisito de segurança de um backend de verdade: entram na próxima rodada.

## 2. Como ler os testes

Os testes de regressão estão em `src/app/qa/`:

| Arquivo | O que guarda |
|---|---|
| `caregiver-regression.qa.spec.ts` | Serviços e regras: autorização de objeto, saúde, plano, integridade com a equipe, datas, entradas |
| `caregiver-ui.qa.spec.ts` | Matriz de sessão e rotas, adulteração de URL, plano e saúde nas telas, Hoje e doses, teclado virtual e zoom |
| `caregiver-sweep.qa.spec.ts` | 11 pessoas x 29 telas: vazamento, oferta ligada à saúde, texto e tom, acessibilidade por código, minimização |
| `caregiver-persistence.qa.spec.ts` | Banco antigo, exportar e importar, resetar, armazenamento cheio, cadastro de quem é novo |

Para cada bug confirmado há um teste do comportamento CORRETO marcado com `it.fails(...)` e o comentário `QAC-NNN`: a suíte fica verde e, quando o bug for corrigido, o teste passa a falhar e se tira o `.fails`. Cada `it.fails` foi conferido uma vez sem o `.fails` para ter certeza de que falha **pela razão do bug** (e não por erro do teste).

Rodar só o QA: `pnpm exec ng test --watch=false --include 'src/app/qa/**/*.spec.ts'` (158 testes, cerca de 25 s). A varredura demora porque abre as telas de cada pessoa.

## 3. Bugs

Severidade: P0 bloqueia o uso, P1 grave, P2 médio, P3 detalhe. Os arquivos e linhas são do código integrado de 05/11/2026.

| ID | Sev. | Tela ou serviço | Passos para reproduzir | Esperado | Obtido | AC ou RN | Arquivo e linha | Sugestão | Teste |
|---|---|---|---|---|---|---|---|---|---|
| QAC-001 | P2 | Serviços de gravação do núcleo e das áreas | Entrar como Ana (`cg_0001`). Pelos serviços: `DoseCheckService.mark(medMaria, ...)`, `MedicationService.update(medMaria, ...)`, `AgendaService.remove(compromissoMaria)`, `ConversationsService.cancel({ ...minhaConversa, id: 'ses_0062' })`, `SessionBookingService.cancel('ses_0062', 'user')`, `CaregiverMessagesService.send('cg_0002', ...)`, `SubjectRightsService.requestErasure('cg_0002')`, `ConsentService.revoke('cg_0002', 'health_data', ...)` | Sessão de um cuidador nunca lê nem grava registro de outro, nem chamando o serviço direto | Todas as chamadas gravam: dose e remédio da Maria alterados, compromisso apagado, conversa da Lourdes cancelada, mensagem na caixa da Maria, cadastro da Maria em `closure_requested`, autorização de saúde da Maria retirada (alertas dela encerrados). As telas passam sempre o id da sessão, então hoje nenhuma tela faz isso | Missão do QA, item 2; docs/11 seção 11 ("a checagem de perfil fica na borda"); RN-LGPD-14 | `core/care/session-booking.service.ts:245` e `:278`; `core/care/dose-check.service.ts:44`; `routine/state/medication.service.ts:85`; `routine/state/agenda.service.ts:95`; `core/care/caregiver-messages.service.ts:32` e `:39`; `core/privacy/subject-rights.service.ts:69`; `core/privacy/consent.service.ts:139`; `care/state/conversations.service.ts:250` e `:268` (`isMine` confia no objeto recebido) | Um serviço do cuidador que lê o id da `CaregiverSessionService` (nunca o parâmetro) e confere o dono do registro; o núcleo pode exigir um "ator" no parâmetro e comparar com `caregiverId` do registro | `QAC-001a` a `001f` em `caregiver-regression.qa.spec.ts` |
| QAC-002 | P2 | `WellbeingCheckService`, `WellbeingViewService`, `ReviewRequestService` | Sônia (`cg_0016`, saúde retirada): `WellbeingViewService.timeline()`; ou Maria: anotar humor, retirar a saúde, `WellbeingCheckService.forDay(...)`; ou `ReviewRequestService.register(sonia, 'zarit_decision', ...)` | Humor, linha do tempo e qualquer leitura da escala desligados **na borda do serviço**; pedido de revisão de decisão da escala também | `forDay` devolve o humor de depois da retirada; `timeline()` devolve a conversa de acompanhamento de Sônia (zar_0039) e `lastText`/`nextText` falam dela; `register` grava o pedido. Só `record` confere a autorização. As telas escondem, o serviço não | RN-LGPD-14; missão do QA, item 5; docs/11 (S-29: "conferida na borda do serviço") | `core/care/wellbeing-check.service.ts:36` (sem checagem em `forDay`); `my-wellbeing/state/wellbeing-view.service.ts:78` (`completed`, `timeline`, `lastText`, `nextText`, `week`); `core/care/review-request.service.ts:32` | `forDay`, `week`, `timeline`, `lastText`, `nextText` e `register` devolvem vazio ou recusam quando `ConsentService.isActive(id, 'health_data')` é falso | `QAC-002a` a `002c` |
| QAC-003 | P3 | `planIdOfCaregiver` (preço da conversa, vaga prioritária, acesso a grupos) x `SubscriptionService.planOf` (o que a tela mostra) | Cuidador cuja única assinatura está `cancelled` com plano `sustenta` (acontece depois de eliminação, importação ou dado antigo; o seed não tem). Abrir Meu plano (Livre) e Conversar (preço) | O mesmo plano nas duas funções (Livre, R$ 120,00) | A tela diz Livre; `quote()` e a regra de grupos usam `sustenta` (a última assinatura, mesmo cancelada) | RN-PLN-14; docs/08 (uma assinatura ativa por vez) | `core/data/plan-lookup.ts:9` (`subscriptions.at(-1)` como reserva) contra `core/commerce/subscription.service.ts:162` | Uma só função, a do `SubscriptionService`, usada pelas duas | `QAC-003` |
| QAC-004 | P3 | `SubscriptionService.applyDueChanges` e `quote` | Assinar um plano pago em 31/01. Avançar o relógio para 01/03 e chamar `applyDueChanges` | Cobrança em 28/02 e depois em 31/03 (o dia de cobrança é o do início, cortado só nos meses curtos) | 28/02 e depois 28/03, 28/04...: o dia escorrega para o 28 e não volta | RN-PLN-14; missão do QA, item 8 (`addMonths` em dia 31) | `core/commerce/subscription.service.ts:552` (`rollForward` parte de `nextCycleAt` já cortado) | Calcular o ciclo a partir de `startedAt` (`addMonths(startedAt, n)`) | `QAC-004` |
| QAC-005 | P2 | Meu perfil, "Seu dia a dia" | Ana retira a autorização de WhatsApp (Privacidade). Em Meu perfil, escolher "Pelo WhatsApp" com número e salvar | O canal WhatsApp só vale com a autorização (RN-LGPD-05 e); o cadastro já faz assim (S-40): vira aplicativo | Salva "WhatsApp" como canal preferido sem a autorização; a equipe passa a ligar por um canal que a pessoa não autorizou | RN-LGPD-05 (e), RN-CAN-01; UX S-40 | `start/state/profile.service.ts:119` (`updateDaily` só valida o número) | Recusar com frase simples ("Para falarmos pelo WhatsApp, autorize em Privacidade") ou gravar `app`, como o cadastro | `QAC-005` |
| QAC-006 | P2 | Meu perfil e ARBE | Ana corrige as horas por dia para 24 (com saúde autorizada) | "A correção gera nova avaliação ARBE" e sem avisar a pessoa (AC-CG-190) | Só grava o número. Nenhum alerta ARBE nasce (a única conta que gera alerta é `setSupportRequest`, ao marcar pedido de apoio). Vale também para a edição da equipe | RN-ARBE-10; AC-CG-190 (o "sem avisar" está atendido; a "nova avaliação" não existe) | `features/messages/state/messages.service.ts:248` (único `evaluateArbe`); `start/state/profile.service.ts:119` | Chamar a avaliação da ARBE ao salvar horas (e na edição da equipe), com a mesma regra de `shouldGenerateArbeAlert` | `QAC-006` |
| QAC-007 | P3 | Ajuda agora e Falar com a Nexus (telefone) | Relógio simulado em sexta 19h, sábado ou domingo | "Fechado agora. Abrimos na segunda às 8h." | "Fechado agora. Abrimos no próximo dia útil, às 8h." (só "amanhã" é dito com o dia) | AC-CG-39 e AC-CG-164 | `state/nexus-contact.ts:51` (`phoneClosedNote`) | Dizer o dia da semana quando o próximo dia útil não é amanhã | `QAC-007` |
| QAC-008 | P2 | Eliminação do titular (visão da equipe) depois de uso no aplicativo | Ana pede serviço (texto livre), tem pedido de revisão e comentário de avaliação, marca conversa em casa (endereço). A equipe executa a eliminação | Tudo que não é registro documental sai (RN-LGPD-24), inclusive texto livre e endereço | Saem mensagens, humor, remédios, agenda e uso. **Ficam** `serviceRequests.need`, `reviewRequests.text`, `providerEvaluations.comment` e `careSessions.homeAddress` | RN-LGPD-24, RN-LGPD-21; AC-CG-179 (o que "será eliminado") | `core/privacy/retention.service.ts:184` (`erase`) e `:123` (`plan`) | Apagar ou anonimizar esses quatro campos (o registro fica, o texto sai) e listá-los em "será eliminado" | `QAC-008` |
| QAC-009 | P3 | Hoje, Cuidar de mim, Atendimento, Como estou, Rede, Meu plano, Meu perfil | Qualquer uma dessas telas, navegar por títulos no leitor de tela | h1, depois h2, depois h3 | h1 e logo h3 (o cartão do kit desenha sempre `h3`) | WCAG 1.3.1; AC-CG-15 | `ui/cg-card.component.ts:40` e `ui/cg-plan-lock.component.ts:33` | Entrada `headingLevel` (padrão 2) no cartão e no bloqueio | `QAC-009` em `caregiver-sweep.qa.spec.ts` |
| QAC-010 | P2 | Shell do cuidador | Cota do `localStorage` cheia (ou armazenamento bloqueado). Em Remédios, tocar "Dei" | Aviso do que não foi guardado (o shell da equipe tem as faixas; o do cuidador tem só "sem conexão") | A linha vira "Dado às HH:mm" e nada avisa; ao recarregar a marca some. Vale para toda gravação do cuidador | `docs/05-qa.md` (a cota fica em 3,1 a 3,4 MB de ~5 MB depois de uso); AC-CG-65 ("continua após recarregar") | `features/caregiver-app/shell/caregiver-shell.component.ts` (não monta `app-system-banners`); `layout/shell/system-banners.component.ts` | Montar `SystemBannersComponent` (ou um aviso do kit com a mesma fonte, `StorageService.notices`) no shell do cuidador | `QAC-010` em `caregiver-persistence.qa.spec.ts` |
| QAC-011 | P2 | Shell do cuidador, em celular | Dar zoom de pinça (2x) em qualquer tela, sem campo com foco | A barra inferior continua (zoom não é teclado) | A barra some: o shell compara `visualViewport.height` com 75% da janela, sem olhar a escala nem o foco | AC-CG-05 (a barra volta ao tocar fora do campo); AC-CG-04 | `shell/caregiver-shell.component.ts:87` | Só esconder quando `visual.scale <= 1` e há campo de texto com foco | `QAC-011` em `caregiver-ui.qa.spec.ts` |
| QAC-012 | P3 | Meus pedidos, correção de avaliação | Avaliar em D; abrir em D+7 | AC-CG-134: "com 7 dias ou mais, Prazo de correção encerrado" | Editável até D+7 inclusive (RN-ARP-16 diz "em até 7 dias"). Os dois textos divergem em 1 dia; o código segue a regra de negócio. O teste guarda o comportamento atual | RN-ARP-16, AC-CG-134 | `core/rules/service-requests.ts:96`; `core/rules/arp.ts:143` | PM e UX decidem qual texto muda | `prazo de correção da avaliação (hoje)` (teste comum, sem `.fails`) |
| QAC-013 | P3 | Conversar com um psicólogo, formato coworking | Dois cuidadores, dois psicólogos, mesmo dia e hora, os dois no coworking | Salas diferentes (ou recusa) | As duas conversas ficam na Sala Girassol: a sala é "a primeira reservável", sem olhar o horário | RN-ATD-10 (só fala de acessibilidade; conflito de horário não está nas RN: decisão de produto) | `care/state/conversations.service.ts:168` (`room`) | Escolher a primeira sala livre no horário (a agenda de grupos também usa as salas) | `QAC-013` |
| QAC-014 | P3 | Privacidade, "Baixar o arquivo" (cópia dos dados) | Mensagem do cuidador com `riskFlag` e `assignedToUserId` (a equipe sinalizou). Baixar a cópia | Os dados do titular, sem as marcas de triagem de risco do atendimento (POP-05 é restrito) | O JSON leva `riskFlag`, `riskDoubt`, `assignedToUserId` e os pedidos inteiros (`handledByUserId`, `resolutionNote`) | RN-LGPD-18, RN-POP-05 | `core/privacy/data-subject-request.service.ts:220` (`exportSubject`: `messages` e `dataSubjectRequests` sem projeção) | Projetar só os campos do titular; decidir com o encarregado se a marca de risco é dado dele | `QAC-014` |
| QAC-015 | P3 | Agenda, Remédios, Pedido de serviço, Falar com a Nexus, Meu perfil | Texto de 10 mil caracteres no título do compromisso, no nome do remédio, na necessidade do pedido e na mensagem; nascimento da pessoa idosa `30/02/2026` | Limite de tamanho (o cadastro limita o nome a 120) e data que existe | Tudo aceito e gravado (e o armazenamento do navegador é pequeno). A data impossível passa em `updateElder` (só compara texto com "hoje") | `docs/05-qa.md` QA-016 (mesma família); RN-USR-14 | `routine/state/agenda.service.ts:61`; `routine/state/medication.service.ts`; `core/network/caregiver-network.service.ts:230`; `core/care/caregiver-messages.service.ts:39`; `start/state/profile.service.ts:93` | Limites (por exemplo 120 e 2 000) no núcleo e `isValidIsoDate` na data | `QAC-015a` e `QAC-015b` |

### Observações que não viraram bug (decisões e riscos)

- **Sem expiração por inatividade para o cuidador** (docs/11 seção 14, decisão 2): a sessão vale enquanto a aba existir. Em aparelho compartilhado, a próxima pessoa vê saúde, remédios e conversas. Aceitável no protótipo; registrar na demonstração.
- **Menu do cuidador com o plano**: o menu "Mais" mostra "Plano Cuida" e o preço (AC-CG-145 pede). O cabeçalho e a barra não mostram plano em nenhuma tela (QA:S).
- **A política de privacidade** (texto do seed) cita "Escala de Zarit"; o resto do app diz "escala de cansaço". É texto jurídico: não alterei.
- **"Registrado por usuário"** é o que a equipe vê no histórico de consentimento feito pelo próprio cuidador (`shared/ui/consent/consent-manager.component.ts:197`): vale "pelo próprio titular".
- **NG0956** (aviso de desenvolvimento): trocar de atividade em `?atividade=` recria a lista de encontros (1 item). Inofensivo; `track` por índice ou id apaga o aviso.
- **A pessoa idosa de demonstração** não tem `conditionsSummary` no seed; o QA preencheu um texto único para provar que nenhuma tela o desenha (QA:S, 11 pessoas x 29 telas).
- **`/app/_kit` da equipe** segue no pacote de produção (38 kB, `kit-routes`): já registrado em `docs/12` seção 6.
- **Cancelar a menos de 24 h**: a vaga fica ocupada (a sessão vira `no_show`, "para fins de ocupação", RN-ATD-16). O AC-CG-83 diz que "o horário antigo volta a ficar aberto"; vale só para 24 h ou mais (comportamento certo pela RN, texto do AC genérico).

## 4. Auditoria dos 190 critérios de aceite

Veredito: **Atendido**, **Parcial** (o critério tem uma divergência, ligada a um bug ou decisão da seção 3) ou **NV** (só um navegador confirma; o QA diz o que conferiu por código). Nenhum critério ficou "não atendido".

Como ler "Como o QA verificou":
- **QA:R, QA:U, QA:S, QA:P** são os testes novos desta rodada (`caregiver-regression`, `-ui`, `-sweep` e `-persistence`). O QA os escreveu e leu o código que eles exercitam.
- **Dev: `<área>.spec`** é o teste do dev da área. O QA leu o nome e as frases do teste e conferiu o que importava com varredura própria; **não** refez cada critério a partir da implementação. Onde o critério é de segurança, privacidade, plano ou saúde, o QA leu a implementação (indicada em "Arquivo") e refez o teste.
- **Script** é `pnpm run check:a11y` ou `node scripts/check-core.mjs`. **Leitura** é só leitura de código ou CSS.
- Caminhos relativos a `src/app/features/caregiver-app/`, salvo `core/...` e `features/auth/...`.

| AC | Tela | Veredito | Arquivo | Como o QA verificou |
|---|---|---|---|---|
| AC-CG-01 | Casca | NV | `ui/`, `styles/_caregiver.scss` | Script: alvos de 48 px nos tokens e em 16 controles do kit. O corpo de 18 px e os 8 px entre alvos pedem medida em 360 px |
| AC-CG-02 | Casca | NV | `styles/_caregiver.scss` | Leitura do token de 22 px ("Bem grande"). Rolagem e corte de texto em 360 px: navegador |
| AC-CG-03 | Casca | Atendido | `shell/caregiver-shell.component.ts`, `ui/cg-header.component.ts` | QA:S (um link "Ajuda agora" em 29 telas x 2 pessoas), QA:U (abre sem sessão). Cor e animação: leitura do CSS |
| AC-CG-04 | Casca | Atendido | `ui/cg-nav.component.ts` | QA:S (5 itens na ordem, `aria-current`; sem barra na tela larga) |
| AC-CG-05 | Casca | Parcial | `shell/caregiver-shell.component.ts:87` | QA:U (teclado aberto: a barra some e volta). **QAC-011**: o zoom de pinça também esconde a barra. Barra de ação fixa: navegador |
| AC-CG-06 | Casca | Atendido | `styles/_caregiver.scss` | Script: `check:a11y` (107 conferências, 51 pares de contraste) |
| AC-CG-07 | Casca | Atendido | `styles/_caregiver.scss:102` | Leitura: `--cg-dur` e `--cg-dur-sheet` valem 0 ms em `prefers-reduced-motion`. Não exercitado em navegador |
| AC-CG-08 | Casca | Atendido | `ui/cg-note`, `cg-row`, `cg-dose` | QA:S (todo estado das 29 telas traz texto junto do ícone). Escala de cinza: navegador |
| AC-CG-09 | Casca | Atendido | `ui/cg-proto-note.component.ts` | QA:S (frase literal ao fim de 29 telas x 2 pessoas); Dev: `caregiver-entry.spec` (entrada) |
| AC-CG-10 | 4 telas | Atendido | `help/`, `care/`, `start/` | QA:S (192 e o aviso dos canais em Ajuda agora, Falar com a Nexus e Conversar); Começar, última etapa: Dev `start.spec` |
| AC-CG-11 | Casca | Atendido | `ui/cg-sheet.component.ts` | Dev: `ui.spec` (foco no título, fundo inerte, Esc, retorno ao gatilho). Ancoragem de 768 px: navegador |
| AC-CG-12 | Todas | Atendido | todo o app | QA:S (11 x 29 telas: travessão, "!", emoji, palavras proibidas, diagnóstico, alerta, vencido, atrasado); Script: `check-core` |
| AC-CG-13 | Casca | Atendido | `state/font-scale.service.ts` | Dev: `state.spec`, `shell.spec`. Leitura: nenhum `localStorage` direto em `caregiver-app` |
| AC-CG-14 | Todas | NV | CSS | Rolagem horizontal em 360, 768 e 1280 px |
| AC-CG-15 | Casca | NV | `shell/` | QA:S (link "Ir para o conteúdo" em toda tela). Ordem visual, anel de foco e barras fixas: navegador |
| AC-CG-16 | Casca | Atendido | `ui/` | QA:S (todo botão, link e campo tem nome; nenhum ícone sozinho sem rótulo) |
| AC-CG-17 | Entrada | Atendido | `features/auth/pages/login.page.ts` | Dev: `caregiver-entry.spec` |
| AC-CG-18 | Entrada | Atendido | `core/auth/caregiver-session.service.ts` | Dev: `caregiver-entry.spec`; QA:R (sessão guardada, sem segundo fator); QA:U (rota de origem lembrada) |
| AC-CG-19 | Entrada | Atendido | `login.page.ts` | Dev: `caregiver-entry.spec` |
| AC-CG-20 | Entrada | Atendido | `core/auth/caregiver-access.ts` | QA:R e QA:U (encerrado, anonimizado, eliminado e inexistente não entram; pedido de exclusão e saúde retirada entram) |
| AC-CG-21 | Entrada | NV | `state/demo-caregivers.ts` | QA:U (texto sem pontuação, faixa, alerta ou saúde). Altura de 72 px: navegador |
| AC-CG-22 | Rotas | Atendido | `core/auth/guards.ts` | QA:U (4 perfis da equipe x todas as rotas `/cuidador/**` voltam a `/app/painel`; cuidador x todas as `/app/**`, `/login`, `/`, `/403` voltam a `/cuidador/hoje`; nenhuma linha `denied` falsa) |
| AC-CG-23 | Rotas | Atendido | `routing/caregiver.routes.ts` | QA:U (sem sessão só Começar e Ajuda agora abrem; as outras 19 vão a `/login`) |
| AC-CG-24 | Começar | Atendido | `start/pages/start.page.ts` | Dev: `start.spec` |
| AC-CG-25 | Começar | Atendido | `start/state/start-fields.ts` | Dev: `start.spec`; QA:R (18 anos exatos passam, 17 não) |
| AC-CG-26 | Começar | Atendido | `start-fields.ts`, `shared/ui/forms/form-errors.ts` | Dev: `start.spec` ("Parece um CPF real", "Gerar CPF fictício") |
| AC-CG-27 | Começar | Atendido | `start-fields.ts` | Dev: `start.spec`; QA:R (horas de 0 a 24, frase humana) |
| AC-CG-28 | Começar | Atendido | `start.page.ts` | Dev: `start.spec` (5 cartões independentes, nada marcado, "Decidir depois" = pendente) |
| AC-CG-29 | Começar | Atendido | `start.page.ts` | Dev: `start.spec` ("Tudo bem. A agenda...") |
| AC-CG-30 | Começar | Atendido | `core/care/caregiver-registration.service.ts` | Dev: `start.spec`; QA:P (aceite gravado com data e hora) |
| AC-CG-31 | Começar | Atendido | `start/state/signup.service.ts` | QA:P (CUI-0341, Livre, 6 consentimentos, eventos do canal app, a pessoa entra, aparece na lista da equipe) |
| AC-CG-32 | Começar | Atendido | `start.page.ts` | Dev: `start.spec` (retomar e começar de novo) |
| AC-CG-33 | Começar | Atendido | `start.page.ts` | Dev: `start.spec` (nenhum campo de cartão, saúde ou remédio) |
| AC-CG-34 | Ajuda agora | Atendido | `help/pages/help-now.page.ts` | QA:S (ordem 192, 188, equipe) |
| AC-CG-35 | Ajuda agora | Atendido | `help/ui/call-number-sheet.component.ts` | Dev: `help.spec`; QA:S (nenhum `tel:` nem `wa.me` em 29 telas) |
| AC-CG-36 | Ajuda agora | NV | `help-now.page.ts` | QA:S (sem consentimento, plano nem preço). Sem vermelho, fundo azul 900: Script de contraste e navegador |
| AC-CG-37 | Ajuda agora | Atendido | `routing/caregiver-areas.ts` | QA:U e QA:S (abre sem sessão e com a saúde de Sônia retirada) |
| AC-CG-38 | Ajuda agora | Atendido | `state/nexus-contact.ts` | Dev: `help.spec` (telefone primeiro para quem prefere telefone) |
| AC-CG-39 | Ajuda agora | Parcial | `state/nexus-contact.ts:51` | QA:R. **QAC-007**: sexta à noite e fim de semana dizem "no próximo dia útil", não "na segunda" |
| AC-CG-40 | Ajuda agora | Atendido | `state/nexus-contact.ts` | QA:S (aviso dos canais literal) |
| AC-CG-41 | Hoje | NV | `today/pages/today.page.ts` | Dev: `today.spec` (ordem dos blocos, um h1); QA:S (um h1). 360 x 800 sem rolar: navegador |
| AC-CG-42 | Hoje | Atendido | `today/state/today-rules.ts` | QA:U (7 horários, nas bordas 11:59, 12:00, 17:59, 18:00, 00:00) |
| AC-CG-43 | Hoje | Atendido | `core/rules/staff-contact.ts` | QA:U (Ana: frase certa, nenhum convite do dia); QA:S (nenhuma pontuação) |
| AC-CG-44 | Hoje | Atendido | `core/rules/staff-contact.ts` | QA:U (Maria: frase certa, "Falar com a gente agora", sem vencido, atrasado ou prazo) |
| AC-CG-45 | Hoje | Atendido | `state/caregiver-context.service.ts` | QA:U (contato registrado: a nota some, Ana e Maria) |
| AC-CG-46 | Hoje | Atendido | `core/care/dose-check.service.ts` | QA:U ("Dei": `doseCheck` com data e `givenAt`, linha no mesmo lugar, "Desfazer" na faixa) |
| AC-CG-47 | Hoje | Atendido | `dose-check.service.ts` | QA:U (desfazer sem diálogo) e QA:R (idempotente) |
| AC-CG-48 | Hoje | Atendido | `ui/cg-dose.component.ts` | Dev: `today.spec`, `routine.spec`. Âmbar suave: navegador |
| AC-CG-49 | Hoje | Atendido | `today/state/today-view.service.ts` | Dev: `today.spec` ("Ver todos", vazio) |
| AC-CG-50 | Hoje | Atendido | `core/care/wellbeing-check.service.ts` | Dev: `today.spec` (um registro por dia, nada pré-marcado) |
| AC-CG-51 | Hoje | Atendido | `wellbeing-check.service.ts` | QA:U (Sônia: sem humor e sem nota); QA:R (gravação recusada). **QAC-002**: a leitura no serviço não confere |
| AC-CG-52 | Hoje | Atendido | `today-view.service.ts` (`invite`) | Dev: `today.spec`; leitura (rodízio por calendário, só itens abertos a todos, sem preço) |
| AC-CG-53 | Hoje | Atendido | `today-view.service.ts` (`rate`) | QA:U (`?avaliar=` abre a avaliação dela; o de outra pessoa não abre nada) |
| AC-CG-54 | Hoje | Atendido | `today.page.ts` | Dev: `today.spec` (cartão "Prefere falar com a gente?" para João) |
| AC-CG-55 | Hoje | NV | `today.page.ts` | Dev: `today.spec` (estrutura em duas colunas de 1024 px). Visual em 1280 px: navegador |
| AC-CG-56 | Hoje | Atendido | `today.page.ts` | QA:S (11 pessoas: nenhum plano, preço, desconto, pontuação, ARBE ou "alerta") |
| AC-CG-57 | Agenda | Atendido | `routine/pages/agenda.page.ts` | Dev: `routine.spec` |
| AC-CG-58 | Agenda | Atendido | `routine/state/agenda.service.ts:61` | Dev: `routine.spec`; QA:R (**QAC-015**: título sem limite) |
| AC-CG-59 | Agenda | Atendido | `core/rules/care-agenda.ts` | Dev: `routine.spec`; leitura (título vazio, dia passado, hora de hoje que passou) |
| AC-CG-60 | Agenda | Atendido | `agenda.service.ts` | Dev: `routine.spec` |
| AC-CG-61 | Agenda | Atendido | `agenda.page.ts` | Dev: `routine.spec` (efeito escrito, foco em Voltar) |
| AC-CG-62 | Agenda | Atendido | `agenda.service.ts` | Dev: `routine.spec` |
| AC-CG-63 | Agenda | Atendido | `agenda.page.ts` | Dev: `routine.spec`; QA:S (a conversa fica fora do texto da família) |
| AC-CG-64 | Remédios | Atendido | `routine/pages/medications.page.ts` | Dev: `routine.spec` |
| AC-CG-65 | Remédios | Atendido | `dose-check.service.ts:44` | Dev: `routine.spec`; QA:P (a marca continua depois de recarregar; **QAC-010**: sem aviso se o navegador não guarda) |
| AC-CG-66 | Remédios | Atendido | `routine/state/medication.service.ts` | Dev: `routine.spec` ("Dei em outro horário") |
| AC-CG-67 | Remédios | Atendido | `medication.service.ts` | Dev: `routine.spec` |
| AC-CG-68 | Remédios | Atendido | `medication.service.ts` | Dev: `routine.spec` (em pausa, sem apagar); QA:R (`mark` recusa remédio em pausa) |
| AC-CG-69 | Remédios | Atendido | `medications.page.ts` | Dev: `routine.spec` |
| AC-CG-70 | Remédios | Atendido | `medications.page.ts` | Dev: `routine.spec`; QA:S (nenhuma condição de saúde nem diagnóstico em tela) |
| AC-CG-71 | Remédios | Atendido | `ui/cg-dose.component.ts` | Dev: `routine.spec` |
| AC-CG-72 | Cuidar de mim | Atendido | `care/pages/care-hub.page.ts` | Dev: `care.spec` |
| AC-CG-73 | Cuidar de mim | Atendido | `care-hub.page.ts` | Dev: `care.spec`; QA:S (nenhum plano, preço, cadeado) |
| AC-CG-74 | Cuidar de mim | Atendido | `care/state/care-hub.service.ts` | Dev: `care.spec`; QA:U (Sônia: "Acompanhamento pausado.") |
| AC-CG-75 | Cuidar de mim | Atendido | `care-hub.service.ts` | Dev: `care.spec`; QA:S |
| AC-CG-76 | Conversar | Atendido | `care/pages/psychologist.page.ts` | Dev: `care.spec` |
| AC-CG-77 | Conversar | Atendido | `care/state/conversations.service.ts` | Dev: `care.spec`; QA:R (só psicólogo com CRP ativo; coworking só com sala de 4 itens) |
| AC-CG-78 | Conversar | Atendido | `psychologist.page.ts` | Dev: `care.spec` |
| AC-CG-79 | Conversar | Atendido | `conversations.service.ts` (`price`) | QA:R (Cuida: R$ 102,00 com 15%); Dev: `care.spec` (Livre só o total) |
| AC-CG-80 | Conversar | Atendido | `core/care/session-booking.service.ts` | QA:R (sessão `scheduled` com formato, horário, caráter e preço do plano; vaga `booked`) |
| AC-CG-81 | Conversar | Atendido | `session-booking.service.ts` | QA:R (segunda pessoa no mesmo horário: recusada) |
| AC-CG-82 | Conversar | Atendido | `session-booking.service.ts:245` | QA:R (24 h exatas: sem custo; 1 minuto depois: falta) |
| AC-CG-83 | Conversar | Atendido | `session-booking.service.ts` | QA:R (24 h ou mais: vaga reabre; remarcar reabre a antiga). Observação: com menos de 24 h a vaga fica ocupada (seção 3) |
| AC-CG-84 | Conversar | Atendido | `session-booking.service.ts` | QA:R (em casa: endereço e segurança pendente; só o psicólogo confirma com a segurança) |
| AC-CG-85 | Conversar | Atendido | `care-labels.ts` | QA:S (nenhuma etiqueta de prioridade em 11 pessoas) |
| AC-CG-86 | Conversar | Atendido | `psychologist.page.ts` | QA:S |
| AC-CG-87 | Como estou | Atendido | `my-wellbeing/pages/my-wellbeing.page.ts` | Dev: `my-wellbeing.spec`; leitura do texto de Ana |
| AC-CG-88 | Como estou | NV | `ui/cg-trend.component.ts` | Dev: `my-wellbeing.spec` (data, faixa por extenso, pontos de 14 px). Cores da rampa e tamanhos: navegador |
| AC-CG-89 | Como estou | Atendido | `wellbeing-copy.ts` | QA:S (nenhum "alerta", "eficácia", "melhorou", "piorou") |
| AC-CG-90 | Como estou | Atendido | `wellbeing-view.service.ts` | QA:U (Ana: duas conversas, 48 e 63 pontos, faixas por extenso) |
| AC-CG-91 | Como estou | Atendido | `wellbeing-view.service.ts` | Dev: `my-wellbeing.spec`; QA:R ("Combinar um horário" cria a mensagem com `isSupportRequest`) |
| AC-CG-92 | Como estou | Atendido | `core/care/review-request.service.ts` | Dev: `my-wellbeing.spec`. **QAC-002c**: sem autorização de saúde o serviço ainda grava |
| AC-CG-93 | Como estou | Atendido | `my-wellbeing.page.ts` | Dev: `my-wellbeing.spec`; QA:S (nenhum campo de escala) |
| AC-CG-94 | Como estou | Atendido | `wellbeing-view.service.ts` | QA:U (Sônia: pausado, "Autorizar de novo", sem linha do tempo). **QAC-002b**: o serviço devolve a linha do tempo, a tela esconde |
| AC-CG-95 | Como estou | Atendido | `my-wellbeing.page.ts` | Dev: `my-wellbeing.spec` |
| AC-CG-96 | Como estou | Atendido | `my-wellbeing.page.ts` | Leitura do texto na varredura de Ana |
| AC-CG-97 | Como estou | Atendido | `my-wellbeing.page.ts` | QA:S (nenhum plano, desconto ou convite em Como estou, 11 pessoas) |
| AC-CG-98 | Como estou | Atendido | `wellbeing-view.service.ts` | Dev: `my-wellbeing.spec` |
| AC-CG-99 | Grupos | Atendido | `core/groups/caregiver-activities.service.ts` | QA:R (rascunho, cancelada, finalizada e inexistente fora da programação) |
| AC-CG-100 | Grupos | Atendido | `groups/pages/groups.page.ts` | Dev: `groups.spec`; QA:R (sem o aceite do sigilo não inscreve) |
| AC-CG-101 | Grupos | Atendido | `caregiver-activities.service.ts` | Dev: `groups.spec` (data e hora do aceite) |
| AC-CG-102 | Grupos | Atendido | `caregiver-activities.service.ts` | Dev: `groups.spec`; QA:R (lista de espera em ordem) |
| AC-CG-103 | Grupos | Atendido | `groups.page.ts` | QA:U (Maria, Essencial: "Disponível no plano Cuida" no lugar do botão; roda aberta liberada) |
| AC-CG-104 | Grupos | Atendido | `groups.page.ts` | QA:U (Maria, com alerta vencido, e Terezinha, sem alerta: texto idêntico) |
| AC-CG-105 | Grupos | Atendido | `groups.page.ts:190` | Leitura (`needs_indication`); QA:R (terapia recusa entrada) e QA:U (a única do seed está em andamento) |
| AC-CG-106 | Grupos | Atendido | `caregiver-activities.service.ts` | QA:R (sair promove o primeiro da fila; sair de inscrição de outra pessoa é recusado) |
| AC-CG-107 | Grupos | Atendido | `groups.page.ts` | Dev: `groups.spec` (endereço e 4 itens de acessibilidade) |
| AC-CG-108 | Grupos | Atendido | `groups.page.ts` | QA:S (nenhum convite derivado de pontuação; sem promessa de resultado) |
| AC-CG-109 | Conteúdos | Atendido | `content/pages/content.page.ts` | Dev: `content.spec`; QA:U (rascunho e em revisão não aparecem) |
| AC-CG-110 | Conteúdos | Atendido | `content.page.ts` | QA:U (Livre: um cartão "Disponível no plano Essencial" sem o título; Essencial vê a lista) |
| AC-CG-111 | Conteúdos | NV | `content.page.ts` | Dev: `content.spec` (aviso no rodapé). 18 px e 66 caracteres por linha: navegador |
| AC-CG-112 | Conteúdos | Atendido | `core/rules/guidance-content.ts` | Leitura (ordem por data de aprovação, igual para todos) |
| AC-CG-113 | Rede | Atendido | `network/pages/network-door.page.ts` | Dev: `network.spec` |
| AC-CG-114 | Rede | Atendido | `network-door.page.ts` | Dev: `network.spec` |
| AC-CG-115 | Rede | Atendido | `network-door.page.ts` | Dev: `network.spec`; QA:S |
| AC-CG-116 | Buscar | Atendido | `network/pages/search.page.ts` | Dev: `search.spec` (categoria na URL, contagem) |
| AC-CG-117 | Buscar | Atendido | `core/network/caregiver-network.service.ts` | Dev: `search.spec` ("Única opção disponível no momento.", vazio com "Falar com a gente") |
| AC-CG-118 | Buscar | Atendido | `caregiver-network.service.ts` | QA:R (suspenso, descredenciado, candidato e recusado fora); QA:S (nenhuma faixa, recusa ou comissão) |
| AC-CG-119 | Buscar | Atendido | `caregiver-network.service.ts:134` | Leitura (destaque primeiro, resto alfabético) |
| AC-CG-120 | Buscar | Atendido | `network/state/network-copy.ts` | Dev: `search.spec`; QA:R (média só com 5 avaliações) |
| AC-CG-121 | Buscar | Atendido | `search.page.ts` | Dev: `search.spec` (comparar 2 ou 3) |
| AC-CG-122 | Buscar | Atendido | `search.page.ts` | Dev: `search.spec`; QA:U (o texto da busca não vai à URL) |
| AC-CG-123 | Buscar | Atendido | `search.page.ts:246` | QA:S (Livre não vê as condições do profissional); a linha "Condições especiais: a partir do plano Essencial." vive em "Lado a lado" e na ficha |
| AC-CG-124 | Profissional | Atendido | `network/pages/provider.page.ts` | Dev: `provider.spec`; QA:U (em monitoramento aparece como os outros, sem faixa nem recusa nem comissão nem disponibilidade) |
| AC-CG-125 | Profissional | Atendido | `caregiver-network.service.ts:230` | Dev: `provider.spec`; QA:R (pedido `requested`, um por profissional, campos do pedido) |
| AC-CG-126 | Profissional | Atendido | `provider.page.ts` | Dev: `provider.spec` (Livre pede serviço; telefone com "Copiar número") |
| AC-CG-127 | Profissional | Atendido | `core/rules/service-requests.ts` | QA:U (prv_20: sem botão e com a nota) |
| AC-CG-128 | Profissional | Atendido | `caregiver-network.service.ts:157` | QA:U (10 endereços: a mesma frase, nenhum nome vaza) |
| AC-CG-129 | Profissional | Atendido | `provider.page.ts` | Dev: `provider.spec` |
| AC-CG-130 | Profissional | Atendido | `network-copy.ts` (`REQUEST_SUMMARY`) | Dev: `provider.spec`; QA:S (o pedido não tem campo de saúde) |
| AC-CG-131 | Pedidos | Atendido | `network/pages/orders.page.ts` | Dev: `orders.spec` |
| AC-CG-132 | Pedidos | Atendido | `caregiver-network.service.ts` | Dev: `orders.spec`; QA:R (cancelar pedido de outra pessoa recusado) |
| AC-CG-133 | Pedidos | Atendido | `caregiver-network.service.ts` | QA:R (duas notas, média como `score`, notas inválidas recusadas, uma avaliação por serviço) |
| AC-CG-134 | Pedidos | Parcial | `core/rules/service-requests.ts:96` | QA:R (corrigir até D+7 inclusive). **QAC-012**: o AC diz que com 7 dias encerra |
| AC-CG-135 | Pedidos | Atendido | `network-copy.ts` | Dev: `orders.spec` |
| AC-CG-136 | Pedidos | Atendido | `caregiver-network.service.ts` | QA:S (nenhum comentário nem nome de outra pessoa), QA:R (uma avaliação por serviço) |
| AC-CG-137 | Pedidos | Atendido | `orders.page.ts` | Dev: `orders.spec` |
| AC-CG-138 | Pedidos | Atendido | `orders.page.ts` | QA:S (nenhum dado interno do profissional) |
| AC-CG-139 | Cartão | Atendido | `card/pages/card.page.ts` | Dev: `card.spec`; QA:U (só o próprio número) |
| AC-CG-140 | Cartão | Atendido | `core/rules/benefit-card.ts` | QA:U (só parceiros ativos) |
| AC-CG-141 | Cartão | Atendido | `benefit-card.ts` | Dev: `card.spec` (Elza: 8 usos) |
| AC-CG-142 | Cartão | Atendido | `card.page.ts` | QA:U (João, Livre: só o convite, sem número, percentual, parceiro nem preço) |
| AC-CG-143 | Cartão | Atendido | `card.page.ts` | QA:U e QA:R (Marcos: "Seu cartão vale até 13/11..."; no dia o cartão é inativado) |
| AC-CG-144 | Cartão | Atendido | `card.page.ts` | Leitura (nenhuma leitura de pontuação, alerta ou ARBE na área); QA:S |
| AC-CG-145 | Mais | Atendido | `shell/pages/more-hub.page.ts` | Dev: `shell.spec` |
| AC-CG-146 | Mais | Atendido | `ui/cg-text-size.component.ts` | Dev: `shell.spec`, `state.spec` |
| AC-CG-147 | Mais | Atendido | `shell/caregiver-sign-out.service.ts` | QA:U (sessão apagada, `/login`, "Você saiu. Até a próxima.", `/cuidador/hoje` volta a `/login`) |
| AC-CG-148 | Mais | Atendido | `more-hub.page.ts` | Dev: `shell.spec` |
| AC-CG-149 | Plano | Atendido | `plan/pages/plan.page.ts` | Dev: `plan.spec`; QA:U (Livre sem "Cancelar plano") |
| AC-CG-150 | Plano | NV | `plan.page.ts` | QA:U (4 preços e o aviso literal, "Seu plano agora"). Nenhum texto abaixo de 14 px: navegador |
| AC-CG-151 | Plano | Atendido | `plan/state/caregiver-plan.service.ts` | QA:R (upgrade na hora, cartão segue ativo, mensagem "Plano alterado para o Cuida. Cartão NX-... segue ativo.") |
| AC-CG-152 | Plano | Atendido | `core/commerce/subscription.service.ts` | QA:R (descer: `cancel_scheduled`, data e destino; o plano atual continua; no fim do ciclo vale) |
| AC-CG-153 | Plano | Atendido | `plan.page.ts:151` | QA:R e QA:U (cancelar: efeito, nota "Cancelamento agendado para 13/11/2026" e "Manter meu plano"; o texto da nota não é o literal "Mudança agendada" do AC) |
| AC-CG-154 | Plano | Atendido | `caregiver-plan.service.ts` | QA:R ("Plano mantido.", sem folha) |
| AC-CG-155 | Plano | Atendido | `caregiver-plan.service.ts` | QA:R (aceite exigido na primeira contratação paga; grava a data e a hora) |
| AC-CG-156 | Plano | Atendido | `plan.page.ts` | QA:S (nenhum campo de cartão) |
| AC-CG-157 | Plano | Atendido | `caregiver-plan.service.ts` | QA:R e QA:U (Gisele: sem troca nem cancelamento, com a empresa) |
| AC-CG-158 | Plano | Atendido | todo o app | QA:S (cabeçalho, barra, Hoje, Como estou e Ajuda agora sem plano nem oferta) |
| AC-CG-159 | Falar com a Nexus | Atendido | `help/pages/talk-to-nexus.page.ts` | Dev: `help.spec` |
| AC-CG-160 | Falar com a Nexus | Atendido | `ui/cg-contact-dialog.component.ts` | Dev: `help.spec`; QA:S (nenhum `tel:` nem `wa.me`) |
| AC-CG-161 | Falar com a Nexus | Atendido | `shared/ui/util/clipboard.ts` | Dev: `help.spec`, `state.spec` |
| AC-CG-162 | Falar com a Nexus | Atendido | `core/care/caregiver-messages.service.ts:39` | QA:R (canal app, `new`, prazo de 24 horas úteis; sábado e feriado de 20/11 certos; texto vazio recusado; HTML e emoji como texto) |
| AC-CG-163 | Falar com a Nexus | Atendido | `talk-to-nexus.page.ts` | Dev: `help.spec` |
| AC-CG-164 | Falar com a Nexus | Parcial | `state/nexus-contact.ts:51` | **QAC-007** (mesma frase de AC-CG-39) |
| AC-CG-165 | Falar com a Nexus | Atendido | `talk-to-nexus.page.ts` | QA:S |
| AC-CG-166 | Família | Atendido | `family/pages/family.page.ts` | Dev: `family.spec` |
| AC-CG-167 | Família | Atendido | `family/state/family-text.ts` | Dev: `family.spec` |
| AC-CG-168 | Família | Atendido | `family-text.ts` | Dev: `family.spec`; leitura (a função não recebe dose, condição, conversa, grupo, escala nem plano) |
| AC-CG-169 | Família | Atendido | `shared/ui/util/clipboard.ts` | Dev: `family.spec` |
| AC-CG-170 | Família | Atendido | `family/state/family-share.service.ts` | Dev: `family.spec` ("Agora não" não grava; "Autorizo" grava com o evento); o serviço recusa sem a autorização (leitura) |
| AC-CG-171 | Família | Atendido | `family-share.service.ts` | Dev: `family.spec` |
| AC-CG-172 | Família | Atendido | `family.page.ts` | Dev: `family.spec` |
| AC-CG-173 | Privacidade | Atendido | `privacy/pages/privacy.page.ts` | Dev: `privacy.spec` |
| AC-CG-174 | Privacidade | Atendido | `core/privacy/consent.service.ts:139` | QA:R (evento `revoked` do canal app; cadastro pausado; alertas encerrados) e QA:U (Hoje e Como estou deixam de mostrar saúde) |
| AC-CG-175 | Privacidade | Atendido | `consent.service.ts` | QA:R (retirar família ou WhatsApp não muda o plano nem outra autorização; WhatsApp tira o canal preferido, como a regra) |
| AC-CG-176 | Privacidade | Atendido | `consent.service.ts` | QA:R e QA:U (autorizar de novo: ativo, humor grava, linha do tempo volta) |
| AC-CG-177 | Privacidade | Atendido | `privacy/state/privacy.service.ts` | QA:R (histórico: autorizou, retirou, autorizou) |
| AC-CG-178 | Privacidade | Atendido | `core/privacy/subject-rights.service.ts` | QA:R (protocolo, 15 dias, "Faltam N dias", sem "vencido"); Dev: `privacy.spec` ("Baixar o arquivo"). **QAC-014** (conteúdo do arquivo) |
| AC-CG-179 | Privacidade | Atendido | `subject-rights.service.ts:69` | QA:R (cadastro `closure_requested`, continua usando, "Retirar o pedido"); Dev: `privacy.spec` (duas colunas, caixa de entendimento). **QAC-008**: a lista não cobre o texto livre que fica |
| AC-CG-180 | Privacidade | Atendido | `subject-rights.service.ts` | QA:R (retirar volta ao estado certo, inclusive pausado; nada é eliminado) |
| AC-CG-181 | Privacidade | Atendido | `privacy.page.ts:273` | Dev: `privacy.spec` (nome, data e "Enviamos: nome, contato e o que você pediu."; "Nada mais é compartilhado.") |
| AC-CG-182 | Privacidade | Atendido | `subject-rights.service.ts` | QA:R (pedido repetido devolve o protocolo, não cria outro) |
| AC-CG-183 | Privacidade | NV | `privacy.page.ts`, CSS | Dev: `privacy.spec`. Vermelho só na folha de eliminação: navegador |
| AC-CG-184 | Privacidade | Atendido | `privacy.page.ts:299` | Dev: `privacy.spec`; QA:S (aviso de protótipo) |
| AC-CG-185 | Perfil | Atendido | `start/pages/profile.page.ts` | Dev: `start.spec` (CPF completo) |
| AC-CG-186 | Perfil | Atendido | `start/state/profile.service.ts` | QA:R (18 anos, telefone, e-mail, nome, cidade, horas de 0 a 24; texto do campo). **QAC-015b**: data impossível da pessoa idosa passa |
| AC-CG-187 | Perfil | Atendido | `profile.page.ts` | Dev: `start.spec`. **QAC-005**: o canal WhatsApp é aceito sem a autorização de WhatsApp |
| AC-CG-188 | Perfil | Atendido | `profile.page.ts` | Dev: `start.spec` |
| AC-CG-189 | Perfil | Atendido | `profile.page.ts` | QA:S (nenhuma condição de saúde da pessoa idosa em nenhuma tela: o QA gravou um texto único e nada o desenhou) |
| AC-CG-190 | Perfil | Atendido | `profile.service.ts:119` | QA:R (salva sem aviso adicional). **QAC-006**: não gera a nova avaliação da ARBE que a RN-ARBE-10 pede |

Contagem: **174 atendidos, 4 parciais (AC-CG-05, 39, 134, 164), 12 NV (AC-CG-01, 02, 14, 15, 21, 36, 41, 55, 88, 111, 150, 183), 0 não atendidos**.

## 5. O que foi testado e como

**Leitura de código** (o que o QA leu por inteiro): sessão e guards (`core/auth/*`), rotas (`app.routes.ts`, `routing/*`), contexto (`state/caregiver-context.service.ts`), todos os serviços do núcleo do cuidador (`core/care/*`, `core/network/caregiver-network.service.ts`, `core/groups/caregiver-activities.service.ts`, `core/privacy/subject-rights.service.ts`, `consent.service.ts`, `data-subject-request.service.ts`, `retention.service.ts`, `core/commerce/subscription.service.ts`), os serviços de estado de Hoje, Como estou, Rotina, Perfil, Cadastro, Família, Falar com a Nexus, Meu plano e Privacidade, e a lógica de URL das telas de rede, grupos e conteúdos.

**Testes novos** (158 testes em 4 arquivos; as marcas `QA:R`, `QA:U`, `QA:S` e `QA:P` da seção 4):

| Item da missão | Cobertura |
|---|---|
| 1. Auditoria dos ACs | Seção 4 |
| 2. Autorização de objeto | QA:R (serviços chamados com o id de outra pessoa; os casos que gravam viram QAC-001) e QA:U (`?avaliar=`, `?pedido=`, `?atividade=`, `?conteudo=`, `/rede/profissional/<id>` com 10 ids; plano e rascunho) |
| 3. Matriz de sessão e rotas | QA:U: 19 telas com sessão, 2 abertas, todas as rotas filhas de `/app`, 4 perfis da equipe, cuidador depois da equipe e o inverso, segundo fator pendente, cadastro encerrado, anonimizado e eliminado no meio do uso, Sair |
| 4. Vazamento de outro perfil | QA:S: 11 pessoas x 29 telas (jargão, monitoramento, recusa, comissão, plano e preço em Hoje, Ajuda agora e Como estou, prioridade de agenda, comentário de avaliação, nome de outra pessoa, condição de saúde) |
| 5. Autorização de saúde | QA:R e QA:U (Sônia, Rita e Maria: retirar, reconceder, retirar com pedido de exclusão); QAC-002 |
| 6. Plano | QA:R e QA:U (upgrade, descer, cancelar, manter, troca repetida, empresa, Marcos, pedido de exclusão aberto, bloqueios por URL); QAC-003, QAC-004 |
| 7. Integridade cruzada | QA:R, QA:P (agendar, cancelar com 24 h e 1 minuto, remarcar, em casa, pedir serviço com a equipe aceitando e concluindo, avaliar e corrigir com média de 5 avaliações, grupo com fila, mensagem com prazo, consentimentos, pedidos de dados, cadastro novo na lista, "Combinar um horário", doses) |
| 8. Datas e fuso | QA:R e QA:U (24 h exatas, hoje às 23:59, virada do dia, sábado e feriado de 20/11 no prazo da mensagem, pedido de dados no dia 15 e 16, dose, saudação nas bordas, `addMonths` em dia 31) |
| 9. Persistência | QA:P (banco antigo sem `doseChecks`, exportar e importar, resetar com a sessão aberta, armazenamento cheio, armazenamento bloqueado) |
| 10. Entradas | QA:R (horas fora de 0 a 24, NaN e infinito, 17 e 18 anos, telefone, e-mail, nome curto, HTML e emoji, vazio e só espaços, 10 mil caracteres, data impossível) |
| 11. Texto e tom | QA:S e `check-core` |
| 12. Acessibilidade | QA:S (um h1, nomes acessíveis, ids únicos, barra e `aria-current`, link "Ir para o conteúdo", "Ajuda agora") e `check:a11y` |
| 13. Desempenho | `ng build` (tamanhos), `track` e limpeza de assinaturas por leitura |
| 14. Equipe | Suíte inteira (148 arquivos) e QA:U (4 perfis voltam ao painel; nenhuma linha `denied` falsa) |

**Build.** `pnpm exec ng build`: pacote inicial 631,85 kB (159,66 kB transferidos); cada área do cuidador é um pedaço de 8 a 28 kB (a maior é Começar, 28 kB). Todas as rotas `/cuidador/**` usam `loadChildren`. O texto "Kit do cuidador" não existe no pacote. Os `addEventListener` do cuidador (shell, estado de conexão) têm limpeza no `DestroyRef`; os `effect()` morrem com o componente; `start.page` assina o `valueChanges` do próprio formulário sem `takeUntilDestroyed` (inofensivo, o formulário morre junto). As listas são curtas no seed (no máximo 20 profissionais e 8 conteúdos) e toda repetição tem `track`.

## 6. O que NÃO deu para testar sem navegador

- **Tamanho e medida**: corpo de 18 px e 22 px, alvos de 48 px, 8 px entre alvos, altura de 72 px dos cartões da entrada, 66 caracteres por linha de leitura, nenhum texto abaixo de 14 px (AC-CG-01, 02, 21, 111, 150). O script `check:a11y` confere os tokens e o CSS, não o resultado medido.
- **Rolagem e layout**: nenhuma rota com rolagem horizontal em 360, 768 e 1280 px; "sem rolar" em 360 x 800 em Hoje; duas colunas em 1280 px; folha de baixo ancorada abaixo de 768 px e central de 560 px (AC-CG-11, 14, 41, 55).
- **Cor**: escala de cinza, fundo azul 900 da Ajuda agora, vermelho só na folha de eliminação, rampa de azul da linha do tempo, âmbar suave de "Passou do horário" (AC-CG-08, 36, 48, 88, 183). O contraste dos tokens está no script; a aplicação das cores nas telas, não.
- **Foco e teclado**: ordem visual igual à do DOM, anel de foco de 3 px, barras fixas nunca cobrindo o elemento focado, foco preso na folha e retorno ao gatilho em navegador real (AC-CG-15, 11). O QA verificou os rótulos, os títulos e o link "Ir para o conteúdo".
- **`visualViewport` real** (teclado virtual do Android e do iOS): o QA simulou o evento. O comportamento com o teclado de verdade, com a barra de endereço que encolhe e com o zoom do sistema (não o de pinça) não foi visto.
- **Leitor de tela** (TalkBack, VoiceOver, NVDA), aparelho de toque, Firefox e Safari.
- **Duas abas ao mesmo tempo** (o evento `storage` entre abas): coberto pelos testes do núcleo da equipe, não exercitado com o cuidador.
- **A "mudança de dia à meia-noite" real**: só com o relógio simulado (23:59 e 00:00), nunca com o virar real.
- **Movimento reduzido**: só a leitura do token (AC-CG-07).
- **Impressão e arquivo baixado**: o conteúdo do JSON foi lido por serviço; o clique em "Baixar o arquivo" e o arquivo no disco não.

## 7. Alterações de dados feitas pelo QA

Nenhuma no navegador de ninguém: todos os testes usam o seed gerado em memória com armazenamento falso. O QA não subiu servidor, não abriu navegador, não fez `git commit` nem `git push` e não alterou código de produção (só `src/app/qa/*.qa.spec.ts` e este documento).
