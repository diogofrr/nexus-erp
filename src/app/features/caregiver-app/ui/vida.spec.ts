import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { DoseSlot, dosesForDate } from '../../../core/rules/medication-doses';
import { configureCoreTest } from '../../../core/testing/test-helpers';
import { bootCaregiverApp, settleCaregiver } from '../testing';
import {
  CG_ACCENTS,
  CG_ILLUSTRATION_NAMES,
  CgAccent,
  CgCardComponent,
  CgDoseComponent,
  CgEmptyComponent,
  CgHeroComponent,
  CgIconBadgeComponent,
  CgIllustrationComponent,
  CgIllustrationName,
  CgMoodComponent,
  CgProgressRingComponent,
  CgRowComponent,
  CgSealComponent,
  CgTrendComponent,
  CgTrendItem,
  MOOD_OPTIONS,
  accentClass,
  sectionOfUrl,
} from './index';

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

@Component({
  selector: 'app-vida-host',
  imports: [
    CgCardComponent,
    CgDoseComponent,
    CgEmptyComponent,
    CgHeroComponent,
    CgIconBadgeComponent,
    CgIllustrationComponent,
    CgMoodComponent,
    CgProgressRingComponent,
    CgRowComponent,
    CgSealComponent,
    CgTrendComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-cg-hero id="hero-art" title="Rotina" description="Agenda e remédios." illustration="calendar" accent="rotina" backLink="/cuidador/hoje" backLabel="Hoje" />
    <app-cg-hero id="hero-plain" title="Mais" />
    <app-cg-hero id="hero-forced" title="Passo" description="Escolha o horário." compact />
    <app-cg-trend id="trend-trail" [items]="trend" trail />
    <app-cg-trend id="trend-plain" [items]="trend" />
    <app-cg-trend id="trend-one" [items]="[trend[0]!]" trail />
    <app-cg-row id="row-lead" title="Dra. Renata"><span cgRowLead class="lead-test">RS</span></app-cg-row>
    <app-cg-row id="row-icon" title="Remédios" icon="pill" />
    @for (name of names; track name) {
      <app-cg-illustration [name]="name" />
    }
    <app-cg-illustration id="ill-lg" name="day" size="lg" tone="light" />
    <app-cg-icon-badge id="badge-sm" icon="pill" size="sm" />
    <app-cg-icon-badge id="badge-solid" icon="heart" size="xl" solid accent="cuidar" />
    <app-cg-progress-ring id="ring-half" [value]="2" [max]="4" label="dados" />
    <app-cg-progress-ring id="ring-full" [value]="4" [max]="4" size="md" label="dados" />
    <app-cg-progress-ring id="ring-zero" [value]="0" [max]="0" size="sm" />
    <app-cg-empty id="empty-default" title="Nada por aqui" text="Volte depois." />
    <app-cg-empty id="empty-h2" illustration="medicine" headingLevel="2" title="Sem remédios">
      <button type="button" class="btn">Cadastrar</button>
    </app-cg-empty>
    <app-cg-seal id="seal-ok" tone="ok" icon="circle-check">Dado às 08:12</app-cg-seal>
    <app-cg-seal id="seal-plain">Em destaque</app-cg-seal>
    <app-cg-card id="card-tile" layout="tile" illustration="chat" icon="messages-square" accent="rede" title="Conversar" link="/cuidador/rede">Uma frase.</app-cg-card>
    <app-cg-card id="card-icon" icon="calendar" title="Próximo compromisso">Hoje às 14:00</app-cg-card>
    <app-cg-card id="card-plain" title="Sem ícone">Texto.</app-cg-card>
    <app-cg-mood [value]="mood()" (chosen)="mood.set($event)" />
    @for (slot of slots(); track slot.key) {
      <app-cg-dose [slot]="slot" />
    }
  `,
})
class VidaHostComponent {
  readonly names = CG_ILLUSTRATION_NAMES;
  readonly mood = signal<1 | 2 | 3 | 4 | 5 | null>(null);
  readonly slots = signal<DoseSlot[]>([]);
  readonly trend: CgTrendItem[] = [
    { id: 'c', dateLabel: '04/11', bandLabel: 'Sobrecarga severa', band: 4, latest: true },
    { id: 'b', dateLabel: '10/08', bandLabel: 'Sobrecarga moderada a severa', band: 3 },
    { id: 'a', dateLabel: '12/05', bandLabel: 'Sobrecarga leve', band: 1 },
  ];
}

function mountVida(): ComponentFixture<VidaHostComponent> {
  configureCoreTest({ seed: true, time: '12:00', providers: [provideRouter([])] });
  TestBed.inject(CaregiverSessionService).signIn('cg_0001');
  const fixture = TestBed.createComponent(VidaHostComponent);
  fixture.componentInstance.slots.set(
    dosesForDate(
      '2026-11-04',
      [{ id: 'm1', elderId: 'x', name: 'Losartana', dosage: '50 mg', times: ['08:00', '12:00'], active: true, createdAt: '', updatedAt: '' }],
      [{ id: 'd1', medicationId: 'm1', date: '2026-11-04', time: '08:00', givenAt: '2026-11-04T08:07:00-03:00', createdAt: '', updatedAt: '' }],
    ),
  );
  fixture.detectChanges();
  return fixture;
}

describe('Vida visual: o kit novo (docs/17-vida-kit.md)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const root = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const q = <T extends Element = HTMLElement>(f: ComponentFixture<unknown>, selector: string): T | null => root(f).querySelector<T>(selector);

  describe('app-cg-illustration', () => {
    it('cada uma das ilustrações desenha um SVG decorativo (aria-hidden no hospedeiro e em todos os svg)', () => {
      const f = mountVida();
      const all = Array.from(root(f).querySelectorAll('app-cg-illustration'));
      expect(all.length).toBeGreaterThanOrEqual(CG_ILLUSTRATION_NAMES.length);
      CG_ILLUSTRATION_NAMES.forEach((name) => {
        const el = root(f).querySelector(`app-cg-illustration[data-illustration="${name}"]`);
        expect(el, name).not.toBeNull();
        expect(el?.getAttribute('aria-hidden'), name).toBe('true');
        const svgs = Array.from(el?.querySelectorAll('svg') ?? []);
        expect(svgs.length, name).toBeGreaterThan(0);
        svgs.forEach((svg) => expect(svg.getAttribute('aria-hidden'), name).toBe('true'));
        // Tem desenho de verdade (formas), não um SVG vazio.
        expect(el?.querySelectorAll('path, circle, rect, ellipse, use').length, name).toBeGreaterThan(1);
      });
    });

    it('tamanho e tom viram classes; sem nome ou texto: nenhuma informação só na ilustração', () => {
      const f = mountVida();
      const lg = q(f, '#ill-lg');
      expect(lg?.className).toContain('cg-ill--lg');
      expect(lg?.className).toContain('cg-ill--light');
      expect(text(lg)).toBe('');
      const first = Array.from(root(f).querySelectorAll('app-cg-illustration')).find(
        (el) => el.id !== 'ill-lg' && !el.classList.contains('cg-hero__art'),
      );
      expect(first?.className).toContain('cg-ill--md');
      expect(first?.className).toContain('cg-ill--brand');
    });

    it('as ilustrações do kit são as 13 do documento', () => {
      expect([...CG_ILLUSTRATION_NAMES].sort()).toEqual(
        ['book', 'calendar', 'card', 'chat', 'day', 'empty', 'group', 'heart', 'help', 'medicine', 'network', 'privacy', 'welcome'].sort(),
      );
    });
  });

  describe('app-cg-icon-badge', () => {
    it('é decorativo, leva o tamanho e a variante cheia, e força a seção quando pedido', () => {
      const f = mountVida();
      const sm = q(f, '#badge-sm');
      expect(sm?.getAttribute('aria-hidden')).toBe('true');
      expect(sm?.className).toContain('cg-badge--sm');
      expect(sm?.className).not.toContain('cg-badge--solid');
      expect(sm?.querySelector('svg.icon')).not.toBeNull();
      const solid = q(f, '#badge-solid');
      expect(solid?.className).toContain('cg-badge--xl');
      expect(solid?.className).toContain('cg-badge--solid');
      expect(solid?.className).toContain('cg-sec--cuidar');
    });
  });

  describe('app-cg-progress-ring', () => {
    it('diz "2 de 4 dados" para o leitor de tela e mostra o número; o traço cobre metade do anel', () => {
      const f = mountVida();
      const ring = q(f, '#ring-half');
      expect(ring?.getAttribute('role')).toBe('img');
      expect(ring?.getAttribute('aria-label')).toBe('2 de 4 dados');
      expect(text(ring?.querySelector('.cg-ring__value'))).toBe('2');
      expect(text(ring?.querySelector('.cg-ring__of'))).toBe('de 4');
      const bar = ring?.querySelector('.cg-ring__bar');
      const circumference = Number(bar?.getAttribute('stroke-dasharray'));
      expect(circumference).toBeGreaterThan(200);
      expect(Number(bar?.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2, 3);
      expect(ring?.className).not.toContain('is-done');
      expect(ring?.className).toContain('cg-ring--lg');
    });

    it('fechado vira "done" (verde) com o traço inteiro; com máximo zero não quebra', () => {
      const f = mountVida();
      const full = q(f, '#ring-full');
      expect(full?.className).toContain('is-done');
      expect(full?.className).toContain('cg-ring--md');
      expect(Number(full?.querySelector('.cg-ring__bar')?.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
      const zero = q(f, '#ring-zero');
      expect(zero?.className).not.toContain('is-done');
      expect(zero?.getAttribute('aria-label')).toBe('0 de 0');
    });
  });

  describe('app-cg-hero', () => {
    it('um h1 serifado, a frase de apoio (com a classe de sempre), a ilustração decorativa e o acento da seção', () => {
      const f = mountVida();
      const hero = q(f, '#hero-art');
      expect(hero?.querySelectorAll('h1')).toHaveLength(1);
      expect(text(hero?.querySelector('h1'))).toBe('Rotina');
      expect(text(hero?.querySelector('.cg-page-header__desc'))).toBe('Agenda e remédios.');
      expect(hero?.className).toContain('cg-hero--art');
      expect(hero?.className).toContain('cg-sec--rotina');
      expect(hero?.className).not.toContain('cg-hero--compact');
      expect(hero?.querySelector('app-cg-illustration')?.getAttribute('aria-hidden')).toBe('true');
      expect(hero?.querySelector('a.cg-page-header__back')?.getAttribute('href')).toBe('/cuidador/hoje');
      expect(text(hero?.querySelector('.sr-only'))).toBe('para Hoje');
    });

    it('sem frase de apoio o herói é compacto e sem ilustração não reserva espaço para ela', () => {
      const f = mountVida();
      const plain = q(f, '#hero-plain');
      expect(plain?.className).toContain('cg-hero--compact');
      expect(plain?.className).not.toContain('cg-hero--art');
      expect(plain?.querySelector('app-cg-illustration')).toBeNull();
      expect(plain?.querySelector('a.cg-page-header__back')).toBeNull();
    });
  });

  describe('app-cg-hero compact e app-cg-row [cgRowLead] (pedidos do V2)', () => {
    it('compact força o herói baixo mesmo com frase de apoio', () => {
      const f = mountVida();
      const forced = q(f, '#hero-forced');
      expect(forced?.className).toContain('cg-hero--compact');
      expect(text(forced?.querySelector('.cg-page-header__desc'))).toBe('Escolha o horário.');
    });

    it('o que vai em cgRowLead ocupa o lugar do emblema de ícone, e a linha continua um botão', () => {
      const f = mountVida();
      const lead = q(f, '#row-lead');
      expect(lead?.querySelector('.lead-test')?.textContent).toBe('RS');
      expect(lead?.querySelector('.cg-row__icon')).toBeNull();
      expect(lead?.querySelector('button.cg-row')).not.toBeNull();
      const icon = q(f, '#row-icon');
      expect(icon?.querySelector('.cg-row__icon svg.icon')).not.toBeNull();
    });
  });

  describe('app-cg-trend com trilha (pedido do V2)', () => {
    it('um ponto por conversa, do mais antigo ao mais novo, só desenho e sem número; a última leva o anel', () => {
      const f = mountVida();
      const trail = q(f, '#trend-trail .cg-trend__trail');
      expect(trail?.getAttribute('aria-hidden')).toBe('true');
      const dots = Array.from(trail?.querySelectorAll('.cg-trend__trail-dot') ?? []);
      expect(dots.map((d) => d.getAttribute('data-band'))).toEqual(['1', '3', '4']);
      expect(dots.at(-1)?.classList.contains('is-latest')).toBe(true);
      expect(text(trail)).toBe('');
      // A lista de baixo continua a de sempre (mais recente primeiro).
      expect(q(f, '#trend-trail')?.querySelectorAll('.cg-trend__item')).toHaveLength(3);
    });

    it('sem o atributo trail, ou com uma conversa só, não desenha trilha', () => {
      const f = mountVida();
      expect(q(f, '#trend-plain .cg-trend__trail')).toBeNull();
      expect(q(f, '#trend-one .cg-trend__trail')).toBeNull();
      expect(q(f, '#trend-one .cg-trend__item')).not.toBeNull();
    });
  });

  describe('app-cg-empty', () => {
    it('usa as classes do estado vazio de sempre, ilustração decorativa e título h3 por padrão', () => {
      const f = mountVida();
      const empty = q(f, '#empty-default');
      expect(empty?.className).toContain('empty');
      expect(empty?.getAttribute('role')).toBe('status');
      expect(empty?.querySelector('h3.empty__title')?.textContent?.trim()).toBe('Nada por aqui');
      expect(text(empty?.querySelector('.empty__text'))).toBe('Volte depois.');
      expect(empty?.querySelector('app-cg-illustration')?.getAttribute('data-illustration')).toBe('empty');
    });

    it('aceita headingLevel="2" como atributo e leva a ação projetada', () => {
      const f = mountVida();
      const empty = q(f, '#empty-h2');
      expect(empty?.querySelector('h2.empty__title')?.textContent?.trim()).toBe('Sem remédios');
      expect(empty?.querySelector('h3')).toBeNull();
      expect(empty?.querySelector('app-cg-illustration')?.getAttribute('data-illustration')).toBe('medicine');
      expect(text(empty?.querySelector('.empty__actions button'))).toBe('Cadastrar');
    });
  });

  describe('app-cg-seal', () => {
    it('forma e cor: o tom vira classe, o ícone é opcional e o texto fica escrito', () => {
      const f = mountVida();
      const ok = q(f, '#seal-ok');
      expect(ok?.className).toContain('cg-seal--ok');
      expect(ok?.querySelector('svg.icon')).not.toBeNull();
      expect(text(ok)).toBe('Dado às 08:12');
      const plain = q(f, '#seal-plain');
      expect(plain?.className).toContain('cg-seal--accent');
      expect(plain?.querySelector('svg')).toBeNull();
    });
  });

  describe('app-cg-card (vida)', () => {
    it('com ícone, o emblema fica fora do título; o ladrilho leva desenho, layout e a seção forçada', () => {
      const f = mountVida();
      const tile = q(f, '#card-tile');
      const link = tile?.querySelector('a.cg-card');
      expect(link?.className).toContain('cg-card--tile');
      expect(link?.className).toContain('cg-card--art');
      expect(link?.className).toContain('cg-sec--rede');
      expect(link?.getAttribute('href')).toBe('/cuidador/rede');
      expect(link?.querySelector('app-cg-illustration')?.getAttribute('data-illustration')).toBe('chat');
      expect(link?.querySelector('app-cg-icon-badge.cg-card__badge')).not.toBeNull();
      expect(text(link?.querySelector('.cg-card__title'))).toBe('Conversar');
      expect(link?.querySelector('.cg-card__go')).not.toBeNull();
      const icon = q(f, '#card-icon');
      expect(icon?.querySelector('app-cg-icon-badge')).not.toBeNull();
      expect(icon?.querySelector('h2 svg')).toBeNull();
      const plain = q(f, '#card-plain');
      expect(plain?.querySelector('app-cg-icon-badge')).toBeNull();
      expect(plain?.querySelector('.cg-card')?.className).not.toContain('cg-card--tile');
    });
  });

  describe('app-cg-mood e app-cg-dose (vida)', () => {
    it('cada carinha leva o seu valor (cor suave própria) e escolher marca a opção', () => {
      const f = mountVida();
      const options = Array.from(root(f).querySelectorAll<HTMLElement>('.cg-mood__option'));
      expect(options.map((o) => o.getAttribute('data-value'))).toEqual(MOOD_OPTIONS.map((o) => String(o.value)));
      (options[3]?.querySelector('input') as HTMLInputElement).click();
      f.detectChanges();
      expect(root(f).querySelector('.cg-mood__option.is-selected')?.getAttribute('data-value')).toBe('4');
    });

    it('a dose dada mostra o check desenhado; a que falta mostra o comprimido', () => {
      const f = mountVida();
      const doses = Array.from(root(f).querySelectorAll('.cg-dose'));
      const given = doses.find((d) => d.classList.contains('is-given'));
      const pending = doses.find((d) => !d.classList.contains('is-given'));
      expect(given?.querySelector('.cg-dose__check path')?.getAttribute('pathLength')).toBe('1');
      expect(given?.querySelector('.cg-dose__check')?.getAttribute('aria-hidden')).toBe('true');
      expect(pending?.querySelector('.cg-dose__check')).toBeNull();
      expect(pending?.querySelector('.cg-dose__icon svg.icon')).not.toBeNull();
      // Ao abrir a tela o check já vem pronto: sem a animação de "acabou de marcar".
      expect(given?.querySelector('.cg-dose__icon')?.classList.contains('is-popping')).toBe(false);
    });
  });

  describe('acentos por seção', () => {
    it('as cinco seções, na ordem do aplicativo', () => {
      expect([...CG_ACCENTS]).toEqual(['hoje', 'rotina', 'cuidar', 'rede', 'mais']);
    });

    it('accentClass força a seção ou deixa herdar', () => {
      expect(accentClass('rede')).toBe(' cg-sec--rede');
      expect(accentClass(null)).toBe('');
      expect(accentClass(undefined)).toBe('');
    });

    it('sectionOfUrl acha a seção do endereço, inclusive nas subtelas e com parâmetros', () => {
      const cases: [string, CgAccent | null][] = [
        ['/cuidador/hoje', 'hoje'],
        ['/cuidador/rotina/remedios', 'rotina'],
        ['/cuidador/cuidar-de-mim/grupos?atividade=1', 'cuidar'],
        ['/cuidador/rede/profissional/p_1', 'rede'],
        ['/cuidador/mais/privacidade#topo', 'mais'],
        ['/cuidador/ajuda-agora', null],
        ['/cuidador/comecar', null],
        ['/login', null],
      ];
      cases.forEach(([url, section]) => expect(sectionOfUrl(url), url).toBe(section));
    });
  });
});

describe('Vida visual: o shell marca a seção', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('data-section acompanha o endereço (Hoje, Rotina, Rede, Mais) e some fora das cinco seções', async () => {
    const expected: [string, string | null][] = [
      ['/cuidador/hoje', 'hoje'],
      ['/cuidador/rotina/agenda', 'rotina'],
      ['/cuidador/cuidar-de-mim', 'cuidar'],
      ['/cuidador/rede', 'rede'],
      ['/cuidador/mais', 'mais'],
      ['/cuidador/ajuda-agora', null],
    ];
    for (const [url, section] of expected) {
      const app = await bootCaregiverApp('cg_0001', { url });
      await settleCaregiver(app.fixture);
      expect(app.root.querySelector('app-caregiver-shell')?.getAttribute('data-section') ?? null, url).toBe(section);
      TestBed.resetTestingModule();
    }
  });

  it('navegar de uma seção para outra troca o acento sem recarregar', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/hoje' });
    const shell = (): Element | null => app.root.querySelector('app-caregiver-shell');
    expect(shell()?.getAttribute('data-section')).toBe('hoje');
    await app.router.navigateByUrl('/cuidador/rede');
    await settleCaregiver(app.fixture);
    app.fixture.detectChanges();
    expect(shell()?.getAttribute('data-section')).toBe('rede');
  });
});

describe('Vida visual: as telas', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Hoje: o anel mostra "2 de 4" e o herói leva a ilustração do dia; a hora do compromisso vem em destaque', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/hoje' });
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('main app-cg-hero [data-illustration="day"]')).not.toBeNull();
    expect(app.root.querySelector('[data-role="meds"] app-cg-progress-ring')?.getAttribute('aria-label')).toBe('2 de 4 dados');
    expect(text(app.root.querySelector('app-cg-card a.cg-card--link .cg-bignum'))).toMatch(/^\d{2}:\d{2}$/);
  });

  it('as portas de Cuidar de mim e da Rede são ladrilhos com desenho', async () => {
    const care = await bootCaregiverApp('cg_0008', { url: '/cuidador/cuidar-de-mim' });
    await settleCaregiver(care.fixture);
    const tiles = Array.from(care.root.querySelectorAll('[data-role="care-cards"] a.cg-card--tile'));
    expect(tiles).toHaveLength(4);
    expect(tiles.map((t) => t.querySelector('app-cg-illustration')?.getAttribute('data-illustration'))).toEqual(['chat', 'heart', 'group', 'book']);
    TestBed.resetTestingModule();
    const net = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede' });
    await settleCaregiver(net.fixture);
    const netTiles = Array.from(net.root.querySelectorAll('main a.cg-card--tile'));
    expect(netTiles).toHaveLength(3);
    netTiles.forEach((t) => expect(t.querySelector('app-cg-illustration')?.getAttribute('aria-hidden')).toBe('true'));
  });

  it('Ajuda agora fica parada (sem a entrada em cascata) e sem sessão também abre', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/ajuda-agora' });
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('app-help-now-page.cg-still')).not.toBeNull();
    expect(app.root.querySelector('main app-cg-hero [data-illustration="help"]')).not.toBeNull();
  });

  it('Mais: o nome com avatar de iniciais decorativo e cada linha na tinta da sua seção', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/mais' });
    await settleCaregiver(app.fixture);
    const avatar = app.root.querySelector('.cg-who__avatar');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
    expect(text(avatar)).toBe('AF');
    const sections = Array.from(app.root.querySelectorAll('main .cg-list > li')).map((li) => Array.from(li.classList).find((c) => c.startsWith('cg-sec--')));
    expect(sections).toEqual(['cg-sec--cuidar', 'cg-sec--mais', 'cg-sec--rotina', 'cg-sec--hoje', 'cg-sec--hoje', 'cg-sec--rede']);
  });

  it('Buscar: as necessidades são ladrilhos com ícone, a tinta agrupa e o nome continua escrito', async () => {
    const app = await bootCaregiverApp('cg_0001', { url: '/cuidador/rede/buscar' });
    await settleCaregiver(app.fixture);
    const cats = Array.from(app.root.querySelectorAll<HTMLElement>('main .nx-cat[data-category]'));
    expect(cats).toHaveLength(10);
    cats.forEach((c) => {
      expect(c.querySelector('app-cg-icon-badge'), c.getAttribute('data-category') ?? '').not.toBeNull();
      expect(text(c).length).toBeGreaterThan(3);
    });
    expect(cats[0]?.closest('li')?.className).toContain('cg-sec--rotina');
    expect(app.root.querySelector('main app-cg-hero a.cg-page-header__back')?.getAttribute('href')).toBe('/cuidador/rede');
  });

  it('Rotina: as abas ganham ícone e o herói é compacto, com o calendário ou os remédios desenhados', async () => {
    const agenda = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/agenda' });
    await settleCaregiver(agenda.fixture);
    expect(agenda.root.querySelector('main app-cg-hero.cg-hero--compact [data-illustration="calendar"]')).not.toBeNull();
    const tabs = Array.from(agenda.root.querySelectorAll('.routine-tab'));
    expect(tabs.map((t) => text(t))).toEqual(['Agenda', 'Remédios']);
    tabs.forEach((t) => expect(t.querySelector('svg.icon')).not.toBeNull());
    TestBed.resetTestingModule();
    const meds = await bootCaregiverApp('cg_0001', { url: '/cuidador/rotina/remedios' });
    await settleCaregiver(meds.fixture);
    expect(meds.root.querySelector('main app-cg-hero [data-illustration="medicine"]')).not.toBeNull();
    expect(meds.root.querySelector('.routine-progress app-cg-progress-ring')?.getAttribute('aria-label')).toBe('2 de 4 dados');
  });

  it('a Entrada mostra o desenho grande no painel azul e avatares coloridos para as pessoas de exemplo', async () => {
    const app = await bootCaregiverApp(null, { url: '/login' });
    await settleCaregiver(app.fixture);
    expect(app.root.querySelector('.login__brand app-cg-illustration.login__scene[data-illustration="welcome"]')).not.toBeNull();
    const tones = Array.from(app.root.querySelectorAll('.cg-door__person .avatar')).map((a) => a.getAttribute('data-tone'));
    expect(tones.length).toBeGreaterThanOrEqual(6);
    tones.forEach((t) => expect(['1', '2', '3', '4', '5']).toContain(t));
    expect(new Set(tones).size).toBeGreaterThan(1);
  });
});
