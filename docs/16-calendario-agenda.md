# Agenda em calendário (aplicativo do cuidador)

Status: PRONTO no código e nos testes; **o visual não foi conferido em navegador** (a rodada não tinha navegador). A lista de conferência da próxima onda está na seção "Para conferir no navegador".

Pedido do dono, ao ver o aplicativo publicado: "agenda em lista (deveria ser em formato de calendário pra facilitar pro usuário)". A Agenda (`/cuidador/rotina/agenda`, tela 5 do UX) passa a ser um **calendário do mês com o detalhe do dia**, sem perder nenhuma função que a lista já tinha. A lista antiga continua, atrás de um alternador **Calendário | Lista**. O texto novo da tela está em `docs/10-cuidador-ux.md` (C5, A.2.25, B3 e S-CAL-01 a 08) e o status dos critérios em `docs/ac-status/caregiver-p1.md`.

## O que foi feito

| Peça | Onde | Observação |
|---|---|---|
| Regras puras da grade do mês | `src/app/core/rules/calendar-grid.ts` (+ `calendar-grid.spec.ts`) | Semana de domingo a sábado, 5 ou 6 linhas, dias vizinhos esmaecidos, `isToday`, nomes de mês e de dia em pt-BR, mês anterior e seguinte (janeiro e dezembro), teclado, marcas de cada dia |
| Calendário do kit | `features/caregiver-app/ui/cg-calendar.component.ts` (+ `cg-calendar.spec.ts`), exportado por `ui/index.ts` | `app-cg-calendar`: standalone, OnPush, signals; o CSS está no próprio componente (nenhuma linha nova em `_caregiver.scss`) |
| A tela da Agenda | `routine/pages/agenda.page.ts` | Calendário + cartão do dia (lado a lado de 1024 px em diante) e a Lista antiga atrás do alternador; todas as funções de antes |
| Linha da Agenda | `routine/components/agenda-entry.component.ts`, `routine/state/agenda-entry.ts` | A mesma linha (hora, título, apoio, "Já passou", "Para você") no cartão do dia e na lista |
| Título do dia | `routine/state/agenda-format.ts` (`dayCardHeading`) | "Hoje, 4 de novembro", "Amanhã, 5 de novembro", "Sexta, 6 de novembro" |
| Escolha Calendário ou Lista | `routine/state/agenda-view.service.ts` | Guarda no navegador pelo `StorageService`, chave `nexus-erp:caregiver-agenda-view` (`STORAGE_KEYS.caregiverAgendaView`); valor desconhecido cai no calendário |
| Pares de contraste | `scripts/check-caregiver-a11y.mjs` | As cinco marcas (3:1, também sobre o dia escolhido) e o número do dia de outro mês, de hoje e do dia escolhido (4,5:1) |

Arquivos de outras posses que receberam **uma linha** cada, por necessidade: `core/storage/storage.service.ts` (a chave nova), `layout/pages/browser-data.page.ts` (o nome da chave em "Meus dados no navegador"), `docs/11-cuidador-arquitetura.md` (uma linha na tabela do kit). Nenhuma linha nova em `_caregiver.scss`, e nada da Entrada, do shell nem do aviso rápido.

## Funções mantidas (todas testadas em `routine.spec.ts`)

Adicionar (agora com o dia já preenchido pelo cartão do dia), editar e **remarcar só o dia e a hora** (CXC-018), **tirar da agenda com Desfazer** (a folha com o efeito e o foco em Voltar), **"Já passou"** em compromisso de hoje (CXC-001), **Lembrar de mim** (no cadastro e no detalhe, sem confirmação), compromissos da pessoa idosa e a **conversa do próprio cuidador** ("Para você", só leitura, com link para `/cuidador/cuidar-de-mim/atendimento`), limites de texto e erros humanos (QAC-015), foco e título da página, `?novo=1` (vindo de Hoje), estados vazios (no calendário, "Nada marcado para este dia"; na Lista, "Nenhum compromisso por aqui"), aviso de sem conexão, pedido de dia e hora válidos, "Ver anteriores" e "Ver mais datas" (na Lista). Nada de regra duplicada: a tela continua usando `AgendaService` e `core/rules/care-agenda.ts`.

Quando uma ação muda o dia (adicionar em outro dia ou mês, remarcar, desfazer), **o calendário acompanha**: o dia escolhido muda e a grade vai ao mês dele.

## Decisões

1. **Semana começa no domingo** (calendário brasileiro). A grade tem **5 ou 6 linhas**: um mês que cabe em 4 (fevereiro de 2026) ganha a quinta, para a tela não pular de altura.
2. **Mês em `YearMonth`** (`YYYY-MM`) e dia em `ISODate`; "hoje" entra por argumento (o componente lê `Clock.today()`, nunca `new Date()`). O calendário não anda além dos anos 1900 e 2200 (segurar PageDown nunca leva a uma data que não existe).
3. **Marca por tipo, com cor e forma** (nunca só a cor), com o nome do tipo no rótulo de leitor de tela e na legenda:

   | Tipo | Marca | Cor (token) |
   |---|---|---|
   | Consulta | círculo cheio | `--cg-action` |
   | Fisioterapia | quadrado cheio | `--cg-ok-icon` |
   | Psicologia (da pessoa idosa) | losango cheio | `--cg-soft-icon` |
   | Para você (a conversa do próprio cuidador) | triângulo cheio | `--nx-gold-700` |
   | Outro | círculo vazio | `--cg-border-control` |

   Nenhum vermelho nem âmbar (reservados a erro e a "Já passou"). O pedido listava quatro tipos; ficaram cinco porque a Psicologia da pessoa idosa (um dos 4 tipos do formulário) e a conversa do próprio cuidador ("Para você") são coisas diferentes para quem cuida.
4. **Contagem**: até 3 compromissos, uma marca por compromisso; de 4 em diante, **duas marcas e "+N"** (N = o que falta mostrar), para a célula de 44 px nunca transbordar. O rótulo do botão diz o total.
5. **Legenda** só aparece se há marca à vista, e só com os tipos que aparecem na grade.
6. **Hoje** é o número num círculo cheio; **o dia escolhido** é uma caixa de borda grossa com fundo suave; dia com compromisso tem o número em negrito.
7. **Dia de outro mês** (esmaecido) também é um botão; escolhê-lo leva a grade ao mês dele. **Mês anterior** e **Próximo mês** não mudam o dia escolhido (o cartão do dia continua dizendo qual é); **Hoje** volta ao mês de hoje e escolhe hoje.
8. **Rótulo de cada dia**: "6 de novembro, sexta-feira, hoje, 2 compromissos: Consulta e Fisioterapia". Dia sem compromisso diz só a data (menos ruído para leitor de tela).
9. A grade usa `role="grid"` com `role="row"`, `columnheader` e `gridcell`; o `aria-selected` fica no `gridcell` e o `aria-current="date"` no botão de hoje; o título do mês é `aria-live="polite"`. Teclado: setas (dia e semana), Home e End (domingo e sábado da semana), PageUp e PageDown (mês), Enter e Espaço escolhem; só um dia entra na ordem do Tab (o último alcançado, o escolhido, hoje ou o dia 1).
10. **Dia que já passou só se lê**: sem botão de adicionar (o formulário recusaria o dia) e sem tocar nos compromissos (a Lista antiga já era assim).
11. **Cabeçalho do calendário**: duas linhas (o mês em cima; Mês anterior, Próximo mês e Hoje embaixo) em largura menor que 28 rem; uma linha de 28 rem em diante (container query). O CSS do calendário não depende da largura da janela, só do espaço que a tela dá a ele.
12. **Em 768 px** o calendário e o cartão do dia ficam numa coluna de 40 rem (640 px) para as células não ficarem largas demais; de **1024 px em diante** ficam lado a lado (calendário de 28 rem à esquerda, o dia à direita).

## Testes e verificações (rodadas sem navegador)

- Suíte inteira: **158 arquivos e 2209 testes, todos verdes** (eram 2120; o outro agente também mexeu na suíte). Novos: `calendar-grid.spec.ts` (25: meses de 28, 29, 30 e 31 dias, mês que começa no domingo e no sábado, virada de ano, hoje, 24 meses para frente e para trás, limites, teclado, marcas), `cg-calendar.spec.ts` (31: grade, rótulos, marcas, legenda, escolher o dia, trocar de mês, Hoje, teclado, foco) e `routine.spec.ts` (a Agenda reescrita: calendário, lista, alternador e guardado, dia vazio e dia passado, adicionar com o dia preenchido, calendário acompanha o dia e o mês, remarcar e desfazer, tirar e desfazer, conversa "Para você").
- `pnpm run typecheck` sem erros; `node scripts/check-core.mjs` ok; `pnpm run check:a11y` ok (126 conferências, com as marcas do calendário a 4,2:1 ou mais sobre o dia escolhido e 4,6:1 ou mais sobre o cartão); `pnpm exec ng build` ok, sem aviso de orçamento de estilo.

## Para conferir no navegador (próxima onda)

Nada disto pôde ser visto sem navegador. Conferir em **360, 768 e 1280 px** e nas letras **Normal, Grande e Bem grande**:

1. **360 px**: a célula do dia tem 44 px de largura ou mais (a coluna dividida por 7 dá 46 px) e 48 de altura; as 5 ou 6 linhas cabem sem rolagem horizontal; o cabeçalho em duas linhas ficou equilibrado; "+N" cabe ao lado de duas marcas; a legenda quebra bem.
2. **O cartão do dia no celular**: ele fica embaixo do calendário e, em telas baixas, **abaixo da dobra**. Ver se uma pessoa que toca num dia percebe a mudança (o título "Sexta, 6 de novembro" é `aria-live`, mas quem não rola não o vê). Se incomodar, as saídas são: linhas de 44 px, ou levar a tela ao cartão ao tocar no dia (só em telas estreitas, respeitando `prefers-reduced-motion`).
3. **768 px**: coluna de 640 px com o calendário e o cartão; células de 56 px de altura.
4. **1280 px**: calendário de 28 rem à esquerda e o dia à direita, topos alinhados; o cabeçalho do calendário em uma linha só.
5. **Bem grande**: o número em círculo cabe na célula; o título do mês quebra sem cortar; Hoje e as setas continuam com 48 px; a marca "+N" não transborda.
6. **Foco e hover**: o anel de foco de 3 px cabe dentro da célula (recuo negativo) e não é cortado; o hover não apaga o dia esmaecido.
7. **Teclado e leitor de tela de verdade**: Tab entra na grade em um dia só; setas, Home, End, PageUp e PageDown; Enter e Espaço; o rótulo do dia e o anúncio do mês ao trocar. A grade é `role="grid"`, então leitores de tela passam para o modo de foco nela.
8. **Movimento e contraste**: `prefers-reduced-motion` (sem transição nenhuma) e o modo de alto contraste do Windows (as marcas mantêm as cores e hoje ganha contorno).
9. As cores das cinco marcas lado a lado, com a legenda, para ver se a forma e a cor se distinguem a olho nu (principalmente o losango "Psicologia" e o triângulo "Para você").
10. O alternador **Calendário | Lista**: tamanho, o estado marcado (preenchimento e "check") e se a Lista antiga continua boa.

## Pedidos ao líder

- `features/caregiver-app/ui/kit/` (catálogo de desenvolvimento, `/cuidador/_kit`, da Base) não mostra o calendário ainda; é só acrescentar `<app-cg-calendar [events]="..." />`.
- Os arquivos de outras posses que tiveram uma linha (seção "O que foi feito") ficam para o líder revisar na hora de commitar.
- Não houve `git commit` nem `git push`.
