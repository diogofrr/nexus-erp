# UX v2 do aplicativo do cuidador: o que o Dev de UX mudou (11/11/2026)

Status: PRONTO (11/11/2026). Aplica `docs/20-regras-planos-v2.md` (seção "Regras de exibição ao cuidador") em tudo o que não é
plano, atendimento, encontros, conteúdos e cartão (esses são do agente Regras v2, `docs/21-regras-v2-dev.md`). A
pergunta de cada tela foi "uma pessoa cansada, com 2 minutos, entende o que fazer?".

Feedback do dono que motivou a rodada: "gostei muito da identidade visual, mas ainda peca em UX: não está bem
organizado, fica o tempo todo mostrando o que seria premium, tem elementos textuais soltos, informações de eventos
públicas para quem não deveria ter acesso, não tem eventos categorizados".

## 1. O que vale para todas as telas

| Regra (docs/20) | Como ficou |
|---|---|
| 1. Nunca anunciar o que o plano não inclui fora de Meu plano | `app-cg-plan-lock` saiu do kit público (`ui/index.ts`), do catálogo `/cuidador/_kit` e de todas as telas de UX; o arquivo só continua no disco enquanto `groups/` e `content/` o importam (ver pedidos ao agente Regras). Nenhuma frase "Disponível no plano", "a partir do plano", cadeado ou "benefício dos planos pagos" fora de Meu plano. Testes: `today.spec`, `care.spec`, `network.spec`, `search.spec`, `provider.spec`, `shell.spec`, `ui.spec`, `routing.spec`. |
| 2. Eventos sem acesso não são listados | `state/event-type.ts` (`canSeeEventType`, `enrolledMeetingsOf`, `nextOpenMeetingOf`) e `state/plan-access.ts` (o ÚNICO lugar que fala com `ctx.canUse`): Hoje só convida para roda aberta (todos), capacitação incluída (`training_included`), leitura aberta (todos) e conversa (`individual_session`, Cuida e Sustenta). Terapia de grupo nunca é convite. Agenda e Hoje listam encontros só quando a pessoa já está inscrita. |
| 3. Eventos categorizados | Componente novo `app-cg-event-badge` (tipo com ícone e cor: roda aberta sálvia, capacitação azul-céu, terapia de grupo areia; sempre com o nome escrito) em Hoje (convite e próximo compromisso) e na Agenda (linha do encontro). |
| 4. Nada de texto solto | Componente novo `app-cg-section` (título, contagem opcional, detalhe à direita, corpo em pilha). Toda tela minha é herói (título e no máximo uma linha), seções com título e cartões. Aviso de protótipo só no rodapé do shell. Aviso de emergência só em Ajuda agora, Conversar com um psicólogo e Como estou (mais o aviso escrito dos canais em Falar com a Nexus e no cadastro, ver seção 4). |
| 5. Meu plano é o único lugar que explica os planos | Mais lista "Meu plano" como item comum, dentro do grupo "Conta", com informação neutra ("Cuida · R$ 119,90 por mês"). |

### Kit (`ui/`)
- **Novo `app-cg-event-badge`** (`[type]`, `size="sm|md"`): `cg-event cg-event--<tipo>`, `data-type`. CSS em `_vida.scss`, cores das seções (já conferidas pelo `check:a11y`).
- **Novo `app-cg-section`** (`title`, `[count]`, `[headingLevel]`, `accent`, projeção `cgSectionEnd`): `region` com `aria-labelledby`; classes `cg-block`, `cg-section__count`, `cg-section__body`.
- `app-cg-card` e `app-cg-row` ganharam `[linkQuery]` (a consulta da URL do link), para o cartão e a linha levarem a `/grupos?atividade=`.
- `app-cg-plan-lock`: descontinuado (comentário no arquivo), fora do índice e do catálogo.
- **Animação de entrada à prova de falha** (item 4 do pedido): o estado padrão de todo bloco é visível. O shell põe `is-entering` na coluna por 800 ms a cada tela nova (só quando o caminho muda, não a consulta da URL) e tira em seguida; `_vida.scss` só anima `.is-entering > * > *` e `.is-entering .cg-enter > *`, com `backwards` segurando o `from` durante o atraso. Com a aba em segundo plano a animação não roda, mas a classe sai e a página aparece inteira; sem JavaScript nada some. `prefers-reduced-motion` continua desligando tudo.

## 2. O que mudou por tela

| Tela | Antes | Depois |
|---|---|---|
| **C4 Hoje** | Nota de cuidado e cartão do telefone fora das colunas; "Para você" oferecia a conversa a todo plano; roda aberta sem tipo; fechamento "Quer falar com a gente?" como bloco solto | Herói e duas colunas claras: **o dia** à esquerda (contato da equipe quando houver, cartão do telefone para quem prefere ligar, próximo compromisso, remédios de hoje em `app-cg-section` com o anel) e **você** à direita (humor, "Para você", cartão "Quer falar com a gente?"). "Para você" só convida para o que o plano dá (rodízio por calendário entre o que está disponível; sem nada, a seção some). Convite de roda ou capacitação usa o título da atividade, o selo do tipo e "Aberta a todos." ou "Sem custo para você." (nunca a palavra plano em Hoje). Encontro em que a pessoa está inscrita entra em "Próximo compromisso" com o selo e leva a Encontros. Plano nunca aparece. |
| **C5 Agenda** | Só compromissos e a conversa com o psicólogo | Também os encontros em que a pessoa está inscrita (futuros, de atividade aberta, lotada ou em andamento), marca "Para você" no calendário e o selo do tipo na linha, que leva a `/grupos?atividade=`. |
| **C7 Cuidar de mim** | 4 cartões para todos, aviso de emergência no fim | Herói e grade de ladrilhos da mesma altura, nada mais. Cuida e Sustenta: 4 (Conversar com um psicólogo, Como estou, **Encontros**, Conteúdos). Livre e Essencial: 3, sem o da conversa (o atendimento individual não é vendido a eles) e em uma linha em tela larga. Frases: "Rodas de conversa, capacitações e grupos com quem também cuida.", "Você está em 1 encontro.", "Você está na lista de espera de 1 encontro.". Sem aviso de emergência. |
| **C9 Como estou** | Linha de privacidade solta no fim; sem aviso de emergência | A linha de privacidade virou nota suave com cadeado; aviso de emergência compacto no fim (é uma das três telas que o levam). |
| **C12 Rede** | 3 cartões para todos ("Um benefício dos planos pagos." para o Livre) e nota solta no fim | Herói cuja linha é o aviso de que a Nexus organiza a rede (RN-REDE-17), sem nota solta; ladrilhos da mesma altura: Buscar e Meus pedidos para todos, Cartão Nexus só para quem tem o cartão (Essencial em diante). Livre vê 2 ladrilhos e nada sobre cartão. |
| **C13 Buscar** | Comparação com a linha "Condições especiais: a partir do plano Essencial" no Livre | No Livre a linha de condições não existe (nem na tabela, nem em "Igual nas duas opções"); do Essencial em diante, as condições. `CONDITIONS_FROM_ESSENCIAL` apagada de `network-copy.ts`. |
| **C14 Profissional** | Seção "Condições para quem é da Nexus" com "a partir do plano Essencial" no Livre | A seção só existe para quem tem condições especiais; o Livre não vê a seção. |
| **C17 Mais** | 5 linhas soltas e o painel da letra | Herói com nome e etiqueta do plano; grupos **Conta** (Meu plano, Meu perfil, Família), **Ajuda** (Falar com a Nexus, Ajuda agora), **Privacidade** (Privacidade e meus dados); painel Tamanho da letra; Sair. Meu plano é item comum, sem chamada. |
| **C19 Falar com a Nexus** | Aviso de emergência solto no fim | O aviso escrito dos canais (RN-CAN-06, AC-CG-165) ficou logo abaixo da lista de canais, como parte da seção. |
| **C20 Família** | Nota de garantia solta no fim | A garantia ("Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui.") fica junto do botão Copiar texto (e no cartão de autorização para quem ainda não autorizou), como o CS/CX pediu (docs/14, seção 4). |
| **C21 Privacidade** | Linha do herói com 3 frases | Uma linha: "Você decide o que a Nexus pode fazer com os seus dados e pode mudar quando quiser." |
| **C22 Meu perfil** | 3 cartões e o painel Tamanho da letra repetido | Só os 3 cartões; a letra fica em Mais. |
| **C3 Ajuda agora** | Rodapé em `<p class="cg-meta">` | A mesma frase em nota suave (sem parágrafo solto). Resto igual (a tela é a referência de calma). |
| **C2 Começar** | Aviso de emergência no passo 5 | Mantido: é o aviso escrito que a pessoa marca que leu ao criar a conta (RN-CAN-06, `emergencyNoticeAcceptedAt`), não um aviso repetido. |
| **Shell** | Animação `backwards` deixava a página em branco com a aba em segundo plano | Entrada à prova de falha (seção 1). Aviso de protótipo continua só no rodapé. |

## 3. Suposições e decisões

1. **Chaves de acesso**: uso as chaves novas do agente Regras (`individual_session`, `group_therapy`, `training_included`, `card`, `network_conditions`), todas em `state/plan-access.ts`. Pendente: quando `ctx.quotas()` existir, `trainingIncluded` passa a `ctx.quotas().trainings.left !== 0` (a cota do mês pode acabar).
2. **Capacitação no "Para você"**: só quando incluída no plano. Para o Livre a capacitação avulsa existe (regra 2 do docs/20, "com o valor avulso"), mas o convite do dia não vende: ela aparece na tela Encontros, com o valor, e não em Hoje.
3. **Encontro inscrito em Hoje e na Agenda**: entra como "Para você" (marca `you` no calendário). Lista de espera não entra (ainda não é da pessoa).
4. **Raimunda (Livre) e as sessões antigas no seed**: a porta esconde "Conversar com um psicólogo" para o Livre mesmo que o seed tenha uma conversa dela. O que fazer com sessões de Livre e Essencial já marcadas é decisão do agente Regras (ver pedidos). O teste AC-CG-74 passou a usar Lourdes (Sustenta).
5. **Falar com a Nexus e Começar** mantêm o aviso escrito dos canais (RN-CAN-06 é regra de negócio, "sem discussão"); ele deixou de ser um bloco solto.
6. `care/state/care-hub.service.ts` serve só à porta (frases dos ladrilhos): editei as frases de "grupo" para "encontro". Se o agente Regras também o editar, as frases valem como estão aqui.

## 4. O que vi nas telas do agente Regras (só anotado; não editei)

- **C10 Encontros (`groups/`)**: herói "Grupos e capacitações" com "A programação do mês." (frase solta como linha; trocar o título para "Encontros" e a linha para algo como "Rodas de conversa, capacitações e terapia de grupo, mês a mês." ou nada); cartões com selo "Disponível no plano Cuida" (`plan-tag` com cadeado) e `app-cg-plan-lock` (regra 1: apagar); listar só os tipos que o plano dá (regra 2); usar `app-cg-event-badge` no lugar do selo próprio de tipo e `app-cg-section` por tipo com contagem (regra 3); "Minhas inscrições" pode virar a primeira seção. Quando `groups/` e `content/` deixarem de importar `cg-plan-lock.component.ts`, apagar o arquivo.
- **C11 Conteúdos (`content/`)**: linha "Leituras curtas. Escolha uma." (virar linha do herói sem o imperativo, ou sumir); `app-cg-plan-lock` dos exclusivos (regra 1: quem não tem exclusivos simplesmente não os vê).
- **C8 Conversar com um psicólogo (`care/pages/psychologist.page.ts`)**: no Livre e no Essencial a tela não deve existir (a porta já não leva a ela); se a rota for aberta à mão, decidir o que mostrar (sugestão: "Este atendimento faz parte dos planos Cuida e Sustenta" só em Meu plano; aqui, voltar para Cuidar de mim). O resumo com "Desconto do plano X (10%)" precisa virar a cota ("Neste mês: 1 de 2 sessões usadas").
- **C16 Cartão (`card/`)**: a vitrine "convite calmo" para o Livre contraria a regra 1; para o Livre a rota deveria voltar a Rede (a porta já não mostra o ladrilho).
- **C18 Meu plano (`plan/`)**: segue sendo o único lugar que explica os planos; nada a mudar na regra, só conferir que "Tudo do plano anterior, mais:" não aparece 4 vezes (docs/14).

## 5. Pedidos ao agente Regras

1. ~~Apagar `ui/cg-plan-lock.component.ts`~~ feito (o arquivo já não existe). Faltam os testes que ainda procuram "Disponível no plano" (`qa/caregiver-ui.qa.spec.ts`, Grupos e Conteúdos) e os do quadro de planos: contrariam a regra 1 do docs/20 e precisam ser reescritos por quem é dono deles.
6. Atualizar a parte C8 de `care/care.spec.ts` (10 testes de Conversar com um psicólogo ainda esperam desconto por plano e "Remarcar em vez de cancelar"); a parte C7 (porta) desse arquivo já está no formato novo.
2. Usar `app-cg-event-badge` e `app-cg-section` em Encontros (seção por tipo, contagem no título).
3. Decidir o destino das sessões já marcadas de Livre e Essencial no seed (Raimunda `cg_0018`): manter como histórico sem oferecer nova, ou migrar.
4. Publicar `ctx.quotas()` (documentado, ainda não no contexto) para `state/plan-access.ts` trocar `training_included` pela cota do mês.
5. Para as rotas `/atendimento` (Livre e Essencial) e `/cartao` (Livre), redirecionar à porta: as portas já não mostram os ladrilhos.

## 6. Números

- Minhas áreas (`today`, `ui`, `shell`, `network`, `routing`, `help`, `privacy`, `family`, `start`, `routine`, `my-wellbeing` e a porta em `care.spec`): 21 arquivos, 503 testes, todos verdes exceto os 10 de C8 (tela do agente Regras).
- Suíte inteira no fechamento: 161 arquivos, 2277 testes; 2210 passam e 67 falham, todos em arquivos do agente Regras ainda em andamento (`groups`, `plan`, `card`, `content`, C8 de `care`, `care-sessions`, `features/groups`, `settings`, `subscriptions`, `governance`, `qa/*`) ou que esperam o comportamento antigo de plano.
- Testes novos ou reescritos meus: kit (seção e selo, ausência de `cg-plan-lock`), Hoje (o que "Para você" convida por plano, selo de tipo, encontro inscrito no próximo compromisso, nada de plano), portas (3 ou 4 ladrilhos por plano em Cuidar de mim, 2 ou 3 em Rede), Buscar e Profissional sem a linha de condições no Livre, Mais em grupos.
- `pnpm run typecheck` limpo, `node scripts/check-core.mjs` ok, `pnpm run check:a11y` ok (265 conferências), `pnpm exec ng build` ok.
- Navegador (aba `seed`): João (Livre), Maria (Essencial), Ana (Cuida) e Elza (Sustenta) em 375 e 1280 px: Hoje em duas colunas sem plano; Cuidar de mim com 3 ladrilhos (João, Maria) e 4 (Ana); Rede com 2 (João) e 3 (Maria); Mais em grupos; Agenda da Elza com a terapia de grupo inscrita, selo e link para Encontros; a página aparece inteira com a aba em segundo plano (a classe `is-entering` sai sozinha).

## 7. O que ficou de fora

- Filtro por tipo quando há mais de um tipo de encontro numa lista (regra 3): só existe lista de encontros em Encontros, que é do agente Regras.
- `trainingIncluded` ainda vem da chave `training_included`, não da cota do mês (`ctx.quotas()`), ver pedido 4.
- Começar (C2) e Ajuda agora (C3) passaram só por revisão de texto: o cadastro já é passo a passo com cabeçalho e a Ajuda agora é a referência de calma.
- O aviso de protótipo continua na faixa `banner--prototype` da Entrada e da primeira etapa do cadastro (fora do shell com sessão): não mexi.
