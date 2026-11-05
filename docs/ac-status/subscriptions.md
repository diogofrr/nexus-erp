# Status de aceite: M04 Planos, assinaturas e Cartão Nexus (`subscriptions`)

Dev A. Rotas: `/app/assinaturas` (lista), `/app/assinaturas/planos`, `/app/assinaturas/cartoes`, `/app/assinaturas/:id`. A mesma gaveta "Trocar plano" e o mesmo painel de plano e cartão servem à aba Plano e cartão de M03. Perfis de teste: `u7` (atendimento edita), `u1` (gestão edita, vê o cuidador por código), `u2` (RT só lê), `u3` (psicólogo: sem a tela).

| AC | Status | Onde ver (rota e perfil) | Observação |
|---|---|---|---|
| AC-M04-01 | feito | `/app/assinaturas/planos`, `u7` | R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90, nessa ordem; benefícios progressivos nos cartões e tabela de comparação (`[stack]="false"`, "Inclui" e "Não inclui" em texto) |
| AC-M04-02 | feito | `/app/assinaturas/planos`, qualquer perfil com acesso | Não existe "R$ 169,90" nem "Integral" (teste confere o texto da tela) |
| AC-M04-03 | feito | `/app/assinaturas/planos`, `u7` | O cartão do Essencial não lista grupos nem capacitações; Cuida e Sustenta listam. Na tabela o Essencial diz "Não inclui" |
| AC-M04-04 | feito | `/app/assinaturas/<sub de cg_0100>` ou `/app/cuidadores/cg_0100?aba=plano`, `u7`: "Assinar um plano", Essencial | Vale na hora, emite `NX-0000-0000`, toast "Plano alterado para Essencial. Cartão ... emitido." e a tela atualiza |
| AC-M04-05 | feito | `/app/cuidadores/cg_0008?aba=plano`, `u1` ou `u7`: Trocar plano, Essencial | Agenda para o fim do ciclo, mantém o Cuida (e os grupos) até lá. Faixa "Mudança agendada: Cuida para Essencial em ..." (A-18, não "cancelamento"). "Manter o plano atual" desfaz sem diálogo. O efeito lista as turmas que começam depois da data |
| AC-M04-06 | feito | `/app/cuidadores/cg_0007?aba=plano`, `u7`: cancelar; depois relógio simulado (M15) até a data e abrir `/app/assinaturas` | O que venceu pelo relógio passa a valer ao iniciar o aplicativo, sempre que a data (real ou simulada) muda e ao abrir a lista, o detalhe, a ficha ou o cartão: plano vira Livre, cartão `inactive` e o cuidador sai das turmas futuras (M07, AC-M07-09). Não precisa abrir tela nenhuma (`PlanChangeScheduler`) |
| AC-M04-07 | feito | `/app/assinaturas/cartoes`, "Registrar uso do cartão", `u7` ou `u1` | R$ 100,00 a 10% grava R$ 10,00; mostra a prévia do desconto; parceiro `suspended` (Drogaria Popular Central) não aparece |
| AC-M04-08 | feito | `/app/assinaturas`, `u7` | Faixa de totais: 17 assinantes pagos, 7 Essencial, 5 Cuida ("3 pagas pela empresa") e 5 Sustenta |
| AC-M04-09 | feito | `/app/assinaturas/cartoes`, `u7` | Só há linha para quem tem (ou já teve) cartão; Livre sem histórico não aparece. Em `/app/cuidadores/:id?aba=plano` o Livre vê "Cartão Nexus a partir do Essencial" |
| AC-M04-10 | feito | `u7` altera plano; `u3` abre `/app/assinaturas` e vai a `/403` | Gestão também altera. O RT lê sem botões. O psicólogo vê o plano do próprio cuidador só dentro da ficha, sem editar |
| AC-M04-11 | feito | `/app/assinaturas/planos` | Faixa "A mensalidade não inclui serviços da rede nem atendimento psicológico." |

## Telas

- SCR-M04-01 planos, SCR-M04-02 assinaturas (PD-01, filtros na URL, `?filtro=cancelamento-agendado` das notificações), SCR-M04-03 detalhe, SCR-M04-04 cartões, SCR-M04-05 registrar uso (gaveta): feitas.
- SCR-M04-06 (parâmetros dos benefícios) mora em `/app/configuracoes/beneficios`, módulo M15, fora desta entrega.

## Decisões e suposições

- Descer de plano e cancelar valem no fim do ciclo (RN-PLN-14); a descida é guardada como `cancel_scheduled` com `scheduledPlanId` e a tela mostra rótulo próprio. Quando vale, as turmas do Cuida que começam depois saem e a lista de espera é promovida.
- Plano pago por empresa não troca nem cancela (nem sobe): "A mudança é feita pelo contrato"; contrato suspenso tem frase própria.
- A cobrança é simulada: o ciclo das assinaturas pagas avança com o relógio e o valor aparece como "cobrança simulada". Não existe entidade de cobrança.
- O valor médio e o líquido (realizado e referência do plano) aparecem só para a gestão em `/app/assinaturas/planos`.
- Reativar uma assinatura cancelada cria assinatura nova no Livre (só aparece se o estado `cancelled` existir, por exemplo após eliminação ou importação).
