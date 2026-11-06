# Nexus ERP

Protótipo de front-end da **Nexus**, a empresa que cuida de quem cuida: atendimento psicológico, grupos de apoio e capacitações para o cuidador familiar de pessoas idosas, mais uma rede credenciada de profissionais e o Cartão Nexus. O projeto tem duas visões sobre os mesmos dados: o **ERP interno** da equipe (`/app/**`) e o **aplicativo do cuidador**, o cliente (`/cuidador/**`).

**Demonstração no ar:** https://diogofrr.github.io/nexus-erp/. Abra no celular e, na entrada, escolha "Sou cuidador(a)" para ver o aplicativo do cliente, ou "Sou da equipe Nexus" para ver o ERP.

As regras de negócio vêm do plano de negócios da Nexus e foram seguidas sem alteração (planos, escala de Zarit, ponto de equilíbrio, ocupação da agenda, ARP, POPs, LGPD). **Todos os dados são fictícios** e ficam só no navegador (`localStorage`); a sessão fica em `sessionStorage`. Não há servidor.

## Rodar

Requisitos: Node 22 ou mais novo e pnpm.

```bash
pnpm install
pnpm start          # http://localhost:4200
pnpm test:ci        # 2120 testes em 156 arquivos (Vitest)
pnpm typecheck      # app e testes
pnpm check:core     # regras de código e de texto (sem any, sem travessão, sem Date direto...)
pnpm check:a11y     # contraste e alvos de toque do aplicativo do cuidador
pnpm build          # saída em dist/nexus-erp
```

Para publicar em um subcaminho (GitHub Pages, por exemplo): `pnpm exec ng build --base-href=/nexus-erp/`. Nenhum link do aplicativo usa caminho absoluto fora do roteador, e o catálogo de componentes do cuidador (`/cuidador/_kit`) só existe em desenvolvimento: nem entra no pacote de produção.

## Entrar

A tela de entrada tem duas portas. **Sou cuidador(a)** vem primeiro (veja a seção do aplicativo do cuidador mais abaixo). **Sou da equipe Nexus** é uma seleção de perfil de demonstração (sem senha), com um segundo fator simulado: o código `123456` aparece na tela e há o botão "Usar o código mostrado". A sessão da equipe e a do cuidador são separadas: uma nunca abre a área da outra.

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

## Aplicativo do cuidador

O cliente da Nexus, o familiar que cuida de uma pessoa idosa, tem o próprio aplicativo, dentro do mesmo projeto, do mesmo seed e do mesmo relógio simulado da equipe. Foi desenhado para quem tem pouco tempo e uma mão ocupada: cada tela tem um propósito e uma ação principal, o corpo da letra é de 18 px (com três tamanhos em **Mais**), os alvos de toque têm 48 px ou mais, o tom é acolhedor e não há painel. Tema só claro, barra de navegação embaixo no celular e no topo em tela larga.

**Como entrar.** Em `/login`, a porta **Sou cuidador(a)**: escolha uma das 11 pessoas de exemplo (sem senha e sem segundo fator, que é só da equipe) ou toque em **Criar minha conta** (`/cuidador/comecar`), o cadastro passo a passo com autorizações separadas. **Ajuda agora** (SAMU 192, CVV 188, falar com a Nexus) fica a um toque em todas as telas e abre sem entrar.

**As 11 pessoas de demonstração**

| Pessoa | Plano | Em uma frase |
|---|---|---|
| Ana Paula Ferraz, 45 | Cuida | Organiza consultas e remédios da mãe; a equipe vai falar com ela hoje; tem uma conversa marcada com o psicólogo |
| Maria Aparecida Lemos, 52 | Essencial | Divide o cuidado da mãe; pediu a revisão de uma decisão; grupos pedem o plano Cuida |
| João Batista Carneiro, 68 | Livre | Cuida da esposa, prefere telefone e tem pouca familiaridade digital (a linha do remédio fica maior); não autorizou a família |
| Rita de Cássia Moura, 50 | Cuida | No piloto; tem um serviço da rede concluído esperando avaliação |
| Elza Guimarães, 68 | Sustenta | Usa bastante o Cartão Nexus (8 usos) |
| Lourdes Campos, 64 | Sustenta | Na lista de espera de um grupo lotado; tem uma conversa confirmada no coworking |
| Terezinha Alves, 66 | Essencial | Concluiu o piloto; a linha do tempo mostra a evolução |
| Marcos Vinícius Leal, 39 | Essencial | Cancelamento agendado ("Manter meu plano"); nunca mandou mensagem (estado vazio) |
| Sônia Maria Dutra, 55 | Essencial | Retirou a autorização de saúde: sem humor e sem linha do tempo |
| Marlene Cardoso, 61 | Livre | Caso simples: só a organização da rotina |
| Raimunda Siqueira, 53 | Livre | Pedido de eliminação dos dados aberto, com o prazo de 15 dias à vista |

**As 5 abas e as 22 telas**

| Aba | Telas |
|---|---|
| **Hoje** `/cuidador/hoje` | O dia: próximo compromisso, remédios de hoje com **Dei** (e **Desfazer**), como você está, um convite para você, Falar com a gente |
| **Rotina** `/cuidador/rotina` | **Agenda** (adicionar, remarcar, tirar) e **Remédios** (cadastrar, pausar, nunca apagar) |
| **Cuidar de mim** `/cuidador/cuidar-de-mim` | **Conversar com um psicólogo** (formato, horário, preço do plano, cancelar e remarcar), **Como estou** (linha do tempo sem alarme, pedir revisão), **Grupos e capacitações** (contrato de sigilo, lista de espera), **Conteúdos** |
| **Rede** `/cuidador/rede` | **Buscar** (comparar até 3), **Profissional** (ficha e Pedir serviço), **Meus pedidos** (avaliar e corrigir em 7 dias), **Cartão Nexus** (número, onde usar, o que economizou) |
| **Mais** `/cuidador/mais` | **Meu plano** (subir, descer, cancelar, manter; pagamento simulado), **Falar com a Nexus** (4 canais), **Família** (texto para copiar), **Privacidade e meus dados** (autorizações, cópia, eliminação), **Meu perfil**, tamanho da letra e **Sair** |

Fora da barra: **Começar** (`/cuidador/comecar`), **Ajuda agora** (`/cuidador/ajuda-agora`) e a entrada. Telefone e WhatsApp são fictícios e nunca disparam `tel:` nem `wa.me`: o toque abre o diálogo "Como falar com a gente" com **Copiar número**.

**O que acontece na equipe quando o cuidador age** (as duas visões usam o mesmo `Database`)

| O cuidador | A equipe vê |
|---|---|
| Marca, cancela ou remarca uma conversa com o psicólogo | A sessão e a vaga na agenda do psicólogo (`/app/atendimento`); cancelar com menos de 24 h vira falta |
| Manda uma mensagem ou pede "Combinar um horário" | A mensagem na fila de Mensagens, com o prazo de 24 horas úteis (e o pedido de apoio marcado) |
| Pede um serviço da rede e avalia | A solicitação em Rede credenciada (a equipe registra a resposta do profissional) e a avaliação na ARP |
| Entra em um grupo ou na lista de espera | A inscrição com o aceite do sigilo, a posição na fila e a promoção automática |
| Troca, cancela ou mantém o plano | A assinatura e o histórico de trocas em nome do cuidador; o Cartão é emitido ou inativado |
| Muda uma autorização, pede cópia ou eliminação dos dados | Os consentimentos com histórico e as solicitações do titular com protocolo e prazo, em LGPD |
| Cria a conta | O cadastro novo (código `CUI-0341`) em Cuidadores, com os consentimentos escolhidos |

Na outra direção, o que a equipe registra aparece para a pessoa: a nota "a equipe vai falar com você hoje" (só isso: nenhuma pontuação, faixa ou alerta chega ao cuidador), a resposta do pedido de revisão, a resposta do profissional, a confirmação da conversa e a mudança de plano.

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
  features/   um módulo por pasta, com rotas lazy; caregiver-app/ é o aplicativo do cuidador
              (shell, kit visual, 13 áreas de tela: today, routine, care, network, plan...)
src/styles/   tokens e CSS do design system (_caregiver.scss é o tema do cuidador)
scripts/      check-core (regras de código e texto) e check-caregiver-a11y (contraste e alvos)
docs/         regras, escopo, design, UX, arquitetura, QA, CS/CX e o aplicativo do cuidador
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
| `docs/09-guia-dev-modulos.md` | Guia de trabalho dos devs de módulo |
| `docs/10-cuidador-contexto.md` | Aplicativo do cuidador: por que existe, para quem, navegação, decisões e posse dos arquivos |
| `docs/10-cuidador-ux.md` | Aplicativo do cuidador: UX e UI (kit visual, fluxos, as 22 telas, 190 critérios de aceite `AC-CG`, suposições) |
| `docs/11-cuidador-arquitetura.md` | Aplicativo do cuidador: contrato da Base (sessão, rotas, contexto, kit, seed) e os arquivos compartilhados |
| `docs/12-cuidador-integracao.md` | Aplicativo do cuidador: o que a integração fez (seed, núcleo, consistência, acessibilidade, produção) |
| `docs/13-qa-cuidador.md` | Aplicativo do cuidador: relatório de QA (15 bugs, nenhum grave) e testes de regressão em `src/app/qa` |
| `docs/14-cs-cx-cuidador.md` | Aplicativo do cuidador: CS/CX com nove cuidadores no celular (nota média 7,2 antes das correções, 28 achados) |
| `docs/15-correcoes-cuidador-a.md` e `docs/15-correcoes-cuidador-b.md` | Aplicativo do cuidador: o que foi corrigido depois do QA e do CS/CX |
| `docs/ac-status/` | Situação de cada critério de aceite por módulo; `caregiver-p1.md`, `caregiver-p2.md` e `caregiver-p3.md` são as do aplicativo do cuidador |

## Como foi feito

Time de agentes: PM (regras e escopo), UI (design system), UX (fluxos e auditoria), Dev (núcleo, componentes e módulos), QA (testes e bugs) e CS/CX (simulação de uso pela equipe da Nexus), seguidos de uma rodada de correções. O aplicativo do cuidador veio depois: UX e UI, a Base (sessão, shell e kit), três devs de página em paralelo (P1, P2 e P3) e uma integração final, seguidos de QA, CS/CX com os cuidadores e uma rodada de correções.

## Limites do protótipo

Dados fictícios e locais; login e segundo fator simulados; pagamentos e e-mails não existem. O aplicativo do cuidador existe, mas só roda no navegador: não há aplicativo instalado, notificação no aparelho, ligação nem WhatsApp reais (os números são fictícios e abrem um diálogo com "Copiar número"), a troca de plano não cobra nada e nenhum campo pede número de cartão. Os itens do plano de negócios que o documento deixa em aberto (limites da ARBE, valores do atendimento psicológico, retenção de dados) estão marcados como suposição de protótipo em `docs/01-regras-de-negocio.md` e podem ser editados.
