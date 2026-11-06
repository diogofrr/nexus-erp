Status: A pronta | B pronta | C pronta | D pronta

# Aplicativo do cuidador: UX e UI

Documento da pessoa de UX e UI do **aplicativo do cuidador** do Nexus ERP. Fonte única de comportamento e visual para a Base (Dev F), os três devs de página (P1, P2, P3), o QA e o CS/CX. Parte de `docs/10-cuidador-contexto.md` (navegação, rotas e decisões do dono, **não reabertas aqui**), das regras de `docs/01-regras-de-negocio.md` e do design system (`docs/03-design-system.md`, `docs/styleguide.html`). Nenhuma regra de negócio é alterada. Onde as regras e o plano são omissos, a escolha está marcada `[S-nn]` (suposição de protótipo, lista na Parte D). O que exige mudar a navegação, as rotas ou arquivo de outra posse está em "Pedidos ao líder" (Parte D), **sem ser aplicado**.

## 0. Como usar este documento

| Se você é | Leia primeiro | Depois |
|---|---|---|
| Base (Dev F) | Parte A inteira (tema, componentes, responsivo, ícones, AC-CG-01 a 16), B0 | Parte C: telas 1 (Entrada) e 17 (Mais); Parte D: suposições e pedidos |
| P1 (`start`, `today`, `routine`, `family`) | Parte A.1 a A.3, B1 a B3 e B13 | Parte C: telas 2, 4, 5, 6, 20 e 22 `[P-02]` |
| P2 (`care`, `my-wellbeing`, `help`, `privacy`) | Parte A, B4, B5, B10 a B12 e B14 | Parte C: telas 3, 7, 8, 9, 19 e 21 `[P-02]` |
| P3 (`network`, `card`, `plan`, `groups`, `content`) | Parte A, B6 a B9 | Parte C: telas 10 a 16 e 18 |
| QA e CS/CX | Parte D (checklist), todos os `AC-CG-NN` | Parte B como roteiro de teste |

A divisão das telas entre os devs é **sugestão** (o contexto não nomeia o dono da porta Cuidar de mim, da porta Mais e do Meu perfil): pedido `[P-02]`. A numeração das telas na Parte C é: 1 Entrada, 2 Começar, 3 Ajuda agora, 4 Hoje, 5 Agenda, 6 Remédios, 7 Cuidar de mim, 8 Conversar com um psicólogo, 9 Como estou, 10 Grupos e capacitações, 11 Conteúdos, 12 Rede, 13 Buscar, 14 Profissional, 15 Meus pedidos, 16 Cartão Nexus, 17 Mais, 18 Meu plano, 19 Falar com a Nexus, 20 Família, 21 Privacidade e meus dados, 22 Meu perfil.

Convenções:
- **Toque** = uma interação (toque, clique ou tecla), contada **a partir da tela Hoje**, sem contar digitação de texto livre. Metas de tempo: a da tabela do teste dos 2 minutos (D.3.2) vale para a primeira tentativa, sem ajuda; nos fluxos da Parte B, o "máximo" é de toques, não de tempo.
- Exemplos usam "hoje" = quarta-feira, **04/11/2026** (o mesmo do `docs/04-ux.md`) e os nomes do seed.
- Blocos marcados **Texto** são **texto real de interface** (pt-BR), para copiar. Frases curtas, sem travessão, sem ponto de exclamação, sem emoji. Fala em "você". Chama de "pessoa idosa" (nunca "idoso", "paciente"). Nada de "guerreira", "anjo", "heroína", nada de promessa de resultado, nada de "diagnóstico" (só na frase "não é um diagnóstico") e nunca "eficácia".
- Nomes de componente (`app-cg-*`) e de classe (`.cg-*`) são sugestões fortes; os **tokens `--cg-*`** e as **medidas** são o contrato. A Base pode renomear componentes se mantiver tokens e medidas.
- Datas: "hoje", "amanhã", "ontem" para ±1 dia; depois, "qui, 06/11"; ano só quando não é o corrente. Hora `14:00`. Dinheiro `R$ 120,00`. Percentual `15%`. Dias "faltam 12 dias".
- Identificadores de código em inglês; todo texto em pt-BR.

## 0.1 Princípios de desenho

O dono disse: "tem MUITA informação, essa plataforma é para o CLIENTE". Cada decisão abaixo existe para uma pessoa cansada, com 2 minutos e uma mão ocupada.

| # | Princípio | O que muda na prática |
|---|---|---|
| 1 | **Uma tela, um propósito, uma ação principal** | No máximo um botão primário visível por tela; o resto é secundário ou botão de texto |
| 2 | **Primeiro o do dia; o resto atrás de um toque** | Hoje mostra 3 coisas de cara; histórico, detalhes, comparações e textos legais ficam recolhidos |
| 3 | **Palavras de todo dia** | "cansaço" na tela; "sobrecarga" só no nome oficial da faixa. "Conversa", não "sessão". "Remédio", não "medicamento" |
| 4 | **Nada depende só do app** | Telefone e WhatsApp a um toque, em Hoje, Ajuda agora e Mais (RN-CAN-05, RN-USR-18) |
| 5 | **Calma, sem alarme** | Sem vermelho para o que é emocional, sem contagem regressiva, sem número assustador em destaque (RN-ETICA-15, RN-ZRT-18) |
| 6 | **Quem decide é a pessoa** | Toda confirmação diz o efeito, dá uma saída clara ("Voltar") e, onde dá, "Desfazer" |
| 7 | **Nunca vender na hora da fragilidade** | Plano é informação neutra; nada de plano, desconto ou upgrade ligado a Zarit, alerta ou ARBE (RN-PLN-19, RN-LGPD-17) |
| 8 | **Uma mão** | Em folhas e formulários, a ação principal fica embaixo, ao alcance do polegar; nada exige arrastar, pinça, toque longo ou duplo toque |

**Referências** (aplicadas por conhecimento consolidado; **nesta rodada não houve consulta nova na web**, e o conteúdo do Origamid não pôde ser verificado, como já registrado no `docs/03-design-system.md`): Origamid (hierarquia por peso e cor, o espaço agrupa, contraste, uma tipografia com propósito); Apple Saúde (resumo em cartões grandes, um dado por vez, o detalhe depois do toque); Headspace (uma ação por tela, tom calmo, sem pressão, sem contagem de "dias seguidos"); apps de banco com poucos toques (ação principal presa embaixo, confirmação que diz o efeito, comprovante na tela); Airbnb (cartão grande e escaneável, filtros em chips, comparar sem sair da lista); GOV.UK (uma pergunta por vez, erro junto do campo, não limpar o que a pessoa digitou); Material 3 e WCAG 2.2 (alvo de toque de 48 px, foco não encoberto, alternativa a arrastar).

---

## 0.2 O que mudou depois da rodada de CS/CX (docs/14 e docs/15)

Este quadro resume o que o CS/CX e o QA pediram e o que o desenho passou a dizer. O texto e os critérios de aceite das partes seguintes já estão atualizados onde mudaram; o detalhe (arquivos, conferência, o que ficou de fora) está em `docs/15-correcoes-cuidador-b.md`.

| Achado | O que o desenho diz agora |
|---|---|
| CXC-001 | O item de lista (A.2.6) dá ao texto largura mínima (`10em`) e a etiqueta (`[cgRowEnd]`) **desce para baixo do título** quando não cabe ao lado; vale nos três tamanhos de letra. |
| CXC-002 | Um só componente de humor (A.2.11) para Hoje e Como estou, sempre em largura total (5 rostos na letra Normal; lista vertical em Grande e Bem grande). |
| QAC-009 | `app-cg-card`, `app-cg-plan-lock` e o estado vazio têm `headingLevel` (padrão 2; 3 dentro de seção com `h2`): nenhuma tela pula de h1 para h3. |
| CXC-013 | O botão voltar do aparelho **fecha a folha** e **desfaz um passo** (marcar conversa, cadastro) com **uma entrada de histórico por camada** (mesmo endereço, sem parâmetro na URL). |
| QAC-010 | O shell mostra uma **faixa calma** quando o navegador não guarda ("O navegador não está guardando o que você faz. Libere espaço ou o armazenamento do site e recarregue."); o aviso do Dei diz "mas não foi guardado". |
| CXC-014 | A entrada tem **Ajuda agora** na faixa de marca e **Criar minha conta** logo abaixo do título da porta; a lista de pessoas de demonstração vem depois. |
| CXC-016 | "Como falar com a gente" mostra só o canal preferido e o telefone; os outros ficam atrás de **Mais jeitos**. O e-mail não quebra no meio e o resultado de "Copiar" fica junto do botão (falha em cor de aviso). |
| CXC-017 | **Um aviso só** por ação: ou a faixa da tela ou o aviso rápido (fica o aviso rápido onde há "Desfazer" e nenhuma faixa). Com aviso rápido na tela o conteúdo ganha folga embaixo. |
| CXC-018 | **Remarcar** um compromisso abre só o dia e a hora. |
| CXC-019 | Sem jargão na tela: "Para aprender e trocar" (e não "psicoeducação"), "Grupo com psicólogo" e "Psicoterapia em grupo", "Conversas regulares com o mesmo psicólogo" (e não "objetivo clínico"), "ajuda com o cansaço" (e não "escala de cansaço do cuidador"), "Resultados sem o seu nome" (e não "números somados"). O registro do conselho do profissional da rede só aparece na ficha dele. |
| CXC-020 | A leitura do dia diz o tempo real do texto; "Para você" não se repete; "Faltam N dias para a resposta"; o assunto da mensagem à equipe diz "(opcional)". |
| CXC-021 | Em Grupos, quem não tem acesso vê "Plano Cuida" na própria linha e a roda aberta primeiro; o que a pessoa já faz fica só em "Minhas inscrições". |
| CXC-022 e CXC-023 | A entrada respeita a letra Grande e Bem grande; a palavra NEXUS não some do cabeçalho; o aviso de protótipo aparece **uma vez** por tela; o resumo de erros é **curto** (diz quantos pontos, sem repetir a lista; com um ponto só nem aparece e o foco vai ao campo). |
| CXC-024 | Em Meu perfil o CPF começa recolhido ("Mostrar") e o rótulo das horas fica em cima da linha "menos, número, mais". |
| CXC-026 | O Cartão mostra as 3 últimas compras e o total, com "Ver todas". |
| CXC-028 | Hoje diz, em uma linha, que o humor está pausado quando a pessoa retirou a autorização de saúde. |

# PARTE A. Visual e componentes

## A.1 Tema do cuidador: o que fica e o que muda

O app do cuidador é uma **variação do design system**, ativada por uma classe no host do shell: `<div class="cg-app" data-text="normal">`. Tudo vive em `src/styles/_caregiver.scss` (posse da Base) e só vale dentro de `.cg-app`.

| Fica (igual ao ERP) | Muda no app do cuidador |
|---|---|
| DM Serif Display nos títulos, Figtree no corpo | Corpo em **18 px** (ERP: 16); legenda mínima de 14 px (ERP: 12) |
| Azul institucional em título, ação e seleção; dourado só em detalhe | Alvo de toque **48 px ou mais** (ERP: 44, e 32 com mouse); botão principal de 56 px |
| Fundo off-white `--canvas` e cartões brancos de borda fina | Cartões com raio de 16 px e mais respiro (padding 20 a 24 px) |
| Tokens semânticos, `--success-*`, `--danger-*`, `--plan-*` | Estados **calmos**: o vermelho só em erro de formulário e em confirmação de ato irreversível |
| Ícones Lucide do sprite, `appIcon` | Texto de apoio com contraste maior (`--cg-text-soft`, 8,3:1) |
| Foco visível, `ToastService`, `app-form-field`, `appMask`, `ERROR_MESSAGES` (adaptadas ao "você") | Foco de 3 px; confirmações em **folha de baixo** no celular |
| Aviso de protótipo, formatos pt-BR | Navegação por barra inferior (celular) e topo (tela larga); sem menu lateral |

**Não usar no app do cuidador** (são de painel): `.table`, `.kanban`, `.agenda`, `.kpi-strip`, `.chart`, `.thermo`, `.heat`, `.cmdk`, `.drawer`, `.masked`, `.code-chip`, densidade compacta, atalhos de uma tecla, faixas do Zarit em vermelho com octógono.

**Tema escuro: fora do protótipo do cuidador** `[S-01]`. Ao montar o shell, a Base força `data-theme="light"` no `<html>` (sem gravar preferência) e restaura ao sair. `.cg-app { color-scheme: light; }`.

### A.1.1 Tokens para copiar (`src/styles/_caregiver.scss`)

```scss
// Posse: Base. Host: <div class="cg-app" data-text="normal | large | xlarge">
.cg-app {
  color-scheme: light;

  // ---- Letra: o seletor "Tamanho da letra" troca data-text no host ---------
  --cg-zoom: 1;
  &[data-text='large']  { --cg-zoom: 1.111; }   // corpo 20 px
  &[data-text='xlarge'] { --cg-zoom: 1.222; }   // corpo 22 px

  --cg-fs-caption: calc(0.875rem * var(--cg-zoom)); // 14 | 15,6 | 17,1  (apoio; nunca a única informação)
  --cg-fs-small:   calc(1rem * var(--cg-zoom));     // 16 | 17,8 | 19,6  (texto de apoio em cartão)
  --cg-fs-body:    calc(1.125rem * var(--cg-zoom)); // 18 | 20   | 22    (corpo, campo, botão)
  --cg-fs-lead:    calc(1.25rem * var(--cg-zoom));  // 20 | 22,2 | 24,4  (título de cartão, h3)
  --cg-fs-h2:      calc(1.5rem * var(--cg-zoom));   // 24 | 26,7 | 29,3  (serifa)
  --cg-fs-h1:      calc(1.75rem * var(--cg-zoom));  // 28 | 31,1 | 34,2  (serifa; 32 | 35,6 | 39,1 em >= 768)
  --cg-fs-nav:     calc(0.875rem * min(var(--cg-zoom), 1.15)); // rótulo da barra: 14 | 15,6 | 16,1
  @media (min-width: 48rem) { --cg-fs-h1: calc(2rem * var(--cg-zoom)); }

  // Faz os componentes do design system acompanharem (.btn, .input, .card, app-form-field)
  --fs-sm: var(--cg-fs-small);
  --fs-md: var(--cg-fs-body);
  --fs-lg: var(--cg-fs-lead);
  --fs-2xl: var(--cg-fs-h2);
  --fs-3xl: var(--cg-fs-h1);
  --control-h: 3rem;      // 48
  --control-h-sm: 3rem;   // 48 (não existe controle compacto)

  font-size: var(--cg-fs-body);
  line-height: 1.55;
  color: var(--cg-text);
  background: var(--cg-bg);

  // ---- Medidas -------------------------------------------------------------
  --cg-target: 3rem;        // 48  alvo mínimo de toque (largura e altura)
  --cg-target-lg: 3.5rem;   // 56  botão principal, linha de escolha
  --cg-row-h: 4rem;         // 64  item de lista de uma linha (72 com duas)
  --cg-header-h: 4rem;      // 64  (4.5rem = 72 em >= 1024)
  --cg-nav-h: 4rem;         // 64 + env(safe-area-inset-bottom)
  --cg-col: 45rem;          // 720 coluna no celular e no tablet
  --cg-col-wide: 60rem;     // 960 coluna central em tela larga
  --cg-reading: 40rem;      // 640 formulário e texto longo
  --cg-gutter: 1rem;        // 16 | 24 em >= 768 | 32 em >= 1024
  --cg-gap-block: 1.5rem;   // 24 entre cartões
  --cg-gap-stack: 0.75rem;  // 12 dentro do cartão e entre botões
  --cg-pad-card: 1.25rem;   // 20 | 24 em >= 768
  @media (min-width: 48rem)  { --cg-gutter: 1.5rem; --cg-pad-card: 1.5rem; }
  @media (min-width: 64rem)  { --cg-gutter: 2rem; --cg-header-h: 4.5rem; }

  // ---- Raios e sombras -----------------------------------------------------
  --cg-radius-card: 1rem;           // 16
  --cg-radius-control: 0.75rem;     // 12 botão, campo, linha de escolha
  --cg-radius-sheet: 1.5rem 1.5rem 0 0; // 24 folha de baixo
  --cg-radius-pill: 62.5rem;
  --cg-shadow-nav: 0 -4px 16px rgb(19 51 80 / 0.08);
  --cg-shadow-sheet: var(--shadow-4);
  --cg-shadow-toast: var(--shadow-3);
  // cartão: sem sombra, só borda (elevação 0)

  // ---- Cores (primitivos do DS, sempre claros) -----------------------------
  --cg-bg: var(--nx-paper-100);            // #F7F5F0
  --cg-surface: var(--nx-slate-0);         // #FFFFFF
  --cg-surface-sunken: var(--nx-paper-200);// #F0EDE5
  --cg-text: var(--nx-slate-800);          // #28323D  11,9:1 no fundo
  --cg-text-soft: var(--nx-slate-700);     // #3F4A56   8,3:1 no fundo
  --cg-heading: var(--nx-blue-800);        // #1B4669   9,1:1
  --cg-action: var(--nx-blue-700);         // #235A87   7,3:1 com texto branco
  --cg-action-hover: var(--nx-blue-800);   // #1B4669
  --cg-action-press: var(--nx-blue-900);   // #133350
  --cg-link: var(--nx-blue-700);           // #235A87
  --cg-border: #d8d4c8;                    // contorno de cartão (decorativo)
  --cg-border-subtle: #e8e5dc;             // separador de lista
  --cg-border-control: #6b7783;            // contorno de campo e botão (4,6:1; NOVO hex)
  --cg-focus: var(--nx-blue-900);          // anel de 3 px, recuo de 3 px (12:1)
  --cg-focus-on-dark: #ffffff;
  --cg-gold-line: var(--nx-gold-500);      // #B8901F  só decoração (linha, item atual)

  // Estados calmos (cada um: bg, borda, texto, ícone)
  --cg-care-bg: var(--nx-blue-50);         --cg-care-border: var(--nx-blue-200);
  --cg-care-fg: var(--nx-blue-800);        --cg-care-icon: var(--nx-blue-600);   // 8,7:1 | 4,9:1
  --cg-soft-bg: var(--nx-paper-200);       --cg-soft-border: #d8d4c8;
  --cg-soft-fg: var(--nx-slate-700);       --cg-soft-icon: var(--nx-slate-600);  // 7,7:1
  --cg-ok-bg: var(--nx-green-50);          --cg-ok-border: var(--nx-green-100);
  --cg-ok-fg: var(--nx-green-700);         --cg-ok-icon: var(--nx-green-600);    // 6,7:1
  --cg-late-bg: var(--nx-amber-50);        --cg-late-border: var(--nx-amber-100);
  --cg-late-fg: var(--nx-amber-800);       --cg-late-icon: var(--nx-amber-500);  // 8,4:1
  --cg-error-bg: var(--nx-red-50);         --cg-error-border: var(--nx-red-100);
  --cg-error-fg: var(--nx-red-800);        --cg-error-icon: var(--nx-red-600);   // 9,4:1
  --cg-danger-solid: var(--nx-red-600);    // #B42318, botão de ato irreversível (texto branco 6,6:1)
  --cg-emergency-bg: var(--nx-blue-900);   // #133350, texto branco 13:1 (NUNCA vermelho)

  // Rampa de uma cor só para as faixas da escala (do mais claro ao mais escuro)
  --cg-band-1: var(--nx-blue-100);  // #DCE9F4
  --cg-band-2: var(--nx-blue-300);  // #8DB7D8
  --cg-band-3: var(--nx-blue-600);  // #2D6EA3
  --cg-band-4: var(--nx-blue-800);  // #1B4669

  // ---- Movimento -----------------------------------------------------------
  --cg-dur: 120ms;          // troca de cor e de estado
  --cg-dur-sheet: 200ms;    // folha de baixo
  @media (prefers-reduced-motion: reduce) { --cg-dur: 0ms; --cg-dur-sheet: 0ms; }
}
```

### A.1.2 Escala de tipografia

| Papel | Token | Normal | Grande | Bem grande | Fonte e peso | Entrelinha | Uso |
|---|---|---|---|---|---|---|---|
| Legenda | `--cg-fs-caption` | 14 | 15,6 | 17,1 | Figtree 500 | 1,4 | Hora pequena, "Dado às 08:12", contagem. **Nunca** o único lugar de uma informação para agir |
| Apoio | `--cg-fs-small` | 16 | 17,8 | 19,6 | Figtree 400 | 1,5 | Segunda linha de item de lista, dica de campo |
| **Corpo** | `--cg-fs-body` | **18** | **20** | **22** | Figtree 400; 600 em rótulo e botão | 1,55 | Texto corrido, campo, botão, item de lista (título 600) |
| Título de cartão (h3) | `--cg-fs-lead` | 20 | 22,2 | 24,4 | Figtree 600 | 1,3 | Título de cartão e de bloco |
| Título de seção (h2) | `--cg-fs-h2` | 24 | 26,7 | 29,3 | DM Serif Display 400 | 1,25 | Seção, folha, estado vazio |
| Título de página (h1) | `--cg-fs-h1` | 28 (32 em 768+) | 31,1 (35,6) | 34,2 (39,1) | DM Serif Display 400, azul 800, linha dourada de 56 x 3 px embaixo | 1,2 | **Um por tela** |
| Rótulo da barra | `--cg-fs-nav` | 14 | 15,6 | 16,1 | Figtree 600 | 1,15 | Só a barra inferior (teto 1,15 para caber em 72 px) |

Regras: serifa só em h1, h2 e na saudação; nunca em botão, rótulo ou dado. **Sem caixa alta** (só a palavra NEXUS do cabeçalho). Sem itálico. Sem peso abaixo de 400. Texto corrido com `max-inline-size: 66ch` e `text-wrap: pretty`; títulos com `text-wrap: balance`. Números de hora e dinheiro com `font-variant-numeric: tabular-nums`. `overflow-wrap: anywhere` em nome de pessoa e de profissional. **Nunca cortar texto com reticências** (`text-overflow: ellipsis` proibido): o texto quebra em mais linhas.

### A.1.3 Espaçamento, alvos e medidas

| Item | 360 | 768 | 1280 |
|---|---|---|---|
| Margem lateral da página (`--cg-gutter`) | 16 | 24 | 32 |
| Coluna do conteúdo | 100% menos margens | 720 centralizada | 960 centralizada (formulário e texto longo: 640) |
| Entre cartões (`--cg-gap-block`) | 24 | 24 | 24 |
| Dentro do cartão (`--cg-gap-stack`) | 12 | 12 | 12 |
| Padding do cartão | 20 | 24 | 24 |
| Entre botões empilhados | 12 | 12 | 16 (lado a lado) |
| Entre um campo e o seguinte | 20 | 20 | 24 |
| Entre alvos de toque vizinhos (mínimo) | 8 | 8 | 8 |
| Acima do h2 de seção / abaixo | 32 / 12 | 32 / 12 | 40 / 12 |
| Fim da página (antes da barra) | `--cg-nav-h` + 24 + safe area | igual | 48 |

Alvos: **48 x 48 mínimo**, também para ícone sozinho (aumentar a área com padding). Botão principal **56** de altura. Linha de escolha (rádio, caixa) **56**. Item de lista **64** (72 com duas linhas). A área tocável de uma linha é a linha inteira.

### A.1.4 Cores de estado em linguagem calma

| Estado | Para que serve | bg / borda / texto / ícone | Ícone (sprite) | Texto de exemplo |
|---|---|---|---|---|
| **Cuidado** (`care`) | A equipe vai falar com você; coisa que pede atenção **sobre você** | `#EFF5FA` / `#B9D3E8` / `#1B4669` / `#2D6EA3` | `hand-heart` | "A equipe de psicologia vai falar com você hoje." |
| **Informação** (`info`) | Fato neutro, aviso de prazo | mesmas cores do cuidado | `info` | "Seu plano muda para o Livre em 14/11." |
| **Aguardando** (`soft`) | Pedido enviado, esperando resposta; bloqueio por plano | `#F0EDE5` / `#D8D4C8` / `#3F4A56` / `#5A6673` | `clock`, `hourglass`, `lock` | "Pedido enviado. A equipe responde em até 24 horas úteis." |
| **Feito** (`ok`) | Remédio dado, inscrição confirmada | `#E9F6EF` / `#CFEBDD` / `#17613D` / `#1F7A4D` | `circle-check` | "Dado às 08:12." |
| **Passou do horário** (`late`) | Remédio ou compromisso **da pessoa idosa** fora do horário. No remédio o texto é neutro ("Ainda não anotado") e o âmbar entra **uma vez só** por tela | `#FFF5DC` / `#FFE8B0` / `#6B3D00` / `#B87500` | `clock` | "Ainda não anotado." |
| **Problema** (`error`) | **Só** erro de formulário, falha do sistema e o botão de ato irreversível na folha de confirmação | `#FDEEEC` / `#F9D6D2` / `#7A1A12` / `#B42318` | `circle-alert` | "Informe a data de nascimento." |
| **Emergência** | Só a tela Ajuda agora e o aviso de emergência cheio | fundo `#133350`, texto `#FFFFFF` (13:1) | `phone` | "Em emergência, ligue 192." |

**Vermelho nunca aparece** para: pontuação ou faixa da escala, "contato da equipe pendente ou vencido", pedido de revisão, plano, consentimento, mensagem sem resposta. **Âmbar nunca aparece** sobre a saúde emocional da pessoa. **Dourado nunca sinaliza estado** (só a linha sob o título, o item atual da navegação e o plano Sustenta). Estado nunca depende só de cor: todo selo ou nota tem **ícone e texto**.

## A.2 Inventário de componentes

Todos são standalone, `OnPush`, com signals (convenção do projeto) e vivem em `features/caregiver-app/ui` (Base). Quando existir componente do ERP que serve com o tema (`app-form-field`, `appInput`, `appMask`, `app-checkbox`, `app-radio-group`, `app-empty-state`, `app-badge`, `DialogService`, `ToastService`), **reaproveite** e deixe o tema `.cg-app` mudar as medidas; só crie `cg-*` quando a anatomia é diferente.

### A.2.1 Cabeçalho do app com "Ajuda agora" (`app-cg-header`)
- **Serve para**: marca e a saída de emergência, **em todas as telas**, inclusive `/cuidador/comecar` e `/cuidador/ajuda-agora`.
- **Anatomia**: esquerda, símbolo da Nexus (32 px) e a palavra NEXUS (Figtree 500, espaçada); direita, botão **Ajuda agora** (ícone `life-buoy` 24 + texto 16/600, borda 2 px `--nx-blue-800`, fundo branco, texto azul 800). Em 1024 px ou mais, a navegação principal entra no meio (A.2.2).
- **Estados**: padrão; foco (anel de 3 px); pressionado (fundo `--brand-soft`). Sem estado "alerta": o botão **não pisca, não pulsa, não muda de cor**.
- **Medidas**: altura 64 (72 em 1024+), fixo no topo (`position: sticky`), fundo `--cg-surface`, borda inferior 1 px `--cg-border`. Botão: altura 48, largura mínima 48, padding lateral 16; o texto **nunca some** (a pessoa não reconhece ícone sozinho). Em 360 px com letra Bem grande, a palavra NEXUS some e fica só o símbolo.
- **Acessibilidade**: `<header role="banner">`; link "Ir para o conteúdo" antes dele; o botão é `<a routerLink>` com texto visível "Ajuda agora"; ordem de tabulação: pular conteúdo, símbolo, Ajuda agora.
- **Texto**: "Ajuda agora".

### A.2.2 Barra inferior e navegação de topo (`app-cg-nav`)
- **Serve para**: os 5 destinos fixos: **Hoje**, **Rotina**, **Cuidar de mim**, **Rede**, **Mais** (ícones `house`, `calendar-days`, `hand-heart`, `handshake`, `ellipsis`).
- **Anatomia (360 a 1023 px)**: barra fixa embaixo, 5 itens de largura igual; cada item: ícone 24 e rótulo (`--cg-fs-nav`, até 2 linhas, centralizado, "Cuidar de mim" quebra em duas linhas). Item atual: texto azul 800 com peso 700, fundo `--brand-soft` em pílula de 56 x 32 atrás do ícone e **linha dourada de 24 x 3 px** na borda superior do item. Inativos: texto `--cg-text-soft`, ícone 1,75 px de traço.
- **Anatomia (1024 px ou mais)**: a mesma navegação vira **abas de texto no cabeçalho** (ícone 20 e rótulo 16/600, altura 48, linha dourada de 3 px embaixo do item atual); a barra inferior **não existe**.
- **Estados**: padrão, foco, pressionado (fundo `--cg-surface-sunken`), atual (`aria-current="page"`). **Sem contador, sem ponto de notificação** nos itens (nada compete por atenção).
- **Medidas**: altura 64 mais `env(safe-area-inset-bottom)`; com Bem grande, 72. Cada item tem no mínimo 64 x 64. Sombra `--cg-shadow-nav`, borda superior 1 px.
- **Acessibilidade**: `<nav aria-label="Navegação principal">`; lista com `<ul>`; `aria-current="page"` no item da seção atual (inclusive nas subtelas dela). **Some enquanto há teclado aberto** (`visualViewport.height < 75%` da janela) para não cobrir campo.
- **Texto**: Hoje · Rotina · Cuidar de mim · Rede · Mais.
- **Não aparece** em `/cuidador/comecar` (modo foco) nem em `/login`.

### A.2.3 Cabeçalho de página (`app-cg-page-header`)
- **Serve para**: dizer onde a pessoa está e, quando for subtela, voltar.
- **Anatomia**: botão de texto "Voltar" com `arrow-left` (só em subtelas), `h1` serifado, **linha dourada 56 x 3 px**, uma frase de apoio opcional (corpo 18, `--cg-text-soft`, **no máximo 2 linhas**).
- **Medidas**: margem superior 16; entre h1 e linha 8; entre linha e apoio 12; abaixo 24. Não é fixo (rola com a página).
- **Acessibilidade**: **um** `h1` por tela, recebe o foco programático ao trocar de rota (`tabindex="-1"`); "Voltar" é `<a>` ou `<button>` com nome "Voltar para {tela anterior}".
- **Texto**: "Rotina", "Como estou", "Meu plano". Frase de apoio só quando evita dúvida.

### A.2.4 Cartão (`app-cg-card`, `.cg-card`)
- **Serve para**: agrupar **uma** ideia: um compromisso, um remédio, uma opção.
- **Anatomia**: título (h3, 20/600) e, abaixo, no máximo 3 linhas de corpo; opcional ícone 24 à esquerda do título; **no máximo uma ação principal**; rodapé com botão de texto opcional. Variantes: `--care`, `--soft` (cores A.1.4), `--link` (cartão inteiro é um link, com `chevron-right` à direita).
- **Estados**: padrão; `--link` com pressionado (fundo `--cg-surface-sunken`) e foco (anel 3 px); carregando (esqueleto sem brilho, altura reservada).
- **Medidas**: fundo branco, borda 1 px `--cg-border`, raio 16, padding 20 (24 em 768+), mínimo 72 de altura se `--link`. **Nunca cartão dentro de cartão.** Nunca mais de 6 cartões visíveis por tela sem "Ver todos".
- **Acessibilidade**: `<section>` com `aria-labelledby` do título; cartão `--link` é um único `<a>` (não botão dentro de link).
- **Texto de exemplo**: título "Próximo compromisso"; corpo "Fisioterapia, hoje às 14:00".

### A.2.5 Aviso calmo (`app-cg-note`)
- **Serve para**: toda mensagem de estado (cuidado, informação, aguardando, feito, passou do horário, problema).
- **Anatomia**: ícone 24 (cor `*-icon`), título opcional 600, texto 18, ação opcional (botão de texto). Cores de A.1.4.
- **Medidas**: padding 16, raio 12, borda 1 px da variante. Ícone alinhado ao topo do texto.
- **Acessibilidade**: `role="status"` em `care`, `info`, `soft`, `ok`, `late`; `role="alert"` **só** em `error`. O ícone é `aria-hidden`; o estado está no texto.
- **Texto**: ver cada tela.

### A.2.6 Item de lista (`app-cg-row`)
- **Serve para**: listas de destinos e de itens (menu Mais, Meus pedidos, horários, profissionais).
- **Anatomia**: ícone 24 dentro de círculo de 40 (`--brand-soft`), título (18/600, quebra em até 3 linhas), apoio (16, `--cg-text-soft`, até 2 linhas), fim: `chevron-right`, etiqueta ou controle. Separador de 1 px `--cg-border-subtle`, sem separador no último.
- **Estados**: padrão; pressionado (fundo `--cg-surface-sunken`); foco (anel interno de 3 px); selecionado (`aria-current="true"`, fundo `--brand-soft`, ícone `check` à direita); desabilitado **não existe** (se não dá para usar, mostre o motivo).
- **Medidas**: altura mínima **64** (72 com apoio), padding 12 x 16, a linha inteira é o alvo.
- **Acessibilidade**: `<a>` ou `<button>` com o texto do título mais o apoio no nome acessível; lista é `<ul>`.
- **Texto de exemplo**: título "Meu plano", apoio "Cuida · R$ 119,90 por mês".

### A.2.7 Botão primário e secundário (`.btn` do DS com tema, ou `.cg-btn`)
- **Serve para**: a ação principal (primário) e a alternativa (secundário).
- **Anatomia**: texto 18/600 (verbo mais objeto), ícone opcional 20 à esquerda. **Primário**: fundo `--cg-action` (`#235A87`), texto branco 7,3:1. **Secundário**: fundo branco, borda 2 px `--cg-action`, texto `--cg-heading`. **Ato irreversível** (só dentro da folha de confirmação): fundo `--cg-danger-solid`, texto branco. **Perigo suave** (cancelar sessão, cancelar plano): secundário com texto `--cg-error-fg` e borda 2 px `--cg-error-border`.
- **Estados**: padrão; hover (`--cg-action-hover`); pressionado (`--cg-action-press`, **sem deslocamento**); foco (anel 3 px recuado 3 px, `--cg-focus`); ocupado (`aria-busy`, texto some, giro estático com movimento reduzido, **largura não muda**); desabilitado só quando a regra é dura **e o motivo está escrito acima do botão** (preferir deixar habilitado e validar ao tocar).
- **Medidas**: altura **56** (primário e secundário), raio 12, padding lateral 24, largura **100%** no celular e até 767 px; de 768 px em diante largura automática, mínimo 200. Em pares, primário **acima** do secundário, 12 de espaço. Ação principal da página fica em barra fixa embaixo (`.cg-action-bar`: fundo branco, borda superior, padding 12 e safe area, **acima da barra de navegação** nas telas que a têm; `scroll-padding-bottom` para o foco nunca ficar atrás).
- **Acessibilidade**: rótulo é verbo mais objeto ("Agendar conversa", "Entrar no grupo"), nunca "OK", "Enviar" solto nem "Clique aqui".

### A.2.8 Botão de texto (`.cg-link-btn`)
- **Serve para**: ações leves e reversíveis: "Voltar", "Ver todos", "Mudar", "Desfazer", "Ver os planos".
- **Anatomia**: texto 18/600 em `--cg-link`, **sublinhado sempre** (2 px, recuo 3 px), ícone `chevron-right` opcional.
- **Medidas**: altura mínima 48, padding 12 x 8; nunca encostado em outro alvo (8 px de espaço).
- **Regra**: nunca é a **única** forma de uma ação principal. Foco e pressionado como o botão.

### A.2.9 Campo de formulário e cartão de escolha (`app-form-field`, `app-cg-choice`)
- **Serve para**: digitar e escolher.
- **Anatomia**: rótulo sempre visível (18/600), dica **acima** (16, soft), campo 56 de altura, 18 de texto, raio 12, borda 2 px `--cg-border-control`; erro **abaixo** com ícone, texto e prefixo oculto "Erro:" (como o DS), mesma frase no resumo de erros no topo. Opcionais marcados "(opcional)". **Cartão de escolha**: linha de 56 a 72 com rádio de 28 px à esquerda, título 18/600, apoio 16; toda a linha é o alvo; selecionado = borda 3 px `--cg-action` mais `circle-dot` preenchido (não só cor).
- **Regras**: um assunto por tela de formulário; `inputmode` e `autocomplete` certos (`tel`, `email`, `bday`); data com `<input type="date">` nativo (melhor no celular); **nunca limpar o que a pessoa digitou** ao errar; teclado numérico para horas.
- **Mensagens de erro** (catálogo do DS, na voz do "você"): "Informe {o quê}." · "O telefone deve ter o formato (34) 90000-0000." · "Você precisa ter 18 anos ou mais." · "Parece um CPF real. Use um CPF fictício." · "Use um e-mail que termine em @exemplo.com.br." · "As horas por dia devem ser de 0 a 24." · "Não foi possível salvar. Tente de novo; se continuar, fale com a gente."

### A.2.10 Chave liga e desliga grande (`app-cg-switch`)
- **Serve para**: ligar ou desligar uma coisa com efeito imediato (lembrete de compromisso, "este remédio está em uso", compartilhar um item, consentimento).
- **Anatomia**: linha de 64: rótulo (18/600) e apoio (16) à esquerda; chave à direita, **trilho 56 x 32**, botão interno 24; **texto de estado ao lado ou abaixo** ("Ligado" / "Desligado", ou o efeito: "Você autorizou" / "Você não autorizou").
- **Estados**: desligado (trilho `--cg-border-control`, botão branco); ligado (trilho `--cg-action`, botão branco, ícone `check` no botão); foco; ocupado; desabilitado só com motivo escrito.
- **Medidas**: a **linha inteira** é o alvo (mínimo 64 x 100%).
- **Acessibilidade**: `role="switch"` com `aria-checked`; o texto de estado faz parte do nome ("Lembrar deste compromisso, ligado"); troca anunciada em `aria-live="polite"`.
- **Atenção**: consentimento **não** usa a chave sozinha: retirar abre a folha de efeito (tela 21).

### A.2.11 Seletor de humor de 5 opções (`app-cg-mood`)
- **Serve para**: o registro "Como você está hoje?" em **um toque** (RN-USR-05; dado de saúde, depende do consentimento (a)).
- **Anatomia**: grupo de rádio com 5 opções: 1 **Muito mal** (`frown`), 2 **Mal** (`annoyed`), 3 **Mais ou menos** (`meh`), 4 **Bem** (`smile`), 5 **Muito bem** (`laugh`); cada uma é ícone de 32 mais rótulo (16). O ícone **não é a informação**: o rótulo é.
- **Layout**: letra Normal e largura de 328 px ou mais: **5 colunas** de 60 x 76 px com 7 px de espaço; letra Grande ou Bem grande, ou largura menor: **lista vertical** de 5 linhas de 56 px.
- **Estados**: nada pré-marcado; ao tocar, **grava na hora**, a opção fica com borda 3 px e `check`, e o cartão passa a "Anotado para hoje: {rótulo}" com botão de texto "Mudar" (vale o dia inteiro). Sem animação de comemoração, sem cor de semáforo (todas as 5 opções têm o mesmo visual).
- **Acessibilidade**: `role="radiogroup"` com `aria-label="Como você está hoje"`; setas movem; cada opção tem nome acessível completo ("Mais ou menos, 3 de 5").
- **Texto**: pergunta "Como você está hoje?"; confirmação "Anotado para hoje: Bem."

### A.2.12 Marcação "dei o remédio" (`app-cg-dose`)
- **Serve para**: marcar que o remédio foi dado, **em um toque** (coleção `doseChecks`).
- **Anatomia (linha de 72 a 88)**: ícone `pill` em círculo de 40; nome e dose (18/600 e 16 soft); horário (18, tabular) ; à direita, botão **Dei** (48 x 88).
- **Estados**: **a dar** (botão "Dei" secundário); **no horário ou até 30 minutos antes** (botão "Dei" primário); **passou do horário** (texto "Ainda não anotado", âmbar suave só na primeira linha em atraso e neutro nas outras, botão "Dei" primário); **dado** (fundo `--cg-ok-bg`, ícone `circle-check`, texto "Dado às 08:12" e, **embaixo do texto, longe do lugar do Dei**, o link pequeno "Desfazer"); **sem remédio hoje** (estado vazio).
- **Regras**: o **toque único marca "dado agora"** (`givenAt` = agora do relógio simulado). Mudar o horário: tocar na linha dada abre a folha "Dei em outro horário" `[S-06]`. Desfazer: link pequeno, sem confirmação (é reversível); um toque até 1 s depois do Dei é ignorado (CXC-008). **O que falta aparece primeiro** e a ordem é **fixada ao abrir a tela**: a linha **não muda de lugar** ao marcar (sem pulo de layout, e o segundo toque de quem dá dois toques não cai no Dei de outro remédio).
- **Acessibilidade**: nome do botão "Dei o Losartana das 08:00"; depois "Desfazer: Losartana das 08:00 dado às 08:12"; anúncio `aria-live="polite"` "Marcado: Losartana, 08:12".
- **Texto**: "Dei", "Dado às 08:12", "Desfazer", toast "Anotado às 08:12. Desfazer".

### A.2.13 Passo a passo do cadastro (`app-cg-steps`)
- **Serve para**: mostrar em que etapa do `/cuidador/comecar` a pessoa está. **Só indicativo, nunca clicável** (voltar é pelo botão).
- **Anatomia (360 a 767 px)**: texto **"Etapa 2 de 5: Quem você cuida"** (16/600) e barra de progresso de 8 px (`role="progressbar"`, `aria-valuenow` 2, `aria-valuemax` 5; trilho `--cg-surface-sunken`, preenchimento `--cg-action`). **Anatomia (768 px ou mais)**: 5 pontos de 32 px ligados por linha, com o rótulo de cada etapa; feita = `check`; atual = número e anel; a vir = número.
- **Medidas**: no máximo 5 etapas (o DS permite até 6). Ações da etapa em barra fixa: **Continuar** (primário) e **Voltar** (botão de texto à esquerda).
- **Acessibilidade**: ao mudar de etapa, o foco vai ao h1 da etapa e `aria-live` anuncia "Etapa 3 de 5". O rascunho é guardado a cada etapa (`DraftService`).

### A.2.14 Estado vazio (`app-empty-state` com tema)
- **Serve para**: toda lista sem itens. Nunca tela em branco.
- **Anatomia**: arte das mãos da marca em linha dourada com círculo pontilhado (96 px; some em Bem grande), título serifado (h2, 24) acolhedor, **uma frase** que diz o que aparecerá ali, **uma ação** (botão primário ou de texto). Variante compacta dentro de cartão: sem arte.
- **Regra**: três tipos: primeiro uso ("Você ainda não tem remédios cadastrados"), sem resultado ("Nenhuma opção encontrada"), sem acesso (consentimento retirado, plano não inclui).
- **Texto**: ver cada tela.

### A.2.15 Bloqueio por plano (`app-cg-plan-lock`)
- **Serve para**: dizer, sem pressão, que um recurso é de outro plano.
- **Anatomia**: cartão `soft`, ícone `lock` (24, cinza), título "**Disponível no plano {Cuida}**", uma frase do que é e o plano atual da pessoa, botão de texto "Ver os planos". **Sem preço em destaque, sem "Assine agora", sem contagem, sem selo colorido, sem foto de gente feliz.**
- **Regras**: (1) o cartão aparece **igual para todo mundo** do mesmo plano, **nunca** por causa de pontuação, faixa, alerta ou ARBE (RN-PLN-19); (2) nunca bloqueia o que é para todos: atendimento psicológico, rodas abertas, conteúdos básicos, ajuda e privacidade; (3) mostra sempre uma alternativa gratuita quando existir ("As rodas de conversa abertas são para todos").
- **Texto**: título "Disponível no plano Cuida"; corpo "Grupos e capacitações fazem parte do plano Cuida. Seu plano agora é o Essencial."; ação "Ver os planos".

### A.2.16 Diálogo "Como falar com a gente" (`app-cg-contact-dialog`)
- **Serve para**: o caminho para a equipe por app, WhatsApp, telefone ou e-mail, **sem ligar de verdade** (decisão 6 do contexto). Abre de: Hoje (link no fim), Ajuda agora, Como estou, Mais, Falar com a Nexus.
- **Anatomia** (folha de baixo no celular, diálogo de 560 px em 768+): título (h2) e **4 linhas de canal**, **o canal preferido da pessoa primeiro**, com etiqueta "Seu canal preferido": **Telefone** (`phone`), **WhatsApp** (`message-circle`), **Mensagem no aplicativo** (`messages-square`), **E-mail** (`mail`). Cada linha: nome, quando respondemos, e o botão **Copiar número** (telefone, WhatsApp), **Escrever mensagem** (aplicativo, leva à tela Falar com a Nexus) ou **Copiar e-mail**. Abaixo, `note soft`: "No protótipo, a ligação não é feita." e o aviso de emergência (A.2.19).
- **Prazos** (RN-CAN-02): telefone "Na hora, em horário comercial (segunda a sexta, 8h às 18h)"; WhatsApp "Até 4 horas úteis"; aplicativo "Até 24 horas úteis"; e-mail "Até 48 horas úteis". Fora do horário comercial (relógio simulado), o telefone mostra "Fechado agora. Abrimos amanhã às 8h." e sugere WhatsApp ou mensagem.
- **Números**: `(34) 90000-0000` (fictício), em 28 px tabular. **Nenhum `tel:` nem `wa.me`** abre sozinho.
- **Acessibilidade**: `role="dialog"` com `aria-labelledby`; foco inicial no título; Esc fecha; foco volta ao gatilho. "Copiar número" anuncia "Número copiado" (`aria-live`). Se o navegador negar a área de transferência: o número fica selecionado e aparece "Não foi possível copiar. Segure sobre o número e escolha Copiar."
- **Texto**: título "Como falar com a gente"; "Escolha o jeito mais fácil para você."

### A.2.17 Folha de baixo (`app-cg-sheet`)
- **Serve para**: toda confirmação e todo formulário curto, **no alcance do polegar**. Diverge do DS (que mantém confirmação em diálogo central) por causa da mão ocupada `[S-02]`.
- **Anatomia (abaixo de 768 px)**: ancorada na base, raio superior 24, **alça** de 4 x 40 px no topo, título (h2), conteúdo, ações empilhadas (**primário acima**, "Voltar" como botão de texto abaixo, ambos 100%). Altura até 90% da janela; conteúdo rola dentro. Fundo escurecido (`rgb(11 34 56 / 0.5)`).
- **Anatomia (768 px ou mais)**: diálogo central de 560 px, raio 16, sem alça.
- **Confirmação de ato com efeito** descreve **o que acontece, quando e o que continua** em 2 a 4 linhas (padrão `.effects` do DS: "Será eliminado", "Ficará guardado", "Continua"). Botão com o nome da ação ("Cancelar a conversa"), nunca "Sim". Foco inicial no botão **seguro** ("Voltar") quando o ato é irreversível.
- **Comportamento**: abre com deslize de 200 ms (0 com movimento reduzido); Esc, toque no fundo e "Voltar" fecham; foco preso dentro; ao fechar, foco volta ao gatilho. **Não** fecha ao arrastar. Não empilhar duas folhas.
- **Acessibilidade**: `<dialog>` com `showModal()`, `aria-labelledby`, o resto da página `inert`.

### A.2.18 Aviso de protótipo (`app-cg-proto-note`)
- **Serve para**: RN-LGPD-25 e AC-GL-05, **em toda tela** do app e na entrada.
- **Anatomia**: no app, **fim do conteúdo** (acima da barra), ícone `info` 16 e texto 14 em `--cg-text-soft`, mais o link "Meus dados". Na entrada (`/login`) e no início de `/cuidador/comecar`, vira faixa `banner--prototype` do DS (dourado suave).
- **Texto literal**: "Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador."

### A.2.19 Aviso de emergência (`app-cg-emergency-note`)
- **Serve para**: RN-ATD-11, RN-CAN-06 e RN-ENC-09, nas telas de contato, atendimento e cadastro.
- **Variantes**: **compacta** (nota `soft` de uma frase com botão de texto "Ver Ajuda agora"); **completa** (só na tela Ajuda agora: cartões com fundo `--cg-emergency-bg` e texto branco); **com aceite** (cadastro e troca de plano: caixa "Li e entendi", obrigatória, grava data e hora).
- **Texto literal (compacta)**: "Em emergência, ligue 192 (SAMU). Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios."
- **Regra**: nunca em vermelho, nunca com sirene, nunca animada.

### A.2.20 Seletor de tamanho de letra (`app-cg-text-size`)
- **Serve para**: a escolha **Normal, Grande, Bem grande** (decisão 7), em Mais e no Perfil.
- **Anatomia**: três botões lado a lado (rádio, 56 de altura, largura 1/3), cada um com "Aa" no tamanho do nível (18, 20, 22 px **fixos**, independentes do nível atual) e o nome do nível embaixo (16). Selecionado: borda 3 px, `check`. Embaixo, a frase de prévia "Assim fica o texto no seu aplicativo." já no nível escolhido.
- **Comportamento**: aplica **na hora** (troca `data-text` do `.cg-app`), **sem botão Salvar**, e grava pelo repositório de preferências (nunca `localStorage` direto).
- **Acessibilidade**: `role="radiogroup"`; nomes "Letra normal", "Letra grande", "Letra bem grande".

### A.2.21 Linha do tempo da evolução do cansaço (`app-cg-trend`)
- **Serve para**: Como estou (RN-ZRT-23): mostrar a evolução **sem alarme**.
- **Anatomia**: lista vertical, do mais recente para o mais antigo (até 4 itens; "Ver todas"). Cada item: **data** (16, soft), **a faixa por extenso** (18/600), e, em **legenda** (14), "{n} pontos". Ponto de 16 px na linha de 2 px (`--cg-border-control`), **colorido pela rampa de azul** (`--cg-band-1` a `--cg-band-4`), o mais recente com anel de 3 px e a etiqueta "Última conversa". **Sem octógono, sem triângulo, sem vermelho, sem âmbar.**
- **Faixas** (nomes oficiais, RN-ZRT-08): "Sobrecarga ausente ou pequena" (0 a 20), "Sobrecarga moderada" (21 a 40), "Sobrecarga moderada a severa" (41 a 60), "Sobrecarga severa" (61 a 88).
- **Atrás de um toque**: "Entender as faixas" abre uma folha com as 4 faixas em linguagem simples e a frase fixa "A escala ajuda a equipe a escutar você. Não é um diagnóstico."
- **Regra**: **nenhum número grande**; a pontuação só aparece como legenda de 14 px.
- **Acessibilidade**: `<ol>` com `aria-label="Suas conversas de acompanhamento"`; cada `<li>` lê "04/11, sobrecarga severa, 63 pontos".

### A.2.22 Seletor de nota de 1 a 5 com duas notas (`app-cg-rating-pair`)
- **Serve para**: avaliar um serviço da rede (RN-ARP-02): **duas notas obrigatórias** mais comentário opcional.
- **Anatomia**: duas perguntas, cada uma com 5 botões numerados 1 a 5 (48 x 48, raio 12, rádio nativo) e os extremos escritos ("Muito ruim" à esquerda, "Muito bom" à direita, 16). Pergunta (a): "Como foi o serviço?" (qualidade técnica). Pergunta (b): "Como foi a pontualidade e o atendimento?" (pontualidade e cordialidade). Depois, campo "Quer contar mais? (opcional)". Selecionado: fundo `--cg-action`, texto branco, `check`.
- **Largura**: 5 x 48 + 4 x 8 = 272 px (cabe em 328).
- **Estados**: **Enviar avaliação** fica habilitado quando as duas notas existem; antes, o texto "Falta escolher a nota do serviço" (ou da pontualidade) **fica escrito acima do botão**. Nunca só estrelas: o número aparece sempre.
- **Texto**: "Sua avaliação ajuda outras famílias. O profissional não vê o seu nome."

### A.2.23 Etiqueta de plano (`app-cg-plan-tag`)
- **Serve para**: mostrar o plano da pessoa ou de um recurso ("Plano Cuida").
- **Anatomia**: pílula com **ponto** (10 px) e **nome** (14/600). Cores `--plan-*-text` e `--plan-*-bg` do DS (Livre cinza-azulado, Essencial azul claro, Cuida azul médio, Sustenta dourado). **Nunca só cor.** Altura 28; não é um alvo de toque (se virar link, ganha 48 de área).
- **Texto**: "Plano Livre", "Plano Essencial", "Plano Cuida", "Plano Sustenta".

### A.2.24 Faixa de confirmação (`ToastService` com tema)
- **Serve para**: confirmar ação reversível ("Anotado às 08:12", "Número copiado").
- **Medidas**: 16 acima da barra inferior (`calc(var(--cg-nav-h) + 16px + safe area)`); largura da coluna; texto 18; **8 segundos**, pausa com foco; botão "Desfazer" (48 de altura) quando dá. `role="status"`. **Nunca é o único registro** da ação.

### A.2.25 Calendário do mês (`app-cg-calendar`)
- **Serve para**: ver os compromissos do mês de uma vez e escolher o dia (Agenda, tela 5). Quem usa o calendário pede o dia; o cartão do dia é da tela.
- **Anatomia**: cartão com cabeçalho (mês e ano por extenso, 20/700; **Mês anterior** e **Próximo mês** de 48 x 48; **Hoje** de 48 de altura), linha dos dias da semana (dom a sáb, 14/600) e a grade de 5 ou 6 linhas, de domingo a sábado. Abaixo de 28 rem de largura o cabeçalho tem duas linhas (o mês em cima, os botões embaixo); de 28 rem em diante, uma só.
- **Dia**: botão de **44 px de lado ou mais** (largura da coluna dividida por 7: 46 px em 360 px; altura 48, 56 de 768 px em diante). Número em 16/400 (negrito se há compromisso); **hoje** é o número num círculo cheio `--cg-action`; **o dia escolhido** é uma caixa de 2 px `--cg-action` com fundo `--brand-soft`; dia de outro mês fica com o número em `--cg-border-control` (4,6:1).
- **Marcas** (10 px): **uma por compromisso, até 3**; com 4 ou mais, duas marcas e "+N" (14/600). **Cor e forma**, nunca só a cor: Consulta, círculo cheio `--cg-action`; Fisioterapia, quadrado cheio `--cg-ok-icon`; Psicologia, losango cheio `--cg-soft-icon`; Para você, triângulo cheio `--nx-gold-700`; Outro, círculo vazio com contorno `--cg-border-control`. Nenhum vermelho nem âmbar. Cada par passa 3:1 (`pnpm run check:a11y`).
- **Legenda**: lista com a marca e o nome do tipo, abaixo da grade; **só quando há marcas à vista**, e só com os tipos que aparecem.
- **Acessibilidade**: `role="grid"` com `role="row"`, `columnheader` e `gridcell`; cada dia é um `<button>` dentro do `gridcell` com o rótulo "6 de novembro, sexta-feira, 2 compromissos: Consulta e Fisioterapia"; `aria-selected` no `gridcell` do dia escolhido, `aria-current="date"` no botão de hoje; o mês é `aria-live="polite"`. **Teclado**: setas movem o foco (dia e semana), Home e End vão ao domingo e ao sábado da semana, PageUp e PageDown ao mês anterior e ao seguinte, Enter e Espaço escolhem; só um dia entra na ordem do Tab.
- **Movimento**: o fundo muda em `var(--cg-dur)` (0 com `prefers-reduced-motion`); nada pisca nem desliza. Em modo de alto contraste as marcas mantêm as cores e hoje ganha contorno.
- **Fonte de verdade**: regras puras em `core/rules/calendar-grid.ts` (grade, nomes, mês anterior e seguinte, teclado, marcas); "hoje" vem do `Clock`.

## A.3 Responsivo: 360, 768 e 1280

| Elemento | 360 (celular) | 768 (tablet) | 1280 (tela larga) |
|---|---|---|---|
| Casca | Cabeçalho fixo 64 + **barra inferior** 64 | Igual ao celular | Cabeçalho 72 com **navegação no topo**; sem barra inferior |
| Coluna do conteúdo | Largura total menos 32 | 720 centralizada, margens 24 | 960 centralizada, margens 32; formulário e texto longo em 640 |
| Hoje | Uma coluna: nota, compromisso, remédios, humor, convite | Igual | Duas colunas (principal 60% com compromisso e remédios; lateral 40% com humor e convite); a nota de cuidado ocupa a largura toda no topo |
| Cuidar de mim, Rede, Mais | 4 cartões (ou itens) empilhados | Cartões em **2 x 2** | Cartões em 2 x 2 na coluna de 960 |
| Listas (profissionais, horários, grupos) | Uma coluna | Uma coluna | **2 colunas** de cartões, mesma ordem |
| Botões | **100% da largura**, primário acima | Largura automática (mín. 200), alinhados à direita no formulário | Igual ao tablet |
| Ação principal fixa | Barra fixa embaixo (`cg-action-bar`) | Barra fixa embaixo | No fim do formulário (não fixa) |
| Confirmação | **Folha de baixo** | Diálogo central 560 | Diálogo central 560 |
| Humor (5 opções) | 5 colunas (Normal) ou lista vertical (Grande, Bem grande) | 5 colunas | 5 colunas |
| Passo a passo | Texto "Etapa X de 5" e barra | 5 pontos com rótulo | 5 pontos com rótulo |
| Comparar profissionais | Folha com um profissional por vez e abas | Folha de 560 com 2 lado a lado | Diálogo de 800 com 3 lado a lado |
| Teclado aberto | Barra inferior some | Igual | n/a |

Nenhuma tela tem **rolagem horizontal da página** (AC-GL-06). Letra **Bem grande** em 360 px: o texto quebra em mais linhas, os botões crescem em altura (`min-height`), nada é cortado. Orientação paisagem no celular: a barra inferior continua, o cabeçalho encolhe para 56.

## A.4 Movimento

Mínimo e funcional (`--cg-dur` 120 ms, `--cg-dur-sheet` 200 ms). Só se move: a folha de baixo (deslize e escurecimento), a barra de progresso do cadastro (largura) e a troca de cor de hover e foco. **Sem** coreografia de entrada, sem confete, sem pulso, sem rolagem animada, sem carrossel automático, sem esqueleto com brilho, sem vibração do aparelho. `prefers-reduced-motion: reduce` zera tudo (`--cg-dur: 0ms`): a folha aparece sem deslizar e o giro de "ocupado" fica estático (o `aria-busy` continua).

## A.5 Ícones

O sprite Lucide (`public/icons/sprite.svg`, gerado por `node tools/build-icons.mjs` a partir do `lucide-static` 1.68.0) é usado pela diretiva `appIcon` (`<svg appIcon="lock" size="sm"></svg>`). Ícone é **apoio**: o texto carrega a informação. Tamanhos: 20 (botão), 24 (item, nota, navegação), 32 (humor, vazio).

**Já existem no sprite** (conferido): `calendar-days`, `hand-heart`, `handshake`, `ellipsis`, `calendar`, `phone`, `message-circle`, `messages-square`, `mail`, `heart-pulse`, `book-open`, `users`, `users-round`, `user-round`, `credit-card`, `id-card`, `store`, `stethoscope`, `building-2`, `map-pin`, `shield-check`, `lock`, `eye-off`, `circle-check`, `check`, `circle-alert`, `info`, `circle-help`, `clock`, `hourglass`, `star`, `badge-check`, `clipboard-list`, `copy`, `download`, `search`, `plus`, `pencil`, `trash-2`, `undo-2`, `x`, `arrow-left`, `chevron-right`, `chevron-down`, `log-out`, `refresh-cw`, `history`, `link`, `settings`.

**Faltam no sprite (9 novos, todos existem no `lucide-static` 1.68.0, conferido)**: `house` (Hoje e "Em casa"), `life-buoy` (Ajuda agora), `pill` (remédio), `video` (conversa on-line), `frown`, `annoyed`, `meh`, `smile`, `laugh` (humor). Pedido ao líder `[P-01]`: autorizar a Base a incluí-los em `tools/build-icons.mjs` e regenerar o sprite.

**Não usar** `siren`, `triangle-alert`, `octagon-alert` e `shield-alert` no app do cuidador (alarme).

## A.6 Critérios de aceite da casca e do tema

- **AC-CG-01** Dado qualquer rota `/cuidador/**` em 360 px com a letra Normal, quando se mede o texto do corpo, então o `font-size` calculado é **18 px**, e todo controle interativo (botão, link, item de lista, chave, campo) tem no mínimo **48 x 48 px** de área tocável, com pelo menos 8 px entre alvos vizinhos.
- **AC-CG-02** Dado o seletor em "Bem grande", quando se abrem Hoje, Remédios, Meu plano e Como estou em 360 px, então o corpo é **22 px**, não há rolagem horizontal da página e nenhum texto é cortado, sobreposto ou terminado em reticências.
- **AC-CG-03** Dada qualquer tela do app (inclusive `/cuidador/comecar`), quando a pessoa toca "Ajuda agora" no cabeçalho, então abre `/cuidador/ajuda-agora` em **1 toque**; o botão está visível sem rolar, tem texto visível e não muda de cor nem anima.
- **AC-CG-04** Dado 360 a 1023 px, então a barra inferior tem **5 itens** na ordem Hoje, Rotina, Cuidar de mim, Rede, Mais; o item da seção atual tem `aria-current="page"` e destaque que não depende só de cor. Dado 1024 px ou mais, a mesma navegação está no cabeçalho e **não existe** barra inferior.
- **AC-CG-05** Dado um campo de texto com foco e o teclado virtual aberto, então a barra inferior não cobre o campo (some) e nenhuma barra de ação fixa o cobre; ao tocar fora do campo, a barra volta. A barra só some com **campo de texto com foco**, janela visual encolhida e **sem zoom de pinça** (`visualViewport.scale <= 1`, QAC-011): quem dá zoom não perde a navegação.
- **AC-CG-06** Todo par de cores de texto do app tem contraste de **4,5:1 ou mais** e todo contorno, ícone de estado e anel de foco tem **3:1 ou mais** (script de verificação dos tokens `--cg-*` sobre `--cg-bg` e `--cg-surface`).
- **AC-CG-07** Dado `prefers-reduced-motion: reduce`, quando se abre e fecha uma folha, então não há deslize nem fade (duração 0) e nada se move sozinho.
- **AC-CG-08** Dado qualquer nota, etiqueta ou estado do app, então ele tem **ícone e texto**; nenhum estado depende só de cor (verificação em escala de cinza).
- **AC-CG-09** Dada qualquer tela do app e a entrada, então o texto literal "Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador." está visível ao fim do conteúdo (ou na faixa da entrada).
- **AC-CG-10** Dadas as telas Ajuda agora, Falar com a Nexus, Conversar com um psicólogo e Começar (última etapa), então o aviso de emergência (192) e o de que os canais não substituem atendimento de saúde nem orientação sobre remédios estão visíveis.
- **AC-CG-11** Dada qualquer folha de baixo, quando ela abre, então o foco vai ao título, o fundo fica `inert`, Esc e toque fora fecham e o foco **volta ao gatilho**; abaixo de 768 px ela está ancorada embaixo, de 768 px em diante é diálogo central de 560 px.
- **AC-CG-12** Dado qualquer texto de interface em `features/caregiver-app`, então não contém travessão (nem o longo nem o médio), ponto de exclamação, emoji, nem as palavras "guerreira", "anjo", "heroína", "paciente", "idoso" ou "eficácia"; "diagnóstico" só aparece na frase "não é um diagnóstico"; "alerta" não aparece em texto visível ligado a pontuação, risco ou saúde emocional (verificação por busca no código e nos testes).
- **AC-CG-13** Dado o seletor de tamanho de letra, quando a pessoa escolhe um nível, então a mudança vale **na hora**, sem botão Salvar, é gravada pelo repositório de preferências (nunca `localStorage` direto) e continua após recarregar a página e entrar de novo com a mesma pessoa.
- **AC-CG-14** Dadas as larguras 360, 768 e 1280 px, então nenhuma rota do app tem rolagem horizontal da página.
- **AC-CG-15** Dado só o teclado, então toda função do app se opera, o foco é visível (anel de 3 px), a ordem do DOM é a ordem visual, existe o link "Ir para o conteúdo", e barras fixas nunca cobrem o elemento focado.
- **AC-CG-16** Dado um ícone sem texto ao lado, então ele tem `aria-label`; ícone decorativo tem `aria-hidden="true"`; "Ajuda agora" tem sempre texto.

---

# PARTE B. Fluxos

Cada fluxo traz **onde começa**, o **máximo de toques** (a partir de Hoje, sem contar digitação), os **passos**, **onde a pessoa pode errar e como se recupera**, e as **RN**. Os textos entre aspas são os de interface. Todo formulário longo guarda rascunho (`DraftService`). Toda ação reversível tem "Desfazer" ou "Voltar"; toda ação com efeito mostra o efeito **antes** (folha de baixo).

## B0. Entrar como cuidador
**Começa em**: `/login`. **Máximo**: 1 toque (o cartão da pessoa). **Telas**: 1.
1. A entrada mostra duas portas: **Sou cuidador(a)** (aberta, em destaque) e **Sou da equipe Nexus** (recolhida, discreta, com o segundo fator de sempre).
2. A pessoa toca no cartão da pessoa de demonstração (ou em "Criar minha conta", que leva a B1).
3. A sessão do cuidador é criada em `sessionStorage` (`nexus-erp:caregiver-session`) e abre `/cuidador/hoje` (ou a rota de origem, na mesma aba). **Sem senha e sem segundo fator** (RN-LGPD-15 vale só para a equipe).

**Erros e recuperação**: cadastro `closed`, anonimizado ou eliminado **não aparece** na lista. Sessão da equipe aberta e a pessoa tenta `/cuidador/**`: volta a `/app/painel`; a sessão do cuidador tentando `/app/**` volta a `/cuidador/hoje`. Armazenamento bloqueado: tela explicativa "O navegador está bloqueando o armazenamento do site, e o protótipo precisa dele. Libere o armazenamento para este endereço e recarregue a página."

## B1. Primeiro acesso e cadastro (quem é novo)
**Começa em**: `/login`, "Criar minha conta". **Máximo**: 14 toques mais digitação (12 com "Preencher com dados de exemplo"); meta de 5 minutos. **Telas**: 1, 2. **RN**: RN-USR-02 a 04, 10, 14, 18, RN-LGPD-04, 05, RN-ATD-11, RN-CAN-06, RN-PLN-02.
1. **Boas-vindas** (não conta como etapa): "Vamos começar." Três linhas: leva uns 5 minutos e dá para parar e continuar; você escolhe o que autoriza e pode mudar; o plano Livre não custa nada nem pede cartão. Botão **Começar**.
2. **Etapa 1 de 5, Sobre você**: nome completo, data de nascimento, CPF (fictício), celular, e-mail, cidade. Botão de texto "Preencher com dados de exemplo" `[S-03]`.
3. **Etapa 2 de 5, Quem você cuida**: nome da pessoa idosa, data de nascimento, parentesco (Filha, Filho, Esposa ou marido, Nora, Neto ou neta, Outro), grau de ajuda (3 cartões de escolha, nada pré-marcado). **Não pede** condições de saúde nem remédios (minimização, RN-USR-09; remédios entram depois, em Rotina).
4. **Etapa 3 de 5, Seu dia a dia**: horas por dia de cuidado (0 a 24, botões menos e mais), canal preferido (3 cartões: Aplicativo, WhatsApp, Telefone); se WhatsApp, o número (já preenchido com o celular, editável); **tamanho da letra** (Normal, Grande, Bem grande, com prévia).
5. **Etapa 4 de 5, Suas autorizações**: o consentimento de **dados de saúde** em cartão destacado e aberto; os outros 4 (números somados, compartilhar com a família, imagem e depoimento, WhatsApp) em cartões recolhidos com a pergunta e 3 opções de peso igual: **Concordo**, **Não concordo**, **Decidir depois**. Nada vem marcado; quem não escolhe fica em "Decidir depois" (`pending`). O texto de cada um vem de `CONSENT_COPY`.
6. **Etapa 5 de 5, Confira e termine**: 4 blocos de resumo, cada um com "Editar"; o aviso de emergência **com aceite** ("Li e entendi"); botão **Criar minha conta**.
7. **Pronto**: "Tudo pronto, Ana." com 3 próximos passos em itens de lista (Cadastrar os remédios, Adicionar um compromisso, Conhecer o Cuidar de mim) e o botão **Ir para Hoje**.

**Onde pode errar e como se recupera**

| Erro | O que a pessoa vê | Saída |
|---|---|---|
| Campo vazio ou formato errado | Erro junto do campo e resumo no topo (mesma frase), foco no resumo; **nada é apagado** | Corrigir e continuar |
| Menos de 18 anos | "Você precisa ter 18 anos ou mais." | Corrigir a data; se for verdade, "Falar com a gente" |
| CPF que parece real | "Parece um CPF real. Use um CPF fictício." e botão "Gerar CPF fictício" | Tocar no botão |
| Não marcou o aviso de emergência | "Marque que você leu o aviso para criar a conta." | Marcar |
| Saiu no meio (fechou a aba, voltou) | "Você tem um cadastro em andamento. Retomar ou começar de novo?" (dois botões iguais) | Retomar |
| Recusou a autorização de saúde | Nota `info`: "Tudo bem. A agenda, os remédios e os conteúdos continuam. A conversa de acompanhamento só acontece com a sua autorização." | Pode mudar depois em Privacidade |
| Errou uma resposta de etapa anterior | Botão "Voltar" mantém os dados | Voltar, corrigir, continuar |

## B2. "Dei o remédio" (e cadastrar um remédio)
**Começa em**: Hoje. **Máximo**: **1 toque** para marcar; 3 para marcar em outro horário; 6 mais digitação para cadastrar. **Telas**: 4, 6. **RN**: RN-USR-07, RN-ATD-11.
1. Em Hoje, bloco **Remédios de hoje**: tocar **Dei** na linha do remédio.
2. A linha vira "Dado às 08:12" (fundo verde suave, ícone `circle-check`); aparece a faixa "Anotado às 08:12. Desfazer." por 8 segundos.
3. **Cadastrar**: Rotina (1), aba Remédios (2), **Adicionar remédio** (3), nome e dose (digitar), horários (chips "Manhã 08:00", "Tarde 14:00", "Noite 20:00", ou "Outro horário"), **Salvar remédio** (4 a 6).

**Onde pode errar e como se recupera**
- **Tocou "Dei" sem querer**: "Desfazer" na faixa (8 s) ou, depois, "Desfazer" na própria linha, **a qualquer hora do dia**, sem confirmação (é reversível).
- **Deu em outro horário**: tocar na linha dada abre "Dei em outro horário" (campo de hora, botão "Salvar horário").
- **Esqueceu de marcar**: a linha passa a "Ainda não anotado" (neutro; âmbar suave só na primeira linha em atraso, sem vermelho); "Dei" continua disponível, com a opção de outro horário.
- **Remédio que não toma mais**: no detalhe do remédio, chave "Este remédio está em uso" desligada; ele sai de Hoje e fica em "Em pausa".
- **Dúvida de dose**: o app **não orienta**. Texto fixo em Remédios: "O app só ajuda você a lembrar. Dúvida sobre dose ou troca de remédio: fale com o médico ou a farmácia."

## B3. Adicionar e remarcar um compromisso
**Começa em**: Hoje ou Rotina. **Máximo**: 6 toques mais digitação do título; remarcar, 4 (5 quando o compromisso não é de hoje). **Telas**: 5. **RN**: RN-USR-07.
1. Rotina (1), aba Agenda: o calendário abre com hoje escolhido; para outro dia, tocar nele; depois **Adicionar compromisso neste dia** (2).
2. Folha de formulário: **O que é?** (título), **Tipo** (4 chips: Consulta, Fisioterapia, Psicologia, Outro) (3), **Dia** (data nativa, **já preenchido com o dia escolhido no calendário**), **Hora** (4), **Lembrar de mim** (chave, ligada por padrão `[S-04]`), **Salvar compromisso** (5).
3. O calendário vai ao dia do compromisso (e ao mês, se for outro), mostra o compromisso no cartão do dia e a faixa "Compromisso salvo. Desfazer."
4. **Remarcar**: tocar no compromisso (1, no cartão do dia), **Remarcar** (2), novo dia e hora (3), **Salvar novo horário** (4). O calendário vai ao dia novo. Faixa: "Remarcado para qui, 06/11, às 15:00."
5. **Tirar da agenda**: no compromisso, "Tirar da agenda" abre folha "Tirar este compromisso da agenda? Ele some da sua agenda e dos lembretes." com **Tirar da agenda** (suave) e **Voltar**.

**Erros e recuperação**: data no passado, "Escolha um dia de hoje em diante." (a hora de hoje já passada: "Escolha uma hora que ainda não passou."); título vazio, "Informe o que é o compromisso."; salvou duplicado, o app **não impede** e mostra os dois (a pessoa tira um); remarcou errado, "Desfazer" na faixa restaura o horário anterior.

## B4. Agendar uma conversa com o psicólogo (e cancelar)
**Começa em**: Cuidar de mim ou o convite de Hoje. **Máximo**: 7 toques; cancelar, 5. **Telas**: 7, 8. **RN**: RN-ATD-02 a 05, 07, 09, 10, 15, 16, 19, RN-ATD-12 (sem dizer o motivo).
1. Cuidar de mim (1), **Conversar com um psicólogo** (2), **Marcar uma conversa** (3).
2. **Como você prefere?** (3 botões grandes que levam ao passo seguinte): **On-line** (`video`), **No espaço de coworking** (`building-2`), **Em casa** (`house`) (4).
3. **Qual horário?** Lista de horários disponíveis por dia (próximos 14 dias), cada um é um botão com dia, hora e o nome do psicólogo (5). Quando o formato é coworking, o endereço da sala aparece; salas sem os 4 itens de acessibilidade **não aparecem**.
4. **Folha de resumo** (a confirmação, sempre antes de gravar): formato, dia, hora, com quem, valor com o desconto do plano ("Conversa: R$ 120,00. Desconto do plano Cuida (15%): R$ 18,00. Total: R$ 102,00. Pagamento combinado depois, no atendimento." `[S-05]`), **O que você procura?** (6): "Psicoterapia", "Orientação psicológica", "Não sei: o psicólogo ajuda a decidir" `[S-07]`; botão **Marcar conversa** (7).
5. A tela mostra "Conversa marcada: qui, 06/11, às 14:00, com a Dra. Beatriz." com o status **Aguardando confirmação** (ou **Confirmada**) e o botão de texto "Ver na agenda".
6. **Cancelar**: Cuidar de mim, Conversar, tocar na conversa (3), **Cancelar conversa** (4), folha com o efeito **escrito antes** (5): com 24 horas ou mais, "Cancelar libera o horário. Não há custo."; com menos de 24 horas, "Faltam menos de 24 horas. Se cancelar agora, o horário fica registrado como falta." Ações: **Remarcar em vez de cancelar**, **Cancelar a conversa** (suave), **Voltar**.

**Erros e recuperação**: horário tomado por outra pessoa no instante de gravar: "Esse horário acabou de ser reservado. Escolha outro." (o resto fica); sem horário no formato escolhido: estado vazio "Sem horários nesse formato nos próximos 14 dias" com "Escolher outro formato" e "Falar com a gente"; em casa: a folha explica "O psicólogo confirma se o local é adequado e seguro antes de confirmar a conversa" (RN-ATD-09); on-line: "O psicólogo confirma se o formato on-line serve para você. Se não servir, combina outro formato." (RN-ATD-07).

## B5. Ver como estou e pedir revisão
**Começa em**: Cuidar de mim. **Máximo**: 2 toques para ver; 4 para pedir revisão. **Telas**: 9. **RN**: RN-ZRT-04, 18, 19, 20, 23, RN-LGPD-14, RN-PLN-19.
1. Cuidar de mim (1), **Como estou** (2). A tela abre com a **nota de cuidado** (se houver contato da equipe pendente), a **linha do tempo** das conversas de acompanhamento e o humor da semana.
2. **Pedir revisão**: botão de texto "Pedir revisão de uma decisão" (3), folha com o campo "O que você quer que a equipe reveja?" e **Enviar pedido** (4).
3. Resposta: "Pedido enviado. O psicólogo responde até 10/11." Com o pedido aberto, o cartão mostra "Seu pedido de revisão está com a Dra. Beatriz. Resposta até 10/11."

**Erros e recuperação**: campo vazio, "Conte em uma frase o que você quer que a equipe reveja." (o texto digitado fica se a folha fechar sem querer); consentimento de saúde retirado, a linha do tempo **não aparece** e a tela explica (tela 9); sem nenhuma conversa de acompanhamento ainda, estado vazio "Ainda não houve uma conversa de acompanhamento. A equipe aplica a escala com você. Você não precisa preencher nada." **A pessoa não preenche a escala** (RN-ZRT-04).

## B6. Inscrever-se em um grupo
**Começa em**: Cuidar de mim. **Máximo**: 6 toques; lista de espera, 6. **Telas**: 10. **RN**: RN-GRP-02, 09, 13, 14, 16, 17, RN-ATD-19, RN-PLN-19.
1. Cuidar de mim (1), **Grupos e capacitações** (2), tocar no grupo (3).
2. Página do grupo: o que é, **o caráter** ("Orientação e psicoeducação" ou "Psicoterapia, terapia de grupo"), datas dos encontros, formato, quem conduz (com o registro profissional), vagas. Botão **Quero participar** (4).
3. **Folha do sigilo**: texto do contrato de sigilo e a caixa "Li e aceito o contrato de sigilo do grupo" (5); botão **Entrar no grupo** (6).
4. Resultado: "Você está no grupo Sobrecarga e autocuidado. Primeiro encontro: sáb, 07/11, às 14:00." (o dia e a hora vêm da programação; no seed é sáb, 07/11) A inscrição aparece em **Minhas inscrições**.
5. **Grupo lotado**: o botão é **Entrar na lista de espera**; a folha diz "Você entra na posição 3. Se abrir uma vaga, você entra automaticamente e a gente avisa." (promoção automática).
6. **Sair do grupo**: **Sair do grupo** na inscrição; folha "Você deixa de participar. A sua vaga volta para outra pessoa." **Sair do grupo** (suave) e **Voltar**.

**Erros e recuperação**: plano que não inclui (Essencial ou Livre): **bloqueio por plano** no lugar do botão (nunca erro vermelho), com a roda de conversa aberta como alternativa; terapia de grupo sem indicação do psicólogo: "Esta atividade começa com a indicação do seu psicólogo. Fale com a gente." (sem razão clínica, RN-GRP-14); sem marcar o sigilo: "Marque que você leu o contrato de sigilo para entrar." Mudar para plano que não inclui grupos: a perda das turmas futuras é avisada **na troca de plano** (B9), não aqui.

## B7. Buscar um profissional, comparar, pedir um serviço e avaliar depois
**Começa em**: Rede. **Máximo**: 7 toques para pedir; 4 para avaliar. **Telas**: 12, 13, 14, 15. **RN**: RN-REDE-10, 17, 18, 19, 25, 26, 30, RN-ARP-02, 04, 16, RN-ENC-10, RN-ATD-13.
1. Rede (1), **Buscar profissionais e serviços** (2), escolher a necessidade (chip de categoria: Fisioterapia, Cuidador(a), Home care, Enfermagem, Farmácia, Clínica, Psicologia, Nutrição, Advocacia, Serviço especializado) (3).
2. **Lista**: sempre **mais de uma opção** quando houver; se há uma só, aviso "Única opção disponível no momento"; se não há nenhuma, "Nenhuma opção por enquanto" e "Falar com a gente". Cada cartão: nome, especialidade, cidade, atende em casa, nota (só com 5 avaliações ou mais), "Em destaque" quando for o caso. Ordem: **em destaque primeiro, depois ordem alfabética** `[S-08]` (a Nexus não indica "o melhor": RN-ATD-13).
3. **Comparar** (opcional): marcar até 3 cartões (caixa "Comparar") e tocar **Comparar escolhidos**; abre a folha lado a lado com nota, atende em casa, condições para quem é da Nexus e disponibilidade.
4. Tocar no profissional (4): **ficha** com o aviso "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional." (RN-REDE-17). Botão **Pedir serviço** (5).
5. **Folha do pedido**: "O que você precisa?" (texto curto), "Onde?" (**Em casa** ou **No local do profissional**) (6), resumo "Enviamos ao profissional só o seu nome, o seu contato e o que você precisa." e **Enviar pedido** (7).
6. **Meus pedidos**: o pedido aparece "Enviado, aguardando resposta". A **equipe registra a resposta** do profissional (sem login dele): "Aceito", "O profissional não pôde atender" ou "Cancelado pelo profissional".
7. **Avaliar**: quando o serviço é concluído, Hoje mostra o cartão "Como foi o atendimento de {nome}?" (1); folha com as **duas notas** (2 e 3), comentário opcional e **Enviar avaliação** (4). Dá para **corrigir em até 7 dias** ("Corrigir minha avaliação" em Meus pedidos).

**Erros e recuperação**: profissional recusou: "O profissional não pôde atender. Ver outras opções de Fisioterapia" (leva à lista da categoria); pedido enviado por engano: **Cancelar pedido** enquanto estiver "Enviado" ou "Aceito" (folha com efeito); nota faltando: o texto "Falta escolher a nota do serviço" acima do botão; plano Livre: o pedido é igual ao dos outros planos, só sem as condições especiais `[S-09]`; profissional **suspenso** nunca aparece, e o link direto leva a "Não encontramos este profissional."

## B8. Usar o Cartão Nexus
**Começa em**: Rede. **Máximo**: 2 toques para mostrar o cartão. **Telas**: 16. **RN**: RN-CRT-02, 03, 10, 11, 12, RN-PLN-08.
1. Rede (1), **Cartão Nexus** (2): aparece o cartão com o **número** `NX-0000-0000` em 28 px, o nome e "Válido enquanto o seu plano estiver ativo".
2. **Onde usar**: lista de parceiros **ativos** com o desconto de cada um ("Farmácia Vida Plena, 10%"); tocar no parceiro mostra o endereço e a frase "Mostre o número do cartão no balcão."
3. **O que você já economizou**: "Neste mês: R$ {valor} em {n} compras." Os valores vêm dos usos registrados pelo parceiro (`CardUsage`), não de um número fixo; sem compras no mês: "Neste mês: ainda sem compras com o cartão." e, havendo histórico, "Ao todo: R$ {valor} em {n} compras." `[S-P3-03]`

**Erros e recuperação**: plano **Livre**: o cartão não existe; a tela é um convite calmo ("O Cartão Nexus vem com os planos pagos"), **sem percentuais** e sem pressão; cancelamento agendado: "Seu cartão vale até 14/11, quando o plano muda para o Livre."; parceiro suspenso some da lista; nenhum parceiro ativo na cidade: estado vazio "Ainda não há parceiros por aqui."

## B9. Trocar e cancelar o plano
**Começa em**: Mais. **Máximo**: 6 toques para trocar; 4 para cancelar. **Telas**: 17, 18. **RN**: RN-PLN-01 a 08, 11, 13, 14, 19, 22, RN-GRP-17, RN-CRT-03, RN-ATD-11, RN-CAN-06.
1. Mais (1), **Meu plano** (2): plano atual, preço, situação e "Ver outros planos" (3).
2. **Quadro dos 4 planos** sem letra miúda: cada um com preço e 3 itens (o que **entra** em relação ao atual) e o aviso fixo "A mensalidade não inclui serviços da rede nem atendimento psicológico." Tocar no plano (4).
3. **Folha com o efeito**, uma frase por caso:
   - **Subir**: "Vale hoje. O Cartão Nexus é emitido agora. A cobrança de R$ 119,90 começa no próximo ciclo, em 18/11/2026." Botão **Mudar para o Cuida**.
   - **Descer**: "Vale no fim do ciclo, em 18/11/2026. Até lá, o Cuida continua, inclusive os grupos." e o efeito colateral à vista: "Você sai dos grupos que começam depois dessa data: Sobrecarga e autocuidado (03/12). Os grupos em andamento continuam até o fim do ciclo." Botão **Agendar mudança para o Essencial**.
   - **Cancelar**: "O cancelamento fica agendado para 18/11/2026. Até lá tudo continua. Nessa data o cartão deixa de valer e o plano vira Livre." Botão **Agendar cancelamento**.
4. **Aviso com aceite** (na primeira contratação de plano pago): o aviso de emergência e os canais (RN-ATD-11, RN-CAN-06), caixa "Li e entendi" (5).
5. Botão final **Confirmar mudança de plano** (6). **Sem campo de cartão de crédito** (pagamento simulado, decisão 5). Resultado: "Plano alterado para o Cuida. Cartão NX-0000-0042 emitido."
6. **Desistir**: com mudança ou cancelamento agendado, o cartão do plano mostra o botão de texto **Manter meu plano** (um toque, sem folha, reversível) e a faixa "Plano mantido".

**Erros e recuperação**: plano **pago pela empresa**: "Este plano é pago pela empresa Exemplo Logística. A mudança é feita pelo contrato da empresa." (sem botões de troca); já está no plano: opção marcada "Seu plano agora" e sem ação; nada de oferta ligada à pontuação (RN-PLN-19); **o plano nunca é oferecido** em Hoje nem em Como estou.

## B10. Falar com a Nexus (aplicativo, WhatsApp ou telefone)
**Começa em**: Hoje (link "Falar com a gente"), Mais, Ajuda agora ou Como estou. **Máximo**: 3 toques para ver o número; 4 para mandar uma mensagem. **Telas**: 19 e o diálogo A.2.16. **RN**: RN-CAN-01 a 06, RN-USR-18, RN-ATD-11.
1. Hoje, link **Falar com a gente** (1): abre o diálogo "Como falar com a gente" com o **canal preferido primeiro**.
2. **Telefone ou WhatsApp**: **Copiar número** (2). Faixa "Número copiado." O diálogo repete "No protótipo, a ligação não é feita."
3. **Mensagem no aplicativo**: **Escrever mensagem** (2) leva à tela **Falar com a Nexus**: assunto em 3 chips (Dúvida sobre o app, Preciso remarcar ou cancelar, Outro assunto) (3), texto, **Enviar mensagem** (4). Confirmação: "Recebemos a sua mensagem. Respondemos em até 24 horas úteis."
4. As respostas aparecem na mesma tela, em ordem, com a data.

**Erros e recuperação**: fora do horário comercial, o telefone mostra "Fechado agora. Abrimos amanhã às 8h." e sugere WhatsApp ou mensagem; clipboard negado: o número fica selecionado com "Segure sobre o número e escolha Copiar"; mensagem vazia: "Escreva a sua mensagem para enviar."; o canal preferido é WhatsApp mas não há número: aviso no **Perfil** (CX-041): "Você prefere o WhatsApp, mas não informou o número. Informe para a equipe poder falar com você."

## B11. Retirar um consentimento
**Começa em**: Mais. **Máximo**: 4 toques. **Telas**: 17, 21. **RN**: RN-LGPD-04, 05, 14, 20, RN-ARBE-09.
1. Mais (1), **Privacidade e meus dados** (2): lista dos 6 consentimentos (cada um com o estado "Você autorizou" ou "Você não autorizou").
2. Tocar em **Dados de saúde** (3): a folha mostra o texto simples e o botão **Retirar a autorização** (4).
3. **Folha de efeito** (o último passo antes de gravar), para a autorização de saúde: "Ao retirar: a escala de cansaço e o acompanhamento ficam pausados. O que já foi registrado fica guardado por 5 anos, como a norma do conselho pede. O plano Livre, a agenda e os remédios continuam. Você pode autorizar de novo quando quiser." Botões **Retirar a autorização** (suave) e **Voltar** (foco inicial).
4. Resultado: o cartão passa a "Você não autorizou" com **Autorizar de novo**, e a tela Como estou passa a explicar a pausa.

**Erros e recuperação**: arrependeu: **Autorizar de novo** a qualquer momento (mesmo caminho, um toque mais o texto); cada consentimento é **independente** (retirar imagem não mexe em saúde); histórico: "Ver histórico" mostra, em linha do tempo, quando autorizou, retirou e reautorizou (não se edita nem se apaga).

## B12. Pedir uma cópia dos dados ou a eliminação
**Começa em**: Mais, Privacidade. **Máximo**: 4 toques (cópia); 6 (eliminação). **Telas**: 21. **RN**: RN-USR-15, 16, RN-LGPD-18, 20, 21, 23, 24.
1. Mais (1), **Privacidade e meus dados** (2), **Pedir uma cópia dos meus dados** (3), folha "A equipe prepara o arquivo e avisa você em até 15 dias." **Pedir a cópia** (4). A tela passa a mostrar o pedido: protocolo, "Faltam 15 dias", estado.
2. **Eliminar**: **Pedir eliminação dos meus dados** (3), **folha de efeito** em duas colunas de texto: **Será eliminado** (cadastro, contatos, mensagens, agenda, remédios) e **Ficará guardado e sem uso**, com o motivo e o prazo (aplicações da escala e anotações do atendimento: "guardados por 5 anos, como a norma do conselho pede") (4). Caixa "Entendi o que será eliminado e o que ficará guardado" (5). Botão **Pedir eliminação** (6, ato irreversível: vermelho só aqui).
3. O pedido aparece com protocolo, "Faltam 15 dias" (contagem em dias corridos, sem relógio nem vermelho), e o botão de texto **Retirar o pedido** enquanto estiver aberto. A pessoa **continua usando o app** normalmente (cadastro `closure_requested`).
4. **Pronto**: quando a equipe conclui, o pedido de cópia mostra **Baixar o arquivo** (JSON) e o de eliminação mostra "Concluído em 19/11/2026" e o que ficou guardado.

**Erros e recuperação**: pedido repetido: "Você já tem um pedido de cópia em andamento (protocolo DSR-0006)."; arrependimento antes de a equipe concluir: **Retirar o pedido**; pedido recusado pela equipe: mostra o motivo escrito; a eliminação **nunca apaga na hora**: o prazo e o que fica guardado são ditos antes (RN-LGPD-24).

## B13. Compartilhar a rotina com a família
**Começa em**: Mais. **Máximo**: 5 toques. **Telas**: 20. **RN**: RN-USR-11, RN-LGPD-05(c), RN-ATD-18, RN-GRP-10.
1. Mais (1), **Família** (2).
2. Se a autorização de compartilhar **não foi dada**: cartão "Para compartilhar, precisamos da sua autorização" com a pergunta do consentimento e **Autorizo** e **Agora não** (de peso igual) (3). Se foi dada, passa direto.
3. **O que incluir?** 3 chaves, desligadas por padrão: "Compromissos de hoje", "Compromissos desta semana", "Remédios de hoje (nome e horário)" (3 a 5, só as que a pessoa quiser).
4. O **texto pronto** aparece numa caixa, atualizado a cada chave; botão **Copiar texto** (último toque). Faixa: "Texto copiado. Cole na conversa da sua família."
5. A tela diz, fixo: "Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui."

**Erros e recuperação**: nenhuma chave ligada: a caixa mostra "Escolha o que você quer compartilhar." e **Copiar texto** fica sem uso com o motivo escrito; clipboard negado: a caixa fica selecionada com "Segure sobre o texto e escolha Copiar"; arrependeu da autorização: em Privacidade, retirar "Compartilhar com a família" (B11); **não há envio**: o app só gera o texto.

## B14. Pedir ajuda agora
**Começa em**: qualquer tela. **Máximo**: **1 toque** para chegar; 2 para ver um número. **Telas**: 3, diálogo A.2.16. **RN**: RN-ATD-11, RN-CAN-05, 06, RN-ENC-03, 05, 09.
1. Tocar **Ajuda agora** no cabeçalho (1).
2. A tela mostra três caminhos, na ordem: **Emergência de saúde: SAMU 192**; **Estou muito mal ou penso em me machucar: CVV 188**; **Falar com a equipe da Nexus** (abre o diálogo "Como falar com a gente"). Cada número mostra "Ligar" que abre o diálogo com o número grande e **Copiar número** (2).
3. Abaixo, recolhido: "Violência ou maus-tratos contra a pessoa idosa: Disque 100".

**Erros e recuperação**: a tela **não exige login nem consentimento** (funciona também em `/cuidador/comecar`); o protótipo não disca (decisão 6): o diálogo diz "No protótipo, a ligação não é feita. Em uma emergência de verdade, ligue 192 do seu telefone."; nada nesta tela é medido, contado nem usado em oferta (RN-PLN-19).

---

# PARTE C. Telas

Cada tela traz: propósito, ação principal, blocos por prioridade (o que aparece de cara e o que fica atrás de um toque), textos reais, estados, como muda para cada pessoa de demonstração, RN e critérios de aceite `AC-CG-NN`. As rotas são relativas a `/cuidador`, salvo a Entrada. Sempre valem os critérios de A.6 (AC-CG-01 a 16): letra, alvos, "Ajuda agora", barra, protótipo, folha.

## C1. `/login`: Entrada do cuidador (Base, `features/auth`)
**Propósito.** Deixar a pessoa entrar como cuidador de demonstração, ou começar a conta, em um toque, sem senha.
**Ação principal.** Tocar no cartão da pessoa de exemplo.
**De cara** (nesta ordem):
1. Faixa de protótipo (dourada suave) com o texto literal do aviso (A.2.18) e o marcador de marca (símbolo, NEXUS, "Quem cuida também precisa de sustentação.").
2. `h1` "Entrar". Duas portas em cartões grandes: **Sou cuidador(a)** (aberta, em destaque) e **Sou da equipe Nexus** (recolhida, discreta; ao abrir mostra a lista atual de 8 pessoas e o segundo fator, que **não mudam**).
3. Na porta do cuidador: frase "Neste protótipo não há senha. Escolha uma pessoa de exemplo." e **6 cartões** (item de lista de 88 px): iniciais, nome e idade, etiqueta de plano, uma frase neutra.
**Atrás de um toque.**
- "Ver mais exemplos" (botão de texto) mostra mais 5 cartões (a 11ª pessoa é a Raimunda, com pedido de privacidade aberto).
- "Criar minha conta" (botão secundário abaixo da lista) leva a `/cuidador/comecar`.
**Textos.**
- Título da porta: "Sou cuidador(a)". Apoio: "Para quem cuida de uma pessoa idosa."
- Cartões (frase neutra, **sem pontuação, sem dado de saúde**) `[S-10]`: Ana Paula Ferraz, 45 anos, plano Cuida: "Cuida da mãe e organiza consultas e remédios."
  - Maria Aparecida Lemos, 52, Essencial: "Divide o trabalho e o cuidado da mãe."
  - João Batista Carneiro, 68, Livre: "Cuida da esposa e prefere falar por telefone."
  - Rita de Cássia Moura, 50, Cuida: "Participa do piloto da Nexus."
  - Elza Guimarães, 68, Sustenta: "Usa bastante o Cartão Nexus."
  - Lourdes Campos, 64, Sustenta: "Está na lista de espera de um grupo." Em "Ver mais exemplos": Terezinha Alves, 66, Essencial: "Concluiu o piloto da Nexus."
  - Marcos Vinícius Leal, 39, Essencial: "Tem uma mudança de plano agendada."
  - Sônia Maria Dutra, 55, Essencial: "Retirou uma autorização de privacidade."
  - Marlene Cardoso, 61, Livre: "Usa só a organização da rotina."
  - Raimunda Siqueira, 53, Livre: "Tem um pedido de privacidade aberto." (a 11ª pessoa, com pedido de exclusão aberto)
- Botões: "Criar minha conta", "Ver mais exemplos", "Ver menos exemplos".
- Rodapé: "Em emergência, ligue 192 (SAMU)." e o botão de texto "Ajuda agora" (a entrada não tem o cabeçalho do app).
**Estados.**
- Primeira visita: banner de armazenamento local do ERP (não bloqueia).
- Armazenamento do navegador bloqueado: tela de erro útil (B0).
- Com sessão do cuidador já aberta: vai direto a `/cuidador/hoje`.
- Com sessão da equipe aberta e a pessoa escolhe cuidador: a sessão da equipe é encerrada antes, com aviso "Você saiu da conta da equipe." Cadastro `closed`, anonimizado ou eliminado **não aparece**; quem tem pedido de exclusão aberto aparece normalmente.
**Por pessoa.** Igual para todos: a lista não muda; a pessoa escolhida define o resto do app.
**RN.** RN-USR-02, RN-LGPD-15 (sem segundo fator para o cuidador), RN-LGPD-25, RN-ATD-11.
**Critérios de aceite.**
- **AC-CG-17** Dada a rota `/login`, então a porta "Sou cuidador(a)" vem **antes** e aberta, com 6 cartões; "Sou da equipe Nexus" vem depois, recolhida, e ao abrir mostra a lista atual com o segundo fator.
- **AC-CG-18** Dado um toque em um cartão do cuidador, então a sessão é criada em `sessionStorage` na chave `nexus-erp:caregiver-session` e a rota é `/cuidador/hoje` (ou a rota de origem na mesma aba), **sem senha e sem pedido de código**.
- **AC-CG-19** Dado "Ver mais exemplos", então aparecem mais 5 cartões (11 no total) e o botão passa a "Ver menos exemplos"; o foco fica no primeiro cartão novo.
- **AC-CG-20** Dado um cuidador com cadastro `closed`, anonimizado ou eliminado, então ele **não aparece** na lista; dado um com pedido de exclusão aberto, então aparece.
- **AC-CG-21** Dado qualquer cartão de cuidador, então a frase de apoio **não contém pontuação, faixa, alerta nem dado de saúde**, e o cartão tem altura de pelo menos 72 px, com a área tocável inteira.
- **AC-CG-22** Dada uma sessão da equipe, quando abre `/cuidador/**`, então volta a `/app/painel`; dada uma sessão do cuidador, quando abre `/app/**`, então volta a `/cuidador/hoje`.
- **AC-CG-23** Dado um toque em "Criar minha conta" ou em "Ajuda agora" **sem sessão**, então abrem `/cuidador/comecar` e `/cuidador/ajuda-agora`, que **não exigem login**.

## C2. `/cuidador/comecar`: Começar (cadastro de quem é novo) (P1, `start`)
**Propósito.** Criar a conta do cuidador e da pessoa idosa, no plano Livre, em 5 etapas curtas que se podem pausar.
**Ação principal.** **Continuar** (em cada etapa) e **Criar minha conta** (na última).
**Modo foco**: cabeçalho com "Ajuda agora", **sem barra inferior**, faixa de protótipo no início, passo a passo (A.2.13) e barra de ação fixa com **Continuar** e **Voltar**.
**Boas-vindas** (antes da etapa 1): `h1` "Vamos começar". Três linhas: "Leva uns 5 minutos. Você pode parar e continuar depois." · "Você escolhe o que autoriza e pode mudar quando quiser." · "O plano Livre não custa nada e não pede cartão." Botão **Começar** e botão de texto "Já tenho conta" (volta a `/login`).
**Etapas** (uma pergunta por assunto, nada além do necessário):
1. **Sobre você**: Nome completo · Data de nascimento · CPF (dica "Protótipo: use um CPF fictício." e botão "Gerar CPF fictício") · Celular (dica "Exemplo: (34) 90000-0000") · E-mail (dica "Use um e-mail que termine em @exemplo.com.br") · Cidade (já com "Uberlândia"). No alto, botão de texto "Preencher com dados de exemplo".
2. **Quem você cuida**: Nome da pessoa idosa · Data de nascimento dela · "Quem é essa pessoa para você?" (Filha, Filho, Esposa ou marido, Nora, Neto ou neta, Outro) · "Como está a rotina dela?" em 3 cartões de escolha: "Faz quase tudo sem ajuda", "Precisa de ajuda em algumas tarefas", "Precisa de ajuda em quase tudo". Nota: "Os remédios você cadastra depois, em Rotina."
3. **Seu dia a dia**: "Quantas horas por dia você dedica ao cuidado?" (0 a 24, botões menos e mais, dica "Pode mudar depois.") · "Como você prefere que a gente fale com você?" (Pelo aplicativo, Pelo WhatsApp, Por telefone) · se WhatsApp, "Número do WhatsApp" (já com o celular) · "Tamanho da letra" (A.2.20, com prévia).
4. **O que você autoriza**: introdução "Você escolhe cada item separado. Pode mudar quando quiser, em Mais, Privacidade e meus dados. O plano Livre continua em qualquer caso." Cartão **Dados de saúde** aberto (pergunta, o que vamos fazer, por quê, quem vê, se disser não, se mudar de ideia, de `CONSENT_COPY`); depois 4 cartões recolhidos (números somados, família, imagem e depoimento, WhatsApp) com a pergunta e as 3 opções **Concordo**, **Não concordo**, **Decidir depois**, e "Ler mais" para o texto completo. O piloto (TCLE) **não é oferecido aqui** `[S-12]`.
5. **Confira e termine**: 4 blocos de resumo com "Editar", o aviso de emergência com aceite ("Li e entendi") e **Criar minha conta**.
**Pronto**: `h1` "Tudo pronto, Ana." "Sua conta no plano Livre está criada." Itens: "Cadastrar os remédios" (leva a Remédios), "Adicionar um compromisso" (Agenda), "Conhecer o Cuidar de mim". Botão **Ir para Hoje**. Se autorizou a saúde: "Se você autorizou o acompanhamento, a equipe de psicologia entra em contato para uma primeira conversa." (RN-ZRT-07; sem prazo prometido).
**Estados.**
- Rascunho guardado a cada etapa ("Rascunho salvo às 10:42") e "Retomar ou começar de novo?" ao voltar; erro por campo e resumo no topo ("Há 2 pontos para corrigir"), dados mantidos; falha ao gravar: "Não foi possível salvar. Tente de novo; se continuar, fale com a gente." Consentimento de saúde recusado: nota `info` de B1.
- Quem já tem sessão: vai a Hoje.
- Familiaridade digital **não** é perguntada (fica "média") `[S-12]`.
**Por pessoa.** Não é usada pelas pessoas de demonstração (já cadastradas); o QA cria uma conta nova com "Preencher com dados de exemplo".
**RN.** RN-USR-02 a 04, 09, 10, 14, 18, RN-LGPD-04, 05, 07, RN-PLN-02, RN-ATD-11, RN-CAN-06, RN-ZRT-07.
**Critérios de aceite.**
- **AC-CG-24** Dada a rota `/cuidador/comecar`, então a tela tem cabeçalho com "Ajuda agora", **não tem** barra inferior, mostra "Etapa X de 5" com o nome da etapa e as 5 etapas na ordem Sobre você, Quem você cuida, Seu dia a dia, O que você autoriza, Confira e termine.
- **AC-CG-25** Dada a etapa 1 com data de nascimento que dá menos de 18 anos, quando se toca Continuar, então aparece "Você precisa ter 18 anos ou mais." junto do campo e no resumo, e nada digitado é apagado; com exatamente 18 anos hoje, passa.
- **AC-CG-26** Dada a etapa 1 com CPF válido de verdade, então aparece "Parece um CPF real. Use um CPF fictício."; dado o toque em "Gerar CPF fictício", então o campo recebe um CPF fictício inválido e o erro some.
- **AC-CG-27** Dada a etapa 3 com horas fora de 0 a 24, então aparece "As horas por dia devem ser de 0 a 24."; dado canal WhatsApp, então o campo de número aparece já preenchido com o celular.
- **AC-CG-28** Dada a etapa 4, então a autorização de saúde aparece em **duas frases** com "Ler mais" e as outras 4 ficam num bloco **"Outras autorizações (opcional)"**, recolhido (CXC-015); os 5 consentimentos são cartões **independentes**, nenhuma opção vem marcada, "Concordo", "Não concordo" e "Decidir depois" têm o mesmo tamanho e peso, o piloto (TCLE) não aparece, e quem toca Continuar sem escolher fica "Decidir depois" (`pending`).
- **AC-CG-29** Dado o consentimento de saúde recusado ou adiado, então o cadastro conclui normalmente no plano Livre e aparece a nota "A agenda, os remédios e os conteúdos continuam. A conversa de acompanhamento só acontece com a sua autorização." (sem "Tudo bem.", CXC-023)
- **AC-CG-30** Dada a etapa 5 (uma linha por bloco, com "Editar", sem repetir o que a pessoa digitou) sem o aceite do aviso de emergência, quando se toca **Criar minha conta**, então aparece "Marque que você leu o aviso para criar a conta." e a conta não é criada; com o aceite, grava a data e a hora.
- **AC-CG-31** Dado **Criar minha conta**, então nascem 1 cuidador `active`, 1 pessoa idosa vinculada, 1 assinatura Livre, 6 consentimentos com o estado escolhido (`granted`, `refused` ou `pending`) e eventos de consentimento com canal "aplicativo"; a pessoa é levada à tela "Tudo pronto".
- **AC-CG-32** Dado que a pessoa sai no meio e volta, então aparece "Você tem um cadastro em andamento. Retomar ou começar de novo?" com os dois botões de mesmo peso, e "Retomar" restaura todos os campos.
- **AC-CG-33** Dado todo o fluxo, então **não existe campo de número de cartão, validade nem pagamento**, e nenhuma etapa pede condição de saúde ou remédio.

## C3. `/cuidador/ajuda-agora`: Ajuda agora (P2, `help`)
**Propósito.** Mostrar, em uma tela calma, a quem recorrer agora: emergência de saúde, sofrimento emocional ou a equipe da Nexus.
**Ação principal.** Tocar no número do caminho que combina com o momento.
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| NEXUS                  [Ajuda agora] |
| Ajuda agora                          |
| ____                                 |
| Escolha o que combina com o que      |
| está acontecendo.                    |
| ############ (azul 900) ############ |
| # Emergência de saúde              # |
| # A pessoa idosa ou você precisa   # |
| # de atendimento de saúde agora.   # |
| # 192                              # |
| # [ Ligar para o SAMU 192 ]        # |
| ################################## |
| +----------------------------------+ |
| | Estou muito mal ou penso em me   | |
| | machucar.   188                  | |
| | [ Ligar para o CVV 188 ]         | |
| +----------------------------------+ |
| | Falar com a equipe da Nexus      | |
| | [ Como falar com a gente ]       | |
| +----------------------------------+ |
| Mais contatos  (recolhido)           |
| Os canais da Nexus não substituem... |
+--------------------------------------+
```
**De cara** (3 cartões em ordem de gravidade, o primeiro com mais peso):
1. **Emergência de saúde**: fundo `--cg-emergency-bg`, texto branco, número "192" em 40 px, botão branco **Ligar para o SAMU 192**.
2. **Estou muito mal ou penso em me machucar**: cartão branco, número "188", botão **Ligar para o CVV 188**.
3. **Falar com a equipe da Nexus**: cartão branco, botão **Como falar com a gente** (abre o diálogo A.2.16).
**Atrás de um toque.** "Mais contatos" (recolhido): Disque 100 (violência ou maus-tratos contra a pessoa idosa) e CRAS (apoio social e direitos).
**Textos.**
- `h1` "Ajuda agora". Apoio: "Escolha o que combina com o que está acontecendo."
- Cartão 1: título "Emergência de saúde". Texto: "A pessoa idosa ou você precisa de atendimento de saúde agora." Número "192". Botão "Ligar para o SAMU 192".
- Cartão 2: título "Estou muito mal ou penso em me machucar". Texto: "O CVV conversa com você a qualquer hora, de graça. Ligue 188. Também atende por chat no site cvv.org.br." Botão "Ligar para o CVV 188".
- Cartão 3: título "Falar com a equipe da Nexus". Texto: "Para dúvidas, remarcar ou pedir apoio. Em horário comercial, a ligação é atendida na hora." Botão "Como falar com a gente".
- "Mais contatos": "Violência ou maus-tratos contra a pessoa idosa: Disque 100." · "Apoio social e direitos: o CRAS do seu bairro."
- Rodapé: "Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios."
- Diálogo do número (192, 188, 100): número em 40 px, **Copiar número**, "No protótipo, a ligação não é feita. Em uma emergência de verdade, ligue do seu telefone." `[S-13]`.
**Estados.**
- Funciona **sem sessão** e **sem consentimento**; funciona offline (conteúdo fixo).
- Fora do horário comercial, o cartão 3 mostra "Fechado agora. Abrimos amanhã às 8h. Deixe uma mensagem pelo WhatsApp." Nada nesta tela é contado, cobrado nem usado em oferta.
**Por pessoa.** Igual para todos. O cartão 3 destaca o **canal preferido** da pessoa (João: telefone primeiro, com o número já visível).
**RN.** RN-ATD-11, RN-CAN-05, 06, RN-ENC-03, 05, 09, RN-ETICA-15, RN-PLN-19.
**Critérios de aceite.**
- **AC-CG-34** Dada a rota `/cuidador/ajuda-agora`, então aparecem, nesta ordem, os cartões Emergência de saúde (192), CVV (188) e Falar com a equipe da Nexus, mais "Mais contatos" recolhido.
- **AC-CG-35** Dado qualquer cartão com número, quando se toca o botão, então abre o diálogo com o número em 40 px, **Copiar número** e o texto "No protótipo, a ligação não é feita.", e **nenhum** `tel:` abre sozinho.
- **AC-CG-36** Dada a tela inteira, então **não há** vermelho, sirene, animação, contagem regressiva, pergunta de consentimento, preço ou plano; o fundo escuro do cartão 1 é azul 900 com texto branco (13:1).
- **AC-CG-37** Dado um acesso **sem sessão** ou **sem consentimento de saúde**, então a tela abre normalmente com todo o conteúdo.
- **AC-CG-38** Dada a pessoa com canal preferido telefone, então no cartão 3 o telefone aparece primeiro, com o número visível.
- **AC-CG-39** Dado o horário simulado fora de segunda a sexta, 8h às 18h, então o cartão 3 mostra "Fechado agora. Abrimos amanhã às 8h." (ou "na segunda às 8h").
- **AC-CG-40** Dado o rodapé, então contém o texto literal de que os canais não substituem atendimento de saúde nem orientação sobre remédios (RN-CAN-06).

## C4. `/cuidador/hoje`: Hoje (P1, `today`)
**Propósito.** Mostrar o que importa **hoje** para a pessoa e para quem ela cuida, sem painel.
**Ação principal.** Tocar **Dei** no próximo remédio (ou, sem remédio, abrir o próximo compromisso).
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| NEXUS                  [Ajuda agora] |
| Bom dia, Ana                         |
| ____  quarta-feira, 04/11            |
| (mão-coração) A equipe de psicologia |
|   vai falar com você hoje.           |
|   Prefere falar agora?   (só se há)  |
| +----------------------------------+ |
| | Próximo compromisso            > | |
| | Fisioterapia, hoje às 14:00      | |
| +----------------------------------+ |
| Remédios de hoje        2 de 4 dados |
| (pílula) Losartana 50 mg  08:00      |
|          Dado às 08:12   [Desfazer]  |
| (pílula) Metformina       12:00      |
|          [          Dei           ]  |
|   ... até 4 linhas, "Ver todos (6)"  |
| ------------ abaixo da dobra ------- |
| Como você está hoje?                 |
| [Muito mal][Mal][Mais ou menos]...   |
| Para você: convite do dia ou avaliar |
| Falar com a gente   (texto)          |
| Protótipo de demonstração...         |
| Hoje | Rotina | Cuidar | Rede | Mais |
+--------------------------------------+
```
**Blocos em ordem de prioridade** (celular, uma coluna; 1280 px: duas colunas, ver A.3):
1. **Saudação** (h1 serifado): "Bom dia, Ana" (por hora do relógio simulado: Bom dia até 11:59, Boa tarde até 17:59, Boa noite depois) `[S-14]`. Apoio: "quarta-feira, 04/11".
2. **Nota de cuidado** (só com contato da equipe pendente ou vencido, A.2.5 `care`; **de cara**, logo abaixo da saudação).
3. **Próximo compromisso** (cartão que abre a Agenda): o mais próximo entre os da pessoa idosa e a **conversa da própria pessoa** com o psicólogo (esta com a marca "Para você").
4. **Remédios de hoje** (h2 e até 4 linhas com **Dei**, em ordem de horário; as dadas ficam no lugar; mais de 4: "Ver todos (6)" leva a Remédios).
**Atrás de um toque / mais abaixo:**
5. **Como você está hoje?** (humor, A.2.11), só com o consentimento de saúde `[S-29]`.
6. **Para você** (uma coisa só): ou **avaliar um serviço concluído**, ou **o convite do dia** `[S-11]`.
7. **Falar com a gente** (botão de texto) e o aviso de protótipo.
**Textos.**
- Nota de cuidado, **contato pendente hoje**: título "A equipe de psicologia vai falar com você hoje." Texto: "Você não precisa fazer nada." (o título diz "hoje" só em horário comercial; fora dele, "amanhã de manhã" ou "na segunda de manhã", CXC-003). Ação: botão de texto "Prefere falar agora?" (abre o diálogo A.2.16).
- Nota de cuidado, **contato que ainda não aconteceu** (já passou do dia): título "Queremos falar com você." Texto: "Se quiser, fale com a gente agora." (sem "responsável técnica" e sem "ainda não conseguiu falar com você", CXC-003). Ação: botão **Falar com a gente agora**.
- **Nunca** aparecem: "alerta", "vermelho", "urgente", pontuação, faixa, prazo em horas, "vencido", "atrasado".
- Compromisso: título "Próximo compromisso"; "Fisioterapia, hoje às 14:00"; apoio "Clínica Movimento Vital". Conversa da pessoa: "Sua conversa com a Dra. Beatriz, qui, 06/11, às 14:00" (a etiqueta "Para você" fica na Agenda; em Hoje a frase já diz que é dela, CXC-020). Vazio: "Nenhum compromisso nos próximos dias." e botão de texto "Adicionar compromisso".
- Remédios: "Remédios de hoje" e "2 de 4 dados". Linha: "Losartana 50 mg", "08:00", botão "Dei". Dado: "Dado às 08:12" e "Desfazer". Vazio sem cadastro: "Nenhum remédio cadastrado." e botão "Cadastrar um remédio". Sem remédio hoje: "Hoje não há remédios para dar."
- Humor: pergunta "Como você está hoje?"; depois "Anotado para hoje: Bem." e "Mudar". Se "Muito mal" ou "Mal": nota `care` "Dias difíceis acontecem. Se quiser conversar, fale com a gente." com **Falar com a gente** (e, para "Muito mal", "Ajuda agora").
- Convite do dia (rodízio fixo, **só itens abertos a todos os planos**): "Uma conversa só para você. Reserve um horário com um psicólogo da Nexus. Você escolhe o formato." (**Ver horários**)
  - "Roda de conversa aberta. Quinta, 12/11, às 19:00. Aberta a todos." (**Ver detalhes**)
  - "Leitura de 3 minutos. {título do conteúdo}." (**Ler agora**).
- Avaliar: "Como foi o atendimento de Dra. Renata Sampaio?" e **Avaliar**, que leva a `/cuidador/rede/pedidos?avaliar=<id do pedido>` (a folha de avaliação é de Meus pedidos).
- Fechamento: "Precisa de ajuda com o app ou com a sua conta?" e botão de texto **Falar com a gente**.
**Estados.**
- Carregando: esqueleto dos 3 primeiros blocos.
- Erro: "Não foi possível abrir o seu dia. Tente de novo." e **Tentar de novo**.
- Conta nova sem nada: nota `soft` "Ainda não há nada para hoje. Comece pelos remédios ou por um compromisso." com os dois botões.
- Sem conexão: nota `soft` "Você está sem conexão. Seus dados continuam neste navegador." Consentimento de saúde retirado: **somem** a nota de cuidado e o humor; nada os substitui em Hoje (a explicação fica em Como estou).
- **Plano nunca aparece em Hoje.**
**Por pessoa.**
- (resumo; tabela completa na Parte D).
- **Ana**: nota "vai falar com você hoje", sem convite.
- **Maria**: nota "ainda não conseguiu falar com você", sem convite.
- **João**: sem nota; o fechamento vira cartão "Prefere falar com a gente?" com o telefone `(34) 90000-0000` em destaque.
- **Sônia**: sem humor.
- **Marcos**: tudo padrão (a mudança de plano **não** aparece em Hoje).
**RN.** RN-USR-07, RN-ZRT-13, 14, 18, 19, RN-PLN-19, RN-LGPD-14, 17, 27, RN-ARP-16, RN-USR-19, RN-ETICA-15.
**Critérios de aceite.**
- **AC-CG-41** Dada a rota `/cuidador/hoje`, então os blocos aparecem na ordem saudação, nota de cuidado (se houver), próximo compromisso, remédios, humor, "Para você", "Falar com a gente"; só um h1; e em 360 x 800 px, sem rolar, aparecem a nota, o compromisso e as 2 primeiras linhas de remédio quando há nota, ou o compromisso e as 3 primeiras linhas quando não há.
- **AC-CG-42** Dada a hora simulada, então a saudação é "Bom dia" até 11:59, "Boa tarde" até 17:59 e "Boa noite" depois, com o primeiro nome.
- **AC-CG-43** Dada Ana (contato pendente hoje), então Hoje mostra "A equipe de psicologia vai falar com você hoje." (**só em horário comercial**, segunda a sexta, 8h às 18h; fora dele, "amanhã de manhã" ou "na segunda de manhã", CXC-003) e **não** mostra "alerta", "vermelho", pontuação, faixa nem relógio; e o "Para você" mostra só o item de avaliação, se houver, **nunca** o convite do dia.
- **AC-CG-44** Dada Maria (contato vencido), então Hoje mostra "Queremos falar com você. Se quiser, fale com a gente agora." (sem "responsável técnica" e sem "ainda não conseguiu", CXC-003) com o botão "Falar com a gente agora", **sem** "vencido", "atrasado" nem prazo, em estilo `care` (azul), nunca vermelho.
- **AC-CG-45** Dado o contato da equipe registrado (Ana ou Maria), quando Hoje é aberto de novo, então a nota **não aparece mais**.
- **AC-CG-46** Dada uma linha de remédio, quando se toca **Dei**, então em 1 toque a linha mostra "Dado às HH:mm" com `circle-check`, aparece a faixa "Anotado às HH:mm. Desfazer." por 8 s, existe um `doseCheck` (`medicationId`, `date`, `time`, `givenAt`), e a linha **não muda de posição**.
- **AC-CG-47** Dada uma linha dada, quando se toca "Desfazer" (na faixa ou no link pequeno da linha, **longe do lugar do Dei**; um toque até 1 s depois do Dei é ignorado, CXC-008), então o `doseCheck` é removido, a linha volta ao estado anterior e **não há** diálogo de confirmação.
- **AC-CG-48** Dado um remédio cujo horário passou sem "Dei", então a linha mostra "Ainda não anotado" (texto neutro, sem a palavra "passou"; o âmbar suave com relógio só na **primeira** linha em atraso, as outras neutras, CXC-005), **sem vermelho**, e o botão "Dei" segue ativo. As doses que faltam aparecem **primeiro**.
- **AC-CG-49** Dados mais de 4 remédios no dia, então aparecem 4 linhas e "Ver todos (N)" que abre a aba Remédios; dado nenhum cadastrado, então aparece o vazio com "Cadastrar um remédio".
- **AC-CG-50** Dado o humor, quando se toca uma das 5 opções, então grava **um registro por dia** (tocar de novo em "Mudar" substitui), nada vem pré-marcado e as 5 opções têm o mesmo visual (sem cor de semáforo); dado "Muito mal" ou "Mal", então aparece a nota "Dias difíceis acontecem..." com "Falar com a gente".
- **AC-CG-51** Dado consentimento de saúde retirado (Sônia), então o bloco de humor **não aparece** em Hoje e a nota de cuidado também não.
- **AC-CG-52** Dado o convite do dia, então ele é sempre de item **aberto a todos os planos** (conversa com psicólogo, roda aberta ou conteúdo livre), muda por regra de calendário, **nunca** depende de pontuação, faixa, alerta ou ARBE, e **nunca** mostra preço, plano nem bloqueio.
- **AC-CG-53** Dado um serviço da rede concluído e ainda sem avaliação, então "Para você" mostra "Como foi o atendimento de {nome}?" com **Avaliar**, que leva a `/cuidador/rede/pedidos?avaliar=<id do pedido>`, onde abre a folha de A.2.22 (a folha é de Meus pedidos, não de Hoje).
- **AC-CG-54** Dada a pessoa com canal preferido telefone ou familiaridade digital baixa (João), então o cartão "Prefere falar com a gente?" com o telefone `(34) 90000-0000` em destaque **sobe para logo depois da saudação** quando o canal preferido é telefone ou WhatsApp (CXC-025; "No protótipo, a ligação não é feita." só aparece ao tocar); para os demais o fechamento é o botão de texto "Como falar com a gente".
- **AC-CG-55** Dado Hoje em 1280 px, então os blocos ficam em duas colunas (compromisso e remédios à esquerda; humor e convite à direita) e a nota de cuidado ocupa a largura toda acima.
- **AC-CG-56** Dado Hoje, então não aparece plano, preço, desconto, pontuação, faixa, ARBE nem a palavra "alerta" para nenhuma pessoa de demonstração.

## C5. `/cuidador/rotina/agenda`: Rotina, aba Agenda (P1, `routine`)
**Propósito.** Ver e organizar os compromissos da pessoa idosa (consultas, fisioterapia, outros) **num calendário do mês**, com a lista do dia escolhido logo abaixo (ao lado, em tela larga), e ver a própria conversa com o psicólogo no mesmo dia. Mudou depois de o dono ver o app publicado: "agenda em lista (deveria ser em formato de calendário pra facilitar pro usuário)". O detalhe do que foi feito, as decisões e o que ficou para conferir no navegador estão em `docs/16-calendario-agenda.md`.
**Ação principal.** **Adicionar compromisso neste dia** (o dia escolhido já vai preenchido).
**De cara.**
- `h1` "Rotina"; abas **Agenda** e **Remédios** (2 abas de 56 px, linha dourada na atual).
- O alternador pequeno **Calendário | Lista** (Calendário marcado; a escolha fica guardada no navegador).
- O **calendário** do mês de hoje (`app-cg-calendar`, A.2.25), com **hoje já escolhido**.
- O **cartão do dia** escolhido ("Hoje, 4 de novembro"): os compromissos dele, em ordem de hora, e o botão primário **Adicionar compromisso neste dia**.
- No celular o calendário fica em cima e o cartão do dia embaixo; **de 1024 px em diante** ficam lado a lado (calendário à esquerda, dia à direita).
**O calendário.**
- Cabeçalho: mês e ano por extenso ("novembro de 2026"), **Mês anterior** e **Próximo mês** (botões de 48 px) e **Hoje** (volta ao mês e ao dia de hoje).
- Linha dos dias da semana (dom, seg, ter, qua, qui, sex, sáb) e a grade de dias, **começando no domingo**, com 5 ou 6 linhas; os dias do mês anterior e do seguinte aparecem esmaecidos.
- Cada dia é um botão de 44 px de lado ou mais com o número e as **marcas** dos compromissos: **uma marca por compromisso, até 3**; com 4 ou mais, duas marcas e "+2" (o que falta). Cada tipo tem **cor e forma** (nunca só a cor): Consulta (círculo), Fisioterapia (quadrado), Psicologia (losango), Para você (triângulo), Outro (círculo vazio).
- **Hoje** é o número num círculo cheio; **o dia escolhido** é uma caixa de borda grossa; dia com compromisso tem o número em negrito.
- A **legenda** (as marcas com o nome do tipo) vem logo abaixo da grade, **só se houver compromissos à vista** e só com os tipos que aparecem.
**Atrás de um toque.**
- Tocar num dia o escolhe: o cartão mostra o dia dele. Dia vazio: "Nada marcado para este dia" e o botão de adicionar, já com a data. Dia que já passou: só se lê, sem botão de adicionar.
- Tocar no compromisso abre a folha de detalhe (Remarcar, Lembrar de mim, Tirar da agenda).
- **Lista** (no alternador): a lista dos próximos 14 dias agrupada por dia ("Hoje, qua 04/11", "Amanhã, qui 05/11", "sex, 06/11"), com o botão primário **Adicionar compromisso** (sem dia preenchido), "Ver anteriores" (botão de texto, últimos 7 dias, só leitura) e "Ver mais datas" (30 dias).
**Textos.**
- Abas: "Agenda" e "Remédios". Alternador: "Calendário" e "Lista" (grupo "Ver a agenda como").
- Título do dia: "Hoje, 4 de novembro", "Amanhã, 5 de novembro" ou "Sexta, 6 de novembro" (com o ano quando não é o corrente).
- Rótulo de cada dia para leitor de tela: "6 de novembro, sexta-feira, 2 compromissos: Consulta e Fisioterapia" (hoje leva "hoje"; dia sem compromisso diz só a data).
- Item: "14:00 Fisioterapia", apoio "Clínica Movimento Vital". A conversa da própria pessoa: "Sua conversa com a Dra. Beatriz" com a etiqueta "Para você", que leva a Conversar com um psicólogo `[S-27]`.
- Folha **Novo compromisso**:
  - "O que é?" (hint "Exemplo: consulta com o cardiologista")
  - "Tipo" em chips (Consulta, Fisioterapia, Psicologia, Outro)
  - "Dia" (já vem o dia escolhido no calendário)
  - "Hora"
  - "Onde ou com quem (opcional)"
  - chave "Lembrar de mim" (ligada) com o apoio "Avisamos um dia antes e 1 hora antes. No protótipo, o aviso aparece só dentro do app." `[S-04]` `[S-17]`
  - botão **Salvar compromisso**
  - botão de texto **Voltar**.
- Folha de detalhe: título do compromisso, "qui, 06/11, às 15:00", botões **Remarcar** (secundário) e **Tirar da agenda** (perigo suave), **Voltar**. Remarcar abre só o dia e a hora (CXC-018), com o botão **Salvar novo horário**.
- Folha de confirmação: título "Tirar este compromisso da agenda?" Texto: "Ele some da sua agenda e dos lembretes." Botões **Tirar da agenda** e **Voltar** (foco inicial).
- Faixas:
  - "Compromisso salvo."
  - "Remarcado para qui, 06/11, às 15:00."
  - "Compromisso retirado." (cada uma com **Desfazer**).
- Erros:
  - "Informe o que é o compromisso."
  - "Escolha um dia de hoje em diante."
  - "Escolha uma hora que ainda não passou."
  - "Não foi possível salvar. Tente de novo; se continuar, fale com a gente."
- Vazio do dia: "Nada marcado para este dia". Vazio da Lista (nenhum compromisso em lugar nenhum): título "Nenhum compromisso por aqui", texto "Quando você adicionar uma consulta ou uma sessão, ela aparece nesta lista.", botão **Adicionar compromisso**.
**Estados.**
- Carregando (esqueleto de 3 itens), erro com "Tentar de novo", sem conexão (nota `soft`).
- Compromisso de hoje cuja hora já passou: etiqueta `late` "Já passou" (a hora já está no título; em tela estreita a etiqueta desce para baixo do título, CXC-001).
- Depois de adicionar, remarcar ou desfazer, **o calendário vai ao dia (e ao mês) do compromisso**.
- **Sem pessoa idosa cadastrada** não ocorre (o cadastro exige).
**Por pessoa.**
- Igual para todos; muda o conteúdo. Quem tem conversa marcada (Ana, Lourdes) vê a marca "Para você" no dia e o item no cartão.
- **Nada de atendimento, grupo ou escala** entra no texto de compartilhamento com a família (tela 20).
**RN.** RN-USR-07, RN-USR-09 (guarda só o necessário, sem decisão em nome da pessoa), RN-ATD-03, RN-ATD-18.
**Critérios de aceite.**
- **AC-CG-57** Dada a rota `/cuidador/rotina/agenda`, então aparecem o `h1` "Rotina", as abas Agenda (atual, `aria-selected`) e Remédios, o alternador **Calendário | Lista** (Calendário marcado, `aria-pressed`), o calendário de novembro de 2026 (mês e ano por extenso, semana de domingo a sábado, hoje com `aria-current="date"` e escolhido), **Mês anterior**, **Próximo mês** e **Hoje**, o cartão do dia escolhido com os compromissos dele, e um único botão primário, **Adicionar compromisso neste dia**. Na **Lista**, aparecem o botão primário **Adicionar compromisso** e os próximos 14 dias agrupados por dia, só com os dias que têm compromisso.
- **AC-CG-57b** Dado o calendário, então ele é uma grade (`role="grid"` com linhas, cabeçalhos de coluna e células), cada dia é um botão de 44 px de lado ou mais com o rótulo "6 de novembro, sexta-feira, 2 compromissos: Consulta e Fisioterapia", o dia escolhido leva `aria-selected="true"` e hoje leva `aria-current="date"`; a marca de cada compromisso tem cor e forma, o nome do tipo vai no rótulo, e a legenda só aparece quando há marcas, só com os tipos que aparecem.
- **AC-CG-57c** Dado o foco num dia, então as setas movem o foco (um dia e uma semana), **Home** e **End** vão ao domingo e ao sábado da semana, **PageUp** e **PageDown** ao mês anterior e ao seguinte, e **Enter** e **Espaço** escolhem o dia; passar do fim do mês leva o foco ao mês seguinte; só um dia entra na ordem do Tab.
- **AC-CG-57d** Dado **Mês anterior**, **Próximo mês** ou **Hoje**, então o mês muda (de janeiro a dezembro do ano anterior e de dezembro a janeiro do seguinte), o dia do cartão não muda com o mês, e **Hoje** volta ao mês e ao dia de hoje. Escolher um dia esmaecido de outro mês leva a grade ao mês dele.
- **AC-CG-57e** Dado um dia sem compromisso, então o cartão diz "Nada marcado para este dia" e o botão de adicionar continua ali; num dia que já passou o cartão só mostra o que havia, sem botão de adicionar.
- **AC-CG-57f** Dado o alternador, quando se toca **Lista** ou **Calendário**, então a visão muda, a escolha fica guardada no navegador (chave `nexus-erp:caregiver-agenda-view`) e vale no próximo acesso; sem nada guardado, ou com valor desconhecido, abre o calendário; o dia aberto continua o mesmo ao ir e voltar.
- **AC-CG-58** Dado **Adicionar compromisso neste dia** (o dia já vem preenchido), quando se preenche título, tipo e hora e se toca **Salvar compromisso**, então o compromisso aparece no dia certo, com a faixa "Compromisso salvo." e **Desfazer**, em no máximo 6 toques fora a digitação; se o dia salvo é de outro mês, o calendário vai a ele.
- **AC-CG-59** Dado um título vazio, ou dia passado, ou hora de hoje que já passou, então aparecem as mensagens de erro de cima junto do campo e no resumo, e nada digitado é apagado.
- **AC-CG-60** Dado um compromisso, quando se toca **Remarcar**, muda dia e hora e se salva, então o compromisso muda de lugar (o calendário vai ao dia novo), a faixa mostra o novo horário com **Desfazer**, e **Desfazer** restaura o horário anterior e volta ao dia de antes.
- **AC-CG-61** Dado **Tirar da agenda**, então abre a folha com o efeito, o foco inicial fica em **Voltar**, e só depois de **Tirar da agenda** o compromisso sai do dia e dos lembretes (**Desfazer** devolve e leva o calendário ao dia dele).
- **AC-CG-62** Dado o campo "Lembrar de mim", então vem **ligado** por padrão, e desligar grava `reminder: false` sem pedir confirmação.
- **AC-CG-63** Dada uma conversa da própria pessoa com o psicólogo marcada, então ela aparece no dia certo (a marca "Para você" no calendário e o item no cartão do dia) com a etiqueta "Para você" e leva a Conversar com um psicólogo; ela **não** entra em nenhum texto de compartilhamento.

## C6. `/cuidador/rotina/remedios`: Rotina, aba Remédios (P1, `routine`)
**Propósito.** Marcar os remédios de hoje e manter a lista de remédios da pessoa idosa.
**Ação principal.** **Dei** (em cada remédio do dia); **Adicionar remédio** para a lista.
**De cara.** `h1` "Rotina" e abas (Remédios atual); h2 **Hoje** com **todas** as linhas do dia (hora, nome e dose, **Dei**); o aviso fixo de que o app não orienta sobre remédios.
**Atrás de um toque.** h2 **Todos os remédios** (lista com horários e estado; tocar abre a folha de edição); botão **Adicionar remédio**; "Em pausa" (remédios que não estão em uso, recolhido).
**Textos.**
- Hoje: linha "Losartana 50 mg", "08:00", botão **Dei**. Dado: "Dado às 08:12", botão de texto **Desfazer**. Folha ao tocar numa linha dada: "Dei em outro horário", campo "Hora" (já com a hora do registro), botões **Salvar horário** e **Voltar** `[S-06]`.
- Aviso fixo (nota `soft`): "O app só ajuda você a lembrar. Dúvida sobre dose ou troca de remédio: fale com o médico ou a farmácia."
- Folha **Novo remédio**:
  - "Nome do remédio"
  - "Dose" (hint "Como está na receita. Exemplo: 50 mg, 1 comprimido")
  - "Em que horários?" (cartões de escolha múltipla: Manhã 08:00, Tarde 14:00, Noite 20:00, e "Outro horário" com campo de hora)
  - chave "Este remédio está em uso" (ligada)
  - **Salvar remédio**.
- Chave desligada: "Em pausa. Ele não aparece em Hoje nem gera lembrete. O histórico fica guardado."
- Vazio: título "Você ainda não cadastrou remédios", texto "Cadastre os remédios e o app mostra, a cada dia, os horários de cada um.", botão **Cadastrar um remédio**. Dia sem doses: "Hoje não há remédios para dar."
- Erros:
  - "Informe o nome do remédio."
  - "Escolha pelo menos um horário."
  - "Informe uma hora no formato 08:00."
**Estados.**
- Remédio no horário ou até 30 minutos antes: botão **Dei** primário; fora disso, secundário.
- Passou do horário: texto neutro "Ainda não anotado" (âmbar suave só na primeira linha; docs/15).
- Carregando e erro como em Agenda.
- O app **nunca apaga** um remédio: só pausa (`active: false`) e mantém os `doseChecks` do passado.
**Por pessoa.** Igual para todos; muda o conteúdo. João (pouca familiaridade): a linha mostra a hora em 22 px e o botão **Dei** ocupa 96 px de largura (letra Grande é a sugestão do cadastro, não automática).
**RN.** RN-USR-07, RN-ATD-11, RN-CAN-06, RN-USR-09 (não pede motivo do remédio nem diagnóstico), RN-LGPD-08.
**Critérios de aceite.**
- **AC-CG-64** Dada a rota `/cuidador/rotina/remedios`, então aparecem a aba Remédios atual, a lista **Hoje** com todas as doses do dia em ordem de horário, a lista **Todos os remédios** e o aviso fixo "O app só ajuda você a lembrar. Dúvida sobre dose ou troca de remédio: fale com o médico ou a farmácia."
- **AC-CG-65** Dada uma dose, quando se toca **Dei**, então grava um `doseCheck` com `medicationId`, `date`, `time` (o horário previsto) e `givenAt` (agora, no relógio simulado), a linha mostra "Dado às HH:mm" e a marca continua após recarregar a página.
- **AC-CG-66** Dada uma dose dada, quando se toca "Desfazer", então o `doseCheck` é removido sem pedir confirmação; quando se toca na linha e se salva "Dei em outro horário", então `givenAt` passa para a hora escolhida.
- **AC-CG-67** Dado **Adicionar remédio** com nome, dose e pelo menos um horário, então o remédio entra em "Todos os remédios" e as doses de hoje que ainda não passaram aparecem em Hoje; sem nome ou sem horário, aparecem os erros de cima.
- **AC-CG-68** Dada a chave "Este remédio está em uso" desligada, então o remédio sai de Hoje e vai a "Em pausa", os `doseChecks` antigos continuam, e **não existe** ação de apagar remédio.
- **AC-CG-69** Dado um remédio sem cadastro nenhum, então o vazio mostra "Você ainda não cadastrou remédios" e o botão **Cadastrar um remédio**; dado nenhum remédio no dia, mostra "Hoje não há remédios para dar."
- **AC-CG-70** Dado qualquer campo ou texto desta tela, então **não há** campo de diagnóstico, de motivo do remédio nem de orientação de dose, e a tela não sugere trocar, parar ou aumentar remédio.
- **AC-CG-71** Dada uma dose cujo horário passou, então a linha mostra "Ainda não anotado" (neutro; âmbar suave só na primeira linha em atraso, sem vermelho) e **Dei** continua disponível; a etiqueta do compromisso de hoje que já passou é "Já passou".

## C7. `/cuidador/cuidar-de-mim`: Cuidar de mim, a porta (P2, `care`, `[P-02]`)
**Propósito.** Levar a pessoa a um dos quatro cuidados com ela mesma, sem dado e sem pressão.
**Ação principal.** Tocar no cartão que combina com o momento.
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| Cuidar de mim                        |
| ____ Um tempo para você, no seu      |
|      ritmo.                          |
| +----------------------------------+ |
| | (o) Conversar com um psicólogo > | |
| |     Escolha o formato e o        | |
| |     horário.                     | |
| +----------------------------------+ |
| | (o) Como estou               >   | |
| | (o) Grupos e capacitações    >   | |
| | (o) Conteúdos                >   | |
| +----------------------------------+ |
| Em emergência, ligue 192 (SAMU)...   |
+--------------------------------------+
```
**De cara.** `h1` "Cuidar de mim"; apoio "Um tempo para você, no seu ritmo."; **4 cartões** `--link` em ordem fixa (1 coluna no celular; **2 x 2** em 768 px ou mais), cada um com ícone, título e uma frase:
1. **Conversar com um psicólogo** (`heart-handshake`): "Escolha o formato e o horário."
2. **Como estou** (`heart-pulse`): "Veja como o seu cansaço tem andado e conte como você está."
3. **Grupos e capacitações** (`users`): "Encontros com outras pessoas que cuidam e aulas práticas."
4. **Conteúdos** (`book-open`): "Leituras curtas sobre cuidar e sobre cuidar de você."
**Atrás de um toque.**
- Tudo: cada cartão leva à sua tela.
- Em dois cartões a **frase muda** quando há algo da pessoa para mostrar (fatos dela, nunca pontuação): Conversar, "Você tem uma conversa marcada: qui, 06/11, às 14:00."; Grupos, "Você está em 1 grupo." ou "Você está na lista de espera de 1 grupo."
**Textos.** Como acima. Aviso de emergência compacto no fim (A.2.19) e o aviso de protótipo.
**Estados.**
- Os 4 cartões aparecem **para todos os planos**, **sem cadeado** (o bloqueio por plano fica **dentro** de Grupos e Conteúdos, nunca na porta).
- Consentimento de saúde retirado: a frase de **Como estou** vira "Acompanhamento pausado." Sem dado extra: só a frase padrão.
**Por pessoa.** Lourdes: "Você está na lista de espera de 1 grupo." Maria: Grupos com a frase padrão (sem cadeado). Sônia: "Acompanhamento pausado." em Como estou.
**RN.** RN-ATD-03, 04, RN-PLN-04, 19, RN-ETICA-15.
**Critérios de aceite.**
- **AC-CG-72** Dada a rota, então há exatamente 4 cartões na ordem Conversar com um psicólogo, Como estou, Grupos e capacitações, Conteúdos, cada um leva à rota certa (`atendimento`, `como-estou`, `grupos`, `conteudos`), em 1 coluna abaixo de 768 px e em 2 x 2 de 768 px em diante.
- **AC-CG-73** Dada qualquer pessoa e qualquer plano, então os 4 cartões estão presentes e **nenhum** tem cadeado, preço, selo de plano ou número.
- **AC-CG-74** Dada uma conversa marcada, então o cartão 1 mostra "Você tem uma conversa marcada: {dia}, às {hora}."; dado consentimento de saúde retirado, o cartão 2 mostra "Acompanhamento pausado."
- **AC-CG-75** Dado o cartão 3 de uma pessoa em lista de espera, então mostra "Você está na lista de espera de 1 grupo.", e nenhum cartão mostra pontuação, faixa ou alerta.

## C8. `/cuidador/cuidar-de-mim/atendimento`: Conversar com um psicólogo (P2, `care`)
**Propósito.** Marcar, ver, remarcar e cancelar conversas com os psicólogos da Nexus.
**Ação principal.** **Marcar uma conversa**.
**De cara.** `h1` "Conversar com um psicólogo"; apoio "As conversas são com psicólogos da Nexus, com registro no conselho de Psicologia."; se houver, o cartão **Sua próxima conversa** (dia, hora, com quem, formato, situação); botão primário **Marcar uma conversa**; aviso de emergência compacto.
**Atrás de um toque.**
- Tocar na conversa abre a folha de detalhe (Remarcar, Cancelar conversa).
- "Conversas anteriores" (recolhido, com a classificação de cada uma).
- O fluxo de marcar (B4) é de 2 passos mais a folha de resumo.
**Textos.**
- Passo 1, h2 "Como você prefere?" (3 botões grandes): **On-line** "Pelo celular ou computador, de onde você estiver."
  - **No espaço de coworking** "Em uma sala com acesso sem degraus, em Uberlândia."
  - **Em casa** "O psicólogo vai até você, se for seguro e adequado."
- Passo 2, h2 "Qual horário?": dias em h3 ("qui, 06/11") com botões "14:00 com a Dra. Beatriz". Coworking mostra a sala e o endereço; em casa pede "Endereço da conversa".
- Folha de resumo:
  - "Quando: qui, 06/11, às 14:00 (1 hora)."
  - "Com quem: Dra. Beatriz Nogueira, psicóloga (CRP-04/00002, fictício)."
  - "Como: On-line."
  - "Conversa de 1 hora: R$ 120,00."
  - "Desconto do plano Cuida (15%): menos R$ 18,00."
  - "Total: R$ 102,00."
  - "O pagamento é combinado direto no atendimento. No protótipo não há cobrança." `[S-05]`
  - pergunta **O que você procura?**: "Psicoterapia: acompanhamento regular, com objetivo clínico."
  - "Orientação psicológica: orientação pontual sobre o cuidado e o que você sente."
  - "Não sei: o psicólogo ajuda a decidir na conversa." `[S-07]`
  - botão **Marcar conversa**.
- Aviso por formato: on-line "O psicólogo confirma se o formato on-line serve para você. Se não servir, combina outro formato."; em casa "O psicólogo confirma se o local é adequado e seguro antes de confirmar a conversa."
- Situação:
  - "Aguardando confirmação do psicólogo"
  - "Confirmada"
  - "Realizada"
  - "Cancelada por você"
  - "Cancelada pelo psicólogo. Marque outro horário."
  - "Você não compareceu" `[S-15]`.
- Cancelar (folha): com 24 h ou mais, "Cancelar libera o horário. Não há custo."; com menos de 24 h, "Faltam menos de 24 horas. Se cancelar agora, o horário fica registrado como falta." Botões **Remarcar em vez de cancelar**, **Cancelar a conversa** (perigo suave), **Voltar** (foco inicial).
- Vazios: sem conversa, "Você ainda não marcou nenhuma conversa" com **Marcar uma conversa**; sem horário, "Sem horários nesse formato nos próximos 14 dias. Escolha outro formato ou fale com a gente." Erro de vaga tomada: "Esse horário acabou de ser reservado. Escolha outro."
**Estados.**
- O preço mostra o **desconto do plano** (Essencial 10%, Cuida 15%, Sustenta 20%); no **Livre** mostra só o total, **sem linha de desconto e sem convite de plano**.
- Horários com **prioridade de agenda** aparecem como qualquer outro, **sem etiqueta** e sem explicar o motivo (RN-ATD-12).
- Só aparecem psicólogos com registro ativo e salas com os 4 itens de acessibilidade.
- Cada conversa mostra o caráter ("Psicoterapia" ou "Orientação psicológica").
**Por pessoa.** Ana (Cuida): 15%. Maria (Essencial): 10%. João (Livre): total R$ 120,00 sem desconto. Lourdes e Elza (Sustenta): 20%. Sônia: pode marcar normalmente (a agenda não depende da autorização de saúde).
**RN.** RN-ATD-02 a 05, 07, 09 a 12, 15, 16, 19, 20, RN-PLN-12, 19, RN-ETICA-06.
**Critérios de aceite.**
- **AC-CG-76** Dada a rota, então aparecem `h1`, apoio, botão primário **Marcar uma conversa** e o aviso de emergência; havendo conversa futura, o cartão "Sua próxima conversa" vem antes do botão.
- **AC-CG-77** Dado **Marcar uma conversa**, então o passo 1 mostra 3 formatos e o passo 2 só lista horários **abertos** de psicólogos com registro ativo; em coworking, só salas com os 4 itens de acessibilidade; um toque no formato leva ao passo 2.
- **AC-CG-78** Dado um horário escolhido, então a folha de resumo mostra quando, com quem, como, valor, desconto (quando há) e total **antes** de gravar; **O que você procura?** vem sem nada marcado e não deixa gravar sem escolher uma das 3 opções.
- **AC-CG-79** Dada a pessoa no plano Livre, então o resumo mostra só "Total: R$ 120,00", **sem** linha de desconto, sem comparação com outro plano e sem convite; dado Cuida, mostra o desconto de 15% e o total R$ 102,00.
- **AC-CG-80** Dado **Marcar conversa**, então grava a sessão com o formato, o horário, o caráter escolhido e o preço do plano, o horário sai da lista, e a tela mostra **uma faixa só**: "Pedido enviado. O psicólogo confirma até 24 horas antes da conversa." (RN-ATD-15), com "Ver na agenda"; o cartão "Sua próxima conversa" traz o dia e a situação "A confirmar". Quem escolheu "Não sei" vê "A definir na conversa" no lugar do caráter (CXC-007).
- **AC-CG-81** Dado que o horário foi tomado por outra pessoa no instante de gravar, então aparece "Esse horário acabou de ser reservado. Escolha outro." e o formato e o resumo continuam.
- **AC-CG-82** Dada uma conversa a 24 horas ou mais, quando se toca **Cancelar conversa**, então a folha diz "Cancelar libera o horário. Não há custo."; a menos de 24 horas, diz "Faltam menos de 24 horas. Se cancelar agora, a conversa conta como perdida. Não há cobrança." (CXC-006); com 24 horas ou mais, **Remarcar em vez de cancelar** e **Voltar** estão na folha; com menos, **Remarcar em vez de cancelar** sai (o efeito é o mesmo) e ficam **Cancelar a conversa** e **Voltar**.
- **AC-CG-83** Dado cancelar ou remarcar, então o horário antigo volta a ficar aberto, e a situação passa a "Cancelada por você" (cancelar) ou a conversa muda de horário (remarcar).
- **AC-CG-84** Dado formato "Em casa", então o resumo pede o endereço e mostra "O psicólogo confirma se o local é adequado e seguro antes de confirmar a conversa."; dado "On-line", mostra o aviso de pertinência do formato.
- **AC-CG-85** Dada qualquer conversa, então mostra o caráter "Psicoterapia" ou "Orientação psicológica", e os horários de prioridade não têm etiqueta nem texto que explique por que existem.
- **AC-CG-86** Dada a tela inteira, então não aparece pontuação, faixa, alerta nem a palavra "paciente".

## C9. `/cuidador/cuidar-de-mim/como-estou`: Como estou (P2, `my-wellbeing`)
**Propósito.** Mostrar, com calma e sem número em destaque, como o cansaço da pessoa tem andado nas conversas de acompanhamento, deixar que ela conte como está e peça revisão de uma decisão.
**Ação principal.** **Contar como estou hoje** (o humor, 1 toque). Quando há contato da equipe pendente, o botão de texto "Prefere falar agora?" da nota vem junto, sem competir.
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| Como estou                           |
| ____ Aqui você vê como o seu cansaço |
|      tem andado...                   |
| (mão-coração) nota de cuidado (se há)|
| +----------------------------------+ |
| | Como você está hoje?             | |
| | [:(][:/][:|][:)][:D]  (5 opções) | |
| | Ver os últimos 7 dias            | |
| +----------------------------------+ |
| Suas conversas de acompanhamento     |
|  o  04/11  Sobrecarga severa         |
|  |         63 pontos (legenda 14 px) |
|  o  04/09  Sobrecarga moderada a     |
|            severa   48 pontos        |
| A escala ajuda a equipe a escutar    |
| você. Não é um diagnóstico.          |
| Entender as faixas                   |
| Pedir revisão de uma decisão         |
| Só você e a equipe veem isto.        |
+--------------------------------------+
```
**De cara** (nesta ordem):
1. `h1` "Como estou" e apoio: "Aqui você vê como o seu cansaço tem andado. Quem faz as perguntas é a equipe de psicologia. Você não precisa preencher nada."
2. **Nota de cuidado**, se houver contato pendente ou que ainda não aconteceu (mesmos textos de Hoje, tela 4).
3. **Como você está hoje?** (humor, A.2.11) com "Ver os últimos 7 dias" (botão de texto; abre uma folha em lista: data e rótulo).
4. **Suas conversas de acompanhamento** (linha do tempo A.2.21, até 4 itens): "Sua última conversa foi em 04/11." e a próxima: "A próxima conversa de acompanhamento deve acontecer até 04/02." (só se a data é **futura**; senão, "A equipe vai combinar a próxima conversa com você.").
**Atrás de um toque.**
- "Entender as faixas" (folha).
- "Ver todas" na linha do tempo.
- **Pedir revisão de uma decisão** (folha).
- "Combinar um horário" (quando há contato que ainda não aconteceu) `[S-16]`.
**Textos.**
- Sobre a linha do tempo:
  - "Cada ponto é uma conversa de acompanhamento com a equipe. A escala ajuda a equipe a escutar você. Não é um diagnóstico." Cada item: "04/11"
  - "Sobrecarga severa"
  - legenda "63 pontos". Última: etiqueta "Última conversa".
- Folha **Entender as faixas**:
  - "Sobrecarga ausente ou pequena (0 a 20): o cuidado pesa pouco."
  - "Sobrecarga moderada (21 a 40): o cuidado pesa em parte do tempo."
  - "Sobrecarga moderada a severa (41 a 60): o cuidado pesa bastante."
  - "Sobrecarga severa (61 a 88): o cuidado está pesando muito."
  - "Em qualquer faixa, a equipe está aqui para conversar com você."
- Revisão: botão de texto "Pedir revisão de uma decisão"; folha "Pedir revisão": "Se você não concorda com alguma decisão tomada com base nos seus resultados, conte aqui. O psicólogo responde por escrito." Campo "O que você quer que a equipe reveja?" **Enviar pedido**. Confirmação: "Pedido enviado. O psicólogo responde até 10/11." Cartão com pedido aberto: "Seu pedido de revisão está com a Dra. Beatriz. Resposta até 10/11." Resposta dada: "Resposta da Dra. Beatriz, em 06/11:" e o texto.
- "Combinar um horário" (para quem a equipe ainda não alcançou): folha com 3 chips (Manhã, Tarde, Noite) e **Enviar para a equipe**; vira mensagem no aplicativo "Prefiro que falem comigo de manhã." (Falar com a Nexus).
- Privacidade: "Só você e a equipe de psicologia que acompanha você veem estas informações."
**Estados.**
- **Sem conversa ainda**: vazio "Ainda não houve uma conversa de acompanhamento" e "A equipe de psicologia conversa com você e aplica a escala. Você não precisa preencher nada."
- **Consentimento de saúde retirado** (Sônia): somem o humor e a linha do tempo; aparece nota `info`: título "O acompanhamento está pausado", texto "Você retirou a autorização de dados de saúde em 20/10. A escala e o acompanhamento só voltam se você autorizar de novo. O que já foi registrado fica guardado, sem uso. Você pode pedir uma cópia dos seus dados em Privacidade." e o botão **Autorizar de novo** `[S-28]`.
- Carregando e erro como em Hoje. **Nenhum** convite de grupo, plano, desconto ou upgrade aparece aqui, **sejam quais forem** a faixa e o alerta.
**Por pessoa.**
- **Ana**: nota "vai falar com você hoje"; linha do tempo com 48 ("Sobrecarga moderada a severa") e 63 ("Sobrecarga severa").
- **Maria**: nota "ainda não conseguiu falar com você", "Combinar um horário", cartão do pedido de revisão aberto; 55 e 79.
- **João**: sem nota; 66 ("Sobrecarga severa") e 52 ("Sobrecarga moderada a severa").
- **Terezinha**: 40, 28 e 18.
- **Marlene**: 0 ("Sobrecarga ausente ou pequena").
- **Sônia**: pausado.
- **Marcos**: 1 ponto (27).
**RN.** RN-ZRT-04, 05, 08, 18, 19, 20, 22, 23, RN-LGPD-14, 16, RN-PLN-19, RN-USR-05, RN-ETICA-15.
**Critérios de aceite.**
- **AC-CG-87** Dada a rota, então os blocos aparecem na ordem `h1` com apoio, nota de cuidado (se houver), humor, linha do tempo, e o botão de texto "Pedir revisão de uma decisão"; a frase "Não é um diagnóstico." está visível junto da linha do tempo.
- **AC-CG-88** Dada a linha do tempo, então cada ponto mostra a **data**, a **faixa por extenso** (nome oficial) e a pontuação **só como legenda de 14 px**; os pontos usam a rampa de azul (`--cg-band-1` a `4`); **não há** vermelho, âmbar, octógono, triângulo, termômetro, gráfico de linha nem número com mais de 18 px na tela.
- **AC-CG-89** Dada a tela inteira, então **não aparecem** as palavras "alerta", "eficácia", "melhorou", "piorou", nem percentual de evolução; o texto é só factual (datas e faixas).
- **AC-CG-90** Dada Ana, então a nota diz "A equipe de psicologia vai falar com você hoje." (em horário comercial) e a linha do tempo mostra as duas conversas (48 e 63) com a **frase da faixa primeiro** ("O cuidado está pesando muito") e o nome técnico e os pontos em legenda pequena (CXC-004), **sem** destaque de cor de risco.
- **AC-CG-91** Dada Maria, então a nota diz "Queremos falar com você. Se quiser, fale com a gente agora.", aparece "Combinar um horário" (que cria uma mensagem de aplicativo para a equipe) e o cartão "Seu pedido de revisão está com a Dra. Beatriz. Resposta até {data}."
- **AC-CG-92** Dado **Pedir revisão de uma decisão**, quando se escreve e se toca **Enviar pedido**, então grava um pedido de revisão com o prazo e a tela mostra "Pedido enviado. O psicólogo responde até {data}."; texto vazio mostra "Conte em uma frase o que você quer que a equipe reveja."
- **AC-CG-93** Dado qualquer momento, então a pessoa **nunca preenche a escala**: não há campo, pergunta nem botão para responder os 22 itens.
- **AC-CG-94** Dada Sônia (consentimento de saúde retirado), então não aparecem humor nem linha do tempo, aparece "O acompanhamento está pausado" com **Autorizar de novo**, e Hoje não mostra nenhum bloco de saúde.
- **AC-CG-95** Dada uma pessoa sem nenhuma conversa de acompanhamento, então aparece o vazio "Ainda não houve uma conversa de acompanhamento." e nada além.
- **AC-CG-96** Dado "Entender as faixas", então a folha lista as 4 faixas com os intervalos e as frases acima, e termina com "Em qualquer faixa, a equipe está aqui para conversar com você."
- **AC-CG-97** Dada a tela inteira, então **não há** convite de grupo, plano, desconto ou upgrade, para nenhuma faixa nem alerta (RN-PLN-19).
- **AC-CG-98** Dado o humor, então vale o mesmo comportamento de Hoje (AC-CG-50) e o humor da semana aparece em lista na folha "Ver os últimos 7 dias".

## C10. `/cuidador/cuidar-de-mim/grupos`: Grupos e capacitações (P3, `groups`)
**Propósito.** Mostrar a programação do mês e deixar a pessoa entrar em um grupo ou capacitação, com o plano, o sigilo e a lista de espera claros.
**Ação principal.** **Quero participar** (na página da atividade).
**De cara.** `h1` "Grupos e capacitações"; apoio "A programação do mês."; se houver, o cartão **Minhas inscrições** (atividade, próximo encontro, situação); a lista da programação em cartões: título, tipo ("Grupo de apoio", "Capacitação", "Terapia de grupo", "Roda de conversa aberta"), **o caráter** em etiqueta ("Orientação e psicoeducação" ou "Psicoterapia"), próximo encontro (dia e hora), formato (On-line, No espaço de coworking) e vagas ("4 vagas" ou "Lotado").
**Atrás de um toque.**
- Tocar na atividade abre a folha de tela cheia com o detalhe: o que é, o caráter explicado, temas, todos os encontros, local e acessibilidade da sala, **quem conduz** (com o registro profissional quando é psicólogo), vagas e o botão da ação.
- `?atividade=` na URL permite recarregar `[S-21]`.
**Textos.**
- Caráter: "Orientação e psicoeducação: encontros para aprender e trocar. Não é psicoterapia." · "Psicoterapia: terapia de grupo conduzida por psicólogo da Nexus, com objetivo clínico." Quem conduz: "Conduzido por Dra. Letícia Amaral, psicóloga (CRP-04/00003, fictício)."
- Botão por situação: com vaga, **Quero participar**; lotado, **Entrar na lista de espera**; inscrita, nota `ok` "Você está no grupo." com **Sair do grupo** (botão de texto); em lista de espera, "Você está na lista de espera, posição 2. Avisamos quando abrir uma vaga." `[S-20]` com **Sair da lista**; em andamento, "Em andamento. As inscrições estão encerradas."
- Folha do sigilo: título "Contrato de sigilo do grupo"; o texto do grupo (`confidentialityText`), por exemplo "O que cada pessoa conta aqui fica entre os participantes. Ninguém repete fora do grupo o que ouviu."; caixa "Li e aceito o contrato de sigilo do grupo"; depois de marcar, o carimbo "Aceito em 04/11/2026, às 09:42"; botão **Entrar no grupo** (ou **Entrar na lista de espera**).
- Resultado: "Você está no grupo Sobrecarga e autocuidado. Primeiro encontro: sáb, 07/11, às 14:00." ou "Você entrou na lista de espera, posição 3."
- Folha de saída: "Você deixa de participar. A sua vaga volta para outra pessoa." Botões **Sair do grupo** (perigo suave) e **Voltar**.
- **Bloqueio por plano** (A.2.15), no lugar da ação das atividades que exigem o Cuida: título "Disponível no plano Cuida", texto "Grupos de apoio e capacitações fazem parte do plano Cuida. Seu plano agora é o Essencial. As rodas de conversa abertas são para todos.", botão de texto "Ver os planos". As **rodas abertas** aparecem normais, com **Quero participar**.
- Terapia de grupo sem indicação do psicólogo: nota `soft` "Esta atividade começa com a indicação do seu psicólogo. Fale com a gente." (sem razão clínica).
- Vazio: "Ainda não há grupos neste mês" e "A programação é montada todo mês. Volte em breve." Erro: "Não foi possível abrir a programação. Tente de novo."
- Erro de sigilo: "Marque que você leu o contrato de sigilo para entrar."
**Estados.**
- Só aparecem atividades abertas, lotadas ou em andamento (rascunho, cancelada e finalizada não).
- Mudar para um plano sem grupos tira das turmas futuras (avisado na troca, tela 18).
**Por pessoa.**
- **Ana** (Cuida): tudo liberado.
- **Maria** (Essencial) e **João** (Livre): bloqueio por plano nos grupos e nas capacitações, rodas abertas liberadas, **o mesmo bloqueio que qualquer pessoa do plano** teria.
- **Lourdes** (Sustenta): "Sobrecarga e autocuidado" lotado, ela na lista de espera (posição 1; Elza está na 2), em "Minhas inscrições". **No seed essa atividade tem 8 vagas**: o padrão de 12 vagas é da regra (RN-GRP-13) e é editável por atividade.
- **Sônia**: igual ao plano dela (Essencial).
**RN.** RN-GRP-01 a 03, 09, 13, 14, 16, 17, RN-PLN-10, 19, RN-ATD-19, RN-ETICA-04, 07, RN-USR-11.
**Critérios de aceite.**
- **AC-CG-99** Dada a rota, então aparece a lista da programação com, em cada atividade, o tipo ("Grupo de apoio", "Capacitação", "Grupo com psicólogo" ou "Roda de conversa aberta"), o caráter ("Para aprender e trocar" ou "Psicoterapia em grupo", RN-GRP-16; sem jargão, CXC-019), o próximo encontro, o formato e as vagas; atividades em rascunho, canceladas e finalizadas não aparecem.
- **AC-CG-100** Dada uma pessoa do plano Cuida ou Sustenta, quando abre uma atividade com vaga e toca **Quero participar**, então a folha do sigilo mostra o texto do grupo e a caixa de aceite; sem marcar, mostra "Marque que você leu o contrato de sigilo para entrar." e não inscreve.
- **AC-CG-101** Dado o aceite do sigilo, então a inscrição grava a data e a hora do aceite, mostra o carimbo na folha, e a atividade aparece em "Minhas inscrições" com o primeiro encontro.
- **AC-CG-102** Dada uma atividade lotada, então o botão é **Entrar na lista de espera**, a folha diz a posição ("Você entra na posição 3."), e a pessoa aparece como "Você está na lista de espera, posição N." depois de entrar.
- **AC-CG-103** Dada uma pessoa do plano Essencial ou Livre, então grupos de apoio e capacitações mostram "Disponível no plano Cuida" **no lugar do botão**, as rodas abertas mostram **Quero participar**, e o bloqueio **não é vermelho** nem tem preço em destaque.
- **AC-CG-104** Dado o bloqueio por plano, então ele aparece **idêntico** para toda pessoa do mesmo plano, **sem relação** com pontuação, faixa, alerta ou ARBE (a mesma tela para Maria e para uma pessoa sem nenhum alerta).
- **AC-CG-105** Dada uma atividade de terapia de grupo, então a página diz "Psicoterapia em grupo" e que é conduzida por psicólogo da Nexus com o registro profissional; sem indicação do psicólogo, mostra "Esta atividade começa com a indicação do seu psicólogo. Fale com a gente." e **não** mostra o motivo.
- **AC-CG-106** Dado **Sair do grupo**, então a folha diz "Você deixa de participar. A sua vaga volta para outra pessoa."; ao confirmar, a inscrição é cancelada e, se havia lista de espera, o primeiro da fila é promovido.
- **AC-CG-107** Dada uma sala presencial, então o detalhe mostra o endereço e que a sala tem acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços.
- **AC-CG-108** Dada a tela inteira, então **não aparece** nenhum convite derivado de pontuação, faixa ou alerta, e nenhum texto promete resultado ("vai melhorar", "vai aliviar").

## C11. `/cuidador/cuidar-de-mim/conteudos`: Conteúdos (P3, `content`)
**Propósito.** Oferecer leituras curtas de orientação sobre cuidar da pessoa idosa e de si.
**Ação principal.** Tocar numa leitura.
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| Conteúdos                            |
| ____ Leituras curtas. Escolha uma.   |
| Para todos                           |
| +----------------------------------+ |
| | Título da leitura              > | |
| | Leitura de 3 minutos             | |
| +----------------------------------+ |
| | Outra leitura                  > | |
| +----------------------------------+ |
| Do seu plano  (Essencial e acima)    |
| ou, no Livre, UM cartão:             |
| +----------------------------------+ |
| | (cadeado) Disponível no plano    | |
| | Essencial                        | |
| | Ver os planos                    | |
| +----------------------------------+ |
+--------------------------------------+
```
**De cara.** `h1` "Conteúdos"; apoio "Leituras curtas. Escolha uma."; lista **Para todos** (item de lista: título, "Leitura de 3 minutos"); para Essencial, Cuida e Sustenta, a lista **Do seu plano** (conteúdos exclusivos) logo abaixo; para o Livre, **um único cartão** de bloqueio no lugar dessa lista.
**Atrás de um toque.** Tocar no título abre a **leitura em folha de tela cheia** (`?conteudo=` na URL) `[S-21]`: título em serifa, texto em 18 px, no máximo 66 caracteres por linha, "Leitura de 3 minutos", rodapé fixo e **Voltar**.
**Textos.**
- Bloqueio (Livre): título "Disponível no plano Essencial", texto "Os conteúdos exclusivos fazem parte do plano Essencial. Seu plano agora é o Livre. Todas as leituras acima são para você.", botão de texto "Ver os planos". **Não lista** os títulos exclusivos como isca.
- Rodapé da leitura: "Este conteúdo orienta e não substitui o médico, o psicólogo ou outro profissional. Dúvida sobre remédio: fale com o médico ou a farmácia."
- Vazio: "Ainda não há leituras" e "Quando a equipe publicar, elas aparecem aqui."
**Estados.**
- Só conteúdos **publicados** (aprovados pela equipe).
- Leitura não encontrada: "Não encontramos esta leitura." com **Voltar**.
- Sem personalização: a ordem é da mais nova para a mais antiga, para todos.
**Por pessoa.** João e Marlene (Livre): cartão de bloqueio; Ana, Maria, Elza, Lourdes: as duas listas. Nenhuma lista é escolhida por pontuação.
**RN.** RN-USR-07, RN-PLN-04, 05, 19, RN-ETICA-05, RN-ZRT-09 (o convite é informativo e nunca comercial).
**Critérios de aceite.**
- **AC-CG-109** Dada a rota, então a lista **Para todos** mostra os conteúdos publicados não exclusivos, do mais novo ao mais antigo, cada um com o tempo de leitura; rascunhos e em revisão não aparecem.
- **AC-CG-110** Dada uma pessoa do plano Livre, então os conteúdos exclusivos aparecem como **um** cartão "Disponível no plano Essencial" **sem listar títulos**; dada uma do Essencial ou acima, a lista **Do seu plano** aparece desbloqueada.
- **AC-CG-111** Dada uma leitura aberta, então o texto tem 18 px ou mais (22 px em Bem grande), no máximo 66 caracteres por linha, e o rodapé traz o aviso de que não substitui profissional nem orienta remédio.
- **AC-CG-112** Dada a tela inteira, então a ordem e a seleção **não dependem** de pontuação, faixa, alerta ou ARBE.

## C12. `/cuidador/rede`: Rede, a porta (P3, `network`)
**Propósito.** Levar a pessoa a buscar um profissional ou serviço, ver os pedidos ou usar o cartão.
**Ação principal.** **Buscar profissionais e serviços**.
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| Rede                                 |
| ____ Profissionais e serviços para o |
|      cuidado da pessoa idosa...      |
| +----------------------------------+ |
| | (lupa) Buscar profissionais e  > | |
| |        serviços                  | |
| +----------------------------------+ |
| | (lista) Meus pedidos           > | |
| |   1 pedido aguardando resposta.  | |
| +----------------------------------+ |
| | (cartão) Cartão Nexus          > | |
| |   Seu número e onde usar.        | |
| +----------------------------------+ |
| A Nexus organiza a rede. O serviço   |
| é feito e pago direto com o...       |
+--------------------------------------+
```
**De cara.** `h1` "Rede"; apoio "Profissionais e serviços para o cuidado da pessoa idosa. A Nexus organiza e você escolhe."; **3 cartões** `--link`: **Buscar profissionais e serviços** (`search`), **Meus pedidos** (`clipboard-list`), **Cartão Nexus** (`credit-card`).
**Atrás de um toque.**
- Tudo é um toque a mais.
- As frases mudam com fatos da pessoa: Meus pedidos, "1 pedido aguardando resposta." ou "Você ainda não fez pedidos."; Cartão, para assinante "Seu número e onde usar." e para o Livre "Um benefício dos planos pagos." (sem cadeado).
**Textos.** Como acima. Aviso curto no fim: "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional." (RN-REDE-17).
**Estados.**
- Os 3 cartões aparecem para **todos** os planos.
- Sem pedidos: frase padrão.
**Por pessoa.** Elza (Sustenta): "Seu número e onde usar." João (Livre): "Um benefício dos planos pagos."
**RN.** RN-REDE-17, 25, RN-CRT-02, RN-ENC-10.
**Critérios de aceite.**
- **AC-CG-113** Dada a rota, então há 3 cartões na ordem Buscar profissionais e serviços, Meus pedidos, Cartão Nexus, cada um leva à sua rota (`buscar`, `pedidos`, `cartao`), em 1 coluna abaixo de 768 px.
- **AC-CG-114** Dada qualquer pessoa, então os 3 cartões aparecem, **sem cadeado e sem preço**; para o Livre, o cartão do Cartão Nexus diz "Um benefício dos planos pagos."
- **AC-CG-115** Dada a tela, então aparece o aviso literal "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional."

## C13. `/cuidador/rede/buscar`: Buscar profissionais e serviços (P3, `network`)
**Propósito.** Achar e comparar profissionais e serviços por necessidade, sempre com mais de uma opção quando existir.
**Ação principal.** Escolher uma necessidade e tocar num profissional.
**De cara.** `h1` "Buscar"; campo "Buscar pelo nome" (opcional); h2 "O que você procura?" com as 10 categorias em botões de 56 px (Fisioterapia, Cuidador(a), Home care, Enfermagem, Farmácia, Clínica, Psicologia, Nutrição, Advocacia, Serviço especializado); ao escolher (`?categoria=` na URL), a **lista de resultados** em cartões.
**Cartão de resultado.** Nome (20/600), "Fisioterapia · Uberlândia", etiquetas "Atende em casa" e "Em destaque" (`award`, só na zona de excelência), nota ("Nota 4,8 (12 avaliações)" ou "Ainda sem nota (menos de 5 avaliações)"), caixa "Comparar". O cartão inteiro abre a ficha.
**Atrás de um toque.**
- Filtro "Só quem atende em casa" (botão de alternar, `aria-pressed`).
- **Comparar escolhidos** (barra aparece com 2 ou mais caixas marcadas, até 3): folha lado a lado com nota, atende em casa, condições para quem é da Nexus (Essencial e acima).
**Textos.**
- Contagem: "5 opções em Fisioterapia." Uma só: nota `info` "Única opção disponível no momento." Nenhuma: vazio "Nenhuma opção em Clínica por enquanto" com "Estamos ampliando a rede. A equipe pode ajudar a procurar." e **Falar com a gente**.
- Ordem: **em destaque primeiro, depois ordem alfabética** `[S-08]`. O destaque **nunca tira** os outros da lista (RN-REDE-19). Nenhum texto "recomendado pela Nexus".
- Comparar: "Comparar escolhidos (2)"; folha "Lado a lado" com as linhas Nota, Atende em casa, Condições, e **Ver ficha** em cada coluna.
- Busca sem resultado: título "Nada encontrado para Márcia" e "Confira o nome ou escolha uma necessidade."
**Estados.**
- **Nunca aparecem**: profissional suspenso, descredenciado ou candidato; a faixa de monitoramento, "risco de saída", taxa de recusa, comissão.
- Profissional em monitoramento aparece **como qualquer outro**.
- Carregando em esqueleto; erro "Não foi possível abrir a rede. Tente de novo."
**Por pessoa.**
- Todos veem as mesmas opções.
- **Livre** vê tudo e compara, **sem** a linha "Condições para quem é da Nexus" (substituída por "Condições especiais: a partir do plano Essencial", em texto simples). Dados reais do seed: Fisioterapia 5 opções; Cuidador(a) 3; Farmácia 2; **única opção**: home care, enfermagem, psicologia, advocacia; **nenhuma**: clínica, nutrição, serviço especializado.
**RN.** RN-REDE-10, 17, 18, 19, 25, 30, RN-ARP-04, RN-ATD-13, RN-ENC-10.
**Critérios de aceite.**
- **AC-CG-116** Dada a rota, então aparecem `h1`, o campo "Buscar pelo nome" e as 10 categorias; ao escolher uma, a URL ganha `?categoria=` e a lista mostra a contagem ("5 opções em Fisioterapia.").
- **AC-CG-117** Dada uma categoria com um só profissional ativo (home care, enfermagem, psicologia, advocacia), então ele aparece com "Única opção disponível no momento." e **não é escondido**; dada uma sem nenhum (clínica, nutrição, serviço especializado), aparece o vazio com **Falar com a gente**.
- **AC-CG-118** Dada qualquer lista, então profissionais suspensos, descredenciados e candidatos **não aparecem**, e nenhuma etiqueta mostra faixa de monitoramento, "risco de saída", taxa de recusa ou comissão.
- **AC-CG-119** Dada a ordem da lista, então "Em destaque" vem primeiro e os demais em ordem alfabética, sem que o destaque exclua ninguém, e **sem** texto de "recomendado" ou "indicado pela Nexus".
- **AC-CG-120** Dado um profissional com 5 avaliações ou mais, então o cartão mostra "Nota 4,8 (12 avaliações)"; com menos de 5, mostra "Ainda sem nota (menos de 5 avaliações)".
- **AC-CG-121** Dadas 2 ou 3 caixas "Comparar" marcadas, então aparece a barra "Comparar escolhidos (N)" e a folha lado a lado; com 1 caixa, a barra não aparece; com 3 marcadas, as outras caixas ficam sem uso com o motivo escrito.
- **AC-CG-122** Dado o filtro "Só quem atende em casa" ligado, então a lista mostra só quem atende em casa, `aria-pressed="true"`, e a contagem acompanha; o texto da busca **não** vai para a URL.
- **AC-CG-123** Dada a pessoa do plano Livre, então ela vê a lista e compara, mas a frase "Condições especiais: a partir do plano Essencial." aparece uma vez, em vez das condições. A comparação é uma **tabela curta** (nota, atende em casa, condições) que só mostra o que **muda**; o que é igual vem em "Igual nas duas opções" (CXC-012). Escolher uma necessidade leva a tela até os resultados (CXC-011).

## C14. `/cuidador/rede/profissional/:id`: Profissional (P3, `network`)
**Propósito.** Conhecer um profissional e, se a pessoa quiser, pedir o serviço.
**Ação principal.** **Pedir serviço** (todos os planos; decisão do líder, ver S-09).
**De cara.** `h1` com o nome; "Fisioterapia · Uberlândia"; etiquetas "Em destaque", "Atende em casa"; "Registro: CREFITO-4/00000-F (fictício)"; nota; o aviso "A Nexus organiza a rede. O serviço é feito e pago direto com o profissional."; **Condições para quem é da Nexus** (texto do prestador); botão primário **Pedir serviço** fixo embaixo.
**Atrás de um toque.**
- Folha **Pedir serviço**: "O que você precisa?" (texto curto) · "Onde?" (**Em casa** ou **No local do profissional**, só as que o profissional atende) · resumo "Enviamos ao profissional só o seu nome, o seu contato e o que você precisa." · **Enviar pedido**.
- Comentários de avaliação **não são mostrados** `[S-18]`; a disponibilidade do profissional é dado da equipe e não aparece `[S-30]`.
**Textos.**
- Pedido enviado: "Pedido enviado. A equipe avisa você quando o profissional responder." com o botão de texto **Ver meus pedidos**.
- Pedido em andamento com o mesmo profissional: nota `soft` "Você já tem um pedido em andamento com este profissional." e **Ver pedido** (no lugar de **Pedir serviço**).
- **Livre** `[S-09]`: o botão **Pedir serviço** aparece igual ao dos outros planos (a jornada do plano, etapas 5 a 8, vale para todos); só a linha de condições muda ("Condições especiais: a partir do plano Essencial."). Para **todos os planos**, abaixo do botão: "Prefere falar direto com {nome}? (34) 90000-0000." com **Copiar número**.
- Profissional sem a cláusula de proteção de dados assinada `[S-19]`: no lugar do botão, nota `soft` "No momento não é possível pedir este profissional pelo app. A equipe pode ajudar." e **Falar com a gente**.
- Não existe, suspenso ou sem acesso: vazio "Não encontramos este profissional." com **Voltar para a busca** (sem dizer se existe).
**Estados.**
- Carregando em esqueleto; erro com "Tentar de novo".
- Condições do prestador: só para Essencial e acima; Livre vê "Condições especiais: a partir do plano Essencial."
**Por pessoa.** João e Marlene (Livre): pedido normal, sem condições especiais, com o telefone do profissional visível. Elza (Sustenta): pedido normal; a Nutri Camila Rezende (suspensa) **não** existe para ela.
**RN.** RN-REDE-11, 12, 17, 18, 19, 25, 26, 30, RN-LGPD-08, 13, RN-ATD-13, RN-ENC-10.
**Critérios de aceite.**
- **AC-CG-124** Dado um profissional ativo ou em monitoramento, então a ficha mostra nome, especialidade, registro e conselho, cidade, se atende em casa, nota (ou "Ainda sem nota"), "Em destaque" quando for o caso, as condições (Essencial e acima) e o aviso de que a Nexus organiza e o pagamento é direto; **não mostra** faixa de monitoramento, taxa de recusa, comissão nem disponibilidade.
- **AC-CG-125** Dada qualquer pessoa (todos os planos), quando se toca **Pedir serviço**, escolhe o local e toca **Enviar pedido**, então cria um pedido `requested`, mostra "Pedido enviado. A equipe avisa você quando o profissional responder." e o pedido aparece em Meus pedidos; em no máximo 7 toques a partir de Hoje.
- **AC-CG-126** Dada a pessoa do plano Livre, então a ficha **tem** o botão **Pedir serviço** como as demais, a linha de condições mostra "Condições especiais: a partir do plano Essencial." e o pedido criado não carrega condições especiais; o telefone do profissional aparece com **Copiar número** para todos os planos.
- **AC-CG-127** Dado um profissional sem a cláusula de proteção de dados assinada, então o botão **Pedir serviço** não aparece e a nota diz "No momento não é possível pedir este profissional pelo app. A equipe pode ajudar."
- **AC-CG-128** Dado um profissional suspenso, descredenciado ou inexistente, então a rota mostra "Não encontramos este profissional." sem confirmar nem negar que ele existe.
- **AC-CG-129** Dado um pedido em andamento com o mesmo profissional, então a ficha mostra "Você já tem um pedido em andamento com este profissional." e **Ver pedido**.
- **AC-CG-130** Dada a folha do pedido, então o resumo diz que só vão ao profissional nome, contato e o que a pessoa precisa, e **não** vai nenhum dado de saúde, escore, atendimento ou grupo.

## C15. `/cuidador/rede/pedidos`: Meus pedidos (P3, `network`)
**Propósito.** Acompanhar o que a pessoa pediu à rede e avaliar o serviço depois de concluído.
**Ação principal.** **Avaliar** (no pedido concluído); sem pedido a avaliar, nenhuma ação principal.
**De cara.**
- `h1` "Meus pedidos"; três grupos em ordem: **Precisa da sua avaliação** (concluídos sem avaliação), **Em andamento** (enviado, aceito) e **Anteriores** (recolhido).
- Cada pedido é um cartão: profissional, necessidade, data do pedido, **situação em etiqueta com ícone e texto**.
**Atrás de um toque.** Tocar no pedido abre a folha: o que foi pedido, onde, a linha do tempo curta, e as ações **Cancelar pedido** (enviado ou aceito), **Avaliar** (concluído), **Corrigir minha avaliação** (até 7 dias).
**Textos.**
- Situação:
  - "Enviado, aguardando resposta" (`hourglass`)
  - "Aceito" (`circle-check`)
  - "O profissional não pôde atender" (`info`)
  - "Cancelado pelo profissional" (`info`)
  - "Cancelado por você"
  - "Concluído: avalie"
  - "Avaliado".
- Recusado: "O profissional não pôde atender." e o botão de texto "Ver outras opções de Fisioterapia" (leva à lista da categoria).
- Cancelar (folha): "Cancelar este pedido? O profissional deixa de receber o seu pedido. Você pode pedir de novo quando quiser." Botões **Cancelar pedido** (suave) e **Voltar**.
- Avaliar (folha de A.2.22): "Como foi o serviço?" e "Como foi a pontualidade e o atendimento?", comentário opcional, "Sua avaliação ajuda outras famílias. O profissional não vê o seu nome.", **Enviar avaliação**. Depois: "Avaliação enviada. Você pode corrigir até 11/11." com **Corrigir minha avaliação**.
- Vazio: "Você ainda não fez pedidos" e "Quando você pedir um serviço a um profissional da rede, ele aparece aqui." com **Buscar profissionais**.
**Estados.**
- Uma avaliação por serviço concluído; depois de 7 dias, a avaliação não pode ser corrigida ("Prazo de correção encerrado.").
- **Nenhuma** informação de monitoramento do profissional aparece.
- A resposta do profissional é registrada pela equipe (ele não tem login).
**Por pessoa.** Quem tem serviço concluído sem avaliação (Rita, Lourdes, Marlene e Sônia, no seed) vê o grupo **Precisa da sua avaliação** e o cartão em Hoje. Ana tem um serviço "Avaliado" (fora do prazo de correção). Elza não tem serviço avaliado no seed: tem um pedido "Enviado" e nada a avaliar. **João e Marlene (Livre) têm pedidos na lista**: João tem 3 (1 em andamento e 2 avaliados) e Marlene, 1 serviço concluído a avaliar. Só **Maria** tem a lista vazia ("Você ainda não fez pedidos" com **Buscar profissionais**); use-a para o estado vazio. O caso de profissional suspenso na lista aparece com Lourdes (Nutri Camila Rezende, pedido recusado).
**RN.** RN-REDE-26, RN-ARP-02, 16, 18, RN-USR-19, RN-ENC-10.
**Critérios de aceite.**
- **AC-CG-131** Dada a rota, então os pedidos aparecem em **Precisa da sua avaliação**, **Em andamento** e **Anteriores** (recolhido), cada um com a situação em texto e ícone (nunca só cor).
- **AC-CG-132** Dado um pedido "Enviado" ou "Aceito", quando se toca **Cancelar pedido** e se confirma na folha, então o pedido vai a "Cancelado por você" e a folha tinha dito o efeito antes.
- **AC-CG-133** Dado um serviço concluído sem avaliação, quando se escolhem as **duas notas** de 1 a 5 e se toca **Enviar avaliação**, então grava a avaliação (nota = média das duas) e o pedido vai a "Avaliado"; sem as duas notas, o texto "Falta escolher a nota do serviço" (ou da pontualidade) fica escrito acima do botão.
- **AC-CG-134** Dada uma avaliação enviada há 7 dias ou menos (o último dia para corrigir é o sétimo, inclusive, RN-ARP-16: "em até 7 dias"), então **Corrigir minha avaliação** está disponível e mostra o prazo; com mais de 7 dias, mostra "Prazo de correção encerrado." (Texto corrigido em 06/11/2026: a versão anterior dizia "com 7 dias ou mais", um dia a menos que a regra; decisão do líder, QAC-012.)
- **AC-CG-135** Dado o pedido recusado pelo profissional, então a situação é "O profissional não pôde atender" (sem culpa) e aparece "Ver outras opções de {categoria}".
- **AC-CG-136** Dado um pedido, então **só existe uma** avaliação por serviço concluído e a pessoa **não** vê o nome de outros avaliadores nem comentários de outros.
- **AC-CG-137** Dado nenhum pedido, então aparece o vazio "Você ainda não fez pedidos" com **Buscar profissionais**.
- **AC-CG-138** Dada a tela inteira, então **não aparece** faixa de monitoramento, taxa de recusa nem qualquer dado interno do profissional.

## C16. `/cuidador/rede/cartao`: Cartão Nexus (P3, `card`)
**Propósito.** Mostrar o número do cartão e onde usar os descontos; para quem está no Livre, mostrar com calma que o benefício existe.
**Ação principal.** **Copiar número** (assinante). O Livre não tem ação principal.
**De cara (assinante).** `h1` "Cartão Nexus"; o **cartão** (símbolo, nome da pessoa, número `NX-0000-0000` em 28 px tabular, etiqueta do plano); "Mostre o número no balcão do parceiro."; **Copiar número**.
**Atrás de um toque.** h2 **Onde usar** (parceiros **ativos**: nome, categoria, "10% de desconto"); h2 **O que você já economizou** ("Neste mês: R$ {valor} em {n} compras.": o valor vem dos usos registrados, não é fixo; sem compras no mês, "Neste mês: ainda sem compras com o cartão." e o total de antes) com a lista dos usos (data, parceiro, desconto).
**Textos.**
- Validade: "Vale enquanto o seu plano estiver ativo." `[S-22]` Com cancelamento agendado (Marcos): "Seu cartão vale até 13/11, quando o plano muda para o Livre."
- Sem uso: "Você ainda não usou o cartão." Sem parceiro ativo: "Ainda não há parceiros por aqui."
- **Livre** (ou cartão inativo): h1 "Cartão Nexus" e um cartão `soft`: "O Cartão Nexus dá descontos em farmácias, clínicas e outros parceiros. Ele vem com os planos pagos." e o botão de texto "Ver os planos". **Sem percentuais, sem nomes de parceiros, sem preço em destaque.**
- Erro: "Não foi possível abrir o cartão. Tente de novo."
**Estados.**
- Só parceiros `active` aparecem.
- O percentual é o de cada parceiro, igual para todos os planos pagos.
- O cartão é inativado no instante em que a assinatura deixa de valer.
**Por pessoa.**
- **Elza** (Sustenta): 8 usos listados (de agosto a 31/10), com a economia somada; hoje, 04/11, ela não tem compra em novembro, então vê "Neste mês: ainda sem compras com o cartão." e "Ao todo: ...".
- **Maria** (Essencial): cartão ativo.
- **Ana** (Cuida): ativo.
- **João** (Livre): convite calmo.
- **Marcos** (cancelamento agendado): cartão com "vale até 13/11".
**RN.** RN-CRT-01 a 03, 10 a 12, RN-PLN-08, RN-ETICA-12.
**Critérios de aceite.**
- **AC-CG-139** Dado um assinante pago, então a tela mostra o cartão com o número no formato `NX-0000-0000`, **Copiar número** (que mostra "Número copiado." ou o plano B de seleção) e "Mostre o número no balcão do parceiro."
- **AC-CG-140** Dada a lista **Onde usar**, então só aparecem parceiros ativos, cada um com o seu percentual, e parceiros suspensos ou encerrados não aparecem.
- **AC-CG-141** Dado um assinante com usos, então "O que você já economizou" mostra o total do mês (calculado dos usos registrados) e as **3 últimas compras**, com "Ver todas (N)" para a lista inteira (data, parceiro, desconto, CXC-026); Elza vê 8 usos ao tocar "Ver todas".
- **AC-CG-142** Dada a pessoa do plano Livre (João), então a tela mostra só o convite calmo, **sem** percentual, sem nome de parceiro, sem preço e sem número de cartão.
- **AC-CG-143** Dado um cancelamento de plano agendado (Marcos), então o cartão mostra "Seu cartão vale até 13/11, quando o plano muda para o Livre."; no dia em que a assinatura deixa de valer, o cartão some e vira o convite do Livre.
- **AC-CG-144** Dada a tela inteira, então nenhum dado de pontuação, alerta ou ARBE influencia o que aparece (RN-PLN-19).

## C17. `/cuidador/mais`: Mais (Base, shell, `[P-02]`)
**Propósito.** Reunir o que não é do dia a dia: plano, ajuda, família, privacidade, perfil, tamanho da letra e sair.
**Ação principal.** Tocar no item que a pessoa procura (não há ação primária de destaque).
**Desenho (360 px, esquema).**
```text
+--------------------------------------+
| Mais                                 |
| Ana Paula Ferraz      (Plano Cuida)  |
| +----------------------------------+ |
| | Meu plano                      > | |
| | Falar com a Nexus              > | |
| | Família                        > | |
| | Privacidade e meus dados       > | |
| | Meu perfil                     > | |
| +----------------------------------+ |
| Tamanho da letra                     |
| [Aa Normal][Aa Grande][Aa Bem gr.]   |
| Assim fica o texto no seu app.       |
| [             Sair                ]  |
+--------------------------------------+
```
**De cara.** `h1` "Mais"; um cabeçalho curto com o nome da pessoa e a etiqueta do plano; **5 itens de lista** (ícone, título, uma frase): **Meu plano**, **Falar com a Nexus**, **Família**, **Privacidade e meus dados**, **Meu perfil**; h2 **Tamanho da letra** com o seletor (A.2.20); botão secundário **Sair**.
**Atrás de um toque.**
- Cada item leva à sua tela.
- **Sair** encerra a sessão do cuidador e volta a `/login`, sem folha de confirmação (é reversível: entrar de novo).
**Textos.**
- Itens:
  - "Meu plano", apoio "Cuida
  - R$ 119,90 por mês"
  - "Falar com a Nexus", apoio "Aplicativo, WhatsApp e telefone"
  - "Família", apoio "Compartilhe a rotina com quem ajuda você"
  - "Privacidade e meus dados", apoio "Suas autorizações, cópia e eliminação dos dados"
  - "Meu perfil", apoio "Seus dados e os de quem você cuida".
- Tamanho da letra: títulos e prévia de A.2.20.
- Sair: "Sair". Depois, em `/login`, a faixa "Você saiu. Até a próxima."
**Estados.**
- Plano com mudança agendada: apoio de Meu plano vira "Muda para o Livre em 13/11".
- Pedido de dados em andamento: apoio de Privacidade "Há um pedido em andamento".
- **Nunca** aparece contador, ponto vermelho ou selo de novidade.
**Por pessoa.** Marcos: "Muda para o Livre em 13/11". João (Livre): "Livre · sem custo". Todos: o mesmo conjunto de 5 itens.
**RN.** RN-USR-18, RN-PLN-13, 14, RN-LGPD-20.
**Critérios de aceite.**
- **AC-CG-145** Dada a rota, então aparecem `h1` "Mais", o nome da pessoa com a etiqueta do plano, os 5 itens na ordem Meu plano, Falar com a Nexus, Família, Privacidade e meus dados, Meu perfil, o seletor de tamanho da letra e o botão **Sair**.
- **AC-CG-146** Dado o seletor de tamanho da letra, então aplica o que A.2.20 e AC-CG-13 descrevem, na própria tela e sem botão Salvar.
- **AC-CG-147** Dado **Sair**, então a sessão `nexus-erp:caregiver-session` é apagada, a rota é `/login` e a faixa "Você saiu. Até a próxima." aparece; voltar com o botão do navegador **não** reabre `/cuidador/**`.
- **AC-CG-148** Dada a tela inteira, então não há contador, ponto de notificação nem selo de novidade nos itens.

## C18. `/cuidador/mais/plano`: Meu plano (P3, `plan`)
**Propósito.** Mostrar o plano da pessoa e deixar trocar ou cancelar com o efeito dito antes, sem letra miúda.
**Ação principal.** **Ver outros planos** (no Livre, **Ver os planos**).
**De cara.** `h1` "Meu plano"; o **cartão do plano atual**: etiqueta, preço ("R$ 119,90 por mês"; Livre, "Sem custo, sem prazo"), situação ("Próxima cobrança em 18/11/2026"), e 3 a 4 itens do que inclui; botão secundário **Ver outros planos**; botão de texto **Cancelar plano** (só plano pago).
**Atrás de um toque.** **Ver outros planos** abre o **quadro dos 4 planos** (folha de tela cheia): para cada plano, nome, preço, "Tudo do plano anterior, mais:" e os itens (Figura 1); o plano atual marcado "Seu plano agora"; o aviso fixo "A mensalidade não inclui serviços da rede nem atendimento psicológico." e "Você pode cancelar em qualquer mês, sem multa." Tocar num plano abre a **folha com o efeito** (B9).
**Textos.**
- Itens:
  - **Livre** "Acesso ao aplicativo, organização básica, agenda e lembretes, conteúdos, acesso inicial à rede"
  - **Essencial** "Organização ampliada, descontos do Cartão Nexus, conteúdos exclusivos, condições especiais na rede"
  - **Cuida** "Maior suporte à organização, grupos de apoio, capacitações"
  - **Sustenta** "Acompanhamento organizacional mais próximo, maior nível de suporte, benefícios diferenciados na rede". Preços: R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90, por mês.
- Efeitos (folha):
  - subir "Vale hoje. O Cartão Nexus é emitido agora. A cobrança de R$ 119,90 começa no próximo ciclo, em 18/11/2026."
  - descer "Vale no fim do ciclo, em 18/11/2026. Até lá, o Cuida continua, inclusive os grupos." mais "Você sai dos grupos que começam depois dessa data: Sobrecarga e autocuidado (03/12). Os grupos em andamento continuam até o fim do ciclo."
  - cancelar "O cancelamento fica agendado para 18/11/2026. Até lá tudo continua. Nessa data o cartão deixa de valer e o plano vira Livre."
- Botões:
  - **Mudar para o Cuida**
  - **Agendar mudança para o Essencial**
  - **Agendar cancelamento**
  - **Confirmar mudança de plano**
  - **Voltar**. **Sem campo de cartão de crédito** (pagamento simulado).
- Aceite na primeira contratação paga `[S-23]`: o aviso de emergência com caixa "Li e entendi".
- Mudança agendada: nota `info` "Mudança agendada: Cuida para Essencial em 18/11/2026." com o botão de texto **Manter meu plano**; ao tocar: faixa "Plano mantido."
- Pago pela empresa: nota `soft` "Este plano é pago pela empresa Exemplo Logística. A mudança é feita pelo contrato da empresa." e **sem** botões de troca.
- Erros: "Não foi possível mudar o plano. Nada foi alterado. Tente de novo; se continuar, fale com a gente."
**Estados.**
- Estados da assinatura: ativa, cancelamento agendado, cancelada (volta ao Livre).
- **O plano nunca é oferecido** em Hoje, Como estou, Ajuda agora nem por causa de pontuação, faixa, alerta ou ARBE; aqui ele aparece **só porque a pessoa abriu esta tela**.
**Por pessoa.** Ana (Cuida): cartão com R$ 119,90. Maria (Essencial): R$ 49,90. João (Livre): "Sem custo, sem prazo" e **Ver os planos**. Elza e Lourdes (Sustenta): R$ 149,90. Marcos: nota de mudança agendada com **Manter meu plano**.
**RN.** RN-PLN-01 a 08, 11 a 14, 19, 22, RN-GRP-17, RN-CRT-03, RN-ATD-05, 11, RN-CAN-06.
**Critérios de aceite.**
- **AC-CG-149** Dada a rota, então aparecem `h1`, o cartão do plano atual com etiqueta, preço e situação, **Ver outros planos** e (no plano pago) **Cancelar plano**; no Livre, **Ver os planos** e sem cancelar.
- **AC-CG-150** Dado o quadro dos planos, então mostra os 4 planos com os preços R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90 por mês, os itens da Figura 1, o plano atual marcado "Seu plano agora" e o aviso literal "A mensalidade não inclui serviços da rede nem atendimento psicológico." **sem letra miúda** (nenhum texto abaixo de 14 px).
- **AC-CG-151** Dado **subir** de plano, então a folha diz "Vale hoje." e quando a cobrança começa; ao confirmar, o plano muda na hora, o cartão é emitido e a tela mostra "Plano alterado para o Cuida. Cartão NX-0000-0042 emitido."
- **AC-CG-152** Dado **descer** de plano, então a folha diz que vale no fim do ciclo (com a data) e lista as turmas futuras das quais a pessoa sai; ao confirmar, a assinatura fica `cancel_scheduled` com a data e o plano de destino, e o plano atual continua até lá.
- **AC-CG-153** Dado **cancelar**, então a folha diz o efeito (cartão deixa de valer, plano vira Livre, na data do fim do ciclo); ao confirmar, aparece a nota "Mudança agendada" e **Manter meu plano**.
- **AC-CG-154** Dado **Manter meu plano**, então desfaz a mudança agendada em **um toque**, sem folha, com a faixa "Plano mantido."
- **AC-CG-155** Dada a primeira contratação paga, então **a mesma folha do efeito** (um passo só, CXC-010) traz o aviso de emergência numa linha e a caixa "Li e entendi", e grava a data e a hora; sem o aceite, o botão da ação ("Mudar para o Cuida") mostra "Marque que você leu o aviso para continuar." "Seu plano agora" lista tudo o que o plano inclui, também o que vem dos planos anteriores, e a folha diz "Se mudar de ideia, é só mudar de plano de novo."
- **AC-CG-156** Dado todo o fluxo de troca, então **não existe** campo de número de cartão, validade ou código de segurança.
- **AC-CG-157** Dado um plano pago pela empresa, então não há botões de troca nem de cancelamento e a nota explica que a mudança é pelo contrato da empresa.
- **AC-CG-158** Dada qualquer pessoa, então **nenhuma** oferta, convite de upgrade ou selo de plano aparece em Hoje, Como estou ou Ajuda agora, e nenhum texto de plano cita pontuação, faixa, alerta ou ARBE (RN-PLN-19).

## C19. `/cuidador/mais/ajuda`: Falar com a Nexus (P2, `help`)
**Propósito.** Mostrar os jeitos de falar com a equipe e deixar mandar uma mensagem pelo aplicativo.
**Ação principal.** **Enviar mensagem** (aplicativo); para quem prefere telefone ou WhatsApp, **Copiar número**.
**De cara.** `h1` "Falar com a Nexus"; apoio "Escolha o jeito mais fácil para você."; **4 canais** em itens de lista, **o canal preferido da pessoa primeiro** (etiqueta "Seu canal preferido"): **Telefone**, **WhatsApp**, **Mensagem no aplicativo**, **E-mail**, cada um com o prazo; o aviso de emergência compacto.
**Atrás de um toque.**
- Telefone e WhatsApp abrem o diálogo "Como falar com a gente" (A.2.16: número grande, **Copiar número**).
- **Mensagem no aplicativo** abre, na mesma tela, o **campo de mensagem**; abaixo, h2 **Suas mensagens** com o histórico.
**Textos.**
- Prazos:
  - Telefone "Na hora, em horário comercial (segunda a sexta, 8h às 18h)"
  - WhatsApp "Até 4 horas úteis"
  - Mensagem no aplicativo "Até 24 horas úteis"
  - E-mail "Até 48 horas úteis, para documentos e contratos".
- Mensagem: "Sobre o que é?" em 3 chips (**Dúvida sobre o app**, **Preciso remarcar ou cancelar**, **Outro assunto**); campo "Escreva a sua mensagem"; abaixo, "Se for urgente, use Ajuda agora."; botão **Enviar mensagem**. Confirmação: "Recebemos a sua mensagem. Respondemos em até 24 horas úteis."
- Histórico: cada mensagem com a data, o canal (ícone e texto) e a situação ("Enviada", "Respondida"). Mensagem registrada pela equipe por telefone: "Conversa por telefone registrada em 02/11."
- Vazio (Marcos): título "Você ainda não mandou nenhuma mensagem", texto "Quando você escrever para a equipe, a conversa aparece aqui." e os 3 chips de assunto à vista.
- Erros: "Escreva a sua mensagem para enviar." · "Não foi possível enviar. Sua mensagem continua aqui. Tente de novo."
- Fora do horário: "Fechado agora. Abrimos amanhã às 8h." no telefone. Número fictício `(34) 90000-0000`; **nenhum** `tel:` nem `wa.me` abre sozinho.
**Estados.**
- Sem número de WhatsApp com WhatsApp como preferido: aviso no Perfil (tela 22), não aqui.
- O app **não detecta nem classifica risco** no texto da mensagem; a equipe sinaliza `[S-24]`.
**Por pessoa.**
- **João**: Telefone vem primeiro, maior, com o número já visível.
- **Marcos**: vazio com os chips.
- **Maria**: se enviou "Combinar um horário" (de Como estou), a mensagem aparece no histórico. Os outros: ordem pelo canal preferido.
**RN.** RN-CAN-01 a 06, RN-USR-18, RN-ATD-11, RN-ENC-09.
**Critérios de aceite.**
- **AC-CG-159** Dada a rota, então aparecem os 4 canais, o **canal preferido primeiro** com a etiqueta "Seu canal preferido", cada um com o prazo certo (Telefone na hora em horário comercial, WhatsApp 4 horas úteis, aplicativo 24 horas úteis, e-mail 48 horas úteis) e o aviso de emergência.
- **AC-CG-160** Dado telefone ou WhatsApp, quando se toca, então abre o diálogo com o número `(34) 90000-0000` em 28 px, **Copiar número** e "No protótipo, a ligação não é feita."; **nenhum** `tel:` nem `wa.me` abre sozinho.
- **AC-CG-161** Dado **Copiar número** e o navegador negando a área de transferência, então o número fica selecionado e aparece "Não foi possível copiar. Segure sobre o número e escolha Copiar."
- **AC-CG-162** Dada uma mensagem com texto, quando se toca **Enviar mensagem**, então grava uma mensagem do canal aplicativo com o prazo de 24 horas úteis, mostra "Recebemos a sua mensagem. Respondemos em até 24 horas úteis." e ela aparece em **Suas mensagens**; mensagem vazia mostra "Escreva a sua mensagem para enviar."
- **AC-CG-163** Dada uma pessoa sem nenhuma mensagem (Marcos), então aparece o vazio "Você ainda não mandou nenhuma mensagem" com os chips de assunto.
- **AC-CG-164** Dado o horário simulado fora de segunda a sexta, 8h às 18h, então o telefone mostra "Fechado agora. Abrimos amanhã às 8h." e a tela sugere WhatsApp ou mensagem.
- **AC-CG-165** Dada a tela inteira, então estão visíveis o aviso de que os canais não substituem atendimento de saúde nem orientação sobre remédios e a indicação de SAMU 192 em emergência (RN-CAN-06).

## C20. `/cuidador/mais/familia`: Família (P1, `family`)
**Propósito.** Gerar um texto com a rotina da pessoa idosa para a família, só com o que a pessoa escolher, para copiar e colar.
**Ação principal.** **Copiar texto**.
**De cara.** `h1` "Família"; apoio "Gere um texto com a rotina de Helena para mandar à sua família. Você escolhe o que entra."; 3 chaves (A.2.10), **todas desligadas**: **Compromissos de hoje**, **Compromissos desta semana**, **Remédios de hoje (nome e horário)**; a **caixa do texto** (prévia que muda a cada chave); botão primário **Copiar texto**.
**Atrás de um toque.** Nada fica escondido; o aviso fixo diz o que **nunca** entra.
**Textos.**
- Prévia (exemplo, com as 3 chaves ligadas), bloco de texto: "Rotina de Helena, quinta-feira, 05/11. Compromissos de hoje: 14:00 Fisioterapia (Clínica Movimento Vital). Compromissos desta semana: sex, 06/11, 10:00 Consulta com o cardiologista. Remédios de hoje: 08:00 Losartana, 20:00 Metformina. Enviado por Ana pelo app Nexus." (só o **primeiro nome** da pessoa idosa; só nome e horário do remédio, **sem dose**; sem condição de saúde.)
- Aviso fixo: "Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui."
- Nenhuma chave ligada: na caixa, "Escolha o que você quer compartilhar." e o botão **Copiar texto** sem uso, com o motivo escrito acima ("Ligue pelo menos um item.").
- Copiado: faixa "Texto copiado. Cole na conversa da sua família." Clipboard negado: a caixa fica selecionada com "Segure sobre o texto e escolha Copiar."
- **Sem autorização** (consentimento "compartilhar com a família" não dado): no lugar das chaves, um cartão `soft` com a pergunta do consentimento ("Podemos compartilhar informações da pessoa idosa com a sua família?"), o texto simples e dois botões de peso igual: **Autorizo** e **Agora não**. Depois de **Autorizo**, as chaves aparecem.
**Estados.**
- Sem compromissos no dia: a linha vira "Compromissos de hoje: nenhum." Sem remédios: "Remédios de hoje: nenhum." Autorização retirada em Privacidade: volta o cartão de autorização.
- **Não há envio** (nem e-mail, nem WhatsApp): o app só gera o texto.
**Por pessoa.** Depende do consentimento (c) de cada pessoa no seed: quem não autorizou vê o cartão de autorização; quem autorizou vê as chaves. QA confere o `Consent` `family_sharing` do `cg_00NN`.
**RN.** RN-USR-11, RN-LGPD-05 (c), RN-LGPD-08, RN-ATD-18, RN-GRP-10, RN-ETICA-07.
**Critérios de aceite.**
- **AC-CG-166** Dada a rota **com** o consentimento (c) ativo, então aparecem as 3 chaves **desligadas**, a caixa do texto com "Escolha o que você quer compartilhar." e **Copiar texto** sem uso com o motivo escrito.
- **AC-CG-167** Dada uma chave ligada, então a caixa passa a mostrar o trecho correspondente em tempo real, e desligar o remove; com todas desligadas, volta a mensagem de escolher.
- **AC-CG-168** Dado o texto gerado, então ele contém **só**: o primeiro nome da pessoa idosa, a data, os compromissos marcados, e nome mais horário dos remédios marcados; **não contém** dose, condição de saúde, conversa com psicólogo, grupo, escala, plano nem dado do cuidador além do primeiro nome.
- **AC-CG-169** Dado **Copiar texto**, então o texto vai para a área de transferência e aparece "Texto copiado. Cole na conversa da sua família."; com o navegador negando, a caixa fica selecionada com a instrução de copiar à mão.
- **AC-CG-170** Dada a pessoa **sem** o consentimento (c), então no lugar das chaves aparece o cartão de autorização com **Autorizo** e **Agora não** de peso igual; **Agora não** não grava nada e mantém o cartão; **Autorizo** grava o consentimento com o evento e libera as chaves.
- **AC-CG-171** Dada a conversa da própria pessoa com o psicólogo marcada, então ela **não aparece** no texto nem entre as opções.
- **AC-CG-172** Dada a tela inteira, então **não há** botão de enviar por e-mail, WhatsApp ou qualquer canal, e o aviso "Nada de conversa com psicólogo, grupo ou resultado da escala entra aqui." está visível.

## C21. `/cuidador/mais/privacidade`: Privacidade e meus dados (P2, `privacy`)
**Propósito.** Deixar a pessoa ver e mudar o que autorizou, pedir uma cópia dos dados, pedir a eliminação e acompanhar os prazos.
**Ação principal.** Tocar numa autorização para ver ou mudar (nenhuma ação primária de destaque).
**De cara.** `h1` "Privacidade e meus dados"; apoio "Você decide o que a Nexus pode fazer com os seus dados. Pode mudar quando quiser. O plano Livre continua em qualquer caso."; h2 **Minhas autorizações** com **5 itens** (6 com o piloto) em item de lista: nome simples, estado ("Você autorizou em 04/11", "Você não autorizou", "Você ainda não decidiu") e `chevron-right`.
**Atrás de um toque.**
- Tocar numa autorização abre a **folha** com o texto simples (`CONSENT_COPY`), o estado e a ação: **Autorizar**, **Não autorizar**, **Retirar a autorização** (com a folha de efeito, B11) ou **Autorizar de novo**; "Ver histórico" (linha do tempo: autorizou, retirou, autorizou de novo; **não se edita nem se apaga**). h2 **Meus dados** com os itens: **Pedir uma cópia dos meus dados**, **Corrigir meus dados** (leva a Meu perfil), **Pedir eliminação dos meus dados**, **Com quem os meus dados foram compartilhados**, **Política de privacidade e contato do encarregado**.
- Se houver, o cartão **Meus pedidos** com protocolo, tipo, situação e "Faltam 12 dias".
**Textos.**
- Nomes das 5:
  - "Dados de saúde para o acompanhamento"
  - "Números somados da Nexus"
  - "Compartilhar com a família"
  - "Imagem e depoimento"
  - "Contato por WhatsApp" (e "Piloto da Nexus" quando há).
- **Retirar saúde** (folha de efeito): "Ao retirar: a escala de cansaço e o acompanhamento ficam pausados. O que já foi registrado fica guardado por 5 anos, como a norma do conselho pede. O plano Livre, a agenda e os remédios continuam. Você pode autorizar de novo quando quiser." **Retirar a autorização** (suave) e **Voltar** (foco inicial).
- **Pedir cópia** (folha): "A equipe prepara o arquivo com os seus dados e avisa você em até 15 dias." **Pedir a cópia** e **Voltar**. Depois: "Pedido DSR-0006 feito em 04/11. Faltam 15 dias." e, ao concluir, **Baixar o arquivo**.
- **Eliminação** (folha de efeito, 2 blocos):
  - "Será eliminado: o seu cadastro de contato, mensagens, agenda e remédios."
  - "Ficará guardado e sem uso: as respostas da escala e as anotações do atendimento, por 5 anos, como a norma do conselho pede. Depois disso, são apagados."
  - "Você continua usando o app até a equipe concluir."
  - caixa "Entendi o que será eliminado e o que ficará guardado" `[S-26]`
  - **Pedir eliminação** (vermelho, ato irreversível) e **Voltar** (foco inicial). Depois: "Pedido DSR-0007 feito em 04/11. Faltam 15 dias." e **Retirar o pedido**.
- **Com quem compartilhamos**: lista de profissionais que receberam um pedido (nome, data, "Enviamos: nome, contato e o que você pediu") e "Nada mais é compartilhado. O texto da Família é copiado por você: a Nexus não envia."
- **Política**: abre a folha com o texto, o nome e o e-mail do encarregado (fictício).
- Pedido repetido: "Você já tem um pedido de cópia em andamento (DSR-0006)."
- Erros: "Não foi possível registrar o pedido. Tente de novo; se continuar, fale com a gente."
**Estados.**
- Dias restantes em **dias corridos, sem relógio e sem vermelho**: "Faltam 12 dias"; no último dia "Falta 1 dia".
- Pedido concluído: "Concluído em 19/11/2026".
- Eliminação concluída: o que foi eliminado e o que ficou guardado, com o prazo.
- Pedido recusado pela equipe: o motivo por escrito.
**Por pessoa.**
- **Sônia**: Dados de saúde "Você não autorizou" com **Autorizar de novo**; o resto normal.
- **Ana**: tudo "Você autorizou" (conforme o seed). Quem tem **pedido de eliminação aberto** vê o cartão com os dias restantes e **Retirar o pedido**, e continua usando o app.
- **Maria**: o pedido de revisão de decisão aparece em Como estou, não aqui.
**RN.** RN-USR-15, 16, 17, RN-LGPD-04, 05, 14, 18 a 21, 23, 24, 25, RN-ARBE-09.
**Critérios de aceite.**
- **AC-CG-173** Dada a rota, então aparecem as autorizações como itens **independentes**, cada um com o estado em texto (autorizou, não autorizou, ainda não decidiu) e a data, e nenhum vem pré-marcado.
- **AC-CG-174** Dado **Retirar a autorização** de saúde, então a folha mostra o efeito (escala e acompanhamento pausados, registro guardado por 5 anos, Livre, agenda e remédios continuam) com o foco inicial em **Voltar**; ao confirmar, grava o evento de consentimento `revoked`, o cadastro vai a "pausado" e Hoje e Como estou deixam de mostrar blocos de saúde.
- **AC-CG-175** Dada a retirada de **imagem, WhatsApp, números somados ou família**, então **não muda** nenhuma outra autorização nem o acesso ao plano Livre.
- **AC-CG-176** Dado **Autorizar de novo**, então grava o evento `granted`, retoma o acompanhamento e a linha do tempo de Como estou volta.
- **AC-CG-177** Dado "Ver histórico", então a linha do tempo mostra quando autorizou, retirou e autorizou de novo, com a versão do termo, e **não há** botão de editar nem de apagar.
- **AC-CG-178** Dado **Pedir a cópia**, então grava a solicitação com protocolo e prazo de 15 dias corridos, mostra "Faltam N dias para a resposta" (sem relógio nem vermelho; o código interno do pedido não aparece), e quando a equipe conclui aparece **Baixar o arquivo**.
- **AC-CG-179** Dado **Pedir eliminação**, então a folha mostra duas colunas de texto "Será eliminado" e "Ficará guardado e sem uso" com o **motivo e o prazo** ("A equipe responde em até 15 dias." **na folha, antes de confirmar**, RN-LGPD-24, CXC-009), exige a caixa de entendimento, e só então liga o botão; ao confirmar, o cadastro vai a `closure_requested`, a pessoa continua usando o app e vê **Retirar o pedido**.
- **AC-CG-180** Dado um pedido aberto, quando se toca **Retirar o pedido**, então o pedido volta a `open` sem efeito e o cadastro volta a `active`; **nada é eliminado** antes de a equipe concluir.
- **AC-CG-181** Dado "Com quem os meus dados foram compartilhados", então lista os profissionais que receberam pedido (nome, data, o que foi enviado) e diz "Nada mais é compartilhado."
- **AC-CG-182** Dado um pedido repetido do mesmo tipo, então aparece "Você já tem um pedido de cópia em andamento." (sem o código DSR) e não cria outro.
- **AC-CG-183** Dado o botão vermelho, então ele aparece **só** na folha de eliminação (ato irreversível); nenhum outro item da tela usa vermelho.
- **AC-CG-184** Dada a política de privacidade, então abre com o nome e o e-mail do encarregado e linguagem acessível, e o aviso de protótipo está visível.

## C22. `/cuidador/mais/perfil`: Meu perfil (P1, `start`, `[P-02]`)
**Propósito.** Ver e corrigir os dados da pessoa e de quem ela cuida, e o jeito de falar com ela.
**Ação principal.** **Salvar** (dentro da folha de cada seção).
**De cara.**
- `h1` "Meu perfil"; **3 cartões** de seção, cada um com os dados em lista (rótulo e valor) e o botão de texto **Editar**: **Você** (nome, nascimento, **CPF completo**, celular, e-mail, cidade), **Quem você cuida** (nome, nascimento, parentesco, grau de ajuda), **Seu dia a dia** (horas por dia, canal preferido, número do WhatsApp).
- Embaixo, o seletor de tamanho da letra.
**Atrás de um toque.** **Editar** abre a folha **só daquela seção**, com os campos e **Salvar** (um assunto por vez).
**Textos.**
- CPF: mostrado inteiro (é o próprio dado da pessoa) e, ao lado, "Para corrigir o CPF, fale com a gente." `[S-31]`.
- Folha:
  - "Editar: Você"
  - campos como em Começar
  - **Salvar alterações**
  - **Voltar**. Faixa: "Dados salvos."
- Horas por dia: "Quantas horas por dia você dedica ao cuidado?" com "Pode mudar quando quiser."
- Aviso do canal (CX-041), quando o preferido é WhatsApp e não há número: nota `info` no cartão **Seu dia a dia**: "Você prefere o WhatsApp, mas não informou o número. Informe para a equipe poder falar com você." e o botão de texto **Informar o número**.
- Erros: os de A.2.9 (formato, 18 anos, intervalo de horas); "Não foi possível salvar. Tente de novo; se continuar, fale com a gente."
**Estados.**
- A tela **não pede nem mostra** condição de saúde da pessoa idosa (só o necessário, RN-USR-09).
- Salvar sem mudança: "Nada mudou." sem erro.
- Trocar o canal preferido de WhatsApp para Telefone **não apaga** o número do WhatsApp.
**Por pessoa.** **João**: canal "Por telefone"; letra sugerida Grande no cadastro. Quem prefere WhatsApp sem número vê o aviso. Todos veem o CPF **completo** (decisão 2 do contexto).
**RN.** RN-USR-02 a 04, 09, 14, 18, RN-LGPD-07, 08, 20 (correção).
**Critérios de aceite.**
- **AC-CG-185** Dada a rota, então aparecem `h1` "Meu perfil", os 3 cartões Você, Quem você cuida e Seu dia a dia com os dados da pessoa (CPF **completo**, sem máscara) e o seletor de tamanho da letra.
- **AC-CG-186** Dado **Editar** em uma seção, então a folha mostra só os campos daquela seção, valida como em Começar (18 anos, formato de telefone e e-mail, horas de 0 a 24) sem apagar o digitado, e ao **Salvar alterações** os dados mudam e aparece "Dados salvos."
- **AC-CG-187** Dado o canal preferido WhatsApp **sem** número de WhatsApp, então o cartão **Seu dia a dia** mostra a nota "Você prefere o WhatsApp, mas não informou o número. Informe para a equipe poder falar com você." com **Informar o número**; ao informar, a nota some.
- **AC-CG-188** Dado o CPF, então **não é editável** nesta tela e o texto "Para corrigir o CPF, fale com a gente." leva ao diálogo "Como falar com a gente".
- **AC-CG-189** Dada a tela inteira, então **não aparece** condição de saúde, remédio nem diagnóstico da pessoa idosa, e nenhum dado de atendimento, grupo ou escala.
- **AC-CG-190** Dada a mudança de horas por dia, então salva sem aviso adicional e sem mencionar avaliação de risco.

---

# PARTE D. Pessoas, auditoria e suposições

## D.1 O que cada pessoa de demonstração vê

### D.1.1 Em Hoje (as 7 pessoas pedidas)

Hoje = quarta-feira, 04/11/2026. "Padrão" = saudação, próximo compromisso, remédios de hoje com **Dei**, humor, "Para você" e "Falar com a gente". Os dados vêm do seed (`docs/08` seção 7.2) e do contexto (`docs/10-cuidador-contexto.md`).

| Pessoa (id, plano) | Em Hoje, de cara | Mais abaixo | O que **nunca** aparece em Hoje |
|---|---|---|---|
| **Ana Paula Ferraz** (`cg_0001`, Cuida) | Saudação, **nota de cuidado**: "A equipe de psicologia vai falar com você hoje." com "Prefere falar agora?"; compromisso; remédios | Humor; **sem convite do dia** (a nota ocupa o lugar); "Para você" só se houver serviço a avaliar | Pontuação (63), faixa, "alerta", "vermelho", prazo em horas, ARBE (crítico), ocorrência, plano |
| **Maria Aparecida Lemos** (`cg_0002`, Essencial) | Saudação, **nota de cuidado**: "A equipe ainda não conseguiu falar com você. A responsável técnica foi avisada e vai procurar você." com **Falar com a gente agora**; compromisso; remédios | Humor; sem convite; **o pedido de revisão não aparece em Hoje** (fica em Como estou) | "Vencido", "atrasado", pontuação (79), faixa, cadeado de grupo, plano |
| **João Batista Carneiro** (`cg_0003`, Livre) | Saudação, compromisso, remédios (hora em destaque, botão **Dei** largo) | Humor; convite do dia; no fim, o cartão **"Prefere falar com a gente?"** com o telefone `(34) 90000-0000` em destaque (canal preferido telefone, pouca familiaridade digital) | Pontuação (66 e 52), faixa, "Cartão Nexus" ou plano, qualquer cadeado |
| **Elza Guimarães** (`cg_0027`, Sustenta) | Saudação, compromisso, remédios | Humor; convite do dia; **sem** "Avaliar" (no seed ela não tem serviço concluído esperando avaliação: tem um pedido "enviado" e nenhum serviço avaliado) | O desconto do Cartão (8 usos), a reclamação grave da avaliação, plano |
| **Lourdes Campos** (`cg_0024`, Sustenta, piloto) | Saudação, compromisso, remédios | Humor; convite do dia (a roda aberta, por exemplo); a fila do grupo **não aparece** em Hoje (está em Cuidar de mim e em Grupos) | Pontuação (52 e 44), piloto, plano |
| **Marcos Vinícius Leal** (`cg_0026`, Essencial, cancelamento agendado) | Saudação, compromisso, remédios | Humor; convite do dia; "Falar com a gente" em texto | **A mudança de plano** ("muda para o Livre em 13/11"): fica em Mais, Meu plano e Cartão, **não em Hoje** |
| **Sônia Maria Dutra** (`cg_0016`, Essencial, saúde retirada) | Saudação, compromisso, remédios | **Sem humor**; convite do dia; nenhuma nota de saúde | Nota de cuidado, humor, qualquer texto de acompanhamento; a explicação da pausa fica em Como estou |

### D.1.2 Outras pessoas da lista, em resumo

| Pessoa | O que a distingue no app |
|---|---|
| **Rita de Cássia Moura** (`cg_0008`, Cuida) | Hoje padrão (o amarelo não tem contato no mesmo dia, então **sem nota**). Em Conversar com um psicólogo, os horários de prioridade aparecem **sem etiqueta** e sem explicação. Grupos liberados |
| **Terezinha Alves** (`cg_0012`, Essencial) | Hoje padrão. Como estou: 3 pontos na linha do tempo (40, 28 e 18). Grupos bloqueados pelo plano (rodas abertas liberadas) |
| **Marlene Cardoso** (`cg_0004`, Livre) | Hoje padrão; "Sobrecarga ausente ou pequena" (0 pontos) em Como estou; conteúdos exclusivos e cartão como convite calmo |

### D.1.3 Como cada pessoa muda as outras telas (para o QA)

| Tela | Ana | Maria | João | Elza | Lourdes | Marcos | Sônia |
|---|---|---|---|---|---|---|---|
| Como estou | Nota "vai falar hoje"; 48 e 63 | Nota "ainda não conseguiu"; 55 e 79; pedido de revisão aberto; "Combinar um horário" | 66 e 52 | Padrão (38) | 52 e 44 | 1 ponto (27) | **Pausado**, sem humor |
| Grupos | Liberado | **Bloqueio por plano**, rodas abertas | **Bloqueio por plano**, rodas abertas | Liberado | Fila de espera do grupo lotado | Bloqueio por plano | Bloqueio por plano |
| Cartão Nexus | Ativo | Ativo | **Convite calmo** (Livre) | Ativo, **8 usos** | Ativo | Ativo, "vale até 13/11" | Ativo |
| Conversar (preço) | 15% | 10% | Total R$ 120,00 **sem desconto** | 20% | 20% | 10% | 10% |
| Meu plano | R$ 119,90 | R$ 49,90 | "Sem custo, sem prazo" | R$ 149,90 | R$ 149,90 | **Mudança agendada**, "Manter meu plano" | R$ 49,90 |
| Privacidade | Tudo autorizado (seed) | Padrão | Padrão | Padrão | Piloto (TCLE) visível | Padrão | Saúde **"Você não autorizou"** |
| Falar com a Nexus | Padrão | Mensagem "Combinar um horário" se enviada | **Telefone primeiro**, número visível | Padrão | Padrão | **Vazio** (nunca mandou mensagem) | Padrão |

## D.2 Auditoria: tensões entre as regras e o público, e como foram resolvidas

| # | Tensão | Severidade | Como o desenho resolve |
|---|---|---|---|
| 1 | RN-ZRT-23 manda mostrar ao cuidador a **pontuação e a faixa**, mas o dono pede "sem número assustador" e RN-ZRT-18 proíbe leitura de diagnóstico | Alta | A faixa vai **por extenso**, em **rampa de azul**, e a pontuação só como **legenda de 14 px**; frase fixa "Não é um diagnóstico"; sem vermelho, sem octógono, sem percentual, sem "melhorou" ou "piorou" (A.2.21, AC-CG-87 a 89) |
| 2 | RN-ZRT-13 pede **contato no mesmo dia** com o alerta vermelho, e o contato de Maria **venceu** | Alta | O app diz o que a equipe vai fazer, com cuidado e uma saída imediata ("Falar com a gente agora"), **sem** "alerta", "vencido", "atrasado" ou prazo (AC-CG-43 a 45) |
| 3 | RN-PLN-19 proíbe usar Zarit, alerta e ARBE em oferta, mas Hoje tem "um convite para você" e há bloqueio por plano | Alta | O convite é **rodízio por calendário** só com itens abertos a todos; o bloqueio é **idêntico** para todo o mesmo plano; Como estou e Ajuda agora **não têm** nenhuma oferta (AC-CG-52, 97, 104, 158) |
| 4 | RN-ATD-12 dá prioridade de vaga **sem o cuidador ser informado do motivo** | Média | Horários de prioridade aparecem como os outros, sem etiqueta (AC-CG-85) |
| 5 | RN-ATD-19 exige mostrar psicoterapia ou orientação, mas é jargão para quem está cansado | Média | Duas opções em frase simples e a terceira "Não sei" `[S-07]`; o caráter aparece em cada conversa (AC-CG-78, 85) |
| 6 | RN-USR-07 pede lembrete de remédio, mas RN-ATD-11 e RN-CAN-06 proíbem orientar sobre remédio | Média | O app só marca e lembra; aviso fixo; sem campo de dose orientada nem de diagnóstico (AC-CG-64, 70) |
| 7 | Contexto diz "Livre só consulta" (rede) e RN-REDE-25 dá "acesso inicial"; RN-CAN-05 diz que nada essencial depende só do app | Média | **Decisão do líder:** Livre vê, compara e **pede** o serviço (a jornada, etapas 5 a 8, não tem restrição de plano; o seed já traz pedidos de Livre); só as **condições especiais** valem do Essencial em diante; o telefone do profissional aparece para todos `[S-09]` (AC-CG-126) |
| 8 | RN-LGPD-14 pausa o acompanhamento ao retirar a autorização, mas RN-ZRT-19 dá ao cuidador o acesso aos resultados | Média | Linha do tempo oculta enquanto pausado e caminho para pedir a cópia `[S-28]` (AC-CG-94) |
| 9 | RN-LGPD-04 pede consentimentos separados, e seis cartões de uma vez cansam | Média | Saúde em destaque; os outros 4 recolhidos; "Decidir depois" vale; nada pré-marcado (AC-CG-28) |
| 10 | A decisão 6 do contexto impede `tel:` e `wa.me`, e a pessoa em emergência precisa do número | Média | Número grande, **Copiar número** e a frase "em uma emergência de verdade, ligue do seu telefone" (AC-CG-35) |
| 11 | O DS manda confirmação em diálogo central e "digitar para confirmar" em ato grave; não serve para mão ocupada | Baixa | Folha de baixo e caixa de entendimento `[S-02]` `[S-26]` |
| 12 | O DS usa corpo de 16 px e alvo de 44 px | Baixa | Tema `.cg-app` com 18 px e 48 px (AC-CG-01) |

## D.3 Lista de checagem de UX para o QA e o CS/CX

Marque cada item como aprovado, reprovado ou não se aplica, **por pessoa de demonstração**. Item reprovado vira bug com o `AC-CG-NN` e a tela. O CS/CX testa **como cuidador** (Ana, Maria e João), em **celular de 360 px**.

### D.3.1 Heurísticas de Nielsen aplicadas a este público

| # | Heurística | Como se aplica aqui | Verificar |
|---|---|---|---|
| H1 | Visibilidade do estado | Toda ação diz o que aconteceu, com texto ("Dado às 08:12", "Pedido enviado"); progresso do cadastro em "Etapa X de 5" | Marcar um remédio e ver a linha mudar sem recarregar; o passo a passo sempre mostra onde está |
| H2 | Correspondência com o mundo real | "Remédio", "conversa", "pessoa idosa", "cansaço"; nada de "sessão", "ARBE", "ZRT" | Busca por termos proibidos (AC-CG-12); ler as telas em voz alta |
| H3 | Controle e liberdade | "Voltar" em toda folha, "Desfazer" em ações leves, "Manter meu plano", "Retirar o pedido" | Desfazer um "Dei", uma remarcação, uma mudança de plano e um pedido de eliminação |
| H4 | Consistência e padrões | Um primário por tela, mesma folha de confirmação, mesma ordem de botões, mesmos ícones | Percorrer as 22 telas: a ação principal está sempre no mesmo tipo de lugar |
| H5 | Prevenção de erros | Efeito dito **antes** (folha), foco inicial no botão seguro nos atos irreversíveis, nada pré-marcado | Cancelar conversa a menos de 24 h; pedir eliminação; nenhum consentimento vem marcado |
| H6 | Reconhecer em vez de lembrar | Cartões de escolha com texto, rascunho, dados mantidos ao errar, resumo antes de gravar | Fechar o cadastro no meio e voltar; errar uma data e ver que o resto fica |
| H7 | Flexibilidade e eficiência | 1 toque para "Dei"; canal preferido primeiro; "Preencher com dados de exemplo" no protótipo | Contar os toques de B1 a B14 contra o máximo |
| H8 | Estética e design minimalista | Uma ação por tela, 3 coisas de cara em Hoje, o resto atrás de um toque | Contar blocos visíveis sem rolar em Hoje (AC-CG-41) |
| H9 | Ajudar a reconhecer e corrigir erros | Erro junto do campo e no resumo, com o que fazer; nunca "inválido" nem código | Provocar cada erro do catálogo (A.2.9) |
| H10 | Ajuda e documentação | "Ajuda agora" a 1 toque em todas as telas; "Falar com a gente" a 1 toque em Hoje | AC-CG-03 em todas as rotas |

### D.3.2 Teste dos 2 minutos

Uma pessoa cansada, com 2 minutos e uma mão ocupada, entende o que fazer? Cronometrar cada tarefa **na primeira tentativa, sem ajuda**:

| Tarefa | Começa em | Toques | Meta de tempo |
|---|---|---|---|
| Marcar que deu o remédio das 08:00 | Hoje | 1 | até 10 s |
| Saber qual é o próximo compromisso | Hoje | 0 | até 5 s |
| Achar o telefone da Nexus | Hoje | 2 | até 20 s |
| Pedir ajuda agora (ver o número do SAMU) | qualquer tela | 2 | até 10 s |
| Adicionar uma consulta de amanhã | Hoje | 6 | até 90 s |
| Marcar uma conversa com o psicólogo | Hoje | 7 | até 2 min |
| Mudar o tamanho da letra | Hoje | 3 | até 20 s |
| Retirar a autorização de dados de saúde | Hoje | 4 | até 60 s |

**Aprovado** quando: 90% de sucesso na primeira tentativa, tempo até 1,5 vez a meta, **zero erro grave** (pedir eliminação por engano, compartilhar sem querer, cancelar plano sem ler o efeito), nota de facilidade (SEQ, de 1 a 7) média de 5,5 ou mais. Quem fez a tarefa deve conseguir dizer **o que aconteceu** (por exemplo, "marquei o remédio e posso desfazer").

### D.3.3 Teste da letra grande

- [ ] **L1** Em **Bem grande** e 360 px, abrir Hoje, Remédios, Meu plano, Como estou e Conversar com um psicólogo: sem rolagem horizontal, sem texto cortado, sem reticências, sem sobreposição.
- [ ] **L2** A barra inferior continua com 5 itens legíveis (rótulos em até 2 linhas) e o item atual se distingue sem cor.
- [ ] **L3** O humor vira lista vertical e todas as 5 opções cabem e têm texto.
- [ ] **L4** Os botões crescem em altura, o texto não vaza, e **Dei** continua com 48 px ou mais.
- [ ] **L5** A letra escolhida **continua** depois de recarregar a página e de sair e entrar.
- [ ] **L6** Com zoom do navegador a 200%, nenhuma função se perde (WCAG 1.4.4).

### D.3.4 Teste de uma mão

- [ ] **M1** Em 360 x 800 px, com o polegar da mão que segura o aparelho, as **ações principais** (Dei, Continuar, Marcar conversa, Enviar pedido, Copiar texto) ficam nos 2/3 inferiores da tela ou na barra fixa.
- [ ] **M2** Nenhuma ação exige arrastar, pinça, toque longo, toque duplo ou gesto de borda.
- [ ] **M3** Folhas de baixo: o botão primário está no alcance do polegar e **Voltar** também.
- [ ] **M4** Com o teclado aberto, o campo e o botão de enviar continuam visíveis e a barra inferior não cobre nada.
- [ ] **M5** Toques acidentais: nenhum alvo de ato irreversível fica colado a outro alvo (8 px ou mais); o perigo suave **nunca** é o botão mais perto do polegar.

### D.3.5 Teste sem o app: tem WhatsApp ou telefone?

RN-CAN-05: nenhuma função essencial depende só do app. Para cada função, a equipe consegue fazer **em nome da pessoa**, por telefone ou WhatsApp.

| Função essencial | No app | Sem o app (WhatsApp ou telefone) | Verificar |
|---|---|---|---|
| Pedir ajuda em emergência | Ajuda agora | SAMU 192 e CVV 188 pelo telefone da própria pessoa | A tela mostra os números mesmo sem sessão |
| Marcar ou cancelar a conversa com o psicólogo | Conversar com um psicólogo | A equipe registra a sessão em nome da pessoa (F04 do ERP) | O diálogo "Como falar com a gente" está a 1 toque |
| Pedir um serviço da rede | Profissional, Pedir serviço | A equipe registra o pedido por telefone | Meus pedidos mostra o pedido registrado pela equipe |
| Trocar ou cancelar o plano | Meu plano | A equipe registra a troca (F03 do ERP) | O plano mostra a mudança feita pela equipe |
| Pedir cópia ou eliminação dos dados | Privacidade | Canal do titular pelo telefone, WhatsApp ou e-mail (RN-LGPD-19) | A tela mostra o prazo de 15 dias e o canal |
| Falar com a equipe | Falar com a Nexus | Telefone na hora, WhatsApp em 4 horas úteis | O canal preferido aparece primeiro |
| Ver e marcar remédio e agenda | Hoje e Rotina | A pessoa pode não usar o app; a equipe **não** marca dose por ela | Nada no app depende de enviar mensagem |

Casos de teste: **João** (telefone) consegue marcar uma conversa **sem usar o aplicativo**, só pelo telefone e pela equipe; **Maria** consegue falar com a equipe **sem abrir** Como estou; em **Ajuda agora**, o telefone aparece **sem** exigir entrada.

### D.3.6 Texto, tom e sensibilidade

- [ ] **T1** Busca por texto em `features/caregiver-app`: nenhum travessão (nem o longo nem o médio), nenhum "!", nenhum emoji, nenhuma das palavras proibidas (AC-CG-12).
- [ ] **T2** Telas Hoje, Como estou e Ajuda agora **lidas por uma pessoa de fora**: ela diz que o tom é acolhedor e que **não** sente alarme.
- [ ] **T3** Ana e Maria: a nota de cuidado diz o que vai acontecer e o que fazer; nenhuma das duas lê "alerta", "vermelho", "vencido" ou um número.
- [ ] **T4** Nenhum texto promete resultado ("vai melhorar", "reduz o cansaço") nem usa o sofrimento como apelo (RN-ETICA-05, RN-GRP-15).
- [ ] **T5** Nenhum texto chama a pessoa de "guerreira", "anjo" ou "heroína", e nenhum fala "idoso" ou "paciente".
- [ ] **T6** Plano, preço e desconto aparecem **só** em Meu plano, Cartão, Conversar (resumo), Conteúdos e Grupos (bloqueio), **nunca** em Hoje, Como estou ou Ajuda agora.
- [ ] **T7** Em todas as telas, o aviso de protótipo está visível e os dados são fictícios.

### D.3.7 Mapa dos critérios de aceite por tela

| Tela | AC-CG | | Tela | AC-CG |
|---|---|---|---|---|
| Casca e tema (A.6) | 01 a 16 | | 12 Rede | 113 a 115 |
| 1 Entrada | 17 a 23 | | 13 Buscar | 116 a 123 |
| 2 Começar | 24 a 33 | | 14 Profissional | 124 a 130 |
| 3 Ajuda agora | 34 a 40 | | 15 Meus pedidos | 131 a 138 |
| 4 Hoje | 41 a 56 | | 16 Cartão Nexus | 139 a 144 |
| 5 Agenda | 57 a 63 | | 17 Mais | 145 a 148 |
| 6 Remédios | 64 a 71 | | 18 Meu plano | 149 a 158 |
| 7 Cuidar de mim | 72 a 75 | | 19 Falar com a Nexus | 159 a 165 |
| 8 Conversar com um psicólogo | 76 a 86 | | 20 Família | 166 a 172 |
| 9 Como estou | 87 a 98 | | 21 Privacidade | 173 a 184 |
| 10 Grupos | 99 a 108 | | 22 Meu perfil | 185 a 190 |
| 11 Conteúdos | 109 a 112 | | **Total** | **190** |

## D.4 Suposições de protótipo

Onde o plano e as regras são omissos, o desenho segue e registra aqui. Para o PM e o líder confirmarem ou trocarem; nada bloqueia o time.

1. **S-01** O app do cuidador usa **só o tema claro**; a Base força `data-theme="light"` ao entrar e restaura ao sair, sem gravar preferência. (A.1)
2. **S-02** Confirmações e formulários curtos abrem em **folha de baixo** no celular (diverge do DS, que mantém confirmação em diálogo central), por causa da mão ocupada. (A.2.17)
3. **S-03** O botão "Preencher com dados de exemplo" existe no cadastro, para demonstração (como o U-07 do ERP). (tela 2)
4. **S-04** "Lembrar de mim" vem **ligado** em compromisso novo e avisa um dia antes e 1 hora antes (o plano só diz "lembretes de consultas"). (tela 5)
5. **S-05** O resumo de marcar conversa mostra valor (R$ 120,00), desconto do plano e total; o pagamento é "combinado direto no atendimento", **sem cobrança** (RN-ATD-05 e RN-ATD-16). (tela 8)
6. **S-06** "Dei em outro horário" edita o `givenAt` de uma dose já marcada. (telas 4 e 6)
7. **S-07** Em "O que você procura?", a opção **Não sei** grava `guidance` provisoriamente e o psicólogo confirma na conversa; RN-ATD-19 manda exibir a classificação, e o cadastro da sessão exige o campo. (tela 8)
8. **S-08** Ordem dos resultados da rede: "em destaque" primeiro, depois ordem alfabética (RN-REDE-19 permite o destaque; nada de "recomendado"). (tela 13)
9. **S-09** **Decisão do líder (substitui a suposição original):** no plano **Livre** a pessoa consulta, compara e **pede** o serviço pelo app, como os demais planos (jornada, etapas 5 a 8; RN-REDE-26; RN-ATD-04 já libera o atendimento ao Livre). **Condições especiais** na rede valem do Essencial em diante e **benefícios diferenciados** no Sustenta (RN-REDE-25). O telefone do profissional aparece para todos (RN-REDE-11, RN-CAN-05). (telas 13 e 14)
10. **S-10** Os cartões da entrada têm frases **neutras**, sem pontuação nem dado de saúde. (tela 1)
11. **S-11** O convite de "Para você" em Hoje é **rodízio por calendário** entre três itens abertos a todos os planos (conversa com psicólogo, roda aberta, conteúdo livre) e não aparece quando há nota de cuidado, para não colocar uma oferta ao lado de um contato da equipe; essa ocultação usa o estado do contato **só para cuidar**, nunca para vender (RN-PLN-19, RN-LGPD-17). (tela 4)
12. **S-12** O cadastro **não oferece** o TCLE do piloto (a equipe inclui no piloto) e **não pergunta** familiaridade digital (fica "média"); pergunta o tamanho da letra. (tela 2)
13. **S-13** SAMU 192, CVV 188 e Disque 100 **também não discam** no protótipo (a decisão 6 do contexto estendida). As informações do CVV (188, 24 horas, gratuito, chat) são de conhecimento público e **devem ser conferidas na fonte oficial** antes de qualquer uso fora do protótipo. (tela 3)
14. **S-14** A saudação usa o relógio simulado: "Bom dia" até 11:59, "Boa tarde" até 17:59, "Boa noite" depois. (tela 4)
15. **S-15** Quem **confirma** a conversa é a equipe ou o psicólogo; o cuidador vê a situação "Aguardando confirmação do psicólogo" (RN-ATD-15 não diz quem confirma). (tela 8)
16. **S-16** "Combinar um horário" (Como estou) cria uma **mensagem do aplicativo** com `isSupportRequest`, para a equipe ligar no horário. (tela 9)
17. **S-17** Os lembretes de compromisso e de remédio aparecem **só dentro do app** no protótipo; não há notificação no aparelho. (telas 5 e 6)
18. **S-18** Os **comentários** das avaliações não são mostrados ao cuidador; só a nota e a contagem. (tela 14)
19. **S-19** Profissional **sem a cláusula de proteção de dados assinada** não recebe pedido pelo app: o botão some e a nota é neutra (RN-LGPD-13). (tela 14)
20. **S-20** A **posição na lista de espera** é visível ao cuidador (RN-GRP-13 só pede o aviso na promoção). (tela 10)
21. **S-21** O detalhe de grupo e a leitura de conteúdo abrem em **tela cheia** com parâmetro na URL (`?atividade=`, `?conteudo=`), sem criar rota nova. **Decisão do líder (aceita):** a tela cheia é uma **página** que troca o conteúdo da própria tela (com Voltar e foco no título), e não um `<dialog>`; ver S-P3-01. (telas 10 e 11)
22. **S-22** O Cartão Nexus **não tem validade própria**: vale enquanto o plano pago estiver ativo (RN-CRT-03). (tela 16)
23. **S-23** O aceite do aviso de emergência e dos canais (RN-ATD-11, RN-CAN-06) é pedido **no cadastro e na primeira contratação de plano pago**. (telas 2 e 18)
24. **S-24** O app **não detecta risco** no texto da mensagem; a equipe sinaliza, como no F17 do ERP. (tela 19)
25. **S-25** Mudar as **horas por dia** salva sem aviso adicional (a reavaliação interna da ARBE não é mencionada ao cuidador, RN-ARBE-10). (tela 22)
26. **S-26** O pedido de eliminação confirma com **caixa de entendimento**, e não digitando uma palavra como no ERP (digitar cansa e atrapalha quem usa leitor de tela ou tem pouca familiaridade). (tela 21)
27. **S-27** A **conversa da própria pessoa** com o psicólogo aparece na Agenda e em Hoje com a marca "Para você", mas nunca no texto da família. (telas 4, 5 e 20)
28. **S-28** Com a autorização de saúde **retirada**, a linha do tempo do cansaço fica **oculta** (o tratamento cessa, RN-LGPD-14) e a pessoa pode pedir cópia dos dados. (tela 9)
29. **S-29** O **humor do dia** é dado de saúde e depende da autorização de saúde; guarda **um registro por dia** (tocar de novo em "Mudar" substitui). (telas 4 e 9)
30. **S-30** A **disponibilidade** do profissional é dado da equipe (RN-REDE-29) e **não aparece** ao cuidador. (tela 14)
31. **S-31** O **CPF** não é editável pelo cuidador; a correção é pela equipe. (tela 22)
32. **S-32** Remédio **nunca é apagado**: "Este remédio está em uso" mapeia `active`, e o histórico de doses fica. (tela 6)
33. **S-33** A **próxima conversa de acompanhamento** só mostra data quando é **futura**; vencida, o texto é "A equipe vai combinar a próxima conversa com você." (tela 9)
34. **S-34** O rótulo do app é **"autorização"** (palavra de todo dia); o termo jurídico "consentimento" fica nos textos legais. O `CONSENT_COPY` de `health_data.change` tem a palavra "consentimento", e a Base pode oferecer uma variante do cuidador com "autorização". (telas 2 e 21)
35. **S-35** **Ajuda agora** e **Começar** abrem **sem sessão**; a Entrada tem o atalho "Ajuda agora". (telas 1, 2 e 3)
36. **S-36** Mais de 4 remédios no dia: Hoje mostra 4 linhas e "Ver todos"; as doses **dadas ficam no lugar** (não somem da lista). (tela 4)
37. **S-37** Os valores de prazo de resposta (24 h úteis, 4 h úteis, na hora, 48 h úteis) vêm de RN-CAN-02 e o relógio "fechado agora" segue RN-CAN-03 (segunda a sexta, 8h às 18h, sem feriado nacional). (telas 3 e 19)

### Suposições registradas pelos devs de página (S-38 a S-47 de P1, S-P2-01 a 15 de P2, S-P3-01 a 13 de P3)

Todas **aceitas pelo líder** na integração. Três delas são decisões explícitas e estão marcadas como **Decisão aceita**: terapia de grupo só entra com inscrição feita pelo psicólogo (S-P3-05), detalhe de grupo, leitura de conteúdo e quadro de planos abrem como página e não como diálogo de tela cheia (S-P3-01), e subir de plano em dois passos quando falta o aceite do aviso de emergência (S-P3-06).

**P1 (Hoje, Rotina, Começar, Meu perfil, Família)**

38. **S-38** "Compromissos desta semana" (Família) são os dos próximos 7 dias, sem os de hoje, para o texto não repetir o de hoje nem ficar vazio no sábado. (tela 20) *Aceita.*
39. **S-39** O tipo do compromisso (Consulta, Fisioterapia, Psicologia, Outro) é obrigatório e nada vem marcado: "Escolha o tipo do compromisso." (tela 5) *Aceita.*
40. **S-40** Quem escolhe WhatsApp como canal mas não autoriza o contato por WhatsApp (etapa 4) nasce com o canal "aplicativo", e o número fica guardado (mesma regra da revogação, RN-LGPD-05 e). A etapa 4 avisa na hora. (tela 2) *Aceita.*
41. **S-41** A dose do remédio é opcional no formulário (o AC-CG-67 só exige nome e horário). (tela 6) *Aceita.*
42. **S-42** "Preencher com dados de exemplo" preenche as etapas 1 a 3 (nunca as autorizações), para a demonstração do cadastro caber em poucos toques. (tela 2) *Aceita.*
43. **S-43** Quem já tem sessão e abre `/cuidador/comecar` vai a Hoje. (tela 2) *Aceita.*
44. **S-44** "Dei em outro horário" é um botão de texto sob a linha dada (o UX dizia "tocar na linha"), para funcionar por teclado e leitor de tela. (telas 4 e 6) *Aceita.*
45. **S-45** O aceite do aviso de emergência do cadastro fica em `Caregiver.emergencyNoticeAcceptedAt`, com data e hora. (tela 2) *Aceita.*
46. **S-46** "Agora não" em Família não grava nada e mostra a nota "Tudo bem. Nada foi compartilhado." (tela 20) *Aceita.*
47. **S-47** `?novo=1` abre direto a folha de novo compromisso (Agenda) ou de novo remédio (Remédios), para os botões de Hoje levarem a um passo só. (telas 4, 5 e 6) *Aceita.*

**Agenda em calendário (`docs/16-calendario-agenda.md`, S-CAL-01 a 08)**

- **S-CAL-01** A Agenda abre em **calendário** (padrão) e a **Lista** antiga fica atrás do alternador "Calendário | Lista"; a escolha vale para o navegador, não por pessoa, como o tamanho da letra. (tela 5) *Aceita.*
- **S-CAL-02** A semana começa no **domingo** e a grade tem **5 ou 6 linhas** (um mês que cabe em 4 ganha a quinta). (tela 5) *Aceita.*
- **S-CAL-03** A conversa da própria pessoa com o psicólogo é o tipo **Para você** no calendário (marca própria), separado da **Psicologia** da pessoa idosa. (tela 5) *Aceita.*
- **S-CAL-04** Dia com mais de 3 compromissos mostra **duas marcas e "+N"**. (tela 5) *Aceita.*
- **S-CAL-05** **Mês anterior** e **Próximo mês** não mudam o dia escolhido; o cartão do dia diz qual é. Escolher um dia esmaecido leva a grade ao mês dele. (tela 5) *Aceita.*
- **S-CAL-06** Dia que já passou só se lê: sem botão de adicionar (não se marca compromisso no passado) e sem tocar nos compromissos (a Lista antiga já era assim). (tela 5) *Aceita.*
- **S-CAL-07** O calendário não passa dos anos 1900 e 2200. (tela 5) *Aceita.*
- **S-CAL-08** Abrir a Agenda por `?novo=1` (vindo de Hoje) abre o formulário **sem o dia preenchido**; só o botão do cartão do dia preenche. (telas 4 e 5) *Aceita.*

**P2 (Cuidar de mim, Conversar com um psicólogo, Como estou, Ajuda agora, Falar com a Nexus, Privacidade)**

- **S-P2-01** "Retirar o pedido" encerra o pedido do titular como `rejected_with_reason` com o motivo "Retirado pelo titular." e a tela diz "Pedido retirado por você."; o cadastro volta a `active` (ou a `paused_by_consent_revocation`, se a autorização de saúde continua retirada). Não existe estado "retirado" em `DsrStatus`. (tela 21) *Aceita.*
- **S-P2-02** "Pedir uma cópia dos meus dados" abre um pedido do tipo `access` (RN-LGPD-18); "Baixar o arquivo" gera o JSON do titular quando a equipe conclui. (tela 21) *Aceita.*
- **S-P2-03** O pedido de revisão de uma decisão (`decision_review`, da equipe) não aparece em "Meus pedidos" de Privacidade: fica em Como estou. (telas 9 e 21) *Aceita.*
- **S-P2-04** Conversa em casa: o cuidador informa o endereço e a segurança do local fica "não confirmada" até o psicólogo (`homeSafetyPending`, RN-ATD-09). Quem agenda pela equipe continua confirmando na hora. (tela 8) *Aceita.*
- **S-P2-05** No coworking o aplicativo atribui a primeira sala reservável por nome (os 4 itens de acessibilidade, RN-ATD-10); sem sala reservável o formato não tem horário. (tela 8) *Aceita.*
- **S-P2-06** "Combinar um horário" aparece com a nota "vai falar com você hoje" e com a "ainda não conseguiu"; cria uma mensagem do aplicativo (assunto "Combinar um horário") marcada como pedido de apoio. (tela 9) *Aceita.*
- **S-P2-07** Datas de outro ano mostram o ano ("ano só quando não é o corrente"). (telas 5, 8 e 9) *Aceita.*
- **S-P2-08** O prazo do pedido de revisão é de 15 dias corridos (`settings.dsrDeadlineDays`, o mesmo da equipe); o "10/11" do exemplo é o pedido do seed da Maria. (tela 9) *Aceita.*
- **S-P2-09** A autorização do piloto só aparece para quem já decidiu sobre ela ou está no piloto, e a pessoa só pode retirá-la (quem inclui no piloto é a equipe, S-12). (tela 21) *Aceita.*
- **S-P2-10** Os textos de efeito de retirar as autorizações que não são de saúde (números somados, família, imagem, WhatsApp, piloto) foram escritos na voz do aplicativo; a de saúde é o texto literal. Nenhum fala em plano (RN-PLN-19). (tela 21) *Aceita.*
- **S-P2-11** "Com quem os meus dados foram compartilhados" lista todos os pedidos de serviço da pessoa (nome do profissional e data), qualquer que seja a situação, e diz "Nada mais é compartilhado." (tela 21) *Aceita.*
- **S-P2-12** Cancelar a menos de 24 horas segue o núcleo (RN-ATD-16): a conversa vira falta e o horário não volta a ficar aberto; "Cancelada por você" com horário aberto vale para 24 horas ou mais. A folha diz isso antes. (tela 8) *Aceita.*
- **S-P2-13** Uma conversa registrada pela equipe por telefone ou WhatsApp aparece em "Suas mensagens" com a situação "Registrada pela equipe". (tela 19) *Aceita.*
- **S-P2-14** Sem sessão, "Ajuda agora" mostra o telefone como canal em destaque (não há preferência a respeitar e é o que funciona sem o aplicativo, RN-CAN-05). (tela 3) *Aceita.*
- **S-P2-15** "Não sei" em "O que você procura?" grava orientação psicológica (S-07) e a conversa passa a mostrar esse caráter. (tela 8) *Aceita.*

**P3 (Rede, Cartão, Meu plano, Grupos, Conteúdos)**

- **S-P3-01** **Decisão aceita.** O detalhe de grupo, a leitura de conteúdo e o quadro dos 4 planos abrem como **página** (trocam o conteúdo da própria tela; o `h1` passa a ser o da folha, com Voltar e foco no título) e não como `<dialog>` de tela cheia. Mantêm a URL (`?atividade=`, `?conteudo=`, `?ver=planos`), o botão Voltar do navegador fecha e não há segunda pilha de foco. As folhas de confirmação e de formulário curto usam o `app-cg-sheet`. (telas 10, 11 e 18)
- **S-P3-02** Em "Meus pedidos", um pedido antigo a um profissional que saiu da busca (suspenso, por exemplo) mantém o nome do profissional (é o histórico da própria pessoa) mas não leva à ficha. (tela 15) *Aceita.*
- **S-P3-03** "O que você já economizou" mostra "Neste mês: R$ {valor} em {n} compras." quando há compras no mês de hoje; sem compras no mês, "Neste mês: ainda sem compras com o cartão." e, havendo histórico, "Ao todo: R$ {valor} em {n} compras." (tela 16) *Aceita.*
- **S-P3-04** O tempo de leitura vem do texto (150 palavras por minuto, no mínimo 1 minuto). (tela 11) *Aceita.*
- **S-P3-05** **Decisão aceita.** Terapia de grupo: o cuidador **nunca entra sozinho**. A "indicação do psicólogo" é a inscrição feita pelo psicólogo (RN-GRP-14); sem ela a tela mostra a frase neutra e **Falar com a gente**, sem motivo clínico. Quem já foi inscrito pelo psicólogo vê "Você está no grupo." e pode sair. (tela 10)
- **S-P3-06** **Decisão aceita.** Subir de plano tem **dois passos** na mesma folha: o efeito (botão "Mudar para o Cuida") e, só na primeira contratação paga, "Antes de confirmar" com o aviso de emergência, a caixa "Li e entendi" e **Confirmar mudança de plano**. Sem a necessidade do aceite, o botão do efeito já confirma. Cancelar usa o botão de perigo suave com Voltar embaixo. (tela 18)
- **S-P3-07** A folha "Lado a lado" é uma grade que se ajusta à largura (colunas quando cabem, empilhadas no celular), em vez de "um profissional por vez com abas". (tela 13) *Aceita.*
- **S-P3-08** Frases novas onde o UX não deu texto: "Compare as opções por necessidade.", "N serviços para avaliar.", "Acompanhe os seus pedidos.", "Você já escolheu 3. Desmarque um para comparar outro.", "Ninguém atende em casa em {necessidade}" com "Ver todas as opções", "Pedido cancelado. Você pode pedir de novo quando quiser." e "Você saiu do grupo. A sua vaga voltou para outra pessoa." (telas 12, 13 e 15) *Aceita.*
- **S-P3-09** O cartão de bloqueio de conteúdo do Livre e a lista "Do seu plano" só aparecem se existir conteúdo exclusivo publicado. (tela 11) *Aceita.*
- **S-P3-10** Em "Meus pedidos", tocar num serviço concluído sem avaliação abre direto a folha de avaliação (a ação principal); os demais pedidos abrem os detalhes com as ações. (tela 15) *Aceita.*
- **S-P3-11** No quadro dos planos o botão de cada plano já diz o efeito ("Mudar para o Cuida", "Agendar mudança para o Essencial", "Agendar cancelamento"); o Livre, a partir de um plano pago, é o cancelamento. (tela 18) *Aceita.*
- **S-P3-12** Assinatura cancelada ou inexistente: a tela trata como Livre e, ao contratar, cria a assinatura nova em nome do cuidador (`reactivate` ou `startSubscription`). (tela 18) *Aceita.*
- **S-P3-13** Nos textos, a atividade se chama pelo tipo: "Entrar no grupo", "Entrar na capacitação", "Entrar na roda". (tela 10) *Aceita.*

## D.5 Pedidos ao líder (nada disto foi aplicado)

*Status na integração:* P-01 (ícones), P-02 (donos das telas), P-03 (contato da equipe, `core/rules/staff-contact.ts`), P-04 (decidido: página, S-P3-01), P-05 (seed, mais as conversas de Ana e Lourdes) e P-06 (`check-core.mjs`) foram atendidos. **P-07** (fonte oficial do CVV) e **P-08** (etapa de tamanho da letra no cadastro) seguem abertos.

1. **[P-01] Ícones.** Autorizar a Base a incluir 9 ícones do `lucide-static` 1.68.0 em `tools/build-icons.mjs` e regenerar `public/icons/sprite.svg`: `house`, `life-buoy`, `pill`, `video`, `frown`, `annoyed`, `meh`, `smile`, `laugh`. (Arquivos fora da posse da Base.)
2. **[P-02] Dono de cada tela.** O contexto não nomeia o dono de **Cuidar de mim (porta)**, **Mais (porta)**, **Meu perfil**, **Rede (porta)** e da **Entrada**. Sugestão: Entrada e Mais com a Base; Cuidar de mim com P2 (`care`); Rede com P3 (`network`); Meu perfil com P1 (`start`, mesmos campos do cadastro).
3. **[P-03] Estado do contato da equipe.** A nota de cuidado aparece em **Hoje (P1)** e em **Como estou (P2)**. Pedido: um serviço de núcleo pequeno, de posse da Base, que devolva só `staffContact: 'none' | 'today' | 'not_yet'` para o cuidador logado (sem pontuação, faixa ou nível), usado pelas duas telas. Assim Hoje nunca lê pontuação. Vale a regra de RN-ZRT-19 (o cuidador pode ver o resultado, mas só Como estou o mostra).
4. **[P-04] Rotas filhas para detalhe.** Se o líder preferir `/grupos/:id` e `/conteudos/:id` (rotas filhas) no lugar da folha de tela cheia com parâmetro `[S-21]`, a navegação do contexto muda e precisa de decisão.
5. **[P-05] Cobertura do seed para os testes.** Pedir à Base garantir nas pessoas de demonstração: (a) Ana com pelo menos 1 compromisso hoje, 1 em outro dia e 4 doses; (b) **um serviço concluído sem avaliação** (sugestão: Rita ou Ana) para o cartão "Avaliar"; (c) consentimento de **compartilhar com a família** concedido para uma pessoa e **não concedido** para outra; (d) pedido de revisão aberto de Maria com `dueAt`; (e) pedido de **eliminação aberto** em alguém da lista de 10 (hoje é Raimunda, `cg_0018`, que **não** está na lista); (f) uma mensagem por telefone registrada pela equipe para João; (g) o plano de Marcos com a data `scheduledChangeAt`.
6. **[P-06] Verificação de texto.** AC-CG-12 pede uma busca automática por travessão, "!" e palavras proibidas em `features/caregiver-app`. Pedir ao líder se ela entra em `scripts/check-core.mjs` ou num script novo (arquivo fora da posse de qualquer dev de área).
7. **[P-07] Fonte oficial do CVV.** Conferir com o jurídico ou na fonte oficial os dados do CVV (188, 24 horas, gratuito, chat em cvv.org.br) e do Disque 100 antes de qualquer uso fora do protótipo `[S-13]`.
8. **[P-08] Aviso de tamanho de letra no cadastro.** A etapa 3 de Começar mostra o seletor de tamanho da letra; se o líder quiser menos campos, esta é a primeira etapa a enxugar, mantendo o seletor em Mais.

## D.6 Riscos de implementação (para a Base e os devs)

- **Barra inferior em Bem grande**: o rótulo "Cuidar de mim" quebra em duas linhas e a barra cresce para 72 px; testar em 320 px também.
- **Teclado virtual**: a regra de esconder a barra usa `visualViewport`; em alguns navegadores móveis o evento atrasa. Testar com campo de texto em Falar com a Nexus e Pedir revisão.
- **`min()` dentro de `calc()`** em `--cg-fs-nav`: conferir a compilação do Sass; se falhar, escrever a expressão em CSS puro no `:root` do host.
- **Folha de baixo**: `<dialog>` com `showModal()` e animação de entrada; com movimento reduzido, nada desliza. Cuidar do foco que volta ao gatilho quando o gatilho foi removido do DOM (por exemplo, após "Tirar da agenda").
- **Clipboard**: o navegador embutido pode negar a área de transferência; o plano B (texto selecionado e instrução) faz parte dos critérios de aceite.
- **Mais de uma coluna em 1280 px**: Hoje é a **única** tela em duas colunas; as demais continuam em uma coluna de 640 a 960 px.
- **Humor e consentimento**: tudo que lê o humor ou a escala precisa checar a autorização de saúde na borda do serviço, não só na tela.
- **Contagem de dias dos pedidos de dados**: usar o relógio simulado (`Clock`), em dias corridos (RN-LGPD-21).

