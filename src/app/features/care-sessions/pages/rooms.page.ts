import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { Room, RoomAccessibility } from '@core/models';
import {
  BadgeComponent,
  CheckboxComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  NxInputDirective,
  PageHeaderComponent,
} from '@shared/ui';
import { DrawerComponent, ToastService } from '@shared/ui/overlay';
import { valueOf } from '@shared/ui/util/form-events';
import { ROOM_ATTRIBUTES, isRoomBookable, roomBlockReason, roomScore } from '../state/care-labels';
import { CareSessionsService, FieldError } from '../state/care-sessions.service';

const EMPTY_ACCESSIBILITY: RoomAccessibility = {
  stepFreeAccess: false,
  adaptedRestroom: false,
  goodLighting: false,
  armrestSeating: false,
};

/**
 * SCR-M05-08, Salas do coworking (RN-ATD-10): cada sala tem quatro atributos de acessibilidade (acesso sem
 * degraus, sanitário adaptado, boa iluminação, assentos com apoio de braços) e só pode ser reservada com os
 * quatro. A gestão edita; o responsável técnico, o psicólogo e o atendimento consultam.
 */
@Component({
  selector: 'app-rooms-page',
  imports: [
    BadgeComponent,
    CheckboxComponent,
    DrawerComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    NxInputDirective,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Salas do coworking" [count]="count()" description="Só salas com os quatro itens de acessibilidade podem ser reservadas.">
        @if (canEdit()) {
          <button type="button" class="btn btn--primary" (click)="openNew()" data-role="new-room">
            <svg appIcon="plus" size="sm"></svg>Nova sala
          </button>
        }
      </app-page-header>

      @if (rooms().length === 0) {
        <app-empty-state title="Nenhuma sala cadastrada" text="Cadastre a primeira sala para oferecer atendimento presencial no coworking.">
          @if (canEdit()) {
            <button type="button" class="btn btn--primary" (click)="openNew()">Nova sala</button>
          }
        </app-empty-state>
      } @else {
        <div class="grid grid--2 grid--gap-6">
          @for (room of rooms(); track room.id) {
            <section class="card card--pad stack stack--3" [attr.data-room]="room.id" [attr.aria-labelledby]="'room-' + room.id">
              <div class="cluster cluster--between">
                <h2 class="card__title" [id]="'room-' + room.id">{{ room.name }}</h2>
                @if (bookable(room)) {
                  <app-badge variant="success" icon="circle-check" data-role="room-state">Reservável</app-badge>
                } @else {
                  <app-badge variant="attention" icon="ban" data-role="room-state">Bloqueada</app-badge>
                }
              </div>
              <p class="t-ui">{{ room.address }}</p>
              <ul class="stack stack--2" role="list" [attr.aria-label]="'Acessibilidade de ' + room.name">
                @for (attr of attributes; track attr.key) {
                  <li class="cluster">
                    @if (room.accessibility[attr.key]) {
                      <app-badge variant="success" icon="check">Sim</app-badge>
                    } @else {
                      <app-badge variant="danger" icon="x">Não</app-badge>
                    }
                    <span>{{ attr.label }}</span>
                  </li>
                }
              </ul>
              <p class="t-caption" data-role="room-reason">
                {{ reason(room) ?? 'Os quatro itens de acessibilidade estão em ordem.' }}
                ({{ score(room) }} de 4)
              </p>
              <p class="t-caption">{{ upcoming(room) }}</p>
              @if (canEdit()) {
                <div>
                  <button type="button" class="btn btn--sm" (click)="openEdit(room)" data-role="edit-room">
                    <svg appIcon="pencil" size="sm"></svg>Editar a sala
                  </button>
                </div>
              }
            </section>
          }
        </div>
      }
    </div>

    <app-drawer [(open)]="editOpen" [heading]="editId() ? 'Editar a sala' : 'Nova sala'" subtitle="Os quatro itens decidem se a sala pode ser reservada.">
      <div class="stack stack--6" data-role="room-form">
        <app-form-field label="Nome da sala" controlId="room-name" [error]="err('name')">
          <input appInput [value]="name()" (input)="name.set(valueOf($event))" data-role="room-name" />
        </app-form-field>
        <app-form-field label="Endereço" controlId="room-address" [error]="err('address')">
          <input appInput [value]="address()" (input)="address.set(valueOf($event))" data-role="room-address" />
        </app-form-field>
        <app-form-field label="Acessibilidade" group controlId="room-access" hint="Marque só o que a sala tem de verdade.">
          @for (attr of attributes; track attr.key) {
            <app-checkbox [checked]="access()[attr.key]" (checkedChange)="setAccess(attr.key, $event)">{{ attr.label }}</app-checkbox>
          }
        </app-form-field>
        <app-form-field label="Uso" group controlId="room-active">
          <app-checkbox [checked]="active()" (checkedChange)="active.set($event)">Sala ativa</app-checkbox>
        </app-form-field>
      </div>
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="editOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="save()" data-role="save-room">Salvar a sala</button>
      </ng-container>
    </app-drawer>
  `,
})
export class RoomsPageComponent {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CareSessionsService);
  private readonly toasts = inject(ToastService);

  protected readonly valueOf = valueOf;
  protected readonly attributes = ROOM_ATTRIBUTES;
  protected readonly rooms = computed(() => this.db.rooms.all());
  protected readonly count = computed(() => `${this.rooms().length} ${this.rooms().length === 1 ? 'sala' : 'salas'}`);
  protected readonly canEdit = computed(() => this.auth.can('rooms', 'update'));

  protected readonly editOpen = signal(false);
  protected readonly editId = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly access = signal<RoomAccessibility>({ ...EMPTY_ACCESSIBILITY });
  protected readonly active = signal(true);
  protected readonly errors = signal<FieldError[]>([]);

  protected bookable(room: Room): boolean {
    return isRoomBookable(room);
  }

  protected reason(room: Room): string | null {
    return roomBlockReason(room);
  }

  protected score(room: Room): number {
    return roomScore(room);
  }

  /** Sessões e encontros futuros que usam a sala (consulta, sem nome de cuidador). */
  protected upcoming(room: Room): string {
    const now = this.clock.now();
    const sessions = this.db.careSessions.count(
      (s) => s.roomId === room.id && (s.status === 'scheduled' || s.status === 'confirmed') && s.startAt > now,
    );
    const meetings = this.db.activities
      .all()
      .filter((a) => a.roomId === room.id && a.status !== 'cancelled' && a.status !== 'finished')
      .reduce((total, a) => total + a.meetings.filter((m) => !m.done).length, 0);
    return `Próximas reservas: ${sessions} ${sessions === 1 ? 'sessão' : 'sessões'} e ${meetings} ${meetings === 1 ? 'encontro de grupo' : 'encontros de grupo'}.`;
  }

  protected err(field: string): string | null {
    return this.errors().find((e) => e.field === field)?.message ?? null;
  }

  protected openNew(): void {
    this.editId.set(null);
    this.name.set('');
    this.address.set('');
    this.access.set({ ...EMPTY_ACCESSIBILITY });
    this.active.set(true);
    this.errors.set([]);
    this.editOpen.set(true);
  }

  protected openEdit(room: Room): void {
    this.editId.set(room.id);
    this.name.set(room.name);
    this.address.set(room.address);
    this.access.set({ ...room.accessibility });
    this.active.set(room.active);
    this.errors.set([]);
    this.editOpen.set(true);
  }

  protected setAccess(key: keyof RoomAccessibility, on: boolean): void {
    this.access.update((current) => ({ ...current, [key]: on }));
  }

  protected save(): void {
    const result = this.svc.saveRoom(this.editId(), {
      name: this.name(),
      address: this.address(),
      accessibility: this.access(),
      active: this.active(),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    this.editOpen.set(false);
    this.toasts.success(
      isRoomBookable(result.value)
        ? `Sala ${result.value.name} salva e liberada para reservas.`
        : `Sala ${result.value.name} salva. Ela fica bloqueada até ter os quatro itens de acessibilidade.`,
    );
  }
}
