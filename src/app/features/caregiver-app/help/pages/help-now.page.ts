import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Clock } from '@core/clock';
import { IconComponent } from '@shared/ui';
import { CaregiverContextService } from '../../state/caregiver-context.service';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { CHANNELS_NOTICE, NEXUS_EMAIL, NEXUS_PHONE, NEXUS_WHATSAPP, phoneClosedNote } from '../../state/nexus-contact';
import { CgCardComponent } from '../../ui/cg-card.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgPageHeaderComponent } from '../../ui/cg-page-header.component';
import { HELP_NUMBERS, HelpNumber } from '../state/help-numbers';
import { CallNumberSheetComponent } from '../ui/call-number-sheet.component';

/**
 * Ajuda agora (UX C3, B14; RN-ATD-11, RN-CAN-05 e 06, RN-ENC-03, 05 e 09). Uma tela calma, a um toque de qualquer lugar,
 * com três caminhos na ordem da gravidade: emergência de saúde (SAMU 192), sofrimento emocional (CVV 188) e a equipe
 * da Nexus. Abre SEM sessão e SEM consentimento, funciona offline (conteúdo fixo) e nada nela é medido, contado,
 * cobrado nem usado em oferta (RN-PLN-19). Nenhum `tel:`: o toque abre o diálogo com o número e "Copiar número".
 * Sem vermelho, sem sirene, sem animação.
 */
@Component({
  selector: 'app-help-now-page',
  imports: [CgPageHeaderComponent, CgCardComponent, CgNoteComponent, CallNumberSheetComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .help__emergency {
        display: grid;
        gap: 0.75rem;
        padding: var(--cg-pad-card);
        border-radius: var(--cg-radius-card);
        background: var(--cg-emergency-bg);
        color: #ffffff;
      }
      .help__emergency h2 { margin: 0; font-size: var(--cg-fs-h2); color: #ffffff; }
      .help__emergency p { margin: 0; }
      .help__emergency .btn { background: #ffffff; color: var(--cg-emergency-bg); border-color: #ffffff; }
      .help__number {
        font-size: 2.5rem;
        line-height: 1.1;
        font-weight: 600;
        letter-spacing: 0.04em;
        font-variant-numeric: tabular-nums;
      }
      .help__number--dark { color: var(--cg-heading); }
      .help__channel { display: grid; gap: 0.25rem; padding: 0.75rem 1rem; border-radius: var(--cg-radius-control); background: var(--cg-surface-sunken); }
      .help__channel p { margin: 0; }
      .help__channel-value { font-size: var(--cg-fs-lead); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cg-heading); }
      .help__more { border: 1px solid var(--cg-border); border-radius: var(--cg-radius-card); background: var(--cg-surface); }
      .help__more > summary { min-height: var(--cg-target); padding: 0.75rem 1rem; font-weight: 600; cursor: pointer; }
      .help__more-body { display: grid; gap: 1rem; padding: 0 1rem 1rem; }
      .help__more-body p { margin: 0; }
    `,
  ],
  template: `
    <app-cg-page-header title="Ajuda agora" description="Escolha o que combina com o que está acontecendo." />

    <div class="cg-stack">
      <section class="help__emergency" aria-labelledby="help-samu" data-role="help-samu">
        <h2 id="help-samu">Emergência de saúde</h2>
        <p>A pessoa idosa ou você precisa de atendimento de saúde agora.</p>
        <p class="help__number">192</p>
        <button type="button" class="btn" (click)="show('samu')">
          <svg appIcon="phone" size="sm"></svg>Ligar para o SAMU 192
        </button>
      </section>

      <app-cg-card title="Estou muito mal ou penso em me machucar" icon="heart-handshake">
        <p data-role="help-cvv">
          O CVV conversa com você a qualquer hora, de graça. Ligue 188. Também atende por chat no site cvv.org.br.
        </p>
        <p class="help__number help__number--dark">188</p>
        <button cgCardFooter type="button" class="btn btn--primary" (click)="show('cvv')">
          <svg appIcon="phone" size="sm"></svg>Ligar para o CVV 188
        </button>
      </app-cg-card>

      <app-cg-card title="Falar com a equipe da Nexus" icon="hand-heart">
        <div data-role="help-nexus">
          <p>Para dúvidas, remarcar ou pedir apoio. Em horário comercial, a ligação é atendida na hora.</p>
          @if (preferred(); as channel) {
            <div class="help__channel" data-role="help-preferred">
              <p><strong>{{ channel.label }}</strong>@if (channel.preferred) { <span> · Seu canal preferido</span> }</p>
              @if (channel.value) {
                <p class="help__channel-value" data-role="help-preferred-value">{{ channel.value }}</p>
              }
            </div>
          }
          @if (closed(); as note) {
            <app-cg-note variant="soft" icon="clock"><span data-role="help-closed">{{ note }} Deixe uma mensagem pelo WhatsApp.</span></app-cg-note>
          }
        </div>
        <button cgCardFooter type="button" class="btn btn--primary" (click)="contact.open()">
          Como falar com a gente
        </button>
      </app-cg-card>

      <details class="help__more" data-role="help-more">
        <summary>Mais contatos</summary>
        <div class="help__more-body">
          <p>Violência ou maus-tratos contra a pessoa idosa: Disque 100.</p>
          <button type="button" class="btn" (click)="show('disque100')">Ver o número do Disque 100</button>
          <p>Apoio social e direitos: o CRAS do seu bairro.</p>
        </div>
      </details>

      <p class="cg-meta" data-role="help-footer">{{ notice }}</p>
    </div>

    <app-call-number-sheet [help]="shown()" [(open)]="sheetOpen" />
  `,
})
export class HelpNowPage {
  protected readonly contact = inject(ContactDialogService);
  private readonly ctx = inject(CaregiverContextService);
  private readonly clock = inject(Clock);

  protected readonly notice = CHANNELS_NOTICE;
  protected readonly shown = signal<HelpNumber | null>(null);
  protected readonly sheetOpen = signal(false);

  /** Fora do horário comercial, o aviso de quando abrimos (RN-CAN-03). */
  protected readonly closed = computed(() => phoneClosedNote(this.clock.now()) ?? null);

  /**
   * O canal que a pessoa prefere, com o número à vista (AC-CG-38). Sem sessão não há preferência: o telefone vem primeiro,
   * porque é o que funciona sem o aplicativo (RN-CAN-05).
   */
  protected readonly preferred = computed(() => {
    const signedIn = this.ctx.isSignedIn();
    const channel = signedIn ? this.ctx.preferredChannel() : 'phone';
    switch (channel) {
      case 'whatsapp':
        return { label: 'WhatsApp', value: NEXUS_WHATSAPP, preferred: signedIn };
      case 'email':
        return { label: 'E-mail', value: NEXUS_EMAIL, preferred: signedIn };
      case 'app':
        return { label: 'Mensagem no aplicativo', value: null, preferred: signedIn };
      default:
        return { label: 'Telefone', value: NEXUS_PHONE, preferred: signedIn };
    }
  });

  protected show(key: HelpNumber['key']): void {
    this.shown.set(HELP_NUMBERS[key]);
    this.sheetOpen.set(true);
  }
}
