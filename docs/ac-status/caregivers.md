# Status de aceite: M03 Cuidadores e pessoas idosas (`caregivers`)

Dev A. Rotas: `/app/cuidadores`, `/app/cuidadores/novo`, `/app/cuidadores/:id` (abas por `?aba=`) e `/app/cuidadores/:id/idoso`. Perfis de teste: `u7` Camila (atendimento), `u1` Helena (gestão), `u2` Dra. Cecília (RT), `u3` Dr. Rafael (psicólogo).

| AC | Status | Onde ver (rota e perfil) | Observação |
|---|---|---|---|
| AC-M03-01 | feito | `/app/cuidadores/novo`, `u7`: digite `529.982.247-25` (CPF real) e saia do campo | "Parece um CPF real. Use um CPF fictício." no campo e no resumo; o serviço também recusa. Botão "Gerar CPF fictício" |
| AC-M03-02 | feito | `/app/cuidadores/novo`, `u7`, "Preencher com exemplo" e as 5 etapas | Nasce Livre, sem cartão, com 6 consentimentos pendentes quando nenhum é decidido. Quem escolhe "Concorda" ou "Não concorda" grava o evento |
| AC-M03-03 | feito | `/app/cuidadores/novo`, etapa 1, `u7` | 17 anos é recusado ("O cuidador precisa ter 18 anos ou mais."); 18 anos completos hoje passa (relógio do sistema) |
| AC-M03-04 | feito | `/app/cuidadores` e `/app/cuidadores/cg_0001`, `u1` | Código, plano, situação e piloto. Nome, CPF, telefone e e-mail não entram no DOM; não há botão "Mostrar" |
| AC-M03-05 | feito | `/app/cuidadores/cg_0001`, aba Resumo, `u7` | CPF `***.***.***-**`; "Mostrar" pede motivo pronto, mostra por 30 s e grava `reveal`. Cada campo é revelado separadamente (o componente compartilhado não revela todos de uma vez) |
| AC-M03-06 | feito | `/app/cuidadores/cg_0001`, `u7` | As abas Acompanhamento e Atendimento são ocultadas (A-14); o Resumo só diz "Aplicação da escala: pendente" ou "Em dia, próxima em ..." |
| AC-M03-07 | feito | `/app/cuidadores`, `u3`; depois `/app/cuidadores/cg_0002` | Lista só os cuidadores dele ("Mostrando seus N cuidadores"). Link de outro psicólogo, ou de cuidador que não existe, abre `/403` e grava `denied` |
| AC-M03-08 | feito | `/app/cuidadores/cg_0002?aba=acompanhamento`, `u2` | Portão de supervisão com motivos prontos; o motivo vale 30 min por caso; cada abertura grava `supervise` (com justificativa) e `view` |
| AC-M03-09 | feito | `/app/cuidadores/cg_0025` (Uberaba, independente), `u7` | "1 de 3 critérios atendidos, 2 reprovados"; "Marcar como piloto" fica com `aria-disabled` e diz "Falta: ... TCLE". Com os 3 critérios e o TCLE ativo cria a coorte (3 janelas) |
| AC-M03-10 | feito | `/app/cuidadores/cg_0016?aba=acompanhamento`, `u4` | Mostra "Sem consentimento de saúde" e a data da revogação; não oferece aplicar a escala. Revogar (M12) leva o cadastro a `paused_by_consent_revocation` |
| AC-M03-11 | feito | `/app/cuidadores/cg_0018`, botão "Encerrar cadastro", `u7` | Gaveta com motivo e o que será eliminado e bloqueado (Res. CFP 1/2009, a confirmar); diálogo de efeito; muda para "Encerramento pedido" e cria (ou reaproveita) a solicitação de eliminação POP-10 em M12 |
| AC-M03-12 | feito | `/app/cuidadores?plano=cuida`, `u7` | 340 cuidadores, 25 por página, filtros na URL; resposta imediata (dados locais) |
| AC-M03-13 | feito | `/app/cuidadores/cg_0019?aba=consentimentos`, `u7` ou `u2` | JSON só do titular. RT gera completo; atendimento e gestão geram "pacote selado" (parte clínica em base64, nunca na tela), conforme A-17. Grava `export` |
| AC-M03-14 | feito | `/app/cuidadores/cg_0001` (select "Psicólogo responsável") e seleção em lote na lista, `u2` | Só o RT atribui (com "Desfazer"); o atendimento não vê o controle |

## Telas

- SCR-M03-01 lista (PD-01), SCR-M03-02 assistente de 5 etapas com rascunho, SCR-M03-03 ficha com abas, SCR-M03-04 pessoa idosa, SCR-M03-05 encerrar (gaveta mais diálogo), SCR-M03-06 elegibilidade ao piloto (cartão do Resumo), SCR-M03-07 exportar dados do titular (aba Consentimentos): todas feitas.
- Perfil sem as abas de outros perfis: gestão 4 abas (Resumo, Plano e cartão, Consentimentos, Histórico), atendimento 6, psicólogo 7, RT 8. A gestão fica com 4 (menos que o 5 a 8 do UX) porque a matriz a proíbe de ver as demais.

## Decisões e suposições

- A lista nunca mostra escore nem faixa (nem para o psicólogo): só "pendente" ou "em dia" com a data. O resultado fica na aba Acompanhamento, que grava log.
- Condições de saúde, medicamentos e compromissos são só consulta (matriz: atendimento `L`, psicólogo `P` sem edição, RT `S`). O que o ERP edita da pessoa idosa é nome, nascimento e dependência (atendimento).
- Exportar CSV da lista traz código, plano, situação, piloto e adesão, sem nome (LP-12), e grava `export`.
- Plano pago por empresa não muda pela ficha: "A mudança é feita pelo contrato".
