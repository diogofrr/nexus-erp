import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../../core/format/format';
import { AreaChartComponent } from './area-chart.component';
import { BarChartComponent } from './bar-chart.component';
import {
  donutArcs,
  gaugePosition,
  heatLevel,
  labelEvery,
  linearScale,
  niceScale,
  niceStep,
  sparklinePath,
} from './chart-math';
import { DonutChartComponent } from './donut-chart.component';
import { GaugeBandComponent } from './gauge-band.component';
import { HeatMatrixComponent } from './heat-matrix.component';
import { LineChartComponent } from './line-chart.component';
import { SparklineComponent } from './sparkline.component';

describe('chart-math', () => {
  it('escolhe passos redondos', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(18)).toBe(20);
    expect(niceStep(230)).toBe(250);
    expect(niceStep(4800)).toBe(5000);
  });

  it('a escala cobre os dados, inclui o zero e tem marcas redondas', () => {
    const scale = niceScale(-2355, 1420);
    expect(scale.min).toBeLessThanOrEqual(-2355);
    expect(scale.max).toBeGreaterThanOrEqual(1420);
    expect(scale.ticks).toContain(0);
    expect(scale.ticks.every((t) => Math.abs(t % scale.step) < 1e-6)).toBe(true);
    const flat = niceScale(5, 5);
    expect(flat.max).toBeGreaterThan(flat.min);
  });

  it('escala linear leva o domínio ao contradomínio', () => {
    const y = linearScale(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(50)).toBe(100);
    expect(linearScale(5, 5, 10, 20)(5)).toBe(10);
  });

  it('a rosca soma 100 e ignora valores nulos', () => {
    const arcs = donutArcs([7, 5, 5, null]);
    expect(arcs[3]?.percent).toBe(0);
    expect(arcs.reduce((s, a) => s + a.percent, 0)).toBeCloseTo(100, 6);
    expect(arcs[0]?.percent).toBeCloseTo((7 / 17) * 100, 6);
    expect(arcs[1]?.offset).toBeCloseTo((7 / 17) * 100, 6);
  });

  it('o marcador do termômetro fica em (pontos + 0,5) / 89', () => {
    expect(gaugePosition(0)).toBeCloseTo(0.56, 2);
    expect(gaugePosition(63)).toBeCloseTo((63.5 / 89) * 100, 1);
    expect(gaugePosition(88)).toBeCloseTo((88.5 / 89) * 100, 1);
    expect(gaugePosition(200)).toBe(gaugePosition(88));
  });

  it('níveis da matriz de riscos: até 4, de 5 a 11 e 12 ou mais', () => {
    expect(heatLevel(4)).toBe('low');
    expect(heatLevel(5)).toBe('mid');
    expect(heatLevel(11)).toBe('mid');
    expect(heatLevel(12)).toBe('high');
    expect(heatLevel(25)).toBe('high');
  });

  it('rótulos do eixo X nunca passam de 12 e a sparkline fica dentro do quadro', () => {
    expect(labelEvery(12)).toBe(1);
    expect(labelEvery(24)).toBe(2);
    const spark = sparklinePath([26, 22, 24, 16, 18, 9, 6]);
    expect(spark.d.startsWith('M2 ')).toBe(true);
    expect(spark.last?.x).toBe(100);
    expect(sparklinePath([]).d).toBe('');
    expect(sparklinePath([3, 3, 3]).d).not.toContain('NaN');
  });
});

@Component({
  imports: [BarChartComponent],
  template: `
    <app-bar-chart
      [data]="data"
      [valueFormat]="money"
      ariaLabel="Resultado mensal: prejuízo nos primeiros meses, lucro depois"
      caption="Resultado por mês"
      categoryHeader="Mês"
      valueHeader="Resultado"
      positiveLabel="Resultado positivo"
      negativeLabel="Resultado negativo"
    />
  `,
})
class BarHostComponent {
  readonly money = formatMoney;
  readonly data = [
    { label: 'M1', value: -235500 },
    { label: 'M2', value: -195000 },
    { label: 'M3', value: 27000 },
    { label: 'M4', value: 142000 },
    { label: 'M5', value: null },
  ];
}

describe('BarChartComponent', () => {
  it('desenha barras azuis e vermelhas, eixo zero, tabela e recorte suprimido hachurado', async () => {
    const fixture = TestBed.createComponent(BarHostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const svg = root.querySelector('svg.chart__svg') as SVGSVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('Resultado mensal');
    expect(svg.querySelectorAll('rect.ch-bar')).toHaveLength(5);
    expect(svg.querySelectorAll('rect.ch-bar--neg')).toHaveLength(2);
    const suppressed = svg.querySelector('rect.ch-bar--suppressed') as SVGRectElement;
    expect(suppressed).not.toBeNull();
    expect(Number(suppressed.getAttribute('height'))).toBeGreaterThan(0);
    expect(svg.querySelector('line.ch-axis')).not.toBeNull();
    expect(svg.querySelector('pattern')).not.toBeNull();
    expect(root.textContent).toContain('Resultado negativo');
    expect(root.textContent).toContain('Menos de 5');

    const rows = root.querySelectorAll('.chart-alt tbody tr');
    expect(rows).toHaveLength(5);
    expect(rows[0]?.textContent).toContain('-R$ 2.355,00');
    // O recorte suprimido não vaza número na tabela.
    expect(rows[4]?.textContent).toContain('menos de 5');
    expect(root.querySelector('.chart-alt caption')?.textContent?.trim()).toBe('Resultado por mês');
  });
});

@Component({
  imports: [AreaChartComponent, LineChartComponent],
  template: `
    <app-area-chart
      [points]="balance"
      [bars]="result"
      [valueFormat]="money"
      [referenceLine]="{ value: 0, label: 'Retorno do investimento (saldo zero)' }"
      ariaLabel="Resultado mensal e saldo acumulado"
    />
    <app-line-chart
      [points]="zarit"
      [referenceLine]="{ value: 41, label: 'Faixa amarela começa em 41' }"
      ariaLabel="Evolução da média de pontuação ao longo de quatro aplicações"
      primaryLabel="Média da pontuação"
      caption="Média por aplicação"
    />
  `,
})
class AreaHostComponent {
  readonly money = formatMoney;
  readonly result = [-235500, -195000, -150000, 27000].map((value, i) => ({
    label: `M${i + 1}`,
    value,
  }));
  readonly balance = [-1955500, -2150500, -2300500, -2273500].map((value, i) => ({
    label: `M${i + 1}`,
    value,
  }));
  readonly zarit = [66, 52, 41, 33].map((value, i) => ({
    label: ['Adesão', '3 meses', '6 meses', '9 meses'][i] ?? '',
    value,
  }));
}

describe('AreaChartComponent e LineChartComponent', () => {
  it('a área traz barras de resultado, linha de retorno e tabela com as duas séries', async () => {
    const fixture = TestBed.createComponent(AreaHostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const area = root.querySelector('app-area-chart') as HTMLElement;
    expect(area.querySelectorAll('rect.ch-bar')).toHaveLength(4);
    expect(area.querySelectorAll('rect.ch-bar--neg')).toHaveLength(3);
    expect(area.querySelector('polygon.ch-area')).not.toBeNull();
    expect(area.querySelector('polyline.ch-line')).not.toBeNull();
    expect(area.querySelector('line.ch-ref')).not.toBeNull();
    expect(area.textContent).toContain('Resultado do mês');
    expect(area.textContent).toContain('Retorno do investimento (saldo zero)');
    const header = Array.from(area.querySelectorAll('.chart-alt thead th')).map(
      (th) => th.textContent,
    );
    expect(header).toEqual(['Mês', 'Resultado do mês', 'Saldo acumulado']);
    expect(area.querySelectorAll('.chart-alt tbody tr')).toHaveLength(4);
  });

  it('a linha rotula todos os pontos quando são poucos e marca a referência', async () => {
    const fixture = TestBed.createComponent(AreaHostComponent);
    await fixture.whenStable();
    const line = (fixture.nativeElement as HTMLElement).querySelector(
      'app-line-chart',
    ) as HTMLElement;
    expect(line.querySelectorAll('circle.ch-dot')).toHaveLength(4);
    expect(line.textContent).toContain('Faixa amarela começa em 41');
    const labels = Array.from(line.querySelectorAll('text.ch-text--strong')).map(
      (t) => t.textContent?.trim(),
    );
    expect(labels).toEqual(['66', '52', '41', '33']);
    expect(line.querySelectorAll('.chart-alt tbody tr')).toHaveLength(4);
  });
});

@Component({
  imports: [DonutChartComponent, GaugeBandComponent, HeatMatrixComponent, SparklineComponent],
  template: `
    <app-donut-chart
      [segments]="plans"
      centerValue="17"
      centerLabel="assinantes"
      ariaLabel="Rosca: 7 Essencial, 5 Cuida, 5 Sustenta"
      class="full"
    />
    <app-donut-chart [segments]="hidden" ariaLabel="Rosca com recorte suprimido" class="hidden" />
    <app-gauge-band [score]="63" class="g63" />
    <app-gauge-band [score]="20" class="g20" />
    <app-gauge-band class="gnone" />
    <app-heat-matrix [risks]="risks" />
    <app-sparkline [values]="[26, 22, 24, 16]" ariaLabel="Assinantes em queda" />
  `,
})
class MiscHostComponent {
  readonly plans = [
    { label: 'Essencial', value: 7, color: 'var(--plan-essencial)' },
    { label: 'Cuida', value: 5, color: 'var(--plan-cuida)' },
    { label: 'Sustenta', value: 5, color: 'var(--accent-brand)' },
  ];
  readonly hidden = [
    { label: 'Faixa 1', value: 12, color: 'var(--zarit-1-fill)' },
    { label: 'Faixa 4', value: 3, color: 'var(--zarit-4-fill)', suppressed: true },
  ];
  readonly risks = [
    { code: 'R3', probability: 4, impact: 4 },
    { code: 'R1', probability: 5, impact: 3 },
    { code: 'R8', probability: 5, impact: 3 },
    { code: 'R12', probability: 2, impact: 2 },
  ];
}

describe('Rosca, termômetro, matriz de riscos e sparkline', () => {
  it('a rosca mostra valor e percentual na legenda e total no centro', async () => {
    const fixture = TestBed.createComponent(MiscHostComponent);
    await fixture.whenStable();
    const donut = (fixture.nativeElement as HTMLElement).querySelector(
      'app-donut-chart.full',
    ) as HTMLElement;
    expect(donut.querySelectorAll('circle.donut__seg')).toHaveLength(3);
    expect(donut.querySelector('.donut__center strong')?.textContent).toBe('17');
    expect(donut.textContent).toContain('Essencial · 7 · 41,2%');
    expect(donut.querySelector('.donut')?.getAttribute('aria-label')).toContain('7 Essencial');
  });

  it('com recorte suprimido, a rosca esconde percentuais e o número do recorte', async () => {
    const fixture = TestBed.createComponent(MiscHostComponent);
    await fixture.whenStable();
    const donut = (fixture.nativeElement as HTMLElement).querySelector(
      'app-donut-chart.hidden',
    ) as HTMLElement;
    expect(donut.querySelectorAll('circle.donut__seg')).toHaveLength(1);
    expect(donut.textContent).toContain('Faixa 4 · menos de 5');
    expect(donut.textContent).not.toContain('%');
    expect(donut.textContent).not.toContain('80,0');
    const rows = Array.from(donut.querySelectorAll('.chart-alt tbody tr')).map(
      (r) => r.textContent,
    );
    expect(rows[1]).toContain('menos de 5');
    expect(rows[1]).not.toContain('3');
  });

  it('o termômetro marca a faixa atual, com ícone, intervalo e rótulo por extenso', async () => {
    const fixture = TestBed.createComponent(MiscHostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const g63 = root.querySelector('app-gauge-band.g63') as HTMLElement;
    expect(g63.querySelector('.thermo')?.getAttribute('aria-label')).toBe(
      'Pontuação 63 de 88, faixa Sobrecarga severa',
    );
    expect(g63.querySelectorAll('.thermo__seg')).toHaveLength(4);
    expect(
      g63.querySelector('.thermo__seg[aria-current="true"]')?.classList.contains('thermo__seg--4'),
    ).toBe(true);
    expect(g63.querySelector('.thermo__marker span')?.textContent).toBe('63');
    expect(g63.textContent).toContain('61 a 88');
    expect(g63.textContent).toContain('Sobrecarga moderada a severa');
    expect(g63.querySelectorAll('svg use')).toHaveLength(4);
    // 20 ainda é a faixa 1 (limite superior); sem pontuação não há marcador.
    const g20 = root.querySelector('app-gauge-band.g20') as HTMLElement;
    expect(
      g20.querySelector('.thermo__seg[aria-current="true"]')?.classList.contains('thermo__seg--1'),
    ).toBe(true);
    const none = root.querySelector('app-gauge-band.gnone') as HTMLElement;
    expect(none.querySelector('.thermo__marker')).toBeNull();
    expect(none.querySelector('[aria-current="true"]')).toBeNull();
  });

  it('a matriz 5 x 5 tem 25 células com número, riscos nas células certas e tabela ordenada por criticidade', async () => {
    const fixture = TestBed.createComponent(MiscHostComponent);
    await fixture.whenStable();
    const heat = (fixture.nativeElement as HTMLElement).querySelector(
      'app-heat-matrix',
    ) as HTMLElement;
    const cells = heat.querySelectorAll('.heat__cell');
    expect(cells).toHaveLength(25);
    expect(
      Array.from(cells).every((c) => (c.querySelector('.heat__score')?.textContent ?? '') !== ''),
    ).toBe(true);
    expect(heat.querySelectorAll('.heat__cell[data-level="high"]').length).toBeGreaterThan(0);
    const cell53 = Array.from(cells).find(
      (c) => c.querySelector('.heat__score')?.textContent === '15',
    ) as HTMLElement;
    expect(cell53.textContent).toContain('R1');
    expect(cell53.textContent).toContain('R8');
    const rows = Array.from(heat.querySelectorAll('.chart-alt tbody tr')).map(
      (r) => r.children[0]?.textContent?.trim(),
    );
    expect(rows).toEqual(['R3', 'R1', 'R8', 'R12']);
    expect(heat.querySelector('.heat')?.getAttribute('aria-label')).toContain('4 riscos');
  });

  it('a sparkline desenha o caminho e o ponto final com leitura em palavras', async () => {
    const fixture = TestBed.createComponent(MiscHostComponent);
    await fixture.whenStable();
    const spark = (fixture.nativeElement as HTMLElement).querySelector('svg.spark') as SVGElement;
    expect(spark.getAttribute('aria-label')).toBe('Assinantes em queda');
    expect(spark.querySelector('path')?.getAttribute('d')).toMatch(/^M2 /);
    expect(spark.querySelector('circle')).not.toBeNull();
  });
});
