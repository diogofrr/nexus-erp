# 17. Vida visual, onda V1 (sistema e telas do dia a dia)

O dono viu o aplicativo publicado e disse: "ficou bom, mas a UI está bonita e pobre, sem vida e sem elementos". Antes, ele já tinha pedido: "tem MUITA informação, essa plataforma é para o CLIENTE". Esta onda dá vida **sem acrescentar uma palavra de informação nem um cartão novo**: cor, desenho, hierarquia e movimento suave. Cada tela continua com uma ação principal. O kit (como usar cada peça) está em `docs/17-vida-kit.md`; este arquivo conta o que mudou em cada tela, as decisões e o que ficou de fora.

## 1. O sistema
- **Cor de acento por seção**: Hoje azul-céu, Rotina verde-sálvia, Cuidar de mim areia dourada, Rede azul profundo, Mais neutro. São tintas derivadas da marca (`--cg-sec-*` em `_caregiver.scss`), com quatro papéis: fundo muito claro do cartão, fundo do emblema e do herói, tinta do texto e do ícone, e cor cheia (anel). O shell marca `data-section` na raiz conforme o endereço, e tudo dentro herda `--cg-acc-*`. Todos os pares estão em `scripts/check-caregiver-a11y.mjs` (4,5:1 para texto, 3:1 para ícone e anel) e `pnpm run check:a11y` passa.
- **Ilustrações** (`app-cg-illustration`): 13 desenhos em SVG inline, traço único e arredondado em azul e dourado, no desenho do símbolo da marca (dia, remédios, calendário, conversa, grupo, rede, cartão, ajuda, privacidade, vazio, boas-vindas, livro, coração). Três tons: marca, acento da seção e claro (para o azul da Entrada). Sempre `aria-hidden`.
- **Peças novas**: `app-cg-hero`, `app-cg-icon-badge`, `app-cg-progress-ring`, `app-cg-empty`, `app-cg-seal`; `app-cg-card` ganhou emblema, `layout="tile"` e `illustration`.
- **Profundidade e ritmo**: raios de 20 px nos cartões e 24 px nos heróis, sombras em camadas azuladas (`--cg-shadow-1/2/3`), fio da cor da seção na base do cabeçalho, véu da tinta da seção nos cartões com ícone.
- **Largura**: em 1280 px ou mais a coluna abre para 72 rem (`--cg-col-wide`). Hoje e Remédios viram duas colunas, Cuidar de mim fica 2 x 2 com o desenho maior, a Rede fica em 3, Ajuda agora fica em 3 caminhos lado a lado, Mais ganha a coluna do tamanho da letra, e a Entrada ganha o painel azul com a ilustração grande (e as pessoas de exemplo em duas colunas de 1440 px em diante).
- **Movimento** (200 a 350 ms): cada bloco da tela sobe e aparece em cascata (50 ms entre eles, até o 8º), o anel de progresso enche em 900 ms, o check de "Dei" se desenha e o emblema "pula", cartões e botões encolhem ao toque, a carinha do humor cresce ao escolher. **Tudo é desligado por `prefers-reduced-motion`** (um bloco no fim de `_vida.scss`) e **Ajuda agora fica parada** (`cg-still`): "sem animação" é regra dela.

## 2. O que mudou por tela

| Tela | Antes | Agora |
|---|---|---|
| **Entrada** (`/login`) | Painel azul liso com mãos quase invisíveis; cartões das pessoas com avatar cinza | Painel azul com gradiente e o símbolo grande com o sol (ilustração `welcome`) e o lema; no celular a faixa ganha um desenho pequeno; o painel acompanha a rolagem; avatares coloridos e suaves (5 cores, sempre a mesma por pessoa); fio azul e dourado no cartão da porta; pessoas entram em cascata |
| **Cabeçalho e navegação** | Linha dourada e ícone cinza | Fio da cor da seção na base; cada destino com a cor da sua seção (a atual vira pílula tintada em tela larga e ícone cheio na barra de baixo); "Ajuda agora" com o ícone da boia em círculo azul cheio e contorno arredondado (sem piscar, sem vermelho) |
| **Hoje** | Título, notas, cartão simples, lista, "2 de 4 dados" em texto | Herói azul-céu com o sol nascente; **hora do próximo compromisso grande em serifa**; remédios na tinta sálvia com **anel "2 de 4"** no lugar do texto; humor com carinhas coloridas num painel na areia; "Para você" com emblema; fechamento com a ilustração de conversa |
| **Rotina** | Abas com linha dourada, calendário branco | Herói compacto verde-sálvia com calendário ou remédios desenhados; abas em pista arredondada com ícones; calendário com cabeçalho serifado na tinta, dia de hoje e dia escolhido na cor da seção; Remédios com anel de progresso e **duas colunas em tela larga**; estados vazios com desenho |
| **Cuidar de mim (porta)** | 4 cartões brancos com ícone pequeno | Herói na areia dourada com o coração; 4 ladrilhos com desenho próprio (conversa, coração, grupo, livro), título serifado e seta em círculo |
| **Rede (porta)** | 3 cartões brancos | Herói azul profundo; 3 ladrilhos com desenho (pessoas, calendário, cartão) |
| **Buscar** | 10 botões azuis iguais | 10 **ladrilhos com ícone e cor** agrupados por tema (saúde na sálvia, cuidado em casa na areia, mente e alimentação no azul-céu, direito e serviços no azul profundo), escolhido enche com a cor cheia; resultados com o ícone da necessidade |
| **Mais (porta)** | Nome, plano e lista de ícones azuis | Herói neutro com avatar de iniciais, nome e plano; cada linha com o emblema na cor da sua seção; tamanho da letra num painel à direita em tela larga |
| **Ajuda agora** | Blocos empilhados, número em sans | Herói com a boia; emergência em azul escuro com emblema e número em serifa grande; os 3 caminhos lado a lado em tela larga. Continua sem vermelho, sem sirene e sem animação |

Nenhuma frase foi acrescentada. As que mudaram de lugar: o "2 de 4 dados" virou o anel (o nome acessível continua "2 de 4 dados"); "Hoje às 16:00" virou "Hoje" e "16:00" em destaque; o vazio de Hoje separou título e frase.

## 3. Decisões
- **Vida sem peso.** Cada seção tem uma cor, não várias; o desenho é decorativo e some com a letra Bem grande no celular; ladrilhos e heróis trocam texto por desenho, não somam texto.
- **Acento herdado, não passado.** O shell diz a seção, os componentes herdam. Isso fez as telas do V2 ganharem a tinta delas sem mudar uma linha (cartões com ícone, linhas de lista, avatares).
- **Sem vermelho e sem laranja forte.** O humor usa cinco cores suaves de frias a quentes (azul acinzentado, azul, areia, sálvia, verde) e nenhuma diz "bom" ou "ruim"; o rótulo é a informação.
- **Hero com a classe antiga.** A frase de apoio do herói leva também `cg-page-header__desc` e a volta leva `cg-page-header__back`, então testes e telas que usam essas classes continuam valendo quando trocam `app-cg-page-header` por `app-cg-hero`.
- **Ícone no cartão fora do título.** O emblema agora é irmão do título, e `.cg-card__title` fica só com o texto (os testes que leem o título não mudaram).
- **Entrada fora do `.cg-app`.** As tintas vivem em `:root`, e a Entrada força o acento com `.cg-sec--*`.
- **Parciais conferidos.** O script de acessibilidade passou a ler `src/styles/caregiver/*.scss` (pares de cor e alvos de 48 px) e tem pares novos por seção, por humor e para o selo dourado.
- **Humor em 5 colunas no celular.** O limite de largura do contêiner baixou de 328 para 312 px, porque o painel de Hoje come uns 30 px.

## 4. Testes e medidas
- `src/app/features/caregiver-app/ui/vida.spec.ts` (26 testes): cada ilustração (SVG, `aria-hidden` no hospedeiro e em todos os `svg`, formas), tamanho e tom, emblema (tamanho, cheio, seção), anel (nome acessível, deslocamento do traço, fechado e máximo zero), herói (um `h1`, frase, volta, compacto), vazio (classes de sempre, `headingLevel="2"`), selo, cartão (emblema, ladrilho, desenho), humor e dose (check desenhado só quando acaba de marcar), `sectionOfUrl`, o shell trocando `data-section` ao navegar, e as telas (Hoje, portas, Ajuda agora parada, Mais, Buscar, Rotina, Entrada).
- Números no fim da onda (6/11): suíte inteira com 2255 testes verdes (eram 2209), `pnpm run typecheck`, `node scripts/check-core.mjs` e `pnpm run check:a11y` (257 conferências) passam, `ng build` sem aviso e com o pacote inicial em 661,2 kB (limite de 700 kB; o CSS global ficou em 167 kB, 24,8 kB comprimido).
- Arquivos que mexi fora das minhas pastas, por necessidade do kit: `tools/build-icons.mjs` e `shared/ui/display/icon.component.ts` (15 ícones novos no sprite), `src/styles.scss` (registra o parcial `caregiver/_vida.scss`), `scripts/check-caregiver-a11y.mjs` (pares novos e parciais) e `docs/17-vida-kit.md`.
- Testes antigos ajustados por mudança de marcação: Hoje (o anel no lugar do texto, a hora em destaque, o vazio com título e frase) e Rotina (o anel).

## 5. O que ficou de fora
- **Dark mode**: o aplicativo do cuidador é só claro (S-01).
- **Ilustração animada contínua** (o sol girando, a boia balançando): movimento contínuo cansa e gasta bateria; só há entrada.
- **Fotos e ilustrações coloridas completas**: o sistema é de traço único, como pede o símbolo.
- **Telas do V2** (`plan`, `card`, `groups`, `content`, `my-wellbeing`, `privacy`, `family`, `start`, o resto de `care` e de `network`, e o resto de `help`): herdam o acento, o cartão com emblema e as linhas de lista, e usam o kit quando quiserem mais.
- **Linha de compromisso com hora em serifa na Agenda**: o `app-cg-row` recebe o título como texto; trocar pede uma peça nova.
- **Cabeçalho do site da equipe**: fora do escopo.
