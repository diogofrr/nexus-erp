import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Clock } from '@core/clock';
import type { ZaritBand } from '@core/models';
import { ZARIT_ANSWER_LABELS, ZARIT_DEMO_ITEMS } from '@core/rules';
import {
  AgendaSlot,
  AvatarComponent,
  BadgeComponent,
  CardComponent,
  CardFooterDirective,
  ChecklistComponent,
  ChecklistItem,
  ChipComponent,
  DeadlineBadgeComponent,
  EmptyStateComponent,
  ICON_NAMES,
  IconComponent,
  KanbanBoardComponent,
  KanbanCardDirective,
  KanbanColumn,
  KpiComponent,
  KpiStripComponent,
  MeterComponent,
  OccupancyBarComponent,
  PlaceholderLineComponent,
  PlanBadgeComponent,
  ProgressComponent,
  SegmentOption,
  SegmentedComponent,
  SkeletonComponent,
  StepperComponent,
  TabItem,
  TabsComponent,
  TimelineComponent,
  TimelineItem,
  WeekAgendaComponent,
  WizardAnswers,
  WizardComponent,
  WizardItem,
  ZaritBandBadgeComponent,
} from '@shared/ui';
import { sampleSlots, weekDays } from './kit.data';

interface Process {
  name: string;
  specialty: string;
  missing: string;
}

/** Apresentação do kit: selos, cartões, indicadores, estados, navegação, quadro, agenda e assistente. */
@Component({
  selector: 'app-kit-display',
  imports: [
    AvatarComponent,
    BadgeComponent,
    CardComponent,
    CardFooterDirective,
    ChecklistComponent,
    ChipComponent,
    DeadlineBadgeComponent,
    EmptyStateComponent,
    IconComponent,
    KanbanBoardComponent,
    KanbanCardDirective,
    KpiComponent,
    KpiStripComponent,
    MeterComponent,
    OccupancyBarComponent,
    PlaceholderLineComponent,
    PlanBadgeComponent,
    ProgressComponent,
    SegmentedComponent,
    SkeletonComponent,
    StepperComponent,
    TabsComponent,
    TimelineComponent,
    WeekAgendaComponent,
    WizardComponent,
    ZaritBandBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stack stack--8' },
  template: `
    <section class="stack stack--6" aria-labelledby="kit-badges-title">
      <div class="section-head">
        <h2 id="kit-badges-title">Selos, chips e avatar</h2>
        <p>Todo selo tem texto mais ícone ou ponto. Estado nunca depende só de cor.</p>
      </div>
      <div class="card card--pad stack stack--6">
        <div class="cluster">
          <app-badge variant="success" icon="circle-check">Ativo</app-badge>
          <app-badge variant="attention" icon="triangle-alert">Pendente</app-badge>
          <app-badge variant="danger" icon="ban">Suspenso</app-badge>
          <app-badge variant="info" icon="info">Em análise</app-badge>
          <app-badge variant="gold" icon="star">Vaga prioritária</app-badge>
          <app-badge outline dot>Recusado</app-badge>
          <app-badge variant="success" icon="award" large>Em destaque</app-badge>
        </div>
        <div class="cluster">
          @for (plan of plans; track plan) { <app-plan-badge [plan]="plan" /> }
          <app-plan-badge plan="sustenta" large />
        </div>
        <div class="cluster">
          @for (band of bands; track band.score) { <app-zarit-band-badge [score]="band.score" /> }
          <app-zarit-band-badge band="severe" long />
        </div>
        <div class="cluster">
          @for (view of deadlines; track view.due) { <app-deadline-badge [due]="view.due" [unit]="view.unit" [done]="view.done" /> }
        </div>
        <div class="cluster">
          <app-avatar name="Pessoa Exemplo" size="sm" />
          <app-avatar name="Dra. Beatriz Nogueira" />
          <app-avatar name="Cecília Braga" size="lg" gold />
          <app-avatar pseudonymized />
          <div class="chip-group">
            <app-chip [(pressed)]="chipA" [count]="3">Atrasadas</app-chip>
            <app-chip [(pressed)]="chipB">Minhas</app-chip>
            <app-chip disabled>Sem permissão</app-chip>
          </div>
        </div>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-kpi-title">
      <div class="section-head">
        <h2 id="kit-kpi-title">Indicadores e medidores</h2>
        <p>Número sempre com contexto. Agregado de saúde abaixo do mínimo mostra "menos de 5".</p>
      </div>
      <app-kpi-strip aria-label="Indicadores do mês">
        <app-kpi label="Assinantes" value="17" [delta]="{ text: '+2 desde outubro', tone: 'good', direction: 'up' }">
          <svg class="spark kpi__spark" viewBox="0 0 104 32" aria-hidden="true"><path d="M2 26 L18 22 L34 24 L50 16 L66 18 L82 9 L100 6" /><circle cx="100" cy="6" r="2.5" /></svg>
        </app-kpi>
        <app-kpi label="Conversão" value="5,0%" context="meta 3%, 5%, 7%" />
        <app-kpi label="Resultado do mês" value="-R$ 843,51" link="/app/financeiro" context="Ver financeiro" [delta]="{ text: 'queda de 4,2%', tone: 'bad', direction: 'down' }" />
        <app-kpi label="Zarit severa (grupo)" value="" suppressed />
      </app-kpi-strip>
      <div class="grid grid--2 grid--gap-6">
        <div class="card card--pad stack stack--6">
          <app-meter label="Ponto de equilíbrio" [value]="17" [target]="27" unit="assinantes" />
          <app-progress label="6 de 22 itens respondidos" [value]="6" [max]="22" large />
        </div>
        <div class="card card--pad stack stack--6">
          <app-occupancy-bar name="Dr. Rafael Moreira" [percent]="91.3" />
          <app-occupancy-bar name="Dra. Letícia Amaral" [percent]="80" />
          <app-occupancy-bar name="Dra. Beatriz Nogueira" [percent]="70" />
          <app-occupancy-bar name="Dr. Tiago Brandão" [percent]="null" />
        </div>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-states-title">
      <div class="section-head">
        <h2 id="kit-states-title">Estados: vazio, erro, sem permissão, carregando</h2>
        <p>Toda lista e todo bloco têm os quatro. Vazio nunca é tabela em branco.</p>
      </div>
      <div class="grid grid--2 grid--gap-6">
        <div class="card">
          <app-empty-state compact title="Nenhum alerta aberto por aqui" text="Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila para você acompanhar.">
            <button type="button" class="btn btn--primary">Aplicar a escala</button>
            <button type="button" class="btn">Ver histórico</button>
          </app-empty-state>
        </div>
        <div class="card">
          <app-empty-state compact kind="error" title="Não foi possível carregar os indicadores" text="Tente de novo. Se continuar, avise a equipe.">
            <button type="button" class="btn">Tentar de novo</button>
          </app-empty-state>
        </div>
        <div class="card">
          <app-empty-state compact kind="forbidden" title="Disponível só para o psicólogo do caso" text="O acesso a este conteúdo é restrito. Fale com a responsável técnica se precisar dele." />
        </div>
        <div class="card">
          <app-empty-state compact kind="private" title="Menos de 5 pessoas" text="Por privacidade, não mostramos o número nem a barra." />
        </div>
      </div>
      <div class="grid grid--2 grid--gap-6">
        <div class="card card--pad stack stack--6" aria-busy="true" aria-label="Carregando">
          <div class="cluster"><app-skeleton variant="circle" /><app-skeleton class="flex-1" [lines]="2" /></div>
          <app-skeleton variant="title" />
          <app-skeleton [lines]="3" />
          <app-skeleton variant="block" />
        </div>
        <div class="card card--pad stack stack--3">
          <h3>Placeholder para o que o perfil não vê</h3>
          <div><app-placeholder-line /></div>
          <div><app-placeholder-line reason="no-result" /></div>
          <div><app-placeholder-line reason="small-group" /></div>
          <div><app-placeholder-line reason="other-psychologist" /></div>
        </div>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-nav-title">
      <div class="section-head">
        <h2 id="kit-nav-title">Cartão, abas, segmentado, histórico e critérios</h2>
        <p>Abas e segmentado respondem a setas, Home e End. A linha dourada marca a aba atual.</p>
      </div>
      <div class="grid grid--2 grid--gap-6">
        <app-card title="Plano e cartão" subtitle="Cuida, desde 12/03/2026">
          <button appCardActions type="button" class="btn btn--sm">Trocar plano</button>
          <app-tabs label="Ficha do cuidador" [tabs]="tabs" [(selected)]="tab">
            @switch (tab()) {
              @case ('resumo') { <p>Resumo do caso, com o cartão "Precisa de atenção" antes dos dados.</p> }
              @case ('plano') { <p>Plano, benefícios e Cartão Nexus.</p> }
              @case ('consent') { <p>Os seis consentimentos, um por cartão.</p> }
            }
          </app-tabs>
          <div appCardFooter>Próximo ciclo em 12/12/2026</div>
        </app-card>
        <div class="card card--pad stack stack--6">
          <app-segmented label="Visão da agenda" [options]="views" [(value)]="view" />
          <p class="t-ui" aria-live="polite">Visão escolhida: {{ view() === 'week' ? 'semana' : 'mês' }}.</p>
          <app-timeline label="Histórico de consentimento" [items]="timeline" />
        </div>
      </div>
      <div class="grid grid--2 grid--gap-6">
        <div class="card card--pad stack stack--3">
          <h3>Credenciamento: 5 critérios</h3>
          <app-checklist label="Critérios de credenciamento" [items]="criteria" />
          <div class="cluster">
            <button type="button" class="btn btn--primary" aria-disabled="true">Aprovar</button>
            <span class="t-ui">Faltam {{ missing() }} critérios</span>
          </div>
        </div>
        <div class="card card--pad stack stack--6">
          <h3>Cadastro em etapas</h3>
          <div class="cluster">
            <button type="button" class="btn btn--sm" [disabled]="step() === 0" (click)="step.set(step() - 1)">Voltar</button>
            <button type="button" class="btn btn--sm btn--primary" [disabled]="step() === steps.length - 1" (click)="step.set(step() + 1)">Continuar</button>
          </div>
          <app-stepper label="Cadastro de cuidador" [steps]="steps" [current]="step()" />
        </div>
      </div>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-board-title">
      <div class="section-head">
        <h2 id="kit-board-title">Quadro de estados (somente leitura)</h2>
        <p>Sem arrastar. No celular vira acordeão: toque no título do estado para recolher.</p>
      </div>
      <app-kanban-board [columns]="columns" (cardOpened)="board.set($event.item.name)">
        <ng-template appKanbanCard let-item>
          <strong>{{ item.name }}</strong>
          <span class="t-caption">{{ item.specialty }}</span>
          <app-badge variant="attention" icon="clock">{{ item.missing }}</app-badge>
        </ng-template>
      </app-kanban-board>
      <p class="t-ui" role="status">{{ board() ? 'Abriria a decisão de ' + board() + '.' : 'Clique num cartão para abrir a decisão.' }}</p>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-agenda-title">
      <div class="section-head">
        <h2 id="kit-agenda-title">Agenda semanal</h2>
        <p>Setas movem entre vagas, Enter abre. No celular entra a visão do dia, sem grade espremida.</p>
      </div>
      <app-week-agenda [caption]="agendaCaption()" [days]="week()" [slots]="slots()" (slotSelected)="picked.set($event)" />
      <p class="t-ui" role="status">{{ pickedText() }}</p>
    </section>

    <section class="stack stack--6" aria-labelledby="kit-wizard-title">
      <div class="section-head">
        <h2 id="kit-wizard-title">Assistente de um item por tela</h2>
        <p>Teclas 0 a 4 respondem, setas mudam de item. O rascunho fica guardado por usuário e é oferecido ao voltar.</p>
      </div>
      @if (wizardResult(); as result) {
        <div class="banner banner--success" role="status">
          <div class="banner__body">
            <span class="banner__title">Escala concluída (exemplo)</span>
            <span class="banner__text">Total: {{ result }} de {{ wizardItems.length * 4 }} pontos. Nada foi gravado.</span>
            <span class="banner__actions"><button type="button" class="btn btn--sm" (click)="wizardResult.set(null)">Aplicar de novo</button></span>
          </div>
        </div>
      } @else {
        <app-wizard [items]="wizardItems" [(answers)]="answers" draftForm="kit-zarit" draftId="demo" (completed)="finishWizard($event)" />
      }
    </section>

    <section class="stack stack--6" aria-labelledby="kit-icons-title">
      <div class="section-head">
        <h2 id="kit-icons-title">Ícones</h2>
        <p>Sprite local (lucide), {{ icons.length }} ícones. Use <code>&lt;svg appIcon="nome"&gt;&lt;/svg&gt;</code>.</p>
      </div>
      <ul class="grid grid--auto card card--pad" role="list" style="--min-col: 9rem">
        @for (name of icons; track name) {
          <li class="cluster t-ui"><svg [appIcon]="name"></svg><code>{{ name }}</code></li>
        }
      </ul>
    </section>
  `,
})
export class KitDisplaySection {
  private readonly clock = inject(Clock);

  protected readonly plans = ['livre', 'essencial', 'cuida', 'sustenta'] as const;
  protected readonly bands: { score: number; band?: ZaritBand }[] = [{ score: 12 }, { score: 33 }, { score: 52 }, { score: 63 }];
  protected readonly icons = ICON_NAMES;

  protected readonly chipA = signal(true);
  protected readonly chipB = signal(false);

  /** Prazos de exemplo relativos a "agora" do `Clock` (real ou simulado). */
  protected readonly deadlines = this.buildDeadlines();

  // ---- Abas, segmentado, linha do tempo, critérios, etapas ----
  protected readonly tabs: TabItem[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'plano', label: 'Plano e cartão', badge: 2 },
    { id: 'acomp', label: 'Acompanhamento', disabled: true, disabledReason: 'Seu perfil não vê o acompanhamento clínico' },
    { id: 'consent', label: 'Consentimentos' },
  ];
  protected readonly tab = signal<string | undefined>('resumo');
  protected readonly views: SegmentOption[] = [
    { value: 'week', label: 'Semana', icon: 'calendar-days' },
    { value: 'month', label: 'Mês', icon: 'calendar' },
  ];
  protected readonly view = signal<string | undefined>('week');
  protected readonly timeline: TimelineItem[] = [
    { title: 'Consentimento revogado', at: '2026-10-20T10:12:00-03:00', text: 'Pelo canal telefone. Registrado por Camila Duarte.', tone: 'danger' },
    { title: 'Consentimento concedido de novo', at: '2026-10-02T09:30:00-03:00', text: 'Termo v1.0, presencial.', tone: 'done' },
    { title: 'Termo desatualizado: pedir novo aceite', timeLabel: '01/10/2026', tone: 'gold' },
    { title: 'Consentimento concedido', at: '2026-03-12T14:05:00-03:00', text: 'Termo v1.0, aplicativo.' },
  ];
  protected readonly criteria: ChecklistItem[] = [
    { id: 'c1', title: 'Registro ativo no conselho', text: 'CREFITO fictício, válido até 30/06/2027', state: 'ok' },
    { id: 'c2', title: 'Comprovação de formação', text: 'Diploma enviado', state: 'ok' },
    { id: 'c3', title: 'Documento na validade', text: 'Vencido em 04/10/2026', state: 'fail', badge: 'Vencido' },
    { id: 'c4', title: 'Integração concluída', state: 'pending' },
    { id: 'c5', title: 'Registro em conselho de classe', state: 'na' },
  ];
  protected readonly missing = computed(() => this.criteria.filter((c) => c.state !== 'ok' && c.state !== 'na').length);
  protected readonly steps = ['Cuidador', 'Pessoa idosa', 'Consentimentos', 'Plano', 'Resumo'].map((label, i) => ({ id: `s${i}`, label }));
  protected readonly step = signal(2);

  // ---- Quadro ----
  protected readonly board = signal('');
  protected readonly columns: KanbanColumn<Process>[] = [
    { id: 'requested', label: 'Solicitado', items: [{ name: 'Dra. Sônia Peixoto', specialty: 'Fisioterapia, CREFITO fictício', missing: 'há 2 dias' }] },
    { id: 'review', label: 'Em análise', items: [{ name: 'Fisio em Casa Uberlândia', specialty: 'Fisioterapia, domiciliar', missing: 'faltam 2 critérios' }] },
    { id: 'pending', label: 'Documentos pendentes', items: [{ name: 'Candidata a fisioterapeuta', specialty: 'Fisioterapia', missing: 'documento vencido' }] },
    { id: 'approved', label: 'Aprovado', items: [] },
    { id: 'rejected', label: 'Reprovado', items: [] },
  ];

  // ---- Agenda ----
  protected readonly week = computed(() => weekDays(this.clock.today()));
  protected readonly slots = computed(() => sampleSlots(this.week()));
  protected readonly agendaCaption = computed(() => `Agenda da semana de ${this.week()[0]?.slice(8)} a ${this.week()[4]?.slice(8)}`);
  protected readonly picked = signal<AgendaSlot | null>(null);
  protected readonly pickedText = computed(() => {
    const slot = this.picked();
    return slot ? `Abriria a vaga das ${slot.time} (${slot.status}).` : 'Escolha uma vaga para abrir.';
  });

  // ---- Assistente ----
  protected readonly wizardItems: WizardItem[] = ZARIT_DEMO_ITEMS.slice(0, 5).map((question, i) => ({
    id: `q${i + 1}`,
    question,
    hint: i === 1 ? 'Pense nas últimas semanas. Não há resposta certa ou errada.' : undefined,
    options: ZARIT_ANSWER_LABELS.map((label, value) => ({ value, label })),
  }));
  protected readonly answers = signal<WizardAnswers>({});
  protected readonly wizardResult = signal<number | null>(null);

  protected finishWizard(result: WizardAnswers): void {
    this.wizardResult.set(Object.values(result).reduce<number>((sum, v) => sum + Number(v), 0));
    this.answers.set({});
  }

  private buildDeadlines(): { due: string; unit: 'business-hours' | 'days'; done: boolean }[] {
    const now = this.clock.now();
    const day = now.slice(0, 10);
    return [
      { due: `${day}T18:00:00-03:00`, unit: 'business-hours', done: false },
      { due: `${day}T07:00:00-03:00`, unit: 'business-hours', done: false },
      { due: this.clock.addDays(10), unit: 'days', done: false },
      { due: this.clock.addDays(2), unit: 'days', done: false },
      { due: this.clock.addDays(-1), unit: 'days', done: false },
      { due: this.clock.addDays(-3), unit: 'days', done: true },
    ];
  }
}
