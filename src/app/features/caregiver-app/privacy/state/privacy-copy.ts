import { ConsentKey, ConsentStatus, DsrType } from '@core/models';
import { CONSENT_COPY, ConsentCopy } from '@shared/ui';

/**
 * Os textos da tela "Privacidade e meus dados" (UX C21, S-34): o rótulo do aplicativo é "autorização" (palavra de todo
 * dia); o termo jurídico "consentimento" fica nos textos legais. Frases curtas, sem jargão, sem promessa.
 */

/** O nome de cada autorização, em linguagem simples (UX C21). */
export const CONSENT_NAMES: Readonly<Record<ConsentKey, string>> = {
  health_data: 'Dados de saúde para o acompanhamento',
  people_analytics: 'Números somados da Nexus',
  family_sharing: 'Compartilhar com a família',
  image_testimony: 'Imagem e depoimento',
  whatsapp_contact: 'Contato por WhatsApp',
  pilot_tcle: 'Piloto da Nexus',
};

/** A ordem fixa das autorizações na tela. */
export const CONSENT_ORDER: readonly ConsentKey[] = [
  'health_data',
  'people_analytics',
  'family_sharing',
  'image_testimony',
  'whatsapp_contact',
  'pilot_tcle',
];

/**
 * O texto simples de cada autorização: o mesmo do cadastro (`CONSENT_COPY`), só com "autorização" no lugar de
 * "consentimento" onde ele aparece (S-34).
 */
export function consentCopy(key: ConsentKey): ConsentCopy {
  const base = CONSENT_COPY[key];
  if (key === 'health_data') {
    return {
      ...base,
      change:
        'Você pode retirar a autorização quando quiser. O registro psicológico já feito é guardado por 5 anos, conforme a norma do conselho.',
    };
  }
  return base;
}

/**
 * O que acontece ao retirar, na voz do aplicativo (B11): o que pausa, o que fica guardado e o que continua. Nunca fala
 * em plano, desconto ou oferta (RN-PLN-19). A de saúde é o texto literal do UX.
 */
export const REVOKE_EFFECTS: Readonly<Record<ConsentKey, string>> = {
  health_data:
    'Ao retirar: a escala de cansaço e o acompanhamento ficam pausados. O que já foi registrado fica guardado por 5 anos, como a norma do conselho pede. O plano Livre, a agenda e os remédios continuam. Você pode autorizar de novo quando quiser.',
  people_analytics:
    'Ao retirar: você sai dos números somados da Nexus a partir de hoje. O que você usa no aplicativo continua igual. Você pode autorizar de novo quando quiser.',
  family_sharing:
    'Ao retirar: a Nexus deixa de compartilhar informações da pessoa idosa com a sua família. O texto que você já copiou e mandou não volta. O que você usa no aplicativo continua igual.',
  image_testimony:
    'Ao retirar: a Nexus deixa de usar a sua imagem e o seu depoimento, e os materiais são marcados para sair de circulação. O que você usa no aplicativo continua igual.',
  whatsapp_contact:
    'Ao retirar: a Nexus para de falar com você pelo WhatsApp e o seu canal preferido volta a ser o aplicativo. O que você usa no aplicativo continua igual.',
  pilot_tcle:
    'Ao retirar: você sai do piloto da Nexus. O que já foi coletado segue as regras de guarda de dados. O que você usa no aplicativo continua igual.',
};

/** Quando a pessoa voltou atrás, a tela explica como voltar ao piloto (a equipe é quem inclui). */
export const PILOT_COME_BACK = 'Para voltar ao piloto, fale com a gente. A equipe é quem faz a inclusão.';

/** O estado em uma frase, com a data quando há (AC-CG-173). */
export function consentStateText(status: ConsentStatus, since: string | null): string {
  switch (status) {
    case 'granted':
      return since ? `Você autorizou em ${since}` : 'Você autorizou';
    case 'revoked':
      return since ? `Você não autorizou desde ${since}` : 'Você não autorizou';
    case 'refused':
      return 'Você não autorizou';
    default:
      return 'Você ainda não decidiu';
  }
}

/** Nome do pedido na lista "Meus pedidos", em palavras de todo dia. */
export const REQUEST_NAMES: Readonly<Record<DsrType, string>> = {
  access: 'Cópia dos meus dados',
  portability: 'Cópia dos meus dados',
  erasure: 'Eliminação dos meus dados',
  correction: 'Correção dos meus dados',
  anonymization_or_blocking: 'Anonimização dos meus dados',
  consent_revocation: 'Retirada de uma autorização',
  sharing_info: 'Com quem os meus dados foram compartilhados',
  decision_review: 'Revisão de uma decisão',
};

/**
 * Dias que faltam, em dias corridos, sem relógio e sem vermelho (UX C21, RN-LGPD-21): "Faltam 12 dias", "Falta 1 dia".
 * Passado o prazo, uma frase neutra: nunca "vencido" nem "atrasado".
 */
export function daysLeftText(daysRemaining: number): string {
  if (daysRemaining > 1) {
    return `Faltam ${daysRemaining} dias`;
  }
  if (daysRemaining === 1) {
    return 'Falta 1 dia';
  }
  if (daysRemaining === 0) {
    return 'O prazo termina hoje';
  }
  return 'A equipe vai responder em breve';
}

export const COPY_SHEET_TEXT = 'A equipe prepara o arquivo com os seus dados e avisa você em até 15 dias.';

export const ERASURE_ERASED_TEXT = 'o seu cadastro de contato, mensagens, agenda e remédios.';
export const ERASURE_KEPT_TEXT =
  'as respostas da escala e as anotações do atendimento, por 5 anos, como a norma do conselho pede. Depois disso, são apagados.';
export const ERASURE_CONTINUE_TEXT = 'Você continua usando o app até a equipe concluir.';

export const REQUEST_ERROR = 'Não foi possível registrar o pedido. Tente de novo; se continuar, fale com a gente.';
export const SHARING_NOTE = 'Nada mais é compartilhado. O texto da Família é copiado por você: a Nexus não envia.';
