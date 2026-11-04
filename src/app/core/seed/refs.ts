/**
 * IDs de referência do seed: onde QA e CS/CX acham cada cenário (escopo, seção 5). Os IDs são fixos.
 * Veja a lista completa dos 29 cenários em `docs/08-arquitetura.md`.
 */
import { caregiverCode } from '../privacy/pseudonym';
import { pad2, pad4 } from './context';

/** `cg_0001` para o cuidador de cenário C01. */
export function caregiverId(n: number): string {
  return `cg_${pad4(n)}`;
}

export function elderId(n: number): string {
  return `el_${pad4(n)}`;
}

export const caregiverCodeOf = caregiverCode;

/** Usuários de demonstração (5.1). */
export const USER = {
  partner: 'u1',
  technicalLead: 'u2',
  rafael: 'u3',
  beatriz: 'u4',
  leticia: 'u5',
  tiago: 'u6',
  camila: 'u7',
  wesley: 'u8',
  dentist: 'u9',
  physio: 'u10',
  clinic: 'u11',
  rosimeire: 'u12',
} as const;

export type PsychologistKey = 'rafael' | 'beatriz' | 'leticia' | 'tiago';

/** Perfis de psicólogo(a). */
export const PSYCHOLOGIST: Record<
  PsychologistKey,
  { id: string; userId: string; name: string; crp: string }
> = {
  rafael: { id: 'psy_0001', userId: USER.rafael, name: 'Dr. Rafael Moreira', crp: 'CRP-04/00102' },
  beatriz: {
    id: 'psy_0002',
    userId: USER.beatriz,
    name: 'Dra. Beatriz Nogueira',
    crp: 'CRP-04/00103',
  },
  leticia: {
    id: 'psy_0003',
    userId: USER.leticia,
    name: 'Dra. Letícia Amaral',
    crp: 'CRP-04/00104',
  },
  tiago: { id: 'psy_0004', userId: USER.tiago, name: 'Dr. Tiago Brandão', crp: 'CRP-04/00105' },
};

export const ROOM = { girassol: 'room_0001', ipe: 'room_0002', jacaranda: 'room_0003' } as const;

/** Prestador P01 a P20: `prv_01` a `prv_20`. */
export function providerId(n: number): string {
  return `prv_${pad2(n)}`;
}

/** Atividade G1 a G8: `act_0001` a `act_0008`. */
export function activityId(n: number): string {
  return `act_${pad4(n)}`;
}

/** Parceiros do cartão (5.11). */
export const PARTNER = {
  farmaciaBemEstar: 'par_0001',
  drogariaCuidar: 'par_0002',
  oticaVisaoClara: 'par_0003',
  laboratorioAnalise: 'par_0004',
  mercadoVida: 'par_0005',
  clinicaImagemDelta: 'par_0006',
  ortopediaPassoFirme: 'par_0007',
  drogariaPopularCentral: 'par_0008',
  academiaMexaSe: 'par_0009',
} as const;

export const CORPORATE = {
  exemploLogistica: 'corp_0001',
  industriaModelo: 'corp_0002',
  comercioAlfa: 'corp_0003',
} as const;

/** Alertas de Zarit nomeados (5.5): Z-a a Z-i. */
export const ZARIT_ALERT = {
  a: 'zal_0001',
  b: 'zal_0002',
  c: 'zal_0003',
  d: 'zal_0004',
  e: 'zal_0005',
  f: 'zal_0006',
  g: 'zal_0007',
  h: 'zal_0008',
  i: 'zal_0009',
} as const;

/** Ocorrências (5.14): O-1 (POP-05 de C11, encerrada), O-2 (POP-05 de C01), O-3 (POP-07 de C28). */
export const OCCURRENCE = { o1: 'occ_0001', o2: 'occ_0002', o3: 'occ_0003' } as const;

/** Reclamações REC-0001 a REC-0005. */
export function complaintId(n: number): string {
  return `rec_${pad4(n)}`;
}

/** Solicitações do titular (5.13). */
export const DSR = {
  c18Erasure: 'dsr_0001',
  c19Portability: 'dsr_0002',
  c20Correction: 'dsr_0003',
  c16Revocation: 'dsr_0004',
  c02Review: 'dsr_0005',
} as const;

/** Salas, usuários e demais identificadores vivem aqui para os testes referenciarem sem repetir texto. */
export const INCIDENT_ID = 'inc_0001';
