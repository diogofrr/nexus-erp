import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormFieldComponent, NxInputDirective, NxMaskDirective } from '@shared/ui';
import {
  CHANNEL_OPTIONS,
  CaregiverFieldsForm,
  LITERACY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SEX_OPTIONS,
} from '../state/caregiver-form';

/**
 * Campos do cuidador, os mesmos no cadastro novo e na edição. Rótulo sempre visível, dica acima, erro
 * abaixo com a mesma frase do resumo; nada é limpo ao errar. `autocomplete="off"` porque o atendente
 * cadastra OUTRA pessoa (WCAG 1.3.5). O conteúdo projetado entra depois da data de nascimento (o CPF).
 */
@Component({
  selector: 'app-caregiver-fields-form',
  imports: [FormFieldComponent, NxInputDirective, NxMaskDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-grid" [formGroup]="form()">
      <app-form-field class="span-2" label="Nome completo" controlId="nx-cg-fullName" [forceErrors]="submitted()">
        <input appInput formControlName="fullName" autocomplete="off" />
      </app-form-field>
      <app-form-field label="Data de nascimento" hint="Digite dia, mês e ano. O cuidador precisa ter 18 anos ou mais." controlId="nx-cg-birthDate" [forceErrors]="submitted()">
        <input appInput appMask="date" formControlName="birthDate" />
      </app-form-field>
      <ng-content />
      <app-form-field label="E-mail" hint="Termina em @exemplo.com.br (dados fictícios)." controlId="nx-cg-email" [forceErrors]="submitted()">
        <input appInput type="email" formControlName="email" autocomplete="off" />
      </app-form-field>
      <app-form-field label="Telefone" hint="De (34) 90000-0000 a (34) 90000-0999." controlId="nx-cg-phone" [forceErrors]="submitted()">
        <input appInput appMask="phone" formControlName="phone" autocomplete="off" />
      </app-form-field>
      <app-form-field label="WhatsApp" optional controlId="nx-cg-whatsapp" [forceErrors]="submitted()">
        <input appInput appMask="phone" formControlName="whatsapp" autocomplete="off" />
      </app-form-field>
      <app-form-field label="Parentesco com a pessoa idosa" controlId="nx-cg-relationship" [forceErrors]="submitted()">
        <select appInput formControlName="relationship">
          <option [ngValue]="null">Escolha uma opção</option>
          @for (o of relationships; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
        </select>
      </app-form-field>
      <app-form-field label="Sexo" controlId="nx-cg-sex" [forceErrors]="submitted()">
        <select appInput formControlName="sex">
          <option [ngValue]="null">Escolha uma opção</option>
          @for (o of sexes; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
        </select>
      </app-form-field>
      <app-form-field label="Cidade" controlId="nx-cg-city" [forceErrors]="submitted()">
        <input appInput formControlName="city" autocomplete="off" />
      </app-form-field>
      <app-form-field label="Horas de cuidado por dia" hint="Um número inteiro de 0 a 24." controlId="nx-cg-hours" [forceErrors]="submitted()">
        <input appInput class="input--num" appMask="number" min="0" max="24" rangeMessage="As horas por dia devem ser de 0 a 24." formControlName="dailyCareHours" />
      </app-form-field>
      <app-form-field label="Canal preferido de contato" controlId="nx-cg-channel" [forceErrors]="submitted()">
        <select appInput formControlName="preferredChannel">
          <option [ngValue]="null">Escolha uma opção</option>
          @for (o of channels; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
        </select>
      </app-form-field>
      <app-form-field label="Familiaridade digital" controlId="nx-cg-literacy" [forceErrors]="submitted()">
        <select appInput formControlName="digitalLiteracy">
          <option [ngValue]="null">Escolha uma opção</option>
          @for (o of literacies; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
        </select>
      </app-form-field>
    </div>
  `,
})
export class CaregiverFieldsFormComponent {
  readonly form = input.required<CaregiverFieldsForm>();
  /** Mostra os erros de todos os campos (depois de tentar continuar ou salvar). */
  readonly submitted = input(false);

  protected readonly relationships = RELATIONSHIP_OPTIONS;
  protected readonly sexes = SEX_OPTIONS;
  protected readonly channels = CHANNEL_OPTIONS;
  protected readonly literacies = LITERACY_OPTIONS;
}
