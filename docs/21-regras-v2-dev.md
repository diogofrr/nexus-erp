# Regras de plano v2: o que o Dev de Regras mudou (11/11/2026)

Status: PRONTO. Aplica `docs/20-regras-planos-v2.md` no núcleo e nas telas de plano, atendimento, encontros, conteúdos e cartão, mais as decisões do líder de 11/11 (redirecionar as rotas que o plano não inclui; nenhuma conversa individual futura para Livre e Essencial no seed). O agente UX v2 cuidou do resto (`docs/21-ux-v2-dev.md`).

## 1. API do contexto do cuidador (contrato com o agente UX)

`features/caregiver-app/state/caregiver-context.service.ts`:

```ts
ctx.canUse(feature): boolean
ctx.access(feature): { allowed: boolean; minPlan: PlanId; reason?: string }   // `reason` só por compatibilidade: NÃO mostre (regra de exibição 1)
ctx.quotas(): CaregiverQuotas   // signal computed, reativo ao Clock e ao banco
```

Chaves de `feature` (`CaregiverFeature`, em `core/rules/plan-features.ts`):

| Chave | Livre | Essencial | Cuida | Sustenta |
|---|---|---|---|---|
| `individual_session` (atendimento psicológico individual) | não | não | sim | sim |
| `group_therapy` (terapia de grupo) | não | não | sim | sim |
| `training_included` (há capacitação incluída no plano) | não | sim (2 por mês) | sim (todas) | sim (todas) |
| `training_paid` (participar de capacitação pagando avulsa) | sim | sim | sim | sim |
| `open_circle` (rodas de conversa abertas) | sim | sim | sim | sim |
| `card` (Cartão Nexus) | não | sim | sim | sim |
| `exclusive_content` | não | sim | sim | sim |
| `network_conditions` (condições especiais na rede) | não | sim | sim | sim |
| `network_differentiated` (benefícios diferenciados na rede) | não | não | não | sim |
| `request_service`, `network_search`, `content`, `organization`, `agenda_reminders` | sim | sim | sim | sim |
| `extended_organization` | não | sim | sim | sim |
| `organization_support` | não | não | sim | sim |
| `close_follow_up` | não | não | não | sim |
| `groups` (compatibilidade: igual a `group_therapy`; não use em tela nova) | não | não | sim | sim |

As chaves antigas `psych_scheduling` e `network_benefits` saíram (viraram `individual_session` e `network_differentiated`).

```ts
interface CaregiverQuotas {
  month: YearMonth;                 // '2026-11', o mês de hoje pelo Clock
  individualSessions: QuotaUsage;   // { limit: 0 | 2 | 4, used, left }
  groupTherapy: QuotaUsage;         // { limit: 0 | 2, used, left }  (encontros no mês)
  trainings: QuotaUsage;            // { limit: 0 | 2 | 'all', used, left }  (encontros no mês)
}
interface QuotaUsage { limit: number | 'all'; used: number; left: number | 'all'; }
```

`state/plan-access.ts` (do UX) já usa `trainingIncluded: ctx.quotas().trainings.left !== 0` (edição mínima minha, combinada no docs/21-ux).

## 2. Núcleo

- **Modelo**: `Activity.kind` é só `open_circle | training | group_therapy`. `ActivityEnrollment` ganhou `includedInPlan`, `paid` e `priceCents`; `CareSession` ganhou `includedInPlan` (o `discountPercent` fica sempre 0); `GuidanceContent` ganhou `category` (`GuidanceCategory`).
- **Migração v1 para v2** (`core/storage/migrations.ts`, `SCHEMA_VERSION = '2'`): renomeia os tipos, refaz `minPlan` (só a terapia de grupo é `cuida`), zera `requiresEligibility`, marca a cota das inscrições e das sessões (R$ 0,00 = incluída) e dá categoria aos conteúdos antigos. Teste em `storage.service.spec.ts`.
- **`core/rules/plan-quotas.ts`** (novo, com spec): `PLAN_QUOTAS` (tabela do docs/20), `SINGLE_PRICES_CENTS` (sessão R$ 120,00, terapia de grupo R$ 60,00 e capacitação R$ 40,00 por encontro), `individualSessionQuota`, `groupTherapyQuota`, `trainingQuota`, `quotaLeft`, `meetingsInMonth`, `enrollmentOffer` (incluída, avulsa, grátis ou bloqueada), frases `quotaSentence`, `includedSentence`, `limitText`, `singlePriceText`.
- **`plan-features.ts`** lê a tabela de cotas. **`plans.ts`**: `canAccessGroupTherapy` substitui `canAccessGroupsAndTrainings`; `canAccessActivity` só bloqueia a terapia de grupo; o aviso da RN-PLN-22 virou "A mensalidade não inclui os serviços da rede."; "Grupos de apoio" virou "Terapia de grupo".
- **Zarit** (`zarit.ts`): `zaritConductFor(total, plano)` dá a conduta por plano nas faixas 21 a 60 (Livre e Essencial: conteúdos, rodas abertas, capacitações e encaminhamento à rede pública ou a clínicas-escola; Cuida e Sustenta: oferta de atendimento psicológico e convite para a terapia de grupo). O alerta vermelho é igual para todos e nenhuma frase sugere troca de plano. A equipe usa a função no resultado e no histórico; "Oferecer atendimento" só aparece para Cuida e Sustenta (o POP-05 e o contato do alerta seguem para todos).
- **Atendimento** (`session-booking.service.ts`): só Cuida e Sustenta agendam (`SESSION_PLAN_BLOCKED`); `quote(caregiverId, slotDate?, exceptSessionId?)` dá a cota do mês da vaga e o preço (R$ 0,00 incluída, senão o avulso de M15); a falta por cancelar com menos de 24 h continua contando; a remarcação não conta a sessão antiga quando ela é liberada sem falta.
- **Encontros** (`group-membership.service.ts`, `caregiver-activities.service.ts`): `offerFor`, `groupTherapyQuotaOf`, `trainingQuotaOf`, `visibleProgramme`, `visibleKinds`, `visibleTo`. A indicação do psicólogo deixou de ser exigida. Rebaixar de plano tira só das turmas futuras de terapia de grupo (RN-GRP-17); a capacitação fica.

## 3. Telas

- **Conversar com um psicólogo** (`care/`, menos a porta): cota do mês no topo; resumo "Incluída no seu plano (1 de 2 neste mês)." ou o avulso com o aviso. `sessionPlanGuard` redireciona Livre e Essencial para `/cuidador/cuidar-de-mim`.
- **Encontros** (`groups/`): `app-cg-section` por tipo com contagem e `app-cg-event-badge`, filtro por tipo, Minhas inscrições primeiro; terapia de grupo invisível para Livre e Essencial (nem por endereço direto); cada cartão com tipo, data, local, vagas ou "Lista de espera" e o valor; a folha do sigilo diz o avulso antes de entrar.
- **Conteúdos** (`content/`): seções e filtro por categoria; exclusivo com selo "Do seu plano"; nada para o Livre.
- **Meu plano** (`plan/`): destaques da tabela do docs/20, cota do mês no herói (Cuida e Sustenta), quadro com as 3 linhas de cota em cada plano.
- **Cartão** (`card/`): `cardPlanGuard` redireciona o Livre para `/cuidador/rede`; o convite saiu.
- **Equipe**: `features/groups` (tipos novos, checagem do plano com a oferta, coluna Plano com "incluída" ou "avulsa", "Quem pode participar"); `features/care-sessions` (agendamento só lista Cuida e Sustenta, resumo com a cota, valor da sessão incluída ou avulsa); `features/subscriptions` (quadro com as linhas de cota no lugar do desconto); `features/zarit` (conduta por plano); `features/settings/contents` (campo Categoria).
- `ui/cg-plan-lock.component.ts` **apagado** (nada mais o importa).

## 4. Seed

- 11 encontros: 2 rodas abertas, 5 capacitações (uma lotada, de pessoas do Livre pagando avulsa, com lista de espera) e 4 terapias de grupo (G1 lotada com fila, G3 em andamento, G8 aberta, G7 rascunho). Ana em terapia de grupo (G1) e Lourdes (G3); João só em rodas abertas; Maria na capacitação G2, incluída.
- Sessões: preço pela cota (`applySessionQuotas`). As conversas futuras de Livre e Essencial passam, sem sorteio, a pessoas do Cuida e do Sustenta fora da lista de demonstração (de preferência do mesmo psicólogo); o histórico fica, avulso. Elza ganhou uma conversa futura (Sustenta, dentro da cota). Ana fica com 1 de 2 no mês.
- Conteúdos: 10 (2 publicados a mais), cada um numa categoria.
- Contagens protegidas atualizadas com justificativa: `careSessions` 62 para 63 (Elza), `activities` 8 para 11, `guidanceContents` 8 para 10, distribuição de estados e formatos +1 agendada on-line.

## 5. Suposições e pendências do dono

1. A cota de encontros conta os ENCONTROS do mês da turma (uma terapia de grupo com 2 encontros em novembro usa a cota inteira do mês).
2. Valores avulsos (R$ 120,00, R$ 60,00 e R$ 40,00) e as 2 capacitações do Essencial seguem as suposições do docs/20.
3. O campo `psychSessionDiscountPercent` e o desconto em M15 (Parâmetros) continuam no modelo e na tela de parâmetros, sem efeito no preço: decidir se saem.
4. Quem mudou para Livre ou Essencial com conversa já marcada não chega mais à tela (redireciona); a equipe cancela pelo ERP se for o caso.
