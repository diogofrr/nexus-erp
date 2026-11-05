# Status de aceite: M06 Zarit e ARBE (`zarit`)

Rota base `/app/acompanhamento`. Perfis de teste: `u3` Dr. Rafael (casos de Ana e João), `u4` Dra. Beatriz (caso de Maria), `u5` Dra. Letícia, `u2` Dra. Cecília (RT), `u1` Helena (sócia), `u7` Camila (atendimento).

| AC | Status | Onde ver | Observação |
|---|---|---|---|
| AC-M06-01 | feito | Resultado (`/app/acompanhamento/zarit/:cuidador/resultado/:id`) depois de aplicar, `u3` | Testado nas bordas 0, 20, 21, 40, 41, 60, 61 e 88, com a faixa por extenso, o alerta certo e a frase "apoia a sua escuta clínica" |
| AC-M06-02 | feito | `/app/acompanhamento/zarit/cg_0005/nova`, `u3` | "Concluir e ver resultado" fica `aria-disabled` e o rodapé diz "Faltam os itens 1, 2, ... 22"; o mapa dos itens mostra os pendentes; a revisão lista as 22 respostas com "Alterar" |
| AC-M06-03 | feito | gaveta/assistente e serviço | O assistente só oferece 0 a 4; o serviço rejeita resposta fora de 0 a 4, item faltando ou total fora de 0 a 88 |
| AC-M06-04 | feito | aplicar 63 hoje, `u3` | Cria alerta vermelho com prazo 23:59 de hoje, cronômetro "Faltam X h Y min", ocorrência POP-05 automática (restrita ao RT e ao psicólogo), aparece no sino de `u3` e `u2` como "Contato do mesmo dia pendente" e na Governança (`/app/governanca/ocorrencias`) |
| AC-M06-05 | feito | `/app/acompanhamento` com `u2`; `/app/acompanhamento/alertas/zal_0002` | Maria (79 ontem) aparece em primeiro, "Prazo de contato vencido", escalada ao RT, com a frase "Você pode registrar o contato em nome da equipe" (depois do portão de supervisão) |
| AC-M06-06 | feito | `/app/acompanhamento/alertas/zal_0001`, `u3` | "Encerrar alerta" fica `aria-disabled` com "Falta: horário do contato, nível e nota da avaliação de risco"; risco alto também exige encaminhamento; o serviço recusa igual |
| AC-M06-07 | feito | aplicar de 41 a 60 | Cria alerta amarelo com a tarefa "revisar rede de apoio" (botão "Abrir tarefa de revisão da rede de apoio"); o cuidador passa a ver as vagas prioritárias na gaveta "Agendar sessão" (M05) |
| AC-M06-08 | feito | `/app/acompanhamento/cuidador/cg_0003` (`u3`), `cg_0012` (`u4`), `cg_0013` (`u5`) | João -21,2%, Terezinha -55,0% e Cláudia "n/d" (com a diferença em pontos) |
| AC-M06-09 | feito | revogar o consentimento de saúde (M03/M12) e abrir `/app/acompanhamento/zarit/:id/nova` | A aplicação é bloqueada ("Sem consentimento de dados de saúde") e nenhum rascunho é gravado; os alertas abertos fecham com "consentimento revogado" (regra do núcleo) e o cuidador sai da fila, do histórico e do agregado |
| AC-M06-10 | parcial | `u7` em qualquer rota de `/app/acompanhamento` | O atendimento é barrado em todas as telas de M06 (`/403` com `denied`). O texto "aplicação pendente" ou "em dia" com data fica nas telas de cadastro do M03 (função `zaritStatusForSupport` do núcleo); não é tela do M06 |
| AC-M06-11 | feito | `/app/acompanhamento` com `u1` (cai em Painel agregado) | Contagens por faixa; recorte com menos de 5 vira "menos de 5" (sem número e sem barra); com recorte suprimido o total do painel fica oculto (A-30); a sócia nunca vê nome |
| AC-M06-12 | feito | `/app/acompanhamento/arbe` com `u2` | Ana: crítico (11 h, 4 pedidos, Zarit 63); Adriana (C29): atenção (9 h, 3 pedidos, Zarit 35). O recálculo não gera alerta a mais sobre o seed |
| AC-M06-13 | parcial | limites em `/app/configuracoes/arbe` (M15), efeito em `/app/acompanhamento/arbe` | Ao mudar os limites, a tela da ARBE e o serviço recalculam: alertas ainda não revistos que deixam de valer saem com motivo "Limites da ARBE alterados" e os novos nascem. A EDIÇÃO dos limites é do M15; lá a sócia também edita (decisão do dev do M15), e na tela do M06 ela só lê |
| AC-M06-14 | feito | `/app/acompanhamento/revisoes` com `u4` (Maria) | O pedido aparece com o prazo, a psicóloga responde e a resposta fica com data e hora; Letícia (`u5`) não vê. Também há "Registrar pedido", em nome do cuidador, com o prazo de `dsrDeadlineDays` |
| AC-M06-15 | feito | `u3` abrindo `/app/acompanhamento/cuidador/cg_0002`, `/alertas/zal_0002` ou `/zarit/cg_0002/nova` | `/403` e `denied` no log; a fila dele não mostra casos de outros. A sócia e o atendimento também são barrados nas telas individuais |
| AC-M06-16 | feito | `/app/acompanhamento/fila` com `u2` | Ordem: vermelho vencido, vermelho do dia, ARBE crítico, amarelo, ARBE de atenção, Zarit vencida, Zarit a vencer |
| AC-M06-17 | feito | `/app/acompanhamento/agregado` com `u2` | "Contato no mesmo dia (30 dias)": 66,7%, "2 de 3 alertas vermelhos com prazo vencido"; o vermelho de hoje só entra depois das 23:59. A sócia vê "menos de 5" nesse indicador |

## Fluxos
- F05 (aplicar a escala): intro, um item por tela com teclas 0 a 4, rascunho automático (só com consentimento), revisão, diálogo de efeito, resultado com conduta. Meta de 4 minutos é do uso; o assistente avança sozinho ao responder (chave "Avançar automaticamente" desliga).
- F06 (vermelho no mesmo dia): contato (hora, quem fez, canal, anotação), avaliação de risco (baixo, moderado, alto, com nota), encaminhamento (Quadro 12, liga à ocorrência), encerramento com diálogo. Cada passo alimenta os 7 passos da ocorrência POP-05 sem redigitar (A-29). O RT acessa pelo portão de supervisão (motivo pronto em 1 clique, vale 30 minutos por caso, cada abertura gera `supervise`) e pode registrar contato e avaliação em nome da equipe.

## Suposições de protótipo registradas
- O RT registra contato e avaliação de risco (UX F06 e RN-ZRT-14); só o psicólogo do caso aplica a escala (RN-ZRT-04).
- O contato é sempre de hoje, com horário até agora (não pode ser no futuro); contato depois das 23:59 fica marcado como atraso.
- "Enviar conteúdo" e "Oferecer atendimento" viraram atalhos reais: programação de grupos e a gaveta de agendamento já com o cuidador.
- Um cuidador fora do painel agregado é quem não tem os dois consentimentos (saúde e indicadores) ou está pausado.
