# Status de aceite: M05 Atendimento psicológico (`care-sessions`)

Rota base `/app/atendimento`. Perfis de teste: `u3` Dr. Rafael (psicólogo), `u7` Camila (atendimento), `u2` Dra. Cecília (RT), `u1` Helena (sócia). A data de hoje do seed é 04/11/2026 (quarta); com o relógio real a agenda mostra a semana de hoje.

| AC | Status | Onde ver | Observação |
|---|---|---|---|
| AC-M05-01 | feito | `/app/atendimento/ocupacao` com `u3` ou `u2` | Rafael: 86,3% e 91,3%, selo "Agenda acima de 80% por dois meses seguidos" e o texto acolhedor |
| AC-M05-02 | feito | idem, cartão da Dra. Letícia | 80,0% e 80,0%, sem alerta (limite estritamente maior que 80) |
| AC-M05-03 | feito | idem, cartão da Dra. Beatriz | 85,0% e 70,0%, sem alerta |
| AC-M05-04 | feito | idem, cartão do Dr. Tiago | Mês -2 "n/d", mês -1 50,0%, sem alerta |
| AC-M05-05 | feito | idem, linha do mês corrente | Selo "parcial"; não entra na regra dos dois meses (calculado de vagas abertas e reservadas, e sessões `done` do mês) |
| AC-M05-06 | feito | `/app/atendimento/ocupacao`, botão "Redistribuir", com `u2` ou `u1` | Transfere cuidadores e sessões futuras (a vaga vai junto, então a agenda de Rafael diminui), pede motivo, grava no log (`psychologist_redistribution`, motivo em `justification`). Se o destino já tem compromisso no mesmo horário, a sessão fica e aparece no aviso |
| AC-M05-07 | feito | `/app/atendimento/agenda`, "Agendar sessão", modalidade coworking, `u7` ou `u3` | A sala Jacarandá aparece desabilitada com "Falta sanitário adaptado (3 de 4 itens de acessibilidade)"; o serviço também recusa |
| AC-M05-08 | feito | `/app/atendimento/sessoes/:id`, "Marcar realizada", `u3`, sessão on-line confirmada que já começou | Sem a caixa "formato remoto é pertinente" a gaveta recusa com a frase da regra |
| AC-M05-09 | feito | `/app/atendimento/sessoes/:id`, "Cancelar sessão", `u7` ou `u3` | O efeito aparece ANTES ("Faltam 12 horas... registra falta"); menos de 24 h vira `no_show`, mais vira `cancelled_by_user` e a vaga reabre. O limite vem de `settings.sessionCancellationHours` |
| AC-M05-10 | feito | `/app/atendimento/sessoes/:id/anotacao`, `u3` | Assinada, a tela perde o campo e o botão de assinar; só "Adicionar adendo" (datado). O serviço recusa editar texto assinado |
| AC-M05-11 | feito | `u7` em `/app/atendimento/agenda` e no detalhe da sessão | O atendimento agenda, confirma e cancela sem ver o botão de anotação, o conteúdo ou o alerta; a rota da anotação leva a `/403` com `denied` no log |
| AC-M05-12 | feito | `u3` (de outro psicólogo) e `u2` em `/app/atendimento/sessoes/:id/anotacao` | Psicólogo que não é o autor vai a `/403` e grava `denied`; o RT vê o portão de supervisão (motivo pronto ou "Outro" com 10 caracteres), grava `supervise` e lê sem botões de edição |
| AC-M05-13 | feito | gaveta "Agendar sessão" com C01 (Cuida), C09 (Sustenta), C03 (Livre com amarelo) e C04 (Livre) | Vagas prioritárias só aparecem a quem a regra permite; para o atendimento sem rótulo clínico ("Mostrando as vagas disponíveis para este cuidador") |
| AC-M05-14 | feito | gaveta "Agendar sessão", resumo de valor | Mostra "Sessão R$ 120,00, desconto Cuida 15% (R$ 18,00), total R$ 102,00"; base e descontos vêm de `settings` e `plans` (M15) |
| AC-M05-15 | feito | `/app/atendimento` com `u1` (cai em Ocupação) | A sócia vê horas por psicólogo, sem nenhum cuidador; Agenda, Disponibilidade e Sessões dão `/403` para ela. Ela também edita as Salas |

## Telas além dos AC
- Agenda semanal e mensal (SCR-M05-01), Disponibilidade (SCR-M05-02), Detalhe da sessão (SCR-M05-04), Anotação (SCR-M05-05), Salas (SCR-M05-08) e a lista de Sessões (`/sessoes`, entrada do sino "Sessões sem anotação").
- SCR-M05-09 (Fila) é a mesma tela de `/app/acompanhamento/fila` (A-20): `/app/atendimento/fila` redireciona para ela.
- A-22: quando o atendimento agenda, o tipo de atendimento vem do histórico do cuidador, com a ajuda "confirme com o psicólogo do caso".
- Sessão com risco marcado na gaveta "Marcar realizada" exige o encaminhamento e abre a ocorrência POP-05 (passos 1, 2, 4, 5 e 6 já preenchidos).

## Suposições de protótipo registradas
- "Confirmar" vale até o início da sessão (a regra pede confirmação até 24 horas antes, mostrada como lembrete), para não deixar sessão presa em `scheduled`.
- Marcar realizada ou falta só depois do horário de início, e só pelo psicólogo da sessão.
- Horas disponibilizadas do mês corrente = vagas abertas e reservadas (bloqueadas não contam); realizadas = sessões `done` do mês.
- A anotação é do autor: o psicólogo que recebe um caso redistribuído não herda anotações antigas (matriz 1.2, nível `C`); o RT acessa por supervisão.
