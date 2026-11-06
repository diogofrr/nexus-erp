# Aplicativo do cuidador: integração (Dev de Integração)

Status: PRONTO. Este documento registra, tarefa por tarefa, o que a integração fez depois que a Base e os três devs de página (P1, P2, P3) entregaram as 22 telas. Complementa `docs/10-cuidador-contexto.md`, `docs/10-cuidador-ux.md`, `docs/11-cuidador-arquitetura.md` e `docs/ac-status/caregiver-p1.md`, `caregiver-p2.md` e `caregiver-p3.md`.

## 1. Dados de demonstração: conversa futura com o psicólogo

`src/app/core/seed/build-caregiver-app.ts` (só acrescentado no fim, sem sorteio, determinístico para a mesma data):

| Pessoa | Psicólogo | Quando | Formato | Situação | Vaga |
|---|---|---|---|---|---|
| Ana (`cg_0001`, Cuida) | Dr. Rafael Moreira (`psy_0001`) | 3 dias úteis depois de hoje (seg, 09/11/2026, em hoje = qua, 04/11) | On-line | `scheduled` (aguardando o psicólogo) | nova, `booked` |
| Lourdes (`cg_0024`, Sustenta) | Dra. Letícia Amaral (`psy_0003`) | 2 dias úteis depois de hoje (sex, 06/11/2026) | Coworking (sala Girassol, com os 4 itens de acessibilidade) | `confirmed` | nova, `booked` |

Como o horário é escolhido: o primeiro da lista `10:00, 14:00, 15:00, 16:00, 11:00, 09:00, 17:00, 08:00` em que o psicólogo não tem nenhuma vaga (livre, ocupada ou bloqueada) naquele dia; o dia útil usa `isBusinessDay` (fim de semana e feriado nacional não contam). O preço já vem com o desconto do plano da pessoa (RN-ATD-05: Cuida 15%, R$ 102,00; Sustenta 20%). Psicoterapia nas duas.

**Contagens protegidas por teste que mudaram, e por quê.** Foram acrescentadas 2 linhas em `careSessions` e 2 em `availabilitySlots` (nenhuma sessão existente foi reatribuída, para a vaga e o psicólogo serem os pedidos):

| Contagem | Antes | Depois | Onde |
|---|---|---|---|
| `careSessions` | 60 | 62 | `seed.spec.ts` (3 lugares), `caregiver-app-seed.spec.ts`, `settings.spec.ts` (4 lugares) |
| `confirmed` e `scheduled` | 8 e 21 | 9 e 22 | `seed.spec.ts` |
| on-line e coworking | 30 e 21 | 31 e 22 | `seed.spec.ts` |
| psicoterapia | 51 | 53 | `seed.spec.ts` |
| vagas ligadas a sessão | 60 | 62 | `seed.spec.ts` |
| `SEED_SUMMARY` ("340 cuidadores, 20 prestadores e 62 sessões") | 60 | 62 | `settings/pages/data.page.ts` (texto do diálogo "Voltar aos dados de demonstração") |

Não mudaram: vagas abertas (12, 4 prioritárias) e bloqueadas (3); anotações (20 assinadas, 4 rascunhos); sessões `done` (24), `no_show` (3), canceladas (2 e 2); domicílio (9). **A ocupação dos meses fechados não muda**: ela vem de `monthSummaries` (Rafael 160/138 e 160/146, 86,3% e 91,3%), que o seed novo não toca; o teste `caregiver-app-seed.spec.ts` guarda isso.

Testes das telas que usavam a Ana como "sem compromisso" ou "sem conversa" foram ajustados: Conversar com um psicólogo vazio e a porta de Cuidar de mim passaram a usar a Maria (sem conversa no seed); "sem compromisso nenhum" de Hoje e da Agenda apaga também a conversa da Ana. Foi acrescentado um teste de `care.spec.ts` que mostra a conversa de Ana e de Lourdes na porta e em Conversar.

## 2. Pedidos dos devs

| Pedido | O que foi feito |
|---|---|
| 2a. Humor no núcleo | `WellbeingCheckService` e `WellbeingError` foram para `core/care/wellbeing-check.service.ts` (com spec e no barril `core/care`). `today/state/wellbeing-check.service.ts` ficou só como re-export fino. Hoje e Como estou importam do núcleo (nenhuma área importa de outra) |
| 2b. Encerrar o cadastro | `CaregiverService.requestClosure` delega a `SubjectRightsService.requestErasure`, que ganhou `ErasureOptions` (canal, descrição e `reuseOpen`, para reaproveitar o pedido de eliminação aberto como a equipe sempre fez). A checagem do estado do cadastro e o canal "presencial" ficam na borda; `caregivers.spec.ts` e os testes do titular seguem verdes |
| 2c. Kit | `app-cg-trend`: cada `<li>` leva `aria-label` ("04/11, sobrecarga severa, 63 pontos, última conversa"; função `trendItemLabel`). `app-cg-dose`: entrada `size` (`default` ou `large`); `large` põe a hora em 22 px e o **Dei** com 96 px de largura e 56 px de altura; `CaregiverContextService.doseSize()` devolve `large` quando `digitalLiteracy` é `low` (João), e Hoje e Remédios passam esse valor. Diálogo "Como falar com a gente": com a área de transferência negada o número (ou o e-mail) fica **selecionado** e a frase é "Não foi possível copiar. Segure sobre o número e escolha Copiar." (AC-CG-161) |
| 2d. Arquivos compartilhados | `docs/11` seção 12 ganhou uma tabela com todas as edições de P1, P2, P3 e da integração fora das próprias pastas (inclui `Caregiver.emergencyNoticeAcceptedAt`, `CareAppointment.place`, o parâmetro `author` de `SubscriptionService`, os arquivos novos de `core/care`, `core/network`, `core/groups`, `core/privacy`, `core/rules` e `shared/ui/util/clipboard.ts`) |

## 3. Documentos que divergiam do seed

Decisão do líder: o texto muda, o seed não (salvo a seção 1). Em `docs/10-cuidador-ux.md`:

- **D.1.1 e contexto**: Elza não tem serviço avaliado no seed (tem um pedido "enviado"); o "Avaliar" some porque não há serviço concluído esperando avaliação.
- **C15 (Meus pedidos)**: João e Marlene (Livre) têm pedidos na lista (João 3, Marlene 1 concluído a avaliar); só Maria tem a lista vazia.
- **B8 e C16 (Cartão)**: "Neste mês: R$ 38,40" virou "o valor vem dos usos registrados" ("Neste mês: R$ {valor} em {n} compras.", e o texto sem compras no mês).
- **B6 e C10 (Grupos)**: "Sobrecarga e autocuidado" tem 8 vagas no seed (o padrão de 12 é da regra RN-GRP-13 e é editável); primeiro encontro em sáb, 07/11, às 14:00.
- **C4 e AC-CG-53**: **Avaliar** leva a `/cuidador/rede/pedidos?avaliar=<id>`, onde está a folha de avaliação.
- **D.4**: registradas como **aceitas pelo líder** as suposições S-38 a S-47 (P1), S-P2-01 a 15 (P2) e S-P3-01 a 13 (P3). Três são decisões explícitas: terapia de grupo só entra com inscrição feita pelo psicólogo (S-P3-05), detalhe de grupo, leitura de conteúdo e quadro de planos abrem como página e não como diálogo de tela cheia (S-P3-01; S-21 foi ajustada), e subir de plano em dois passos quando falta o aceite do aviso de emergência (S-P3-06). **D.5** ganhou o status dos pedidos P-01 a P-08.

## 4. Consistência entre as 22 telas

Os três devs trabalharam em paralelo; o que divergiu foi unificado (todos os testes seguem verdes):

| Tema | O que foi unificado |
|---|---|
| Cabeçalho e "Voltar" | As telas de segundo nível de **Cuidar de mim** (Conversar com um psicólogo, Como estou, Grupos, Conteúdos) e de **Mais** (Meu plano, Falar com a Nexus, Família, Privacidade, Meu perfil) ganharam o "Voltar para ..." do cabeçalho, como já tinham as de **Rede**. Um `h1` por tela e o foco no `h1` seguem pelo shell |
| Folha de baixo | Todo fechamento de folha é o botão de texto **Voltar** (Ajuda agora, "Lado a lado" da Rede e o diálogo "Como falar com a gente" diziam "Fechar", alguns como botão principal). Atos irreversíveis já tinham o foco inicial no botão seguro (`initialFocus="safe-action"`) |
| Toasts | Todos com `durationMs: 8000` (conferido em todas as telas) |
| Datas e horas | Uma só fonte, `state/day-format.ts` (`sex, 06/11`, `08:00`, o ano só quando não é o corrente). Entrou `dayMonthOrYear`; Como estou e Meus pedidos deixaram de ter função própria. As datas por extenso com ano (cobrança, aceite, conclusão) seguem o UX e usam `formatDate` do núcleo |
| Dinheiro | `formatMoney` do núcleo em todas as telas (nenhum formatador local) |
| Copiar | Um só helper, `shared/ui/util/clipboard.ts` (`copyOrSelect`), e as frases em `state/copy-feedback.ts`. Saiu `help/state/copy-text.ts` e as cópias inline do diálogo de contato e da Família. Cartão e ficha do profissional também deixam o número selecionado quando o navegador nega |
| Nome de pessoa da equipe | `state/people-format.ts` concentra `shortName`, `withArticle`, `withArticleOf`, `psychologistRole` e `firstNameOf` (antes havia `withArticle` em duas telas, `shortName` e `roleOf` em Conversar e a mesma conta de "Dra./Dr." em Como estou) |
| Formato da conversa | `state/format-labels.ts` (On-line, No espaço de coworking, Em casa) usado por Conversar e Grupos |
| CSS local repetido | Classes novas do kit em `_caregiver.scss` (`.cg-muted`, `.cg-meta`, `.cg-tag`, `.cg-tags`, `.cg-plain-list`) no lugar de 21 regras iguais em 13 arquivos, e `.cg-stack .cg-stack--tight` no lugar de 9 regras de `display: grid; gap` |
| Textos | `check-core` limpo (sem travessão, exclamação, emoji nem palavra proibida). Hoje, Como estou e Ajuda agora: a única pontuação é a legenda "63 pontos" da linha do tempo (RN-ZRT-23); nenhum "alerta", vermelho, prazo em horas nem convite de plano |
| Código sem uso | `routing/area-placeholder.component.ts` (o "Em construção") foi removido: nenhuma área o usa mais |

O que **não** foi unificado, de propósito: os rótulos de botão que o UX fixou por tela ("Salvar compromisso", "Salvar remédio", "Salvar alterações", "Cancelar pedido", "Cancelar a conversa"), porque dizem o nome da ação; e o estilo de importação (P1 usa caminhos relativos, P2 e P3 usam `@core/...`), que não muda o comportamento.

## 5. Verificação automática de contraste e alvos

`scripts/check-caregiver-a11y.mjs` (Node puro, sem dependências), ligado como `pnpm run check:a11y`. `--list` imprime a razão de cada par.

- **Contraste (WCAG 2.1, luminância relativa).** Lê os tokens `--cg-*` de `src/styles/_caregiver.scss` e resolve as cores primitivas `--nx-*` dos mapas SCSS de `_tokens.scss` e os semânticos de `:root` (`--brand-soft`). Confere 51 pares da Parte A do UX por tema: texto, texto de apoio, título e link sobre `--cg-bg`, `--cg-surface` e `--cg-surface-sunken` (4,5); contorno de campo, anel de foco e item marcado (3); texto do botão principal em repouso, hover e pressionado, do botão de ato irreversível e do aviso de emergência (4,5); texto (4,5) e ícone (3) de cada estado calmo (cuidado, aguardando, feito, passou do horário, problema) sobre o próprio fundo e sobre o cartão; faixas 3 e 4 da escala. **Temas:** o aplicativo do cuidador é só claro (S-01); um bloco `.cg-app` que redefina cores `--cg-*` entraria sozinho como tema novo, e o script também confere que `.cg-app` declara `color-scheme: light` e que o shell força `data-theme="light"`.
- **Pares declarados no CSS.** Toda regra de `_caregiver.scss` e dos estilos de componente do aplicativo que declara `color` e `background` juntos (34 regras que dão para resolver) precisa de 4,5:1.
- **Alvos de 48 px.** Os tokens `--cg-target` (48), `--cg-target-lg` (56), `--cg-row-h` (64), `--cg-nav-h` (64), `--control-h` e `--control-h-sm` (48), e a altura (e a largura, quando declarada) de 16 controles do kit no CSS: marca e Entrar do cabeçalho, Ajuda agora, link do aviso de protótipo, item da barra, `.btn`, botão de texto, item de lista, linha de escolha, chave, opção de humor, nota de 1 a 5, tamanho da letra, **Dei** e cartão que é link. Também varre o CSS de componente das telas atrás de controle (botão, chip, aba, hora) com altura menor que 48 px.

Resultado: **nenhum token precisou mudar**. Os números batem com os do UX (texto 11,9:1 sobre o fundo, apoio 8,3:1, título 9,1:1, botão 7,3:1). O mais baixo é o ícone "passou do horário" sobre o fundo âmbar (3,5:1, mínimo 3). O dourado da linha (2,98:1) é só decoração (UX A.1.4) e não é conferido; o script só avisa. Dois achados de CSS, corrigidos: a caixa de horário de Remédios declarava `color: #fff` fora do estado marcado (branco sobre branco quando desmarcada; o ícone só existe marcado, mas o par estava errado), e a linha de 3 px da aba atual de Rotina é um pseudo-elemento, não um alvo (o script os ignora). Teste negativo: com `--cg-text-soft` claro e `--cg-target` em 40 px o script falha com 14 itens e a lista deles.

## 6. Produção e GitHub Pages

- **`/cuidador/_kit` só em desenvolvimento.** A rota agora é criada por `createCaregiverRoutes(devMode)` (como `createRoutes` da equipe) e a definição da rota e o `import()` da página do kit ficam atrás de `ngDevMode`, que o Angular troca por falso no build de produção. Resultado verificado no pacote: o texto "Kit do cuidador" e o componente do kit **não existem** em `dist`. (Antes, a rota não era registrada em produção, mas o pedaço do kit seguia no pacote.) Teste novo em `routing.spec.ts`: em produção a lista de rotas não tem `_kit`; em desenvolvimento tem. Observação: a rota `/app/_kit` da equipe (`features/kit`) tem o mesmo desenho antigo (rota não registrada, mas o pedaço de 38 kB segue no pacote); não foi mexido por ser da equipe, e a mudança é a mesma de 3 linhas se o líder quiser.
- **Caminhos.** Nenhum `href`, `src` nem `navigateByUrl` do aplicativo usa caminho absoluto fora do roteador: links são `routerLink`, os ícones vêm de `icons/sprite.svg` (relativo ao `<base href>`) e o CSS referencia `./media/...`. O único `href="#..."` é o link "Ir para o conteúdo", que tem `preventDefault` e foca o `main` (não navega).
- **Build com `--base-href`.** `MSYS_NO_PATHCONV=1 pnpm exec ng build --base-href=/nexus-erp/ --output-path=dist/check` compila sem erro nem aviso; o `index.html` sai com `<base href="/nexus-erp/">`, sem nenhum recurso absoluto. `dist/check` foi apagado depois.

## 7. README

`README.md` ganhou a seção "Aplicativo do cuidador" (o que é, como entrar, as 11 pessoas com plano e uma frase, as 5 abas e as 22 telas, o que acontece na equipe quando o cuidador age), a linha de `check:a11y` e de publicação com `--base-href`, as linhas dos docs 09 a 12 e de `ac-status/caregiver-*` na tabela de documentação, os "Limites do protótipo" (o aplicativo do cuidador existe, só roda no navegador) e a contagem de testes.

## 8. Números finais

- `pnpm exec ng test --watch=false`: **144 arquivos e 1882 testes verdes** (eram 143 e 1869: +13 testes, +1 arquivo, entre os testes novos da integração e os ajustes das contagens do seed).
- `pnpm run typecheck`, `node scripts/check-core.mjs` e `pnpm run check:a11y`: limpos.
- `pnpm exec ng build` e o build com `--base-href=/nexus-erp/`: limpos.
- Sem servidor, sem navegador e sem commit.

## 9. O que não foi feito, e decisões para o líder

- Nada visual foi conferido em navegador (regra de RAM): as mudanças de CSS desta integração (`.cg-muted`, `.cg-meta`, `.cg-tag`, `.cg-tags`, `.cg-plain-list`, `.cg-stack--tight` no lugar de regras locais iguais; variante grande do **Dei**; o "Voltar" novo nas telas de segundo nível) valem uma olhada em 360 px e nas três letras.
- O "Voltar" do cabeçalho nas telas de segundo nível de Cuidar de mim e de Mais é uma decisão de consistência (Rede já tinha): o UX só pede "Voltar" em subtelas e não classifica essas. Se o líder preferir sem, é remover `backLink` e `backLabel` em 9 telas.
- O "Fechar" virou "Voltar" nas folhas informativas (Ajuda agora, Lado a lado, Como falar com a gente): o UX A.2.17 manda "Voltar".
- O estilo de importação segue misto (P1 usa caminhos relativos, P2 e P3 usam `@core/...`).
- `/app/_kit` da equipe ainda entra no pacote de produção (seção 6).
