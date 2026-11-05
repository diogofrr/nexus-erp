# Status de aceite: M02 Painéis por perfil (`dashboard`)

Tela: SCR-M02-01 em `/app/painel`, um painel diferente para `partner`, `technical_lead`, `psychologist` e `support` (o painel do portal saiu do escopo). A busca global (`Ctrl+K`, SCR-M02-02) e as notificações (sino, SCR-M02-03) são do shell e do núcleo (`core/search`, `core/notifications`); o painel só liga cada item à tela certa. Data de referência dos testes: 04/11/2026, 12:00. Perfis: `u1` Helena, `u2` Dra. Cecília, `u3` Dr. Rafael, `u4` Dra. Beatriz, `u6` Dr. Tiago, `u7` Camila.

| AC | Status | Onde ver (rota e perfil) | Observações |
|---|---|---|---|
| AC-M02-01 | feito | `/app/painel`, os quatro perfis | Cada perfil vê só os blocos da tabela do escopo. A sócia nunca vê nome nem código de cuidador (conferido por teste com os 29 nomes do seed): só agregados, e indicador de saúde abaixo de 5 vira "menos de 5". O RT vê a fila por código, sem nome e sem escore. O psicólogo vê só os casos dele (nomes em modo discreto). O atendimento não vê nada clínico, nem "existe alerta". |
| AC-M02-02 | feito | `/app/painel`, RT | Faixas "1 alerta vermelho do dia sem contato" (com "até 23:59") e "1 alerta vermelho vencido"; KPIs com 2 alertas vermelhos abertos, 2 amarelos abertos (os de status `open`, divergência 14 de `docs/08`, com "4 em acompanhamento no total"), ARBE críticos (o seed tem 2 abertos, "pelo menos 1" do AC) e ocorrências POP-05: 1 e POP-07: 1. Fila de alertas: vencido e do dia primeiro. |
| AC-M02-03 | feito | `/app/painel`, sócia | "17 assinantes", conversão "5,0%" e "Faltam 10 para o ponto de equilíbrio", com o medidor "17 de 27 assinantes" (F14, passo 1). Resultado do mês "-R$ 843,51, abaixo do equilíbrio". Tudo recalcula quando as assinaturas ou os parâmetros mudam. |
| AC-M02-04 | feito | `/app/painel`, `u3` e `u4` | Dr. Rafael vê o aviso "A sua agenda passou de 80% por dois meses" (acolhedor: "não uma cobrança"); Dra. Beatriz não vê (85,0% e 70,0%, não seguidos). Dra. Letícia (80,0% duas vezes) e Dr. Tiago (mês sem agenda) também não. |
| AC-M02-05 | feito | `/app/painel`, atendimento | Seção "Atrasadas (5)" no topo, a mais atrasada primeiro, cada uma com "Atrasada há N h úteis"; depois "No prazo". Cada linha leva a `/app/mensagens?filtro=atrasadas`. |
| AC-M02-06 | não se aplica | não existe | O portal do profissional credenciado e o perfil `provider` foram removidos por decisão do dono; não há painel para ele. |
| AC-M02-07 | não feito (fora deste módulo) | busca `Ctrl+K` do shell | É do núcleo (`core/search`) e do shell (Dev Kit-B); não há código disso em `features/dashboard`. Testado em `layout/search`. |
| AC-M02-08 | parcial | `/app/painel`, os quatro perfis | Cada KPI e item leva à tela do módulo com o filtro quando o sino já definiu a chave: `contato-hoje`, `contato-vencido`, `em-andamento`, `tarefas`, `alertas-a-confirmar`, `minha-ocupacao`, `sem-anotacao`, `atrasadas`, `vencendo` (LGPD), `cancelamento-agendado` e, na Governança e nos Indicadores, `a-revisar` e `?aba=`. Para as telas sem chave definida (rede, cadastros novos, reclamações abertas, solicitações de serviço) o link vai à lista do módulo sem filtro, e o módulo dono decide se aceita `?filtro=`. Os caminhos são os de `core/search/screens.ts` (`/app/rede/prestadores`, `/app/rede/credenciamento`, `/app/rede/auditoria`, `/app/rede/solicitacoes`, `/app/atendimento/agenda`, `/app/lgpd/solicitacoes`). |

## Blocos por perfil

- **Sócia:** faixa "Precisa da sua decisão" (até 3: solicitações do titular a vencer, sobrecarga de agenda, auditoria quinzenal, risco de saída, credenciamentos, POPs a revisar), assinantes, conversão, resultado, ponto de equilíbrio, assinantes por plano (rosca), resultado do mês contra a projeção do cenário-base (barras e linha do realizado) e, em seções recolhíveis, rede, equipe (ocupação e alerta de 80%), acompanhamento agregado, atendimento e reclamações, conformidade (LGPD, POPs, riscos prioritários).
- **Responsável técnico:** banners do dia e vencido, KPIs (vermelhos, amarelos, ARBE críticos, ocorrências), fila de alertas por código, validações pendentes (conteúdos do POP-09, POPs, riscos) e ocupação da equipe.
- **Psicólogo:** aviso de sobrecarga (só quem passou de 80% por dois meses fechados), minha ocupação, sessões a registrar, tarefas "revisar rede de apoio", agenda de hoje (estado vazio acolhedor quando não há sessão) e fila de acompanhamento dos casos dele (alertas, aplicações vencendo e vencidas), limitada a 8 linhas com "E mais N".
- **Atendimento:** fila de mensagens por prazo, reclamações abertas, solicitações de serviço sem retorno, solicitações do titular a registrar, cadastros novos e cancelamentos agendados.

## Privacidade e estados

- Um `h1` por painel com saudação por hora ("Boa tarde, Helena"); nomes em `class="discreet"` (psicólogo e atendimento).
- Estados vazios acolhedores em decisões, fila, agenda e mensagens; contagens e prazos recalculam quando o banco muda (testado).
- Componentes novos só deste módulo: `app-panel-kpi` (KPI com link e filtro na URL) e `app-panel-section` (seção recolhível).
