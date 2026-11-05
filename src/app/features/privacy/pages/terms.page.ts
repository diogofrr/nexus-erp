import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuditLogService } from '@core/audit';
import { AuthService } from '@core/auth';
import { Clock } from '@core/clock';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import type { ConsentKey, ConsentTerm } from '@core/models';
import { CONSENT_KEYS, CONSENT_LABELS } from '@core/rules';
import { BadgeComponent, CardComponent, FormFieldComponent, NxInputDirective, NxValidators, PageHeaderComponent } from '@shared/ui';
import { BannerComponent, DialogService, DrawerComponent, ToastService } from '@shared/ui/overlay';
import { LgpdNavComponent } from '../components/lgpd-nav.component';

/** Próxima versão do termo: `1.0` vira `1.1`. */
export function nextTermVersion(version: string): string {
  const [major, minor] = version.split('.').map((n) => Number(n) || 0) as [number, number];
  return `${major}.${(minor ?? 0) + 1}`;
}

/**
 * SCR-M12-02 Termos: texto, versão e data de cada termo. Os três documentos do consentimento de saúde, do
 * uso de imagem e do contrato de prestação de serviços são SEPARADOS (RN-LGPD-04, AC-M12-12). Publicar uma
 * nova versão de um termo deixa os consentimentos dados na versão antiga como "Desatualizado: pedir novo
 * aceite" (LP-06). A versão antiga fica guardada.
 */
@Component({
  selector: 'app-terms-page',
  imports: [
    BadgeComponent,
    BannerComponent,
    CardComponent,
    DrawerComponent,
    FormFieldComponent,
    LgpdNavComponent,
    NxInputDirective,
    PageHeaderComponent,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack stack--6">
      <app-page-header title="Termos" description="Textos e versões dos termos de consentimento." />
      <app-lgpd-nav />
      <app-banner variant="info" heading="Três documentos separados">
        O consentimento de dados de saúde, o uso de imagem e depoimento e o contrato de prestação de serviços são documentos independentes, cada um com versão e data.
      </app-banner>

      <section class="stack stack--6" aria-label="Termos de consentimento">
        @for (term of terms(); track term.id) {
          <app-card [title]="term.title" [subtitle]="labelOf(term.key) + ' · versão ' + term.version + ' · publicado em ' + date(term.publishedAt)">
            @if (canEdit()) {
              <button appCardActions type="button" class="btn btn--sm" (click)="openEdit(term)">Publicar nova versão</button>
            }
            <div class="stack stack--3">
              <div class="cluster">
                <app-badge variant="success" icon="circle-check">Versão {{ term.version }} em vigor</app-badge>
                @if (outdatedCount(term.key) > 0) {
                  <app-badge variant="gold" icon="triangle-alert">{{ outdatedCount(term.key) }} consentimentos desatualizados</app-badge>
                }
              </div>
              <p>{{ term.text }}</p>
            </div>
          </app-card>
        }
        @if (contract(); as doc) {
          <app-card title="Contrato de prestação de serviços" [subtitle]="'Documento próprio · versão ' + doc.version + ' · publicado em ' + date(doc.createdAt)">
            <div class="stack stack--3">
              <app-badge variant="info" icon="file-text">Separado dos termos de consentimento</app-badge>
              @for (paragraph of paragraphs(doc.body); track $index) { <p>{{ paragraph }}</p> }
            </div>
          </app-card>
        }
      </section>
    </div>

    <app-drawer [(open)]="drawerOpen" heading="Publicar nova versão" [subtitle]="editing() ? editing()!.title : ''">
      @if (drawerOpen() && editing(); as term) {
        <div class="stack stack--3">
          <p class="t-ui">A versão {{ term.version }} passa a {{ nextVersion() }}. {{ outdatedCount(term.key) }} consentimentos concedidos na versão antiga ficam desatualizados e pedem novo aceite.</p>
          <app-form-field label="Texto do termo" hint="Linguagem simples, frases curtas." controlId="nx-term-text" [error]="error()">
            <textarea appInput rows="8" [formControl]="text"></textarea>
          </app-form-field>
        </div>
      }
      <ng-container drawerFooter>
        <button type="button" class="btn" (click)="drawerOpen.set(false)">Voltar</button>
        <button type="button" class="btn btn--primary" (click)="publish()">Publicar a versão {{ nextVersion() }}</button>
      </ng-container>
    </app-drawer>
  `,
})
export class TermsPage {
  private readonly db = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly audit = inject(AuditLogService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<ConsentTerm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly text = new FormControl('', { nonNullable: true, validators: [NxValidators.required('o texto do termo')] });
  protected readonly canEdit = computed(() => this.auth.can('lgpd_consents_requests', 'update') && this.auth.role() !== 'support');

  protected readonly terms = computed(() => {
    const active = this.db.consentTerms.all().filter((t) => t.active);
    return [...active].sort((a, b) => CONSENT_KEYS.indexOf(a.key) - CONSENT_KEYS.indexOf(b.key));
  });
  protected readonly contract = computed(() => this.db.privacyDocuments.find((d) => d.kind === 'service_contract'));
  protected readonly nextVersion = computed(() => nextTermVersion(this.editing()?.version ?? '1.0'));

  protected labelOf(key: ConsentKey): string {
    return CONSENT_LABELS[key];
  }

  protected date(value: string | undefined): string {
    return formatDate(value);
  }

  protected paragraphs(body: string): string[] {
    return body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  }

  /** Consentimentos concedidos numa versão diferente da que está em vigor. */
  protected outdatedCount(key: ConsentKey): number {
    const active = this.db.consentTerms.find((t) => t.key === key && t.active)?.version;
    return this.db.consents.count((c) => c.key === key && c.status === 'granted' && c.currentTermVersion !== active);
  }

  protected openEdit(term: ConsentTerm): void {
    this.editing.set(term);
    this.error.set(null);
    this.text.setValue(term.text);
    this.drawerOpen.set(true);
  }

  protected async publish(): Promise<void> {
    const term = this.editing();
    if (!term) {
      return;
    }
    const value = this.text.value.trim();
    if (value.length < 10) {
      this.error.set('Escreva o texto do termo com ao menos 10 caracteres.');
      return;
    }
    const version = this.nextVersion();
    const affected = this.db.consents.count((c) => c.key === term.key && c.status === 'granted');
    const { confirmed } = await this.dialogs.confirm({
      title: `Publicar a versão ${version} do termo?`,
      message: `${term.title}.`,
      effects: {
        block: [`${affected} consentimentos concedidos na versão ${term.version} passam a "Desatualizado" e pedem novo aceite`],
        keep: [`a versão ${term.version}, guardada para o histórico`],
      },
      confirmLabel: `Publicar a versão ${version}`,
      busyLabel: 'Publicando...',
      run: () => {
        this.db.consentTerms.update(term.id, { active: false });
        const created = this.db.consentTerms.create({
          key: term.key,
          version,
          title: term.title,
          text: value,
          publishedAt: this.clock.today(),
          active: true,
        });
        this.audit.write('create', 'consent_term', created.id, undefined, `${term.key} v${version}`);
        this.toasts.success(`Versão ${version} publicada. ${affected} consentimentos pedem novo aceite.`);
      },
    });
    if (confirmed) {
      this.drawerOpen.set(false);
    }
  }
}
