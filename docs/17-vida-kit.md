# 17. Kit de vida visual do aplicativo do cuidador

Para quem monta telas do aplicativo (o V2 e quem vier depois). O dono viu o app e disse: "a UI está bonita mas pobre, sem vida e sem elementos". O dono também pediu: "tem MUITA informação, essa plataforma é para o CLIENTE". Os dois valem juntos:

> **Vida é cor, desenho, hierarquia e movimento suave. NÃO é mais texto, mais cartões nem mais números.** Cada tela continua com uma ação principal. Nada de alarme em tema de saúde emocional: sem vermelho, sem laranja forte.

Tudo é standalone, OnPush, signals; importe de `features/caregiver-app/ui` (`import { CgHeroComponent } from '../../ui';`). Estilos: `src/styles/_caregiver.scss` (tokens e componentes antigos) e `src/styles/caregiver/_vida.scss` (o que é novo). Conferência de contraste e alvos: `pnpm run check:a11y` (agora cobre as tintas por seção, o humor e os parciais).

## 1. Cor de acento por seção (a ideia central)

Cada seção tem uma tinta calma, derivada da marca:

| Seção (`accent`) | Cor | Onde |
|---|---|---|
| `hoje` | azul-céu | Hoje |
| `rotina` | verde-sálvia suave | Rotina (agenda e remédios) |
| `cuidar` | areia dourada | Cuidar de mim (atendimento, grupos, conteúdos, como estou) |
| `rede` | azul profundo | Rede (buscar, pedidos, cartão) |
| `mais` | neutro | Mais (plano, ajuda, família, privacidade, perfil) |

O shell marca `data-section` na raiz do aplicativo conforme o endereço. **Tudo o que está dentro herda o acento sozinho**: o emblema de ícone, o cartão, o herói, o anel, o estado vazio, o selo, a linha de `cg-row`, o fundo do avatar. Você NÃO precisa passar `accent`: ele só serve para forçar outra seção (um bloco de uma seção dentro de outra) ou fora do shell (a Entrada).

Variáveis (em `:root`, vale em qualquer lugar): `--cg-acc-tint` (fundo muito claro do cartão), `--cg-acc-strong` (fundo do emblema, faixa, herói), `--cg-acc-ink` (texto e ícone sobre os dois), `--cg-acc-solid` (anel e marca cheia). Para tintar algo à mão: `background: var(--cg-acc-tint); color: var(--cg-acc-ink);`. Classe que força: `.cg-sec--hoje`, `--rotina`, `--cuidar`, `--rede`, `--mais`. Todos os pares passam 4,5:1 (texto) ou 3:1 (ícone, anel); se mexer em uma cor, rode `pnpm run check:a11y`.

Outras variáveis novas: `--cg-shadow-1/2/3` (sombras em camadas, azuladas), `--cg-radius-card` agora é 20 px, `--cg-mood-1..5-tint/ink` (cores do humor). Em tela de 1280 px ou mais a coluna abre para 72 rem (`--cg-col-wide`): use `cg-tiles`, duas colunas e ilustração em vez de deixar vazio.

## 2. Componentes

### `app-cg-hero`: o cabeçalho da página com vida
Troca `app-cg-page-header` quando a tela merece calor. Mesmo `h1` serifado (o shell leva o foco a ele), mesma volta (`backLink`, `backLabel`).

| Entrada | Tipo | Padrão |
|---|---|---|
| `title` | texto (obrigatório) | |
| `description` | texto | |
| `illustration` | nome de ilustração | sem desenho |
| `accent` | seção | a da seção corrente |
| `backLink`, `backLabel` | rota, nome | |

```html
<app-cg-hero title="Cuidar de mim" description="Um tempo para você, no seu ritmo." illustration="heart" />
<app-cg-hero [title]="greeting()" [description]="date()" illustration="day"><button class="btn">Algo</button></app-cg-hero>
```
O conteúdo projetado entra sob a frase. Em 768 px ou mais o desenho vira uma coluna à direita; no celular fica no canto; com a letra Bem grande no celular ele some. **Sem `description` o herói é compacto** (menos altura): bom para telas que têm abas ou lista logo abaixo (Rotina, Buscar). A frase de apoio leva também a classe `cg-page-header__desc` e a volta leva `cg-page-header__back`: trocar `app-cg-page-header` por `app-cg-hero` não quebra os testes que usam essas classes (`main h1` também continua).

Qual desenho usar (sugestão): Cuidar de mim, `heart` ou `chat`; Rede, `network`; Mais e privacidade, `privacy` ou `welcome`; Cartão, `card`; Grupos, `group`; Conteúdos, `book`; Atendimento, `chat`; Plano, `card` ou `heart`.

### `app-cg-illustration`: o sistema de ilustração
SVG inline, `aria-hidden`, traço único arredondado em azul e dourado, no desenho do símbolo da marca (as mãos que sustentam). **Nunca carrega informação**: o texto ao lado diz tudo.

| Entrada | Valores |
|---|---|
| `name` (obrigatório) | `day` (mãos e sol nascente), `medicine` (comprimido e copo), `calendar`, `chat` (dois balões), `group` (três pessoas), `network` (aperto de mãos), `card`, `help` (boia), `privacy` (cadeado e mãos), `empty` (mãos abertas), `welcome` (o símbolo da marca com o sol), `book`, `heart` |
| `size` | `sm` 4 rem, `md` 6,5 rem (padrão), `lg` 9,5 rem, `xl` 15 rem, `fill` (largura do pai) |
| `tone` | `brand` (azul e dourado), `accent` (a tinta da seção), `light` (para fundo azul escuro) |

```html
<app-cg-illustration name="chat" size="lg" tone="accent" />
```
Precisa de um desenho que não existe? Peça no fim deste arquivo (seção "Pedidos do V2"): é um `@case` novo em `cg-illustration.component.ts`, 120 x 96, traço de 2,4.

### `app-cg-icon-badge`: o emblema redondo de ícone
Dá cor e peso a uma linha sem acrescentar texto. Decorativo.

| Entrada | Valores |
|---|---|
| `icon` (obrigatório) | qualquer nome do sprite (`IconName`) |
| `size` | `sm` 2 rem, `md` 2,75 rem (padrão), `lg` 3,5 rem, `xl` 4,5 rem |
| `accent` | seção (padrão: a corrente) |
| `solid` | fundo cheio, ícone branco |

```html
<app-cg-icon-badge icon="pill" /> <app-cg-icon-badge icon="handshake" size="lg" solid />
```
`app-cg-card` (com `icon`) e `app-cg-row` (com `icon`) já o usam; só chame direto para montar blocos próprios.

### `app-cg-progress-ring`: o anel de progresso
"2 de 4 remédios dados" sem escrever. Enche em 700 ms ao aparecer, vira verde quando fecha. Tem nome acessível ("2 de 4 dados").

| Entrada | Valores |
|---|---|
| `value`, `max` (obrigatórios) | números; com `max` 0 não desenhe |
| `label` | o que se conta, para o leitor de tela ("dados") |
| `size` | `sm` 3,5 rem, `md` 4,75 rem, `lg` 6,5 rem (padrão) |
| `accent` | seção |

```html
@if (progress().total > 0) { <app-cg-progress-ring [value]="progress().given" [max]="progress().total" size="md" label="dados" /> }
```
O centro mostra o número em serifa e "de N"; projete conteúdo próprio para trocar.

### `app-cg-empty`: estado vazio com desenho
Uma ilustração, título serifado, UMA frase, uma ação opcional. Usa as classes `empty__title` e `empty__text` (testes que as procuram continuam valendo). Troque `app-empty-state` por ele nas telas do aplicativo.

| Entrada | Valores |
|---|---|
| `title` (obrigatório), `text` | textos |
| `illustration` | padrão `empty` |
| `headingLevel` | 3 (padrão) ou 2 (quando é o primeiro bloco depois do `h1`) |
| `accent` | seção |

```html
<app-cg-empty illustration="medicine" title="Você ainda não cadastrou remédios" text="Cadastre e o app mostra os horários."><button class="btn btn--primary">Cadastrar</button></app-cg-empty>
```

### `app-cg-seal`: selo e etiqueta
Pílula com forma e cor (nunca só cor). `tone`: `accent` (padrão), `ok`, `care`, `gold`, `neutral`; `icon` opcional.
```html
<app-cg-seal tone="ok" icon="circle-check">Dado às 08:12</app-cg-seal>
```

### `app-cg-card` (ganhou vida)
Compatível com o que existia. Novo: com `icon` o cartão ganha emblema, um véu da tinta da seção e um fio no alto. `layout="tile"` põe o emblema em cima e o título serifado (as portas de seção); `illustration` solta um desenho no canto do ladrilho (e esconde o emblema); `accent` força a seção. Link inteiro continua um único `<a>`; a seta é um círculo na tinta da seção.
```html
<ul class="cg-tiles cg-tiles--3"><li><app-cg-card layout="tile" illustration="chat" title="Conversar" link="/cuidador/..." >Uma frase.</app-cg-card></li></ul>
```
Grade das portas: `.cg-tiles` (1 coluna no celular, 2 de 768 px, desenho de 7,5 rem em 2 x 2), `.cg-tiles--3` (3 de 1024 px, desenho menor), `.cg-tiles--4` (4 de 1280 px, desenho menor). A largura do desenho vem da variável `--tile-art` da grade; o título dá a volta nele e o texto começa abaixo. Cartões da mesma linha com alturas iguais: ponha `cg-equal` na grade (o `cg-tiles` já faz).

### Outros ganhos que chegam sozinhos
- `app-cg-dose`: emblema na tinta da seção; ao marcar "Dei", o emblema vira um check verde que se desenha (só quando a pessoa marca, nunca ao abrir a tela).
- `app-cg-mood`: cada carinha tem cor suave própria (frias para quentes, sem vermelho), cresce ao escolher.
- `app-cg-row` e `app-cg-contact`: ícone na tinta da seção; fundo suave ao passar o mouse.
- `app-cg-nav`: cada destino com a cor da sua seção; em 1024 px ou mais, o item atual é uma pílula tintada.
- Cabeçalho: fio da cor da seção na base; botão "Ajuda agora" com o ícone da boia em círculo azul.

## 3. Movimento

- **Entrada das telas, sem fazer nada:** cada filho direto do componente da página sobe e aparece (320 ms, escalonado em 50 ms). Para uma lista, ponha `cg-enter` no pai. Para uma tela que NÃO deve se mover (Ajuda agora), ponha `class: 'cg-still'` no `host` da página.
- Estado de pressionar: cartão e botão de link encolhem 1,5% ao toque.
- Tudo é zerado por `prefers-reduced-motion` (um bloco no fim de `_vida.scss`). Não escreva animação fora dele: se criar uma nova, ela já entra nesse bloco por estar dentro de `.cg-app`.
- Keyframes disponíveis: `cg-rise`, `cg-fade`, `cg-pop`, `cg-draw`, `cg-glow`, `cg-ring-fill`.

## 4. Utilitários
- `.cg-bignum` / `.cg-bignum--sm`: número ou hora em serifa na tinta da seção (destaque calmo).
- `.cg-section-head`: linha com o título à esquerda e um detalhe (anel, selo) à direita.
- `.cg-tiles`, `.cg-tiles--3`, `.cg-tiles--4`: grade das portas. `.cg-equal`: filhos `app-cg-card` com a mesma altura.
- `.cg-panel`: o cartão branco simples que agrupa um bloco (painel do tamanho da letra em Mais).
- `.cg-who` e `.cg-who__avatar`: quem é a pessoa (avatar de iniciais em serifa, nome e plano), usado no herói de Mais.
- `.cg-still` (no `host` da página): sem a entrada em cascata (Ajuda agora).
- Humor: `app-cg-mood` fica em 5 colunas com letra Normal e contêiner de 312 px ou mais (era 328).

## 5. Ícones novos no sprite
`sunrise`, `sparkles`, `sprout`, `heart`, `syringe`, `brain`, `apple`, `accessibility`, `leaf`, `house-heart`, `heart-plus`, `phone-call`, `ambulance`, `calendar-check`, `hand-helping`. Para mais: acrescente o nome em **dois** lugares (`tools/build-icons.mjs` e `ICON_NAMES` em `shared/ui/display/icon.component.ts`) e rode `node tools/build-icons.mjs`. Se o V2 e o V1 editarem a lista ao mesmo tempo, mantenha as duas linhas de cada um.

## 6. Regras que não mudam
Textos em pt-BR, sem travessão, sem "!", sem emoji (ícone e ilustração SVG sim). Alvo de toque de 48 px. Foco visível. Ilustração é sempre decorativa. Tema claro só. Vermelho só em erro de formulário e falha do sistema.

## Pedidos do V2
(Escreva aqui o que precisar do kit: novo desenho, nova variante, ajuste. O V1 atende.)

1. **Cores dos planos no kit.** Meu plano e o Cartão Nexus usam as quatro cores dos planos (Livre cinza-azulado, Essencial azul claro, Cuida azul médio, Sustenta dourado) com o texto certo sobre cada uma (escuro no Livre, no Essencial e no Sustenta; claro no Cuida; todos passam 4,5:1). Hoje o V2 repete 5 linhas de CSS (`--tone`, `--tone-on`, `--tone-soft`, `--tone-text`, `--tone-line`, `--tone-2`) em `plan/pages/plan.page.ts` e em `card/pages/card.page.ts`. Se der, um conjunto de classes `.cg-tone--livre|essencial|cuida|sustenta` em `_vida.scss` com essas variáveis (os pares já estão conferidos em `scripts/check-caregiver-a11y.mjs`, seção "Meu plano"). Daria para o "Meu plano" da porta Mais e o Hoje usarem a mesma cor sem copiar.
2. **Avatar do profissional e estrelas.** O V2 criou `network/ui/provider-avatar.component.ts` (`app-cg-provider-avatar`: iniciais num círculo, 4 tintas calmas, sempre a mesma cor para o mesmo nome; tamanhos `md`, `lg`, `xl`) e `network/ui/stars.component.ts` (`app-cg-stars [value]`: 5 estrelas decorativas, o texto da nota vem ao lado). Estão na ficha do profissional e em Meus pedidos. **A tela Buscar é do V1:** use os dois nos resultados para a lista e a ficha ficarem iguais. Se preferir, promova os dois para `ui/` (os testes estão em `network/ui/provider-avatar.spec.ts`).
3. **Herói compacto nos passos.** Em "Conversar com um psicólogo" o herói grande some nos passos (formato e horário) e entra um `app-cg-page-header` simples, para o "Voltar" do passo não competir com o "Voltar" do herói. Um `compact` no `app-cg-hero` (sem desenho, sem descrição, sem `backLink`) tiraria essa troca do V2.
4. **Linha do tempo de Como estou.** O V2 acrescentou, só na página, uma trilha de pontos (um por conversa, na rampa de azul) acima do `app-cg-trend`. Se o `cg-trend` ganhar uma variante com a trilha dentro, dá para apagar o CSS local (`.well__path`, `.well__dot`).
5. **`cg-row` com avatar.** Em Meus pedidos a linha é um `button.cg-row` à mão porque o emblema precisa ser o avatar do profissional, não um ícone. Uma entrada `[cgRowLead]` no `app-cg-row` evitaria isso.

### Respostas do V1 (6/11)
1. **Feito e unificado.** `.cg-tone--livre|essencial|cuida|sustenta` em `_vida.scss`, com as mesmas variáveis que o V2 já usava (`--tone`, `--tone-line`, `--tone-2`, `--tone-on`, `--tone-soft`, `--tone-text`). Apaguei as 3 cópias do CSS local (`plan.page.ts`, `plan-board.component.ts`, `card.page.ts`) e troquei `nx-tone nx-tone--X` por `cg-tone--X` nas telas e nos testes (`plan.spec.ts`, `card.spec.ts`). Qualquer tela (Mais, Hoje) pode usar sem copiar.
2. **Feito em Buscar.** Os resultados usam `app-cg-provider-avatar` (no lugar do ícone da necessidade, que já está no ladrilho) e `app-cg-stars` na linha da nota. Os dois continuam em `network/ui/` (não promovi para `ui/`).
3. **Feito.** `app-cg-hero` ganhou `compact` (booleano, força o herói baixo mesmo com frase). Sem `description` ele já é compacto sozinho. Para o passo ter só o "Voltar" do passo, use `<app-cg-hero title="..." compact />` sem `backLink`.
4. **Feito e unificado.** `<app-cg-trend [items]="visible()" trail />` desenha a trilha (um ponto por conversa, do mais antigo ao mais novo, até 6, só com 2 ou mais; `aria-hidden`, sem número; a última leva o anel). Classes `cg-trend__trail` e `cg-trend__trail-dot`, em `_caregiver.scss`. Em `my-wellbeing.page.ts` apaguei o CSS e o markup locais (`.well__path`, `.well__dot`, `well-in`) e o teste passou a ler as classes novas; o movimento entra no bloco de `prefers-reduced-motion`.
5. **Feito.** `[cgRowLead]` no `app-cg-row`: o que você projetar com esse atributo aparece no lugar do emblema de ícone (use um OU o outro), e a linha continua um único `<a>` ou `<button>`.
