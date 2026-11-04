# DESIGN.md: Nexus ERP

Resumo do sistema visual. Detalhe completo, anatomia e HTML de cada componente: `docs/03-design-system.md`. Exemplos vivos com todos os estados e tema escuro: `docs/styleguide.html` (regenerar com `node tools/build-styleguide.mjs`).

## Tese
Uma superfície que sustenta: fundo off-white quente, cartões brancos de borda fina, navegação em pilar de azul institucional escuro com o símbolo dourado, e um único ornamento, a **linha dourada fina** (a base do símbolo) que sublinha o título de página e marca a aba ou o item atual.

## Cor (`src/styles/_tokens.scss`)
| Papel | Token | Valor |
|---|---|---|
| Fundo do app | `--canvas` | `#F7F5F0` |
| Superfície | `--surface` | `#FFFFFF` |
| Menu lateral | `--nav-bg` | `#133350` (azul 900) |
| Título | `--text-heading` | `#1B4669` (azul 800) |
| Ação e link | `--brand` | `#2D6EA3` (azul 600, plano Cuida) |
| Linha e destaque | `--accent` | `#A67F15` (dourado 600); a cor da marca `#B8901F` só em decoração |
| Texto | `--text-strong` / `--text` / `--text-muted` | `#17202A` / `#28323D` / `#5A6673` |
| Planos | `--plan-*` | Livre `#7B8794`, Essencial `#4A90C8`, Cuida `#2D6EA3`, Sustenta dourado |
| Zarit | `--zarit-1..4` | verde, azul, âmbar, vermelho, sempre com ícone (círculo, círculo, triângulo, octógono) e rótulo |

Semânticas (sucesso, atenção, perigo, informação) têm `fg`, `icon`, `bg`, `border`. O dourado da marca nunca sinaliza estado. Tema escuro opcional por `data-theme="dark"` (só troca tokens). Componentes usam apenas tokens semânticos, nunca hex.

## Tipografia
DM Serif Display (400) em `h1`, `h2`, display; Figtree Variable em todo o resto, com algarismos tabulares. Escala fixa: 12, 14, 16, 18, 20, 24, 32, 40 px. Corpo 16/1,55; interface 14; legenda 12. Fontes locais (`@fontsource`), subconjunto latino.

## Espaço, raios, sombra, movimento
Grade de 8 px (`--space-2` = 8 px; passos ímpares só dentro de componente). Raios 4, 8, 12, 16, 24 px e pílula. Separação por borda de 1 px; sombras de 4 níveis, sempre com deslocamento e desfoque. Movimento de 120, 200 e 320 ms, saída exponencial, zerado com `prefers-reduced-motion`.

## Layout e responsivo
Menu lateral de 264 px a partir de 1280 px, trilho de 72 px de 1024 a 1279 px, gaveta abaixo de 1024 px; portal mobile first com barra inferior (até 1023 px). Alvos de teste: 360, 768, 1024, 1440 px. Controles de 44 px (32 px com mouse na densidade compacta).

## Componentes (classes CSS, `src/styles/components/`)
Shell (`app-shell`, `sidebar`, `topbar`, `portal-shell`, `bottom-nav`, `login`), `page-header`, `btn`, `field` / `input` / `select` / `check` / `switch` / `likert` / `rating` / `masked` / `code-chip`, `table` (ordenação, seleção, densidade, cartões no celular), `badge` (status, plano, Zarit), `chip`, `avatar`, `card`, `kpi-strip`, `plan-card`, `tabs`, `segmented`, `menu`, `popover`, `cmdk`, `banner` (protótipo, consentimento LGPD), `toast`, `dialog` / `drawer`, `empty`, `skeleton`, `deadline`, `stepper` / `wizard` / `item-map`, `timeline`, `kanban`, `agenda`, `checklist`, `list-row`, gráficos em SVG (`chart`, `donut`, `spark`, `progress`, `meter`, `occ`, `thermo`, `heat`).

## Marca (`public/brand/`)
`nexus-symbol.svg` (traço fino) e `nexus-symbol-bold.svg` (até 64 px), `nexus-wordmark.svg`, `nexus-logo.svg`, `favicon.svg`. Redesenhados em SVG limpo a partir do logo; `currentColor` com dourado `#B8901F` por padrão. Ícones: Lucide em sprite local `public/icons/sprite.svg`.

## Regras rápidas
- Um `h1` por tela; um botão primário por bloco; rótulo de botão é verbo.
- Erro: logo abaixo do campo, com ícone e texto, mesma frase no resumo do topo; nunca limpar o digitado.
- Estado vazio sempre acolhedor, com ação sugerida; carregamento é esqueleto, não spinner.
- Ação destrutiva descreve o efeito (será eliminado, ficará bloqueado, continua registrado).
- Alerta vermelho: sério, sem alarmismo (ver `docs/03-design-system.md`, 7.3).
