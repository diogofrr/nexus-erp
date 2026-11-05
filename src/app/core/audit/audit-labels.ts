/** Rótulos em pt-BR do log de auditoria (ação e entidade), para telas e para o CSV legível. */
import { AccessAction } from '../models/access';

export const ACTION_LABELS: Readonly<Record<AccessAction, string>> = {
  login: 'Entrada',
  logout: 'Saída',
  view: 'Consulta',
  create: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
  export: 'Exportação',
  print: 'Impressão',
  reveal: 'Dado mostrado',
  denied: 'Acesso negado',
  supervise: 'Supervisão',
};

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  session: 'Sessão de acesso',
  route: 'Tela',
  caregiver: 'Cadastro do cuidador',
  caregiver_data: 'Dados do cuidador',
  caregiver_anonymization: 'Anonimização',
  caregiver_list_csv: 'Lista de cuidadores (CSV)',
  elder: 'Pessoa idosa',
  elder_conditions: 'Saúde da pessoa idosa',
  zarit_assessment: 'Aplicação da escala',
  zarit_alert: 'Alerta da escala',
  session_note: 'Anotação de sessão',
  occurrence: 'Ocorrência',
  consent_event: 'Consentimento',
  data_subject_request: 'Solicitação do titular',
  subject_portability: 'Dados do titular',
  subject_export: 'Dados do titular',
  access_log_csv: 'Log de acessos (CSV)',
  subscription: 'Assinatura',
  card_usage: 'Uso do cartão',
  incident: 'Incidente de dados',
  pop: 'Procedimento (POP)',
  consent_term: 'Termo de consentimento',
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity.replace(/_/g, ' ');
}
