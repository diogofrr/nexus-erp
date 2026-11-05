import { FormControl, FormGroup } from '@angular/forms';
import type { Channel, Relationship, Sex } from '@core/models';
import { ErrorSummaryItem, NxValidators, fieldErrorMessage } from '@shared/ui';
import { AbstractControl } from '@angular/forms';
import { CHANNEL_LABELS, LITERACY_LABELS, RELATIONSHIP_LABELS, SEX_LABELS } from './caregiver-labels';

export type Literacy = 'low' | 'medium' | 'high';

/** Campos do cuidador (F02, etapa 1), com as validações do escopo: maioridade, e-mail e telefone fictícios, horas de 0 a 24. */
export function caregiverFieldsGroup(today: () => string) {
  return new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o nome completo do cuidador'), NxValidators.textLength(3, 120, 'O nome')] }),
    birthDate: new FormControl<string | null>(null, [NxValidators.required('a data de nascimento'), NxValidators.adult(today)]),
    email: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o e-mail'), NxValidators.fictitiousEmail] }),
    phone: new FormControl('', { nonNullable: true, validators: [NxValidators.required('o telefone'), NxValidators.fictitiousPhone] }),
    whatsapp: new FormControl('', { nonNullable: true, validators: [NxValidators.fictitiousPhone] }),
    relationship: new FormControl<Relationship | null>(null, [NxValidators.required('o parentesco com a pessoa idosa')]),
    sex: new FormControl<Sex | null>(null, [NxValidators.required('o sexo')]),
    city: new FormControl('Uberlândia', { nonNullable: true, validators: [NxValidators.required('a cidade')] }),
    dailyCareHours: new FormControl<number | null>(null, [NxValidators.required('as horas de cuidado por dia'), NxValidators.range(0, 24, 'As horas por dia')]),
    preferredChannel: new FormControl<Channel | null>(null, [NxValidators.required('o canal preferido')]),
    digitalLiteracy: new FormControl<Literacy | null>(null, [NxValidators.required('a familiaridade digital')]),
  });
}

export type CaregiverFieldsForm = ReturnType<typeof caregiverFieldsGroup>;

export interface FieldMeta {
  key: keyof CaregiverFieldsForm['controls'];
  id: string;
  label: string;
}

/** Ids e rótulos dos campos, para o resumo de erros apontar para o campo certo. */
export const CAREGIVER_FIELD_META: readonly FieldMeta[] = [
  { key: 'fullName', id: 'nx-cg-fullName', label: 'Nome completo' },
  { key: 'birthDate', id: 'nx-cg-birthDate', label: 'Data de nascimento' },
  { key: 'email', id: 'nx-cg-email', label: 'E-mail' },
  { key: 'phone', id: 'nx-cg-phone', label: 'Telefone' },
  { key: 'whatsapp', id: 'nx-cg-whatsapp', label: 'WhatsApp' },
  { key: 'relationship', id: 'nx-cg-relationship', label: 'Parentesco' },
  { key: 'sex', id: 'nx-cg-sex', label: 'Sexo' },
  { key: 'city', id: 'nx-cg-city', label: 'Cidade' },
  { key: 'dailyCareHours', id: 'nx-cg-hours', label: 'Horas de cuidado por dia' },
  { key: 'preferredChannel', id: 'nx-cg-channel', label: 'Canal preferido' },
  { key: 'digitalLiteracy', id: 'nx-cg-literacy', label: 'Familiaridade digital' },
];

/** Monta os itens do resumo de erros ("Há 2 pontos para corrigir") com a MESMA frase de cada campo. */
export function errorItems(
  entries: readonly { id: string; label: string; control: AbstractControl }[],
): ErrorSummaryItem[] {
  return entries.flatMap((e) => {
    const message = fieldErrorMessage(e.control.errors, e.label);
    return message ? [{ controlId: e.id, message }] : [];
  });
}

export function toOptions<T extends string>(labels: Readonly<Record<T, string>>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const RELATIONSHIP_OPTIONS = toOptions<Relationship>(RELATIONSHIP_LABELS);
export const SEX_OPTIONS = toOptions<Sex>(SEX_LABELS);
export const CHANNEL_OPTIONS = toOptions<Channel>(CHANNEL_LABELS);
export const LITERACY_OPTIONS = toOptions<Literacy>(LITERACY_LABELS);
