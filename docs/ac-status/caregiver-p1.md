# Aplicativo do cuidador: status do Dev P1 (Hoje, Rotina, Começar, Meu perfil, Família)

Áreas: `features/caregiver-app/{today,routine,start,family}`. Telas: C4 Hoje, C5 Agenda, C6 Remédios, C2 Começar, C22 Meu perfil, C20 Família. Fonte do comportamento: `docs/10-cuidador-ux.md`. Contrato: `docs/11-cuidador-arquitetura.md`.

Legenda: **atendido** (coberto por teste), **parcial** (com o motivo), **não atendido** (com o motivo). Todos os testes citados rodam sem servidor (`bootCaregiverApp`, jsdom). Nada foi medido em navegador (RAM limitada): o que depende de pixel, rolagem ou contraste está dito como não verificado.

## Números

- Testes novos de P1: today 39, routine 34, start 35, family 19, núcleo 21 (care-agenda 16, cadastro 5): **148**. Os testes de fumaça que existiam nas quatro áreas foram absorvidos nos novos.
- Suíte inteira: ver o fechamento no fim deste arquivo.
- `pnpm run typecheck` sem erros, `node scripts/check-core.mjs` sem problema em arquivo de P1 (os que ele aponta ficam em `*.spec.ts` de outros devs: uma expressão regular de teste escrita com os próprios caracteres que o script proíbe), `pnpm exec ng build` ok.

## Hoje (C4, `/cuidador/hoje`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-41 | parcial | Ordem dos blocos (saudação, nota de cuidado, próximo compromisso, remédios, humor, Para você, Falar com a gente) e um só h1 por teste. "Sem rolar em 360 x 800" não foi medido (sem navegador) |
| AC-CG-42 | atendido | Bom dia até 11:59, Boa tarde até 17:59, Boa noite depois, com o primeiro nome (Ana, 08:30, 15:00 e 20:30) |
| AC-CG-43 | atendido | Ana: "A equipe de psicologia vai falar com você hoje." sem alerta, vermelho, pontuação, faixa, plano; sem convite do dia |
| AC-CG-44 | atendido | Maria: "A equipe ainda não conseguiu falar com você." com **Falar com a gente agora**, nota azul de cuidado, sem vencido nem atrasado |
| AC-CG-45 | atendido | Contato registrado pela equipe (alerta vira `contacted`): a nota some |
| AC-CG-46 | atendido | **Dei** grava `doseCheck` (remédio, dia, horário previsto, `givenAt` do relógio), linha no mesmo lugar, faixa "Anotado às 12:05." com **Desfazer** por 8 s |
| AC-CG-47 | atendido | **Desfazer** (faixa ou linha) remove a marcação, sem diálogo |
| AC-CG-48 | atendido | "Ainda não anotado" (neutro; âmbar suave só na primeira linha em atraso), **Dei** segue ativo (docs/15, CXC-005) |
| AC-CG-49 | atendido | Mais de 4 doses: 4 linhas e "Ver todos (6)" para Remédios; sem remédio, "Nenhum remédio cadastrado." com **Cadastrar um remédio**; conta nova sem nada: nota suave com os dois caminhos |
| AC-CG-50 | atendido | Um registro por dia, **Mudar** substitui, nada pré-marcado, as 5 opções com o mesmo visual; "Muito mal" e "Mal" mostram "Dias difíceis acontecem..." (e "Ajuda agora" só no "Muito mal") |
| AC-CG-51 | atendido | Sônia (saúde retirada): sem humor e sem nota. `WellbeingCheckService.record` também recusa sem a autorização (borda do serviço) |
| AC-CG-52 | atendido | Convite por rodízio de calendário, só itens abertos a todos os planos (conversa, roda aberta, conteúdo livre), sem preço, plano nem bloqueio; o mesmo dia dá o mesmo convite para planos diferentes |
| AC-CG-53 | parcial | "Como foi o atendimento de ...?" com **Avaliar** (Rita, Lourdes, Marlene e Sônia têm serviço concluído sem avaliação no seed). O botão leva a `/cuidador/rede/pedidos?avaliar=<id>`, onde P3 faz a folha (acordo do líder); a folha não é de P1 |
| AC-CG-54 | atendido | Canal telefone ou familiaridade baixa (João, Elza, Raimunda): cartão "Prefere falar com a gente?" com `(34) 90000-0000` em destaque, sem `tel:`; os demais: botão de texto |
| AC-CG-55 | parcial | Duas colunas de 1024 px em diante (compromisso e remédios; humor e convite) e nota na largura toda, conferido pela estrutura do DOM; o visual em 1280 px não foi medido |
| AC-CG-56 | atendido | As 9 pessoas de demonstração: nenhum plano, preço, desconto, pontuação, faixa, ARBE nem "alerta" |

Estados: sem conexão (`OnlineStatusService`) atendido. **Carregando e erro** ("Não foi possível abrir o seu dia"): não atendido, porque os dados são locais e síncronos (a tela nunca fica em carregamento nem falha ao ler).

## Agenda (C5, `/cuidador/rotina/agenda`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-57 | atendido | h1 "Rotina", abas Agenda (`aria-selected`) e Remédios com setas, **Adicionar compromisso** primário, próximos 14 dias por dia ("Hoje, qua 04/11", "Amanhã, qui 05/11", "sex, 06/11"), só dias com compromisso. "Ver anteriores" (7 dias, só leitura) e "Ver mais datas" (30 dias) |
| AC-CG-58 | atendido | Folha "Novo compromisso" (título, tipo em chips, dia, hora, onde ou com quem opcional, lembrar); aparece no dia certo; faixa "Compromisso salvo." com **Desfazer** por 8 s |
| AC-CG-59 | atendido | "Informe o que é o compromisso.", "Escolha um dia de hoje em diante.", "Escolha uma hora que ainda não passou." junto do campo e no resumo; nada digitado é apagado |
| AC-CG-60 | atendido | **Remarcar** reabre o formulário com os dados; "Remarcado para sex, 06/11, às 15:00." com **Desfazer** que restaura |
| AC-CG-61 | atendido | "Tirar este compromisso da agenda?" com o efeito escrito, foco inicial em **Voltar**; só depois de confirmar sai; **Desfazer** devolve com o mesmo id |
| AC-CG-62 | atendido | "Lembrar de mim" vem ligado; desligar (no cadastro ou no detalhe) grava `reminder: false` sem confirmação |
| AC-CG-63 | atendido | Conversa do próprio cuidador com o psicólogo aparece no dia com "Para você" e leva a `/cuidador/cuidar-de-mim/atendimento`; nunca entra no texto da família. No seed, Ana (seg, 09/11, on-line) e Lourdes (sex, 06/11, coworking) têm uma conversa futura desde a integração (`docs/12`, seção 1) |

Estados: sem conexão atendido; etiqueta "Já passou" em compromisso de hoje atendido (docs/15, CXC-001); vazio atendido. Carregando e erro: não atendido, pelo mesmo motivo de Hoje.

## Remédios (C6, `/cuidador/rotina/remedios`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-64 | atendido | Aba Remédios atual, **Hoje** com todas as doses em ordem de horário, **Todos os remédios**, aviso fixo "O app só ajuda você a lembrar..." |
| AC-CG-65 | atendido | **Dei** grava remédio, dia, horário previsto e `givenAt`; continua depois de recarregar o app com o mesmo armazenamento |
| AC-CG-66 | atendido | **Desfazer** sem confirmação; "Dei em outro horário" troca só o `givenAt` (recusa hora de hoje que ainda não chegou) |
| AC-CG-67 | atendido | **Adicionar remédio** (nome, dose, horários Manhã, Tarde, Noite e outro horário); entra em "Todos os remédios" e as doses de hoje aparecem; sem nome ou sem horário: os erros do UX |
| AC-CG-68 | atendido | "Este remédio está em uso" desligado: pausa, sai de Hoje, `doseChecks` antigos ficam, "Em pausa" recolhido; **não existe** ação de apagar |
| AC-CG-69 | atendido | "Você ainda não cadastrou remédios" com **Cadastrar um remédio**; sem dose no dia: "Hoje não há remédios para dar." |
| AC-CG-70 | atendido | Nenhum campo de diagnóstico, motivo ou orientação de dose; a tela não sugere trocar, parar nem aumentar |
| AC-CG-71 | atendido | Dose atrasada em âmbar suave com relógio, sem vermelho, **Dei** continua |

Não atendido: "Por pessoa" de João (hora em 22 px e **Dei** de 96 px): a linha da dose é o `app-cg-dose` da Base, que não tem entrada de tamanho. Pedido ao líder abaixo.

## Começar (C2, `/cuidador/comecar`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-24 | atendido | Sem sessão: cabeçalho com Ajuda agora (Base), sem barra inferior, "Etapa X de 5: nome" e as 5 etapas na ordem; boas-vindas com as 3 linhas, **Começar** e "Já tenho conta"; foco no h1 a cada etapa |
| AC-CG-25 | atendido | Menos de 18 anos: "Você precisa ter 18 anos ou mais." junto do campo e no resumo, nada apagado; exatamente 18 hoje passa |
| AC-CG-26 | atendido | CPF real: "Parece um CPF real. Use um CPF fictício."; **Gerar CPF fictício** põe um inválido e o erro some; CPF já usado também é recusado |
| AC-CG-27 | atendido | Horas fora de 0 a 24: "As horas por dia devem ser de 0 a 24."; botões menos e mais entre 0 e 24; WhatsApp mostra o número já com o celular |
| AC-CG-28 | atendido | Cinco cartões independentes (saúde aberta, quatro recolhidos com "Ler mais"), três opções do mesmo peso, nada marcado, sem piloto; quem não escolhe fica `pending` |
| AC-CG-29 | atendido | Saúde recusada ou adiada: a nota "Tudo bem. A agenda, os remédios e os conteúdos continuam..." na etapa e em "Tudo pronto"; a conta é criada no Livre |
| AC-CG-30 | atendido | Sem o aceite: "Marque que você leu o aviso para criar a conta." e nada é criado; com o aceite grava `Caregiver.emergencyNoticeAcceptedAt` com data e hora |
| AC-CG-31 | atendido | Nasce 1 cuidador `active` (`CUI-0341`), 1 pessoa idosa vinculada, 1 assinatura Livre, 6 consentimentos (`granted`, `refused` ou `pending`) e eventos com canal `app`, registrados pelo próprio cuidador; a pessoa entra com a conta e vê "Tudo pronto, Marta." com os 3 próximos passos e **Ir para Hoje**; aparece na lista do ERP |
| AC-CG-32 | atendido | Rascunho a cada etapa ("Rascunho salvo às 10:42"); ao voltar: "Você tem um cadastro em andamento... Retomar ou começar de novo?" com dois botões iguais; **Retomar** restaura campos e etapa |
| AC-CG-33 | atendido | Nenhum campo de cartão, validade, pagamento, condição de saúde ou remédio |

## Meu perfil (C22, `/cuidador/mais/perfil`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-185 | atendido | h1, três cartões (Você, Quem você cuida, Seu dia a dia) com **CPF completo**, e o seletor de tamanho da letra |
| AC-CG-186 | atendido | **Editar** abre a folha só daquela seção; valida (18 anos, e-mail e telefone fictícios, horas de 0 a 24) sem apagar o digitado; "Dados salvos."; sem mudança: "Nada mudou." |
| AC-CG-187 | atendido | Maria sem número de WhatsApp: a nota com **Informar o número** (a folha já traz o celular); ao informar, a nota some. Trocar de WhatsApp para telefone não apaga o número |
| AC-CG-188 | atendido | CPF sem campo; "Para corrigir o CPF, fale com a gente." abre o diálogo "Como falar com a gente" |
| AC-CG-189 | atendido | Nenhuma condição de saúde, remédio, diagnóstico, atendimento, grupo ou escala |
| AC-CG-190 | atendido | Horas por dia salvam sem aviso adicional e sem falar de risco |

## Família (C20, `/cuidador/mais/familia`)

| AC | Status | Onde ver, e o que foi feito |
|---|---|---|
| AC-CG-166 | atendido | Ana (autorizou): 3 chaves desligadas, caixa "Escolha o que você quer compartilhar.", **Copiar texto** sem uso com "Ligue pelo menos um item." escrito |
| AC-CG-167 | atendido | O trecho aparece e some em tempo real a cada chave |
| AC-CG-168 | atendido | Só primeiro nome da pessoa idosa, data, compromissos (com "onde") e nome mais horário dos remédios; sem dose, condição, conversa, grupo, escala, plano nem dado do cuidador além do primeiro nome (função pura `buildFamilyText`, que nem recebe esses dados) |
| AC-CG-169 | atendido | Copia e mostra "Texto copiado. Cole na conversa da sua família." (8 s); com o navegador negando (ou sem área de transferência), a caixa fica selecionada com "Segure sobre o texto e escolha Copiar." |
| AC-CG-170 | atendido | João (não autorizou): cartão com **Autorizo** e **Agora não** de peso igual; **Agora não** não grava nada; **Autorizo** grava o consentimento (c) com o evento (canal `app`, registrado pelo cuidador) e libera as chaves; autorização retirada em Privacidade volta o cartão, e `FamilyShareService.text` recusa sem ela |
| AC-CG-171 | atendido | Conversa com o psicólogo não entra no texto nem entre as opções |
| AC-CG-172 | atendido | Nenhum botão de enviar, e-mail, WhatsApp, `mailto:` nem `tel:`; o aviso "Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui." sempre visível |

## Critérios da casca (A.6) nas telas de P1

| AC | Status | Nota |
|---|---|---|
| AC-CG-01, 02, 05, 06, 14 | não verificado | Medidas de 18 px, 48 px, Bem grande em 360 px, contraste e rolagem horizontal pedem navegador. Tudo usa os componentes e as classes da Base (`.btn`, `.cg-row`, `app-cg-sheet`, tokens `--cg-*`); os estilos locais usam só tokens e `min-height: var(--cg-target)` |
| AC-CG-03, 04, 09, 15 (parte) | atendido pela Base | O cabeçalho, a barra e o aviso de protótipo vêm do shell. Teclado: toda função tem botão (por isso "Dei em outro horário" é um botão de texto sob a linha dada, e não um toque na linha) |
| AC-CG-11 | atendido | Folhas de P1 usam `app-cg-sheet`; o foco inicial em **Voltar** da confirmação tem teste |
| AC-CG-12 | atendido | `check-core` sem problema nos arquivos de P1 |
| AC-CG-13 | atendido | O tamanho da letra em Começar e Meu perfil usa `app-cg-text-size` (Base) |

## Alterações em arquivos compartilhados

| Arquivo | Edição | Motivo | Testes |
|---|---|---|---|
| `core/models/caregivers.ts` | Acrescentados dois campos opcionais: `Caregiver.emergencyNoticeAcceptedAt` e `CareAppointment.place` | Aceite do aviso de emergência com data e hora (AC-CG-30); "Onde ou com quem" do compromisso (C5) | Sem migração (campos opcionais); suíte inteira verde |
| `features/caregivers/state/caregiver.service.ts` | `create`, `findByCpf` e `nextIdentity` agora delegam ao novo `CaregiverRegistrationService` (o log de auditoria continua aqui); `CaregiverError` foi para o núcleo e é reexportado | O cuidador precisa do mesmo cadastro (código `CUI-xxxx`, consentimentos, assinatura) sem importar um serviço de outro módulo | `caregivers.spec.ts` e `auth` verdes |
| `features/auth/caregiver-entry.spec.ts` | Uma linha: o h1 de Hoje deixou de ser o placeholder "Hoje" e passou a ser a saudação (`/^(Bom dia\|Boa tarde\|Boa noite), Ana$/`) | A tela de Hoje é de P1 e substituiu o placeholder | Verde |
| Arquivos NOVOS fora das pastas de P1 | `core/care/caregiver-registration.service.ts` (+ spec), `core/rules/care-agenda.ts` (+ spec), `features/caregiver-app/state/online-status.service.ts`, `features/caregiver-app/state/people-format.ts` | Miolo do cadastro e regras de agenda no núcleo (RN no comentário e teste); o aviso de "sem conexão" e a frase "com a Dra. ..." servem a mais de uma área de P1, que nunca importam umas das outras | Specs próprios ou cobertos pelos de P1 |

Nenhuma edição em `seed`, `styles` ou `routing`. Nenhuma coleção nova (`wellbeingChecks` já existia; `doseChecks` é da Base).

## Suposições novas (para o líder e o PM confirmarem)

- **S-38** "Compromissos desta semana" (Família) são os dos próximos 7 dias, sem os de hoje, para o texto não repetir o de hoje nem ficar vazio no sábado.
- **S-39** O tipo do compromisso (Consulta, Fisioterapia, Psicologia, Outro) é obrigatório e nada vem marcado: "Escolha o tipo do compromisso."
- **S-40** Quem escolhe WhatsApp como canal mas não autoriza o contato por WhatsApp (etapa 4) nasce com o canal "aplicativo", e o número fica guardado (mesma regra da revogação, RN-LGPD-05 e). A etapa 4 avisa na hora.
- **S-41** A dose do remédio é opcional no formulário (o AC-CG-67 só exige nome e horário).
- **S-42** "Preencher com dados de exemplo" preenche as etapas 1 a 3 (nunca as autorizações), para a demonstração do cadastro caber em poucos toques.
- **S-43** Quem já tem sessão e abre `/cuidador/comecar` vai a Hoje (a Base deixou a decisão para P1).
- **S-44** "Dei em outro horário" é um botão de texto sob a linha dada (o UX diz "tocar na linha"), para funcionar por teclado e leitor de tela.
- **S-45** O aceite do aviso de emergência do cadastro fica em `Caregiver.emergencyNoticeAcceptedAt`.
- **S-46** "Agora não" em Família não grava nada e mostra uma nota "Tudo bem. Nada foi compartilhado." (sem ela o toque parecia não fazer nada).
- **S-47** `?novo=1` abre direto a folha de novo compromisso (Agenda) ou de novo remédio (Remédios), para os botões de Hoje levarem a um passo só.

## Pedidos ao líder

**Status na integração (`docs/12-cuidador-integracao.md`):** 1 feito (`docs/11`, seção 12); 2 feito (conversas de Ana e de Lourdes no seed); 3 feito (`app-cg-dose` com `size`, ligado em Hoje e Remédios para `digitalLiteracy: 'low'`); 4 segue aberto (conferir em navegador); 5 feito (AC-CG-53 e C4 corrigidos no UX).

1. Incluir no `docs/11-cuidador-arquitetura.md` (seção 12) as linhas da tabela de alterações acima.
2. Seed: o UX (D.1.1) diz que Ana e Lourdes têm conversa marcada com o psicólogo, mas o seed não tem nenhuma `careSession` futura para as pessoas de demonstração; a linha "Para você" de Hoje e da Agenda só aparece em teste. Sugestão: uma sessão `confirmed` futura para Ana e outra para Lourdes em `build-caregiver-app.ts`.
3. `app-cg-dose` (Base): uma entrada de tamanho (ou classe) para o "por pessoa" de João em Remédios (hora em 22 px, **Dei** de 96 px).
4. Conferir em navegador, em 360 px e nas três letras: Hoje sem rolar (AC-CG-41), duas colunas em 1280 px (AC-CG-55), as folhas de Agenda e Remédios com teclado virtual, e os alvos de 48 px.
5. `docs/10-cuidador-ux.md` C4 e AC-CG-53 dizem que **Avaliar** abre a folha de avaliação; pelo acordo entre as áreas ele leva a `/cuidador/rede/pedidos?avaliar=<id>`. Ajustar o AC.

## Fechamento (última rodada, com os três devs trabalhando juntos)

- Suíte inteira: 143 arquivos e 1869 testes; 1868 verdes. A única queda foi `features/network/network.spec.ts` ("cada tela da sócia renderiza..."), que estourou os 5 s do teste por causa da máquina ocupada e **passa sozinha** (30 de 30); não toca nada de P1.
- `pnpm run typecheck`: sem erros. `pnpm exec ng build`: ok.
- `node scripts/check-core.mjs`: nenhum problema em arquivo de P1. Restam problemas só em `*.spec.ts` de outros devs (uma expressão regular de teste com os caracteres de travessão que o próprio script proíbe).
- Não foi subido servidor nem navegador, e não houve commit.
