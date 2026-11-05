import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuditLogService } from '@core/audit';
import { Database } from '@core/data';
import { formatDate } from '@core/format';
import { CONSENT_EFFECTS, CONSENT_KEYS, CONSENT_LABELS, DSR_DEADLINE_DAYS, DSR_TYPE_LABELS, riskCriticality } from '@core/rules';
import { BadgeComponent, CardComponent, EmptyStateComponent, PageHeaderComponent } from '@shared/ui';
import { LgpdNavComponent } from '../components/lgpd-nav.component';

/** Dados tratados, finalidade e base legal por campo (escopo 6.3), em linguagem simples. */
const DATA_BASES: readonly { data: string; purpose: string; basis: string; who: string }[] = [
  { data: 'Escala de Zarit, alertas e respostas', purpose: 'Acompanhar o cuidador', basis: 'Consentimento de saúde; tutela da saúde', who: 'Psicólogo do caso e responsável técnico; a gestão só vê números somados' },
  { data: 'Anotações de sessão e ocorrências', purpose: 'Registro documental psicológico', basis: 'Tutela da saúde; obrigação regulatória', who: 'Psicólogo autor e responsável técnico' },
  { data: 'CPF, e-mail e telefone', purpose: 'Cadastro e contato', basis: 'Execução de contrato', who: 'Atendimento (mascarado) e psicólogo do caso' },
  { data: 'Condições de saúde e medicamentos da pessoa idosa', purpose: 'Organizar a rotina de cuidados', basis: 'Consentimento do cuidador, só o necessário', who: 'Atendimento consulta, sem editar' },
  { data: 'Avaliações da rede', purpose: 'Qualidade da rede credenciada', basis: 'Legítimo interesse, com aviso', who: 'Gestão, pelo código do cuidador' },
  { data: 'Imagem e depoimento', purpose: 'Comunicação da Nexus', basis: 'Consentimento em documento próprio', who: 'Gestão, só com termo ativo' },
];

/** Medidas do RIPD (R10 e correlatos), com a tela onde cada uma vive. */
const MEASURES: readonly string[] = [
  'Controle de acesso por perfil e dupla verificação simulada para a equipe',
  'Registro de acessos a dado sensível, sem editar nem apagar',
  'Pseudonimização na gestão (códigos CUI-0000) e mínimo de 5 pessoas por recorte',
  'Mascaramento de CPF, telefone e e-mail, com motivo para mostrar',
  'Plano de resposta a incidentes (POP-06) com prazo-alvo de 3 dias úteis',
  'Consentimento granular, com revogação tão fácil quanto a concessão',
  'Retenção: registro documental por 5 anos (a confirmar) e eliminação do que não é documental',
];

/**
 * SCR-M12-07 Política de privacidade e SCR-M12-08 RIPD (simulados): a política mostra a encarregada, o canal
 * do titular, as finalidades, as bases legais e os direitos; o RIPD lista os riscos (R10) e as medidas. A
 * política em dois toques de qualquer tela fica fora deste módulo (rodapé, A-43). Só a gestão e o
 * responsável técnico abrem estas telas. Imprimir grava `print` no log.
 */
@Component({
  selector: 'app-privacy-doc-page',
  imports: [BadgeComponent, CardComponent, EmptyStateComponent, LgpdNavComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack stack--6">
      <app-page-header [title]="title()" [description]="description()">
        <button type="button" class="btn" (click)="print()">Imprimir</button>
      </app-page-header>
      <app-lgpd-nav />
      @if (document(); as doc) {
        <app-card title="Encarregada pelos dados" subtitle="Pessoa fictícia do protótipo">
          <dl class="dl">
            <dt>Nome</dt><dd>{{ doc.dpoName }}</dd>
            <dt>Canal do titular</dt><dd>{{ doc.dpoEmail }}</dd>
            <dt>Prazo de resposta</dt><dd>Até {{ days }} dias corridos</dd>
            <dt>Versão</dt><dd>{{ doc.version }}, de {{ date(doc.createdAt) }}</dd>
          </dl>
        </app-card>

        <app-card title="Texto do documento">
          <div class="prose">
            @for (p of paragraphs(); track $index) { <p>{{ p }}</p> }
          </div>
        </app-card>

        @if (kind() === 'privacy_policy') {
          <app-card title="Finalidades e bases legais" [padded]="false">
            <div class="table-wrap table-wrap--flush">
              <table class="table table--stack">
                <caption class="sr-only">Dados tratados, finalidade, base legal e quem vê</caption>
                <thead><tr><th scope="col">Dado</th><th scope="col">Para quê</th><th scope="col">Base legal</th><th scope="col">Quem vê</th></tr></thead>
                <tbody>
                  @for (row of bases; track row.data) {
                    <tr>
                      <td data-label="Dado" class="col-primary">{{ row.data }}</td>
                      <td data-label="Para quê">{{ row.purpose }}</td>
                      <td data-label="Base legal">{{ row.basis }}</td>
                      <td data-label="Quem vê">{{ row.who }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-card>
          <app-card title="Os seis consentimentos">
            <ul class="stack stack--3 list-reset">
              @for (c of consents; track c.key) {
                <li><strong>{{ c.label }}</strong><br /><span class="t-caption">{{ c.purpose }}. Base: {{ c.basis }}.</span></li>
              }
            </ul>
          </app-card>
          <app-card title="Direitos do titular">
            <ul class="stack stack--2 list-reset">
              @for (r of rights; track r) { <li>{{ r }}</li> }
            </ul>
          </app-card>
        } @else {
          <app-card title="Riscos" subtitle="Matriz de riscos: criticidade é probabilidade vezes impacto" [padded]="false">
            @if (risks().length === 0) {
              <p class="card__body t-muted">Nenhum risco cadastrado.</p>
            } @else {
              <div class="table-wrap table-wrap--flush">
                <table class="table table--stack">
                  <caption class="sr-only">Riscos de proteção de dados</caption>
                  <thead><tr><th scope="col">Risco</th><th scope="col" class="col-num">Criticidade</th><th scope="col">Tratamento</th></tr></thead>
                  <tbody>
                    @for (r of risks(); track r.code) {
                      <tr>
                        <td data-label="Risco" class="col-primary">{{ r.code }}: {{ r.title }}</td>
                        <td data-label="Criticidade" class="col-num"><app-badge [variant]="r.criticality >= 12 ? 'danger' : 'neutral'" dot>{{ r.criticality }}{{ r.criticality >= 12 ? ' (prioritário)' : '' }}</app-badge></td>
                        <td data-label="Tratamento">{{ r.treatment }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </app-card>
          <app-card title="Medidas">
            <ul class="stack stack--2 list-reset">
              @for (m of measures; track m) { <li>{{ m }}</li> }
            </ul>
          </app-card>
        }
      } @else {
        <app-empty-state kind="error" title="Documento não encontrado" text="Este documento ainda não foi carregado neste navegador." />
      }
    </div>
  `,
})
export class PrivacyDocPage {
  private readonly db = inject(Database);
  private readonly audit = inject(AuditLogService);
  private readonly doc = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);

  /** `privacy_policy` ou `ripd`, vindo do `data` da rota. */
  protected readonly kind = computed<'privacy_policy' | 'ripd'>(() =>
    this.route.snapshot.data['kind'] === 'ripd' ? 'ripd' : 'privacy_policy',
  );

  protected readonly days = DSR_DEADLINE_DAYS;
  protected readonly bases = DATA_BASES;
  protected readonly measures = MEASURES;
  protected readonly rights = Object.values(DSR_TYPE_LABELS);
  protected readonly consents = CONSENT_KEYS.map((key) => ({ key, label: CONSENT_LABELS[key], purpose: CONSENT_EFFECTS[key].purpose, basis: CONSENT_EFFECTS[key].legalBasis }));

  protected readonly title = computed(() => (this.kind() === 'ripd' ? 'Relatório de impacto (RIPD)' : 'Política de privacidade'));
  protected readonly description = computed(() =>
    this.kind() === 'ripd'
      ? 'Documento simulado: dados, finalidades, riscos e medidas.'
      : 'Texto simulado, em linguagem acessível: encarregada, canal do titular, finalidades e bases.',
  );
  protected readonly document = computed(() => this.db.privacyDocuments.find((d) => d.kind === this.kind()));
  protected readonly paragraphs = computed(() => (this.document()?.body ?? '').split(/\n\s*\n/).filter((p) => p.trim().length > 0));
  protected readonly risks = computed(() =>
    this.db.risks
      .all()
      .filter((r) => /dados|vazamento|privacidade/i.test(r.title) || r.code === 'R10')
      .map((r) => ({ code: r.code, title: r.title, treatment: r.treatment, criticality: riskCriticality(r.probability, r.impact) })),
  );

  protected date(value: string | undefined): string {
    return formatDate(value);
  }

  protected print(): void {
    this.audit.printed(this.kind() === 'ripd' ? 'ripd' : 'privacy_policy');
    this.doc.defaultView?.print();
  }
}

