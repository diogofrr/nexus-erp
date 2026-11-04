# Nexus ERP: sistema de design

Documento da UI. Código: `src/styles/` (tokens, reset, tipografia, layout, componentes, utilitários) e `src/styles.scss`. Exemplos vivos, com todos os estados e o tema escuro: `docs/styleguide.html` (arquivo único, abre direto no navegador; regenerar com `node tools/build-styleguide.mjs`). Marca: `public/brand/`. Ícones: `public/icons/sprite.svg`. Resumos: `PRODUCT.md` e `DESIGN.md` na raiz.

Alinhado ao `docs/04-ux.md` (padrões PD-01 a PD-17, menu, microcopy, atalhos): ver a seção 10. Convenções: textos de interface em pt-BR; identificadores de código em inglês; nenhum travessão; dinheiro `R$ 1.234,56`, data `04/11/2026`, hora `23:59`, percentual `86,3%`.

---

## 1. Conceito e tese visual

**Conceito: uma superfície que sustenta.** O símbolo da Nexus são duas mãos abertas sustentando três pessoas: sustentação, não controle. A interface faz o mesmo com quem trabalha nela. A equipe passa horas lendo tabelas, agendas e casos delicados (cuidadores no limite, prazo de contato no mesmo dia), então o sistema é calmo, legível e sem alarme: o trabalho acontece sobre um fundo off-white quente, em cartões brancos de borda fina; a navegação é um pilar de azul institucional escuro onde o símbolo dourado repousa; e o único ornamento é a **linha dourada fina**, o mesmo traço que fecha a base do símbolo, que sublinha o título da página e marca a aba ou o item atual. O azul manda (títulos, ação, seleção), o dourado pontua (linha, destaque, plano Sustenta), a serifa dá peso aos títulos (DM Serif Display, a face da Figura 1) e todo o resto é Figtree pequena, com números tabulares. Estado nunca depende de cor: tem ícone, rótulo e posição. O vermelho do Zarit é firme e silencioso: ícone, texto claro, prazo e uma ação, sem piscar, sem exclamação, sem tela inteira vermelha.

**Cena de uso** (decide claro ou escuro): equipe de Uberlândia em escritório e coworking, luz do dia, monitor, oito horas por dia, psicólogos entre sessões, atendimento com fila de mensagens. Claro é o padrão. O escuro é opcional, para fim de expediente.

**Modo e estratégia de cor.** Operate (o usuário está em tarefa). Estratégia Restrita: neutros quentes mais um acento (azul); o dourado entra só em detalhe; as semânticas só em estado.

**Contra o genérico.** Evitado de propósito: gradiente roxo, grade de cartões iguais com ícone em quadrado colorido, vidro borrado, número gigante com acento, sombra dura. Escolhas com ponto de vista: pilar azul com símbolo dourado, linha dourada como assinatura, KPIs em uma faixa única com divisórias (não quatro cartões soltos), tabela como componente principal, termômetro do Zarit com marcador e faixa por extenso, estados vazios com as mãos da marca.

**Duas decisões que contrariam hábitos do guia de design usado** (registro honesto): (1) DM Serif Display consta na lista de "faces de piloto automático", mas é a face real dos títulos da marca (Figura 1) e o pedido do dono, então é a exceção justificada; fica restrita a títulos de página e de seção e a poucos momentos de destaque (entrada, resultado do Zarit, pergunta do assistente), nunca em rótulo, botão ou dado. (2) Fundo off-white com serifa e dourado é o visual "creme" que modelos repetem; aqui ele é imposto pela marca, então o diferencial vem do pilar azul, da linha dourada como traço estrutural e da densidade de dados.

---

## 2. Referências consultadas (8 consultas)

| Referência | O que aprendi | Decisão aplicada |
|---|---|---|
| Origamid, busca na web (nenhuma página da Origamid retornou; apareceram resumos gerais de UI) | Hierarquia se faz com peso e cor, não só tamanho; o espaço agrupa mais do que qualquer outra propriedade; 45 a 75 caracteres por linha; proporção 60/30/10 de cor | Texto corrido `68ch`; hierarquia por peso (600) e cor (azul nos títulos); 60% off-white e branco, 30% azul, 10% dourado e semânticas; espaçamento em grade de 8 px usado para agrupar |
| origamid.com (página inicial) | Lista cursos "UI Design para Iniciantes", "UI Design Avançado" e "Tipografia Avançada"; não descreve o conteúdo das aulas | **Não consegui verificar o conteúdo do Origamid.** Os conceitos pedidos (hierarquia, contraste, espaçamento, tipografia, cor com propósito, consistência) foram aplicados a partir dos princípios gerais acima, e a tipografia ganhou seção própria (3.3) por causa do curso dedicado |
| Linear, "How we redesigned the Linear UI" | Camadas de elevação bem definidas (fundo, painel, diálogo); tema por poucas variáveis (base, acento, contraste); cor de marca reduzida para a interface ficar neutra; densidade testada em superfícies pequenas como menu lateral e abas; alinhamento fino de rótulo, ícone e botão | Quatro níveis de elevação (3.5); tokens semânticos pequenos, componentes nunca usam hex; azul só em ação, seleção e título; itens do menu e abas com altura de 44 px e ícone alinhado ao texto; escuro é só troca de tokens |
| Stripe, "Designing accessible color systems" | Escala em espaço perceptual; mesma curva de luminosidade em todos os matizes; regra prática: dois tons a 5 degraus de distância passam 4,5:1 e a 4 degraus passam 3:1 | Escalas numeradas 50 a 950; texto sempre a 5 ou mais degraus do fundo; **medi cada par com script**; o dourado da marca #B8901F deu 2,98:1 no branco e reprovou, então texto usa dourado 800 e linhas usam dourado 600 |
| Vercel Geist, introdução | Geist Sans para interface e Geist Mono para códigos e valores; preset de raios, bordas e sombras | Sans para tudo; monoespaçada só em código pseudonimizado (`CUI-0042`); presets de raio, borda e sombra em tokens |
| Vercel Geist, cores | 10 passos com papel fixo: 100 fundo, 200 hover, 300 ativo, 400 borda, 500 borda em hover, 600 borda ativa, 700 fundo de alto contraste, 900 texto secundário, 1000 texto primário; dois fundos de página | Passos mapeados a papéis semânticos: `--brand-soft` (50), `--brand-soft-hover` (100), `--border`, `--border-control`, `--text-muted`, `--text-strong`; dois fundos: `--canvas` e `--surface` |
| GOV.UK Design System, mensagem de erro | Erro logo após rótulo e dica, com borda e prefixo oculto "Erro:"; mesma mensagem no campo e no resumo do topo; não limpar o que a pessoa digitou; mensagem específica por tipo de erro; não usar mensagem de erro para "sem permissão" | `.field__error` com `.sr-only` "Erro:", `.error-summary` com a mesma frase, catálogo de mensagens (seção 7.4); acesso negado é página (`/403`), nunca erro de campo |
| Apple HIG, acessibilidade (a página não retornou o texto; vale o que é conhecido do HIG, **não confirmado na fonte**) | Alvo de toque de 44 pt; cor nunca como único indicador; respeitar "reduzir movimento"; texto que escala | `--control-h: 44px` (32 px só com mouse, sobe a 44 em toque); faixas do Zarit com ícone, rótulo e posição; `prefers-reduced-motion` zera durações; tamanhos em rem |

Também lidos, só como guia (não são consultas externas): `new-work.md`, `operate.md` e `craft-floor.md` do plugin Impeccable (modo Operate: clareza, consistência, escaneabilidade; nada de eyebrow, gradiente em texto, borda lateral colorida, sombra dura; estados completos; foco visível; navegador estilizado).

---

## 3. Tokens

Tudo em `src/styles/_tokens.scss`: variáveis CSS em `:root` (e `:root[data-theme='dark']`) mais mapas SCSS. Componentes só usam os tokens **semânticos**.

### 3.1 Cores

**Azul institucional** (`--nx-blue-*`). Títulos, ação principal, seleção, menu lateral.

| Passo | Hex | Uso |
|---|---|---|
| 50 | `#EFF5FA` | fundo suave de seleção, banner informativo, hover de linha selecionada |
| 100 | `#DCE9F4` | hover do fundo suave, avatar, plano Cuida (fundo) |
| 200 | `#B9D3E8` | borda de selo azul |
| 300 | `#8DB7D8` | texto apagado sobre o menu escuro, série 3 dos gráficos |
| 400 | `#66A0CF` | reserva |
| 500 | `#4A90C8` | **Essencial** (Figura 1); foco em fundo escuro; só gráfico e preenchimento, nunca texto |
| 600 | `#2D6EA3` | **Cuida** (Figura 1) e **cor de marca**: botão primário, link (5,4:1 no branco) |
| 700 | `#235A87` | hover do primário, texto do plano Essencial |
| 800 | `#1B4669` | **título** (9,1:1 no off-white), favicon, `theme-color` |
| 900 | `#133350` | **menu lateral**, painel de marca da entrada |
| 950 | `#0B2238` | sombra e fundo de sobreposição |

**Dourado** (`--nx-gold-*`). Só detalhe: linha, aba atual, destaque, plano Sustenta.

| Passo | Hex | Uso |
|---|---|---|
| 50 | `#FBF6E8` | fundo de destaque, banner de protótipo |
| 100 | `#F5EACB` | reserva |
| 200 | `#EAD598` | borda de destaque, seleção de texto |
| 300 | `#E3C15E` | símbolo e ícone atual sobre o menu escuro, selo de contagem |
| 400 | `#CBA32E` | reserva |
| 500 | `#B8901F` | **o dourado da marca**; só decoração (linha sob o título, logo), 2,98:1 não serve para texto |
| 600 | `#A67F15` | linha da aba atual, ícone de destaque (3,7:1) |
| 700 | `#8A6812` | reserva |
| 800 | `#6E520F` | **texto dourado** (6,6:1), plano Sustenta |
| 900 | `#4A380A` | reserva |

**Neutros** (cinza-azulado da Figura 1, `--nx-slate-*`) e **papel** (`--nx-paper-*`, o off-white da marca).

| Token | Hex | Uso |
|---|---|---|
| `--nx-slate-0` | `#FFFFFF` | superfície (cartão, tabela, campo) |
| `--nx-slate-50` | `#F7F8FA` | reserva |
| `--nx-slate-100` | `#EEF1F4` | fundo do plano Livre |
| `--nx-slate-200` | `#E1E6EB` | reserva |
| `--nx-slate-300` | `#CBD3DB` | reserva |
| `--nx-slate-400` | `#A5B0BB` | borda forte, texto desabilitado |
| `--nx-slate-500` | `#7B8794` | **Livre** (Figura 1) |
| `--nx-slate-600` | `#5A6673` | `--text-muted` (5,9:1 no branco, 5,4:1 no canvas) |
| `--nx-slate-700` | `#3F4A56` | texto secundário forte |
| `--nx-slate-800` | `#28323D` | `--text` |
| `--nx-slate-900` | `#17202A` | `--text-strong` (16,5:1) |
| `--nx-paper-100` | `#F7F5F0` | **`--canvas`**, o fundo do app |
| `--nx-paper-200` | `#F0EDE5` | `--surface-sunken`: cabeçalho de tabela, trilhas, hover |
| `--nx-paper-300` | `#E5E1D6` | grade dos gráficos |

Bordas: `--border-subtle #E8E5DC` (separador), `--border #D8D4C8` (contorno de cartão), `--border-control #838F9B` (contorno de campo, 3,3:1, exigência de UI).

**Semânticas** (cada uma tem `fg` para texto, `icon` para gráfico, `bg`, `border`, `solid`).

| Papel | fg (texto) | icon | bg | Contraste do fg no bg |
|---|---|---|---|---|
| Sucesso | `#17613D` | `#1F7A4D` | `#E9F6EF` | 6,7:1 |
| Atenção | `#6B3D00` | `#B87500` (3,8:1) | `#FFF5DC` | 8,4:1 |
| Perigo | `#7A1A12` | `#B42318` | `#FDEEEC` | 9,4:1 |
| Informação | `#1B4669` | `#2D6EA3` | `#EFF5FA` | 8,7:1 |

Regra: o dourado da marca **nunca** sinaliza estado; atenção usa âmbar (mais laranja, com ícone de triângulo), então as duas cores não se confundem.

**Os quatro planos** (Figura 1): Livre `#7B8794`, Essencial `#4A90C8`, Cuida `#2D6EA3`, Sustenta dourado. Em selo e texto usam-se as variantes escuras (`--plan-*-text`, todas 4,5:1 ou mais); no cabeçalho do cartão de plano (texto grande), Sustenta usa dourado 600 para dar 3,7:1 com o branco. O selo de plano é sempre ponto mais nome, nunca só cor.

**Faixas do Zarit** (cor, ícone e rótulo; nunca só cor):

| Faixa | Pontos | Rótulo exato | Ícone (lucide) | Cor | Alerta |
|---|---|---|---|---|---|
| 1 | 0 a 20 | Sobrecarga ausente ou pequena | `circle-check` (círculo) | verde (`--zarit-1-*`) | nenhum |
| 2 | 21 a 40 | Sobrecarga moderada | `info` (círculo) | azul (`--zarit-2-*`) | nenhum |
| 3 | 41 a 60 | Sobrecarga moderada a severa | `triangle-alert` (triângulo) | âmbar (`--zarit-3-*`) | amarelo |
| 4 | 61 a 88 | Sobrecarga severa | `octagon-alert` (octógono) | vermelho (`--zarit-4-*`) | vermelho |

Formas diferentes (círculo, círculo, triângulo, octógono) mais o intervalo numérico escrito mantêm a leitura para daltonismo. Nunca usar a palavra "diagnóstico" nem "eficácia" (RN-ZRT-18, 22).

**Gráficos.** Série 1 azul 600, série 2 dourado 500, série 3 azul 300, série 4 cinza-azulado 500, série 5 verde; negativo vermelho; grade `--chart-grid`; eixo `--text-muted` (12 px). Legenda muda de forma (quadrado, traço, tracejado) para não depender só da cor.

### 3.2 Modo escuro (opcional, implementado)
`<html data-theme="dark">`. Só troca tokens semânticos: canvas `#0F1620`, superfície `#172230`, elevada `#1D2B3B`, texto `#DCE4EC` (8,3:1), mudo `#A3B1C0`, marca `#7FB6E6`, dourado `#E3C15E`, bordas azuladas, semânticas claras sobre fundos escuros (todas acima de 6:1), menu `#0B1722`. Não segue `prefers-color-scheme` sozinho: a escolha é do usuário, guardada pelo repositório de preferências (nunca `localStorage` direto, AC-GL-03). Verificado visualmente no guia de estilo.

### 3.3 Tipografia

| Papel | Família | Peso | Tamanho / entrelinha | Uso |
|---|---|---|---|---|
| Display `.t-display` | DM Serif Display | 400 | 40 / 1,15 | entrada, resultado do Zarit, número principal de resultado |
| Título de página `h1` | DM Serif Display | 400 | 32 / 1,15 | um por tela, azul 800, linha dourada abaixo |
| Título de seção `h2` | DM Serif Display | 400 | 24 / 1,25 | seção, diálogo, gaveta, estado vazio, pergunta do assistente |
| Título de cartão `h3` | Figtree | 600 | 18 / 1,25 | cartão, bloco |
| Corpo | Figtree | 400 | 16 / 1,55 | texto corrido (65 a 75 caracteres), campo de formulário |
| Interface | Figtree | 500 ou 600 | 14 / 1,35 | tabela, botão, rótulo, menu, selo grande |
| Legenda | Figtree | 400 a 600 | 12 / 1,35 | cabeçalho de tabela, selo, dica de campo, eixo de gráfico |
| KPI | Figtree | 600 | 24 (celular) ou 32 / 1,15, tracking -0,02em | números principais, tabulares |
| Código | monoespaçada do sistema | 600 | 12 | `CUI-0042` |
| Marca | Figtree | 500, caixa alta | tracking 0,32em | palavra NEXUS |

- **DM Serif Display** (`@fontsource/dm-serif-display`): a fonte vista na Figura 1; só existe no peso 400, então o contraste vem do tamanho e da cor azul, nunca de negrito. **Figtree Variable** (`@fontsource-variable/figtree`) no corpo: geométrica, amigável e legível em tela, de acolhimento sem infantilizar; medi que os algarismos tabulares funcionam (largura de `1111` igual à de `0000`), requisito para tabela e dinheiro. Rejeitadas: Inter (neutra demais e padrão de produto), Geist (marca de outra empresa).
- Só o subconjunto latino é carregado (cobre todo o português), arquivos locais (`unicode-range` em `_typography.scss`); ao compilar, o Angular empacota em `media/`. Nenhuma requisição externa (AC-GL-11).
- Escala fixa em rem, razão próxima de 1,2; sem `clamp` em UI de produto. Títulos com `text-wrap: balance`. Números sempre com `.t-num` ou `font-variant-numeric: tabular-nums`. Sem caixa alta fora da palavra NEXUS e do nome do plano.

### 3.4 Espaçamento (grade de 8 px)
`--space-N` = N × 4 px. Usar os **pares** (2, 4, 6, 8, 10, 12, 16, 20, 24) = 8, 16, 24, 32, 40, 48, 64, 80, 96 px entre blocos; os ímpares (1, 3, 5) = 4, 12, 20 px só dentro de componente. Regras: tight dentro do grupo (8 px), generoso entre grupos (24 a 32 px), mais espaço acima do título do que abaixo; margem de página `--gutter`: 16 px (celular), 24 px (tablet), 32 px (desktop). O espaço agrupa: nunca separar com linha o que já está agrupado por espaço.

### 3.5 Raios, bordas, sombras e elevação

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 4 px | checkbox, tecla, código |
| `--radius-sm` | 8 px | botão, campo, item de menu, slot de agenda |
| `--radius-md` | 12 px | cartão, tabela, banner |
| `--radius-lg` | 16 px | diálogo, gaveta, assistente |
| `--radius-xl` | 24 px | cartão de plano (a "aba" arredondada da Figura 1), entrada |
| `--radius-pill` | 999 px | selo, chip, trilha de progresso |

Bordas: 1 px sempre (separação é feita por borda, não por sombra); campos 1 px em `--border-control`; erro e foco usam 1 px mais anel de 3 a 4 px. **Elevação em 4 níveis**, sempre com deslocamento e desfoque (nunca halo sem deslocamento, nunca sombra dura): 0 canvas e cartão (só borda); 1 `--shadow-1` botão elevado, cartão de kanban; 2 `--shadow-2` hover de cartão, cartão elevado; 3 `--shadow-3` menu, popover, toast; 4 `--shadow-4` diálogo e gaveta.

### 3.6 Ícones
**Lucide** (ISC) em **sprite SVG local** (`public/icons/sprite.svg`, gerado por `node tools/build-icons.mjs`, 110 ícones mais o símbolo da marca). Motivos: traço fino e uniforme que combina com a linha da marca; sem dependência de versão do Angular (`lucide-angular` acopla); sem fonte de ícones; só os usados entram no arquivo; zero requisição externa. Uso: `<svg class="icon" aria-hidden="true"><use href="icons/sprite.svg#i-calendar"/></svg>`. Traço 1,75 px; tamanhos `.icon--sm` 16, padrão 20, `.icon--lg` 24, `.icon--xl` 32. Ícone decorativo leva `aria-hidden="true"`; botão só de ícone leva `aria-label`. Um componente `IconComponent` do Dev deve montar `[attr.href]="'icons/sprite.svg#i-' + name"`. Para adicionar ícone: incluir o nome em `tools/build-icons.mjs` e rodar o script. Nunca usar emoji ou glifo Unicode como ícone.

### 3.7 Movimento
Curto e funcional: `--dur-1` 120 ms (hover, foco), `--dur-2` 200 ms (troca de estado, toast), `--dur-3` 320 ms (gaveta, diálogo, menu lateral). Curva de saída exponencial `--ease`. Movimento só comunica estado (abrir, fechar, carregar). Sem coreografia de entrada de página. `prefers-reduced-motion: reduce` zera as durações, para o brilho do esqueleto e deixa o giro do botão ocupado estático (o `aria-busy` continua).

### 3.8 Breakpoints e medidas

| Token | Valor | O que muda |
|---|---|---|
| base | 360 px | uma coluna; menu em gaveta; tabela em cartões; busca vira ícone |
| `sm` | 480 px | dois KPIs por linha, diálogo com rodapé em linha |
| `md` | 768 px | tabela volta a ser tabela; formulário em 2 colunas; KPIs em faixa; margens 24 px |
| `lg` | 1024 px | menu vira **trilho de ícones** (72 px); margens 32 px; lista com gaveta lateral acoplada; portal passa da barra inferior para a barra sob o cabeçalho |
| `xl` | 1280 px | menu **completo** (264 px, recolhível a trilho); painel "Precisa de atenção" ao lado na ficha |
| `xxl` | 1440 px | conteúdo centralizado em no máximo 1280 px |

Controles: `--control-h` 44 px; `--control-h-sm` 32 px com mouse e 44 px em toque (`pointer: coarse`); `--topbar-h` 64 px; `--sidebar-w` 264 px; `--bottom-nav-h` 56 px mais a área segura do aparelho; item do menu na gaveta do celular com 48 px.

---

## 4. Catálogo de componentes

Convenções: classe `bloco`, parte `bloco__parte`, variante `bloco--variante`. Estado por atributo ARIA quando existe (`aria-current`, `aria-pressed`, `aria-selected`, `aria-invalid`, `aria-busy`, `aria-sort`, `disabled`). O sprite aparece abreviado como `ICON(nome)` = `<svg class="icon" aria-hidden="true"><use href="icons/sprite.svg#i-nome"/></svg>`.

**Matriz de estados** (todos têm foco visível: anel de 2 px azul `--focus` com recuo de 2 px; no menu escuro, dourado).

| Componente | Padrão | Hover | Foco | Ativo | Desabilitado | Carregando | Erro | Vazio | Selecionado |
|---|---|---|---|---|---|---|---|---|---|
| Botão | sim | fundo | anel | desloca 1 px | `disabled` | `aria-busy` | variante perigo | n/a | `aria-pressed` (segmentado) |
| Campo | sim | borda | borda + anel | n/a | `disabled`, `readonly` | esqueleto | `aria-invalid` + `.field__error` | placeholder | n/a |
| Tabela | sim | linha | célula focável | n/a | n/a | linhas de esqueleto | banner acima | `.empty` | `aria-selected` |
| Chip | sim | fundo | anel | n/a | `disabled` | n/a | n/a | n/a | `aria-pressed` |
| Aba | sim | fundo | anel | n/a | `disabled` | n/a | n/a | n/a | `aria-selected` |
| Cartão interativo | sim | sombra 2 | borda azul | n/a | n/a | esqueleto | n/a | `.empty--compact` | n/a |
| Slot de agenda | aberto, reservado... | borda | anel | n/a | bloqueado | n/a | falta | n/a | n/a |

### 4.1 Shell da equipe (menu por perfil, barra superior com busca)

```html
<div class="app-shell" data-nav-open="false">          <!-- data-nav="rail|expanded" força o trilho -->
  <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
  <aside class="sidebar" aria-label="Navegação principal">
    <a class="sidebar__brand" href="/app/painel">
      <svg class="brand-symbol" aria-hidden="true"><use href="icons/sprite.svg#nx-symbol"/></svg>
      <span class="wordmark">Nexus</span></a>
    <nav class="sidebar__nav" aria-label="Módulos">
      <ul class="nav-list">                                   <!-- grupo sem título: Painel -->
        <li><a class="nav-item" href="/app/painel" aria-current="page">ICON(layout-dashboard)<span class="nav-item__label">Painel</span></a></li></ul>
      <div class="nav-group">                                  <!-- grupo recolhível -->
        <button class="nav-group__title" aria-expanded="true">Cuidado ICON(chevron-down)</button>
        <ul class="nav-list">
          <li><a class="nav-item" href="/app/acompanhamento">ICON(heart-pulse)<span class="nav-item__label">Acompanhamento</span><span class="nav-item__badge" aria-label="3 alertas vermelhos do dia">3</span></a></li>
        </ul></div>
    </nav>
    <div class="sidebar__foot"><div class="sidebar__profile"><span class="avatar avatar--sm avatar--nav">BN</span><div><strong>Dra. Beatriz Nogueira</strong><span>Psicóloga</span></div></div></div>
  </aside>
  <header class="topbar">
    <button class="btn btn--ghost btn--icon topbar__menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu">ICON(menu)</button>
    <div class="topbar__brand">...símbolo, só abaixo de lg...</div>
    <div class="topbar__search"><button class="search-trigger" aria-label="Buscar (Ctrl K)">ICON(search)<span>Buscar cuidador, prestador, parceiro</span><kbd class="kbd">Ctrl K</kbd></button></div>
    <div class="topbar__actions">
      <button class="btn btn--ghost btn--icon" aria-label="Notificações: 3 novas">ICON(bell)<span class="nav-item__badge">3</span></button>
      <div class="menu-anchor"><button class="btn btn--ghost" aria-haspopup="menu" aria-expanded="false"><span class="avatar avatar--sm">BN</span>...</button><div class="menu" role="menu">...</div></div>
    </div>
  </header>
  <main class="main" id="conteudo"><div class="page">...</div></main>
  <footer class="app-footer">ICON(info)<span>Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador.</span><a href="/app/configuracoes/dados">Meus dados no navegador</a></footer>
  <div class="scrim" aria-hidden="true"></div>
</div>
```

- **Menu por perfil**: renderizar só os módulos permitidos (matriz 1.2 do escopo, AC-M01-08), com os grupos e a ordem do `04-ux.md` 3.2: Painel (sem título), Pessoas, Cuidado, Rede e parceiros, Relacionamento, Gestão, Segurança e normas, Sistema. Grupo sem item visível não aparece; grupo com **um único item** vira link direto com o nome do item (como "Cuidadores" e "Mensagens" na psicóloga). Grupos são **recolhíveis** (`button.nav-group__title` com `aria-expanded`; estado lembrado por usuário via repositório; o da rota atual abre sozinho); topo opcional "Fixados" (até 3 atalhos). Contador só onde há ação, com texto para leitor de tela. Na gaveta do celular os itens têm 48 px. O Dev troca `data-nav-open` na gaveta (abaixo de `lg`), move o foco para dentro, prende o foco, fecha com Esc, ao tocar no `.scrim` e ao escolher um item.
- **Trilho** (1024 a 1279 px): os rótulos somem por container query (largura do menu menor que 6 rem); o `title` ou `aria-label` do item mantém o nome. Nome e perfil do usuário aparecem no menu do usuário.
- **Busca global** (SCR-M02-02): `Ctrl+K` e o botão abrem um `<dialog class="dialog">` com `.input-wrap`, resultados em `.list-row` agrupados por tipo e mensagem "só mostra o que seu perfil pode ver". Abaixo de `md` o disparador vira só o ícone.
- **Rodapé** em toda tela (AC-GL-05): aviso literal de protótipo mais os links "Privacidade e canal do titular", "Meus dados no navegador", "Atalhos" e "Sobre"; fica no fim da janela em páginas curtas (`min-height: 100dvh` em coluna) e nada o cobre. Na entrada, banner de protótipo no topo do painel.

### 4.2 Shell do portal do profissional (mobile first) e entrada

```html
<div class="portal-shell">
  <header class="portal-header">...brand, sino, avatar dourado...</header>
  <nav class="bottom-nav" aria-label="Portal">
    <a class="bottom-nav__item" href="/portal" aria-current="page">ICON(layout-dashboard)<span>Início</span></a> ...Solicitações, Disponibilidade, Mensagens, Mais...</nav>
  <main class="portal-main">...</main>
  <footer class="app-footer">...</footer>
</div>
```
Barra inferior fixa em celular **e tablet** (até 1023 px): 56 px mais a área segura do aparelho, **cinco destinos: Início, Solicitações, Disponibilidade, Mensagens e Mais** ("Mais" abre Minha avaliação, Documentos, Integração, Meu perfil, Privacidade e Sair), alvo mínimo 44 px, linha dourada no item atual; de `lg` em diante vira barra horizontal sob o cabeçalho. Conteúdo em uma coluna de até 60 rem; o rodapé rola acima da barra e nada o cobre.

Entrada: `.login` com `.login__brand` (azul 900, símbolo, frase "Quem cuida também precisa de sustentação.", as mãos em linha dourada a 10% de opacidade como arte) e `.login__panel` com banner de protótipo, título "Entrar como" e grupos `.profile-group` com `.list-card` de `.list-row` (avatar, nome, uma frase do que o perfil vê, selo "Código" para quem exige o segundo fator). Os 12 usuários do seed em dois grupos: Equipe Nexus e Profissionais credenciados. Abaixo de `lg` o painel de marca vira cabeçalho.

### 4.3 Cabeçalho de página, breadcrumb, seção

```html
<header class="page-header">
  <nav aria-label="Você está em"><ol class="breadcrumb"><li><a href="...">Cuidadores</a></li><li aria-current="page">CUI-0042</li></ol></nav>
  <div class="page-header__row">
    <div class="page-header__titles"><h1>Ana Paula Ferraz</h1><p class="page-header__desc">Plano Cuida · cadastro ativo</p></div>
    <div class="page-header__actions"><button class="btn">Exportar</button><button class="btn btn--primary">Novo</button></div>
  </div>
</header>
```
A **linha dourada** de 48 × 2 px sob o título vem do CSS (`::after`). Um `h1` por tela. Ação primária no canto direito, uma só.

### 4.4 Botão
`.btn` + variante: `--primary` (uma por tela ou por bloco), padrão (secundário, contorno), `--soft`, `--ghost`, `--danger` (preenchido, só para a ação irreversível dentro do diálogo), `--danger-quiet`; tamanhos `--sm`, `--lg`, `--block`; `--icon` quadrado (exige `aria-label`). Carregando: `aria-busy="true"` (o texto some, entra o giro; largura não muda). Desabilitado: `disabled` (cinza, sem sombra); se a razão importa, explicar ao lado ("Faltam 2 critérios para aprovar"). Rótulo é verbo: "Registrar contato", "Aplicar a escala"; nunca "OK", "Enviar" solto, "Clique aqui".

### 4.5 Formulário e campo
```html
<div class="field field--error">
  <label class="field__label" for="cpf">CPF fictício</label>
  <span class="field__hint" id="cpf-h">Use um CPF fictício. O sistema rejeita números válidos.</span>
  <input class="input" id="cpf" aria-invalid="true" aria-describedby="cpf-h cpf-e">
  <span class="field__error" id="cpf-e">ICON(circle-alert)<span><span class="sr-only">Erro: </span>Parece um CPF real. Use um CPF fictício.</span></span>
</div>
```
- Rótulo sempre visível (nunca só placeholder); dica **acima** do campo; erro **abaixo**, com ícone, texto e prefixo oculto "Erro:"; borda e anel vermelhos; a mesma frase no `.error-summary` do topo (`role="alert"`, foco ao enviar, cada item é link para o campo). Não limpar o que foi digitado.
- `.input`, `.select`, `.textarea`: 44 px, 16 px de texto, estados: hover, foco (borda azul 2 px + halo), `aria-invalid`, `readonly` (fundo rebaixado), `disabled`. `.input--num` alinha à direita (horas, valores; **não** para datas). `.input-wrap` põe ícone à esquerda (busca) e `.input-wrap__action` à direita (mostrar, limpar).
- `.check` e `.radio` (linha inteira clicável, 44 px de altura, estado misto com `indeterminate`), `.switch` (consentimento ativo ou revogado; o rótulo diz o efeito, não só "ligado"), `.likert` (escala de 0 a 4, ver 4.13).
- `.form-grid` (1 coluna no celular, 2 de `md` em diante) alinha rótulo, dica, controle e erro de campos da mesma linha por subgrid; `.span-2` ocupa as duas colunas; `.form-section` agrupa; `.form-actions` fecha com a ação primária à direita e o status ("Rascunho salvo às 14:32") à esquerda.
- **Dado fictício** (LP-02): campo de CPF mostra a dica acima e o botão "Gerar CPF fictício"; e-mail com sufixo `@exemplo.com.br`; telefone com máscara `(34) 90000-0000`.
- **Dado mascarado** (LP-07): `<span class="masked" data-state="hidden"><span aria-label="CPF oculto">***.***.***-**</span><button class="masked__toggle" aria-label="Mostrar CPF (pede justificativa)">ICON(eye)<span>Mostrar</span></button></span>`. O botão leva **ícone e texto** ("Mostrar" e "Ocultar"). Revelado: `data-state="revealed"` (fundo dourado suave, mais o texto "registrado no log"); o Dev **remascara sozinho depois de 30 s**. "Mostrar" abre o **popover de motivo** (`.popover` com `.radio` de motivos prontos mais "Outro" e botão "Mostrar por 30 segundos"); só existe para perfis autorizados. **Portão de acesso** (`AccessGate`, supervisão e aba sem consentimento): `.card` com `.empty__icon` de cadeado, a explicação, o campo de motivo e uma ação.
- **Pseudonimizado** (LP-08): `<span class="code-chip">ICON(shield-check)CUI-0042</span>`; na visão da gestão não há botão de revelar.
- **Consentimento** (LP-04): `.list-card` de `.consent` (nome, versão, data, canal, selo de estado, interruptor) com link "Ver histórico" para a linha do tempo append-only. Estados em selo: **Ativo** (`--success`), **Recusado** (`--outline`), **Revogado** (`--danger`), **Pendente** (`--attention`). A **escolha** no cadastro (Concorda, Não concorda, Decidir depois) é um cartão de decisão com três `.radio`, não um interruptor.
- **Nota de 1 a 5** (avaliação da rede, ARP): `.rating` (cinco botões numerados de 44 px, rádio nativo, extremos "Ruim" e "Excelente" em `.rating__ends`; nunca só estrelas). **Digitar para confirmar** (anonimizar, eliminar, apagar tudo): dentro de `.dialog__body`, `.field` com `.input` e a dica "Digite ELIMINAR para continuar"; o botão perigoso fica `disabled` até bater.

### 4.6 Tabela de dados
```html
<div class="table-toolbar">...busca, chips de filtro, densidade, exportar...</div>
<div class="selection-bar">2 selecionados <div class="cluster">...ações...</div></div>
<div class="table-wrap">
  <table class="table table--stack" data-density="comfortable">
    <caption class="sr-only">Cuidadores cadastrados</caption>
    <thead><tr>
      <th class="col-select"><label class="check"><input type="checkbox" aria-label="Selecionar todos"></label></th>
      <th aria-sort="ascending"><button class="th-sort">Cuidador ICON(arrow-up)</button></th>
      <th class="col-num">Horas/dia</th><th class="col-actions"><span class="sr-only">Ações</span></th></tr></thead>
    <tbody><tr aria-selected="false"><td class="col-select" data-label="Selecionar">...</td><td data-label="Cuidador"><a class="row-link">Ana</a> <span class="code-chip">CUI-0042</span></td>...</tr></tbody>
  </table>
</div>
<div class="table-footer"><span>5 de 340 cuidadores</span><div class="pagination__pages">...</div></div>
```
- Ordenação: `aria-sort` em `ascending`, `descending` ou `none`; o Dev troca o ícone (`chevrons-up-down` sem ordem, `arrow-up` com ordem; o CSS gira para descendente).
- Seleção: `aria-selected` na linha; barra de seleção aparece com a contagem; "selecionar todos" no cabeçalho marca **a página** (estado misto) e a barra oferece "Selecionar todos os 340 resultados" de forma explícita. **Ações em lote só seguras ou reversíveis** (exportar, marcar como visto, atribuir psicólogo); nunca excluir, anonimizar, eliminar ou descredenciar em lote; com o lote ativo, as ações por linha ficam desabilitadas. A linha inteira abre o detalhe (clique ou Enter); a caixa e o menu não.
- **Densidade**: `data-density="compact"` (36 px) ou `comfortable` (52 px), com `.segmented` na barra; padrão confortável.
- Filtros: `.chip-group` com `aria-pressed` e contagem; filtros ativos viram `.chip--removable`; "Limpar filtros".
- Numérico à direita (`.col-num`, tabular); primeira coluna identifica a linha (nome mais código); `.col-actions` é a última coluna: **uma ação visível com texto** e o resto no menu "Mais ações" (nunca mais de 2 ícones soltos). A ordem padrão de cada lista está no `04-ux.md` 5.1 (por exemplo, mensagens: atrasadas primeiro). **Exportar CSV** diz antes o que não inclui ("A exportação não inclui CPF, telefone, e-mail nem dados de saúde.").
- Estado vazio, carregando e erro: ver 4.10 (linhas de `.skeleton`, `.empty`, `.banner--danger`). Contagem sempre visível (AC-GL-01).
- **Responsivo**: rola **dentro** de `.table-wrap` em qualquer largura; abaixo de 768 px a variante `.table--stack` vira cartões usando `data-label` em cada `<td>` (obrigatório) **quando a leitura é item a item** (cuidadores, mensagens, solicitações, prestadores). Tabelas de **comparação entre colunas** (projeção de 24 meses, log, ocupação, matriz 5x5) não viram cartão: rolam no contêiner com cabeçalho e primeira coluna fixos e oferecem baixar CSV; o log vira lista de eventos no celular. Como o cabeçalho some nos cartões, oferecer "Selecionar todos" e ordenação num menu da barra de ferramentas; filtros no celular abrem numa folha "Filtros (2)".
- Paginação (`.pagination`) em listas de 340 registros; `aria-current="page"`; filtrar responde em menos de 1 s (AC-M03-12).

### 4.7 Selos, chips, avatar
- `.badge` + `--success`, `--attention`, `--danger`, `--info`, `--gold`, `--plan-livre|essencial|cuida|sustenta`, `--zarit-1..4`, `--outline`, `--dot` (ponto mais texto), `--lg`, `--count`. Todo selo tem **texto mais ponto (`--dot`) ou ícone**, nunca só cor.
- Zarit: `<span class="badge badge--zarit-4">ICON(octagon-alert)Severa · 63</span>`. ARP (linguagem neutra para o profissional): "Em destaque" (`--success` + `award`), "Em acompanhamento" (`--attention` + `triangle-alert`); para a gestão: "Excelência", "Alerta", "Descredenciamento" (`--danger` + `ban`). "Sem média (menos de 5 avaliações)". "Risco de saída" com `triangle-alert`.
- `.chip` (filtro, `aria-pressed`), `.chip--removable` com `.chip__remove` (`aria-label="Remover filtro X"`).
- `.avatar` (iniciais; sem foto, dado mínimo), `--sm`, `--lg`, `--xl` (serifa, perfil), `--gold` (profissional credenciado), `--nav` (sobre o menu escuro); `.avatar-group`.

### 4.8 Cartões, KPI, plano
- `.card` (borda, sem sombra) com `.card__header` (título `h3` + ação), `.card__body`, `.card__footer`; `.card--pad`, `--sunken` (grupo dentro de grupo, **nunca cartão dentro de cartão**), `--raised`, `--interactive` (hover com sombra 2, foco com borda azul).
- **Faixa de KPIs** `.kpi-strip` com `.kpi` (rótulo, valor, meta, delta, sparkline ou medidor): uma superfície só com divisórias de 1 px; 2 por linha no celular, até 4 no desktop. Valor em 24/32 px, tabular. `kpi__delta--good|bad` com seta de tendência e texto ("+2 desde outubro"). KPI clicável é `<a class="kpi">` (leva à tela do módulo com o filtro, AC-M02-08). Para `partner`, KPI de saúde mostra "menos de 5" abaixo do mínimo.
- `.plan-card` (+ `--essencial|cuida|sustenta`): cabeçalho colorido arredondado em serifa e caixa alta (Figura 1), preço serifado, lista com `check`. Mostra "R$ 0,00", "R$ 49,90", "R$ 119,90", "R$ 149,90", nessa ordem, mais o aviso de que a mensalidade não inclui serviços da rede nem atendimento psicológico.

### 4.9 Abas, segmentado, menu, paginação
- `.tabs[role=tablist]` > `.tab[role=tab][aria-selected]` + `.tab-panel[role=tabpanel]`; setas navegam, Home e End; a aba atual leva a **linha dourada**; aba sem permissão fica `disabled` com explicação ou nem aparece (conforme o perfil: `support` não vê Acompanhamento nem Atendimento).
- `.segmented` + `.segmented__btn[aria-pressed]`: semana ou mês, densidade.
- `.menu` + `.menu__item` (`role=menuitem`), `--danger`, `.menu__sep`, `.menu__header`; abre ancorado ao botão (`.menu-anchor`); fechar com Esc devolve o foco ao botão. Posicionar com `@angular/cdk/overlay` ou o atributo `popover` (um menu absoluto dentro de contêiner com `overflow` é cortado).

### 4.10 Feedback e sobreposição
- **Banner** `.banner` + `--success|attention|danger|prototype|consent`: ícone, `banner__title`, `banner__text`, `banner__actions`. Informação e sucesso `role="status"`; erro e prazo `role="alert"`.
- **Banner de protótipo** `.banner--prototype`: faixa fina dourada suave, texto fixo "Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador." (rodapé de toda tela e entrada).
- **Banner de consentimento LGPD** `.banner--consent` (LP-01): cartão no canto inferior esquerdo (tela cheia no celular), título em serifa, texto curto, "Entendi" (primário) e "Ver detalhes" (fantasma); não bloqueia a tela; grava `nexus-erp:ui-notice` pelo repositório; some depois.
- **Toast** `.toast-region` > `.toast--success|attention|danger`: canto inferior direito (centralizado no celular, acima da barra inferior), **6 segundos, pausa com hover e com foco**, `role="status"` (`alert` para erro), botão fechar e, quando dá para desfazer, o botão `.toast__action` "Desfazer" (também `Ctrl+Z` enquanto aberto); nunca é o único registro da ação.
- **Diálogo** `<dialog class="dialog">` aberto por `showModal()` (foco preso, Esc fecha, foco volta ao gatilho): `.dialog__header` (`.dialog__icon` + `h2`), `.dialog__body`, `.dialog__footer` (cancelar à esquerda do perigo; no celular os botões empilham com o primário acima). **Ação destrutiva descreve o efeito** (AC-GL-09) com `.effects` (`is-erase` será eliminado, `is-block` ficará bloqueado, `is-keep` continua registrado). Usar diálogo só para confirmar ou para tarefa que exige foco; o resto é inline.
- **Gaveta** `<dialog class="drawer">` à direita (30 rem = 480 px; tela cheia no celular): formulário curto (até ~6 campos) e detalhe modal. **Gaveta acoplada** (`.drawer--docked`, PD-02: mensagens, solicitações do titular): não é modal, ocupa a coluna da direita de `.layout-list-detail` a partir de `lg`, a lista continua visível e navegável, cabeçalho com "‹ 3 de 28 ›", Esc fecha e devolve o foco à linha de origem, a rota muda (`/app/mensagens/:id`) para recarregar mantendo o painel; abaixo de `lg` vira tela inteira com "Voltar".
- **Folha inferior** (`.dialog--sheet`): formulários em diálogo viram folha quase cheia no celular (abaixo de 768 px); confirmação continua diálogo compacto central.
- **Popover** `.popover` (22,5 rem; `__header`, `__body`, `__footer`): painel de notificações (linhas `.list-row--unread`, "Marcar tudo como visto"; página inteira no celular) e popover de motivo de acesso. **Paleta de comandos e busca global** `<dialog class="dialog cmdk">` (640 px; tela cheia no celular): `.cmdk__input`, `.cmdk__list` com `.cmdk__group` e `.cmdk__item[aria-selected]`, `.cmdk__foot` com as teclas ("Setas navegar", "Enter abrir", "Esc fechar") e o aviso "Só mostra o que o seu perfil pode ver".
- **Barra de ação fixa** `.action-bar`: ação primária presa ao rodapé do celular (acima da barra do portal), com `scroll-padding` para o foco nunca ficar atrás dela; de 768 px em diante vai para o cabeçalho ou o fim do formulário.
- **Selo de prazo** (`DeadlineBadge`): `.badge` com ícone de relógio e texto ("No prazo", "Faltam 1 h 20 min úteis", "Atrasada há 6 h úteis"; âmbar até 3 dias, vermelho vencido); o horário absoluto aparece ao focar. **Cronômetro** (`DeadlineTimer`): `.deadline`.
- **Prazo de alerta** `.deadline` (`role="timer"`): ícone de relógio, tempo restante em 24 px tabular ("06h 42min") e rótulo ("para o contato de hoje, até 23h59"). Vencido: texto "vencido há 3 h 12 min", mesma cor, sem piscar.
- **Estado vazio** `.empty`: ilustração `.empty__art` (as mãos da marca em linha dourada, com um círculo pontilhado onde ainda não há ninguém), título serifado acolhedor, uma frase, até duas ações. Variante `--compact` para dentro de cartão e tabela. Toda lista tem (AC-GL-01). **Erro de carregamento, sem permissão (403) e offline** usam o mesmo bloco com `.empty__icon` (`--danger` para erro, neutro para cadeado) no lugar das mãos; offline é um `.banner--attention` no topo ("Você está sem conexão. Seus dados continuam neste navegador.").
- **Esqueleto** `.skeleton` (+ `--text`, `--title`, `--circle`, `--block`, `--value`) no lugar do conteúdo, nunca spinner no meio; contêiner `aria-busy="true"`. Sem brilho com movimento reduzido.
- `.tooltip` só para rótulo curto de ícone, ligado por `aria-describedby`; nunca guarda informação essencial.

### 4.11 Gráficos (SVG à mão; alternativa em tabela em todos)
- Estrutura: `.chart` > `.chart__scroll` > `svg.chart__svg` (`viewBox` de 560 de largura, `role="img"` e `aria-label` com a leitura em palavras) + `.legend` + `details.chart-alt` com `.table`. Abaixo de 34 rem o gráfico rola dentro do cartão; no celular o `04-ux.md` pede um gráfico por vez com abas "Gráfico | Tabela" (use `.tabs`) e a legenda abaixo.
- Classes: `.ch-grid`, `.ch-axis`, `.ch-text` (12 px), `.ch-bar` (`--neg`, `--2`...), `.ch-line`, `.ch-area` (12% de opacidade), `.ch-dot`, `.ch-ref` e `.ch-ref-label` (linha de referência dourada tracejada).
- **Barras** (resultado mensal K12): área `L = 70`, `T = 12`; `y(v) = T + (max - v) / (max - min) * altura`; barra positiva azul, negativa vermelha, eixo zero mais forte, rótulo do mês embaixo.
- **Linha e área** (saldo acumulado, evolução do Zarit): `polyline` mais `polygon` com `.ch-area`; pontos extremos rotulados; linha de referência pontilhada (zero, 41 pontos).
- **Rosca** (assinantes por plano): `circle` com `r = 15.9155` (circunferência 100), `stroke-dasharray = "p 100-p"`, `stroke-dashoffset = -acumulado`, giro de -90°; total no centro; legenda com valor e percentual.
- **Sparkline** `.spark` (6,5 × 2 rem), **barra de progresso** `.progress` (`--value`), **medidor com meta** `.meter` (ponto de equilíbrio: preenchimento, marca dourada na meta, "Faltam 10"), **ocupação** `.occ` (barra por psicólogo com marca dourada em 80%; âmbar acima; tracejado quando sem agenda, "n/d").
- **Termômetro do Zarit** `.thermo`: quatro segmentos proporcionais (21, 20, 20 e 28 valores de 89); marcador acima com o total, na posição `(pontos + 0,5) / 89`; a faixa atual fica cheia e as outras a 32%; embaixo, cada faixa com ícone, intervalo e rótulo; no celular só a atual mostra o rótulo por extenso. `role="img"` com "Pontuação 63 de 88, faixa Sobrecarga severa".
- **Matriz de risco 5 × 5** `.heat`: células com `data-level="low|mid|high"` (C até 4, de 5 a 11, 12 ou mais) **mostrando o número** P × I; riscos `R1` a `R12` como bolhas dentro da célula.

### 4.12 Linha do tempo, kanban, agenda, checklist, listas
- `.timeline` > `.timeline__item[--done|--attention|--danger|--gold]`: marcador, hora tabular, título, texto. Histórico de Zarit, log, passos de ocorrência, status do prestador. Log é append-only (sem editar).
- `.kanban` > `.kanban__col` > `.kanban__card`: credenciamento por estado (Solicitado, Em análise, Documentos pendentes, Aprovado, Reprovado); coluna vazia diz "Nenhum processo aqui". **Somente leitura e sem arrastar** (as mudanças são por decisão, e arrastar não tem alternativa acessível): cada cartão traz em uma frase "o que falta" ("faltam 2 critérios", "documento vencido") e abre a tela de decisão. No celular (abaixo de 768 px) vira **acordeão por estado**: o título é `button.kanban__head[aria-expanded]`, a coluna recolhe com `data-collapsed="true"` e a contagem fica no título.
- `.agenda` (grade `3,5 rem` + 5 dias, hora a hora, 56 px por hora, cabeçalho e coluna de horas fixos, rola dentro do contêiner): cada vaga é `.slot` com ícone, texto e cor: `--open` (circle-dashed "Aberta"), `--booked` (user), `--confirmed` (circle-check), `--priority` (star "Vaga prioritária"), `--blocked` (ban, hachurado), `--done` (check), `--noshow` (circle-alert "Falta"); hoje leva a linha dourada no cabeçalho do dia; legenda `.agenda-legend` sempre visível; a grade é `role="grid"` (setas movem entre células, Enter abre a vaga) e tem a linha do "agora". Semana e mês no `.segmented`; o mês mostra densidade (contagem por dia), não horários. **No celular não há grade espremida**: entra a **visão do dia**, com `.day-picker` (chips "seg 02" a "sex 06" mais Hoje) e uma `.list-card` de `.list-row` (hora, cuidador, selo de estado com ícone); deslizar entre dias é opcional.
- `.checklist` > `.checklist__item[data-state="ok|pending|fail|na"]`: ícone (circle-check, clock, circle-alert, circle-dashed), título, detalhe com data, selo à direita. Credenciamento (5 critérios), elegibilidade ao piloto. O botão "Aprovar" fica `disabled` com o texto "Faltam N critérios".
- `.list-row` (avatar, título e meta de uma linha cada, selo à direita; `--unread` ganha ponto dourado e título em negrito; `aria-current="true"` marca a linha aberta) em `.list-card`: caixa de entrada, fila de alertas, lista de cuidadores no modo lista e detalhe.
- `.dl` (lista descritiva: rótulo e valor) para fichas; 1 coluna no celular.

### 4.13 Stepper e assistente (wizard)
- `.stepper` > `.stepper__item[.is-done|aria-current="step"]` com `.stepper__dot` (número ou check) e `.stepper__label`; **só indicativo, nunca clicável** (voltar é pelo botão "Voltar"); abaixo de 768 px ele some e entra `.step-counter` ("Etapa 3 de 5: Consentimentos" mais a barra). No máximo 6 etapas. Cadastro de cuidador: Cuidador, Pessoa idosa, Consentimentos, Plano, Resumo; a última tela é o resumo com "Editar" por seção e uma ação primária que diz o resultado ("Criar cadastro"). Em `lg` o assistente pode abrir em duas colunas (formulário e resumo vivo, `.layout-main-aside`).
- **Assistente da escala de Zarit** (22 itens): `.wizard` com `.wizard__head` (contagem "Item 7 de 22", status "Rascunho salvo às 14:32", `.progress` com `role="progressbar"`), `.wizard__body` (pergunta em serifa 24 a 32 px, dica, `.likert` de cinco opções 0 a 4 com número grande e rótulo: Nunca, Raramente, Algumas vezes, Frequentemente, Sempre), `.item-map` (22 botões: respondido azul suave, atual azul cheio, **sem resposta** tracejado âmbar; no celular fica recolhido num `<details>`), `.wizard__foot` fixo (Voltar, Salvar e sair, Próximo; no último item, "Concluir" `disabled` enquanto faltar item, com a lista do que falta). Cada opção é um rádio nativo com nome acessível completo ("4, sempre ou quase sempre"); no celular os cinco botões empilham com 56 px; teclas 0 a 4 respondem e setas esquerda e direita navegam; o interruptor "Avançar automaticamente ao responder" é opcional (WCAG 3.2.2). Sem consentimento de saúde nada disto abre. Resultado e faixa só aparecem ao concluir.

---

## 5. Comportamento responsivo

| Largura | Shell | Conteúdo | Tabelas e listas | Formulários |
|---|---|---|---|---|
| **360** | topbar com menu (gaveta de 48 px por item), símbolo e ícones; busca vira ícone; rodapé de protótipo no fim; portal com barra inferior | uma coluna; KPIs 2 por linha; abas rolam; gráfico rola dentro do cartão (ou abas Gráfico e Tabela) | `.table--stack` em cartões; lista e detalhe em telas separadas (detalhe em tela cheia com "Voltar"); filtros em folha; kanban em acordeão; agenda em visão do dia | uma coluna; `.action-bar` fixa ao fim; formulário em folha inferior; Zarit com 5 botões empilhados de 56 px |
| **768** | topbar com busca por extenso; ainda gaveta | KPIs em faixa; formulário em 2 colunas | tabela volta a ser tabela com rolagem interna | 2 colunas; diálogo com ações em linha |
| **1024** | **trilho** de ícones 72 px; portal com barra sob o cabeçalho | margens 32 px; ficha com abas | tabela completa; lista com **gaveta acoplada de 480 px** (`.layout-list-detail`) | 2 colunas só para campos curtos |
| **1440** | menu **completo** 264 px | conteúdo máximo 1280 px; ficha com painel lateral "Precisa de atenção" de 21 rem (`xl`) | tabela confortável ou compacta | formulário centralizado em 48 rem |

Portal (`provider`): sempre uma coluna até 60 rem, barra inferior abaixo de `lg` (inclui tablet), barra sob o cabeçalho de `lg` em diante. Nenhuma tela tem rolagem horizontal da página (AC-GL-06): o que é largo rola dentro do próprio contêiner. Verificação: o guia de estilo mostra molduras reais em 360, 390, 768, 1024 e 1440 px.

---

## 6. Wireframes das telas-chave

Legenda: `[Botão]`, `(selo)`, `{campo}`, `[x]` marcado, `[ ]` vazio, `###` preenchimento, `...` mais itens. Sempre com a faixa de protótipo no rodapé (omitida nos desenhos para caber).

### 6.1 Entrada: seleção de perfil (SCR-M01-01) e segundo fator (SCR-M01-02), 1280
```
+--------------------------------+----------------------------------------------+
| (azul 900, mãos douradas 10%)  | (!) Protótipo de demonstração. Dados fictícios,|
|                                |     só neste navegador.        [Entendi]      |
|  [símbolo] N E X U S           |                                              |
|                                |  Entrar como                                 |
|                                |  Não há senha. A equipe confirma um código.  |
|                                |                                              |
|                                |  Equipe Nexus                                |
|  Quem cuida também precisa     |  +----------------------------------------+  |
|  de sustentação.               |  | (HP) Helena Prado Vasconcelos  (Código)|  |
|                                |  |      Sócia e gestão: indicadores        |  |
|  Back-office da Nexus.         |  | (CM) Dra. Cecília Montenegro   (Código)|  |
|  Escolha um perfil.            |  | (BN) Dra. Beatriz Nogueira     (Código)|  |
|                                |  | ... 8 da equipe                         |  |
|                                |  +----------------------------------------+  |
|                                |  Profissionais credenciados                  |
|                                |  | (EF) Dr. Eduardo Falcão              >  |  |
+--------------------------------+----------------------------------------------+
2FA: mesma coluna da direita: "Confirme o código" + código exibido na tela
(123456) em 40 px tabular + 6 caixas de 1 dígito (44 px) + [Confirmar]; erro
em .field__error; no 3º erro volta à lista. Celular: o painel azul vira faixa de 120 px.
```

### 6.2 Painel de cada perfil (SCR-M02-01)
Todos: `page-header` com saudação e frase do dia, depois o bloco "exige ação hoje" (banner ou fila), depois a faixa de KPIs, depois 2 colunas (principal + lateral).
```
partner (Sócio/Gestão)  [sem nome de cuidador; "menos de 5" abaixo do mínimo]
 Bom dia, Helena
 [KPI 17 assinantes][5,0% conversão][-R$ 842 resultado][Faltam 10 p/ equilíbrio ####..]
 +-- Assinantes por plano (rosca) ---+ +-- Rede ---------------------------+
 | Essencial 7  Cuida 5  Sustenta 5   | | (3 Excelência)(5 Alerta)(1 Desc.)  |
 +-- Resultado x projeção (barras) --+ | Credenciamentos pendentes: 3       |
 | M1 M2 ... linha do plano           | | Risco de saída: 2 prestadores      |
 +-- Equipe (ocupação, alerta 80%) --+ +-- Pendências ---------------------+
 | Dr. Rafael 91,3% ####|##          | | LGPD a vencer: 2  POPs: 1  Riscos:4|
technical_lead (Responsável técnica)
 [BANNER perigo: 1 vermelho do dia sem contato]  [BANNER: 1 vermelho vencido]
 [KPI vermelhos abertos][amarelos][ARBE críticos][ocorrências POP-05/07]
 +-- Fila de alertas (todos os casos) --+ +-- Validações pendentes -----------+
 | list-row ... (Severa 79) (vencido)   | | POP-09 conteúdos: 2 · POPs: 1       |
psychologist (Psicólogo)
 [Minha agenda de hoje (timeline 5 sessões)] [Minha fila: Zarit vencendo, alertas]
 [KPI ocupação do mês][sessões a registrar][tarefas "revisar rede de apoio"]
 (banner atenção só para Rafael: agenda acima de 80% por dois meses)
support (Atendimento)
 [Fila de mensagens por SLA: atrasadas primeiro (selo "atrasada 2 h")]
 [KPI reclamações abertas][solicitações sem retorno][solicitações LGPD a registrar]
 [cadastros novos][cancelamentos agendados]   (nenhum dado clínico)
provider (Profissional): ver 6.14
```

### 6.3 Cuidadores: lista (PD-01) e ficha com abas (PD-03, SCR-M03-01 e 03), 1440
```
Cuidadores  (340 cuidadores)                      [Exportar CSV] [+ Novo cuidador]
Visões:  Todas | Atrasadas | Minhas
(Buscar código ou nome)  (Plano: Cuida x)(Todos 340)(Livre 323)(Essencial 7)(Cuida 5)
[ ] Cuidador                      Plano     Status         Zarit              Horas/dia  ...
[ ] Ana Paula Ferraz  CUI-0042   (Cuida)   (Ativo)        (Em dia 12/01)        11      [Abrir] [Mais]
[ ] João Batista C.   CUI-0043   (Sustenta)(Ativo)        (Pendente 02/11)       9      [Abrir] [Mais]
[ ] Maria Aparecida L. CUI-0044  (Livre)   (Consent. pausado)(Sem consentimento) 6     [Abrir] [Mais]
Mostrando 1 a 25 de 340           < 1 2 3 ... 14 >          Por página: 25
```
```
< Cuidadores   Ana Paula Ferraz  CUI-0042                     [Editar] [Mais ações]
----
Resumo | Pessoa idosa e cuidados | Plano e cartão | Acompanhamento | Atendimento | Mais
+-- Conteúdo da aba ------------------------------+ +-- Precisa de atenção -----------+
| CPF ***.***.***-** [Mostrar]  Tel (34) 9****-0123 | | (!) Zarit vence em 5 dias       |
| Cidade Uberlândia   Horas por dia 11              | | (i) Piloto: 3 de 3 critérios    |
| Elegibilidade ao piloto  (3 de 3 critérios)       | +---------------------------------+
| Histórico (linha do tempo)                        |
+---------------------------------------------------+
```
A ficha é uma página própria (a lista **não** divide a tela com ela). Abas por permissão: as que o perfil nunca vê somem (`support` não vê Acompanhamento nem Atendimento); a que o perfil vê, mas sem condição (sem consentimento), mostra o estado informativo. No máximo 6 abas visíveis, o resto em "Mais"; a aba vai na URL; abrir aba sensível gera log `view`. Abaixo de 768 px a lista vira cartões e as abas rolam com indicação de "tem mais".

### 6.4 Aplicação da escala de Zarit (SCR-M06-02) e resultado (SCR-M06-03)
```
Aplicar escala · CUI-0042                            [Salvar e sair]
Item 7 de 22                              (v) Rascunho salvo às 14:32
[#########............................................]
+--------------------------------------------------------------+
|  Tenho receio do que o futuro reserva para ela.   (serifa 32)|
|  Pense nas últimas semanas. Não há resposta certa ou errada. |
|  [ 0 Nunca ][ 1 Raramente ][ 2 Algumas vezes ][ 3 Freq. ][ 4 Sempre ] |
+--------------------------------------------------------------+
Mapa: (1)(2)(!3 sem resposta)(4)(5)(6)[7](8)... (22)
[< Voltar]                    [Salvar e sair] [Próximo >]  (sticky no rodapé)
```
```
Resultado · CUI-0042 · 04/11/2026
  63  / 88   Sobrecarga severa                    (display serifa 40 + selo vermelho)
  [0 ###|###][21 ###][41 ###][61 ####▼63##### 88]   termômetro com faixas e ícones
  +-- Conduta da equipe ------------------+  +-- Alerta vermelho ----------------+
  | Contato no mesmo dia (até 23h59).      |  | ( relógio ) 06h 42min             |
  | Avaliação de risco. Encaminhar se      |  | [Registrar contato]               |
  | houver necessidade.                    |  | [Criar encaminhamento]            |
  +----------------------------------------+  +-----------------------------------+
  Evolução: adesão 66 · 3 meses 52 (-21,2%)    (linha com limite da faixa amarela)
```
Faixa amarela: no lugar do alerta vermelho, banner atenção "Revisar a rede de apoio da família" com `[Criar tarefa de revisão]` e o cuidador sobe na fila de agenda. Nunca a palavra "diagnóstico".

### 6.5 Fila de alertas (SCR-M06-01), técnica e psicólogo
```
Fila de acompanhamento      (Todos)(Vermelhos 2)(Amarelos 2)(ARBE 1)(Zarit vencendo 3)
ordem: vermelho vencido > vermelho do dia > ARBE crítico > amarelo > vencida > a vencer
+--------------------------------------------------------------------------------+
| (octógono) Maria Aparecida Lemos  CUI-0044  Severa · 79   (vencido há 18 h)  [Abrir]|
| (octógono) Ana Paula Ferraz       CUI-0042  Severa · 63   (06h 42min)        [Abrir]|
| (triângulo) João Batista Carneiro CUI-0043  Mod. a severa · 52  rede de apoio [Abrir]|
| (relógio)  Lúcia Helena Arantes   Zarit vence em 5 dias                      [Aplicar]|
+--------------------------------------------------------------------------------+
Vazio: [mãos] "Nenhum alerta aberto por aqui." + [Ver histórico]
```
Alerta vermelho aberto (SCR-M06-05): `.deadline` no topo, `.timeline` de contato, `.field` de avaliação de risco, encaminhamento (liga a M13), "Encerrar" `disabled` com a lista do que falta.

### 6.6 Credenciamento com checklist (SCR-M08-03 e 04)
```
Credenciamento                         (kanban em 5 colunas; celular: rola)
| Solicitado 1 | Em análise 1 | Docs pendentes 1 | Aprovado 0 | Reprovado 0 |
| Dra. Sônia   | Fisio em Casa| Cand. fisio      |  Nada por  |  Nada por   |
|  (há 2 dias) | ####..3/5    | (!venc.)         |  aqui      |  aqui       |
Processo · Dra. Sônia Peixoto · Odontologia
 Checklist (5 critérios)                          Documentos
 (v) Registro ativo no conselho  (Cumprido)       CRO fictício   válido até 30/06/2027
 (v) Comprovação de formação     (Cumprido)       Diploma        enviado
 (!) Documento na validade       (Vencido)        Contrato       [Anexar]
 (relógio) Integração concluída  (Pendente)       Cláusula LGPD  [Anexar]
 (-) Registro em conselho        (N/A)
 [Aprovar]  desabilitado: "Faltam 2 critérios"   [Reprovar com motivo] [Pedir documentos]
```

### 6.7 Ficha do prestador com ARP (SCR-M08-02)
```
Dr. Eduardo Falcão · Odontologia · CRO-MG 00000 (fictício)   (Ativo) [Suspender][...]
Dados | Documentos | Avaliações | Solicitações | Histórico | E-mails
+--- ARP (último snapshot 28/10/2026) ---+ +--- Sinais da rede ------------------+
| Média 4,7  (Excelência)                | | Taxa de recusa 30 dias  12,5%  (1/8) |
| ####################░ 5 avaliações      | | Disponibilidade: -10% vs 4 semanas   |
| Reclamações graves: 0                  | | (sem selo "risco de saída")          |
+----------------------------------------+ +--------------------------------------+
Avaliações (tabela): data · nota serviço · nota atendimento · comentário (sem identificar)
Linha do tempo de status: ativado, monitoramento, ...
Nenhum campo de comissão, taxa ou repasse (AC-M08-12).
```

### 6.8 Agenda do psicólogo (SCR-M05-01)
```
Agenda · Dra. Beatriz   (Semana|Mês) [<] 02 a 06/11 [>]   Psicólogo (v)  Modalidade (v)
legenda: (o Aberta)(u Reservada)(v Confirmada)(* Prioritária)(x Bloqueada)(ok Realizada)(! Falta)
      Seg 02   Ter 03   [Qua 04]  Qui 05   Sex 06
08:00 o Aberta v CUI-0051 o Aberta  o Aberta  * Prioritária
09:00 u CUI-0042 o Aberta u CUI-0044 ...
Ocupação do mês: 74,5% (parcial)   [Abrir vagas] [Redistribuir]
```
Rola dentro do contêiner; no celular o cabeçalho de dia e a coluna de horas ficam fixos. Clicar numa vaga aberta abre o diálogo "Agendar sessão" (valor e desconto do plano); sessão presencial no coworking exige sala com os 4 atributos de acessibilidade.

### 6.9 Financeiro com ponto de equilíbrio (SCR-M10-01), só `partner`
```
Financeiro                                      (Novembro/2026 v) [Exportar CSV]
[KPI Assinantes 17][Receita líquida R$ 1.511,49][Gastos R$ 2.355,00][Resultado -R$ 843,51]
+--- Ponto de equilíbrio ---------------------------------------------+
| 17 de 27 assinantes                    Faltam 10                    |
| [##########################----------|]  meta 27 (marca dourada)    |
+---------------------------------------------------------------------+
+--- Resultado mensal (barras) ---------+ +--- Cenários 3 | 5 | 7% ---+
| ▂▃▅▆ (negativo vermelho, positivo azul)| | (Cenário 5%) tabela mês a mês |
| linha do saldo (área) + zero tracejado | | marcos: primeiro lucro, retorno|
+----------------------------------------+ +------------------------------+
Todo gráfico: "Ver como tabela". "Referência literal do plano" ao lado da projeção.
```

### 6.10 LGPD: consentimentos e solicitações do titular (SCR-M12-01 e 03)
```
LGPD    Consentimentos | Termos | Solicitações | Log | Incidentes | Política | RIPD | Retenção
(Todos)(Revogados 2)(Pendentes 5)(Desatualizados 1)
Titular   Saúde  Analytics  Família  Imagem  WhatsApp  TCLE
CUI-0042   (ok)    (ok)      (ok)    (pend)   (ok)    (ok)       [Histórico]
CUI-0044   (rev)   (ok)      (-)     (-)      (-)     (-)        [Histórico]
Solicitações do titular (prazo de 15 dias)
 CUI-0042  Acesso aos dados      (3 dias)  (atenção)   [Atender]  -> abre gaveta
 CUI-0051  Eliminação            (vencida) (perigo)    [Atender]
Gaveta: tipo, titular, prazo, ações por tipo, texto de e-mail registrado, "Exportar JSON do titular".
```

### 6.11 Portal do profissional credenciado (M14), 390, mobile first
```
+--------------------------------+
| [símbolo] NEXUS     (sino)(EF) |
+--------------------------------+
| Olá, Dr. Eduardo               |
| ----                           |
| Você tem 2 pedidos novos e     |
| 1 documento a vencer.          |
|                                |
| Pedido novo       (Aguardando) |
| Atendimento odontológico       |
| domiciliar · Uberlândia.       |
| Os dados do cuidador aparecem  |
| depois que você aceita.        |
| [  Aceitar  ] [  Recusar  ]    |
|                                |
| Sua avaliação      Recusa 30d  |
| 4,7 (Em destaque)  12,5%       |
|                                |
| (!) Registro no conselho vence |
|     em 12 dias [Enviar novo]   |
+--------------------------------+
| Início Pedidos Agenda Aval. Doc|  barra inferior, 5 itens
+--------------------------------+
```
Sem números de outros prestadores, sem nada clínico. Faixa em linguagem neutra ("Em destaque", "Em acompanhamento"). Dados do cuidador só com solicitação aceita e cláusula assinada; sem a cláusula, o cartão mostra o banner "Assine a cláusula de proteção de dados para ver os dados do usuário".

### 6.12 Caixa de mensagens (PD-02 e PD-05, SCR-M11-01 e 02), 1440
```
Mensagens   (Todas)(App)(WhatsApp)(Telefone)(E-mail)           [Registrar contato]
+------------------------------------------+ +----------------------------------------+
| Atrasadas (2)                             | | < 3 de 28 >   Ana Paula Ferraz   [x]   |
| * (AF) Ana Paula Ferraz   (atrasada 2 h)  | | WhatsApp · prazo hoje 17:00 (atrasada)  |
| * (JB) João Batista   (atrasada 1 h)      | | "Preciso remarcar a sessão de quinta."  |
| No prazo (26)                             | | [Assumir]  [Pedido de apoio]  (Vincular)|
|   (MA) Maria A.  (faltam 1 h 20 min úteis)| | {resposta}  [Usar modelo v] [Enviar]    |
+------------------------------------------+ +----------------------------------------+
   lista (.list-card)                            gaveta acoplada de 480 px (.drawer--docked)
```
Atrasadas sempre primeiro e em seção própria. A gaveta não cobre filtros nem contador; Esc fecha e devolve o foco à linha. Abaixo de 1024 px o detalhe é tela inteira com "Voltar".

---

## 7. Diretrizes de conteúdo visual

### 7.1 Tom de voz
Acolhedor, direto, sem jargão clínico. Trata a pessoa como adulta; não infantiliza, não romantiza o sacrifício (nunca "guerreira", "anjo", "heroína"), não promete resultado terapêutico, nunca usa "diagnóstico" nem "eficácia" para a escala. Frases curtas, verbo no início do botão, sem ponto de exclamação, sem travessão (vírgula, ponto, dois-pontos). Nome do que a pessoa faz, não o do sistema: "Registrar contato", não "Submeter".

| Em vez de | Escreva |
|---|---|
| Erro 500 | Não foi possível salvar. Tente de novo; se continuar, avise a equipe |
| Este campo é obrigatório | Informe a data de nascimento |
| CPF inválido | Parece um CPF real. Use um CPF fictício |
| Paciente em surto | Sobrecarga severa, contato até 23h59 |
| Você não tem permissão | Esta página não está disponível para o seu perfil (sem dizer se o recurso existe) |
| Tem certeza? | Encerrar o cadastro de CUI-0042? E a lista do que será eliminado e bloqueado |

### 7.2 Estados vazios acolhedores
Título serifado curto, uma frase que explica o que aparece ali e quando, e a ação sugerida. Ilustração: as mãos da marca, com um círculo pontilhado onde ainda não há ninguém. Exemplos:

| Tela | Título | Texto | Ação |
|---|---|---|---|
| Fila de alertas | Nenhum alerta aberto por aqui | Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila | Ver histórico |
| Cuidadores (busca sem resultado) | Nada encontrado para "Márcia" | Confira o código ou o nome e tente de novo, ou limpe os filtros | Limpar filtros |
| Agenda do dia | Hoje não há sessões | Aproveite para abrir vagas ou revisar a fila de acompanhamento | Abrir vagas |
| Mensagens | Caixa em dia | Todas as mensagens foram respondidas dentro do prazo | n/a |
| Solicitações (profissional) | Nenhum pedido novo | Quando um cuidador pedir um serviço seu, ele aparece aqui | Atualizar disponibilidade |
| Quadro de estados | Nenhum processo aqui | Nenhum prestador nesta etapa | n/a |
| Busca de rede (sem ativo) | Nenhuma opção disponível no momento | Sugerimos encaminhar pela rede de apoio | Criar encaminhamento |
| Acompanhamento sem consentimento | Sem consentimento de saúde | A escala só pode ser aplicada com o consentimento ativo | Ver consentimentos |

### 7.3 Como mostrar o alerta vermelho com seriedade, sem alarmismo
1. **Cor e forma juntas:** octógono, texto "Sobrecarga severa" e a pontuação, em vermelho de contraste alto (texto `#7A1A12` sobre `#FDEEEC`, 9,4:1). A cor ocupa selo, ícone e banner, nunca a tela inteira.
2. **Nada pisca, pulsa ou balança.** Sem som, sem modal que bloqueia, sem exclamação. O relógio é um número calmo (`06h 42min`).
3. **O prazo é o centro:** "Contato até 23h59 de hoje" e o tempo restante em tabular; vencido vira "vencido há 18 h", mesma cor.
4. **Uma ação clara:** "Registrar contato" (primário). A segunda ação é "Criar encaminhamento". Nada de cinco botões.
5. **Linguagem factual, não clínica:** descrever o dado ("escala aplicada às 08:40 com 63 pontos"), nunca rotular a pessoa ("paciente em risco"). Sem "diagnóstico".
6. **Quem vê:** só psicólogo do caso e responsável técnica; `partner` e `support` nunca veem o alerta individual (só "aplicação pendente" ou "em dia", e contagens com mínimo de 5).
7. **Amarelo é mais leve:** banner de atenção (âmbar, triângulo), tarefa "revisar a rede de apoio da família", sem prazo de relógio.
8. **Fechar o ciclo:** o alerta só encerra com horário do contato, quem fez, avaliação de risco e encaminhamento; "Encerrar" fica `disabled` com a lista do que falta.

### 7.4 Catálogo de mensagens de erro (uma por tipo; mesma frase no campo e no resumo)
| Tipo | Mensagem |
|---|---|
| Vazio | Informe {o que}. Ex.: "Informe a data de nascimento" |
| Formato | {O campo} deve estar no formato {x}. Ex.: "O telefone deve estar no formato (34) 90000-0000" |
| Menor de idade | A pessoa cuidadora deve ter 18 anos ou mais |
| Dado real | Parece um CPF real. Use um CPF fictício |
| E-mail | Use um e-mail que termine em @exemplo.com.br |
| Fora do intervalo | As horas por dia devem ser de 0 a 24 |
| Duplicado | Já existe um cadastro com este código |
| Sistema | Não foi possível salvar. Tente de novo; se continuar, avise a equipe |

---

## 8. Acessibilidade e checklist

- Contraste: texto 4,5:1 ou mais em todos os pares (script de verificação no processo; tabelas de 3.1); componentes de UI 3:1 (`--border-control`, ícones de estado, foco).
- Teclado: tudo se opera por teclado; ordem do DOM = ordem visual; link de pular conteúdo; foco visível (anel de 2 px, recuo de 2 px); abas e menus com setas, Esc fecha, foco volta ao gatilho.
- Leitor de tela: um `h1` por tela; marcos `header`, `nav`, `main`, `aside`, `footer` com `aria-label`; tabela com `<caption class="sr-only">` e `aria-sort`; erro com prefixo oculto; gráficos com `role="img"` e tabela alternativa; toast em região `aria-live`.
- Alvos: 44 px em toque (campos, botões, itens de menu, chips, abas, linha de lista).
- Movimento reduzido: durações zeradas; esqueleto sem brilho.
- Cor nunca sozinha: selos com texto, faixas do Zarit com ícone, agenda com ícone e rótulo, riscos com número.
- Entrada de dado: rótulo visível, dica, erro com a ação de correção, dados mantidos ao errar.
- Impressão: `.sensitive` mostra marca d'água "Confidencial" (LP-13) e esconde menu, barra e rodapé.

---

## 9. Notas para o Dev

1. **Importar:** `src/styles.scss` já usa `@use`. Os componentes de tela só usam as classes deste documento; SCSS de componente Angular fica para exceções raras (limite de 4 kB por componente no `angular.json`).
2. **Fontes e ícones:** locais. O Angular empacota as fontes em `media/`; verifiquei o build de estilos. O sprite fica em `public/icons/sprite.svg`; para ter o `<use>` sempre resolvido, também é possível embutir o sprite no `index.html`.
3. **Nunca usar hex nem `px` solto em SCSS novo:** só `var(--...)`. Tamanho de fonte pelos tokens `--fs-*`, raio pelos `--radius-*`.
4. **Tema escuro:** `ThemeService` altera `data-theme` no `<html>` e grava a preferência pelo repositório (nada de `localStorage` direto).
5. **Diálogo e gaveta:** `<dialog>` nativo com `showModal()`; fechar devolve o foco; não usar `@if` para montar e desmontar sem devolver o foco.
6. **Lógica que o CSS não faz:** remascarar o campo depois de 30 s; pausar o toast em hover e foco; colapsar colunas do kanban no celular (`data-collapsed`); atalhos do `04-ux.md` 5.16; foco devolvido ao gatilho; `aria-live` nas contagens.
7. **Tabela empilhada:** todo `<td>` precisa de `data-label` para o cartão do celular; ofereça "selecionar todos" fora do cabeçalho (ele some).
8. **Menu lateral por perfil:** montar a lista a partir do RBAC; `data-nav-open` na gaveta; `aria-current="page"` no item da rota ativa.
9. **Formulário em grade:** `.form-grid > .field` usa subgrid; não envolver cada `.field` em `div` extra.
10. **Gráficos:** gerar o SVG nos componentes com as fórmulas de 4.11 (exemplo vivo no `docs/styleguide.html`); nunca biblioteca externa.
11. **Pseudonimização:** `partner` só recebe `CUI-0000` (`.code-chip`); nenhum campo oculto no DOM com o nome (esconder no CSS não vale).
12. **Dinheiro e datas:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; números em `.t-num`.
13. **Regenerar:** `node tools/brand.mjs` (marca), `node tools/build-icons.mjs` (sprite), `node tools/build-styleguide.mjs` (guia de estilo).

---

## 10. Alinhamento com o documento de UX (`docs/04-ux.md`)

O `04-ux.md` foi lido depois deste documento e já usa o vocabulário do guia de estilo (seção 12 dele). Esta seção registra o que foi conferido, o que foi acrescentado ao CSS por pedido dele e como cada padrão (PD) se monta com os componentes. Ele não foi editado.

### 10.1 Padrões de tela (PD-01 a PD-17) e componentes

| Padrão do UX | Montagem com o design system |
|---|---|
| PD-01 Lista com filtros e ações em lote | `.page-header` (contador e ação primária), visões em `.tabs`, `.table-toolbar` (busca, `.chip-group`, densidade), `.selection-bar`, `.table-wrap > .table`, `.table-footer` e `.pagination` |
| PD-02 Lista e detalhe em gaveta lateral | `.layout-list-detail` (lista mais coluna de 30 rem) com `.list-card` e `.drawer--docked` (480 px, não modal); abaixo de `lg`, tela inteira com "Voltar" |
| PD-03 Ficha com abas | `.tabs` (até 6 visíveis), `.tab-panel`, `.layout-main-aside` com o cartão "Precisa de atenção" |
| PD-04 Assistente | `.stepper` (indicativo) e `.step-counter` no celular, `.form-grid`, `.form-actions` ou `.action-bar`, resumo final com "Editar" por seção |
| PD-05 Caixa de entrada com prazo | `.list-row` (`--unread`), selo de prazo (`.badge` mais relógio), seção "Atrasadas (5)" no topo |
| PD-06 Quadro de estados (somente leitura) | `.kanban` (acordeão por estado no celular), cartões com "o que falta" |
| PD-07 Agenda semanal | `.agenda`, `.slot--*`, `.agenda-legend`; celular: `.day-picker` e `.list-card` |
| PD-08 Painel de indicadores | `.kpi-strip` (ou `a.kpi` clicável), `.chart`, `.card` |
| PD-09 Tela de foco | o shell com `data-nav="rail"` e coluna estreita (`.page--narrow`) mais `.wizard`, anotação sigilosa ou alerta vermelho; sem distração, com `.action-bar` fixa |
| PD-10 Diálogo de efeito | `.dialog` com `.dialog__icon--danger` e `.effects` (Será eliminado, Ficará bloqueado, Continua registrado); nível 3 com "digitar para confirmar" |
| PD-11 Gaveta lateral de formulário | `.drawer` ou, no celular, `.dialog--sheet` (folha inferior), com `.field` |
| PD-12 Portão de acesso | `.card` com `.empty__icon`, explicação, `.popover` de motivo (`.radio` mais "Outro") |
| PD-13 Campo mascarado | `.masked` (botão com ícone e texto) e `.code-chip` |
| PD-14 Selo de prazo e cronômetro | `.badge` com `clock`; `.deadline` (`role="timer"`) |
| PD-15 Linha do tempo | `.timeline` |
| PD-16 Estados | `.empty` (vazio, acolhedor), `.empty__icon` (erro e 403), `.skeleton`, `.banner--attention` (offline) |
| PD-17 Toast e faixa | `.toast` (6 s, pausa, Desfazer), `.banner` |

### 10.2 O que o UX pediu e o guia passou a ter (seção 12.2 dele)

| Pedido do UX | Resposta no CSS e no guia de estilo |
|---|---|
| Paleta de comandos e campo de busca da barra | `.cmdk` (`__input`, `__list`, `__group`, `__item`, `__foot`) e `.search-trigger` |
| Painel de notificações | `.popover` (22,5 rem) com `.list-row--unread`; página inteira no celular |
| Popover de motivo e portão de acesso | `.popover` com `.radio` e `.field`; `.card` com `.empty__icon` |
| Cronômetro de prazo e selo de prazo | `.deadline` e `.badge` com relógio |
| Digitar para confirmar | `.field` mais `.input` dentro de `.dialog__body` (receita na seção 4.5) |
| Folha inferior | `.dialog--sheet` (abaixo de 768 px) |
| Seletor de nota de 1 a 5 | `.rating` (botões numerados, rádio nativo) |
| Agenda do dia (celular) | `.day-picker` mais lista de vagas |
| Barra de ação fixa inferior | `.action-bar` e `scroll-padding` no `html` |
| Chave "Avançar automaticamente" | `.switch` ao lado do assistente |

### 10.3 Respostas aos cinco pontos do UX (seção 12.4 dele)

1. **Dado de exemplo:** o cartão "Resultado do mês" mostra agora `-R$ 843,51`, o valor do seed (AC-M10-05), e o wireframe 6.9 usa receita líquida de R$ 1.511,49, gastos de R$ 2.355,00 e o mesmo resultado.
2. **Dourado como texto:** mantido; texto sempre no 800 (6,6:1), a cor da marca #B8901F só em linha e logo.
3. **Botão de mostrar dado:** passou a levar ícone **e** texto ("Mostrar" e "Ocultar"); o Dev remascara em 30 s.
4. **Toast:** 6 s, pausa com hover e foco, botão "Desfazer" (`.toast__action`).
5. **Alvos de toque:** `--control-h-sm` sobe a 44 px com `pointer: coarse`; a caixa de seleção da tabela e o link de linha (`.row-link`) acompanham essa altura; item do menu na gaveta do celular tem 48 px.

### 10.4 Pontos conferidos e ajustes que fiz por causa do UX
- Menu: **264 px** (era 256), grupos e nomes do `04-ux.md` 3.2, grupos **recolhíveis**, item de 48 px na gaveta, e o botão de menu da barra também abre o menu completo **sobre o conteúdo** em 1024 a 1279 px (`04-ux.md` 3.10).
- Portal: barra inferior de **56 px** com cinco destinos (Início, Solicitações, Disponibilidade, Mensagens, Mais), mantida também no **tablet** (até 1023 px).
- Lista e detalhe: gaveta lateral **acoplada de 480 px** (PD-02); a ficha do cuidador é página própria (PD-03).
- Stepper só indicativo; contador "Etapa X de Y" no celular; mapa dos itens recolhido no celular; Zarit com cinco botões de 56 px empilhados.
- Quadro de estados **sem arrastar**, em acordeão no celular; texto "Nenhum processo aqui".
- Consentimento com os quatro estados: Ativo, Recusado, Revogado, Pendente.
- Selo de estado sempre com ponto ou ícone e texto.
- Divergência que **fica**: o `04-ux.md` pede os quatro tamanhos de teste (360, 768, 1024, 1440) e este guia mostra também 390; o 390 é só uma moldura extra do celular, sem regra própria.
- Vocabulário: "gaveta lateral" é o `.drawer` (detalhe e formulário curto); o menu do celular é "gaveta do menu" (`.sidebar` com `data-nav-open`).
