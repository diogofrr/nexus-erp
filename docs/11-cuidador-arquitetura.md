# Aplicativo do cuidador: arquitetura e contrato da Base (Dev F)

Status: PRONTO (Base) e integrado (ver `docs/12-cuidador-integracao.md`). A Base entregou sessão e guards, entrada, rotas e esqueletos das 13 áreas, contexto do cuidador, coleção `doseChecks`, seed das pessoas de demonstração, shell, kit visual (Parte A do UX), SCSS e testes. Pendências e pedidos ao líder estão na seção 14.

Contrato para os devs de página (P1, P2, P3). Complementa `docs/10-cuidador-contexto.md` (decisões e regras), `docs/10-cuidador-ux.md` (UX e UI: o que cada tela mostra), `docs/08-arquitetura.md` (núcleo) e `docs/09-guia-dev-modulos.md` (regras de trabalho). Onde este documento e o UX divergem sobre estrutura de código, vale este; sobre texto e visual da tela, vale o UX.

## 1. Quem é dono de quê

| Dono | Pasta ou arquivo | Observação |
|---|---|---|
| Base (Dev F) | `features/caregiver-app/{shell,state,ui,routing}`, `features/caregiver-app/testing.ts`, `core/auth` (sessão do cuidador), `features/auth` (a entrada), `app.routes.ts`, `src/styles/_caregiver.scss`, `doseChecks` e as regras de plano, de doses e de contato no `core`, seed das pessoas de demonstração | Inclui a porta de **Mais** (`shell/pages/more-hub.page.ts`) e a página "não encontrado" do aplicativo |
| P1 | `start`, `today`, `routine`, `family` | `start` tem o Começar (`/cuidador/comecar`) e o **Meu perfil** (`/cuidador/mais/perfil`) |
| P2 | `care`, `my-wellbeing`, `help`, `privacy` | `care` tem a **porta de Cuidar de mim** (`/cuidador/cuidar-de-mim`, rota `''` da área) e o atendimento (`/atendimento`). `help` tem Falar com a Nexus e Ajuda agora |
| P3 | `network`, `card`, `plan`, `groups`, `content` | `network` tem a **porta de Rede** (`/cuidador/rede`, rota `''` da área), Buscar, Profissional e Meus pedidos |

Decisão do líder (P-02): Entrada e porta de Mais com a Base; Cuidar de mim com P2; Rede com P3; Meu perfil com P1. Cada dev altera só a própria pasta. Mudança em arquivo de outra posse (por exemplo uma rota nova em `caregiver-areas.ts`) vira pedido ao líder.

## 2. Mapa de pastas

```
src/app/features/caregiver-app/
  testing.ts                 bootCaregiverApp (só para specs)
  routing/                   caregiver-areas.ts (mapa), caregiver.routes.ts (rotas de /cuidador; `createCaregiverRoutes(devMode)`)
  shell/                     caregiver-shell.component.ts, menu do usuário, sair, pages/ (porta de Mais, não encontrado)
  state/                     caregiver-context.service.ts, font-scale.service.ts, contact-dialog.service.ts,
                             nexus-contact.ts, day-format.ts, demo-caregivers.ts, people-format.ts, format-labels.ts,
                             copy-feedback.ts, online-status.service.ts
  ui/                        kit visual (cg-*.component.ts), index.ts, kit/ (catálogo de desenvolvimento)
  start/ today/ routine/ family/ care/ my-wellbeing/ help/ privacy/ network/ card/ plan/ groups/ content/
    <area>.routes.ts         exporta ROUTES (e, em start e help, uma segunda constante)
    <area>.spec.ts           fumaça da área (cada rota abre, título e h1)
    pages/ state/            criados por quem preenche a área
```

## 3. Rotas e carregamento sob demanda

`app.routes.ts` tem `cuidador` (guard `caregiverAreaGuard`, `loadChildren` de `routing/caregiver.routes.ts`). Dentro dele, o shell do cuidador envolve tudo. As áreas `comecar` e `ajuda-agora` são **abertas** (não exigem sessão, para "Criar minha conta" e "Ajuda agora" funcionarem sem entrar); o resto passa por `caregiverGuard` (com `runGuardsAndResolvers: 'always'`, então um cadastro encerrado no meio do uso volta à entrada na próxima tela). Endereço desconhecido dentro de `/cuidador/**` mostra "Página não encontrada" no mesmo shell.

Mapa área para rota base (fonte: `routing/caregiver-areas.ts`; o teste `routing.spec.ts` guarda esta tabela):

| Área | Exporta | Montada em (sob `/cuidador`) | Rotas do arquivo (relativas) | Acesso |
|---|---|---|---|---|
| `start` | `ROUTES` | `comecar` | `''` Começar | aberta |
| `start` | `PROFILE_ROUTES` | `mais/perfil` | `''` Meu perfil | sessão |
| `today` | `ROUTES` | `hoje` | `''` Hoje | sessão |
| `routine` | `ROUTES` | `rotina` | `''` (vai a `agenda`), `agenda`, `remedios` | sessão |
| `family` | `ROUTES` | `mais/familia` | `''` Família | sessão |
| `care` | `ROUTES` | `cuidar-de-mim` | `''` Cuidar de mim (a porta), `atendimento` | sessão |
| `my-wellbeing` | `ROUTES` | `cuidar-de-mim/como-estou` | `''` Como estou | sessão |
| `groups` | `ROUTES` | `cuidar-de-mim/grupos` | `''` Grupos e capacitações | sessão |
| `content` | `ROUTES` | `cuidar-de-mim/conteudos` | `''` Conteúdos | sessão |
| `network` | `ROUTES` | `rede` | `''` Rede (a porta), `buscar`, `profissional/:id`, `pedidos` | sessão |
| `card` | `ROUTES` | `rede/cartao` | `''` Cartão Nexus | sessão |
| `plan` | `ROUTES` | `mais/plano` | `''` Meu plano | sessão |
| `help` | `ROUTES` | `mais/ajuda` | `''` Falar com a Nexus | sessão |
| `help` | `HELP_NOW_ROUTES` | `ajuda-agora` | `''` Ajuda agora | aberta |
| `privacy` | `ROUTES` | `mais/privacidade` | `''` Privacidade e meus dados | sessão |

Não está na tabela porque é da Base: `/cuidador` (vai a `hoje`), `/cuidador/mais` (porta de Mais) e `/cuidador/_kit` (catálogo do kit, só em desenvolvimento).

Como preencher uma área:

1. Abra `<area>/<area>.routes.ts`. Cada rota tem `data: { title }` e a tela de verdade (`loadComponent: () => import('./pages/...')` ou `component`), **mantendo `data.title`** (vira o título da aba, `Título · Nexus ERP`).
2. Acrescente sub-rotas da área no mesmo arquivo. Detalhe de grupo e de conteúdo **não** têm rota filha: abrem em folha de tela cheia com parâmetro na URL (`?atividade=`, `?conteudo=`), decisão P-04.
3. Toda tela tem um `h1` (use `<app-cg-page-header>`): o shell leva o foco a ele a cada tela e o teste de fumaça confere.
4. Atualize o `<area>.spec.ts` (a tabela `cases` e os testes da tela). O "Em construção" (placeholder) já foi removido: as 13 áreas estão prontas.
5. Nunca importe de outra área. O que for comum vai para `state/` (Base) ou `core/` (pedido ao líder).

## 4. Sessão e guards

- `CaregiverSessionService` (`core/auth`): `signIn(caregiverId)` devolve `{ status: 'ok', caregiver }` ou `{ status: 'denied', reason }`; `signOut()`; signals `caregiverId`, `caregiver`, `isSignedIn`, `justSignedOut`. Guarda `{ caregiverId, startedAt }` no armazenamento de sessão, chave `nexus-erp:caregiver-session`, pelo `StorageService`. Recusa cadastro inexistente, `closed`, `anonymizedAt` e `erasedAt` (`caregiverAccessBlock`); `closure_requested` e `paused_by_consent_revocation` entram. Se o cadastro ficar inelegível depois de entrar, `isSignedIn()` vira falso.
- Uma sessão por vez: `signIn` encerra a sessão da equipe (com o log de troca de perfil) e `AuthService.selectProfile` encerra a do cuidador. Entrar e sair como cuidador **não** grava no log de auditoria.
- Guards (`core/auth/guards.ts`): `caregiverGuard` (exige sessão; equipe com sessão volta a `/app/painel`; sem sessão vai a `/login` guardando a rota em memória), `caregiverAreaGuard` (a equipe nunca entra em `/cuidador/**`), `homeRedirectGuard` (a raiz `/`: cuidador a Hoje, equipe ao painel, quem não entrou a `/login`). `guestGuard` e os guards da equipe (`authGuard`, `moduleGuard`, `permissionGuard`, `roleGuard`) passaram a mandar a sessão de cuidador para `/cuidador/hoje`, sem passar pela entrada e sem gravar `denied`.
- Não há expiração por inatividade para o cuidador (suposição de protótipo): a sessão fecha com a aba.

## 5. Entrada (`/login`)

`features/auth/pages/login.page.ts`. Duas portas: **Sou cuidador(a)** (aberta e em destaque: 6 pessoas de demonstração, "Ver mais exemplos" com mais 5, "Criar minha conta", aviso de 192 e "Ajuda agora") e **Sou da equipe Nexus** (recolhida; abre sozinha quando a pessoa vem de uma sessão da equipe, de erro de código ou de um link `/app/**`). Nome e idade vêm do cadastro, o plano da assinatura, a **frase** de `features/caregiver-app/state/demo-caregivers.ts` (neutra: sem pontuação, alerta ou dado de saúde). Cadastro `closed`, anonimizado ou eliminado não aparece. As 11 pessoas, na ordem: Ana `cg_0001`, Maria `cg_0002`, João `cg_0003`, Rita `cg_0008`, Elza `cg_0027`, Lourdes `cg_0024` (6 de cara) e Terezinha `cg_0012`, Marcos `cg_0026`, Sônia `cg_0016`, Marlene `cg_0004`, Raimunda `cg_0018` (a 11ª, com pedido de exclusão aberto). Depois de sair, a entrada diz "Você saiu. Até a próxima.". O painel de marca vira uma faixa baixa abaixo de 1024 px para a porta do cuidador aparecer sem rolar muito.

## 6. Contexto do cuidador (`CaregiverContextService`)

`features/caregiver-app/state/caregiver-context.service.ts`, `providedIn: 'root'`. Porta única das telas para o que é "meu". Nada de ler a sessão, procurar o cuidador no banco nem usar `new Date()`.

```ts
const ctx = inject(CaregiverContextService);
ctx.isSignedIn();            // boolean
ctx.caregiver();             // Caregiver | null (null só fora de sessão: cadastro e Ajuda agora)
ctx.caregiverId();           // 'cg_0001'
ctx.firstName();             // 'Ana'
ctx.preferredChannel();      // 'app' | 'whatsapp' | 'phone' | 'email'
ctx.elder();                 // Elder | null (a pessoa idosa); ctx.elderId()
ctx.subscription();          // Subscription | null (vigente)
ctx.planId();                // 'livre' | 'essencial' | 'cuida' | 'sustenta' (sem assinatura: 'livre')
ctx.plan();                  // Plan | null; ctx.plans() é o quadro (editável em M15)
ctx.planName();              // 'Cuida'
ctx.scheduledChange();       // { kind, from, to, at, label } | null (troca ou cancelamento pedido e ainda não valendo)
ctx.consents();              // os 6 consentimentos na ordem canônica
ctx.consentStatus('family_sharing');   // 'granted' | 'refused' | 'revoked' | 'pending'
ctx.hasConsent('health_data');         // vigente?  ctx.healthConsent() é o atalho do de saúde
ctx.staffContact();          // 'none' | 'today' | 'not_yet'  (ver abaixo)
ctx.canUse('groups');        // acesso por plano
ctx.lowDigitalLiteracy();    // pouca familiaridade digital?  ctx.doseSize() → 'default' | 'large'
ctx.access('card');          // { allowed, minPlan, reason? }
ctx.fontScale(); ctx.setFontScale('large');
ctx.today();                 // '2026-11-04', do Clock (reativo ao relógio simulado)
ctx.requireCaregiverId();    // lança se não há sessão (use em ação que só existe com sessão)
```

**Contato da equipe (P-03).** `ctx.staffContact()` devolve só três valores e nenhuma pontuação, faixa ou nível: `today` ("A equipe de psicologia vai falar com você hoje."), `not_yet` ("A equipe ainda não conseguiu falar com você.") e `none`. Vem de `core/rules/staff-contact.ts` (RN-ZRT-13, 14 e 19), em cima de `redAlertState`: alerta **vermelho** aberto sem contato e dentro do prazo (23h59 do dia) vale `today`, depois do prazo vale `not_yet`, amarelo ou contato feito ou encerrado vale `none`; sem consentimento de saúde vale sempre `none`. Hoje (P1) e Como estou (P2) usam só isto: nenhuma tela do cuidador lê `zaritAlerts` nem `zaritAssessments` para decidir a nota de cuidado.

**Acesso por plano.** `canUse(feature)` e `access(feature)` usam `core/rules/plan-features.ts`, que usa `plans.ts` (a fonte dos benefícios). A tela nunca decide plano por conta própria. Recursos (`CaregiverFeature`):

| Recurso | Libera a partir de | RN |
|---|---|---|
| `organization`, `agenda_reminders`, `content`, `network_search` | Livre | RN-PLN-01 |
| `request_service` (pedir serviço pela rede) | Livre (todos os planos) | RN-REDE-25 e 26 e decisão do líder sobre S-09 |
| `psych_scheduling` (marcar conversa com psicólogo) | Livre (todos os planos; só as condições mudam) | RN-ATD-03 a 05 |
| `extended_organization`, `exclusive_content`, `network_conditions`, `card` | Essencial | RN-PLN-02, 08, RN-CRT-02 |
| `organization_support`, `groups` (grupos de apoio e capacitações) | Cuida | RN-PLN-10, RN-GRP-02 |
| `close_follow_up`, `network_benefits` | Sustenta | RN-PLN-01 a 08 |

Rodas abertas valem para todos: para atividade use `canAccessActivity(plan, kind)` de `core/rules/plans.ts`. As frases de bloqueio só falam do plano (RN-PLN-19; o teste confere que nenhuma menciona Zarit, alerta, ARBE ou risco). Use `<app-cg-plan-lock feature="groups" description="...">` no template: ele só desenha quando o plano não libera.

**Outras funções de apoio** (puras, em `state/`): `day-format.ts` (`relativeDay`, `relativeDateTime`, `formatDayShort`, `formatDayLong`, `dayMonth`: "hoje", "amanhã", "ontem", "sex, 06/11") e `nexus-contact.ts` (`contactChannels`, `isWithinBusinessHours`, `phoneClosedNote`: canais e prazos de RN-CAN-02 e 03).

## 7. Dados: `doseChecks` e doses do dia

- Coleção `doseChecks` (`DoseCheck`: `medicationId`, `date`, `time`, `givenAt`; prefixo `dose`; `db.doseChecks`). Só existe a marcação do que foi dado: "Desfazer" apaga a linha. A exportação, a importação e o reset já a incluem; um arquivo de exportação antigo, sem ela, ainda importa (`OPTIONAL_ON_IMPORT`); não foi preciso subir `SCHEMA_VERSION` porque nenhum formato existente mudou. A eliminação do titular apaga as marcações da pessoa idosa e as lista em "será eliminado".
- `core/rules/medication-doses.ts` (puras, RN-USR-07): `dosesForDate(date, medications, checks)` devolve `DoseSlot[]` (um por horário de cada remédio **ativo**, em ordem de horário) e `doseProgress(slots)` devolve `{ given, total, complete }`.
- `DoseCheckService` (`core/care`): `forElder(elderId, date)`, `mark(medicationId, date, time)` (idempotente; recusa horário que o remédio não tem, remédio inativo e dia que ainda não chegou), `unmark(...)`, `isGiven(...)`. Erro vem como `DoseCheckError` com frase pronta.

```ts
const doses = inject(DoseCheckService);
const slots = computed(() => doses.forElder(ctx.elderId() ?? '', ctx.today()));   // reativo
doses.mark(slot.medicationId, slot.date, slot.time);                              // "dei"
```

Remédio nunca é apagado (S-32 do UX): "em uso" é `active`.

## 8. Shell (`CaregiverShellComponent`)

Cabeçalho (marca, **Ajuda agora** sempre visível, menu do usuário com Meu perfil, Privacidade e Sair), conteúdo na coluna central (720 px no celular e no tablet, 960 px em tela larga), aviso de protótipo no fim do conteúdo e, abaixo de 1024 px, a barra inferior de 5 itens (de 1024 px em diante a navegação vai para o cabeçalho; só uma das duas existe no DOM, decidida por `ViewportService`). Link "Ir para o conteúdo", título da aba por `data.title` e foco no `h1` a cada tela (o `PageChromeService` da raiz, o mesmo da equipe).

- A raiz é `<app-caregiver-shell class="cg-app" data-text="normal | large | xlarge">`. O tamanho da letra (Normal, Grande, Bem grande) vale na hora e fica no navegador (`FontScaleService`, chave `nexus-erp:caregiver-font-scale`); troca de letra em `<app-cg-text-size>`.
- Só tema claro (S-01): o shell força `data-theme="light"` no `<html>` e marca `data-app="caregiver"`; ao sair devolve o que havia. O gancho `data-app` faz o toast subir acima da barra e a confirmação do `DialogService` virar folha de baixo no celular. O banner "Antes de começar" da equipe fica escondido no aplicativo do cuidador (o aviso de protótipo já está no fim de toda tela).
- Sem sessão (cadastro de quem é novo e Ajuda agora) não há barra nem menu: só a marca, a Ajuda agora e "Entrar".
- Teclado virtual aberto: a barra inferior some (`visualViewport`).
- O `ContactDialogService.open()` abre o "Como falar com a gente" de qualquer tela; o shell monta uma só instância.
- Portas: **Mais** é da Base. **Cuidar de mim** é de P2 (rota `''` de `care`) e **Rede** é de P3 (rota `''` de `network`); ambas já existem (P2 e P3).

## 9. Kit visual (`features/caregiver-app/ui`, importe de `'../ui'`)

Tudo standalone, OnPush, signals, sem estilo inline (o CSS está em `src/styles/_caregiver.scss`, todo dentro de `.cg-app`). Veja todos ao vivo em `/cuidador/_kit` (só em `ng serve` e testes). Entradas com `*` são obrigatórias.

| Seletor | Entradas e saídas | Para quê (UX) |
|---|---|---|
| `app-cg-page-header` | `title*`, `description`, `backLink`, `backLabel` | h1 serifado com linha dourada, apoio e "Voltar" (A.2.3) |
| `app-cg-card` | `title*`, `variant` (`default`, `care`, `soft`), `icon`, `link`; slot `[cgCardFooter]` | Cartão; com `link` o cartão inteiro é um `<a>` (A.2.4) |
| `app-cg-note` | `variant` (`care`, `info`, `soft`, `ok`, `late`, `error`), `heading`, `icon`; slot `[cgNoteActions]` | Toda mensagem de estado, ícone mais texto; só `error` é `role="alert"` (A.2.5) |
| `app-cg-row` | `title*`, `description`, `icon`, `link`, `current`, `chevron`; saída `activated`; slot `[cgRowEnd]` | Item de lista (`<ul class="cg-list"><li>`); link ou botão (A.2.6) |
| `app-cg-choice-group<T>` | `legend*`, `options*` (`{ value, label, hint? }`), `value` (model) | Escolha única em linhas grandes; nada pré-marcado (A.2.9) |
| `app-cg-switch` | `label*`, `hint`, `onText`, `offText`, `disabled`, `checked` (model) | Chave de liga e desliga com o estado escrito (A.2.10); consentimento usa a folha de efeito, não só a chave |
| `app-cg-mood` | `label`, `value` (model), saída `chosen`; `MOOD_OPTIONS`, `moodLabel` | Humor de 5 opções em 1 toque (A.2.11). É dado de saúde: só com o consentimento |
| `app-cg-dose` | `slot*` (`DoseSlot`), `size` (`default` ou `large`), saídas `dei` e `undo` | Linha "dei o remédio": a dar, no horário (até 30 min antes), passou do horário (âmbar), dado (A.2.12). Só desenha; quem grava é a tela. `large` (hora em 22 px, **Dei** de 96 px) é de quem tem pouca familiaridade digital: as telas passam `ctx.doseSize()` |
| `app-cg-plan-lock` | `feature*`, `description`; conteúdo projetado = alternativa gratuita | Bloqueio por plano sem pressão (A.2.15) |
| `app-cg-plan-tag` | `plan*` | "Plano Cuida" com ponto e nome (A.2.23) |
| `app-cg-sheet` | `heading*`, `open` (model), `initialFocus`; slot `[cgSheetActions]` | Folha de baixo: `<dialog>` modal, foco no título, devolve o foco, Esc e toque no fundo fecham (A.2.17) |
| `app-cg-emergency-note` | `variant` (`compact`, `full`) | Aviso de 192, compacto ou o bloco da Ajuda agora com 192 e 188 (A.2.19) |
| `app-cg-text-size` | `showLegend` | Normal, Grande, Bem grande (A.2.20) |
| `app-cg-trend` | `items*` (`CgTrendItem`) | Linha do tempo da evolução, rampa de azul, pontuação só em legenda; cada `<li>` leva o rótulo "04/11, sobrecarga severa, 63 pontos" (A.2.21) |
| `app-cg-calendar` | `events` (`CgCalendarEvent[]`: dia e tipo), `selected` (model, `ISODate`) | Calendário do mês da Agenda: semana de domingo a sábado, marcas por tipo com cor e forma, legenda, Mês anterior, Próximo mês e Hoje, grade com teclado (A.2.25). Regras puras em `core/rules/calendar-grid.ts`; `docs/16-calendario-agenda.md` |
| `app-cg-rating`, `app-cg-rating-pair` | `label*`, `value` (model); `quality` e `punctuality` (models); `ratingPairMissingText(q, p)` | Nota de 1 a 5 numerada, e as duas notas da avaliação (A.2.22) |
| `app-cg-header`, `app-cg-nav`, `app-cg-proto-note`, `app-cg-contact-dialog` | montados pelo shell | Não use nas telas |

Reaproveitados do design system, já com o tema `.cg-app` (medidas de 48 e 56 px, letra de 18 px): `app-form-field`, `appInput`, `appMask`, `app-checkbox`, `app-radio-group`, `app-empty-state`, `app-stepper` (o passo a passo "Etapa 2 de 5" do cadastro; é o `app-cg-steps` do UX), `app-badge`, `ToastService`, `DialogService`, `DraftService`, os botões `.btn` (`btn--primary` de 56 px).

Classes de layout (`_caregiver.scss`): `.cg-list`, `.cg-grid` (1 coluna, 2 x 2 de 768 px em diante), `.cg-stack`, `.cg-section` mais `.cg-section__title`, `.cg-actions` (botões empilhados no celular), `.cg-action-bar` (barra fixa da ação principal, acima da barra de navegação), `.cg-link-btn` (botão de texto), `.cg-reading` (coluna de 640 px para formulário e texto longo), `.cg-who`. Tokens `--cg-*` (letra, medidas, cores calmas, rampa `--cg-band-1` a `--cg-band-4`) estão no começo do arquivo; use-os em vez de hex.

Confirmação: o botão que confirma leva o nome da ação, nunca "Sim"; use `DialogService.confirm` (vira folha de baixo no celular) ou `app-cg-sheet` quando o conteúdo é um formulário curto. Toast: passe `durationMs: 8000` (o UX pede 8 segundos; o padrão do serviço é 6).

## 10. Testar: `bootCaregiverApp`

`features/caregiver-app/testing.ts`, no estilo de `layout/testing.ts`. Sobe a raiz do app com o roteador de verdade, o seed completo e o cuidador já dentro (a sessão abre ANTES da primeira navegação).

```ts
import { bootCaregiverApp } from '../testing';

const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/remedios' });
expect(app.root.querySelector('main h1')?.textContent).toContain('Remédios');
app.context.canUse('groups');      // true (plano Cuida)
app.db; app.clock; app.session; app.auth; app.local; app.sessionBackend; app.router;

await bootCaregiverApp(null, { url: '/cuidador/comecar' });                  // sem sessão
await bootCaregiverApp('cg_0003', { time: '20:00', layout: 'drawer' });      // relógio, barra inferior
```

Opções: `url` (padrão `/cuidador/hoje`), `layout` (`drawer` abaixo de 1024 px, `full` ou `rail`; o jsdom não tem `matchMedia`, então o padrão é a tela larga), mais as de `configureCoreTest` (`today`, `time`, `local`, `session`, `seed`). Chame `TestBed.resetTestingModule()` entre dois boots no mesmo teste. Ajudante `settleCaregiver(fixture)` espera o app acomodar. Cada `<area>.spec.ts` já tem a fumaça da área; acrescente os testes da tela (fluxos, estados vazios, plano e consentimento, texto sem as palavras proibidas).

Pessoas de demonstração úteis (docs/10-cuidador-ux.md, D.1): Ana `cg_0001` (Cuida, contato "hoje", 4 doses, compromisso hoje), Maria `cg_0002` (Essencial, contato "ainda não", pedido de revisão aberto), João `cg_0003` (Livre, prefere telefone, não autorizou a família), Rita `cg_0008` (Cuida, um serviço concluído sem avaliação), Elza `cg_0027` (Sustenta), Lourdes `cg_0024` (lista de espera), Marcos `cg_0026` (cancelamento agendado para D+9), Sônia `cg_0016` (saúde retirada), Raimunda `cg_0018` (pedido de exclusão aberto).

## 11. Convenções específicas do aplicativo

- Texto de tela: sem travessão, sem ponto de exclamação, sem emoji, sem as palavras "guerreira", "anjo", "heroína", "paciente", "idoso", "eficácia"; "diagnóstico" só na frase "não é um diagnóstico"; "alerta" não aparece em texto visível. O `node scripts/check-core.mjs` varre `features/caregiver-app` e a entrada e falha se encontrar (AC-CG-12, P-06).
- Ícones só do sprite (`appIcon`); não use `siren`, `triangle-alert`, `octagon-alert` nem `shield-alert`. Nenhum `tel:` nem `wa.me`: telefone e WhatsApp abrem o diálogo "Como falar com a gente".
- Estado nunca só por cor. Vermelho só para erro de formulário e para o botão de ato irreversível; nada vermelho ou âmbar sobre pontuação, contato da equipe, plano ou consentimento.
- Pagamento é simulado: nenhum campo de número de cartão. Plano e Cartão são informação neutra, nunca ligados a pontuação, alerta ou ARBE (RN-PLN-19).
- O cuidador vê os próprios dados sem máscara; não existe visão de outro cuidador. O cuidador não gera linha de "view" no log; ação que a equipe precisa saber (agendou, cancelou, pediu, inscreveu-se, mudou consentimento, pediu eliminação) grava o registro de domínio normal.
- Consentimento dado pelo próprio cuidador: `ConsentService.grant/refuse/revoke(caregiverId, key, { channel: 'app', registeredByUserId: caregiverId })` (o serviço exige quem registra; o histórico mostra "usuário" para um id que não é da equipe).
- Domínio antes da tela: se um serviço da equipe tem checagem de perfil que impede o cuidador, extraia o miolo para o `core` (pedido ao líder) e mantenha a checagem na borda; não copie a lógica.

## 12. O que a Base estendeu no núcleo e em arquivos compartilhados

| Onde | O quê |
|---|---|
| `core/auth/caregiver-access.ts`, `caregiver-session.store.ts`, `caregiver-session.service.ts` | Sessão do cuidador (seção 4) |
| `core/auth/guards.ts`, `auth.service.ts` | `caregiverGuard`, `caregiverAreaGuard`, `homeRedirectGuard`; guards da equipe olham a sessão do cuidador; `selectProfile` encerra a do cuidador; `peekReturnUrl()` |
| `core/models/access.ts`, `core/models/caregivers.ts` | `CaregiverSession` e `DoseCheck` |
| `core/storage/storage.service.ts` | Chaves `caregiverSession` e `caregiverFontScale` |
| `core/data/collections.ts`, `database.ts`, `import-export.ts`, `seed/state.ts` | Coleção `doseChecks` (`docs/08` seção 9) e `OPTIONAL_ON_IMPORT` |
| `core/privacy/retention.service.ts` | A eliminação apaga e lista as marcações de remédio |
| `core/rules/medication-doses.ts`, `plan-features.ts`, `staff-contact.ts` (com testes e RN nos comentários) | Doses do dia, acesso por plano, contato da equipe |
| `core/care/dose-check.service.ts` | `DoseCheckService` |
| `core/seed/build-caregiver-app.ts`, `scenarios.ts`, `seed.ts`, `index.ts` | Dados de demonstração (seção 13) |
| `layout/pages/browser-data.page.ts` | Nomes em português das chaves e coleções novas em "Meus dados no navegador" |
| `shared/ui/display/icon.component.ts`, `tools/build-icons.mjs`, `public/icons/sprite.svg` | 9 ícones novos (P-01, autorizado): `house`, `life-buoy`, `pill`, `video`, `frown`, `annoyed`, `meh`, `smile`, `laugh`. Só acrescentados; os 110 de antes não mudam |
| `src/styles.scss`, `src/styles/_caregiver.scss` | Estilos do aplicativo, da entrada e do toast e da confirmação quando `data-app="caregiver"` |
| `scripts/check-core.mjs` | Varre `features/caregiver-app` e a entrada (AC-CG-12) e também o `docs/11` para travessão |
| `features/auth` | A entrada nova e `destinationAfterCaregiverLogin` |

Arquivos que os devs de página (P1, P2, P3) e a integração tocaram fora das próprias pastas (cada dev registra o detalhe em `docs/ac-status/caregiver-p1.md`, `-p2.md` e `-p3.md`; a integração, em `docs/12-cuidador-integracao.md`):

| Onde | O quê | Quem |
|---|---|---|
| `core/models/caregivers.ts` | Dois campos opcionais: `Caregiver.emergencyNoticeAcceptedAt` (aceite do aviso de emergência com data e hora, AC-CG-30 e AC-CG-155) e `CareAppointment.place` ("onde ou com quem", C5). Sem migração | P1 |
| `core/care/caregiver-registration.service.ts` (+ spec) | Miolo do cadastro do cuidador (código `CUI-xxxx`, pessoa idosa, consentimentos, assinatura Livre); `CaregiverError` mora aqui | P1 |
| `features/caregivers/state/caregiver.service.ts` | `create`, `findByCpf` e `nextIdentity` delegam ao `CaregiverRegistrationService` (o log de auditoria fica aqui); `requestClosure` delega ao `SubjectRightsService.requestErasure` com `reuseOpen` (a checagem do estado do cadastro e o canal "presencial" ficam na borda) | P1 e integração |
| `core/rules/care-agenda.ts` (+ spec) | Regras puras da agenda do cuidador (próximos compromissos, dias, "passou do horário") | P1 |
| `features/caregiver-app/state/online-status.service.ts`, `people-format.ts` | Aviso de "sem conexão" e a frase "com a Dra. ..."; servem a mais de uma área, que nunca importam umas das outras | P1 |
| `features/auth/caregiver-entry.spec.ts` | Uma linha: o h1 de Hoje passou a ser a saudação | P1 |
| `core/care/session-booking.service.ts` (+ spec) | Miolo de agendar, cancelar e remarcar sessão (RN-ATD-02 a 05, 09, 10, 12, 16, 19), sem checagem de perfil; opção `homeSafetyPending` | P2 |
| `features/care-sessions/state/care-sessions.service.ts` | `CareSessionsService` delega as leituras e os três atos ao `SessionBookingService`; a checagem de perfil fica na borda | P2 |
| `core/care/review-request.service.ts` (+ spec) e `features/zarit/state/zarit.service.ts` | Miolo do pedido de revisão de decisão (RN-ZRT-20); `registerReviewRequest` delega a ele | P2 |
| `core/care/caregiver-messages.service.ts` (+ spec) | Mensagem do cuidador para a equipe pelo aplicativo (canal `app`, prazo de 24 horas úteis) | P2 |
| `core/privacy/subject-rights.service.ts` (+ spec) | Pedir cópia, pedir eliminação e retirar o pedido (RN-LGPD-18, 20, 21, 24); `requestErasure` ganhou `ErasureOptions` (canal, descrição, `reuseOpen`) para a equipe usar o mesmo miolo | P2 e integração |
| `core/commerce/subscription.service.ts` | `changePlan`, `keepPlan`, `reactivate` e `startSubscription` ganharam o último parâmetro opcional `author` (a troca feita pelo cuidador fica no histórico em nome dele; sem ele vale a sessão da equipe e, sem sessão, `system`) (+ `subscription-author.spec.ts`) | P3 |
| `features/network/state/network-admin.service.ts` | `createRequest` e `registerEvaluation` usam `serviceRequestProblem` e `isValidRating` do núcleo (mesmas frases, mesma ordem) | P3 |
| `core/rules/service-requests.ts`, `benefit-card.ts`, `guidance-content.ts` (+ specs) | Pedido de serviço e nota, economia do Cartão e parceiros ativos, conteúdos publicados e exclusivos | P3 |
| `core/network/caregiver-network.service.ts` (+ spec) | A rede vista pelo cuidador: busca, ficha pública (sem monitoramento, recusa, comissão nem disponibilidade), pedidos, cancelamento, avaliação e correção em 7 dias | P3 |
| `core/groups/caregiver-activities.service.ts` (+ spec) | Programação, situação da pessoa em cada atividade, inscrição com sigilo, lista de espera e saída | P3 |
| `shared/ui/util/clipboard.ts` (+ spec) | O único helper de copiar do app: `copyToClipboard(text, doc)`, `selectContents(element, doc)` e `copyOrSelect` (copia; se negar, deixa o elemento selecionado). Substituiu `help/state/copy-text.ts` e as cópias inline do diálogo de contato e da Família | P3 e integração |
| `core/care/wellbeing-check.service.ts` (+ spec) | `WellbeingCheckService` (humor do dia) saiu de `today/state` para o núcleo, porque Hoje e Como estou usam o mesmo; `today/state/wellbeing-check.service.ts` ficou como re-export fino | integração |
| `features/caregiver-app/state/copy-feedback.ts`, `caregiver-context.service.ts` | Frases de copiar numa lista só; `lowDigitalLiteracy()` e `doseSize()` no contexto | integração |
| `features/caregiver-app/ui/cg-trend.component.ts`, `cg-dose.component.ts`, `cg-contact-dialog.component.ts`, `src/styles/_caregiver.scss` | Kit: rótulo de leitor de tela por item da linha do tempo; `size="large"` do `app-cg-dose` (hora em 22 px, **Dei** de 96 px); diálogo de contato com o número selecionado e a frase "Não foi possível copiar..." quando a área de transferência é negada | integração |
| `core/seed/build-caregiver-app.ts`, `seed.spec.ts`, `caregiver-app-seed.spec.ts`, `settings/pages/data.page.ts` | Uma conversa futura com o psicólogo para Ana e para Lourdes (`careSessions` 60 para 62; `docs/12` seção 1) | integração |

Testes existentes alterados, com o motivo: `core/data/database.spec.ts` (57 para 58 coleções, por `doseChecks`); `app.spec.ts` (22 rotas carregadas sob demanda em vez de 21, pela rota `cuidador`, e `cuidador` na lista de rotas); `features/auth/auth.spec.ts` (a lista da equipe agora começa recolhida e o `h1` é "Entrar"; os testes abrem a porta da equipe antes de escolher o perfil). Nenhuma contagem protegida do seed mudou.

## 13. Seed das pessoas de demonstração

Todas as 29 pessoas de cenário já tinham pessoa idosa, 2 remédios com horários e 1 compromisso. `build-caregiver-app.ts` roda **por último, sem sortear** (não mexe na sequência do gerador, só acrescenta linhas): compromissos de hoje (fim da tarde) e de 1 a 3 e de 4 a 6 dias adiante para as 11 pessoas da entrada; um 3º remédio de Ana (Omeprazol às 07:30, para somar 4 doses por dia); remédios marcados como dados nos últimos 4 dias para Ana (menos a dose das 20h de anteontem) e os de antes das 9h de hoje; um serviço concluído e sem avaliação para Rita (um pedido que já existia, de um cuidador de volume, reatribuído a ela, então as contagens de pedidos e as métricas da rede não mudam); João sem autorização de compartilhar com a família (`scenarios.ts`), enquanto Ana autorizou. Maria (pedido de revisão aberto), Raimunda (exclusão aberta), João (mensagem por telefone) e Marcos (mudança de plano em D+9) já existiam. **Integração:** Ana e Lourdes ganharam uma conversa futura com o psicólogo (Ana: Dr. Rafael, `scheduled`, on-line, em 3 dias úteis; Lourdes: Dra. Letícia, `confirmed`, coworking, em 2 dias úteis), cada uma com a vaga `booked`; `careSessions` passou de 60 para 62 (`docs/12`, seção 1). O teste `core/seed/caregiver-app-seed.spec.ts` guarda tudo isso e que a mesma data gera exatamente os mesmos dados.

Navegador que já tinha o banco gerado antes: use "Resetar para o seed" (M15) para receber os dados novos.

## 14. Decisões do Dev, pendências e pedidos ao líder

Decisões tomadas (suposições de protótipo, fora do plano):

1. `/cuidador/comecar` e `/cuidador/ajuda-agora` abrem sem sessão (S-35); o resto exige sessão. Quem tem sessão pode abrir o Começar (o dev de `start` decide o que fazer).
2. Sem expiração por inatividade para o cuidador.
3. Não dá para marcar "dei" de dia que ainda não chegou.
4. Aviso de "passou do horário" só depois de 1 minuto cheio; "no horário" vale até 30 minutos antes (A.2.12).
5. O banner "Antes de começar" fica escondido em `/cuidador/**` (CSS por `data-app`), sem tocar no componente compartilhado.
6. A lista da equipe na entrada abre sozinha só quando a pessoa vem de sessão da equipe, de erro de código ou de link `/app`.

Pendências e pedidos:

- **Dado inconsistente no UX**: o doc usa "qui, 06/11" com hoje em quarta, 04/11/2026; 06/11 é sexta. O código usa o calendário de verdade (`sex, 06/11`).
- Resolvido: `SubscriptionService.changePlan`, `keepPlan`, `reactivate` e `startSubscription` ganharam o parâmetro opcional `author`; a troca feita pelo cuidador grava o id dele (P3, seção 12).
- `ConsentService` exige `registeredByUserId`; a convenção acima (id do cuidador) funciona, mas a tela de histórico da equipe mostra "usuário".
- Existem `shared/ui/plan/subscription-panel` e `plan-change-drawer` (visão da equipe); P3 decide se reaproveita o miolo ou escreve a tela do cuidador com o kit.
- Resolvido: as 22 telas foram entregues por P1, P2 e P3 e integradas (`docs/12-cuidador-integracao.md`).
- Contraste (AC-CG-06) dos tokens `--cg-*` e alvo de 48 px (AC-CG-01): verificados por `pnpm run check:a11y` (`scripts/check-caregiver-a11y.mjs`); o resto (rolagem, texto cortado, foco) segue por inspeção visual em 360, 390 e 1280 px.
