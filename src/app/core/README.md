# Núcleo do Nexus ERP (`src/app/core`)

Guia prático para quem constrói um módulo. A visão geral, o mapa de módulos, o seed e as decisões estão em `docs/08-arquitetura.md`. Importe pelos aliases: `@core/data`, `@core/auth`, `@core/rules`, `@core/models`...

```
models/   tipos do modelo de dados        clock/    Clock e funções de data
storage/  StorageService (único acesso)   data/     repositórios, Database, importar e exportar
auth/     sessão, permissões, guards      audit/    log de auditoria
privacy/  máscaras, agregação, LGPD       rules/    regras de negócio puras
seed/     dados fictícios determinísticos format/   funções e pipes pt-BR
```

## 1. Ler e gravar dados (repositórios)

Nunca toque `localStorage`. Tudo passa pelo `Database`, que tem um repositório tipado por entidade, baseado em signals e persistido por coleção.

```ts
import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { Database, NewEntity } from '@core/data';
import { Caregiver } from '@core/models';
import { Clock } from '@core/clock';

@Component({ /* ... */ changeDetection: ChangeDetectionStrategy.OnPush })
export class CaregiverListPage {
  private readonly db = inject(Database);
  private readonly clock = inject(Clock);

  // Signal derivado: atualiza sozinho quando a coleção muda.
  protected readonly active = this.db.caregivers.watch((c) => c.status === 'active');
  protected readonly total = computed(() => this.active().length);

  rename(id: string, fullName: string): void {
    this.db.caregivers.update(id, { fullName }); // updatedAt vem do Clock; grava no armazenamento
  }

  add(draft: NewEntity<Caregiver>): string {
    return this.db.caregivers.create(draft).id; // id sequencial por prefixo: 'cg_0341'
  }
}
```

Operações: `list()`, `get(id)`, `require(id)`, `query(fn)`, `find(fn)`, `count(fn?)`, `exists(id)`, `create(draft)`, `createMany(drafts)`, `update(id, patch)`, `updateWith`, `updateWhere`, `upsert`, `remove(id)`, `removeWhere(fn)`, e os signals `all`, `size`, `watch(fn?)`, `watchOne(id)`. Atualize em lote com `createMany` e `updateWhere` (uma gravação só).

Log de auditoria e eventos de consentimento são **append-only** (`db.accessLog`, `db.consentEvents` só têm `append`): use `AuditLogService` e `ConsentService`.

Documentos únicos: `db.settings`, `db.financialParams`, `db.pilotConfig` (`get()`, `value`, `set`, `patch`, `reset`).

Seed e reset: `db.seed()`, `db.reset()` (apaga e gera de novo), `db.wipe()`, `db.exportJson()`, `db.importJson(texto)` (recusa arquivo inválido sem alterar nada).

## 2. O relógio (`Clock`)

"Hoje" e "agora" vêm **sempre** do `Clock`: `clock.today()` (`'2026-11-04'`), `clock.now()` (ISO com `-03:00`), `clock.addDays(n)`, `clock.startOfMonth()`, `clock.daysUntil(data)`. A data simulada (M15) afeta todos os prazos: `clock.setSimulated('2026-12-01')`, `clock.advanceDays(7)`, `clock.resetToReal()`. Conta de calendário sem relógio: `addDays`, `addMonths`, `daysBetween`... de `@core/clock`.

## 3. Permissões

```ts
const auth = inject(AuthService);
auth.can('zarit_individual', 'view');                       // nível de tela
auth.canOnRecord('caregiver_registry', 'view', ownershipOfCaregiver(cg)); // psicólogo só vê os seus
can(role, 'finance', 'view');                               // função pura (matriz do escopo 1.2)
accessLevel(role, 'caregiver_registry');                    // '-', 'L', 'E', 'T', 'A', 'P', 'C' ou 'S'
menuFor(role);                                              // itens do menu lateral (AC-M01-08)
```

Níveis: `A` só agregado ou pseudonimizado, `P` registros próprios, `C` clínico do caso, `S` supervisão (exige justificativa e log). Rotas: `moduleGuard('finance')`, `permissionGuard('lgpd_audit_log')`, `roleGuard('partner', 'technical_lead')`. A rota negada vai a `/403` e grava `denied`. Todos os perfis são da equipe (o portal do prestador foi removido): o prestador é um cadastro da rede e só recebe dados do cuidador com solicitação aceita e cláusula assinada (`providerMaySeeCaregiverData`, RN-LGPD-13).

## 4. Log de auditoria

```ts
const audit = inject(AuditLogService);
audit.view('zarit_assessment', assessment.id, caregiver.id);                  // leitura de dado sensível
audit.supervise('zarit_alert', alert.id, caregiver.id, 'Alerta vencido');     // RT em caso que não é dele
audit.reveal('caregiver', caregiver.id, 'cpf', caregiver.id, 'Confirmar cadastro'); // "mostrar" dado mascarado
audit.write('update', 'session_note', note.id, caregiver.id);                 // gravação sensível
audit.exported('subject_portability', caregiver.id);                          // exportação
```

`supervise` e `reveal` lançam `JustificationRequiredError` sem justificativa. Consulta: `audit.query({ role, action, from, to, text })`; CSV sem conteúdo clínico: `audit.toCsv(entries)`.

## 5. Privacidade

```ts
maskCpf(cg.cpf);            // '***.***.***-**'     maskPhone('(34) 90000-0123') -> '(34) 9****-0123'
maskEmail(cg.email);        // 'a***@exemplo.com.br'  maskName('Ana Paula Ferraz') -> 'Ana P. F.'
pseudonymizeCaregiver(cg, planId);   // só code (CUI-0042), status, plano: visão do partner
aggregateCount(n);          // { sufficient: false, label: 'dado insuficiente', shortLabel: 'menos de 5' } se n < 5
zaritDistribution(totals);  // distribuição por faixa já com o mínimo de 5 por recorte
```

Pipes: `{{ cg.cpf | cpfMask }}`. Consentimento granular: `inject(ConsentService)` (`grant`, `refuse`, `revoke`, `history`, `isActive`; a revogação de saúde aplica os efeitos de RN-LGPD-14). Direitos do titular: `DataSubjectRequestService` (`open`, `start`, `complete`, `reject`, `exportSubject`, `executeErasure`). Eliminação, bloqueio por retenção e anonimização: `RetentionService`. Aviso de protótipo (AC-GL-05) e banner da primeira visita (LP-01): `PROTOTYPE_NOTICE`, `FIRST_VISIT_NOTICE` e `UiNoticeService` (`bannerVisible()`, `acknowledge()`). "Meus dados no navegador" (SCR-M12-10): `BrowserDataService` (`usage()` e `eraseAll()`; peça confirmação antes e leve o usuário a `/login`).

## 6. Regras de negócio (puras)

Em `@core/rules`, sem Angular e sem relógio (recebem a data como argumento):

```ts
zaritTotal(answers); zaritBand(total); zaritAlertLevel(total); zaritEvolution(adesao, atual); nextZaritDueDate(data);
evaluateArbe({ dailyCareHours, supportRequestsInWindow, lastZarit }, settings);
providerAverageFromSum(soma, n); arpBand(media, graves); refusalStats(requests, providerId, now);
occupancyPercent(disponiveis, realizadas); hasOverloadAlert(meses, mesCorrente);
projectScenario(params, 'base'); breakEvenSubscribers(params); realizedFinance(params, assinantesPorPlano);
messageDueAt(canal, recebidoEm); isMessageOverdue(msg, agora); complaintDueAt(abertaEm);
validateFictitiousCpf(cpf); validateAdult(nascimento, hoje); canAccessActivity(plano, tipo);
```

## 7. Formatação (pt-BR)

Funções e pipes: `money` (`4990` vira `R$ 49,90`), `dateBr` (`04/11/2026`), `timeBr`, `dateTimeBr`, `percentBr` (`86,3%`), `numberBr`, `cpfMask`, `relativeTime` (relativo ao `Clock`). Em componente standalone: `imports: [MoneyPipe, DateBrPipe]` ou `FORMAT_PIPES`.

## 8. Testes

```ts
import { configureCoreTest } from '@core/testing/test-helpers';

const { db, clock } = configureCoreTest({ seed: true, today: '2026-11-04', time: '12:00' });
// armazenamento falso, relógio simulado e seed completo; use TestBed.inject(...) para os serviços
```

Comandos em `docs/08-arquitetura.md`, seção 6. Rode sempre com `--watch=false` e, se possível, com `--include`.
