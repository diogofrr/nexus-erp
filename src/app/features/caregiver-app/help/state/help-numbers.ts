/**
 * Os números de ajuda da tela "Ajuda agora" (RN-ATD-11, RN-CAN-05 e 06, RN-ENC-09). São números públicos do Brasil e
 * valem para qualquer pessoa, com ou sem entrada no aplicativo. No protótipo nenhum deles disca (S-13): o toque abre
 * um diálogo com o número grande e "Copiar número". As informações do CVV e do Disque 100 devem ser conferidas na
 * fonte oficial antes de qualquer uso fora do protótipo (pedido P-07 do UX).
 */
export type HelpNumberKey = 'samu' | 'cvv' | 'disque100';

export interface HelpNumber {
  key: HelpNumberKey;
  /** O número, só dígitos (é texto: nunca vira `tel:`). */
  number: string;
  /** Nome curto do serviço. */
  name: string;
  /** Uma frase simples do que é, para o diálogo. */
  about: string;
}

export const HELP_NUMBERS: Readonly<Record<HelpNumberKey, HelpNumber>> = {
  samu: {
    key: 'samu',
    number: '192',
    name: 'SAMU',
    about: 'Atendimento de emergência de saúde, a qualquer hora.',
  },
  cvv: {
    key: 'cvv',
    number: '188',
    name: 'CVV',
    about: 'Conversa de apoio emocional, a qualquer hora e de graça. Também atende por chat no site cvv.org.br.',
  },
  disque100: {
    key: 'disque100',
    number: '100',
    name: 'Disque 100',
    about: 'Denúncia de violência ou maus-tratos contra a pessoa idosa.',
  },
};

/** Frase fixa do diálogo do número (decisão 6 do contexto e S-13). */
export const NO_CALL_IN_PROTOTYPE =
  'No protótipo, a ligação não é feita. Em uma emergência de verdade, ligue do seu telefone.';

