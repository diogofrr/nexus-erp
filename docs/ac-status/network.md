# M08 Rede credenciada: status de aceite

Rotas em `/app/rede`. Perfis: sócia `u1` (grava tudo), atendimento `u7` (lê tudo, registra solicitações e avaliações em nome do usuário), responsável técnico `u2` (só as fichas de psicologia, para validar o registro no conselho). Prestadores são cadastros gerenciados pela Nexus: não há login de prestador.

Os testes automáticos ficam em `src/app/features/network/network.spec.ts` e `src/app/core/network/network.spec.ts`.

| AC | Status | Onde ver (rota e perfil) | Observação |
|---|---|---|---|
| AC-M08-01 | feito | `/app/rede/credenciamento/acr_0017` (u1): com os 5 critérios e documentos válidos o botão "Aprovar" habilita; `/app/rede/credenciamento/acr_0016` (u1): desabilitado, com "Para aprovar falta: ..." ao lado | O botão usa `aria-disabled` e o motivo vem escrito ao lado |
| AC-M08-02 | feito | `/app/rede/credenciamento/acr_0016` (u1), prestadora `prv_16` com registro vencido há 12 dias | Fica em Documentos pendentes. Só aprova depois de "Anexar documento (simulado)" com validade futura e de conferir o critério de novo |
| AC-M08-03 | feito | `/app/rede/prestadores` e a ficha (u1): `prv_13` e `prv_20` sem média, `prv_15` com 5 avaliações, `prv_09` 4,00 em alerta, `prv_08` 4,50 em excelência | "Sem média (menos de 5 avaliações)" aparece na ficha e na busca |
| AC-M08-04 | feito | Fichas, aba Avaliações, e `/app/rede/avaliacoes` (u1): "Classificar como grave". `/app/rede/auditoria` (u1): média abaixo de 4,0 | A terceira grave suspende na hora e abre a avaliação interna; duas graves não suspendem. A média abaixo de 4,0 suspende ao rodar a auditoria (RN-ARP-05) |
| AC-M08-05 | feito | `/app/rede/busca` (u1 ou u7), chips de especialidade | Suspenso some; uma só opção mostra "Única opção disponível no momento"; nenhuma opção mostra "Nenhuma opção disponível no momento" com atalho para Encaminhamentos |
| AC-M08-06 | feito | `/app/rede/busca`, especialidade "Saúde bucal" (prestadores `prv_11` e `prv_12`) | O destaque do primeiro não esconde o segundo |
| AC-M08-07 | feito | `/app/rede/prestadores`, `/app/rede/sinais` (u1): `prv_04` 62,5% (5 de 8) com selo; `prv_03` 28,6% sem selo; `prv_06` 30,0% com selo | "Risco de saída" é termo interno da gestão |
| AC-M08-08 | feito | `/app/rede/auditoria` (u1): "Ver prévia" (não grava) e "Rodar auditoria" | Um instantâneo por prestador em atividade (16), com data, média, nº de avaliações, faixa e graves. No mesmo dia o diálogo pergunta "Já existe uma auditoria de hoje. Substituir?" |
| AC-M08-09 | feito | `/app/rede/avaliacao-interna/:id` (u1) | Confirmar exige o texto do e-mail (fica no histórico e na aba E-mails da ficha); reinstalar exige motivo e devolve à busca; manter em monitoramento aceita nota |
| AC-M08-10 | feito | `/app/rede/avaliacao-interna/` da `prv_10` (u1) | Mostra a justificativa enviada pelo prestador (do seed). A gestão registra novas justificativas recebidas com "Registrar justificativa recebida" |
| AC-M08-11 | feito | `/app/rede/solicitacoes?estado=sem-avaliacao`, serviço concluído, "Registrar avaliação" (u1 ou u7) | Nota em branco ou fora de 1 a 5 é recusada com a frase do catálogo; segunda avaliação do mesmo serviço é recusada; só serviço concluído |
| AC-M08-12 | feito | Todas as telas de `/app/rede` | Teste varre o texto de cada tela: nenhuma menciona comissão, porcentagem nem repasse |
| AC-M08-13 | feito | `/app/rede/credenciamento/acr_0017` depois de aprovar (u1) | "Ativar prestador" fica desabilitado com "Para ativar falta: ..." até registrar integração, ciência dos POPs e aceite de não captar usuários por fora |
| AC-M08-14 | feito | `/app/rede/prestadores` (u2): só psicologia; ficha `prv_13` com "Validar registro no conselho" (u2). u7 só lê | Para ver o botão, abra um novo credenciamento de psicologia como u1 e entre depois como u2. A `prv_13` já vem validada no seed |
| AC-M08-15 | feito | `/app/rede/prestadores?estado=suspenso` e `/app/rede/busca`, especialidade Nutrição (u1) | `prv_14` suspensa, não aparece na busca, que mostra "Nenhuma opção disponível no momento" |

## Decisões e limites

- Sem portal, tudo o que o prestador faria é registrado pela gestão: integração, ciência dos POPs, aceite de não captar por fora, cláusula de proteção de dados, resposta às solicitações, conclusão, justificativa da avaliação interna e horários da semana (ficha, bloco Sinais da rede).
- Documento vencido em prestador ativo: a auditoria suspende com o motivo "documento vencido" quando passam 30 dias; a ficha e o credenciamento mostram os dias que faltam. No seed só a candidata `prv_16` tem documento vencido; para ver o alerta em prestador ativo anexe um documento e avance o relógio simulado (Configurações).
- Pedir documentos e reprovar não enviam e-mail: o texto fica registrado e o envio é fora do ERP. O pedido de documentos aparece na aba E-mails e no Histórico da ficha.
- A busca de cuidador nos formulários da rede é só por código para a sócia (LP-08) e por código ou nome para o atendimento.
