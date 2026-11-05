import { describe, expect, it } from 'vitest';
import { TEST_DOWNLOADS, configureCoreTest } from '../testing/test-helpers';
import { buildCsv, csvText, downloadTextFile } from './file-download';

describe('exportação de arquivos (AC-GL-11)', () => {
  it('o download nasce no navegador: o link temporário é clicado, removido e o clique de teste fica registrado', () => {
    configureCoreTest();
    const before = TEST_DOWNLOADS.length;
    expect(downloadTextFile(document, 'cuidadores.csv', 'a;b', 'text/csv;charset=utf-8')).toBe(true);
    expect(TEST_DOWNLOADS).toHaveLength(before + 1);
    expect(TEST_DOWNLOADS.at(-1)?.fileName).toBe('cuidadores.csv');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('o CSV usa ponto e vírgula, escapa aspas e neutraliza fórmulas de planilha', () => {
    expect(csvText('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvText('Ana; Paula')).toBe('"Ana; Paula"');
    expect(csvText('diz "oi"')).toBe('"diz ""oi"""');
    expect(buildCsv(['Código', 'Plano'], [['CUI-0001', 'Cuida']])).toBe('Código;Plano\nCUI-0001;Cuida');
  });
});
