import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { FormFieldComponent, IconComponent, NxInputDirective } from '@shared/ui';
import { ToastService } from '@shared/ui/overlay';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { ContactChannel, contactChannels, phoneClosedNote } from '../../state/nexus-contact';
import { CgChoiceGroupComponent } from '../../ui/cg-choice-group.component';
import { CgEmergencyNoteComponent } from '../../ui/cg-emergency-note.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { CgRowComponent } from '../../ui/cg-row.component';
import { MESSAGE_SENT_NOTE, MESSAGE_SUBJECTS, NexusMessagesService } from '../state/nexus-messages.service';

/**
 * Falar com a Nexus (UX C19, B10; RN-CAN-01 a 06, RN-USR-18, RN-ATD-11, RN-ENC-09). Os 4 canais com o prazo de resposta de
 * cada um, o que a pessoa prefere primeiro, e a mensagem pelo aplicativo na mesma tela. Telefone, WhatsApp e e-mail
 * abrem o diálogo "Como falar com a gente" (nenhum `tel:` nem `wa.me`); a mensagem pelo aplicativo grava para a
 * equipe com o prazo de 24 horas úteis. Nenhuma função essencial depende só do app (RN-CAN-05): fora do horário o
 * telefone avisa quando abre e a tela sugere WhatsApp ou mensagem. O aplicativo não detecta risco no texto (S-24).
 */
@Component({
  selector: 'app-talk-to-nexus-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CgPageHeaderComponent,
    CgRowComponent,
    CgNoteComponent,
    CgChoiceGroupComponent,
    CgEmergencyNoteComponent,
    FormFieldComponent,
    NxInputDirective,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .talk__tag { display: inline-block; padding: 0 0.5rem; border-radius: var(--cg-radius-pill); background: var(--brand-soft); color: var(--cg-heading); font-size: var(--cg-fs-caption); font-weight: 600; }
      .talk__msg { display: grid; gap: 0.25rem; padding: 1rem; }
      .talk__msg p { margin: 0; overflow-wrap: anywhere; }
      .talk__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.75rem; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
      .talk__meta svg { vertical-align: -0.2em; margin-inline-end: 0.25rem; }
      .talk__status { font-weight: 600; color: var(--cg-heading); }
      .talk__empty { display: grid; gap: 0.25rem; padding: 1rem; border: 1px solid var(--cg-border); border-radius: var(--cg-radius-card); background: var(--cg-surface); }
      .talk__empty h3 { margin: 0; font-size: var(--cg-fs-lead); }
      .talk__empty p { margin: 0; color: var(--cg-text-soft); }
    `,
  ],
  template: `
    <app-cg-page-header title="Falar com a Nexus" description="Escolha o jeito mais fácil para você." backLink="/cuidador/mais" backLabel="Mais" />

    <div class="cg-stack">
      @if (closedNote(); as note) {
        <app-cg-note variant="soft" icon="clock">
          <span data-role="phone-closed">{{ note }}</span> Você pode escrever pelo WhatsApp ou deixar uma mensagem aqui.
        </app-cg-note>
      }

      <ul class="cg-list" aria-label="Canais para falar com a Nexus" data-role="channels">
        @for (channel of channels(); track channel.channel) {
          <li>
            <app-cg-row
              [title]="channel.label"
              [description]="describe(channel)"
              [icon]="channel.icon"
              [chevron]="true"
              (activated)="choose(channel)"
            >
              @if (channel.channel === preferred()) {
                <span cgRowEnd class="talk__tag" data-role="preferred-tag">Seu canal preferido</span>
              }
            </app-cg-row>
          </li>
        }
      </ul>

      @if (showCompose()) {
        <section class="cg-stack cg-stack--tight cg-reading" aria-labelledby="talk-compose" data-role="compose">
          <h2 class="cg-section__title" id="talk-compose">Escrever uma mensagem</h2>
          <app-cg-choice-group legend="Sobre o que é? (opcional)" [options]="subjects" [(value)]="subject" />
          <app-form-field label="Escreva a sua mensagem" controlId="talk-body" [error]="error()" [forceErrors]="true">
            <textarea appInput rows="5" [formControl]="body" #bodyField></textarea>
          </app-form-field>
          <p class="cg-meta">Se for urgente, use <a class="cg-link-btn" routerLink="/cuidador/ajuda-agora">Ajuda agora</a>.</p>
          @if (sentNote()) {
            <app-cg-note variant="ok" icon="circle-check"><span data-role="sent-note">{{ sentNote() }}</span></app-cg-note>
          }
          <div class="cg-actions">
            <button type="button" class="btn btn--primary" (click)="send()">
              <svg appIcon="send" size="sm"></svg>Enviar mensagem
            </button>
          </div>
        </section>
      }

      <section aria-labelledby="talk-history" data-role="history">
        <h2 class="cg-section__title" id="talk-history">Suas mensagens</h2>
        @if (entries().length === 0) {
          <div class="talk__empty" data-role="messages-empty">
            <h3>Você ainda não mandou nenhuma mensagem</h3>
            <p>Quando você escrever para a equipe, a conversa aparece aqui.</p>
          </div>
        } @else {
          <ul class="cg-list">
            @for (entry of entries(); track entry.id) {
              <li class="talk__msg" data-role="message">
                <div class="talk__meta">
                  <span>{{ entry.dateLabel }}</span>
                  <span><svg [appIcon]="entry.icon" size="sm"></svg>{{ entry.channelLabel }}</span>
                  <span class="talk__status">{{ entry.status }}</span>
                </div>
                <p>{{ entry.text }}</p>
              </li>
            }
          </ul>
        }
      </section>

      <app-cg-emergency-note />
    </div>
  `,
})
export class TalkToNexusPage {
  private readonly ctx = inject(CaregiverContextService);
  private readonly clock = inject(Clock);
  private readonly contact = inject(ContactDialogService);
  private readonly messages = inject(NexusMessagesService);
  private readonly injector = inject(Injector);
  private readonly bodyField = viewChild<ElementRef<HTMLTextAreaElement>>('bodyField');

  protected readonly subjects = MESSAGE_SUBJECTS.map((label) => ({ value: label, label }));
  protected readonly subject = signal<string | null>(null);
  protected readonly body = new FormControl('', { nonNullable: true });
  protected readonly error = signal<string | null>(null);
  protected readonly sentNote = signal('');
  private readonly composing = signal(false);

  protected readonly preferred = this.ctx.preferredChannel;
  protected readonly channels = computed<ContactChannel[]>(() => contactChannels(this.ctx.preferredChannel(), this.clock.now()));
  protected readonly closedNote = computed(() => phoneClosedNote(this.clock.now()) ?? null);
  protected readonly entries = this.messages.entries;
  /** Sem nenhuma mensagem, o campo e os assuntos já ficam à vista (estado vazio de Marcos). */
  protected readonly showCompose = computed(() => this.composing() || this.entries().length === 0);

  /** A segunda linha do canal: o prazo e, no canal preferido, o número à vista. */
  protected describe(channel: ContactChannel): string {
    const showValue = channel.channel === this.ctx.preferredChannel() && channel.value;
    return showValue ? `${channel.value}. ${channel.answer}` : channel.answer;
  }

  protected choose(channel: ContactChannel): void {
    if (channel.action === 'write_message') {
      this.composing.set(true);
      afterNextRender(() => this.bodyField()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    this.contact.open();
  }

  protected send(): void {
    const result = this.messages.send(this.subject(), this.body.value);
    if (!result.ok) {
      this.sentNote.set('');
      this.error.set(result.error);
      this.bodyField()?.nativeElement.focus();
      return;
    }
    this.error.set(null);
    this.body.reset('');
    this.subject.set(null);
    this.sentNote.set(MESSAGE_SENT_NOTE);
  }
}
