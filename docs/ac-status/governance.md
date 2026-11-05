# Status de aceite: M13 Governança (`governance`)

Telas: `/app/governanca` (visão geral), `pops` e `pops/:code` (SCR-M13-01 e 02), `riscos` e `riscos/:id` (03 e 04; o `:id` aceita o código `R9`), `encaminhamentos` (05; a gaveta "Novo encaminhamento" é a 06), `ocorrencias` e `ocorrencias/:id` (07 e 08), `formacao` (09), `conteudos` (10) e `normas` (11). Data de referência dos testes: 04/11/2026, 12:00. Perfis: `u1` Helena (sócia, total e só contagem de ocorrências), `u2` Dra. Cecília (RT, total), `u3` Dr. Rafael (psicólogo, leitura e só as ocorrências dos casos dele), `u7` Camila (atendimento, leitura e sem ocorrências).

| AC | Status | Onde ver (rota e perfil) | Observações |
|---|---|---|---|
| AC-M13-01 | feito | `/app/governanca/pops`, sócia ou RT | POP-01 a POP-10 com o responsável do Quadro 11 (POP-04 "Gestão e responsável técnico"). Cada POP abre com os 7 campos: objetivo, responsável, materiais, passo a passo, registro exigido, indicadores e data da última revisão, inclusive POP-05 e POP-07 (esses mostram também os gatilhos e os órgãos). |
| AC-M13-02 | feito | `/app/governanca/pops` (filtro "A revisar", também `?filtro=a-revisar`) | POP-02 e POP-06 "A revisar", POP-08 "Revisão acionada", os outros "Em dia". O estado vem do relógio do sistema (12 meses desde a última revisão), então muda se a data simulada mudar. |
| AC-M13-03 | feito | `/app/governanca/riscos` e `/app/governanca/riscos/R9`, sócia ou RT | R1 (4x5=20) no topo, 8 prioritários e 4 não. Em R9, trocar P de 2 para 5 mostra C 25 e "Prioritário" antes de salvar; ao salvar, R9 vai ao topo e o total de prioritários passa a 9. C é sempre calculado (`riskCriticality`). Risco prioritário sem plano de tratamento não salva. |
| AC-M13-04 | feito | `/app/governanca/riscos` | Matriz 5x5 (`app-heat-matrix`): cada risco na célula P x I, com o número da célula e o código do risco. Tem "Ver como tabela". |
| AC-M13-05 | feito | `/app/governanca/encaminhamentos`, botão "Novo encaminhamento", sócia ou RT | Categoria "Sofrimento psíquico grave ou risco de suicídio" mostra os destinos "Rede de urgência em saúde mental" e "CVV (188)" e o lembrete "Conforme POP-05". Só os destinos da categoria são aceitos; agravamento clínico exige "família comunicada"; o cuidador é escolhido pelo código CUI-0000; não há campo de valor ou comissão. |
| AC-M13-06 | feito | `/app/governanca/ocorrencias/occ_0001` e `occ_0002`, RT (e Dr. Rafael na `occ_0002`) | A do caso Zarit 88 (CUI-0011) está encerrada com os 7 passos feitos, cada um com hora e responsável. A do dia (CUI-0001) mostra 2 de 7 feitos e os passos 3 a 7 pendentes. A governança trabalha por código: o nome da Ana Paula não aparece aqui. |
| AC-M13-07 | feito | `/app/governanca/ocorrencias/occ_0003`, RT | POP-07 de CUI-0028: CREAS e Disque 100 aparecem "Não comunicado", há o lembrete "Proteger a pessoa idosa sem abandonar quem cuida" e dá para registrar a comunicação (data e protocolo), que completa a linha do órgão. Não encerra sem os 5 passos e sem ao menos um órgão comunicado. |
| AC-M13-08 | feito | `/app/governanca/ocorrencias` com `u1` e `u7` | A sócia vê só contagens (POP-05, POP-07, em aberto), sem caso, sem código e sem detalhe (o detalhe vai a `/403`). O atendimento vai a `/403`, não vê a aba nem a palavra. O psicólogo vê só as ocorrências dos casos dele; outro psicólogo, ao abrir o link, recebe a mensagem neutra "não está disponível para o seu perfil". Abrir cada ocorrência grava `view` no log. |
| AC-M13-09 | feito | `/app/governanca/encaminhamentos` | As 7 linhas do Quadro 12 com destinos e observações, mais o aviso do SAMU (192). |
| AC-M13-10 | feito | `/app/governanca/formacao`, qualquer perfil da governança | As quatro frentes (integração dos credenciados, profissionais de grupos, gestão e continuada). O prestador sem integração (Equipamentos Cuidar+ e a candidata Dra. Isadora Leal) aparece "Pendente"; presença marcada em evento de integração conclui a integração. Presença só vale a partir do dia do evento. |
| AC-M13-11 | feito | `/app/governanca/conteudos`, sócia e RT | Conteúdo "Em revisão" aberto pela sócia mostra "Aprovar e publicar" desabilitado com "Só o responsável técnico aprova e publica"; o serviço também recusa. O RT aprova com diálogo de efeito e a data fica gravada (aprovado em 04/11/2026). |
| AC-M13-12 | feito | `/app/governanca/normas` | As seis normas, todas "Ainda não confirmada". Sócia e RT registram a data de "Vigência confirmada em" (data futura é recusada) e desfazem pelo toast. |

## Permissões e privacidade (matriz 1.2 e bloqueios 1.3)

- **Ações do RT só o RT, ações da gestão só a gestão (RN-POP-14):** registrar ou acionar revisão de POP usa `canActOnPop`; o botão some para quem não fecha o POP, com a explicação, e o serviço recusa de novo.
- **Encaminhamentos:** RT vê tudo; psicólogo só os dos casos dele; a sócia vê as categorias comuns por código e só a contagem de risco e violência (RN-ENC-11); o atendimento vê só as categorias sem conteúdo clínico (nem a existência das outras).
- **Conteúdo:** gestão e RT escrevem e enviam para revisão; só o RT publica.
- **Log:** gravam no log criar encaminhamento, registrar retorno, passos e comunicações de ocorrência, encerrar, abrir ocorrência (`view`), editar risco, revisão de POP, presença, conteúdo e norma. Nenhum texto clínico vai no detalhe do log.
- Nome de cuidador nunca aparece nesta área; só `CUI-0000`.

## Também entregue

- Desfazer (toast) em revisão de POP, acionar revisão, edição de risco e confirmação de norma.
- Diálogo de efeito ao encerrar ocorrência, encerrar encaminhamento e publicar conteúdo.
- "Preencher com exemplo" nas gavetas de encaminhamento, ocorrência, evento e conteúdo (se a preferência estiver ligada).
- Faixa de abas entre as telas (`app-link-tabs`); a aba Ocorrências some para o atendimento.
- Ciência: cada pessoa da equipe registra a própria ciência de um POP uma vez; a tela mostra quantos prestadores e pessoas da equipe já registraram.
