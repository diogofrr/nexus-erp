# Status de aceite: M07 Grupos e capacitações (`groups`)

Rota base `/app/grupos`. Perfis de teste: `u1` Helena (sócia, tudo), `u7` Camila (atendimento, inscrições), `u3` Dr. Rafael (conduz G1), `u5` Dra. Letícia (conduz a terapia de grupo G3), `u2` Dra. Cecília (RT, valida enquadramento).

| AC | Status | Onde ver | Observação |
|---|---|---|---|
| AC-M07-01 | feito | `/app/grupos/act_0008` (Organização da rotina), `u7`, "Inscrever" com C06 (Essencial) | A checagem de plano fica "Essencial: grupos e capacitações são do plano Cuida em diante" (informativa, com o caminho) e o botão vira `aria-disabled` com o motivo ao lado; o serviço também recusa |
| AC-M07-02 | feito | mesma gaveta com C01 (Cuida) ou C17 (Sustenta) | Sem marcar o contrato de sigilo o botão diz "Falta o aceite do contrato de sigilo"; ao marcar, a gaveta mostra "Aceite registrado em dd/mm/aaaa às hh:mm" e o carimbo fica na inscrição |
| AC-M07-03 | feito | `/app/grupos/act_0004` (roda de conversa aberta), `u7` | Aceita Livre e "Participante externo" (nome e e-mail `@exemplo.com.br`); externo não entra em outros tipos |
| AC-M07-04 | feito | `/app/grupos/act_0001`, `u7` ou `u1` | "Lotada", "Lotado: 8 de 8, 2 na lista de espera"; "Cancelar inscrição" mostra "Lourdes Campos... será promovida"; a promoção é automática, a fila renumera e o estado volta a `open` quando sobra vaga |
| AC-M07-05 | feito | `/app/grupos/act_0003` (selo "Psicoterapia"); inscrever em terapia de grupo aberta com `u5` | Só entra cuidador marcado como elegível pelo psicólogo do caso; o atendimento vê "Aguardando elegibilidade do psicólogo do caso" e não consegue inscrever |
| AC-M07-06 | feito | `/app/grupos/novo`, modalidade presencial, sala Jacarandá, `u1` | A sala Jacarandá fica desabilitada com "Falta sanitário adaptado (3 de 4 itens...)"; o serviço também recusa. A inscrição em atividade com sala fora do padrão aparece como falha na checagem |
| AC-M07-07 | feito | `/app/grupos/:id` (qualquer atividade) | Mostra o caráter ("Orientação e psicoeducação" ou "Psicoterapia"), "Esta atividade não promete resultado terapêutico" e a inscrição profissional de quem conduz (CRP fictício); o título não pode usar "garantido", "cura" etc. |
| AC-M07-08 | feito | `/app/grupos/act_0003/presenca` com `u5` ou `u1`; `/app/grupos/indicadores` | Marcar ausente no encontro 1 muda a taxa de 100,0% para 93,3% na hora; os indicadores usam a mesma conta (presenças ÷ inscritos x encontros realizados) |
| AC-M07-09 | feito | M04 muda o plano e qualquer tela de `/app/grupos` | O núcleo (`GroupMembershipService.reconcilePlanLoss`) cancela as inscrições futuras sem acesso, promove a fila e deixa a turma em andamento. O M04 o chama quando a descida ou o cancelamento passa a valer (`SubscriptionService.applyDueChanges`) e o canal corporativo, ao devolver o cuidador ao Livre; a programação e o detalhe também conferem sozinhos ao abrir. Só sai quem está em turma que ainda não começou (estado e data do primeiro encontro) |
| AC-M07-10 | feito | `/app/grupos/novo` | O campo tema oferece só os 8 temas de grupo ou os 6 de capacitação (conforme o tipo) e o serviço rejeita outro |
| AC-M07-11 | feito | `/app/grupos?estado=cancelled` e `?estado=draft` | G6 (cancelada) e G7 (rascunho) existem e aparecem nos filtros |

## Telas
- Programação em lista e calendário mensal, com filtros de tipo, tema, estado e local na URL; Nova atividade (e edição de rascunho ou atividade aberta); Detalhe com inscritos, lista de espera, contrato, indicadores e ações; Inscrever (gaveta com todas as checagens de uma vez, F11); Presença por encontro; Indicadores de participação.
- Privacidade: a sócia vê só códigos; o atendimento não vê quem está em terapia de grupo; o psicólogo vê nomes só dos grupos que conduz; o RT vê nomes e valida o enquadramento (fica registrado no log).

## Suposições de protótipo registradas
- Quem marca a elegibilidade para terapia de grupo é o psicólogo do caso, no momento de inscrever (não há campo próprio fora da inscrição); o atendimento não inscreve em terapia de grupo.
- Taxa de presença = presenças registradas ÷ (inscritos x encontros realizados). Preenchimento = inscritos ÷ vagas.
- Para a sócia, participação em terapia de grupo com menos de 5 inscritos aparece como "menos de 5".
- A divulgação de Psicologia usa o CRP do psicólogo da Nexus (acrescentado com "fictício"); convidado informa o registro, se houver.
