# Sobreposições e gráficos (`shared/ui/overlay` e `shared/ui/charts`)

Tudo usa só as classes do design system (`src/styles`) e tokens. Importe pelos barris: `@shared/ui/overlay` e `@shared/ui/charts`. Ícone dentro destes componentes: `<svg appGlyph="nome"></svg>` (nas telas de módulo use o `IconComponent` da biblioteca, `appIcon`).

## Confirmação: `DialogService.confirm(...)` (guia de UX 5.8)

| Nível | Quando | Como |
|---|---|---|
| 0 | reversível e local | faz direto |
| 1 | reversível, baixo impacto | faz e mostra `toasts.show({ action: { label: 'Desfazer', run } })` |
| 2 | irreversível ou muda outros registros | `confirm({ level: 2, effects })` |
| 3 | destrói dado em massa | `confirm({ level: 3, typeToConfirm: 'APAGAR' })` |

```ts
const { confirmed, checkbox } = await this.dialogs.confirm({
  title: 'Descredenciar a Clínica Saúde Integral?',          // a pergunta com o objeto, nunca "Tem certeza?"
  message: 'O prestador sai da busca da rede.',
  effects: {
    erase: ['o perfil na busca'],                            // "Será eliminado"
    block: ['novas solicitações, porque o credenciamento acaba'], // "Ficará bloqueado"
    keep: ['o histórico de avaliações'],                     // "Continua registrado"
  },
  irreversibleNote: 'Não dá para desfazer.',
  confirmLabel: 'Descredenciar',                             // verbo com objeto; cancelar é "Voltar"
  checkbox: { label: 'Avisar o prestador por e-mail', checked: true },
  busyLabel: 'Descredenciando...',
  run: async () => { await this.service.deaccredit(id); },   // roda com o botão em carregamento; se lançar, o diálogo mostra o erro
});
```

Foco inicial no botão seguro (Voltar), Esc cancela e devolve o foco a quem abriu, vários pedidos entram em fila. Monte `<app-dialog-host />` uma vez (o `App` já faz).

## Toast: `ToastService`

```ts
this.toasts.show({ message: 'Disponibilidade salva.', action: { label: 'Desfazer', run: () => this.undo() } });
this.toasts.success('Sessão agendada para quinta, 06/11, às 14:00.');
```

6 s (10 s com "Desfazer"), pausa com mouse e foco, no máximo 2 empilhados, `Ctrl+Z` desfaz o mais recente. Frase começa pelo resultado. **Erro que exige leitura vai em `BannerComponent`, não em toast.**

## Faixa: `<app-banner>`

```html
<app-banner variant="attention" heading="Documento vence em 12 dias" [dismissible]="true">
  Peça o novo registro do conselho.
  <button bannerActions class="btn btn--sm">Ver documento</button>
</app-banner>
```

Variantes: `info`, `success`, `attention`, `danger`, `prototype`, `consent`. `liveRole` troca o papel ARIA.

## Gaveta: `<app-drawer>`

```html
<app-drawer [(open)]="detailOpen" heading="Solicitação do titular" subtitle="Recebida em 02/11/2026" [docked]="false">
  <dl class="dl">...</dl>
  <ng-container drawerFooter><button class="btn btn--primary">Atender</button></ng-container>
</app-drawer>
```

Modal por padrão (foco preso, Esc, clique fora). Com `[docked]="true"` fica acoplada à coluna da direita de `.layout-list-detail` (PD-02), sem modal; informe `[returnFocusTo]` com a linha de origem.

## Outros serviços e componentes

- `UiPrefsService`: tema, densidade, modo discreto, "Preencher com exemplo" (ver `layout/README.md`).
- `PageContextService`: título da aba e migalhas dinâmicos.
- `HARD_NAVIGATE`: recarga completa (usada ao apagar tudo); substitua em testes.
- `SessionDialogComponent` e `ConsentBannerComponent`: já montados no `App`.

## Gráficos (SVG feito à mão, sem biblioteca, cores só por token)

Todos têm `ariaLabel` (leitura em palavras), alternativa em tabela ("Ver como tabela") e legenda que muda de forma. Recorte com menos de 5 pessoas: `suppressed: true` (barra hachurada, sem número; a rosca esconde percentuais).

| Selector | Inputs principais |
|---|---|
| `app-bar-chart` | `data: { label, value, suppressed? }[]`, `ariaLabel`, `valueFormat`, `caption`, `positiveLabel`, `negativeLabel`, `referenceLine` |
| `app-line-chart` | `points`, `secondary?`, `ariaLabel`, `referenceLine`, `valueFormat`, `primaryLabel` |
| `app-area-chart` | `points` (saldo), `bars?` (resultado do mês), `referenceLine` (retorno), `valueFormat` |
| `app-donut-chart` | `segments: { label, value, color, suppressed? }[]`, `centerValue`, `centerLabel`, `ariaLabel` |
| `app-sparkline` | `values`, `ariaLabel`, `tone: 'blue' \| 'gold'` |
| `app-gauge-band` | `score` (0 a 88): termômetro das 4 faixas da Zarit |
| `app-heat-matrix` | `risks: { code, probability, impact }[]`: matriz 5 x 5 |
| `app-chart-legend` | `items: { label, color, shape? }[]` |

```html
<app-area-chart
  [points]="balanceByMonth" [bars]="resultByMonth" [valueFormat]="money"
  [referenceLine]="{ value: 0, label: 'Retorno do investimento (saldo zero)' }"
  ariaLabel="Resultado mensal e saldo acumulado em 12 meses" />
<app-gauge-band [score]="63" />
```

`valueFormat` recebe a função de formatação (por exemplo `formatMoney` para centavos). Passe a leitura em palavras sem número sensível quando o perfil for a gestão.
