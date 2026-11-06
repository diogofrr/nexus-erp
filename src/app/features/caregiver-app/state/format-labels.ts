import { Activity, SessionModality } from '../../../core/models';

/**
 * Como o aplicativo do cuidador chama o formato de uma conversa ou de um encontro (UX C8 e C10, RN-ATD-02): "On-line",
 * "No espaço de coworking" e "Em casa". Uma só lista para Conversar com um psicólogo, Hoje e Grupos usarem as mesmas
 * palavras.
 */
export const FORMAT_LABEL: Readonly<Record<SessionModality, string>> = {
  online: 'On-line',
  in_person_coworking: 'No espaço de coworking',
  in_person_home: 'Em casa',
};

/** O formato de uma atividade de grupo: só há on-line e o espaço de coworking. */
export function activityFormatLabel(mode: Activity['mode']): string {
  return mode === 'online' ? FORMAT_LABEL.online : FORMAT_LABEL.in_person_coworking;
}
