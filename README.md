# Nexus ERP

Protótipo de front-end do **ERP interno da Nexus**, a empresa que cuida de quem cuida: atendimento psicológico, grupos de apoio e capacitações para o cuidador familiar de pessoas idosas, mais uma rede credenciada de profissionais e o Cartão Nexus.

As regras de negócio vêm do plano de negócios da Nexus e foram seguidas sem alteração (planos, escala de Zarit, ponto de equilíbrio, ocupação da agenda, ARP, POPs, LGPD). **Todos os dados são fictícios** e ficam só no navegador (`localStorage`); a sessão fica em `sessionStorage`. Não há servidor.

## Rodar

Requisitos: Node 22 ou mais novo e pnpm.

```bash
pnpm install
pnpm start          # http://localhost:4200
pnpm test:ci        # testes (Vitest)
pnpm typecheck      # app e testes
pnpm build          # saída em dist/nexus-erp
```

## Entrar

A tela de entrada é uma seleção de perfil de demonstração (sem senha). A equipe tem um segundo fator simulado: o código `123456` aparece na tela e há o botão "Usar o código mostrado".

| Usuário | Perfil | O que testar |
|---|---|---|
| Helena Prado Vasconcelos | Sócia e gestão | Painel financeiro, ponto de equilíbrio, rede, parceiros, LGPD. Só vê códigos (`CUI-0000`) e agregados |
| Dra. Cecília Montenegro | Responsável técnica | Alerta vermelho e POP-05, supervisão com justificativa, parâmetros da ARBE |
| Dr. Rafael Moreira | Psicólogo (agenda acima de 80%) | Agenda, aplicar a escala de Zarit, anotações sigilosas |
| Camila Duarte | Atendimento | Cadastros, planos, mensagens com prazo, solicitações do titular. Nunca vê escore nem alerta |

Há ainda a psicóloga Beatriz, a Letícia e o Tiago (casos de ocupação), e o Wesley no atendimento.

## O que tem

| Módulo | Rota | Destaques |
|---|---|---|
| Painel | `/app/painel` | Um painel diferente por perfil, sempre respeitando privacidade |
| Cuidadores e pessoas idosas | `/app/cuidadores` | Cadastro com consentimento granular, supervisão com justificativa, encerramento |
| Planos, assinaturas e Cartão | `/app/assinaturas` | Livre R$ 0, Essencial R$ 49,90, Cuida R$ 119,90, Sustenta R$ 149,90 |
| Atendimento psicológico | `/app/atendimento` | Agenda semanal, ocupação e regra dos 80%, anotações sigilosas |
| Zarit e ARBE | `/app/acompanhamento` | 22 itens, faixas e condutas, alerta vermelho com contato no mesmo dia |
| Grupos e capacitações | `/app/grupos` | Inscrição por plano, lista de espera, presença |
| Rede credenciada | `/app/rede` | Credenciamento com checklist, ARP, auditoria quinzenal, sem comissão |
| Parceiros e corporativo | `/app/parceiros`, `/app/empresas` | Funil de parceiros, empresas do canal corporativo |
| Financeiro, indicadores e piloto | `/app/financeiro` | 27 assinantes de equilíbrio, três cenários de conversão, People Analytics |
| Mensagens e reclamações | `/app/mensagens` | Prazo e SLA, "Sinalizar risco", reclamações graves |
| LGPD | `/app/lgpd` | Consentimentos, solicitações do titular, log de auditoria, incidentes, política e RIPD |
| Governança | `/app/governanca` | POPs, matriz de riscos 5x5, ocorrências, encaminhamentos |
| Configurações | `/app/configuracoes` | Resetar demonstração, exportar e importar JSON, relógio simulado, tema |

## LGPD no protótipo

Consentimento granular, mascaramento e modo discreto, pseudonimização para a gestão (`CUI-0000`, agregados com mínimo de 5), log de auditoria de acesso a dado sensível, justificativa para supervisão, direitos do titular (acesso, correção, anonimização, portabilidade, eliminação com retenção), aviso de protótipo em toda tela, nenhuma requisição para fora do navegador.

## Arquitetura

Angular 22, componentes standalone, signals, SCSS, rotas com carregamento sob demanda. Sem biblioteca de interface: o design system é próprio (azul institucional, dourado da marca, DM Serif Display nos títulos e Figtree no corpo).

```
src/app/
  core/       modelos, armazenamento, repositórios, relógio, permissões, auditoria,
              privacidade, regras de negócio puras e testadas, seed determinístico
  shared/ui/  componentes reutilizáveis, sobreposições e gráficos SVG
  layout/     shell da equipe
  features/   um módulo por pasta, com rotas lazy
src/styles/   tokens e CSS do design system
docs/         regras, escopo, design, UX, arquitetura, QA e CS/CX
```

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/00-contexto.md` | Contexto, marca, convenções e decisões do dono |
| `docs/01-regras-de-negocio.md` | 384 regras derivadas do plano de negócios, com origem |
| `docs/02-escopo-erp.md` | Perfis, módulos, modelo de dados, seed, LGPD e critérios de aceite |
| `docs/03-design-system.md` e `docs/styleguide.html` | Design system e guia de estilo |
| `docs/04-ux.md` | Personas, fluxos, padrões de tela e auditoria de UX |
| `docs/05-qa.md` | Relatório de QA |
| `docs/06-cs-cx.md` | Relatório de CS/CX (a equipe da Nexus usando o sistema) |
| `docs/07-correcoes-*.md` | O que foi corrigido depois do QA e do CS/CX |
| `docs/08-arquitetura.md` | Arquitetura, mapa de módulos e os cenários do seed |
| `docs/ac-status/` | Situação de cada critério de aceite por módulo |

## Como foi feito

Time de agentes: PM (regras e escopo), UI (design system), UX (fluxos e auditoria), Dev (núcleo, componentes e módulos), QA (testes e bugs) e CS/CX (simulação de uso pela equipe da Nexus), seguidos de uma rodada de correções.

## Limites do protótipo

Dados fictícios e locais; login e segundo fator simulados; pagamentos e e-mails não existem; o aplicativo do cuidador não faz parte deste escopo. Os itens do plano de negócios que o documento deixa em aberto (limites da ARBE, valores do atendimento psicológico, retenção de dados) estão marcados como suposição de protótipo em `docs/01-regras-de-negocio.md` e podem ser editados.
