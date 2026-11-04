/**
 * Motor do seed: gera os dados fictícios completos da seção 5 do escopo, de forma DETERMINÍSTICA
 * (semente `nexus-seed-1`) e RELATIVA à data de hoje (`Clock.today()`), para nunca ficar velho.
 *
 *   generateSeed('2026-11-04')  =>  340 cuidadores (29 de cenário + 311 de volume), 20 prestadores,
 *   12 usuários de demonstração, 60 sessões, 158 aplicações da Zarit, 213 solicitações de serviço...
 *
 * Os dados são 100% fictícios: CPF inválido e marcado, e-mails `@exemplo.com.br`, telefones
 * `(34) 90000-0000` a `(34) 90000-0999`. Nenhum dado real ou de autores do documento.
 */
import { CollectionData, SingletonTypes } from '../data/collections';
import { defaultAppSettings, defaultPilotConfig } from '../data/defaults';
import { DemoState, ISODate } from '../models';
import { restoreFinancialParams } from '../rules/finance';
import { SCHEMA_VERSION } from '../storage/migrations';
import { buildCaregivers } from './build-caregivers';
import { buildClinical } from './build-clinical';
import { buildCommercial } from './build-commercial';
import { buildComms } from './build-comms';
import { buildCore } from './build-core';
import { buildLgpd } from './build-lgpd';
import { buildNetwork } from './build-network';
import { buildGovernance, buildGroups, buildPilot } from './build-ops';
import { buildSessions } from './build-sessions';
import { SEED_NAME, SeedContext } from './context';
import { SeedState, emptyCollections } from './state';

export interface SeedDataset {
  /** Data de "hoje" (D0) usada para gerar os dados. */
  today: ISODate;
  collections: CollectionData;
  singletons: SingletonTypes;
  demoState: DemoState;
}

export function generateSeed(today: ISODate): SeedDataset {
  const ctx = new SeedContext(today);
  const state: SeedState = {
    ctx,
    c: emptyCollections(),
    singletons: {
      settings: defaultAppSettings(),
      financialParams: restoreFinancialParams(),
      pilotConfig: defaultPilotConfig(),
    },
    zaritPoints: new Map(),
    nextDueOverride: new Map(),
    enrollmentDate: new Map(),
    consentPlan: new Map(),
    consentEventIds: new Map(),
    volumePilotIds: [],
    psychologistById: new Map(),
  };

  buildCore(state);
  buildCaregivers(state);
  buildCommercial(state);
  buildLgpd(state);
  buildComms(state);
  buildClinical(state);
  buildSessions(state);
  buildNetwork(state);
  buildGroups(state);
  buildGovernance(state);
  buildPilot(state);

  return {
    today,
    collections: state.c,
    singletons: state.singletons,
    demoState: {
      seedName: SEED_NAME,
      seededAt: ctx.dt(0, '00:00'),
      seededForToday: today,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}
