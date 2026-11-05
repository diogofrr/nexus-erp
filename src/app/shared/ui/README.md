# Biblioteca de componentes (`src/app/shared/ui`)

Contrato para quem constrói um módulo. Os componentes são **standalone**, `OnPush`, com **signals** (`input()`, `output()`, `model()`), controle de fluxo novo, acessíveis (WCAG 2.2 AA), responsivos e fiéis ao design system (`docs/03-design-system.md`). Exemplo vivo de TODOS, com estados e dados de exemplo: rota `/app/_kit` (`src/app/features/kit`), que só existe em modo de desenvolvimento (`ng serve` e testes) e usa nomes genéricos ("Pessoa Exemplo 01"), nunca os do seed.

```ts
import { DataTableComponent, FormFieldComponent, NxInputDirective, PageHeaderComponent } from '@shared/ui';

@Component({ imports: [DataTableComponent, FormFieldComponent, NxInputDirective, PageHeaderComponent], /* ... */ })
```

Importe sempre do barril `@shared/ui` e liste só o que o template usa em `imports`. As sobreposições (diálogo, gaveta, toast, banners) e os gráficos têm barris próprios (`@shared/ui/overlay`, `@shared/ui/charts`), feitos pelo Dev Kit-B.

## 0. Convenções que valem para todos

- **Seletores com prefixo `app-`**: elementos (`<app-badge>`) e atributos (`appInput`, `appMask`, `appCell`, `appIcon`). Classes TypeScript terminam em `Component` ou `Directive`; as de formulário que nasceram com a marca mantêm `Nx` (`NxInputDirective`, `NxMaskDirective`, `NxValidators`).
- **Duas formas de ligar valor**: `[(x)]` em `model()` (`app-checkbox`, `app-switch`, `app-radio-group`, `app-rating`, `app-search-field`) e `formControl`/`formControlName` (todos são `ControlValueAccessor`). Formulários reativos tipados: `new FormControl<string | null>(null)`.
- **Estado nunca só por cor**: selo, faixa, vaga, critério e linha da ocupação sempre têm texto e ícone ou ponto.
- **Privacidade**: nada aqui revela dado. `app-masked-field` decide pelo perfil e grava no log; para a gestão o valor real nem entra no DOM. Filtros estruturados vão para a URL, o texto da busca nunca.
- **Tom**: textos acolhedores, sem travessão, sem "diagnóstico" nem "eficácia". Mensagens de erro em `ERROR_MESSAGES` (seção 7.4 do design system).
- **Classes do design system continuam valendo** (`.btn`, `.card`, `.stack`, `.cluster`, `.grid`, `.page`, `.form-grid`...). Os componentes só complementam. O CSS que faltava está em `src/styles/components/_kit-*.scss` (só tokens, nenhum hex).
- **Gotcha de layout**: `.stack` agora tem `grid-template-columns: minmax(0, 1fr)`; sem isso uma tabela larga dentro dele empurra a página para os lados. Contêiner que rola por dentro (`.table-wrap`, `.kanban`, `.agenda`) é `position: relative`.
- **Testes**: `pnpm exec ng test --watch=false --include 'src/app/shared/ui/**/*.spec.ts'`. Ajudantes em `src/app/shared/ui/testing/dom.ts` (`pick`, `typeInto`, `press`, `stubMatchMedia`, `loginAs`).

---

## 1. Formulários (`forms/`)

### `app-form-field` (`FormFieldComponent`)
Rótulo visível, dica ACIMA, erro ABAIXO, ligados ao controle por `for`, `aria-describedby`, `aria-invalid` e `aria-required`. O próprio host é o `.field` (funciona direto em `.form-grid`). O erro aparece quando o controle é inválido E tocado; depois, a cada tecla. Nunca limpa o que foi digitado.

| Input | Tipo | Para quê |
|---|---|---|
| `label` (obrigatório) | `string` | Rótulo visível |
| `hint` | `string` | Dica curta, acima do controle |
| `error` | `string \| null` | Erro explícito (servidor). Tem prioridade sobre o do controle |
| `optional` | `boolean` | Escreve "(opcional)". Obrigatório não leva asterisco |
| `group` | `boolean` | Rótulo de grupo (radio, caixas): usa `aria-labelledby` |
| `forceErrors` | `boolean` | Mostra os erros sem o campo ter sido tocado (depois de enviar) |
| `controlId` | `string` | Id do controle, para o resumo de erros apontar |

```html
<app-form-field label="CPF fictício" hint="Use um CPF fictício." controlId="cpf" [forceErrors]="submitted()">
  <input appInput appMask="cpf" formControlName="cpf" />
</app-form-field>
```
Dentro do campo NÃO ponha `id` no controle. Para o texto do erro do `required` no gênero certo use `NxValidators.required('a data de nascimento')`.

### `appInput` (`NxInputDirective`)
`input[appInput]`, `select[appInput]`, `textarea[appInput]`. Aplica `.input`, `.select` ou `.textarea` pela tag e liga o controle ao campo. Select e textarea são nativos (melhor no celular e no teclado).

```html
<select appInput formControlName="plan"><option value="livre">Livre</option></select>
<textarea appInput formControlName="note"></textarea>
```

### `appMask` (`NxMaskDirective`), em `input[appMask]` (use com `appInput`)
Máscara com `ControlValueAccessor` e validador. Aceita colar com ou sem pontuação, cuida do cursor.

| `appMask` | Valor no controle | Texto | Observação |
|---|---|---|---|
| `cpf` | `string` formatado | `000.123.456-00` | Incompleto vira erro `format` |
| `phone` | `string` formatado | `(34) 90000-0123` | Celular 11 dígitos (começa em 9), fixo 10 |
| `currency` | `number` **em centavos** ou `null` | `R$ 1.234,56` | Cada dígito entra pela direita |
| `number` | `number` ou `null` | `8,5` | `decimals`, `min`, `max`, `rangeMessage` |
| `date` | `ISODate` (`2026-11-04`) ou `null` | `04/11/2026` | Data que não existe vira erro `date` |

Inputs extras: `decimals`, `min`, `max`, `rangeMessage` (frase do erro de intervalo), `placeholder`.
```html
<input appInput class="input--num" appMask="number" min="0" max="24" rangeMessage="As horas por dia devem ser de 0 a 24." formControlName="hours" />
```

### Mensagens e validadores (`form-errors.ts`)
- `ERROR_MESSAGES`: catálogo 7.4 (`required(what)`, `format(subject, example)`, `minor`, `realCpf`, `email`, `phone`, `range(subject, min, max)`, `duplicate`, `system`).
- `NxValidators`: `required('o nome completo')`, `fictitiousCpf`, `fictitiousEmail`, `fictitiousPhone` (constantes), `adult(() => clock.today())`, `range(0, 24, 'As horas por dia')`, `unique(isTaken)` (fábricas). Ignoram vazio e incompleto; todos com a frase do catálogo.
- `fieldErrorMessage(errors, label)`: texto do primeiro erro de um controle (traduz os validadores nativos). Use para montar o resumo.

### `app-error-summary` (`ErrorSummaryComponent`)
Resumo no topo (`.error-summary`, `role="alert"`), com a MESMA frase do campo, cada item um link que foca o campo. Escondido sem erros; recebe o foco quando passa de vazio a cheio.
| Input | Tipo |
|---|---|
| `items` | `{ controlId: string; message: string }[]` |
| `autoFocus` | `boolean` (padrão `true`); método `focus()` |
```html
<app-error-summary [items]="errors()" />
```
```ts
errors = signal<ErrorSummaryItem[]>([]);
submit() { this.form.markAllAsTouched(); this.errors.set(fields.flatMap((f) => { const m = fieldErrorMessage(f.control.errors, f.label); return m ? [{ controlId: f.id, message: m }] : []; })); }
```

### Caixa, opção única, interruptor, nota, busca
| Seletor | Inputs | Valor | Exemplo |
|---|---|---|---|
| `app-checkbox` | `checked` (model), `indeterminate`, `hint`, `disabled` | `boolean` | `<app-checkbox formControlName="ok" hint="Opcional.">Aceito avisos</app-checkbox>` |
| `app-radio-group<T>` | `options` (`RadioOption<T>[]`), `legend`, `value` (model), `name` | `T \| null` (nada pré-marcado) | `<app-radio-group legend="Canal" [options]="channels" [(value)]="channel" />` |
| `app-switch` | `checked` (model), `disabled`; método `sync()` | `boolean` | `<app-switch [(checked)]="auto">Avançar automaticamente ao responder</app-switch>` |
| `app-rating` | `value` (model), `label`, `ends` | `number \| null` (1 a 5) | `<app-rating label="Nota do atendimento" formControlName="score" />` |
| `app-search-field` | `value` (model), `label`, `placeholder`; output `searched` | `string` | `<app-search-field label="Buscar cuidador" [(value)]="term" />` |

`RadioOption<T> = { value: T; label: string; hint?: string; disabled?: boolean }`. Em grupo dentro de campo: `<app-form-field label="Canal" group>` e omita `legend`. `app-rating` mostra "Ruim" e "Excelente" nas pontas e nunca só estrelas.

### `app-masked-field` (`MaskedFieldComponent`), PD-13
Valor mascarado (`maskValue` de `@core/privacy`) com botão **Mostrar** (ícone E texto). Quem pode revelar (atendimento, psicólogo do caso, RT) escolhe um **motivo pronto** (ou "Outro", mínimo 10 caracteres), o valor aparece por **30 s** com contagem e volta a ser mascarado sozinho; grava `AuditLogService.reveal`. **Sem botão de copiar**, texto não selecionável enquanto mascarado, sai mascarado na impressão. A gestão (`partner`) vê só `CUI-0000`; o credenciado e o psicólogo de outro caso veem só o mascarado, sem botão.

| Input | Tipo | |
|---|---|---|
| `kind` (obr.) | `'cpf' \| 'phone' \| 'email' \| 'name'` | Tipo da máscara |
| `value` | `string \| null` | Valor real (vazio mostra "Não informado") |
| `label` (obr.) | `string` | "CPF", "Telefone" (leitor de tela e título) |
| `entity`, `entityId`, `field` (obr.) | `string` | Gravados no log (`caregiver`, `cg_0042`, `cpf`) |
| `subjectId` | `string` | Titular (id do cuidador) no log |
| `code` | `string` | Código da gestão; sem ele deriva de `entityId` |
| `resource` | `Resource` | Padrão `caregiver_registry` |
| `own` | `boolean` | Psicólogo só revela dos casos dele: `false` para caso de outro |
| `seconds` | `number` | Padrão 30 |
| Outputs | `revealed` `{ field, reason }`, `remasked` | |
```html
<app-masked-field kind="cpf" label="CPF" [value]="cg.cpf" entity="caregiver" [entityId]="cg.id" field="cpf" [subjectId]="cg.id" [own]="isMine" />
```
Em fichas use junto de `app-description-list` (item com `template`).

### `app-consent-toggle` (`ConsentToggleComponent`), LP-04 a LP-06
Uma linha `.consent` por finalidade, ligada ao `ConsentService`: pergunta em linguagem simples, selo (Ativo, Recusado, Revogado, Pendente, Desatualizado), versão, data, "Ver histórico" e os 5 itens do esqueleto em "Ver detalhes" (`CONSENT_COPY`). Nada vem pré-marcado. **Ligar concede** (grava evento e log). **Desligar NÃO revoga sozinho**: emite `revokeRequested` com os efeitos para você abrir o diálogo de efeito e chamar `ConsentService.revoke` (ou o método `revoke()` do componente).
| Input | Tipo |
|---|---|
| `caregiverId`, `key` (obr.) | `ID`, `ConsentKey` |
| `channel` | `Channel \| 'in_person'` (padrão `in_person`) |
| `readonly` | `boolean` (sem permissão: interruptor desabilitado) |
| `autoRevoke` | `boolean` (revoga direto, sem diálogo) |
| Outputs | `changed` (`ConsentChangeResult`), `revokeRequested` (`{ key, effects }`), `historyRequested` (`ConsentKey`) |
```html
<app-consent-toggle [caregiverId]="cg.id" key="whatsapp_contact" (revokeRequested)="askRevoke($event)" (historyRequested)="openHistory($event)" />
```

### `DraftService` (rascunho automático, UX 5.12)
`providedIn: 'root'`. Chave `nexus-erp:draft:<form>:<usuário>:<id>` pelo `StorageService`; por usuário (fica ao trocar de perfil). `keyOf`, `load<T>(form, id)`, `save(form, id, data)`, `clear(form, id)`, `describe(record)` ("hoje, 14:32"). Apague ao concluir. **Sem consentimento de saúde não salve rascunho da Zarit** (RN-ZRT-07): o `app-wizard` só salva se você passar `draftForm`.

---

## 2. Dados (`data/`)

### `app-data-table<T>` (`DataTableComponent`), PD-01
Tabela genérica. Colunas declarativas, modelos de célula, ordenação em 3 estados, busca sem acento, seleção com barra de lote, paginação ou rolagem, densidade, estados e contagem sempre visível. Abaixo de 768 px as linhas viram **cartões com `data-label`** (a ordenação e o "selecionar todos" vão para a barra de ferramentas; a paginação vira "Carregar mais 25"). Tabelas de comparação entre colunas (projeção, log, matriz) não: `[stack]="false"`.

| Input | Tipo | |
|---|---|---|
| `rows`, `columns`, `caption` (obr.) | `T[]`, `TableColumn<T>[]`, `string` | `caption` é lida por leitor de tela |
| `noun` | `string` | "cuidadores" (contagem e vazio) |
| `state` | `'ready' \| 'loading' \| 'error' \| 'forbidden'` | Esqueleto, erro com "Tentar de novo", sem permissão |
| `rowKey` | `(row, index) => string \| number` | Padrão `row.id`, senão o índice |
| `rowLabel` | `(row) => string` | "Selecionar CUI-0042". Padrão: coluna `primary` |
| `searchable`, `searchLabel`, `searchPlaceholder`, `search` (model) | | Busca local, sem acento |
| `selectable`, `selection` (model) | `(string \| number)[]` | Chaves selecionadas |
| `sort` (model) | `TableSort \| null` | `{ key, direction: 'asc' \| 'desc' }` |
| `paging`, `page` (model), `pageSize` (model), `pageSizes`, `maxHeight` | `'pages' \| 'scroll'` | Padrão páginas de 25 |
| `density` (model), `densityToggle` | `'comfortable' \| 'compact'` | |
| `rowClickable` | `boolean` | Clique ou Enter abrem; setas, Home e End movem o foco |
| `filtersActive` | `boolean` | Há chips externos ativos (muda o texto do vazio) |
| `emptyTitle`, `emptyText`, `errorText`, `forbiddenText`, `stack` | | Textos e modo cartão |
| Outputs | `rowClick` (`T`), `retry`, `filtersCleared` | |

Colunas (`TableColumn<T>`): `key`, `header`, `value?`, `sortable?`, `sortValue?`, `searchText?`, `noSearch?`, `align?: 'start' \| 'end'` (números e dinheiro à direita), `primary?`, `muted?`, `actions?` (última coluna: uma ação com texto, o resto num menu), `mobileLabel?`.

Conteúdo projetado: `[appTableFilters]` (chips), `[appTableActions]` (exportar...), `[appBulkActions]` (só ações seguras ou reversíveis: exportar, marcar como visto; nunca excluir, anonimizar ou descredenciar em lote). Modelos de célula: `<ng-template appCell="chave" let-row let-value="value" let-selecting="selecting">` (`selecting`: há linhas marcadas, desabilite as ações da linha).

```html
<app-data-table caption="Cuidadores cadastrados" noun="cuidadores" [rows]="rows()" [columns]="columns" [state]="state()"
                searchable selectable rowClickable [sort]="list.sort()" (sortChange)="list.setSort($event)" (rowClick)="open($event)">
  <app-filter-chips appTableFilters label="Plano" [options]="plans" [value]="plan()" (valueChange)="list.setFilter('plano', $event)" />
  <ng-template appCell="plan" let-row><app-plan-badge [plan]="row.planId" /></ng-template>
</app-data-table>
```
Estado vazio: dois tipos automáticos (sem itens e "Nada encontrado" com "Limpar filtros"). Ao receber `filtersCleared`, limpe também os chips.

### `th[appSortHeader]` (`SortHeaderComponent`)
Cabeçalho ordenável para quem monta `<table class="table">` à mão (a tabela de dados já usa). É componente de atributo porque desenha o botão `.th-sort`. `appSortHeader` (chave), `sort`, output `sortChange` (`TableSort \| null`). Põe `aria-sort`; só a coluna ordenada troca o ícone.
```html
<th appSortHeader="name" [sort]="sort()" (sortChange)="sort.set($event)">Cuidador</th>
```

### `app-pagination`
`total` (obr.), `page` (model, de 1), `pageSize` (model), `pageSizes` (padrão `[25, 50, 100]`), `noun`, `summary` ("Mostrando 1 a 25 de 340 cuidadores"). `aria-current="page"`, reticências, "Por página". Sem rolagem infinita em tabela.
```html
<app-pagination [total]="340" [(page)]="page" [(pageSize)]="size" noun="cuidadores" summary />
```

### `app-filter-chips` e `app-active-filters`
- `app-filter-chips`: `options` (`FilterOption[]` = `{ value, label, count?, disabled? }`), `label` (obr., nome do grupo), `value` (model, `null` = Todos), `multiple` + `values` (model), `allLabel` (padrão "Todos"), `allCount`. `aria-pressed` em cada chip.
- `app-active-filters`: `filters` (`{ key, label }[]`), outputs `removed` (chave), `cleared`. Chips removíveis e "Limpar filtros".

### `createListState` (U-05), filtros e ordem na URL
Chame em contexto de injeção. Guarda filtros, ordem e página em `?plano=cuida&ordem=name:desc&pagina=2` (replaceUrl, sem empilhar histórico) e **restaura ao voltar** sem parâmetros (lembra na sessão). O **texto da busca não vai à URL** (fica em memória e na sessão).
```ts
readonly list = createListState({ key: 'caregivers', filterKeys: ['plano', 'status'], defaultSort: { key: 'name', direction: 'asc' } });
// list.filters(), list.sort(), list.page(), list.search (signal gravável), list.hasActive()
// list.setFilter('plano', 'cuida' | null), list.setSort(s), list.setPage(n), list.clear()
```
Utilitários puros (`table-utils.ts`): `sortRows`, `filterRows`, `nextSort`, `normalizeText`, `pageCount`, `clampPage`, `pageItems`.

---

## 3. Apresentação (`display/`)

### Ícone, selos, chip, avatar
| Seletor | Inputs | Exemplo |
|---|---|---|
| `svg[appIcon]` (`IconComponent`) | `appIcon` (`IconName`), `size` (`sm \| md \| lg \| xl`), `label` | `<svg appIcon="calendar" size="sm"></svg>`. Decorativo por padrão; com `label` vira imagem. `ICON_NAMES` lista os 110 ícones do sprite |
| `app-badge` | `variant` (`neutral success attention danger info gold plan-* zarit-*`), `icon`, `dot`, `outline`, `large` | `<app-badge variant="success" icon="award">Em destaque</app-badge>` |
| `app-plan-badge` | `plan` (`PlanId`), `large` | `<app-plan-badge plan="cuida" />` (ponto mais nome) |
| `app-zarit-band-badge` | `band` ou `score`, `long`, `large` | `<app-zarit-band-badge [score]="63" />` vira "Severa · 63" com octógono. Só para quem vê o resultado individual |
| `app-deadline-badge` | `due` (obr.), `unit` (`business-hours \| days`), `done`, `warnAt` | `<app-deadline-badge [due]="msg.dueAt" />` ("No prazo", "Faltam 1 h 20 min úteis", "Atrasada há 6 h úteis"); horário absoluto em `title` e leitor de tela; focável |
| `app-chip` | `pressed` (model), `count`, `disabled` | `<app-chip [(pressed)]="late" [count]="3">Atrasadas</app-chip>` |
| `app-avatar` | `name`, `size`, `gold`, `nav`, `pseudonymized` | `<app-avatar name="Ana Paula Ferraz" />` (iniciais; `pseudonymized` mostra ícone neutro) |

`businessDeadlineView(due, now)` e `calendarDeadlineView(due, today)` são as contas puras do selo de prazo.

### Cartão, indicadores, medidores
| Seletor | Inputs | Exemplo |
|---|---|---|
| `app-card` | `title`, `subtitle`, `padded`, `variant` (`default sunken raised interactive`); slots `[appCardActions]`, `[appCardFooter]` | `<app-card title="Plano"><div appCardFooter>...</div></app-card>`. Nunca cartão dentro de cartão |
| `app-kpi-strip` + `app-kpi` | `label` (obr.), `value`, `unit`, `context`, `delta` (`{ text, tone, direction }`), `link`, `suppressed`; conteúdo = sparkline ou medidor | `<app-kpi label="Assinantes" value="17" [delta]="{ text: '+2 desde outubro', tone: 'good', direction: 'up' }" />`. `suppressed` mostra "menos de 5" com cadeado (RN-KPI-02) |
| `app-meter` | `label`, `value`, `target` (obr.), `max`, `unit` | `<app-meter label="Ponto de equilíbrio" [value]="17" [target]="27" unit="assinantes" />` ("17 de 27", faltam 10, texto equivalente) |
| `app-occupancy-bar` | `name`, `percent` (obr., `null` = n/d), `limit` (80) | Acima do limite muda a cor E ganha ícone |
| `app-progress` | `label`, `value` (obr.), `max`, `large`, `tone` | `role="progressbar"` |

### Estados
| Seletor | Inputs | |
|---|---|---|
| `app-empty-state` | `title` (obr.), `text`, `kind` (`empty error forbidden private`), `compact`; ações = conteúdo | Vazio com as mãos da marca; erro com `role="alert"`; `private` para "menos de 5" |
| `app-skeleton` | `variant` (`text title value circle block`), `lines` | Decorativo: marque a região com `aria-busy="true"` |
| `app-placeholder-line` | `reason` (`hidden no-result small-group other-psychologist`), `text` | Cadeado e frase curta (UX 6.3), nunca célula em branco |

### Cabeçalho, migalhas, abas, segmentado
| Seletor | Inputs | Exemplo |
|---|---|---|
| `app-page-header` | `title` (obr.), `description`, `count`, `breadcrumbs`; ações = conteúdo | `<app-page-header title="Cuidadores" count="340 cuidadores"><button class="btn btn--primary">Novo</button></app-page-header>` (um `h1` por tela, linha dourada) |
| `app-breadcrumb` | `items` (`{ label, link? }[]`) | O último item é a página atual |
| `app-tabs` | `tabs` (`{ id, label, badge?, icon?, disabled?, disabledReason? }[]`), `label` (obr.), `selected` (model) | O painel é o conteúdo: `@switch (tab()) { @case ('resumo') { ... } }`. Setas, Home e End; guarde `selected` na URL (`?aba=`) |
| `app-segmented<T>` | `options` (`{ value, label, icon? }[]`), `label` (obr.), `value` (model) | Grupo de opção única, setas, Home e End |

### Ficha, histórico, critérios, etapas
| Seletor | Inputs | |
|---|---|---|
| `app-description-list` | `items` (`{ label, value?, template? }[]`), `emptyText` | `.dl`. Vazio vira "Não informado"; `template` aceita `app-masked-field` |
| `app-timeline` | `items` (`{ title, text?, at?, timeLabel?, tone? }[]`), `label` | Histórico append-only; o tom também vai em texto |
| `app-checklist` | `items` (`{ id, title, text?, state: 'ok pending fail na', badge? }[]`), `label` | `checklistMissing(items)` dá o "Faltam N critérios" do botão Aprovar |
| `app-stepper` | `steps` (`{ id, label }[]`), `current` (índice, obr.), `label` | **Só indicativo**, nunca clicável. No celular vira "Etapa 2 de 5: Pessoa idosa" com barra |

### `app-wizard` (`WizardComponent`), um item por tela (Zarit)
Cabeçalho "Item 7 de 22" com progresso e "Rascunho salvo às 14:32", pergunta em serifa, opções grandes (rádio nativo, 56 px no celular), mapa dos itens (recolhido no celular), rodapé fixo (Voltar, Salvar e sair, Próximo; no último item, Concluir com aviso do que falta). Teclas `0` a `4` respondem e `←` `→` mudam de item (não disparam dentro de campo). "Avançar automaticamente ao responder" é opcional.

| Input | |
|---|---|
| `items` (obr.) | `{ id, question, hint?, options: { value, label, key? }[] }[]` (até 5 opções) |
| `answers` (model) | `Record<id, number \| string>` |
| `index` (model) | Item atual (de 0) |
| `draftForm`, `draftId` | Com `draftForm` salva rascunho a cada resposta e oferece "Retomar rascunho / Começar de novo" |
| `hotkeys`, `autoAdvance` (model), `autoAdvanceToggle`, `finishLabel`, `itemLabel` | |
| Outputs | `completed` (respostas), `exited` ("Salvar e sair") |
```html
<app-wizard [items]="items" [(answers)]="answers" draftForm="zarit" [draftId]="caregiverId" (completed)="finish($event)" (exited)="leave()" />
```

### `app-kanban-board<T>` (`KanbanBoardComponent`), PD-06, somente leitura
Colunas = estados, cartões = itens; **sem arrastar**. No celular vira acordeão (botão `aria-expanded`). `columns` (`{ id, label, items }[]`), `emptyText` ("Nenhum processo aqui."), output `cardOpened` (`{ item, columnId }`). O cartão é um modelo: mostre o nome e uma frase do que FALTA.
```html
<app-kanban-board [columns]="columns" (cardOpened)="open($event.item)">
  <ng-template appKanbanCard let-item><strong>{{ item.name }}</strong><span class="t-caption">{{ item.missing }}</span></ng-template>
</app-kanban-board>
```

### `app-week-agenda` (`WeekAgendaComponent`), PD-07
Seg a sex, hora a hora. Computador: grade `role="grid"` (setas movem entre vagas, Enter abre, hoje em destaque, linha do "agora", legenda em texto, contagem de vagas abertas). Celular: **visão do dia** com seletor de dias e lista de vagas.
| Input | |
|---|---|
| `days` (obr.) | As 5 datas (`ISODate[]`) |
| `slots` (obr.) | `{ id, date, time: 'HH:mm', status, label?, detail? }[]`; `status`: `open booked confirmed priority blocked done noshow` (cada um com ícone e texto) |
| `caption` (obr.) | Nome da grade ("Agenda da semana de 02 a 06 de novembro") |
| `startHour`, `endHour`, `today`, `selectedDay` (model) | Padrão 8 a 18; `today` vem do `Clock` |
| Output | `slotSelected` (`AgendaSlot`); vaga `blocked` não emite |

`label` já deve vir mascarado ou pseudonimizado pelo chamador (só mostre o nome a quem pode).

---

## 4. Receitas

**Lista com filtros (PD-01)**: `createListState` + `app-page-header` (contador) + `app-filter-chips` dentro de `[appTableFilters]` + `app-data-table` (`searchable selectable rowClickable`) + `app-active-filters`. Filtros e ordem na URL; busca em memória.

**Ficha com abas (PD-03)**: `app-page-header` com migalhas (código `CUI-0042` para a gestão), `app-tabs` com `selected` na URL (`?aba=`), aba sem permissão `disabled` com `disabledReason`, dado sensível em `app-description-list` com `app-masked-field`.

**Formulário longo (PD-04, UX 5.9 a 5.12)**: `app-error-summary` no topo, `.form-grid` com `app-form-field`, `NxValidators`, `form-actions` com "Rascunho salvo às 10:42" à esquerda e a ação primária que diz o resultado. Ao enviar: `markAllAsTouched()` e `[forceErrors]="true"`.

**Estados de bloco**: carregando = `app-skeleton` dentro de `aria-busy`; vazio = `app-empty-state`; erro = `kind="error"` com "Tentar de novo"; sem permissão = `kind="forbidden"` com texto neutro; agregado pequeno = `kind="private"` ou `app-kpi suppressed`.

## 5. O que NÃO está aqui

Diálogo, gaveta, toast, banners e os gráficos SVG (`overlay/` e `charts/`, Dev Kit-B). Calendário de escolha de data (a data se digita; `appMask="date"`). Menu "Mais ações" da última coluna da tabela (use `.menu` do design system com `@angular/cdk/overlay` ou o atributo `popover`). Arrastar no quadro (de propósito, WCAG 2.5.7).
