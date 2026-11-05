import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { pick, pickAll, text } from '../testing/dom';
import { AvatarComponent, initialsOf } from './avatar.component';
import { CardComponent, CardFooterDirective } from './card.component';
import { ChecklistComponent, ChecklistItem, checklistMissing } from './checklist.component';
import { ChipComponent } from './chip.component';
import { DescriptionListComponent } from './description-list.component';
import { EmptyStateComponent } from './empty-state.component';
import { KpiComponent, KpiStripComponent } from './kpi.component';
import { MeterComponent, OccupancyBarComponent, ProgressComponent } from './meter.component';
import { PageHeaderComponent } from './page-header.component';
import { PlaceholderLineComponent, SkeletonComponent } from './skeleton.component';
import { StepperComponent } from './stepper.component';
import { TimelineComponent } from './timeline.component';

const ITEMS: ChecklistItem[] = [
  { id: 'a', title: 'Registro ativo no conselho', text: 'CREFITO fictício, válido até 30/06/2027', state: 'ok' },
  { id: 'b', title: 'Documento na validade', state: 'fail', badge: 'Vencido' },
  { id: 'c', title: 'Integração concluída', state: 'pending' },
  { id: 'd', title: 'Registro em conselho', state: 'na' },
];

@Component({
  imports: [
    AvatarComponent, CardComponent, CardFooterDirective, ChecklistComponent, ChipComponent, DescriptionListComponent,
    EmptyStateComponent, KpiComponent, KpiStripComponent, MeterComponent, OccupancyBarComponent, ProgressComponent,
    PageHeaderComponent, PlaceholderLineComponent, SkeletonComponent, StepperComponent, TimelineComponent,
  ],
  template: `
    <app-avatar id="av" name="Ana Paula Ferraz" size="lg" />
    <app-avatar id="av2" pseudonymized />
    <app-card id="card" title="Plano e cartão" subtitle="Cuida" variant="raised">
      <button appCardActions class="btn btn--sm">Trocar plano</button>
      Conteúdo
      <div appCardFooter>Próximo ciclo em 12/12/2026</div>
    </app-card>
    <app-chip id="chip" [(pressed)]="pressed" [count]="3">Atrasadas</app-chip>
    <app-kpi-strip id="strip">
      <app-kpi id="k1" label="Assinantes" value="17" [delta]="{ text: '+2 desde outubro', tone: 'good', direction: 'up' }" context="meta 27" link="/app/financeiro" />
      <app-kpi id="k2" label="Zarit severa" value="3" suppressed />
    </app-kpi-strip>
    <app-meter id="meter" label="Ponto de equilíbrio" [value]="17" [target]="27" unit="assinantes" />
    <app-occupancy-bar id="occ1" name="Dr. Rafael Moreira" [percent]="91.3" />
    <app-occupancy-bar id="occ2" name="Dr. Tiago Brandão" [percent]="null" />
    <app-occupancy-bar id="occ3" name="Dra. Letícia Amaral" [percent]="80" />
    <app-progress id="prog" label="6 de 22 itens respondidos" [value]="6" [max]="22" large />
    <app-empty-state id="empty" title="Nenhum alerta aberto por aqui" text="Quando uma aplicação da escala indicar atenção, o caso aparece nesta fila.">
      <button class="btn">Ver histórico</button>
    </app-empty-state>
    <app-empty-state id="empty-error" kind="error" title="Não foi possível carregar" />
    <app-empty-state id="empty-lock" kind="private" compact title="Menos de 5 pessoas" />
    <div id="skels"><app-skeleton variant="title" /><app-skeleton [lines]="3" /></div>
    <app-placeholder-line id="ph1" />
    <app-placeholder-line id="ph2" reason="small-group" />
    <app-page-header id="ph" title="Cuidadores" count="340 cuidadores" description="cadastro ativo" [breadcrumbs]="crumbs">
      <button class="btn btn--primary">Novo cuidador</button>
    </app-page-header>
    <app-description-list id="dl" [items]="dl" />
    <app-timeline id="tl" label="Histórico" [items]="events" />
    <app-checklist id="cl" label="Critérios" [items]="items" />
    <app-stepper id="st" label="Cadastro" [steps]="steps" [current]="2" />
  `,
})
class HostComponent {
  readonly pressed = signal(false);
  readonly crumbs = [{ label: 'Cuidadores', link: '/app/cuidadores' }, { label: 'CUI-0042' }];
  readonly dl = [{ label: 'Cidade', value: 'Uberlândia' }, { label: 'E-mail', value: null }, { label: 'Horas por dia', value: 0 }];
  readonly events = [
    { title: 'Consentimento concedido', at: '2026-11-04T09:30:00-03:00', tone: 'done' as const },
    { title: 'Revogado', timeLabel: 'ontem', text: 'Pelo canal telefone', tone: 'danger' as const },
  ];
  readonly items = ITEMS;
  readonly steps = ['Cuidador', 'Pessoa idosa', 'Consentimentos', 'Plano', 'Resumo'].map((label, i) => ({ id: `s${i}`, label }));
}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, root, el: (id: string) => pick(root, `#${id}`) };
}

describe('Avatar', () => {
  it('iniciais do primeiro e do último nome; pseudonimizado não mostra iniciais', () => {
    const { el } = render();
    expect(initialsOf('Dra. Beatriz Nogueira')).toBe('BN');
    expect(initialsOf('Clínica')).toBe('C');
    expect(text(el('av'))).toBe('AF');
    expect(el('av').className).toContain('avatar--lg');
    expect(el('av').getAttribute('aria-hidden')).toBe('true');
    expect(text(el('av2'))).toBe('');
    expect(el('av2').querySelector('svg')).not.toBeNull();
  });
});

describe('Card e Chip', () => {
  it('cartão com cabeçalho, ações, corpo e rodapé projetados', () => {
    const { el } = render();
    const card = el('card');
    expect(card.className).toBe('card card--raised');
    expect(text(pick(card, '.card__title'))).toBe('Plano e cartão');
    expect(text(pick(card, '.card__sub'))).toBe('Cuida');
    expect(text(pick(card, '.card__header .btn'))).toBe('Trocar plano');
    expect(text(pick(card, '.card__body'))).toBe('Conteúdo');
    expect(text(pick(card, '.card__footer'))).toBe('Próximo ciclo em 12/12/2026');
  });

  it('chip alterna aria-pressed e mostra a contagem', () => {
    const { fixture, host, el } = render();
    const button = pick<HTMLButtonElement>(el('chip'), 'button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(text(button)).toBe('Atrasadas 3');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(host.pressed()).toBe(true);
  });
});

describe('KPI', () => {
  it('valor, variação em palavras, contexto e link para o módulo', () => {
    const { el } = render();
    const k1 = el('k1');
    expect(k1.classList.contains('kpi')).toBe(true);
    expect(el('strip').className).toBe('kpi-strip');
    expect(text(pick(k1, '.kpi__label'))).toBe('Assinantes');
    expect(text(pick(k1, '.kpi__value'))).toBe('17');
    expect(text(pick(k1, '.kpi__delta'))).toBe('+2 desde outubro');
    expect(pick(k1, '.kpi__delta').classList.contains('kpi__delta--good')).toBe(true);
    expect(text(k1)).toContain('meta 27');
    expect(pick<HTMLAnchorElement>(k1, 'a.kpi__link').getAttribute('href')).toBe('/app/financeiro');
  });

  it('agregado abaixo do mínimo mostra "menos de 5" com cadeado, sem número', () => {
    const { el } = render();
    const k2 = el('k2');
    expect(text(pick(k2, '.kpi__value'))).toBe('menos de 5');
    expect(k2.textContent).not.toContain('3');
    expect(text(k2)).toContain('Por privacidade, não mostramos o número.');
    expect(k2.querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-lock');
  });
});

describe('Meter, ocupação e progresso', () => {
  it('ponto de equilíbrio: "17 de 27", faltam 10 e texto equivalente', () => {
    const { el } = render();
    expect(text(pick(el('meter'), 'b'))).toBe('17 de 27 assinantes');
    expect(pick(el('meter'), '[role="img"]').getAttribute('aria-label')).toBe('17 de 27 assinantes; faltam 10');
    expect(text(pick(el('meter'), '.meter__scale'))).toContain('Faltam 10');
    expect(text(pick(el('meter'), '.meter__scale'))).toContain('Meta: 27');
    const fill = pick(el('meter'), '.meter__fill');
    expect(fill.getAttribute('style')).toContain('--value: 63%');
  });

  it('ocupação: acima de 80% muda a cor E ganha ícone; sem agenda mostra n/d tracejado', () => {
    const { el } = render();
    expect(text(pick(el('occ1'), '.occ__value'))).toBe('91,3%');
    expect(pick(el('occ1'), '.occ__fill').classList.contains('occ__fill--over')).toBe(true);
    expect(pick(el('occ1'), '.occ__value svg')).not.toBeNull();
    expect(pick(el('occ1'), '[role="img"]').getAttribute('aria-label')).toBe('Dr. Rafael Moreira: 91,3% de ocupação, acima do limite de 80%');
    expect(text(pick(el('occ2'), '.occ__value'))).toBe('n/d');
    expect(pick(el('occ2'), '.occ__fill').classList.contains('occ__fill--na')).toBe(true);
    expect(pick(el('occ3'), '.occ__fill').classList.contains('occ__fill--over')).toBe(false);
  });

  it('progresso expõe valores para leitor de tela', () => {
    const { el } = render();
    const bar = pick(el('prog'), '[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('6');
    expect(bar.getAttribute('aria-valuemax')).toBe('22');
    expect(bar.getAttribute('aria-label')).toBe('6 de 22 itens respondidos');
    expect(bar.classList.contains('progress--lg')).toBe(true);
  });
});

describe('Estados: vazio, erro, esqueleto, placeholder', () => {
  it('vazio acolhedor com as mãos da marca, título, texto e ações', () => {
    const { el } = render();
    const empty = el('empty');
    expect(empty.className).toBe('empty');
    expect(text(pick(empty, '.empty__title'))).toBe('Nenhum alerta aberto por aqui');
    expect(pick(empty, 'svg.empty__art use').getAttribute('href')).toBe('icons/sprite.svg#nx-hands');
    expect(text(pick(empty, '.empty__actions'))).toBe('Ver histórico');
  });

  it('erro usa ícone e role alert; "menos de 5" usa cadeado; sem ações o bloco não reserva espaço', () => {
    const { el } = render();
    expect(el('empty-error').getAttribute('role')).toBe('alert');
    expect(pick(el('empty-error'), '.empty__icon--danger')).not.toBeNull();
    expect(el('empty-error').querySelector('.empty__art')).toBeNull();
    expect(pick(el('empty-lock'), '.empty__icon use').getAttribute('href')).toBe('icons/sprite.svg#i-lock');
    expect(el('empty-lock').classList.contains('empty--compact')).toBe(true);
    expect(pick(el('empty-lock'), '.empty__actions').childElementCount).toBe(0);
  });

  it('esqueleto é decorativo e a última linha de texto sai mais curta', () => {
    const { el } = render();
    const lines = pickAll(el('skels'), '.skeleton--text');
    expect(lines).toHaveLength(3);
    expect(lines[2]?.classList.contains('skeleton--short')).toBe(true);
    expect(el('skels').querySelector('app-skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(el('skels').querySelector('.skeleton--title')).not.toBeNull();
  });

  it('placeholder de dado oculto: cadeado e frase padrão, nunca vazio', () => {
    const { el } = render();
    expect(text(el('ph1'))).toBe('Oculto para o seu perfil');
    expect(text(el('ph2'))).toBe('Menos de 5 pessoas');
    expect(el('ph1').querySelector('use')?.getAttribute('href')).toBe('icons/sprite.svg#i-lock');
  });
});

describe('Cabeçalho, migalhas e ficha', () => {
  it('um h1 com a linha dourada do design system, contador e ação', () => {
    const { el } = render();
    const header = el('ph');
    expect(header.classList.contains('page-header')).toBe(true);
    expect(text(pick(header, 'h1'))).toBe('Cuidadores');
    expect(text(pick(header, '.page-header__desc'))).toBe('340 cuidadores · cadastro ativo');
    expect(text(pick(header, '.page-header__actions'))).toBe('Novo cuidador');
    const crumbs = pick(header, 'nav[aria-label="Você está em"]');
    expect(text(pick(crumbs, 'a'))).toBe('Cuidadores');
    expect(pick(crumbs, '[aria-current="page"]').textContent).toBe('CUI-0042');
    expect(crumbs.querySelectorAll('a')).toHaveLength(1);
  });

  it('lista descritiva: vazio vira "Não informado" e zero é um valor', () => {
    const { el } = render();
    expect(pickAll(el('dl'), 'dt').map((d) => text(d))).toEqual(['Cidade', 'E-mail', 'Horas por dia']);
    expect(pickAll(el('dl'), 'dd').map((d) => text(d))).toEqual(['Uberlândia', 'Não informado', '0']);
  });
});

describe('Linha do tempo, checklist e stepper', () => {
  it('linha do tempo em lista ordenada, com hora formatada e o tom também em texto', () => {
    const { el } = render();
    expect(el('tl').tagName).toBe('APP-TIMELINE');
    const items = pickAll(el('tl'), 'li');
    expect(items).toHaveLength(2);
    expect(text(pick(items[0] as HTMLElement, '.timeline__time'))).toBe('04/11/2026 09:30');
    expect(items[0]?.classList.contains('timeline__item--done')).toBe(true);
    expect(text(pick(items[0] as HTMLElement, '.sr-only'))).toBe('(Concluído)');
    expect(text(pick(items[1] as HTMLElement, '.timeline__time'))).toBe('ontem');
    expect(items[1]?.classList.contains('timeline__item--danger')).toBe(true);
  });

  it('checklist: ícone de forma por estado, selo com texto e contagem do que falta', () => {
    const { el } = render();
    const rows = pickAll(el('cl'), 'li');
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['ok', 'fail', 'pending', 'na']);
    expect(rows.map((r) => r.querySelector('use')?.getAttribute('href'))).toEqual([
      'icons/sprite.svg#i-circle-check', 'icons/sprite.svg#i-circle-alert', 'icons/sprite.svg#i-clock', 'icons/sprite.svg#i-circle-dashed',
    ]);
    expect(rows.map((r) => text(pick(r, 'app-badge')))).toEqual(['Cumprido', 'Vencido', 'Pendente', 'Não se aplica']);
    expect(checklistMissing(ITEMS)).toBe(2);
  });

  it('stepper só indicativo: etapa atual marcada, feitas com check, contador no celular', () => {
    const { el } = render();
    const st = el('st');
    const steps = pickAll(st, '.stepper__item');
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.classList.contains('is-done'))).toEqual([true, true, false, false, false]);
    expect(steps[2]?.getAttribute('aria-current')).toBe('step');
    expect(st.querySelector('button, a')).toBeNull();
    expect(text(pick(st, '.step-counter span'))).toBe('Etapa 3 de 5: Consentimentos');
    expect(pick(st, '[role="progressbar"]').getAttribute('aria-valuenow')).toBe('3');
  });
});
