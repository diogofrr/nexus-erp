/**
 * Cópia JSON da visão da gestão (M15, QA-007, escopo 1.2 e 1.3). A tela de dados de demonstração é da sócia
 * (`partner`), que só vê código `CUI-0000` e agregados: a cópia que ela baixa NÃO leva nome, CPF, contato,
 * condição de saúde, escala de Zarit (respostas, pontos e alertas), notas de sessão, mensagens nem ocorrências
 * de risco. Pseudonimização pura: recebe o envelope completo e devolve outro, sem tocar no original.
 */
import type { Caregiver, Elder } from '../models';
import { ExportEnvelope } from './import-export';

/** CPF neutro: dígitos iguais nunca fecham o dígito verificador (AC-GL-12). */
const NEUTRAL_CPF = '000.000.000-00';
const NEUTRAL_PHONE = '(34) 90000-0000';

/** O que a cópia leva, em frases para a tela (QA-007: avisar o que a cópia leva). */
export const MANAGEMENT_COPY_KEEPS = [
  'códigos (CUI-0000) no lugar de nome, CPF, e-mail e telefone',
  'planos, assinaturas, sessões (sem as notas), grupos, prestadores, parceiros e financeiro',
  'o log de acessos e as solicitações do titular',
] as const;

export const MANAGEMENT_COPY_OMITS = [
  'respostas, pontos e alertas da escala de Zarit e da ARBE',
  'notas de sessão, mensagens e ocorrências de risco',
  'condições de saúde, medicamentos e compromissos de cuidado',
] as const;

/** Aviso curto, uma frase só, para a tela e para o aviso ao baixar. */
export const MANAGEMENT_COPY_SUMMARY =
  'A cópia leva só o que a gestão pode ver: códigos no lugar de nomes, sem escala de Zarit, notas, mensagens nem dados de saúde.';

/** Só o ano de nascimento: mantém a faixa de idade e tira a data exata. */
function yearOnly(isoDate: string): string {
  return /^\d{4}-/.test(isoDate) ? `${isoDate.slice(0, 4)}-01-01` : isoDate;
}

function codeOf(caregiver: Caregiver): string {
  return caregiver.code || caregiver.id.toUpperCase();
}

function pseudonymizeCaregiver(caregiver: Caregiver): Caregiver {
  const code = codeOf(caregiver);
  const { whatsapp: _whatsapp, sociodemographics: _sociodemographics, ...rest } = caregiver;
  return {
    ...rest,
    fullName: code,
    cpf: NEUTRAL_CPF,
    email: `${code.toLowerCase()}@exemplo.com.br`,
    phone: NEUTRAL_PHONE,
    birthDate: yearOnly(caregiver.birthDate),
  };
}

function pseudonymizeElder(elder: Elder, codes: ReadonlyMap<string, string>): Elder {
  const code = codes.get(elder.caregiverId) ?? elder.caregiverId.toUpperCase();
  const { conditionsSummary: _conditions, ...rest } = elder;
  return {
    ...rest,
    fullName: `Pessoa idosa de ${code}`,
    birthDate: yearOnly(elder.birthDate),
  };
}

/** Gera a cópia da visão da gestão a partir do envelope completo. */
export function toManagementCopy(envelope: ExportEnvelope): ExportEnvelope {
  const source = envelope.collections;
  const codes = new Map(source.caregivers.map((c) => [c.id, codeOf(c)] as const));
  return {
    ...envelope,
    scope: 'management',
    collections: {
      ...source,
      caregivers: source.caregivers.map(pseudonymizeCaregiver),
      elders: source.elders.map((e) => pseudonymizeElder(e, codes)),
      // Saúde e conteúdo clínico: a gestão não vê (matriz 1.2, bloqueios 1.3).
      medications: [],
      careAppointments: [],
      wellbeingChecks: [],
      zaritAssessments: [],
      zaritAlerts: [],
      arbeAlerts: [],
      reviewRequests: [],
      sessionNotes: [],
      messages: [],
      occurrences: [],
      referrals: [],
    },
  };
}
