import { ZaritBand } from '@core/models';

/**
 * Os textos de "Como estou" (UX C9, B5; RN-ZRT-04, 08, 18, 19, 20, 22 e 23, RN-LGPD-14, RN-PLN-19, RN-ETICA-15). Linguagem de todo dia:
 * "cansaço" na tela, "sobrecarga" só no nome oficial da faixa. Nada de "alerta", "melhorou", "piorou", percentual, plano
 * ou convite. A frase "Não é um diagnóstico." aparece sempre junto da linha do tempo e vai SEMPRE numa linha só no
 * código (a verificação de texto procura a frase inteira).
 */

export const WELLBEING_LEAD =
  'Aqui você vê como o seu cansaço tem andado. Quem faz as perguntas é a equipe de psicologia. Você não precisa preencher nada.';

export const TIMELINE_INTRO =
  'Cada ponto é uma conversa de acompanhamento com a equipe. A escala ajuda a equipe a escutar você. Não é um diagnóstico.';

export const PRIVACY_LINE = 'Só você e a equipe de psicologia que acompanha você veem estas informações.';

export const CARE_TODAY = 'A equipe de psicologia vai falar com você hoje.';
export const CARE_NOT_YET =
  'A equipe ainda não conseguiu falar com você. A responsável técnica foi avisada e vai procurar você.';

export const EMPTY_TITLE = 'Ainda não houve uma conversa de acompanhamento';
export const EMPTY_TEXT = 'A equipe de psicologia conversa com você e aplica a escala. Você não precisa preencher nada.';

export const NEXT_UNKNOWN = 'A equipe vai combinar a próxima conversa com você.';

export const PAUSED_TITLE = 'O acompanhamento está pausado';

/** A frase de cada faixa, em linguagem simples, e o intervalo oficial (RN-ZRT-08). */
export const BAND_MEANING: Readonly<Record<ZaritBand, string>> = {
  absent_or_small: 'o cuidado pesa pouco.',
  moderate: 'o cuidado pesa em parte do tempo.',
  moderate_to_severe: 'o cuidado pesa bastante.',
  severe: 'o cuidado está pesando muito.',
};

export const BANDS_CLOSING = 'Em qualquer faixa, a equipe está aqui para conversar com você.';

export const REVIEW_SHEET_TEXT =
  'Se você não concorda com alguma decisão tomada com base nos seus resultados, conte aqui. O psicólogo responde por escrito.';
export const REVIEW_EMPTY_ERROR = 'Conte em uma frase o que você quer que a equipe reveja.';
export const REVIEW_ERROR = 'Não foi possível enviar. Seu texto continua aqui. Tente de novo.';

export const ARRANGE_PERIODS: readonly { value: 'morning' | 'afternoon' | 'evening'; label: string; phrase: string }[] = [
  { value: 'morning', label: 'Manhã', phrase: 'de manhã' },
  { value: 'afternoon', label: 'Tarde', phrase: 'à tarde' },
  { value: 'evening', label: 'Noite', phrase: 'à noite' },
];

export const ARRANGE_SUBJECT = 'Combinar um horário';
