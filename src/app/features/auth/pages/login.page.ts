import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CAREGIVER_ACCESS_BLOCK_TEXT,
  caregiverAccessBlock,
} from '../../../core/auth/caregiver-access';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { Clock } from '../../../core/clock/clock.service';
import { ageInYears } from '../../../core/clock/date-utils';
import { SubscriptionService } from '../../../core/commerce/subscription.service';
import { Database } from '../../../core/data/database';
import { AppUser, PlanId } from '../../../core/models';
import { PROTOTYPE_NOTICE } from '../../../core/privacy/browser-data.service';
import { StorageService } from '../../../core/storage/storage.service';
import { PlanBadgeComponent } from '../../../shared/ui/display/badge.component';
import { IconComponent } from '../../../shared/ui/display/icon.component';
import { BannerComponent } from '../../../shared/ui/overlay/banner.component';
import { initialsOf, roleLabel } from '../../../shared/ui/overlay/user-display';
import { DEMO_CAREGIVERS } from '../../caregiver-app/state/demo-caregivers';
import { FontScaleService } from '../../caregiver-app/state/font-scale.service';
import { CgIllustrationComponent } from '../../caregiver-app/ui/cg-illustration.component';
import { destinationAfterCaregiverLogin, destinationAfterLogin } from '../return-url';

/** Texto da faixa de armazenamento bloqueado (F01, estados de erro). */
export const STORAGE_BLOCKED_TEXT =
  'O navegador está bloqueando o armazenamento do site, e o protótipo precisa dele. Libere o armazenamento para este endereço e recarregue a página.';

export const TWO_FACTOR_FAILED_TEXT =
  'Por segurança, voltamos à entrada depois de 3 códigos incorretos. Escolha o perfil e tente de novo.';

export const SESSION_EXPIRED_TEXT =
  'Sua sessão terminou por inatividade. Entre de novo para continuar.';

/** Grupos da entrada: a equipe agrupada pela função (Gestão, Psicologia, Atendimento). */
interface ProfileGroup {
  id: string;
  title: string;
  users: readonly AppUser[];
}

/** Uma pessoa de demonstração do aplicativo do cuidador, pronta para o cartão. */
interface DemoPerson {
  id: string;
  name: string;
  age: number;
  planId: PlanId;
  blurb: string;
}

/**
 * Entrada (SCR-M01-01, F01): duas portas. **Sou cuidador(a)** vem primeiro e em destaque: as pessoas de
 * demonstração em cartões simples (nome, plano e uma frase em linguagem comum; 6 de cara e mais 4 em "Ver mais
 * exemplos") e o botão "Criar minha conta". O cuidador NÃO tem senha nem segundo fator. **Sou da equipe Nexus** é
 * a lista de sempre, mais discreta (recolhida; abre sozinha quando a pessoa volta de uma sessão da equipe), com o
 * segundo fator de 6 dígitos. O botão "Ajuda agora" fica no cabeçalho da entrada, como nas outras telas, e "Criar minha
 * conta" logo abaixo do título da porta, antes da lista de pessoas de exemplo (CXC-014). Mostra o aviso de protótipo (AC-GL-05, RN-LGPD-25) e, quando é o caso, a faixa do
 * motivo de a pessoa estar de volta aqui (3 códigos errados, inatividade, armazenamento bloqueado).
 *
 * As frases das pessoas vêm de `features/caregiver-app/state/demo-caregivers.ts`, não do seed da equipe.
 */
@Component({
  selector: 'app-login-page',
  imports: [BannerComponent, CgIllustrationComponent, IconComponent, NgTemplateOutlet, PlanBadgeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <section class="login__brand" aria-label="Nexus">
        <div class="login__logo">
          <svg class="brand-symbol" aria-hidden="true">
            <use href="icons/sprite.svg#nx-symbol" />
          </svg>
          <span class="wordmark">Nexus</span>
        </div>
        <app-cg-illustration class="login__scene" name="welcome" size="fill" tone="light" />
        <app-cg-illustration class="login__mini-art" name="welcome" size="sm" tone="light" />
        <div class="stack stack--3">
          <p class="login__tagline">Quem cuida também precisa de sustentação.</p>
          <p class="login__note">
            Protótipo da Nexus. Escolha como entrar: o aplicativo de quem cuida ou o back-office da equipe.
          </p>
        </div>
      </section>

      <main class="login__panel" id="conteudo" tabindex="-1">
        <app-banner variant="prototype">{{ notice }}</app-banner>

        @if (reason(); as text) {
          <app-banner variant="attention" liveRole="alert">{{ text }}</app-banner>
        }
        @if (caregiverSession.justSignedOut()) {
          <app-banner variant="info" liveRole="status">Você saiu. Até a próxima.</app-banner>
        }
        @if (storageBlocked()) {
          <app-banner variant="danger" heading="Armazenamento bloqueado">{{
            blockedText
          }}</app-banner>
        }

        <div class="login__head">
          <div class="login__head-text">
            <h1>Entrar</h1>
            <p class="page-header__desc">Escolha como você quer entrar.</p>
          </div>
          <a class="login__help" routerLink="/cuidador/ajuda-agora" data-role="help-now">
            <svg appIcon="life-buoy" size="lg"></svg>
            <span>Ajuda agora</span>
          </a>
        </div>

        <section class="cg-door" aria-labelledby="nx-door-caregiver" [attr.data-text]="fontScale()">
          <h2 class="cg-door__title" id="nx-door-caregiver">Sou cuidador(a)</h2>
          <p class="cg-door__lead">Para quem cuida de uma pessoa idosa.</p>

          <div class="cg-door__actions">
            <a class="btn btn--primary" routerLink="/cuidador/comecar" data-role="create-account">Criar minha conta</a>
          </div>

          <p class="cg-door__lead">Para entrar, escolha uma pessoa de exemplo. Neste protótipo não há senha.</p>

          @if (caregiverError(); as text) {
            <app-banner variant="attention" liveRole="alert">{{ text }}</app-banner>
          }

          <ul class="cg-door__list" aria-label="Pessoas de demonstração">
            @for (person of visiblePeople(); track person.id) {
              <li>
                <button
                  type="button"
                  class="cg-door__person"
                  [attr.data-caregiver]="person.id"
                  [attr.aria-label]="
                    'Entrar como ' + person.name + ', ' + person.age + ' anos, plano ' + planName(person.planId) + '. ' + person.blurb
                  "
                  (click)="chooseCaregiver(person.id)"
                >
                  <span class="avatar" aria-hidden="true" [attr.data-tone]="tone(person.id)">{{ initials(person.name) }}</span>
                  <span class="cg-door__text">
                    <span class="cg-door__name">{{ person.name }}, {{ person.age }} anos</span>
                    <app-plan-badge class="cg-door__plan" [plan]="person.planId" />
                    <span class="cg-door__blurb">{{ person.blurb }}</span>
                  </span>
                  <svg appIcon="chevron-right"></svg>
                </button>
              </li>
            }
          </ul>

          @if (morePeople().length > 0) {
            <button
              type="button"
              class="cg-link-btn cg-door__more"
              data-role="more-examples"
              [attr.aria-expanded]="showMore()"
              (click)="toggleMore()"
            >
              {{ showMore() ? 'Ver menos exemplos' : 'Ver mais exemplos' }}
            </button>
          }

          <p class="cg-door__emergency">Em emergência, ligue 192 (SAMU).</p>
        </section>

        <section
          class="cg-door cg-door--staff cg-accordion"
          aria-labelledby="nx-door-staff"
          [class.cg-accordion--open]="staffOpen()"
          #staffDoor
        >
          <h2 class="cg-accordion__heading" id="nx-door-staff">
            <button
              type="button"
              class="cg-accordion__trigger"
              data-role="staff-toggle"
              [attr.aria-expanded]="staffOpen()"
              aria-controls="nx-door-staff-body"
              aria-label="Sou da equipe Nexus"
              aria-describedby="nx-door-staff-hint"
              (click)="toggleStaff(staffDoor)"
            >
              <span class="cg-accordion__icon" aria-hidden="true"><svg appIcon="layout-dashboard"></svg></span>
              <span class="cg-accordion__text">
                <span class="cg-accordion__title">Sou da equipe Nexus</span>
                <span class="cg-accordion__hint" id="nx-door-staff-hint">Painel de trabalho da equipe, com código de confirmação</span>
              </span>
              <svg class="cg-accordion__chevron" appIcon="chevron-down" aria-hidden="true"></svg>
            </button>
          </h2>
          <div class="cg-accordion__panel" id="nx-door-staff-body" [hidden]="!staffOpen()">
            @if (staffOpen()) {
              @for (group of groups(); track group.id) {
                <section class="profile-group" [attr.aria-labelledby]="'nx-login-' + group.id">
                  <h3 [id]="'nx-login-' + group.id">{{ group.title }} ({{ group.users.length }})</h3>
                  <div class="list-card">
                    @for (user of group.users; track user.id) {
                      <ng-container
                        [ngTemplateOutlet]="card"
                        [ngTemplateOutletContext]="{ $implicit: user }"
                      />
                    }
                  </div>
                </section>
              }
            }
          </div>
        </section>
      </main>
    </div>

    <ng-template #card let-user>
      <button
        type="button"
        class="list-row"
        [attr.aria-disabled]="user.active ? null : 'true'"
        [attr.aria-label]="
          'Entrar como ' + user.displayName + '. ' + role(user) + '. ' + user.demoDescription
        "
        (click)="choose(user)"
      >
        <span class="avatar">{{ initials(user.displayName) }}</span>
        <span>
          <span class="list-row__title">{{ user.displayName }}</span>
          <span class="list-row__meta">{{ role(user) }}</span>
          <span class="list-row__meta list-row__meta--wrap">{{ user.demoDescription }}</span>
        </span>
        @if (!user.active) {
          <span class="badge badge--outline">Acesso desativado</span>
        } @else if (user.requiresTwoFactor) {
          <span class="badge"><svg appIcon="key-round" size="sm"></svg>Código</span>
        } @else {
          <svg appIcon="chevron-right"></svg>
        }
      </button>
    </ng-template>
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly caregiverSession = inject(CaregiverSessionService);
  private readonly clock = inject(Clock);
  private readonly injector = inject(Injector);
  private readonly db = inject(Database);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  /** A entrada também respeita o tamanho da letra que a pessoa escolheu no aplicativo (CXC-022). */
  protected readonly fontScale = inject(FontScaleService).scale;

  protected readonly notice = PROTOTYPE_NOTICE;
  protected readonly blockedText = STORAGE_BLOCKED_TEXT;

  /** Por que a pessoa voltou à entrada (F01): três códigos errados, inatividade ou saída da equipe. */
  private readonly endReason = this.auth.endReason;

  /** A lista da equipe começa recolhida; abre quando a pessoa vem de uma sessão da equipe ou de um link `/app`. */
  protected readonly staffOpen = signal(
    this.auth.endReason() !== null || (this.auth.peekReturnUrl()?.startsWith('/app') ?? false),
  );
  protected readonly showMore = signal(false);
  protected readonly caregiverError = signal<string | null>(null);

  /** As pessoas de demonstração que existem no banco (nome e plano vêm do cadastro). */
  private readonly people = computed<DemoPerson[]>(() =>
    DEMO_CAREGIVERS.flatMap((demo) => {
      const caregiver = this.db.caregivers.get(demo.id);
      // Cadastro encerrado, anonimizado ou eliminado NÃO aparece (AC-CG-20); pedido de exclusão aberto aparece.
      return caregiver && caregiverAccessBlock(caregiver) === null
        ? [
            {
              id: demo.id,
              name: caregiver.fullName,
              age: ageInYears(caregiver.birthDate, this.clock.today()),
              planId: this.subscriptions.planOf(demo.id),
              blurb: demo.blurb,
            },
          ]
        : [];
    }),
  );
  private readonly featured = computed(() => {
    const featuredIds = new Set(DEMO_CAREGIVERS.filter((d) => d.featured).map((d) => d.id));
    return this.people().filter((p) => featuredIds.has(p.id));
  });
  protected readonly morePeople = computed(() => {
    const featuredIds = new Set(this.featured().map((p) => p.id));
    return this.people().filter((p) => !featuredIds.has(p.id));
  });
  protected readonly visiblePeople = computed(() =>
    this.showMore() ? [...this.featured(), ...this.morePeople()] : this.featured(),
  );

  protected readonly groups = computed<ProfileGroup[]>(() => {
    const users = this.auth.demoUsers();
    const of = (...roles: AppUser['role'][]): AppUser[] =>
      users.filter((u) => roles.includes(u.role));
    return [
      { id: 'management', title: 'Gestão', users: of('partner', 'technical_lead') },
      { id: 'psychology', title: 'Psicologia', users: of('psychologist') },
      { id: 'support', title: 'Atendimento', users: of('support') },
    ].filter((g) => g.users.length > 0);
  });

  protected readonly reason = computed(() => {
    switch (this.endReason()) {
      case 'two_factor_failures':
        return TWO_FACTOR_FAILED_TEXT;
      case 'inactivity':
        return SESSION_EXPIRED_TEXT;
      default:
        return null;
    }
  });

  protected readonly storageBlocked = computed(() =>
    this.storage.notices().some((n) => n.kind === 'unavailable'),
  );

  /** "Ver mais exemplos": abre os 4 outros e leva o foco ao primeiro cartão novo (AC-CG-19). */
  protected toggleMore(): void {
    const opening = !this.showMore();
    this.showMore.set(opening);
    const first = this.morePeople()[0];
    if (opening && first) {
      afterNextRender(
        () => document.querySelector<HTMLElement>(`[data-caregiver="${first.id}"]`)?.focus(),
        { injector: this.injector },
      );
    }
  }

  /**
   * Abre e fecha a lista da equipe (acordeão). Ao abrir, a tela rola até o começo do bloco para a lista aparecer: o foco
   * fica no botão (Enter e Espaço continuam fechando) e a rolagem respeita "reduzir movimento".
   */
  protected toggleStaff(door: HTMLElement): void {
    const opening = !this.staffOpen();
    this.staffOpen.set(opening);
    if (opening) {
      afterNextRender(
        () => {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
          door.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        },
        { injector: this.injector },
      );
    }
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }

  /** A cor suave do avatar de cada pessoa de exemplo (1 a 5), sempre a mesma para a mesma pessoa. */
  protected tone(caregiverId: string): number {
    const index = DEMO_CAREGIVERS.findIndex((d) => d.id === caregiverId);
    return (Math.max(index, 0) % 5) + 1;
  }

  protected role(user: AppUser): string {
    return roleLabel(user.role);
  }

  protected planName(planId: PlanId): string {
    return this.db.plans.get(planId)?.name.replace(/^Nexus\s+/, '') ?? planId;
  }

  /** O cuidador entra sem senha e sem segundo fator, direto no aplicativo (ou no link que pediu antes). */
  protected chooseCaregiver(caregiverId: string): void {
    const outcome = this.caregiverSession.signIn(caregiverId);
    if (outcome.status === 'ok') {
      this.caregiverError.set(null);
      void this.router.navigateByUrl(destinationAfterCaregiverLogin(this.auth.consumeReturnUrl()));
    } else {
      this.caregiverError.set(CAREGIVER_ACCESS_BLOCK_TEXT[outcome.reason]);
    }
  }

  /** Escolhe o perfil da equipe: vai ao segundo fator (F01). */
  protected choose(user: AppUser): void {
    if (!user.active) {
      return;
    }
    const outcome = this.auth.selectProfile(user.id);
    if (outcome.status === 'needs_two_factor') {
      void this.router.navigateByUrl('/login/2fa');
    } else if (outcome.status === 'authenticated') {
      void this.router.navigateByUrl(
        destinationAfterLogin(user.role, this.auth.consumeReturnUrl()),
      );
    }
  }
}
