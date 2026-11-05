import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DoseSlot } from '../../../../core/rules/medication-doses';
import { EmptyStateComponent } from '../../../../shared/ui/display/empty-state.component';
import { ContactDialogService } from '../../state/contact-dialog.service';
import { CgCardComponent } from '../cg-card.component';
import { CgChoice, CgChoiceGroupComponent } from '../cg-choice-group.component';
import { CgDoseComponent } from '../cg-dose.component';
import { CgEmergencyNoteComponent } from '../cg-emergency-note.component';
import { CgMoodComponent, MoodValue } from '../cg-mood.component';
import { CgNoteComponent } from '../cg-note.component';
import { CgPageHeaderComponent } from '../cg-page-header.component';
import { CgPlanLockComponent } from '../cg-plan-lock.component';
import { CgPlanTagComponent } from '../cg-plan-tag.component';
import { CgRatingPairComponent } from '../cg-rating-pair.component';
import { CgRatingValue } from '../cg-rating.component';
import { CgRowComponent } from '../cg-row.component';
import { CgSheetComponent } from '../cg-sheet.component';
import { CgSwitchComponent } from '../cg-switch.component';
import { CgTextSizeComponent } from '../cg-text-size.component';
import { CgTrendComponent, CgTrendItem } from '../cg-trend.component';

/**
 * Catálogo do kit visual do cuidador (só em modo de desenvolvimento, `/cuidador/_kit`, com sessão de cuidador):
 * cada componente de `features/caregiver-app/ui` com dados genéricos. Serve para ver o tema nas três letras e nas
 * três larguras antes de montar uma tela. Nunca existe em produção.
 */
@Component({
  selector: 'app-caregiver-kit-page',
  imports: [
    CgCardComponent,
    CgChoiceGroupComponent,
    CgDoseComponent,
    CgEmergencyNoteComponent,
    CgMoodComponent,
    CgNoteComponent,
    CgPageHeaderComponent,
    CgPlanLockComponent,
    CgPlanTagComponent,
    CgRatingPairComponent,
    CgRowComponent,
    CgSheetComponent,
    CgSwitchComponent,
    CgTextSizeComponent,
    CgTrendComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-page-header title="Kit do cuidador" description="Os componentes do aplicativo, com dados de exemplo." />

    <section class="cg-section"><h2 class="cg-section__title">Avisos calmos</h2>
      <div class="cg-stack cg-stack--tight">
        <app-cg-note variant="care" heading="A equipe de psicologia vai falar com você hoje.">Você não precisa fazer nada.<button cgNoteActions type="button" class="cg-link-btn">Prefere falar agora?</button></app-cg-note>
        <app-cg-note variant="info">Seu plano muda para o Livre em 14/11.</app-cg-note>
        <app-cg-note variant="soft" icon="hourglass">Pedido enviado. A equipe responde em até 24 horas úteis.</app-cg-note>
        <app-cg-note variant="ok">Dado às 08:12.</app-cg-note>
        <app-cg-note variant="late">Passou do horário (08:00).</app-cg-note>
        <app-cg-note variant="error">Informe a data de nascimento.</app-cg-note>
      </div>
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Cartões</h2>
      <div class="cg-grid">
        <app-cg-card title="Próximo compromisso" icon="calendar">Fisioterapia, hoje às 14:00<button cgCardFooter type="button" class="cg-link-btn">Ver agenda</button></app-cg-card>
        <app-cg-card title="Como estou" icon="heart-pulse" link="/cuidador/cuidar-de-mim/como-estou">Anote como você está.</app-cg-card>
        <app-cg-card title="Cartão suave" variant="soft">Texto de apoio em até três linhas.</app-cg-card>
        <app-cg-card title="Cartão de cuidado" variant="care">A equipe está aqui para conversar.</app-cg-card>
      </div>
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Remédios de hoje</h2>
      <div class="cg-stack cg-stack--tight">
        @for (slot of slots; track slot.key) {
          <app-cg-dose [slot]="slot" />
        }
      </div>
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Como você está hoje?</h2>
      <app-cg-mood [(value)]="mood" />
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Lista, escolha e chave</h2>
      <ul class="cg-list">
        <li><app-cg-row title="Meu plano" description="Cuida · R$ 119,90 por mês" icon="credit-card" link="/cuidador/mais/plano" /></li>
        <li><app-cg-row title="Família" description="Compartilhe a rotina" icon="users" link="/cuidador/mais/familia" [current]="true" /></li>
      </ul>
      <div class="cg-section"><app-cg-choice-group legend="Quem você cuida" [options]="options" [(value)]="choice" /></div>
      <app-cg-switch label="Lembrar deste compromisso" hint="Aviso um dia antes." [(checked)]="remind" onText="Você autorizou" offText="Você não autorizou" />
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Plano</h2>
      <div class="cg-stack cg-stack--tight">
        <p><app-cg-plan-tag plan="livre" /> <app-cg-plan-tag plan="essencial" /> <app-cg-plan-tag plan="cuida" /> <app-cg-plan-tag plan="sustenta" /></p>
        <app-cg-plan-lock feature="groups" description="Grupos e capacitações fazem parte do plano Cuida.">As rodas de conversa abertas são para todos.</app-cg-plan-lock>
      </div>
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Avaliar</h2>
      <app-cg-rating-pair [(quality)]="quality" [(punctuality)]="punctuality" />
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Suas conversas de acompanhamento</h2>
      <app-cg-trend [items]="trend" />
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Tamanho da letra</h2>
      <app-cg-text-size [showLegend]="true" />
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Estado vazio e emergência</h2>
      <app-empty-state title="Nenhum remédio cadastrado" text="Cadastre o primeiro para marcar quando der."><button type="button" class="btn btn--primary">Cadastrar um remédio</button></app-empty-state>
      <div class="cg-stack cg-stack--tight"><app-cg-emergency-note /><app-cg-emergency-note variant="full" /></div>
    </section>

    <section class="cg-section"><h2 class="cg-section__title">Folha de baixo</h2>
      <div class="cg-actions">
        <button type="button" class="btn" (click)="sheetOpen.set(true)">Abrir uma confirmação</button>
        <button type="button" class="btn" (click)="contact.open()">Como falar com a gente</button>
      </div>
      <app-cg-sheet heading="Cancelar a conversa?" [(open)]="sheetOpen">
        <p>A conversa de quinta, às 14:00, será cancelada. O horário volta para a agenda.</p>
        <ng-container cgSheetActions>
          <button type="button" class="btn btn--danger" (click)="sheetOpen.set(false)">Cancelar a conversa</button>
          <button type="button" class="cg-link-btn" (click)="sheetOpen.set(false)">Voltar</button>
        </ng-container>
      </app-cg-sheet>
    </section>
  `,
})
export class CaregiverKitPageComponent {
  protected readonly contact = inject(ContactDialogService);

  protected readonly mood = signal<MoodValue | null>(null);
  protected readonly choice = signal<string | null>(null);
  protected readonly remind = signal(true);
  protected readonly quality = signal<CgRatingValue | null>(null);
  protected readonly punctuality = signal<CgRatingValue | null>(null);
  protected readonly sheetOpen = signal(false);

  protected readonly options: readonly CgChoice<string>[] = [
    { value: 'a', label: 'Minha mãe', hint: 'Ela mora comigo.' },
    { value: 'b', label: 'Meu pai' },
  ];
  protected readonly trend: readonly CgTrendItem[] = [
    { id: '1', dateLabel: '04/11', bandLabel: 'Sobrecarga severa', band: 4, scoreText: '63 pontos', latest: true },
    { id: '2', dateLabel: '04/08', bandLabel: 'Sobrecarga moderada a severa', band: 3, scoreText: '48 pontos' },
    { id: '3', dateLabel: '04/05', bandLabel: 'Sobrecarga moderada', band: 2, scoreText: '30 pontos' },
  ];
  /** Remédios de exemplo (nomes genéricos): um dado, um que passou do horário e um a dar. */
  protected readonly slots: readonly DoseSlot[] = [
    { key: 'k1', medicationId: 'm1', medicationName: 'Remédio A', dosage: '50 mg', date: '2026-01-01', time: '08:00', given: true, checkId: 'c1', givenAt: '2026-01-01T08:12:00-03:00' },
    { key: 'k2', medicationId: 'm2', medicationName: 'Remédio B', dosage: '850 mg', date: '2000-01-01', time: '12:00', given: false },
    { key: 'k3', medicationId: 'm1', medicationName: 'Remédio A', dosage: '50 mg', date: '2999-01-01', time: '20:00', given: false },
  ];
}
