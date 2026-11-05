# Nexus ERP: arquitetura do front-end e do núcleo

Documento do Dev Core. Vale para todos os devs de módulo, para o QA e para o CS/CX. Complementa `00-contexto.md`, `01-regras-de-negocio.md` (RN) e `02-escopo-erp.md` (módulos, modelo de dados e seed). O guia prático de uso do núcleo, com exemplos de código, está em `src/app/core/README.md`.

## 1. Visão geral

Protótipo Angular 22 (componentes standalone, signals, SCSS, Vitest, pnpm), sem servidor. Todos os dados são fictícios e ficam no navegador: `localStorage` para os dados (chaves `nexus-erp:<coleção>`) e `sessionStorage` para a sessão (`nexus-erp:session`). O **núcleo** (`src/app/core`) não tem tela: entrega modelos, armazenamento, repositórios, relógio, autenticação e permissões, log de auditoria, privacidade, regras de negócio puras, seed, formatação e pipes.

O que o núcleo garante, para os módulos não precisarem repetir:

| Garantia | Onde |
|---|---|
| Nenhum outro código toca `localStorage` ou `sessionStorage` (AC-GL-03) | `core/storage` (e `scripts/check-core.mjs` confere) |
| Regras de prazo nunca usam `Date.now()` nem `new Date()` | `core/clock` (`Clock` é a única fonte de "agora") |
| Toda rota exige sessão e passa pela matriz de permissões; rota negada vai a `/403` e grava `denied` (AC-GL-04) | `core/auth/guards.ts` |
| Dado sensível gera log; supervisão e "mostrar" exigem justificativa (AC-GL-10) | `core/audit` |
| Gestão vê só código `CUI-0000` e agregados com mínimo de 5 (RN-KPI-02) | `core/privacy` |
| Dinheiro em centavos inteiros; datas ISO; formatação pt-BR em um lugar só | `core/models`, `core/format` |
| Fórmulas de Zarit, ARBE, ARP, EQP, financeiro e SLA testadas contra os números do documento | `core/rules` |
| Seed determinístico, relativo a "hoje", cobrindo os 29 cenários | `core/seed` |

## 2. Estrutura de pastas definitiva

```
src/app/
  app.ts, app.html, app.config.ts, app.routes.ts   raiz, providers e roteador central (só o Dev Core mexe)
  core/                      núcleo sem interface (este documento)
    models/                  tipos e enums do modelo de dados (seção 4 do escopo)
    clock/                   Clock (hoje real ou simulado) e date-utils (funções puras de data)
    storage/                 StorageService, migrações, tokens dos backends
    data/                    EntityRepository (signals), Database, importação e exportação JSON
    auth/                    sessão, 2FA simulado, inatividade, permissões (matriz), mapa de módulos, guards
    audit/                   AuditLogService (log append-only)
    privacy/                 máscaras, pseudonimização, agregação (mínimo 5), consentimento, retenção, direitos do titular,
                             aviso de protótipo, banner da primeira visita e "Meus dados no navegador"
    rules/                   regras de negócio PURAS, cada uma com os RN no comentário e testes
    seed/                    motor determinístico do seed (semente nexus-seed-1)
    format/                  funções e pipes pt-BR
    testing/                 ajudantes de teste (armazenamento falso, ambiente com seed); fora do build
    README.md
  shared/ui/                 componentes de interface reutilizáveis (design system; dev de UI)
  layout/                    shell: menu lateral, topo, rodapé com o aviso de protótipo, modais globais
  features/
    _placeholder/            "Módulo em construção" (apagar quando os módulos estiverem prontos)
    <slug>/
      <slug>.routes.ts       exporta ROUTES (e as rotas extras, ver seção 3)
      pages/                 componentes de página (um por tela SCR-Mxx-nn)
      components/            componentes só deste módulo
      state/                 serviços e signals do módulo (leem e gravam pelo Database)
```

Aliases de importação (definidos em `tsconfig.json`): `@core/*`, `@shared/*`, `@features/*`, `@layout/*`. Exemplo: `import { Database } from '@core/data';`.

Regra de dependência: `features` e `layout` dependem de `core` e `shared`; `core` não depende de nada acima dele; um módulo nunca importa de outro módulo (o que for comum sobe para `shared` ou `core`).

## 3. Mapa módulo para slug e rotas

Em `core/auth/module-map.ts` (constante `MODULES`) está a fonte do roteador, dos guards e do menu lateral. A coluna "Perfis" é o resultado da matriz de permissões (`menuFor(role)`); `A` agregado, `P` próprios, `S` supervisão, `L` leitura, `E` edição.

| Módulo | Slug (pasta) | Rota base | Chave do guard | Perfis que abrem a tela |
|---|---|---|---|---|
| M01 Acesso e perfis | `auth` | `/login`, `/login/2fa`, `/403`, `**` | `guestGuard`, `authGuard` | todos |
| M02 Painel | `dashboard` | `/app/painel` | `dashboard` | partner, technical_lead, psychologist, support |
| M03 Cuidadores e pessoas idosas | `caregivers` | `/app/cuidadores` | `caregivers` | partner (A), technical_lead (S), psychologist (P), support (E) |
| M04 Planos, assinaturas e Cartão | `subscriptions` | `/app/assinaturas` | `subscriptions` | partner, technical_lead (L), support (E). O psicólogo só vê o plano do próprio cuidador dentro do perfil |
| M05 Atendimento psicológico | `care-sessions` | `/app/atendimento` | `care-sessions` | partner (A), technical_lead, psychologist (P), support |
| M06 Zarit e ARBE | `zarit` | `/app/acompanhamento` | `zarit` | partner (A), technical_lead (S), psychologist (C) |
| M07 Grupos e capacitações | `groups` | `/app/grupos` | `groups` | partner, technical_lead, psychologist, support |
| M08 Rede credenciada | `network` | `/app/rede` | `network` | partner, technical_lead (L), support (L) |
| M09 Parceiros do Cartão | `partners` | `/app/parceiros` | `partners` | partner, support (L) |
| M09 Canal corporativo | `partners` (`COMPANY_ROUTES`) | `/app/empresas` | `companies` | partner, support (L) |
| M10 Financeiro | `finance` | `/app/financeiro` | `finance` | só partner |
| M10 Indicadores | `finance` (`INDICATORS_ROUTES`) | `/app/indicadores` | `indicators` | partner, technical_lead (A), psychologist (A), support (L, operacionais) |
| M10 Piloto | `finance` (`PILOT_ROUTES`) | `/app/piloto` | `pilot` | partner, technical_lead (A) |
| M11 Mensagens | `messages` | `/app/mensagens` | `messages` | partner, technical_lead (L), psychologist (P), support |
| M11 Reclamações | `messages` (`COMPLAINT_ROUTES`) | `/app/reclamacoes` | `complaints` | partner, technical_lead (L), support |
| M12 LGPD | `privacy` | `/app/lgpd` | `privacy` | partner, technical_lead, support (consentimentos e solicitações; o log e o RIPD são só de partner e technical_lead) |
| M13 Governança | `governance` | `/app/governanca` | `governance` | partner, technical_lead, psychologist (L), support (L) |
| M14 (removido) | removido por decisão do dono | (nenhuma) | (nenhuma) | ninguém: os prestadores são cadastros geridos pela equipe, sem login |
| M15 Configurações | `settings` | `/app/configuracoes` | `settings` | partner, technical_lead (só ARBE e conteúdos) |

Como preencher um módulo (sem mexer no roteador central):

1. Abra `features/<slug>/<slug>.routes.ts` e troque o `ModulePlaceholderComponent` pelas páginas reais (uma rota por tela do escopo, por exemplo `:id`, `novo`).
2. Para sub-áreas com permissão própria, use `canActivate: [permissionGuard('recurso', 'ação')]` na rota filha (por exemplo `/app/lgpd/log` com `permissionGuard('lgpd_audit_log')`, `/app/configuracoes/dados` com `roleGuard('partner')`).
3. Para módulos com mais de uma rota base, o arquivo exporta uma constante por rota: `partners.routes.ts` (`ROUTES` e `COMPANY_ROUTES`), `finance.routes.ts` (`ROUTES`, `INDICATORS_ROUTES`, `PILOT_ROUTES`), `messages.routes.ts` (`ROUTES`, `COMPLAINT_ROUTES`).
4. Rota de módulo usa `data: { title, moduleId }` nos stubs; ao trocar pelas páginas reais, o título pode vir do componente.

## 4. Convenções

- **Idioma**: identificadores em inglês (ou siglas consagradas: Zarit, ARBE, ARP, POP, CRP, CREFITO); textos de interface, comentários e documentação em pt-BR. Nada de travessão (nem o longo, nem o médio): use vírgula, ponto ou dois-pontos. `node scripts/check-core.mjs` falha se encontrar.
- **Componentes**: standalone, `changeDetection: ChangeDetectionStrategy.OnPush`, estado em **signals** (`signal`, `computed`, `input`, `output`), `inject()` no lugar de construtor, controle de fluxo novo (`@if`, `@for`, `@switch`), formulários reativos tipados (`FormGroup<...>` com `NonNullableFormBuilder`).
- **Sem `any`**: use `unknown` e estreite; tipos do modelo vêm de `@core/models`.
- **Dados**: sempre pelo `Database` (`inject(Database)`). Dinheiro em centavos inteiros (`Cents`), formatado com o pipe `money`. IDs são strings com prefixo; datas `ISODate` e `ISODateTime` (com `-03:00`).
- **Tempo**: `Clock.today()` e `Clock.now()`. Nunca `Date.now()` nem `new Date()`. Conta de calendário: `@core/clock` (`addDays`, `addMonths`, `daysBetween`...).
- **Permissão**: `AuthService.can(resource, action, { own })`, `canOnRecord` para registros próprios, `menuFor(role)` para o menu. A interface esconde o que o perfil não pode, mas a checagem de verdade é a do guard e do serviço.
- **Log**: leitura de dado sensível chama `AuditLogService.view(...)`; o RT em caso que não é dele chama `supervise(...)` com justificativa; "mostrar" dado mascarado chama `reveal(...)`; gravações sensíveis chamam `write(...)`; exportar e imprimir chamam `exported(...)` e `printed(...)`.
- **Privacidade**: `partner` só vê código `CUI-0000` e agregados (`aggregateCount`, `zaritDistribution`) com mínimo de 5 por recorte; `support` vê CPF, telefone e e-mail mascarados (pipes e `maskCpf`); o prestador não tem login: a equipe só repassa a ele o mínimo, e só com solicitação aceita e cláusula de proteção de dados assinada (`providerMaySeeCaregiverData`, RN-LGPD-13).
- **Texto de tela**: acolhedor e direto, sem jargão clínico, sem "guerreira" ou "anjo", sem promessa de resultado terapêutico, sem "diagnóstico" nem "eficácia" sobre os resultados (RN-ZRT-18, 22).
- **Regras de negócio**: ficam em `core/rules` como funções puras com o RN no comentário. Se a regra muda, muda lá e o teste acompanha. A tela não recalcula regra.

## 5. Regras de RAM e de build

A máquina de desenvolvimento tem RAM limitada.

- **Nunca** deixe `ng serve`, `vite` ou navegador de teste rodando ao terminar. Um servidor por vez. Para encerrar pela porta (PowerShell): `Get-NetTCPConnection -LocalPort 4200 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.
- O núcleo se valida **sem servidor**: testes, typecheck e `ng build` não precisam de `ng serve`.
- Rode testes com filtro quando mexer só em uma área (`--include` e `--filter`, abaixo). A suíte inteira leva cerca de 10 segundos e pouca memória; não rode duas execuções do `ng` ao mesmo tempo.
- Não use `ng test` em modo `--watch` (é o padrão em terminal interativo); use sempre `--watch=false`.
- Não faça `git commit` nem `git push`: o líder técnico commita.

## 6. Comandos que funcionam

Todos a partir da raiz do repositório.

| Para quê | Comando | Tempo aproximado |
|---|---|---|
| Todos os testes | `pnpm exec ng test --watch=false` | 10 s (25 arquivos, 394 testes) |
| Só uma pasta | `pnpm exec ng test --watch=false --include 'src/app/core/rules/**/*.spec.ts'` | 5 s |
| Só um arquivo | `pnpm exec ng test --watch=false --include 'src/app/core/seed/seed.spec.ts'` | 5 s |
| Só testes por nome | `pnpm exec ng test --watch=false --filter 'Zarit'` | 5 s |
| Typecheck do app | `pnpm exec tsc -p tsconfig.app.json --noEmit` | 2 s |
| Typecheck dos testes | `pnpm exec tsc -p tsconfig.spec.json --noEmit` | 2 s |
| Os dois typechecks | `pnpm run typecheck` | 4 s |
| Build de produção | `pnpm exec ng build` | 5 s |
| Conferência de qualidade (sem `any`, sem `console`, sem `Date.now()`, sem `localStorage` fora do núcleo, sem travessão) | `node scripts/check-core.mjs` (ou `pnpm run check:core`) | 1 s |

No PowerShell, o filtro `--include` aceita aspas simples. Os testes rodam em Node com jsdom; não abrem navegador.

## 7. O seed: dados fictícios determinísticos

`generateSeed(today)` (em `core/seed`) gera tudo da seção 5 do escopo, com semente `nexus-seed-1` (PRNG próprio, sem `Math.random()`): **mesma data, mesmo resultado**. `Database.seed()` usa `Clock.today()`; "Resetar" (`Database.reset()`) apaga e gera de novo. Todas as datas são relativas a D0 (`D-10` é 10 dias antes de hoje), então prazos, ciclos e alertas continuam coerentes em qualquer dia, inclusive fim de semana e feriado.

Dados 100% fictícios: CPF no formato `000.MMM.NNN-00` com dígitos verificadores inválidos e `cpfIsFictitious: true`, e-mails `@exemplo.com.br`, telefones `(34) 90000-0000` a `(34) 90000-0999`, endereços "Rua Exemplo, N", registros de conselho com número fictício. Nenhum dado dos autores do documento.

Contagens conferidas pelos testes (`seed.spec.ts`): 8 usuários (todos da equipe); 4 psicólogos; 3 salas; 340 cuidadores (29 de cenário e 311 de volume), 340 pessoas idosas, 340 assinaturas e 17 cartões ativos (mais 1 inativo, de quem voltou ao Livre); 158 aplicações de Zarit concluídas (38 de cenário e 120 de volume) mais as próximas agendadas; 9 alertas de Zarit nomeados; 20 prestadores e 20 credenciamentos; 213 solicitações de serviço (124 históricas e 89 dos últimos 30 dias); 124 avaliações; 8 grupos e capacitações; 9 parceiros e 3 empresas; 28 mensagens (app 9, WhatsApp 8, telefone 4, e-mail 7) e 5 reclamações; 5 solicitações do titular; 2 incidentes de dados (1 encerrado e 1 aberto); 80 linhas de log; 10 POPs, 12 riscos, 10 encaminhamentos e 3 ocorrências; 60 sessões; 15 cuidadores no piloto. O seed ocupa cerca de 1,7 milhão de caracteres no JSON (a cota do navegador é de cerca de 5 milhões).

### 7.1 Usuários de demonstração (entrada)

| Id | Nome | Perfil | Observação |
|---|---|---|---|
| `u1` | Helena Prado Vasconcelos | `partner` | Sócia e gestão |
| `u2` | Dra. Cecília Montenegro | `technical_lead` | RT, CRP-04/00001 (fictício) |
| `u3` | Dr. Rafael Moreira | `psychologist` (`psy_0001`) | Agenda sobrecarregada (86,3% e 91,3%) |
| `u4` | Dra. Beatriz Nogueira | `psychologist` (`psy_0002`) | 85,0% e 70,0%: sem alerta |
| `u5` | Dra. Letícia Amaral | `psychologist` (`psy_0003`) | 80,0% e 80,0%: sem alerta |
| `u6` | Dr. Tiago Brandão | `psychologist` (`psy_0004`) | Mês -2 sem agenda: n/d |
| `u7` | Camila Duarte | `support` | Atendimento |
| `u8` | Wesley Lacerda | `support` | Atendimento |
Os ids `u9` a `u12` eram os usuários do perfil de prestador credenciado (portal, M14). O perfil foi **removido por decisão do dono**: os ids não existem mais nem são reaproveitados, e os prestadores correspondentes (P11, P01, P10 e P20) continuam como cadastros da rede, geridos pela equipe e sem login. A persona de teste do CS/CX passa a ser a equipe da Nexus: psicólogo(a) (`u3`), atendimento (`u7`) e sócia (`u1`).

Segundo fator: código `123456`, exibido na tela, para todos os usuários (todos são da equipe).

### 7.2 Os 29 cenários de cuidadores (C01 a C29)

Cada cenário existe para exercitar uma situação. O id do registro é `cg_00NN` e o código pseudonimizado é `CUI-00NN`; a pessoa idosa é `el_00NN`. As datas (`D-10`, `D+5`) são relativas a "hoje".

| Cenário | Id | Código | Cuidador(a) (idade) | Plano | Psicólogo | Situação-chave |
|---|---|---|---|---|---|---|
| C01 | `cg_0001` | `CUI-0001` | Ana Paula Ferraz (45) | Cuida | Rafael | Persona Ana: Zarit 48 na adesão e 63 hoje (alerta vermelho do dia, contato pendente, prazo 23h59); ARBE crítico (11 h por dia, 4 pedidos de apoio); ocorrência POP-05 aberta; fora do piloto |
| C02 | `cg_0002` | `CUI-0002` | Maria Aparecida Lemos (52) | Essencial | Beatriz | Persona Maria: Zarit 55 na adesão e 79 ontem sem contato (alerta vermelho vencido, escalado ao RT); pedido de revisão de decisão aberto |
| C03 | `cg_0003` | `CUI-0003` | João Batista Carneiro (68) | Livre | Rafael | Persona João: baixa familiaridade digital, canal preferido telefone; Zarit 66 na adesão (D-100, vermelho, contato no mesmo dia, risco moderado, encaminhado ao CAPS) e 52 em D-10: evolução -21,2%; piloto |
| C04 | `cg_0004` | `CUI-0004` | Marlene Cardoso (61) | Livre | Letícia | Zarit 0 (limite inferior) |
| C05 | `cg_0005` | `CUI-0005` | Sueli Prado (57) | Livre | Rafael | Zarit 20 (limite superior da faixa 1) |
| C06 | `cg_0006` | `CUI-0006` | Débora Gontijo (49) | Essencial | Beatriz | Zarit 21 (início da faixa 2); piloto |
| C07 | `cg_0007` | `CUI-0007` | Vera Lúcia Teixeira (54) | Essencial | Letícia | Zarit 40 (fim da faixa 2); piloto |
| C08 | `cg_0008` | `CUI-0008` | Rita de Cássia Moura (50) | Cuida | Beatriz | Zarit 41 (início do amarelo); alerta amarelo aberto com tarefa "revisar rede de apoio" pendente; piloto |
| C09 | `cg_0009` | `CUI-0009` | Neusa Aparecida Borges (63) | Sustenta | Letícia | Zarit 60 (fim do amarelo), contatada; piloto |
| C10 | `cg_0010` | `CUI-0010` | Lúcia Helena Freitas (47) | Livre | Rafael | Zarit 61 (início do vermelho) em D-3, contato no mesmo dia, risco baixo, encerrado |
| C11 | `cg_0011` | `CUI-0011` | Eliane Costa Rezende (58) | Sustenta | Letícia | Zarit 88 (máximo) em D-2, contato no mesmo dia, risco alto, encaminhada à rede de urgência e CVV; ocorrência POP-05 encerrada |
| C12 | `cg_0012` | `CUI-0012` | Terezinha Alves (66) | Essencial | Beatriz | Piloto concluído (6 meses): Zarit 40, 28, 18, evolução -55,0% |
| C13 | `cg_0013` | `CUI-0013` | Cláudia Mendes (43) | Livre | Letícia | Zarit 0 na adesão e 12 depois: evolução n/d (divisão por zero); piloto |
| C14 | `cg_0014` | `CUI-0014` | Ivone Barros (71) | Essencial | Beatriz | Zarit vencida (última D-110, venceu em D-20); pessoa idosa com agravamento clínico (encaminhamento à UBS) |
| C15 | `cg_0015` | `CUI-0015` | Fátima Ribeiro (59) | Livre | Letícia | Zarit a vencer em 7 dias |
| C16 | `cg_0016` | `CUI-0016` | Sônia Maria Dutra (55) | Essencial | Beatriz | Consentimento de saúde revogado em D-15; status pausado por revogação; sem ARBE nem painéis |
| C17 | `cg_0017` | `CUI-0017` | Aparecida Neves (60) | Sustenta | Letícia | Consentimentos parciais: imagem recusada, People Analytics recusado; saúde e WhatsApp concedidos; fora dos agregados |
| C18 | `cg_0018` | `CUI-0018` | Raimunda Siqueira (53) | Livre | Tiago | Pedido de exclusão aberto (D-10, vence em D+5); possui Zarit (retenção por registro documental); encaminhamento CRAS |
| C19 | `cg_0019` | `CUI-0019` | Luciana Ornelas (46) | Livre | Tiago | Solicitação de portabilidade concluída; JSON gerado |
| C20 | `cg_0020` | `CUI-0020` | Patrícia Vilela (41) | Livre | Tiago | Solicitação de correção em andamento, vence em 2 dias |
| C21 | `cg_0021` | `CUI-0021` | Gisele Marques (44) | Cuida (empresa) | Beatriz | Colaboradora da Exemplo Logística; Zarit 18 |
| C22 | `cg_0022` | `CUI-0022` | Rogério Peixoto (48) | Cuida (empresa) | Tiago | Colaborador da Exemplo Logística; Zarit 35 |
| C23 | `cg_0023` | `CUI-0023` | Simone Arantes (42) | Cuida (empresa) | Tiago | Colaboradora da Exemplo Logística; Zarit 29 |
| C24 | `cg_0024` | `CUI-0024` | Lourdes Campos (64) | Sustenta | Rafael | Piloto no mês 4: Zarit 52 e 44; em lista de espera do grupo lotado |
| C25 | `cg_0025` | `CUI-0025` | Osvaldo Pimentel (62) | Livre | Tiago | Não elegível ao piloto: Uberaba e pessoa idosa independente; Zarit 15 |
| C26 | `cg_0026` | `CUI-0026` | Marcos Vinícius Leal (39) | Essencial | Tiago | Cancelamento agendado (D+9); Zarit 27; sem mensagens (estado vazio) |
| C27 | `cg_0027` | `CUI-0027` | Elza Guimarães (68) | Sustenta | Tiago | Alto uso do Cartão Nexus (8 usos); avaliou a nutricionista com reclamação grave (quebra de sigilo); Zarit 38 |
| C28 | `cg_0028` | `CUI-0028` | Vanessa Torres (37) | Livre | Tiago | Zarit 59 em D-6; ocorrência POP-07 aberta (suspeita de negligência com a pessoa idosa); notificação ainda não comunicada |
| C29 | `cg_0029` | `CUI-0029` | Adriana Fonseca (51) | Livre | Tiago | ARBE atenção: 9 h por dia, 3 pedidos em 30 dias, Zarit 35 (2 de 3 critérios) |

Totais por plano nesses 29: Livre 12, Essencial 7, Cuida 5, Sustenta 5. Os 311 cuidadores de volume são `cg_0030` a `cg_0340`, todos no plano Livre, com 85% de consentimento de saúde concedido; 120 deles têm Zarit de adesão (24 na faixa 0 a 20, 46 em 21 a 40, 36 em 41 a 60 e 14 em 61 a 88, entre D-170 e D-60); 7 participam do piloto.

### 7.3 Demais registros de referência

| Registro | Ids |
|---|---|
| Alertas de Zarit nomeados (5.5) | Z-a `zal_0001` (C01, vermelho do dia), Z-b `zal_0002` (C02, vermelho vencido), Z-c `zal_0003` (C03, D-100, encerrado), Z-d `zal_0004` (C03, amarelo), Z-e `zal_0005` (C08, amarelo aberto), Z-f `zal_0006` (C09, amarelo contatado), Z-g `zal_0007` (C10, vermelho encerrado), Z-h `zal_0008` (C11, vermelho encerrado), Z-i `zal_0009` (C28, amarelo ligado ao POP-07) |
| Ocorrências (5.14) | O-1 `occ_0001` (POP-05 de C11, encerrada, 7 passos), O-2 `occ_0002` (POP-05 de C01, só o passo 1 feito), O-3 `occ_0003` (POP-07 de C28, notificação não comunicada) |
| Reclamações | REC-0001 `rec_0001` (contra P14, grave, quebra de sigilo), REC-0002 `rec_0002` (contra P04, falta sem justificativa), REC-0003 `rec_0003` (plataforma, encerrada), REC-0004 `rec_0004` (suspeita de violência, ligada a O-3), REC-0005 `rec_0005` (aberta há 8 dias úteis, vencida) |
| Solicitações do titular | `dsr_0001` (C18, exclusão, vence em D+5), `dsr_0002` (C19, portabilidade concluída), `dsr_0003` (C20, correção, vence em D+2), `dsr_0004` (C16, revogação concluída), `dsr_0005` (C02, revisão de decisão) |
| Incidente | `inc_0001` (e-mail ao destinatário errado, D-45, encerrado) |
| Salas | `room_0001` Girassol, `room_0002` Ipê, `room_0003` Jacarandá (3 de 4 atributos, bloqueada) |
| Grupos e capacitações | `act_0001` G1 lotado com 2 na lista de espera; `act_0002` G2 prevenção de quedas; `act_0003` G3 terapia de grupo em andamento; `act_0004` G4 roda aberta com 4 externos; `act_0005` G5 finalizada; `act_0006` G6 cancelada; `act_0007` G7 rascunho; `act_0008` G8 |
| Parceiros | `par_0001` a `par_0005` ativos; `par_0006` Clínica de Imagem Delta (validação jurídica e ética, sem validações); `par_0007` prospecção; `par_0008` suspenso; `par_0009` encerrado |
| Empresas | `corp_0001` Exemplo Logística (5 vagas, 3 ativas: C21, C22, C23), `corp_0002` Indústria Modelo (negociação), `corp_0003` Comércio Varejista Alfa (prospecção) |
| Encaminhamentos | `ref_0001` a `ref_0010` (as 7 categorias do Quadro 12) |

**Prestadores** (`prv_NN` = P`NN`):

| Id | Nome | Categoria | Estado | Cenário |
|---|---|---|---|---|
| `prv_01` | Dra. Renata Sampaio | Fisioterapia | ativa | Excelência (4,83) |
| `prv_02` | Clínica Movimento Vital | Fisioterapia | ativa | Excelência (4,61) |
| `prv_03` | Fisio em Casa Uberlândia | Fisioterapia | monitoramento | Alerta (4,25); recusa 28,6%, abaixo do limiar |
| `prv_04` | Aline Cristina Pires | Cuidador(a) | monitoramento | **Recusa 62,5%**, queda de 60% na disponibilidade, selo "risco de saída" |
| `prv_05` | Valdir Antunes | Cuidador(a) | ativo | Excelência (4,70) |
| `prv_06` | Cuidar Bem Home Care | Home care | monitoramento | Recusa exatamente **30,0%** (limiar); única opção de home care |
| `prv_07` | Enf. Priscila Gouveia | Enfermagem | ativa | Excelência; única opção de enfermagem |
| `prv_08` | Farmácia Vida Plena | Farmácia | ativa | Exatamente **4,50**: excelência |
| `prv_09` | Drogaria Santa Clara | Farmácia | monitoramento | Exatamente **4,00** com 5 avaliações: alerta |
| `prv_10` | Clínica Saúde Integral | Clínica | **suspensa** | Média 3,57; avaliação interna com justificativa; nenhuma opção de clínica |
| `prv_11` | **Dr. Eduardo Falcão** | **Fisioterapia (CREFITO)** | ativo | Excelência, 4,70, 2 solicitações novas, cláusula assinada |
| `prv_12` | Dra. Sônia Peixoto | Fisioterapia (CREFITO) | monitoramento | Alerta (4,33); mais uma opção de fisioterapia |
| `prv_13` | Dra. Valéria Costa | Psicologia (CRP) | ativa | 3 avaliações: sem média; única opção de psicologia; validada pelo RT |
| `prv_14` | Nutri Camila Rezende | Nutrição | **suspensa** | 3 reclamações graves com média 4,31; avaliação interna sem justificativa |
| `prv_15` | Dr. Heitor Magalhães | Advocacia (OAB) | ativo | Exatamente 5 avaliações; única opção de advocacia |
| `prv_16` | Dra. Isadora Leal | Fisioterapia | candidata (`pending_documents`) | CREFITO vencido há 12 dias |
| `prv_17` | Equipamentos Cuidar+ | Serviço especializado | candidata (`in_review`) | Documentos ok, integração pendente |
| `prv_18` | Cuidadores Express | Cuidador(a) | reprovada | Sem contrato e sem comprovação de formação |
| `prv_19` | Dr. Otávio Lima | Fisioterapia | descredenciado (D-60) | E-mail de encerramento registrado |
| `prv_20` | Cuidadora Rosimeire Tavares | Cuidador(a) | ativa | Sem cláusula de dados assinada; 2 solicitações novas |

Opções por especialidade na busca (ativos e em monitoramento): Fisioterapia 5, Cuidador(a) 3, Farmácia 2; **única opção**: home care, enfermagem, psicologia, advocacia; **nenhuma**: clínica, nutrição, serviço especializado.

## 8. Divergências e decisões do Dev Core (para os próximos devs, QA e PM)

Onde o escopo foi omisso, ambíguo ou contraditório, o núcleo seguiu a regra do documento e registrou a decisão aqui. Nada disso altera uma regra `[doc]`.

**Modelo de dados**

1. `Session` do escopo virou **`AuthSession`** (sessão de login) e a sessão de atendimento é **`CareSession`**, para não colidir.
2. `Plan.color` guarda um token semântico (`slate_blue`, `light_blue`, `medium_blue`, `gold`), não um hexadecimal; o design system mapeia para as cores da Figura 1.
3. `ProviderStatus` ganhou **`candidate`** e **`rejected`** (necessários para P16 a P18 existirem como prestadores). Só `active` e `monitoring` aparecem na busca.
4. `AppSettings.demoToday` do escopo foi removido: a data simulada vive no `Clock` (`nexus-erp:clock`), única fonte da verdade. `AppSettings` ganhou `sessionBasePriceCents` (R$ 120,00) e `dsrDueSoonDays` (3).
5. Campos opcionais acrescentados: `retentionBlock` (bloqueio por retenção documental) em `ZaritAssessment`, `ZaritAlert`, `ArbeAlert`, `SessionNote` e `Occurrence`; `closureReason` em `ArbeAlert`; `erasedAt` e `anonymizedAt` em `Caregiver`; `exitedAt` em `PilotEnrollment`; `fictitious` em `ProviderCouncil`. `RetentionPolicy` e `NormReference` ganharam `id` e carimbos para serem registros comuns.
6. `AppUsageSummary` (resumo de uso do aplicativo por cuidador) e `Notification` foram acrescentados para K31 e para o sino (M02). `PilotInstrumentRecord` não foi criado: os dados do instrumento ficam em `PilotEnrollment` e `ZaritAssessment`.
7. `CareSession.priceCents` é o valor **cobrado** (já com o desconto do plano).
8. A matriz do escopo tem uma linha única "M10 Financeiro e indicadores"; o núcleo a **desdobrou** em `finance`, `indicators` e `pilot` para dar um guard por tela sem violar a seção 1.3 (RT, psicólogo e atendimento não veem valores em reais). Dentro do plano e do perfil, o psicólogo só vê o plano do próprio cuidador (célula `embeddedOnly`). A coluna do perfil `provider` (portal, M14) foi removida da matriz por decisão do dono.

**Regras e números**

9. **SLA e a sexta às 17h30 (AC-M11-02).** O AC diz que o WhatsApp recebido na sexta às 17h30 vence "até 12h de segunda". A regra RN-CAN-03 (expediente das 8h às 18h) conta minuto a minuto: 30 minutos na sexta e 3h30 na segunda, ou seja, **segunda às 11h30**. O núcleo implementa a regra e **registra a divergência**: para obter 12h seria preciso tratar 17h30 como fora do expediente. PM e QA decidem qual dos dois textos muda.
10. **ARBE de João (C03).** Pelos limites padrão (`>= 8 h`, `>= 3` pedidos, `>= 41`), C03 tem 8 h por dia e Zarit 52 (2 de 3 critérios) e gera ARBE `attention`. Também geram ARBE `critical` os casos de Zarit 61 ou mais (C10, C11 e os 14 de volume na faixa 61 a 88, todos encerrados). O AC-M06-12 exige apenas C01 (`critical`) e C29 (`attention`), que existem.
11. **O-2 e Z-a.** O escopo dizia que a ocorrência O-2 tinha os passos 1 e 2 feitos (o 2 é "contato da equipe") e, ao mesmo tempo, que o alerta Z-a estava "sem contato". Depois do CS/CX (CX-017) o seed traz **só o passo 1 feito** e o passo 2 pendente, coerente com o alerta sem contato, para o cronômetro e o indicador K18 funcionarem e para o contato registrado pela responsável técnica não cair num passo já "concluído" por outra pessoa.
12. **AC-M11-05 e P14.** No seed, REC-0001 já está classificada como grave e P14 já está suspenso (as 3 graves). O AC descreve a classificação como um passo futuro. O núcleo calcula o número de graves de cada auditoria pela **data de classificação**, então a auditoria de D-14 mostra 2 graves e a 3ª foi classificada depois.
13. **Arredondamento da líquida.** A tabela A.13 foi gerada com ponto flutuante em reais e fechada em 2 casas; `netRevenueCents` replica esse arredondamento (R$ 504,50 resulta R$ 449,00; R$ 2.522,50 resulta R$ 2.245,03). Os testes comparam as 24 linhas dos 3 cenários, em centavos, com as tabelas A.13.1 e A.13.2 copiadas do documento por script (`rules/fixtures/reference-projection.ts`).
14. **K17 e "amarelos abertos".** K17 conta alertas com `status` diferente de `closed` (4 amarelos no seed: Z-d, Z-e, Z-f, Z-i). O AC-M02-02 ("2 amarelos abertos") corresponde aos de status `open` (Z-e e Z-i).
15. **K30 (SLA por canal).** Mensagens ainda dentro do prazo e sem resposta não entram na conta (nem falha, nem sucesso): `[suposição]` registrada em `rules/sla.ts`.
16. **Média e arredondamento da ARP** em aritmética inteira (4,495 vira 4,50 e 3,995 vira 4,00, RN-ARP-15), sem o erro binário do ponto flutuante.
17. **Fala sobre "diagnóstico".** A nota `ZARIT_NOT_DIAGNOSIS_NOTE` diz que o resultado "não é um diagnóstico", como o escopo pede; o seed e o restante do núcleo não usam a palavra.

**Limites conhecidos**

18. Agregação com mínimo de 5 **não** faz supressão complementar (um total exibido ao lado de uma única faixa "menos de 5" permitiria deduzir o valor). As telas não devem exibir o total do recorte ao lado de uma faixa suprimida.
19. A validação da importação de JSON confere esquema, versão, unicidade de ids e dados fictícios (CPF inválido, e-mail `@exemplo.com.br`), não a integridade referencial entre coleções.
20. Os 22 enunciados da Zarit (`rules/zarit-items.ts`) são paráfrases de demonstração (S-21): trocar pelo texto oficial licenciado antes de qualquer uso real.
21. O feriado nacional é calculado (fixos mais Sexta-feira Santa); feriados municipais e pontos facultativos não entram (RN-CAN-03).

**Configuração do projeto alterada pelo Dev Core**

22. `tsconfig.json`: `strict: true` (o projeto gerado não tinha), `strictTemplates: true` e os aliases `@core/*`, `@shared/*`, `@features/*`, `@layout/*`. `tsconfig.app.json`: exclui `src/app/core/testing/**` (ajudantes só de teste). `package.json`: só os scripts `test:ci`, `typecheck` e `check:core`. Nenhuma dependência foi instalada ou pedida: o núcleo usa só o que o projeto já tem (`@angular/*`, `rxjs`, `vitest`, `jsdom`).

**Remoção do portal e integração (Dev E)**

23. **Portal do prestador credenciado (M14) e o perfil de login do prestador removidos** por decisão do dono. O tipo dos perfis de acesso ficou com 4 valores (`partner`, `technical_lead`, `psychologist`, `support`); a matriz perdeu a coluna e o recurso do portal; `/portal`, o shell do portal e `features/provider-portal` não existem mais; a entrada lista só os 8 usuários da equipe, agrupados em Gestão, Psicologia e Atendimento. A entidade `Provider` (prestador) e a rede credenciada continuam como cadastros da equipe. O id M14 não é reaproveitado.
24. **Um só serviço de supervisão**: `SupervisionWindowService` (`core/audit/supervision-window.service.ts`) e um só portão, `app-supervision-gate` (`shared/ui/access`). A janela de 30 minutos por caso e por sessão conta pelo relógio do sistema (o relógio simulado do M15 permite testar a expiração), fica em `sessionStorage` e cada abertura grava `supervise` com o mesmo motivo.
25. **Um só componente de ícone**: `svg[appIcon]` (`IconComponent`). Nome vindo de dado do núcleo (texto) passa por `toIconName`, que cai num ícone neutro se o nome não existir no sprite.
26. **Mudança de plano agendada**: `SubscriptionService.applyDueChanges` chama `GroupMembershipService.reconcilePlanLoss` quando uma descida ou um cancelamento passa a valer (AC-M07-09; o canal corporativo faz o mesmo ao devolver o cuidador ao Livre). `PlanChangeScheduler`, ligado no inicializador do aplicativo, aplica o que já venceu ao iniciar e sempre que a data de hoje (real ou simulada) muda; testes de tela e de serviço não o instanciam.
27. **Filtros `?filtro=` dos painéis (AC-M02-08)**: cuidadores (`novos`), rede (`excelencia`, `alerta`, `risco-de-saida`, `em-andamento` no credenciamento, `sem-retorno` nas solicitações), mensagens (`atrasadas`, `sinalizadas`) e reclamações (`abertas`, `vencidas`) aceitam as chaves que os painéis e o sino usam.
28. **Testes e downloads**: `configureCoreTest` intercepta o clique do `<a download>` que `downloadTextFile` cria (o jsdom não implementa navegação) e o registra em `TEST_DOWNLOADS`; erros reais continuam aparecendo. Há um só `downloadTextFile` (`core/export/file-download.ts`).

## 9. Como estender o núcleo

- **Nova coleção**: tipo em `core/models`, nome e prefixo em `core/data/collections.ts` (`CollectionTypes`, `ID_PREFIXES`), propriedade em `Database` (`readonly nome = this.repo('nome')`), linha em `emptyCollections()` do seed. A exportação, a importação e o reset passam a incluí-la sozinhos.
- **Mudança de formato dos dados**: incremente `SCHEMA_VERSION` em `core/storage/migrations.ts` e registre uma migração em `MIGRATIONS`. A versão do arquivo exportado acompanha.
- **Nova regra**: função pura em `core/rules/<tema>.ts` com o RN no comentário, teste ao lado e export em `rules/index.ts`.
- **Novo recurso de permissão**: acrescente em `Resource` (`models/access.ts`) e uma linha em `PERMISSION_MATRIX` (`auth/permissions.ts`); o teste `permissions.spec.ts` guarda a matriz do escopo como oráculo e precisa ser atualizado junto.
