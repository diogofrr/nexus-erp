import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/display/icon.component';
import { CgHeroComponent } from '../../ui/cg-hero.component';
import { CgNoteComponent } from '../../ui/cg-note.component';
import { CgProgressRingComponent } from '../../ui/cg-progress-ring.component';
import { GUIDE_PHASE_TITLES, GUIDE_STEPS, GuidePhase, GuideStep } from '../state/guide-content';
import { GuideProgressService } from '../state/guide-progress.service';

/**
 * Começando a cuidar (`/cuidador/mais/guia`): o essencial para quem acabou de virar cuidador, em 9 passos e duas fases
 * (primeiros dias, primeiras semanas). Cada passo fecha em uma linha (título e por que importa) e abre com o como fazer,
 * o atalho para a tela certa do aplicativo e "Marcar como feito". O anel mostra quantos passos já foram feitos; o
 * progresso fica salvo no navegador, por pessoa. As dicas são fixas e estão sempre no aplicativo.
 */
@Component({
  selector: 'app-guide-first-steps-page',
  imports: [RouterLink, IconComponent, CgHeroComponent, CgNoteComponent, CgProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .gd-progress {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: var(--cg-pad-card);
      border-radius: var(--cg-radius-card);
      background: var(--cg-surface);
      box-shadow: var(--cg-shadow-1);
    }
    .gd-progress__text { display: grid; gap: 0.25rem; min-width: 0; }
    .gd-progress__title { margin: 0; font-weight: var(--fw-semibold); color: var(--cg-heading); font-size: var(--cg-fs-lead); }
    .gd-progress__hint { margin: 0; color: var(--cg-text-soft); font-size: var(--cg-fs-small); }
    .gd-phase { display: grid; gap: var(--cg-gap-stack); margin-top: 2rem; }
    .gd-phase__title { margin: 0 0 0.25rem; font-family: var(--font-serif); font-weight: 400; }
    .gd-steps { display: grid; gap: var(--cg-gap-stack); margin: 0; padding: 0; list-style: none; }
    .gd-step {
      border-radius: var(--cg-radius-card);
      background: var(--cg-surface);
      box-shadow: var(--cg-shadow-1);
      transition: background var(--cg-dur-sheet) var(--ease), box-shadow var(--cg-dur-sheet) var(--ease);
    }
    .gd-step.is-done { background: var(--cg-ok-bg); box-shadow: none; }
    .gd-step > summary {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 1rem;
      min-height: var(--cg-row-h);
      padding: 1rem 1.125rem;
      list-style: none;
      cursor: pointer;
      border-radius: var(--cg-radius-card);
    }
    .gd-step > summary::-webkit-details-marker { display: none; }
    .gd-step > summary:focus-visible { outline-offset: -3px; }
    .gd-step__badge {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      background: var(--cg-acc-strong);
      color: var(--cg-acc-ink);
      font-weight: var(--fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .gd-step.is-done .gd-step__badge { background: var(--cg-ok-icon); color: #ffffff; }
    .gd-step__head { display: grid; gap: 0.125rem; min-width: 0; }
    .gd-step__title { font-weight: var(--fw-semibold); color: var(--cg-heading); overflow-wrap: anywhere; }
    .gd-step__why { color: var(--cg-text-soft); font-size: var(--cg-fs-small); line-height: 1.4; }
    .gd-step__state { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--cg-ok-fg); font-size: var(--cg-fs-small); font-weight: var(--fw-semibold); }
    .gd-step__chevron { color: var(--cg-text-soft); transition: transform var(--cg-dur-sheet) var(--ease); }
    .gd-step[open] .gd-step__chevron { transform: rotate(180deg); }
    .gd-step__body { display: grid; gap: 1rem; padding: 0 1.125rem 1.125rem calc(1.125rem + 2.75rem + 1rem); }
    @media (max-width: 29.99rem) { .gd-step__body { padding-inline-start: 1.125rem; } }
    .gd-todo { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
    .gd-todo li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.625rem; align-items: start; }
    .gd-todo li::before { content: ''; width: 0.5rem; height: 0.5rem; margin-top: 0.6em; border-radius: 50%; background: var(--cg-acc-solid); }
    .gd-step__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
    .gd-step__actions .btn[aria-pressed='true'] { --btn-bg: var(--cg-ok-bg); --btn-bd: var(--cg-ok-border); --btn-fg: var(--cg-ok-fg); --btn-bg-hover: var(--cg-ok-border); }
    .gd-foot { margin-top: 2rem; }
  `,
  template: `
    <app-cg-hero
      title="Começando a cuidar"
      description="O essencial para os primeiros dias. Vá no seu ritmo."
      illustration="welcome"
      backLink="/cuidador/mais"
      backLabel="Mais"
    />

    <section class="gd-progress" aria-labelledby="gd-progress-title" data-role="guide-progress">
      <app-cg-progress-ring [value]="progress.doneCount()" [max]="progress.total" label="passos feitos" size="md" />
      <div class="gd-progress__text">
        <h2 class="gd-progress__title" id="gd-progress-title">{{ progress.progressText() }}</h2>
        <p class="gd-progress__hint">Toque em um passo para ver como fazer. O que você marca fica salvo neste aparelho.</p>
      </div>
    </section>

    @for (phase of phases; track phase) {
      <section class="gd-phase" [attr.aria-labelledby]="'gd-phase-' + phase" [attr.data-phase]="phase">
        <h2 class="gd-phase__title" [id]="'gd-phase-' + phase">{{ phaseTitles[phase] }}</h2>
        <ol class="gd-steps">
          @for (step of stepsOf(phase); track step.id) {
            <li>
              <details class="gd-step" [class.is-done]="progress.isDone(step.id)" [attr.data-step]="step.id">
                <summary>
                  <span class="gd-step__badge" aria-hidden="true">
                    @if (progress.isDone(step.id)) {
                      <svg appIcon="check" size="md"></svg>
                    } @else {
                      {{ numberOf(step) }}
                    }
                  </span>
                  <span class="gd-step__head">
                    <span class="gd-step__title">{{ step.title }}</span>
                    <span class="gd-step__why">{{ step.why }}</span>
                    @if (progress.isDone(step.id)) {
                      <span class="gd-step__state"><svg appIcon="circle-check" size="sm"></svg> Feito</span>
                    }
                  </span>
                  <svg class="gd-step__chevron" appIcon="chevron-down" aria-hidden="true"></svg>
                </summary>
                <div class="gd-step__body">
                  <ul class="gd-todo">
                    @for (item of step.todo; track $index) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                  <div class="gd-step__actions">
                    <button
                      type="button"
                      class="btn"
                      [attr.aria-pressed]="progress.isDone(step.id)"
                      data-role="toggle-done"
                      (click)="progress.toggle(step.id)"
                    >
                      @if (progress.isDone(step.id)) {
                        <svg appIcon="check" size="sm"></svg> Feito
                      } @else {
                        Marcar como feito
                      }
                    </button>
                    @if (step.link; as link) {
                      <a class="cg-link-btn" [routerLink]="link.path">{{ link.label }}</a>
                    }
                  </div>
                </div>
              </details>
            </li>
          }
        </ol>
      </section>
    }

    <div class="gd-foot cg-stack cg-stack--tight">
      <app-cg-note variant="soft" icon="info">
        Estas dicas ajudam a se organizar e não substituem a orientação dos profissionais de saúde que acompanham a pessoa.
      </app-cg-note>
      <a class="cg-link-btn" routerLink="/cuidador/mais/guia/perguntas" data-role="to-faq">Ver as perguntas frequentes</a>
    </div>
  `,
})
export class GuideFirstStepsPage {
  protected readonly progress = inject(GuideProgressService);
  protected readonly phases: readonly GuidePhase[] = ['first_days', 'first_weeks'];
  protected readonly phaseTitles = GUIDE_PHASE_TITLES;

  protected stepsOf(phase: GuidePhase): GuideStep[] {
    return GUIDE_STEPS.filter((s) => s.phase === phase);
  }

  /** Número do passo no guia inteiro (1 a 9), para a ordem continuar de uma fase para a outra. */
  protected numberOf(step: GuideStep): number {
    return GUIDE_STEPS.indexOf(step) + 1;
  }
}
