import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth';
import { Database } from '@core/data';
import { formatPercent } from '@core/format';
import { canReceiveRedistribution, receiveBlockReason } from '@core/rules';
import {
  BadgeComponent,
  CheckboxComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
} from '@shared/ui';
import { DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { CareSessionsService, FieldError } from '../state/care-sessions.service';

interface ReceiverView {
  id: string;
  name: string;
  percent: number | null;
  /** Por que não recebe (no limite ou acima dele); `null` quando pode receber. */
  blocked: string | null;
}

function percentText(value: number | null): string {
  return value === null ? 'n/d' : formatPercent(value, { decimals: 1 });
}

/**
 * SCR-M05-07, Redistribuir (RN-EQP-05, CX-010, CX-011): transfere casos de um psicólogo para outros, com motivo.
 * Quem faz é o responsável técnico ou a gestão. Em vez de levar tudo para um só, a pessoa escolhe QUAIS casos
 * (só pelo código, nunca nome), PARA QUEM e QUANTOS para cada um, e vê como fica a ocupação de cada psicólogo
 * antes de confirmar. A gestão não vê nem move caso com acompanhamento ativo e precisa informar o aval da
 * responsável técnica. A confirmação descreve o efeito; a transferência fica no log com o motivo.
 */
@Component({
  selector: 'app-redistribute-drawer',
  imports: [BadgeComponent, CheckboxComponent, DrawerComponent, FormFieldComponent, IconComponent, NxInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .case-list {
      max-height: 14rem;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
    }
  `,
  template: `
    <app-drawer [(open)]="open" heading="Redistribuir a agenda" [subtitle]="fromName() + ' · ' + percentText(currentPercent()) + ' no último mês fechado'">
      <div class="stack stack--6" data-role="redistribute-form">
        <section class="stack stack--3" aria-labelledby="redistribute-cases-title">
          <h3 id="redistribute-cases-title" class="t-strong">1. Quais casos</h3>
          <p class="t-caption">
            {{ cases().length }} {{ cases().length === 1 ? 'caso' : 'casos' }} e
            {{ preview().sessions }} {{ preview().sessions === 1 ? 'sessão futura' : 'sessões futuras' }}. Só o código
            aparece. As sessões futuras e as aplicações da escala vão junto com o caso.
          </p>
          @if (!isTechnicalLead()) {
            <p class="t-caption" data-role="active-follow-up-note">
              Casos em acompanhamento ativo não aparecem aqui: só a responsável técnica transfere esses.
            </p>
          }
          <div class="cluster">
            <button type="button" class="btn btn--sm" (click)="selectAll()" data-role="select-all">Marcar todos</button>
            <button type="button" class="btn btn--sm" (click)="clearSelection()" data-role="clear-selection">Limpar</button>
            <span class="t-ui" data-role="selected-count" role="status">{{ selectedLabel() }}</span>
          </div>
          <div class="case-list" role="group" aria-label="Casos que podem ser transferidos" data-role="case-list">
            @for (item of cases(); track item.id) {
              <app-checkbox [checked]="selected().has(item.id)" (checkedChange)="toggle(item.id, $event)">
                {{ item.code }}
                <span class="t-caption"> · {{ item.sessions }} {{ item.sessions === 1 ? 'sessão futura' : 'sessões futuras' }}</span>
                @if (item.activeRisk) {
                  <app-badge variant="attention" icon="triangle-alert">Acompanhamento ativo</app-badge>
                }
              </app-checkbox>
            } @empty {
              <p class="t-ui">Nenhum caso para transferir por aqui.</p>
            }
          </div>
          @if (err('cases'); as msg) {
            <p class="field__error" role="alert">{{ msg }}</p>
          }
        </section>

        <section class="stack stack--3" aria-labelledby="redistribute-target-title">
          <h3 id="redistribute-target-title" class="t-strong">2. Para quem, e quantos casos</h3>
          @if (receivers().length === 0) {
            <p class="t-ui">Nenhum outro psicólogo com CRP ativo para receber os casos.</p>
          }
          @for (r of receivers(); track r.id) {
            @if (r.blocked) {
              <p class="t-ui" data-role="receiver-blocked">
                <strong>{{ r.name }}</strong>: {{ percentText(r.percent) }} no último mês fechado, {{ r.blocked }}.
              </p>
            } @else {
              <app-form-field
                [label]="'Casos para ' + r.name"
                [hint]="percentText(r.percent) + ' no último mês fechado'"
                [controlId]="'redistribute-qty-' + r.id"
              >
                <input
                  appInput
                  type="number"
                  min="0"
                  inputmode="numeric"
                  [value]="quantityOf(r.id)"
                  (input)="setQuantity(r.id, valueOf($event))"
                  data-role="receiver-qty"
                />
              </app-form-field>
            }
          }
          @if (eligible().length > 1) {
            <div>
              <button type="button" class="btn btn--sm" (click)="splitEvenly()" data-role="split-evenly">Dividir igualmente</button>
            </div>
          }
          @if (err('target'); as msg) {
            <p class="field__error" role="alert">{{ msg }}</p>
          }
        </section>

        <section class="stack stack--3" aria-labelledby="redistribute-preview-title">
          <h3 id="redistribute-preview-title" class="t-strong">3. Como fica a ocupação</h3>
          <div class="table-wrap">
            <table class="table" data-density="comfortable" data-role="projection">
              <caption class="sr-only">Ocupação de hoje e estimada depois da transferência, por psicólogo</caption>
              <thead>
                <tr>
                  <th scope="col">Psicólogo</th>
                  <th scope="col" class="t-right">Casos</th>
                  <th scope="col" class="t-right">Ocupação hoje</th>
                  <th scope="col" class="t-right">Depois (estimativa)</th>
                </tr>
              </thead>
              <tbody>
                @for (row of projectionRows(); track row.id) {
                  <tr [attr.data-psychologist]="row.id">
                    <th scope="row">{{ row.name }}</th>
                    <td class="t-right t-num">{{ row.casesBefore }} → {{ row.casesAfter }}</td>
                    <td class="t-right t-num">{{ percentText(row.before) }}</td>
                    <td class="t-right t-num">
                      {{ percentText(row.after) }}
                      @if (row.exceedsLimit) {
                        <app-badge variant="attention" icon="triangle-alert">{{ row.isOrigin ? 'continua acima de 80%' : 'passaria de 80%' }}</app-badge>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="t-caption" data-role="projection-note">
            Estimativa com base no último mês fechado: as horas realizadas acompanham os casos, na média de quem
            cede. Os números reais mudam com a agenda dos próximos meses.
          </p>
          @if (anyExceeds()) {
            <p class="banner banner--attention" role="note" data-role="exceeds-warning">
              Um dos psicólogos que recebe passaria de 80% de ocupação. Considere dividir os casos com mais alguém.
            </p>
          }
        </section>

        <app-form-field label="Motivo da transferência" controlId="redistribute-reason" [error]="err('reason')">
          <textarea appInput rows="3" [value]="reason()" (input)="reason.set(valueOf($event))" data-role="reason"></textarea>
        </app-form-field>

        @if (!isTechnicalLead()) {
          <div class="stack stack--2">
            <app-checkbox [checked]="rtApproved()" (checkedChange)="rtApproved.set($event)" data-role="rt-approval">
              Combinei esta redistribuição com a responsável técnica
            </app-checkbox>
            <p class="t-caption">A escolha dos casos tem efeito técnico: a responsável técnica precisa estar de acordo.</p>
            @if (err('approval'); as msg) {
              <p class="field__error" role="alert">{{ msg }}</p>
            }
          </div>
        }
        @if (err('redistribute'); as msg) {
          <p class="field__error" role="alert">{{ msg }}</p>
        }
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="open.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="submit()" data-role="redistribute-submit">
          <svg appIcon="users-round" size="sm"></svg>Transferir os casos
        </button>
      </ng-container>
    </app-drawer>
  `,
})
export class RedistributeDrawerComponent {
  private readonly svc = inject(CareSessionsService);
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  readonly open = model(false);
  /** Psicólogo de quem os casos saem. */
  readonly fromId = input.required<string>();

  protected readonly valueOf = valueOf;
  protected readonly percentText = percentText;
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly quantities = signal<Readonly<Record<string, number>>>({});
  protected readonly reason = signal('');
  protected readonly rtApproved = signal(false);
  protected readonly errors = signal<FieldError[]>([]);

  protected readonly isTechnicalLead = computed(() => this.auth.role() === 'technical_lead');
  protected readonly fromName = computed(() => this.db.psychologists.get(this.fromId())?.displayName ?? '');
  protected readonly preview = computed(() => this.svc.redistributionPreview(this.fromId()));
  protected readonly cases = computed(() => this.svc.transferableCases(this.fromId()));
  protected readonly currentPercent = computed(() => {
    const psychologist = this.db.psychologists.get(this.fromId());
    return psychologist ? (this.svc.occupancyFor(psychologist).months[1]?.occupancyPercent ?? null) : null;
  });

  protected readonly receivers = computed<ReceiverView[]>(() =>
    this.svc
      .activePsychologists()
      .filter((p) => p.id !== this.fromId())
      .map((p) => {
        const percent = this.svc.occupancyFor(p).months[1]?.occupancyPercent ?? null;
        return {
          id: p.id,
          name: p.displayName,
          percent,
          blocked: canReceiveRedistribution(percent) ? null : receiveBlockReason(percent),
        };
      }),
  );
  protected readonly eligible = computed(() => this.receivers().filter((r) => r.blocked === null));
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly selectedLabel = computed(() => {
    const n = this.selectedCount();
    return `${n} ${n === 1 ? 'caso escolhido' : 'casos escolhidos'}`;
  });

  /** Quantidades efetivas: com um único receptor possível, ele recebe tudo o que foi escolhido. */
  private readonly effective = computed<Record<string, number>>(() => {
    const only = this.eligible();
    if (only.length === 1) {
      return { [only[0]?.id ?? '']: this.selectedCount() };
    }
    const result: Record<string, number> = {};
    only.forEach((r) => (result[r.id] = this.quantities()[r.id] ?? 0));
    return result;
  });
  protected readonly assigned = computed(() => Object.values(this.effective()).reduce((a, b) => a + b, 0));

  protected readonly projection = computed(() => {
    const moves = this.eligible()
      .map((r) => ({ toId: r.id, cases: this.effective()[r.id] ?? 0 }))
      .filter((m) => m.cases > 0);
    return this.svc.projectRedistribution(this.fromId(), moves);
  });
  protected readonly projectionRows = computed(() => {
    const names = new Map([[this.fromId(), this.fromName()], ...this.receivers().map((r) => [r.id, r.name] as const)]);
    return this.projection().map((p) => ({
      id: p.id,
      name: names.get(p.id) ?? '',
      casesBefore: p.caregiversBefore,
      casesAfter: p.caregiversAfter,
      before: p.before,
      after: p.after,
      exceedsLimit: p.exceedsLimit,
      isOrigin: p.id === this.fromId(),
    }));
  });
  /** O aviso é só de quem RECEBE e passaria do limite; quem cede continuar alto não é o problema da transferência. */
  protected readonly anyExceeds = computed(() => this.projection().some((p) => p.exceedsLimit && p.id !== this.fromId()));

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.selected.set(new Set());
          this.quantities.set({});
          this.reason.set('');
          this.rtApproved.set(false);
          this.errors.set([]);
        });
      }
    });
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected quantityOf(id: string): number {
    return this.effective()[id] ?? 0;
  }

  protected setQuantity(id: string, raw: string): void {
    const n = Math.max(0, Math.floor(Number(raw)) || 0);
    this.quantities.update((q) => ({ ...q, [id]: n }));
  }

  protected toggle(id: string, on: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  /** Marca todos os casos comuns; o acompanhamento ativo só entra se a responsável técnica marcar um a um. */
  protected selectAll(): void {
    this.selected.set(new Set(this.cases().filter((c) => !c.activeRisk).map((c) => c.id)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected splitEvenly(): void {
    const people = this.eligible();
    const total = this.selectedCount();
    const base = people.length === 0 ? 0 : Math.floor(total / people.length);
    let extra = people.length === 0 ? 0 : total % people.length;
    const next: Record<string, number> = {};
    people.forEach((r) => {
      next[r.id] = base + (extra > 0 ? 1 : 0);
      extra = Math.max(0, extra - 1);
    });
    this.quantities.set(next);
  }

  protected async submit(): Promise<void> {
    const ids = this.cases()
      .filter((c) => this.selected().has(c.id))
      .map((c) => c.id);
    if (ids.length === 0) {
      this.errors.set([{ field: 'cases', message: 'Escolha ao menos um caso para transferir.' }]);
      return;
    }
    const split = this.eligible()
      .map((r) => ({ toId: r.id, name: r.name, count: this.effective()[r.id] ?? 0 }))
      .filter((s) => s.count > 0);
    if (this.assigned() !== ids.length) {
      this.errors.set([
        {
          field: 'target',
          message: `Distribua os ${ids.length} ${ids.length === 1 ? 'caso escolhido' : 'casos escolhidos'} entre os psicólogos. Hoje há ${this.assigned()} distribuídos.`,
        },
      ]);
      return;
    }
    let cursor = 0;
    const assignments = split.map((s) => {
      const caregiverIds = ids.slice(cursor, cursor + s.count);
      cursor += s.count;
      return { toId: s.toId, caregiverIds };
    });
    const from = this.fromName();
    const rows = this.projectionRows();
    const mine = rows.find((r) => r.id === this.fromId());
    const sentences = split.map((s) => `${s.count} ${s.count === 1 ? 'caso' : 'casos'} para ${s.name}`);
    const { confirmed } = await this.dialogs.confirm({
      title: `Transferir ${ids.length} ${ids.length === 1 ? 'caso' : 'casos'} de ${from}?`,
      message: `${sentences.join(' e ')}. A ocupação de ${from} iria de ${percentText(mine?.before ?? null)} para cerca de ${percentText(mine?.after ?? null)} (estimativa).`,
      effects: {
        block: ['a agenda de quem cede, que perde as sessões futuras desses casos'],
        keep: ['o histórico das sessões e das anotações, que fica com quem atendeu', 'o motivo, registrado no log de acesso'],
      },
      confirmLabel: 'Transferir os casos',
      cancelLabel: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    const result = this.svc.redistributeCases(this.fromId(), assignments, this.reason(), {
      rtApproved: this.rtApproved(),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    const { caregivers, sessionsMoved, sessionsKept } = result.value;
    this.open.set(false);
    this.toasts.success(
      `${caregivers} ${caregivers === 1 ? 'cuidador transferido' : 'cuidadores transferidos'} e ${sessionsMoved} ${sessionsMoved === 1 ? 'sessão' : 'sessões'} (${sentences.join(', ')}).${sessionsKept > 0 ? ` ${sessionsKept} ficaram onde estavam, por causa de horário ocupado.` : ''}`,
    );
  }
}
