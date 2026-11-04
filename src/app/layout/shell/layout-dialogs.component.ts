import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PROTOTYPE_NOTICE } from '../../core/privacy/browser-data.service';
import { SCHEMA_VERSION } from '../../core/storage/migrations';
import { APP_VERSION } from '../../shared/ui/overlay/app-info';
import { GlyphComponent } from '../../shared/ui/overlay/glyph.component';
import { closeModalDialog, showModalDialog } from '../../shared/ui/overlay/modal';
import { ShortcutHelp, shortcutsFor } from '../shortcuts/shortcut.service';
import { LayoutDialogsService } from '../state/layout-dialogs.service';

const GLOSSARY: readonly { term: string; meaning: string }[] = [
  {
    term: 'ARBE',
    meaning:
      'Alerta de risco de esgotamento do cuidador, gerado pelo cruzamento de horas, pedidos de apoio e escala.',
  },
  {
    term: 'ARP',
    meaning:
      'Avaliação da rede profissional: a nota dos prestadores, revista na auditoria quinzenal.',
  },
  { term: 'POP', meaning: 'Procedimento operacional padrão: o passo a passo que a equipe segue.' },
  {
    term: 'Solicitação de serviço',
    meaning: 'Pedido de um cuidador a um prestador da rede credenciada.',
  },
  {
    term: 'Pedido de apoio',
    meaning: 'Mensagem em que o cuidador pede ajuda; entra na conta do alerta de esgotamento.',
  },
  {
    term: 'Solicitação do titular',
    meaning: 'Pedido de acesso, correção ou eliminação de dados, com prazo de 15 dias.',
  },
];

/**
 * Diálogos informativos do shell, abertos pelo `LayoutDialogsService`:
 * - Atalhos de teclado (tecla `?`, menu do usuário, ajuda e rodapé): só os atalhos que o perfil tem, mais o
 *   glossário de termos da equipe e o link da política de privacidade;
 * - Sobre (rodapé): versão, aviso de protótipo e de onde vêm as regras.
 */
@Component({
  selector: 'app-layout-dialogs',
  imports: [GlyphComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #shortcuts
      class="dialog dialog--lg"
      aria-labelledby="nx-shortcuts-title"
      (cancel)="onCancel($event, 'shortcuts')"
      (click)="onBackdrop($event, 'shortcuts')"
    >
      <div class="dialog__header">
        <span class="dialog__icon"><svg appGlyph="circle-help" glyphSize="lg"></svg></span>
        <h2 class="dialog__title" id="nx-shortcuts-title">Atalhos e ajuda</h2>
      </div>
      <div class="dialog__body">
        <p class="t-ui">
          Atalhos de uma tecla só funcionam fora de campo de texto e podem ser desligados no menu do
          usuário. Os que usam
          <kbd class="kbd">Ctrl</kbd> ficam sempre ativos.
        </p>
        @for (group of shortcutGroups(); track group.name) {
          <section>
            <h3 class="t-strong">{{ group.name }}</h3>
            <dl class="dl">
              @for (row of group.rows; track row.text) {
                <dt class="keys">
                  @for (key of row.keys; track $index) {
                    <kbd class="kbd">{{ key }}</kbd>
                  }
                </dt>
                <dd>{{ row.text }}</dd>
              }
            </dl>
          </section>
        }
        <section>
          <h3 class="t-strong">Termos da equipe</h3>
          <dl class="dl">
            @for (g of glossary; track g.term) {
              <dt>{{ g.term }}</dt>
              <dd>{{ g.meaning }}</dd>
            }
          </dl>
        </section>
        <p class="t-ui">
          <a [routerLink]="prefix() + '/canal-do-titular'" (click)="closeAll()"
            >Privacidade e canal do titular</a
          >
        </p>
      </div>
      <div class="dialog__footer">
        <button
          type="button"
          class="btn btn--primary"
          data-role="close"
          (click)="close('shortcuts')"
        >
          Fechar
        </button>
      </div>
    </dialog>

    <dialog
      #about
      class="dialog"
      aria-labelledby="nx-about-title"
      (cancel)="onCancel($event, 'about')"
      (click)="onBackdrop($event, 'about')"
    >
      <div class="dialog__header">
        <span class="dialog__icon"><svg appGlyph="info" glyphSize="lg"></svg></span>
        <h2 class="dialog__title" id="nx-about-title">Sobre o protótipo</h2>
      </div>
      <div class="dialog__body">
        <dl class="dl">
          <dt>Nome</dt>
          <dd>Nexus ERP, back-office da Nexus e portal do profissional credenciado</dd>
          <dt>Versão</dt>
          <dd class="t-num">{{ version }} (dados no formato {{ schema }})</dd>
        </dl>
        <p>{{ notice }}</p>
        <p class="t-ui">
          As regras de negócio vêm do plano de negócios da Nexus. Onde o plano foi omisso, o
          protótipo registra uma suposição, que a sócia vê em Configurações.
        </p>
      </div>
      <div class="dialog__footer">
        <button type="button" class="btn btn--primary" data-role="close" (click)="close('about')">
          Fechar
        </button>
      </div>
    </dialog>
  `,
})
export class LayoutDialogsComponent {
  private readonly service = inject(LayoutDialogsService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly shortcutsRef = viewChild.required<ElementRef<HTMLDialogElement>>('shortcuts');
  private readonly aboutRef = viewChild.required<ElementRef<HTMLDialogElement>>('about');

  /** `/app` ou `/portal`, para o link do canal do titular. */
  readonly area = input<'team' | 'portal'>('team');

  protected readonly glossary = GLOSSARY;
  protected readonly notice = PROTOTYPE_NOTICE;
  protected readonly version = APP_VERSION;
  protected readonly schema = SCHEMA_VERSION;
  protected readonly prefix = computed(() => (this.area() === 'portal' ? '/portal' : '/app'));

  protected readonly shortcutGroups = computed(() => {
    const role = this.auth.role();
    const list: ShortcutHelp[] = role ? shortcutsFor(role) : [];
    const groups = new Map<string, ShortcutHelp[]>();
    list.forEach((s) => groups.set(s.group, [...(groups.get(s.group) ?? []), s]));
    return [...groups.entries()].map(([name, rows]) => ({ name, rows }));
  });

  constructor() {
    effect(() => {
      const open = this.service.shortcutsOpen();
      untracked(() => this.sync(this.shortcutsRef().nativeElement, open));
    });
    effect(() => {
      const open = this.service.aboutOpen();
      untracked(() => this.sync(this.aboutRef().nativeElement, open));
    });
  }

  protected close(which: 'shortcuts' | 'about'): void {
    (which === 'shortcuts' ? this.service.shortcutsOpen : this.service.aboutOpen).set(false);
  }

  protected closeAll(): void {
    this.service.shortcutsOpen.set(false);
    this.service.aboutOpen.set(false);
  }

  protected onCancel(event: Event, which: 'shortcuts' | 'about'): void {
    event.preventDefault();
    this.close(which);
  }

  protected onBackdrop(event: MouseEvent, which: 'shortcuts' | 'about'): void {
    const dialog = (which === 'shortcuts' ? this.shortcutsRef() : this.aboutRef()).nativeElement;
    if (event.target === dialog) {
      this.close(which);
    }
  }

  private sync(dialog: HTMLDialogElement, open: boolean): void {
    if (open) {
      showModalDialog(dialog);
      afterNextRender(() => dialog.querySelector<HTMLElement>('[data-role="close"]')?.focus(), {
        injector: this.injector,
      });
    } else {
      closeModalDialog(dialog);
    }
  }
}
