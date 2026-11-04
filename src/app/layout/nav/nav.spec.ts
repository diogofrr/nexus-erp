import { describe, expect, it } from 'vitest';
import { MODULES, canAccessModule, menuFor } from '../../core/auth/module-map';
import { ROLES } from '../../core/auth/permissions';
import { Role } from '../../core/models/access';
import {
  PORTAL_BOTTOM_NAV,
  activeGroupOf,
  buildNavigation,
  flattenNavigation,
  pinnedLinks,
  portalMoreLinks,
} from './nav.model';

const TEAM: Role[] = ['partner', 'technical_lead', 'psychologist', 'support'];

describe('menu lateral por perfil (buildNavigation)', () => {
  it('nenhum perfil vê item sem permissão, e todos os itens permitidos aparecem (AC-M01-08)', () => {
    ROLES.forEach((role) => {
      const links = flattenNavigation(buildNavigation(role));
      const expected = menuFor(role).map((m) => m.key);
      expect(links.map((l) => l.key).sort(), role).toEqual([...expected].sort());
      links.forEach((link) => {
        const module = MODULES.find((m) => m.key === link.key);
        expect(module && canAccessModule(role, module), `${role}: ${link.path}`).toBe(true);
        expect(link.path.startsWith('/portal')).toBe(false);
      });
    });
  });

  it('o credenciado não usa o menu lateral do ERP', () => {
    expect(buildNavigation('provider')).toEqual([]);
  });

  it('a sócia vê 17 itens, o RT 14 e o atendimento 13, nos grupos da ordem do guia', () => {
    expect(flattenNavigation(buildNavigation('partner'))).toHaveLength(17);
    expect(flattenNavigation(buildNavigation('technical_lead'))).toHaveLength(14);
    expect(flattenNavigation(buildNavigation('support'))).toHaveLength(13);
    const titles = buildNavigation('partner')
      .filter((e) => e.kind === 'group')
      .map((e) => (e.kind === 'group' ? e.title : ''));
    expect(titles).toEqual([
      'Pessoas',
      'Cuidado',
      'Rede e parceiros',
      'Relacionamento',
      'Gestão',
      'Segurança e normas',
    ]);
  });

  it('o Painel é um link solto no topo e a sócia vê a Configurações no fim, em Sistema (um item vira link direto)', () => {
    const entries = buildNavigation('partner');
    expect(entries[0]).toMatchObject({ kind: 'link', link: { key: 'dashboard', label: 'Painel' } });
    const last = entries[entries.length - 1];
    expect(last).toMatchObject({ kind: 'link', link: { key: 'settings', label: 'Configurações' } });
  });

  it('grupo com um único item visível vira link direto com o nome do item (psicólogo: Meus cuidadores, Mensagens)', () => {
    const entries = buildNavigation('psychologist');
    const people = entries.find((e) => e.kind === 'link' && e.link.key === 'caregivers');
    expect(people).toMatchObject({ link: { label: 'Meus cuidadores' } });
    expect(entries.some((e) => e.kind === 'group' && e.id === 'people')).toBe(false);
    expect(entries.find((e) => e.kind === 'link' && e.link.key === 'messages')).toBeDefined();
    // O grupo Cuidado do psicólogo tem 3 itens e continua grupo.
    const care = entries.find((e) => e.kind === 'group' && e.id === 'care');
    expect(care?.kind === 'group' && care.links.map((l) => l.label)).toEqual([
      'Atendimento',
      'Acompanhamento',
      'Grupos',
    ]);
  });

  it('o rótulo muda quando o perfil só vê uma parte (sócia: Ocupação da equipe e Sobrecarga agregada)', () => {
    const labels = flattenNavigation(buildNavigation('partner')).map((l) => l.label);
    expect(labels).toContain('Cuidadores (por código)');
    expect(labels).toContain('Ocupação da equipe');
    expect(labels).toContain('Sobrecarga agregada');
    const support = flattenNavigation(buildNavigation('support')).map((l) => l.label);
    expect(support).toContain('Cuidadores');
    expect(support).not.toContain('Acompanhamento');
  });

  it('Financeiro só aparece para a sócia', () => {
    TEAM.forEach((role) => {
      const has = flattenNavigation(buildNavigation(role)).some((l) => l.key === 'finance');
      expect(has, role).toBe(role === 'partner');
    });
  });

  it('"Fixados": só o que o perfil ainda pode abrir, no máximo 3', () => {
    const pinned = pinnedLinks('support', [
      'finance',
      'messages',
      'caregivers',
      'complaints',
      'privacy',
    ]);
    expect(pinned.map((l) => l.key)).toEqual(['messages', 'caregivers', 'complaints']);
    expect(pinnedLinks('support', ['finance'])).toEqual([]);
  });

  it('o grupo da rota atual é o que abre sozinho', () => {
    const entries = buildNavigation('partner');
    expect(activeGroupOf('/app/cuidadores/cg_0001?aba=resumo', entries)).toBe('people');
    expect(activeGroupOf('/app/financeiro/projecao', entries)).toBe('management');
    expect(activeGroupOf('/app/painel', entries)).toBeNull();
  });
});

describe('navegação do portal', () => {
  it('a barra inferior tem 4 destinos e o Mais traz o resto (Avaliação interna só com o prestador suspenso)', () => {
    expect(PORTAL_BOTTOM_NAV.map((l) => l.label)).toEqual([
      'Início',
      'Solicitações',
      'Disponibilidade',
      'Mensagens',
    ]);
    expect(portalMoreLinks(false).map((l) => l.label)).toEqual([
      'Minha avaliação',
      'Documentos',
      'Integração',
      'Meu perfil',
      'Privacidade',
    ]);
    expect(portalMoreLinks(true).map((l) => l.label)).toContain('Avaliação interna');
  });
});
