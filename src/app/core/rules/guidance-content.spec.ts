import { describe, expect, it } from 'vitest';
import { GuidanceContent } from '../models';
import {
  canReadContent,
  contentParagraphs,
  publishedContents,
  readingMinutes,
  readingTimeLabel,
} from './guidance-content';

function content(id: string, status: GuidanceContent['status'], exclusive: boolean, approvedAt?: string): GuidanceContent {
  return {
    id,
    title: id,
    body: 'texto',
    status,
    exclusive,
    category: 'routine_organization',
    ...(approvedAt ? { approvedAt } : {}),
    createdAt: '2026-08-01T10:00:00-03:00',
    updatedAt: '2026-08-01T10:00:00-03:00',
  };
}

describe('conteúdos de orientação (RN-USR-07, RN-PLN-04 e 05, RN-POP-09)', () => {
  it('só os publicados aparecem, do mais novo ao mais antigo, e o empate se desfaz pelo id', () => {
    const list = publishedContents([
      content('gdc_1', 'published', false, '2026-09-01'),
      content('gdc_2', 'draft', false),
      content('gdc_3', 'published', false, '2026-10-01'),
      content('gdc_4', 'in_review', true),
      content('gdc_5', 'published', true, '2026-09-01'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['gdc_3', 'gdc_5', 'gdc_1']);
  });

  it('o exclusivo só vale para quem tem o plano que o inclui; rascunho e revisão nunca', () => {
    expect(canReadContent({ status: 'published', exclusive: false }, false)).toBe(true);
    expect(canReadContent({ status: 'published', exclusive: true }, false)).toBe(false);
    expect(canReadContent({ status: 'published', exclusive: true }, true)).toBe(true);
    expect(canReadContent({ status: 'draft', exclusive: false }, true)).toBe(false);
    expect(canReadContent({ status: 'in_review', exclusive: false }, true)).toBe(false);
  });

  it('o tempo de leitura nunca é menor que 1 minuto', () => {
    expect(readingMinutes('uma frase curta')).toBe(1);
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(Array(151).fill('palavra').join(' '))).toBe(2);
    expect(readingMinutes(Array(450).fill('palavra').join(' '))).toBe(3);
    expect(readingTimeLabel('curto')).toBe('Leitura de 1 minuto');
    expect(readingTimeLabel(Array(450).fill('palavra').join(' '))).toBe('Leitura de 3 minutos');
  });

  it('separa o texto em parágrafos', () => {
    expect(contentParagraphs('Um.\n\nDois.\n  \nTrês.')).toEqual(['Um.', 'Dois.', 'Três.']);
    expect(contentParagraphs('Só um parágrafo.')).toEqual(['Só um parágrafo.']);
  });
});
