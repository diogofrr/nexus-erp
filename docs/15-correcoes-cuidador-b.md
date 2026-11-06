# Correções do aplicativo do cuidador, parte B (experiência: telas, textos e kit visual)

Fix B da rodada de CS/CX (`docs/14-cs-cx-cuidador.md`) e de QA (`docs/13-qa-cuidador.md`, QAC-009, 010 e 011). O Fix A (regras, serviços e dados) corre em paralelo e não é tratado aqui. Cada achado diz o que mudou (arquivos), como foi conferido (tela e largura) e o que ficou de fora.

Convenções: `src/app/features/caregiver-app` abreviado como `cg/`; estilos em `src/styles/_caregiver.scss`. Conferência visual feita no navegador embutido em 375 x 812 px (Ana e a pessoa nova; Maria e João só pelos testes), salvo quando dito outro. Cada texto novo foi lido com a pergunta "uma pessoa cansada, com 2 minutos e uma mão ocupada, entende o que fazer?" e confere com RN-ETICA-15: sem travessão, sem "!", sem emoji, sem "alerta", sem diagnóstico.

## Painel

| Grupo | Corrigido | Observação |
|---|---|---|
| P1 (2) | CXC-001 e CXC-002 | os dois |
| P2 (13) | CXC-003 a 015 | os 13 |
| QA (3) | QAC-009, QAC-010 e QAC-011 | os 3 (os testes que eram `it.fails` agora passam como testes normais) |
| P3 (13) | CXC-016 a 026 e 028 (12 de 13) | CXC-027 (paisagem) foi pulado a pedido; do CXC-017 ficou só a parte "um aviso só" (ver a seção) |

## P1

### CXC-001 Linhas com etiqueta larga quebram letra por letra
- **Causa**: no item de lista (`cg-row`) o texto tinha `flex: 1; min-width: 0` e a etiqueta (`[cgRowEnd]`) ficava ao lado, sem poder quebrar; com "Passou do horário (16:00)" ou "Seu canal preferido" o texto sobrava com poucos pixels.
- **Mudança**: `cg/ui/cg-row.component.ts` ganhou um corpo (`cg-row__body`) em `flex-wrap` com o texto em `flex: 1 1 10em` e a etiqueta (`cg-row__extra`) à direita **só se couber**; senão ela desce para baixo do título. A medida em `em` acompanha a letra Normal, Grande e Bem grande. A seta ficou em `cg-row__end`, fora do corpo. Vale para todas as telas que usam o item de lista (Agenda, Falar com a Nexus, Remédios, Grupos).
- **Texto**: na Agenda a etiqueta virou "Já passou" (a hora já está no título da linha).
- **Conferido**: Agenda em 375 px (a linha "16:00 Sessão de fisioterapia" ocupa duas linhas e a etiqueta "Já passou" fica embaixo, sem coluna de letras).

### CXC-002 Humor de Como estou sem rostos e com caixas de 36 px
- **Causa**: o seletor ficava dentro do corpo de um `cg-card` (`display: grid; justify-items: start`), e o contêiner de medida do humor (`container-type: inline-size`) encolhia a zero.
- **Mudança**: `cg/my-wellbeing/pages/my-wellbeing.page.ts` troca o cartão por uma seção com `h2` (o mesmo desenho de Hoje), e `_caregiver.scss` dá `width: 100%` ao `.cg-mood-host` para nunca mais encolher. Os dois lugares continuam usando o **mesmo componente** `app-cg-mood`: letra Normal, fileira de 5 rostos; Grande e Bem grande, lista vertical.
- **Conferido**: Como estou em 375 px (5 rostos, caixas de largura igual).

## P2

### CXC-003 e CXC-004 A nota de cuidado e a faixa
- **Hoje só em horário comercial**: novo `cg/state/care-note.ts` (`teamCallWhen`, `careTodayHeading`): "hoje" de segunda a sexta, 8h às 18h (RN-CAN-03, relógio simulado); depois das 18h, "amanhã de manhã"; sexta à noite e sábado, "na segunda de manhã"; antes das 8h de um dia útil, "hoje de manhã" (ela ainda fala hoje, e dizer "amanhã" seria falso). Corpo da nota: "Você não precisa fazer nada."
- **Maria (contato vencido)**: título "Queremos falar com você." e frase "Se quiser, fale com a gente agora." (some "responsável técnica foi avisada" e "ainda não conseguiu falar com você"). Hoje (`today.page.ts`) e Como estou (`my-wellbeing.page.ts`, `wellbeing-copy.ts`) usam o mesmo módulo. `core/rules/staff-contact.ts` não mudou: o estado `not_yet` continua o mesmo, só o texto da tela mudou.
- **Como estou, a faixa em linguagem comum primeiro**: `cg-trend` ganhou `meaning` ("O cuidado está pesando muito") em destaque; o nome técnico ("Sobrecarga severa") e os pontos viram legenda pequena. Mantidos "Não é um diagnóstico" e a pontuação e a faixa visíveis (RN-ZRT-23). O leitor de tela lê "04/11, o cuidado está pesando muito, sobrecarga severa, 63 pontos".
- **Conferido**: Hoje e Como estou como Ana às 21h ("amanhã de manhã").

### CXC-005 e CXC-008 Hoje e Remédios: o que falta primeiro; Dei e Desfazer
- **O que falta primeiro**: `cg/state/dose-order.ts` (`freezeDoseOrder`) ordena as doses com as que faltam antes das dadas, e **fixa a ordem ao abrir a tela**: marcar "Dei" não move a linha (sem pulo de layout, e o segundo toque de quem dá dois toques nunca cai no "Dei" de outro remédio). Usado em Hoje e em Remédios.
- **Texto neutro e âmbar uma vez**: "Passou do horário (08:00)" virou "Ainda não anotado" (a hora já está no cartão). `firstLateKey` marca só a primeira linha em atraso; as outras usam `quietLate` e ficam neutras.
- **Dei e Desfazer separados**: em `cg-dose` o Desfazer virou um link pequeno **embaixo do texto**, longe do lugar do Dei (o botão à direita some quando a dose é dada). Um toque em Desfazer até 1 s depois do Dei é ignorado (`UNDO_GUARD_MS`, tempo real pelo `Clock.realNowMs()`). O aviso rápido continua com "Desfazer" (8 s).
- **Remédios**: "Todos os remédios" repete a lista de hoje, então fica recolhida atrás de "Mudar ou pausar um remédio (N)"; quando não repete (por exemplo, nenhuma dose hoje), aparece aberta.
- **Conferido**: Hoje como Ana em 375 px (12:00 e 20:00 no alto, dadas embaixo, âmbar só na primeira).

### CXC-015 Cadastro mais curto (Começar)
- **Etapa 4**: a autorização de saúde em duas frases com "Ler mais" (o texto inteiro fica atrás do link); as outras quatro ficam em "Outras autorizações (opcional)", recolhido, com a frase "Se você não abrir esta parte, tudo fica em Decidir depois". Nada vem marcado (RN-LGPD-04 e 05); "Decidir depois" é o resultado de quem não escolhe, como antes.
- **Etapa 5**: uma linha por bloco com "Editar" (sem repetir tudo): Você, Quem você cuida, Seu dia a dia, O que você autoriza ("Saúde: Decidir depois. Outras 4: Decidir depois.").
- **Barra fixa de baixo**: uma linha só (Voltar e Continuar lado a lado, 56 px de botão); o "Rascunho salvo às ..." saiu da barra e ficou acima dela.
- **CPF**: "Serve para identificar a sua conta. No protótipo, use um CPF fictício."
- **Arquivos**: `cg/start/pages/start.page.ts`. ACs 24 a 33 mantidos (atualizados em `docs/10-cuidador-ux.md`).
- **Conferido**: etapas 4 e 5 em 375 px (a etapa 5 caiu de cerca de 2.800 para cerca de 1.300 px de altura da página).

### CXC-006 e CXC-007 Conversa: cancelar, remarcar e confirmar
- **Menos de 24 h**: "Faltam menos de 24 horas. Se cancelar agora, a conversa conta como perdida. Não há cobrança." e o mesmo para remarcar ("a conversa atual conta como perdida"). "Remarcar em vez de cancelar" **sai** quando o efeito é o mesmo (menos de 24 h); com 24 h ou mais continua, porque aí o efeito difere. `cg/care/state/care-labels.ts`, `psychologist.page.ts`.
- **Uma faixa só**: "Pedido enviado. O psicólogo confirma até 24 horas antes da conversa." (RN-ATD-15) com "Ver na agenda" (com espaço); o aviso rápido duplicado sumiu; o cartão "Sua próxima conversa" mostra o dia e a situação "A confirmar".
- **"Não sei"**: a conversa mostra "A definir na conversa" no lugar do caráter. Para isso `core/models/care.ts` ganhou o campo opcional `kindUndecided` (edição fora da minha posse, mínima) e `ConversationsService.book` o grava; a conversa remarcada herda.
- **Texto das opções**: "Acompanhamento regular, com objetivo clínico" virou "Conversas regulares com o mesmo psicólogo, para cuidar do que você sente" (ver CXC-019).

### CXC-013 O botão voltar do aparelho fecha a folha e o passo
- **`cg/state/history-layers.service.ts`** (novo, com `history-layers.spec.ts`): uma entrada de histórico por folha aberta ou passo avançado (mesmo endereço, só um marcador em `history.state`, nada de parâmetro de URL). O voltar do aparelho dispara o `popstate` e desfaz a camada do topo; quando o app fecha a camada (botão Voltar, Esc, fim do fluxo) a entrada é retirada, então o histórico não cresce. Duas camadas que se trocam no mesmo instante reaproveitam a mesma entrada; a entrada só é retirada se ainda for a nossa (o roteador pode ter ido adiante).
- **Folhas**: `cg-sheet` registra e libera sozinho (vale para todas as folhas do app).
- **Passos**: Marcar conversa (formato, horário) e o Começar (cada etapa avançada). O botão "Voltar" dos passos segue o mesmo caminho do voltar do aparelho. Ao concluir (conversa marcada, conta criada) as entradas saem juntas.
- **Conferido**: com toques de verdade no navegador embutido (voltar do aparelho desfaz horário, depois formato, e para no início da tela). Atenção: toques sintéticos de script (`element.click()`) não contam como gesto do usuário e o Chrome pula as entradas que a página empurra sem gesto; por isso o teste manual é com toque.

### CXC-011 e CXC-012 Rede: resultados e comparação
- **Rola até os resultados**: `search.page.ts` leva a tela até a contagem ("5 opções em Fisioterapia.") e põe o foco nela, ao escolher a necessidade (e ao tocar de novo na mesma).
- **Comparar vira uma tabela curta**: colunas = opções, linhas = só o que **muda** (nota, atende em casa, condições); o que é igual vem **uma vez** em "Igual nas duas opções". No celular a tabela vira blocos (cada linha com o nome da opção). "Ver ficha" por opção. No Livre a frase "Condições especiais: a partir do plano Essencial." continua (AC-CG-123), uma vez só.

### CXC-009 e CXC-010 Eliminação e troca de plano
- **Eliminação**: "A equipe responde em até 15 dias." na folha, antes de confirmar; o código "DSR-0006" saiu da tela (lista de pedidos e avisos de pedido repetido). "Faltam 15 dias" agora diz "Faltam 15 dias para a resposta" (CXC-020).
- **Troca de plano em um passo**: o aviso de emergência virou uma linha com a caixa "Li e entendi" **na mesma folha** do efeito (some a segunda folha "Antes de confirmar"). O botão da folha é o da ação ("Mudar para o Cuida").
- **"Seu plano agora" lista tudo** o que o plano inclui, também o que vem dos planos anteriores (`allBenefits`); o quadro dos planos mantém "Tudo do plano anterior, mais:".
- **Como voltar atrás**: "Se mudar de ideia, é só mudar de plano de novo." nas folhas de subir e de descer.

### CXC-014 e CXC-025 Entrada e Hoje
- **Entrada**: o botão "Ajuda agora" está na faixa de marca do alto, como nas outras telas (`features/auth/pages/login.page.ts`, estilo `.login__help`), e "Criar minha conta" vem logo abaixo do título da porta, antes da lista de pessoas de demonstração.
- **Hoje, canal telefone ou WhatsApp (João)**: o cartão "Prefere falar com a gente?" com o número sobe para logo depois da saudação; "No protótipo, a ligação não é feita." saiu do cartão e só aparece ao tocar (a folha "Como falar com a gente" já tem a frase).

## QA

### QAC-009 Níveis de título
- `cg-card` e `cg-plan-lock` ganham `headingLevel` (padrão 2; também 3 e 4 no cartão). Cartões e bloqueios dentro de seção com `h2` usam 3 (Hoje, "Para você"). "Plano X" do quadro de planos virou `h2`; "Suas conversas" e o humor de Como estou viraram seções `h2`. Testes: `ui.spec.ts` (nível por padrão, aninhado e sem salto de nível).

### QAC-010 O navegador não guarda e a pessoa não é avisada
- **Faixa calma no shell** (`cg/shell/caregiver-shell.component.ts`): "O navegador não está guardando o que você faz. Libere espaço ou o armazenamento do site e recarregue." no alto do conteúdo, enquanto durar. Usa a **mesma fonte** do shell da equipe, `StorageService.notices` (cota cheia ou armazenamento bloqueado), pelo novo `StorageStatusService` (`cg/state/storage-status.service.ts`). Não foi preciso sinal novo no núcleo.
- **O "Dei" não aparece como gravado sem estar**: com o navegador sem guardar, o aviso rápido diz "Anotado às 12:05, mas não foi guardado: o navegador está sem espaço. Ao recarregar, esta marca some." (Hoje e Remédios), em vez de só "Anotado".
- **Testes**: o `it.fails` de `caregiver-persistence.qa.spec.ts` virou teste normal e ganhou um segundo (armazenamento bloqueado desde o começo mostra a faixa; normal não mostra).

### QAC-011 O zoom de pinça não esconde a barra inferior
- O shell só esconde a barra quando há **campo de texto com foco** (texto, número, e-mail, área de texto, lista, editável; caixa, opção e botão não contam), a janela visual encolheu abaixo de 75% **e** `visualViewport.scale <= 1`. Reconfere em `focusin` e `focusout` (abrir e fechar o teclado). AC-CG-05 atualizado.
- **Testes**: o `it.fails` virou teste normal; o teste do teclado agora foca um campo (antes escondia a barra sem campo com foco, que era o próprio defeito); novo teste com zoom 2 e campo com foco (a barra fica).

## P3

### CXC-016 Folha "Como falar com a gente"
Só o canal preferido e o telefone ficam à vista; os outros atrás de "Mais jeitos" (`cg-contact-dialog.component.ts`). O e-mail usa letra menor e só quebra onde a lógica manda. O resultado de "Copiar" aparece **junto do botão tocado** e a falha em cor de aviso (`cg-contact__status--warn`, âmbar), no lugar da frase verde no fim da folha.

### CXC-017 Um aviso só
Saíram os avisos rápidos que repetiam uma faixa da tela: conversa marcada, plano mudado e mantido, humor anotado, revisão e horário combinado (Como estou), mensagem enviada, pedido de serviço, cancelar pedido, avaliar, entrar e sair de grupo. Ficam os avisos rápidos onde há "Desfazer" e nenhuma faixa (Dei, Agenda, Remédios) e onde a tela não tem lugar para a faixa (Privacidade, Família, Perfil). Enquanto há aviso rápido na tela o conteúdo ganha folga embaixo (`:has(.toast)`), para dar para rolar o botão que ele cobriria. **Ficou de fora**: mudar a posição do aviso rápido (continua acima da barra, ao alcance do polegar, A.2.x).

### CXC-018 Remarcar um compromisso
Abre só o dia e a hora (`agenda.page.ts`); o nome do compromisso aparece como texto. O resto (tipo, onde, lembrete) não é pedido de novo.

### CXC-019 Jargão
- Grupos: "Para aprender e trocar" (no lugar de "Orientação e psicoeducação"), "Grupo com psicólogo" (no lugar de "Terapia de grupo"), "Psicoterapia em grupo" com a frase "um psicólogo da Nexus conduz o grupo, para cuidar do que você sente" (no lugar de "objetivo clínico"). A distinção entre psicoterapia e orientação continua à vista (RN-GRP-16, RN-ATD-19). `cg/groups/state/group-copy.ts`.
- Conversar: "Conversas regulares com o mesmo psicólogo, para cuidar do que você sente" no lugar de "Acompanhamento regular, com objetivo clínico".
- Privacidade e cadastro: "ajuda com o cansaço" no lugar de "escala de cansaço do cuidador"; "Resultados sem o seu nome" no lugar de "Números somados da Nexus" (lista, cadastro e efeito de retirar). O texto compartilhado `shared/ui/forms/consent-copy.ts` **não foi mexido** (é da equipe também): o aplicativo do cuidador sobrepõe as frases em `privacy-copy.ts` (`consentCopy`).
- Como estou: "Suas conversas com a equipe" (no lugar de "conversas de acompanhamento") e "Se você não concorda com algo que a equipe decidiu a partir dos seus resultados" (no lugar de "decisão tomada com base nos seus resultados").
- "Registro: CREFITO-MG ... (fictício)" **já só aparece na ficha do profissional** (`provider.page.ts`); nenhuma outra tela o mostra hoje.
- **Ficou de fora**: o título de atividade "Luto ambíguo, em grupo" vem do dado de demonstração (`core/seed/build-ops.ts`), que é do Fix A e da equipe.

### CXC-020 Pequenas inconsistências de texto
"Leitura de N minutos" em Hoje usa o mesmo tempo real de Conteúdos (`readingTimeLabel`); a etiqueta "Para você" saiu do cartão de Hoje (ficou a da Agenda); "Precisa de ajuda com o app ou com a sua conta?" virou "Quer falar com a gente?" com "Como falar com a gente"; "Faltam 15 dias" virou "Faltam 15 dias para a resposta"; o assunto da mensagem à equipe diz "(opcional)".

### CXC-021 Grupos
"Plano Cuida" na própria linha de quem não tem acesso (cadeado, sem preço e sem pressão), a roda aberta primeiro, e o que a pessoa já faz fica só em "Minhas inscrições" (a programação vira "Outros grupos").

### CXC-022 Letra Bem grande
A **entrada** (`login.page.ts`) respeita a letra Grande e Bem grande (variável `--cg-door-zoom`). A palavra NEXUS **não some**: em tela estreita com letra Grande ou Bem grande o símbolo dá lugar à palavra; sem sessão (com o link Entrar) fica só o símbolo.

### CXC-023 Pequenos tropeços no cadastro
Cabeçalho: marca menor e sem encostar na Ajuda agora (375 px; conferido). O aviso de protótipo aparece uma vez (`.cg-main:has(.banner--prototype) .cg-proto-note { display: none }`). O campo do WhatsApp rola até a vista ao escolher o canal. O resumo de erros ficou curto (`app-error-summary short`, mudança aditiva no componente do design system): "Há 5 pontos para corrigir. Eles estão marcados abaixo, junto de cada campo." sem repetir a lista; com um ponto só a caixa não aparece e o foco vai ao campo. "Tudo bem." saiu depois de "Decidir depois".

### CXC-024 Meu perfil
CPF recolhido (botão "Mostrar", com `aria-expanded`); o rótulo das horas fica **em cima** da linha "menos, número, mais" (cadastro e perfil); erro de um campo só não vira caixa grande. Os botões "Editar" já tinham o contexto para leitor de tela ("Editar os seus dados", "Editar quem você cuida", "Editar o seu dia a dia"): não mudou.

### CXC-026 Cartão
As 3 últimas compras e o total, com "Ver todas (N)" / "Ver menos".

### CXC-028 Hoje e o humor pausado
Uma linha em Hoje ("O humor do dia está pausado, porque você retirou a autorização de saúde." com "Ver em Como estou") só para quem **retirou** a autorização; quem nunca respondeu não vê a linha.

## Não corrigido, e por quê
- **CXC-027** (paisagem): pedido para pular.
- **Posição do aviso rápido** (CXC-017): mantida; só foi tirada a repetição.
- **Título de atividade "Luto ambíguo, em grupo"** (CXC-019): dado do seed, do Fix A e da equipe.
- Itens da tabela de carga de informação do CS/CX que **não estavam na lista numerada**: mostrar só 3 horários e "Ver mais" em Conversar, mover "o resto" de Como estou para "Saber mais", preço e desconto em uma linha na confirmação da conversa, CPF e cidade "para depois" na etapa 1 do cadastro, "Dei em outro horário" em cada dose dada.
- A letra Grande e Bem grande foi conferida em 375 px, não em 360 px.

## Edições fora da minha posse (mínimas)
- `core/models/care.ts`: campo opcional `kindUndecided` em `CareSession` (CXC-007, "A definir na conversa"); gravado por `ConversationsService.book` e herdado ao remarcar. Nada no núcleo lê o campo.
- `shared/ui/forms/error-summary.component.ts`: entrada opcional `short` (padrão desligado; as telas da equipe não mudam).
- `shared/ui/display/empty-state.component.ts`: entrada opcional `headingLevel` (padrão 3; QAC-009).
- `features/auth/pages/login.page.ts` (entrada, CXC-014 e CXC-022) e `src/styles/_caregiver.scss`.
- `cg/privacy/state/privacy.service.ts` (só a frase "Pedido feito em ..."), `cg/care/state/conversations.service.ts` (o campo acima e o caráter exibido) e os textos de `cg/care/state/care-labels.ts`. O Fix A mexe nos mesmos arquivos: usei `Edit` com trechos exatos e a suíte inteira passa com as duas partes juntas.
- Testes de QA virados de `it.fails` para teste normal: QAC-009 (`caregiver-sweep.qa.spec.ts`), QAC-010 (`caregiver-persistence.qa.spec.ts`) e QAC-011 (`caregiver-ui.qa.spec.ts`); textos novos em `caregiver-regression.qa.spec.ts` e `caregiver-ui.qa.spec.ts` (nota de cuidado, "Faltam N dias para a resposta").

## Números
- Suíte inteira: **156 arquivos, 2.120 testes, todos passando** (conta junto os testes novos do Fix A). Testes novos meus: `history-layers.spec.ts` (9), `care-note.spec.ts` (5) e cerca de 30 casos novos ou reescritos em `ui`, `today`, `care`, `start`, `network`, `plan`, `privacy`, `groups`, `routine`, `card` e nos QA.
- `pnpm run typecheck` (app e specs), `node scripts/check-core.mjs` (inclui a regra do travessão em texto) e `pnpm run check:a11y` (contraste e alvos de 48 px): ok. `pnpm exec ng build`: ok, sem aviso.
- Conferência no navegador embutido em 375 x 812 px (Ana, a pessoa nova) e uma passada em tela larga e na letra Bem grande: Hoje, Remédios, Agenda, Como estou, Começar (etapas 4 e 5), Entrada, "Como falar com a gente" e o voltar do aparelho com toques de verdade.

## Como conferir à mão o voltar do aparelho
Toques sintéticos de script (`element.click()`) não contam como gesto do usuário, e o Chrome pula as entradas de histórico que a página empurra sem gesto; por isso a conferência é com toque de verdade: abrir Conversar com um psicólogo, tocar em Marcar uma conversa, escolher o formato, e usar o voltar do aparelho duas vezes (volta ao formato e depois ao começo da tela, sem sair dela).
