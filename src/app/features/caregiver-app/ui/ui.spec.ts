import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { DoseSlot, dosesForDate } from '../../../core/rules/medication-doses';
import { configureCoreTest } from '../../../core/testing/test-helpers';
import { ContactDialogService } from '../state/contact-dialog.service';
import { HistoryLayersService } from '../state/history-layers.service';
import { BootedCaregiverApp, bootCaregiverApp, settleCaregiver } from '../testing';
import {
  CG_NAV_ITEMS,
  CgCardComponent,
  CgChoice,
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
  CgTrendComponent,
  CgTrendItem,
  trendItemLabel,
  MOOD_OPTIONS,
  MoodValue,
  CgRatingValue,
  moodLabel,
  ratingPairMissingText,
} from './index';

const click = (el: Element | null | undefined): void => {
  if (!el) {
    throw new Error('elemento não encontrado');
  }
  (el as HTMLElement).click();
};
const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

@Component({
  selector: 'app-kit-host',
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
    CgTrendComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-page-header title="Remédios" description="Marque o que você já deu hoje." backLink="/cuidador/hoje" backLabel="Hoje" />
    <app-cg-card title="Próximo compromisso" icon="calendar" variant="care">Fisioterapia, hoje às 14:00</app-cg-card>
    <app-cg-card title="Como estou" link="/cuidador/cuidar-de-mim/como-estou">Anote como você está.</app-cg-card>
    <app-cg-note variant="care" heading="A equipe vai falar com você hoje">Por telefone.</app-cg-note>
    <app-cg-note variant="error">Informe a data.</app-cg-note>
    <ul class="cg-list">
      <li><app-cg-row title="Meu plano" description="Cuida" icon="credit-card" link="/cuidador/mais/plano" /></li>
      <li><app-cg-row title="Sair" [chevron]="false" (activated)="rowTapped.set(rowTapped() + 1)" /></li>
    </ul>
    <app-cg-choice-group legend="Quem você cuida" [options]="options" [(value)]="choice" />
    <app-cg-switch label="Lembrar deste compromisso" hint="Aviso um dia antes." [(checked)]="remind" />
    <app-cg-mood [(value)]="mood" (chosen)="chosen.set([...chosen(), $event])" />
    @for (slot of slots(); track slot.key) {
      <app-cg-dose [slot]="slot" (dei)="dei.set([...dei(), $event.time])" (undo)="undone.set([...undone(), $event.time])" />
    }
    <app-cg-plan-lock feature="groups" description="Grupos e capacitações fazem parte do plano Cuida.">
      As rodas de conversa abertas são para todos.
    </app-cg-plan-lock>
    <app-cg-plan-lock feature="agenda_reminders" description="não deve aparecer" />
    <section data-role="nested">
      <h2>Seção com título</h2>
      <app-cg-card [headingLevel]="3" title="Cartão dentro da seção">Texto.</app-cg-card>
      <app-cg-plan-lock [headingLevel]="3" feature="groups" description="Dentro da seção." />
    </section>
    <app-cg-rating-pair [(quality)]="quality" [(punctuality)]="punctuality" />
    <app-cg-trend [items]="trend" />
    <app-cg-plan-tag plan="sustenta" />
    <app-cg-emergency-note />
    <app-cg-emergency-note variant="full" />
    <app-cg-sheet heading="Cancelar a conversa?" [(open)]="sheetOpen">
      <p>A conversa será cancelada.</p>
      <ng-container cgSheetActions>
        <button type="button" class="btn btn--primary" data-role="confirm">Cancelar a conversa</button>
        <button type="button" class="cg-link-btn" data-role="back" (click)="sheetOpen.set(false)">Voltar</button>
      </ng-container>
    </app-cg-sheet>
  `,
})
class KitHostComponent {
  readonly options: CgChoice<string>[] = [
    { value: 'mae', label: 'Minha mãe', hint: 'Ela mora comigo.' },
    { value: 'pai', label: 'Meu pai' },
  ];
  readonly choice = signal<string | null>(null);
  readonly remind = signal(false);
  readonly mood = signal<MoodValue | null>(null);
  readonly chosen = signal<MoodValue[]>([]);
  readonly rowTapped = signal(0);
  readonly dei = signal<string[]>([]);
  readonly undone = signal<string[]>([]);
  readonly slots = signal<DoseSlot[]>([]);
  readonly quality = signal<CgRatingValue | null>(null);
  readonly punctuality = signal<CgRatingValue | null>(null);
  readonly sheetOpen = signal(false);
  readonly trend: CgTrendItem[] = [
    { id: 'a', dateLabel: '04/11', bandLabel: 'Sobrecarga severa', band: 4, scoreText: '63 pontos', latest: true },
    { id: 'b', dateLabel: '10/08', bandLabel: 'Sobrecarga moderada a severa', band: 3, scoreText: '48 pontos' },
  ];
}

function mountKit(caregiverId: string | null, time = '12:00'): ComponentFixture<KitHostComponent> {
  configureCoreTest({ seed: true, time, providers: [provideRouter([])] });
  if (caregiverId) {
    TestBed.inject(CaregiverSessionService).signIn(caregiverId);
  }
  const fixture = TestBed.createComponent(KitHostComponent);
  const host = fixture.componentInstance;
  const db = TestBed.inject(CaregiverSessionService);
  void db;
  host.slots.set(
    dosesForDate(
      '2026-11-04',
      [
        { id: 'm1', elderId: 'x', name: 'Losartana', dosage: '50 mg', times: ['08:00', '12:00', '20:00'], active: true, createdAt: '', updatedAt: '' },
      ],
      [{ id: 'd1', medicationId: 'm1', date: '2026-11-04', time: '12:00', givenAt: '2026-11-04T12:08:00-03:00', createdAt: '', updatedAt: '' }],
    ),
  );
  fixture.detectChanges();
  return fixture;
}

describe('Kit visual do aplicativo do cuidador (UX Parte A)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const root = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const all = <T extends Element = HTMLElement>(f: ComponentFixture<unknown>, s: string): T[] =>
    Array.from(root(f).querySelectorAll<T>(s));

  it('cabeçalho de página: um h1, apoio e "Voltar" com o nome da tela para leitor de tela', () => {
    const f = mountKit('cg_0001');
    expect(all(f, 'h1')).toHaveLength(1);
    expect(text(root(f).querySelector('h1'))).toBe('Remédios');
    expect(text(root(f).querySelector('.cg-page-header__desc'))).toBe('Marque o que você já deu hoje.');
    const back = root(f).querySelector('.cg-page-header__back');
    expect(back?.getAttribute('href')).toBe('/cuidador/hoje');
    expect(text(back)).toBe('Voltar para Hoje');
  });

  it('cartão: seção com título h2 (padrão) ligado por aria-labelledby; com link, o cartão inteiro é um único <a>', () => {
    const f = mountKit('cg_0001');
    const sections = all(f, 'section.cg-card');
    const care = sections.find((s) => text(s).includes('Próximo compromisso'));
    expect(care?.classList.contains('cg-card--care')).toBe(true);
    const titleId = care?.getAttribute('aria-labelledby') ?? '';
    expect(root(f).querySelector(`#${titleId}`)?.tagName).toBe('H2');
    const link = all(f, 'a.cg-card--link')[0];
    expect(link?.getAttribute('href')).toBe('/cuidador/cuidar-de-mim/como-estou');
    expect(link?.querySelectorAll('a, button')).toHaveLength(0);
    expect(text(link)).toContain('Anote como você está.');
  });

  it('QAC-009: dentro de uma seção com h2, o cartão e o bloqueio de plano usam h3 (headingLevel), sem pular de h1 para h3', () => {
    const f = mountKit('cg_0002');
    const nested = root(f).querySelector('[data-role="nested"]');
    expect(nested?.querySelector('app-cg-card .cg-card__title')?.tagName).toBe('H3');
    expect(nested?.querySelector('app-cg-plan-lock .cg-card__title')?.tagName).toBe('H3');
    // Fora da seção o padrão é h2: nenhum h3 solto antes de um h2.
    const levels = all(f, 'h1, h2, h3').map((h) => Number(h.tagName.slice(1)));
    levels.forEach((level, index) => {
      if (index > 0) {
        expect(level - (levels[index - 1] as number)).toBeLessThanOrEqual(1);
      }
    });
  });

  it('aviso calmo: ícone e texto; só o erro é role=alert', () => {
    const f = mountKit('cg_0001');
    const notes = all(f, '.cg-note');
    expect(notes[0]?.classList.contains('cg-note--care')).toBe(true);
    expect(notes[0]?.getAttribute('role')).toBe('status');
    expect(text(notes[0]?.querySelector('.cg-note__title'))).toBe('A equipe vai falar com você hoje');
    expect(notes[0]?.querySelector('svg.cg-note__icon')).not.toBeNull();
    expect(notes[1]?.getAttribute('role')).toBe('alert');
  });

  it('item de lista: link ou botão, a linha inteira é o alvo, e botão avisa ao tocar', () => {
    const f = mountKit('cg_0001');
    const rows = all(f, '.cg-row');
    expect(rows[0]?.tagName).toBe('A');
    expect(rows[0]?.getAttribute('href')).toBe('/cuidador/mais/plano');
    expect(text(rows[0])).toContain('Meu plano');
    expect(text(rows[0])).toContain('Cuida');
    expect(rows[1]?.tagName).toBe('BUTTON');
    click(rows[1]);
    expect(f.componentInstance.rowTapped()).toBe(1);
  });

  it('escolha única: rádio nativo, nada marcado, a linha inteira escolhe e o selecionado ganha a classe', () => {
    const f = mountKit('cg_0001');
    const inputs = all<HTMLInputElement>(f, '.cg-choice__input');
    expect(inputs.every((i) => !i.checked)).toBe(true);
    expect(new Set(inputs.map((i) => i.name)).size).toBe(1);
    inputs[1]?.click();
    f.detectChanges();
    expect(f.componentInstance.choice()).toBe('pai');
    expect(all(f, '.cg-choice.is-selected')).toHaveLength(1);
    expect(text(root(f).querySelector('legend.cg-choices__legend'))).toBe('Quem você cuida');
  });

  it('chave: role=switch, estado escrito e a linha inteira é o botão', () => {
    const f = mountKit('cg_0001');
    const button = root(f).querySelector<HTMLButtonElement>('.cg-switch');
    expect(button?.getAttribute('role')).toBe('switch');
    expect(button?.getAttribute('aria-checked')).toBe('false');
    expect(text(root(f).querySelector('.cg-switch__state'))).toBe('Desligado');
    click(button);
    f.detectChanges();
    expect(f.componentInstance.remind()).toBe(true);
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(text(root(f).querySelector('.cg-switch__state'))).toBe('Ligado');
  });

  it('humor: 5 opções com o mesmo visual, nada marcado, nome acessível completo e grava ao tocar', () => {
    const f = mountKit('cg_0001');
    expect(MOOD_OPTIONS.map((o) => o.label)).toEqual(['Muito mal', 'Mal', 'Mais ou menos', 'Bem', 'Muito bem']);
    expect(moodLabel(4)).toBe('Bem');
    const group = root(f).querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Como você está hoje');
    const inputs = all<HTMLInputElement>(f, '.cg-mood__input');
    expect(inputs).toHaveLength(5);
    expect(inputs.every((i) => !i.checked)).toBe(true);
    expect(inputs[2]?.getAttribute('aria-label')).toBe('Mais ou menos, 3 de 5');
    inputs[3]?.click();
    f.detectChanges();
    expect(f.componentInstance.mood()).toBe(4);
    expect(f.componentInstance.chosen()).toEqual([4]);
    expect(all(f, '.cg-mood__option.is-selected')).toHaveLength(1);
    // Mudar o humor do dia emite de novo.
    inputs[1]?.click();
    expect(f.componentInstance.chosen()).toEqual([4, 2]);
  });

  it('dose: dado mostra "Dado às 12:08" e Desfazer; passou do horário em âmbar; no horário o Dei é primário; mais tarde o Dei é secundário', () => {
    // Agora são 12:00 (relógio simulado). As doses: 08:00 (passou), 12:00 (dada) e 20:00 (a dar).
    const f = mountKit('cg_0001');
    const doses = all(f, '.cg-dose');
    expect(doses).toHaveLength(3);
    // 08:00 passou do horário.
    expect(doses[0]?.classList.contains('is-late')).toBe(true);
    expect(text(doses[0]?.querySelector('.cg-dose__state--late'))).toBe('Ainda não anotado');
    expect(text(doses[0])).not.toMatch(/passou/i);
    expect(doses[0]?.querySelector('button')?.classList.contains('btn--primary')).toBe(true);
    expect(doses[0]?.querySelector('button')?.getAttribute('aria-label')).toBe('Dei o Losartana das 08:00');
    // 12:00 dada.
    expect(doses[1]?.classList.contains('is-given')).toBe(true);
    expect(text(doses[1]?.querySelector('.cg-dose__state--ok'))).toBe('Dado às 12:08');
    const undo = doses[1]?.querySelector('button');
    expect(text(undo)).toBe('Desfazer');
    // CXC-008: o Desfazer é um link pequeno dentro do texto, longe do lugar do Dei (que é o botão da direita).
    expect(undo?.classList.contains('cg-link-btn')).toBe(true);
    expect(undo?.closest('.cg-dose__text')).not.toBeNull();
    expect(doses[1]?.querySelector('.cg-dose__action')).toBeNull();
    expect(undo?.getAttribute('aria-label')).toBe('Desfazer: Losartana das 12:00 dado às 12:08');
    // 20:00 a dar: botão secundário.
    expect(doses[2]?.querySelector('button')?.classList.contains('btn--primary')).toBe(false);
    expect(doses[2]?.classList.contains('is-late')).toBe(false);
    // Eventos.
    click(doses[2]?.querySelector('button'));
    click(undo);
    expect(f.componentInstance.dei()).toEqual(['20:00']);
    expect(f.componentInstance.undone()).toEqual(['12:00']);
  });

  it('CXC-008: um toque em Desfazer até 1 s depois do Dei é ignorado; depois disso, desfaz', () => {
    const f = mountKit('cg_0001');
    const host = f.componentInstance;
    const slot = host.slots()[2] as DoseSlot;
    // A dose das 20:00 ainda é "a dar"; a tela a marca como dada (o componente guarda o instante do toque).
    const dose = all(f, '.cg-dose')[2];
    click(dose?.querySelector('button'));
    expect(host.dei()).toEqual(['20:00']);
    host.slots.set(host.slots().map((item) => (item.key === slot.key ? { ...item, given: true, givenAt: '2026-11-04T12:01:00-03:00' } : item)));
    f.detectChanges();
    const undo = all(f, '.cg-dose')[2]?.querySelector('button.cg-dose__undo');
    expect(undo).not.toBeNull();
    click(undo);
    expect(host.undone()).toEqual([]);
    const realNow = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1500);
    click(undo);
    realNow.mockRestore();
    expect(host.undone()).toEqual(['20:00']);
  });

  it('C4: com o foco no Dei (teclado), marcar leva o foco ao Desfazer da mesma linha, e o Desfazer o devolve ao Dei; sem foco na linha, nada rouba o foco', async () => {
    const f = mountKit('cg_0001');
    const host = f.componentInstance;
    const row = (): HTMLElement | undefined => all(f, '.cg-dose')[2];
    const settle = async (): Promise<void> => {
      f.detectChanges();
      await f.whenStable();
    };
    const setGiven = (given: boolean): void => {
      const slot = host.slots()[2] as DoseSlot;
      host.slots.set(
        host.slots().map((item): DoseSlot => {
          if (item.key !== slot.key) {
            return item;
          }
          const { givenAt: _previous, ...rest } = item;
          return given ? { ...rest, given, givenAt: '2026-11-04T12:01:00-03:00' } : { ...rest, given };
        }),
      );
    };
    const dei = row()?.querySelector<HTMLButtonElement>('.cg-dose__action');
    dei?.focus();
    expect(document.activeElement).toBe(dei);
    click(dei);
    setGiven(true);
    await settle();
    // O botão Dei saiu da tela: o foco não se perde no corpo da página.
    expect(row()?.querySelector('.cg-dose__action')).toBeNull();
    expect(document.activeElement).toBe(row()?.querySelector('.cg-dose__undo'));
    // Depois do tempo de guarda, o Desfazer devolve o foco ao Dei.
    const later = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1500);
    click(row()?.querySelector('.cg-dose__undo'));
    setGiven(false);
    await settle();
    later.mockRestore();
    expect(document.activeElement).toBe(row()?.querySelector('.cg-dose__action'));

    // Toque sem foco na linha (o foco está em outro lugar): o foco não é tomado.
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    click(row()?.querySelector('.cg-dose__action'));
    setGiven(true);
    await settle();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('CXC-005: com quietLate a dose que passou do horário fica neutra, sem o âmbar', () => {
    const f = mountKit('cg_0001');
    const quiet = TestBed.createComponent(CgDoseComponent);
    quiet.componentRef.setInput('slot', f.componentInstance.slots()[0]);
    quiet.componentRef.setInput('quietLate', true);
    quiet.detectChanges();
    const row = (quiet.nativeElement as HTMLElement).querySelector('.cg-dose');
    expect(row?.classList.contains('is-late')).toBe(false);
    expect((quiet.nativeElement as HTMLElement).querySelector('.cg-dose__state--late')).toBeNull();
    expect(text(row?.querySelector('.cg-dose__state'))).toBe('Ainda não anotado');
  });

  it('dose: até 30 minutos antes o Dei já é primário', () => {
    const f = mountKit('cg_0001', '19:40');
    const doses = all(f, '.cg-dose');
    expect(doses[2]?.querySelector('button')?.classList.contains('btn--primary')).toBe(true);
    expect(doses[2]?.classList.contains('is-late')).toBe(false);
  });

  it('bloqueio por plano: só aparece quando o plano não libera, diz o plano e o plano atual, sem preço nem "assine"', () => {
    const essencial = mountKit('cg_0002');
    const locks = all(essencial, '.cg-plan-lock').filter((el) => el.closest('[data-role="nested"]') === null);
    expect(locks).toHaveLength(1);
    const lock = locks[0];
    expect(text(lock?.querySelector('h2'))).toBe('Disponível no plano Cuida');
    expect(text(lock)).toContain('Grupos e capacitações fazem parte do plano Cuida. Seu plano agora é o Essencial.');
    expect(text(lock)).toContain('As rodas de conversa abertas são para todos.');
    expect(lock?.querySelector('a.cg-link-btn')?.getAttribute('href')).toBe('/cuidador/mais/plano');
    expect(text(lock)).not.toMatch(/R\$|assine|desconto|zarit|alerta/i);
    // O recurso liberado para todos nunca bloqueia (a segunda trava não aparece).
    expect(text(root(essencial))).not.toContain('não deve aparecer');
    TestBed.resetTestingModule();
    const cuida = mountKit('cg_0001');
    expect(all(cuida, '.cg-plan-lock')).toHaveLength(0);
  });

  it('nota de 1 a 5: duas notas, cinco botões numerados cada, e a frase do que falta', () => {
    const f = mountKit('cg_0001');
    const groups = all(f, '.cg-rating');
    expect(groups).toHaveLength(2);
    expect(groups[0]?.querySelectorAll('.cg-rating__score')).toHaveLength(5);
    expect(text(groups[0]?.querySelector('legend'))).toBe('Como foi o serviço?');
    expect(text(groups[1]?.querySelector('legend'))).toBe('Como foi a pontualidade e o atendimento?');
    expect(text(groups[0]?.querySelector('.cg-rating__scores'))).toBe('12345');
    expect(text(groups[0]?.querySelector('.cg-rating__ends'))).toBe('Muito ruimMuito bom');
    const c = f.componentInstance;
    expect(ratingPairMissingText(c.quality(), c.punctuality())).toBe('Falta escolher as duas notas');
    groups[0]?.querySelectorAll<HTMLInputElement>('input')[3]?.click();
    f.detectChanges();
    expect(c.quality()).toBe(4);
    expect(ratingPairMissingText(c.quality(), c.punctuality())).toBe(
      'Falta escolher a nota da pontualidade e do atendimento',
    );
    expect(ratingPairMissingText(null, 5)).toBe('Falta escolher a nota do serviço');
    expect(ratingPairMissingText(4, 5)).toBeNull();
    expect(all(f, '.cg-rating__score.is-selected')).toHaveLength(1);
  });

  it('evolução: lista do mais recente ao mais antigo, faixa por extenso, pontos só em legenda e a etiqueta da última', () => {
    const f = mountKit('cg_0001');
    const items = all(f, '.cg-trend__item');
    expect(root(f).querySelector('ol.cg-trend')?.getAttribute('aria-label')).toBe('Suas conversas com a equipe');
    expect(items).toHaveLength(2);
    expect(text(items[0]?.querySelector('.cg-trend__band'))).toBe('Sobrecarga severa');
    expect(text(items[0]?.querySelector('.cg-trend__score'))).toBe('63 pontos');
    expect(text(items[0]?.querySelector('.cg-trend__tag'))).toBe('Última conversa');
    expect(items[1]?.querySelector('.cg-trend__tag')).toBeNull();
    expect(items[0]?.querySelector('.cg-trend__dot')?.getAttribute('data-band')).toBe('4');
  });

  it('evolução: cada item tem o rótulo que o leitor de tela lê, com data, faixa e pontos', () => {
    const f = mountKit('cg_0001');
    const items = all(f, '.cg-trend__item');
    expect(items[0]?.getAttribute('aria-label')).toBe('04/11, sobrecarga severa, 63 pontos, última conversa');
    expect(items[1]?.getAttribute('aria-label')).toBe('10/08, sobrecarga moderada a severa, 48 pontos');
    expect(trendItemLabel({ id: 'x', dateLabel: '01/02', bandLabel: 'Sobrecarga moderada', band: 2 })).toBe('01/02, sobrecarga moderada');
    // CXC-004: com a frase da faixa, ela vem primeiro e o nome técnico e os pontos seguem como legenda.
    expect(
      trendItemLabel({
        id: 'y',
        dateLabel: '01/02',
        bandLabel: 'Sobrecarga severa',
        meaning: 'O cuidado está pesando muito',
        band: 4,
        scoreText: '63 pontos',
      }),
    ).toBe('01/02, o cuidado está pesando muito, sobrecarga severa, 63 pontos');
  });

  it('etiqueta de plano: ponto e nome', () => {
    const f = mountKit('cg_0001');
    expect(text(root(f).querySelector('app-cg-plan-tag'))).toBe('Plano Sustenta');
    expect(root(f).querySelector('app-cg-plan-tag')?.classList.contains('cg-plan-tag--sustenta')).toBe(true);
  });

  it('aviso de emergência: o compacto leva à Ajuda agora e o completo mostra 192 e 188, sem tel:', () => {
    const f = mountKit('cg_0001');
    const compact = root(f).querySelector('app-cg-emergency-note .cg-note');
    expect(text(compact)).toContain('Em emergência, ligue 192 (SAMU). Os canais da Nexus não substituem atendimento de saúde nem orientação sobre remédios.');
    expect(compact?.querySelector('a')?.getAttribute('href')).toBe('/cuidador/ajuda-agora');
    const full = root(f).querySelector('.cg-emergency');
    expect(text(full?.querySelector('h2'))).toBe('Em emergência, ligue 192');
    expect(all(f, '.cg-emergency__number').map(text)).toEqual(['192', '188']);
    expect(root(f).querySelectorAll('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
  });

  it('folha de baixo: abre como diálogo modal com o foco no título e fecha com "Voltar", Esc e toque no fundo', async () => {
    const f = mountKit('cg_0001');
    const dialog = root(f).querySelector<HTMLDialogElement>('dialog.cg-sheet');
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.getAttribute('aria-labelledby')).toBe(root(f).querySelector('.cg-sheet__title')?.id);
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(root(f).querySelector('.cg-sheet__title'));
    expect(text(root(f).querySelector('.cg-sheet__actions'))).toContain('Cancelar a conversa');
    // "Voltar" fecha e o foco volta a quem abriu.
    click(root(f).querySelector('[data-role="back"]'));
    f.detectChanges();
    await f.whenStable();
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
    // Toque no fundo escurecido (o alvo é o próprio <dialog>).
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    dialog?.click();
    f.detectChanges();
    expect(f.componentInstance.sheetOpen()).toBe(false);
    // Esc (o navegador dispara "close").
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    dialog?.dispatchEvent(new Event('close'));
    f.detectChanges();
    expect(f.componentInstance.sheetOpen()).toBe(false);
    trigger.remove();
  });

  it('CXC-013: o voltar do aparelho fecha a folha (e não sai da tela); ao fechar pelo botão a entrada de histórico é retirada', async () => {
    const f = mountKit('cg_0001');
    const dialog = root(f).querySelector<HTMLDialogElement>('dialog.cg-sheet');
    const push = vi.spyOn(window.history, 'pushState');
    const go = vi.spyOn(window.history, 'go');
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    expect(dialog?.hasAttribute('open')).toBe(true);
    // Uma entrada de histórico por folha aberta.
    expect(push).toHaveBeenCalledTimes(1);
    // O botão voltar do aparelho dispara o popstate: a folha fecha.
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 40));
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.sheetOpen()).toBe(false);
    expect(dialog?.hasAttribute('open')).toBe(false);
    // Fechar pelo botão retira a entrada (o histórico não cresce) e não fecha nada duas vezes.
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    expect(push).toHaveBeenCalledTimes(2);
    click(root(f).querySelector('[data-role="back"]'));
    f.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(go).toHaveBeenCalledWith(-1);
    expect(f.componentInstance.sheetOpen()).toBe(false);
    vi.restoreAllMocks();
  });

  it('C2: Esc (o evento "cancel", síncrono) fecha a folha pelo estado e ela abre de novo; o "close" que chega depois não atrapalha', async () => {
    const f = mountKit('cg_0001');
    const dialog = root(f).querySelector<HTMLDialogElement>('dialog.cg-sheet');
    const layers = TestBed.inject(HistoryLayersService);
    const open = async (): Promise<void> => {
      f.componentInstance.sheetOpen.set(true);
      f.detectChanges();
      await f.whenStable();
    };
    await open();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(layers.depth).toBe(1);
    const esc = new Event('cancel', { cancelable: true });
    dialog?.dispatchEvent(esc);
    f.detectChanges();
    await f.whenStable();
    // Quem fecha é o estado (o navegador não fecha por conta própria): estado, folha e histórico concordam na hora.
    expect(esc.defaultPrevented).toBe(true);
    expect(f.componentInstance.sheetOpen()).toBe(false);
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(layers.depth).toBe(0);
    dialog?.dispatchEvent(new Event('close'));
    f.detectChanges();
    expect(f.componentInstance.sheetOpen()).toBe(false);
    // O botão que abre a folha volta a funcionar.
    await open();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(layers.depth).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

  it('C2: se o estado fecha a folha e ela já estava fechada (o navegador fechou antes), a entrada de histórico é solta do mesmo jeito', async () => {
    const f = mountKit('cg_0001');
    const dialog = root(f).querySelector<HTMLDialogElement>('dialog.cg-sheet');
    const layers = TestBed.inject(HistoryLayersService);
    f.componentInstance.sheetOpen.set(true);
    f.detectChanges();
    await f.whenStable();
    expect(layers.depth).toBe(1);
    // O navegador fecha a folha sem que o "close" chegue (aba sem foco).
    dialog?.removeAttribute('open');
    f.componentInstance.sheetOpen.set(false);
    f.detectChanges();
    await f.whenStable();
    expect(layers.depth).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

  it('a barra de navegação tem os 5 destinos fixos, nesta ordem', () => {
    expect(CG_NAV_ITEMS.map((i) => `${i.label}:${i.path}`)).toEqual([
      'Hoje:/cuidador/hoje',
      'Rotina:/cuidador/rotina',
      'Cuidar de mim:/cuidador/cuidar-de-mim',
      'Rede:/cuidador/rede',
      'Mais:/cuidador/mais',
    ]);
  });
});

describe('Diálogo "Como falar com a gente" (UX A.2.16)', () => {
  let app: BootedCaregiverApp;
  const q = <T extends Element = HTMLElement>(selector: string): T | null =>
    app.root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string): T[] =>
    Array.from(app.root.querySelectorAll<T>(selector));
  const open = async (): Promise<void> => {
    TestBed.inject(ContactDialogService).open();
    await settleCaregiver(app.fixture);
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window.navigator, 'clipboard');
  });

  it('CXC-016: à vista só o canal preferido e o telefone; os outros atrás de "Mais jeitos" (João prefere telefone)', async () => {
    app = await bootCaregiverApp('cg_0003', { url: '/cuidador/hoje' });
    expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(false);
    await open();
    expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(true);
    expect(text(q('.cg-sheet__title'))).toBe('Como falar com a gente');
    // O telefone é o canal preferido dele: só ele fica à vista; os outros três ficam atrás de "Mais jeitos".
    expect(all('.cg-contact__name').map((n) => text(n).replace(' Seu canal preferido', ''))).toEqual(['Telefone']);
    const more = q('[data-role="more-ways"]');
    expect(text(more)).toBe('Mais jeitos');
    expect(more?.getAttribute('aria-expanded')).toBe('false');
    click(more);
    await settleCaregiver(app.fixture);
    expect(all('.cg-contact__name').map((n) => text(n).replace(' Seu canal preferido', ''))).toEqual([
      'Telefone',
      'WhatsApp',
      'Mensagem no aplicativo',
      'E-mail',
    ]);
    // O e-mail tem a classe que o deixa menor e sem quebrar no meio.
    expect(q('[data-role="value-email"]')?.classList.contains('cg-contact__value--email')).toBe(true);
    expect(text(all('.cg-contact__name')[0])).toContain('Seu canal preferido');
    expect(all('.cg-contact__tag')).toHaveLength(1);
    expect(text(q('[data-role="value-phone"]'))).toBe('(34) 90000-0000');
    expect(text(q('.cg-sheet__body'))).toContain('No protótipo, a ligação não é feita.');
    expect(text(q('.cg-sheet__body'))).toContain('Em emergência, ligue 192 (SAMU).');
    expect(all('a[href^="tel:"], a[href*="wa.me"]')).toHaveLength(0);
  });

  it('fora do horário comercial o telefone diz quando abre (relógio simulado)', async () => {
    app = await bootCaregiverApp('cg_0001', { time: '20:00' });
    await open();
    expect(text(q('.cg-contact__closed'))).toBe('Fechado agora. Abrimos amanhã às 8h.');
  });

  it('"Copiar número" copia e avisa; se o navegador negar, a frase diz como copiar na mão', async () => {
    app = await bootCaregiverApp('cg_0001');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    const copy = all<HTMLButtonElement>('.cg-contact__action').find((b) => text(b) === 'Copiar número');
    click(copy);
    await settleCaregiver(app.fixture);
    expect(writeText).toHaveBeenCalledWith('(34) 90000-0000');
    expect(text(q('.cg-contact__status'))).toBe('Número copiado.');
    // Negado.
    writeText.mockRejectedValue(new Error('negado'));
    click(copy);
    await settleCaregiver(app.fixture);
    expect(text(q('.cg-contact__status'))).toBe('Não foi possível copiar. Segure sobre o número e escolha Copiar.');
    // CXC-016: a falha fica ao lado do botão tocado, em cor de aviso; o sucesso, em verde.
    expect(q('.cg-contact__status')?.classList.contains('cg-contact__status--warn')).toBe(true);
    expect(q('.cg-contact__status')?.closest('.cg-contact__item')?.querySelector('.cg-contact__action')).toBe(copy);
    // O número fica selecionado para a pessoa segurar e copiar à mão (AC-CG-161).
    expect(window.getSelection()?.toString().trim()).toBe('(34) 90000-0000');
  });

  it('C2: depois de fechar com Esc, "Falar com a gente" abre o diálogo de novo (o estado do serviço acompanha o Esc)', async () => {
    app = await bootCaregiverApp('cg_0001', { url: '/cuidador/hoje' });
    const service = TestBed.inject(ContactDialogService);
    for (let round = 0; round < 3; round += 1) {
      await open();
      expect(service.isOpen()).toBe(true);
      expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(true);
      q('dialog.cg-sheet')?.dispatchEvent(new Event('cancel', { cancelable: true }));
      await settleCaregiver(app.fixture);
      expect(service.isOpen()).toBe(false);
      expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(false);
    }
    // Pelo botão da tela, como a pessoa faz.
    const trigger = Array.from(app.root.querySelectorAll<HTMLButtonElement>('main button')).find((b) =>
      /falar agora|Falar com a gente/.test(text(b)),
    );
    expect(trigger).toBeDefined();
    click(trigger);
    await settleCaregiver(app.fixture);
    expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(true);
  });

  it('"Escrever mensagem" leva a Falar com a Nexus e fecha o diálogo; "Voltar" também fecha', async () => {
    app = await bootCaregiverApp('cg_0001');
    await open();
    click(all('a.cg-contact__action')[0]);
    await settleCaregiver(app.fixture);
    expect(app.router.url).toBe('/cuidador/mais/ajuda');
    expect(TestBed.inject(ContactDialogService).isOpen()).toBe(false);
    await open();
    click(q('.cg-sheet__actions .cg-link-btn'));
    await settleCaregiver(app.fixture);
    expect(TestBed.inject(ContactDialogService).isOpen()).toBe(false);
    expect(q('dialog.cg-sheet')?.hasAttribute('open')).toBe(false);
  });
});
