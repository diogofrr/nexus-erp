# Status de aceite: M11 Mensagens e reclamações (`messages`)

Telas: SCR-M11-01 a 06 em `/app/mensagens` (caixa, gaveta `:id`, `modelos`; "Registrar contato" abre por botão, tecla `N` ou `?acao=registrar-contato`) e `/app/reclamacoes` (lista e `:id`). Data de referência dos testes: 04/11/2026, 12:00 (quarta-feira). Perfis: `u7` Camila (atendimento), `u1` Helena (sócia), `u2` Dra. Cecília (responsável técnico), `u3` Dr. Rafael (psicólogo).

| AC | Status | Onde ver (rota e perfil) | Observações |
|---|---|---|---|
| AC-M11-01 | feito | `/app/mensagens/:id`, atendimento: linha "Prazo do canal" | Aplicativo até 24 horas úteis, WhatsApp até 4 horas úteis, telefone imediato em horário comercial, e-mail até 48 horas úteis (lidos das configurações). O selo de prazo da lista mostra o tempo em texto e o horário absoluto no foco. |
| AC-M11-02 | parcial | `/app/mensagens/:id` de uma mensagem do WhatsApp recebida na sexta às 17:30, atendimento | A tela mostra o prazo calculado pelo núcleo (RN-CAN-03, minuto a minuto): segunda às 11:30, com o aviso "Chegou sexta, 17:30. O prazo continua segunda, a partir das 08:00." Fora do expediente (por exemplo sexta às 19:10) o aviso diz "O prazo começa segunda, 08:00." O texto do AC fala em "até 12h de segunda": divergência já registrada em `docs/08-arquitetura.md`, item 9. PM e QA decidem qual dos dois textos muda. Nenhum horário aparece no formato "11h30". |
| AC-M11-03 | feito | `/app/mensagens`, atendimento: seção "Atrasadas (5)" no topo | As 5 do seed ficam em seção própria, a mais atrasada primeiro, com "Atrasada há N h úteis". Entram no indicador de SLA (`slaByChannel`) e no contador do menu e do sino. Ao responder, saem da seção e o contador cai. |
| AC-M11-04 | feito | `/app/mensagens/:id`, atendimento: chave "Pedido de apoio" | Soma ao contador de 30 dias do cuidador (mostrado na gaveta) e, se `evaluateArbe` pedir, gera o alerta de risco para a equipe técnica (sem duplicar, só com consentimento de saúde ativo). O atendimento não vê a palavra ARBE. |
| AC-M11-05 | feito | `/app/reclamacoes/rec_0005` e `/app/reclamacoes/rec_0001`, atendimento e sócia | "Classificar como grave" exige categoria e prestador, soma na ARP e chama `NetworkService.reevaluate`: a terceira grave suspende na hora e abre a avaliação interna (RN-ARP-10, mesmo comportamento do seed, onde P14 foi suspensa no ato). A REC-0001 já vem classificada no seed (divergência 12 de `docs/08`); a de teste é a REC-0005 ou uma nova. Duas graves não suspendem. A contagem por data de classificação alimenta a próxima auditoria (M08). |
| AC-M11-06 | feito | `/app/reclamacoes/:id`, atendimento e responsável técnico | "Suspeita de violência ou negligência" abre a ocorrência POP-07 (`restrictedToUserIds`: RT e psicólogo do caso). Atendimento e sócia veem só "Enviado ao responsável técnico", sem texto nem ocorrência. A tela da ocorrência em si é do M13. |
| AC-M11-07 | feito | `/app/mensagens` botão "Registrar contato", `N` ou `?acao=registrar-contato`, atendimento | A mensagem entra na caixa com canal telefone (ou WhatsApp), em nome do cuidador, com prazo do núcleo; "Já respondi na ligação" marca como respondida. |
| AC-M11-08 | feito | `/app/reclamacoes`, atendimento: REC-0005 | Aparece como "Vencida há 3 dias úteis" (aberta há 8 dias úteis, prazo de 5). `?filtro=vencidas` vem do sino. |
| AC-M11-09 | removido | não se aplica | Reclamações vistas pelo prestador saíram do escopo por decisão do dono. |
| AC-M11-10 | feito | `/app/mensagens/modelos`, atendimento | Os 6 modelos do seed passam na validação. O formulário recusa promessa de resultado, travessão e jargão, com a explicação do que trocar. |

## Também entregue

- Botão fixo **Sinalizar risco** (A-38) em toda mensagem, em 2 cliques, com SAMU (192) e CVV (188); abre a ocorrência POP-05 restrita ao RT e ao psicólogo do caso, aparece nas notificações do RT e mostra "Responsável técnico avisado às HH:mm." O atendimento não vê a ocorrência.
- Privacidade: a sócia vê só `CUI-0000` e o texto das mensagens de cuidador aparece como "Texto oculto: pode identificar o titular"; contato do cuidador mascarado com "Mostrar" pedindo motivo; abrir mensagem e reclamação grava `view` no log.
- Mensagens do seed com `providerId` (e-mails de candidatos) aparecem com o nome do prestador e o rótulo "Prestador"; responder grava uma mensagem de saída com o mesmo `providerId`.
- Responsável técnico: caixa só com casos de risco e reclamações só graves e de suspeita de violência, em modo leitura. Psicólogo: só mensagens dos seus cuidadores, em leitura. Psicólogo em `/app/reclamacoes` vai a `/403`.
- Atalhos: `J` e `K` trocam de mensagem, `N` registra contato, `R` leva à resposta, `/` foca a busca.
- Rascunho automático e "Preencher com exemplo" nos formulários de reclamação, contato e modelo.
