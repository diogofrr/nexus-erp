# Status dos critérios de aceite: M09 Parceiros do Cartão e canal corporativo (`partners`)

Feito pelo Dev C. Rotas: `/app/parceiros` (lista, funil e ficha `:id`) e `/app/empresas` (lista e ficha `:id`). Perfis com acesso: `partner` (escreve) e `support` (só lê). `technical_lead` e `psychologist` caem em `/403`. Testes: 47 em `src/app/features/partners/**` (regras puras, gravação pelo banco, telas, permissões e acessibilidade básica).

## Critérios

| ID | Status | Onde ver (rota e perfil) | Observação |
|---|---|---|---|
| AC-M09-01 | feito | `/app/parceiros/par_0006` (Clínica de Imagem Delta), perfil `partner` | "Ativar parceiro" fica com `aria-disabled` e o motivo escrito ao lado ("Para ativar falta: validação jurídica e validação ética."). Marcar as duas caixas (cada uma grava a data de hoje) libera o botão e o diálogo de efeito ativa o parceiro. A regra vale também ao reativar um suspenso |
| AC-M09-02 | feito | `/app/parceiros`, botão "Novo parceiro" e, na ficha, "Editar dados", perfil `partner` | O formulário só tem 3 modelos: sem remuneração, valor fixo mensal e percentual sobre vendas de produtos e serviços do parceiro. Não há opção por psicólogo nem por atendimento psicológico. Trocar o modelo de um parceiro ativo o devolve à validação (diálogo avisa) |
| AC-M09-03 | feito | `/app/parceiros`, perfis `partner` e `support` | Seed: 5 ativos, 1 em validação jurídica e ética, 1 em prospecção, 1 suspenso, 1 encerrado. O cabeçalho da lista mostra "5 parceiros ativos" e o painel de contagem por estado. O painel do M02 é de outro módulo e deve ler `db.partners` do mesmo jeito |
| AC-M09-04 | feito | `/app/empresas/corp_0001?aba=colaboradores`, perfil `partner` | 5 vagas, 3 ativas e 2 convites em aberto (vaga ocupada = ativa ou convidada). "Convidar colaborador" fica desabilitado com o motivo ao lado. Cancelar um convite libera uma vaga; ao convidar de novo, a próxima é bloqueada. O serviço também recusa (não depende da tela) |
| AC-M09-05 | feito | `/app/empresas/corp_0001?aba=colaboradores`, perfil `partner` | Os 3 colaboradores (CUI-0021, CUI-0022 e CUI-0023) têm assinatura Cuida com pagador "empresa" e contam em `countSubscribers` (K01). "Registrar adesão" liga um convite a um cadastro pelo código, passa a assinatura ao plano da empresa e emite ou reativa o cartão. As telas de M04 e M10 são de outros devs e leem as mesmas assinaturas |
| AC-M09-06 | feito | `/app/empresas/corp_0001` e aba Colaboradores, perfis `partner` e `support` | Só vagas, convites e adesão agregada. Colaborador aparece pelo código pseudonimizado; convite aparece com o e-mail mascarado. A participação em grupos fica "menos de 5 colaboradores ativos" (e, com 5 ou mais, usa `aggregateCount` com mínimo de 5). Nenhuma tela traz nome, escore nem uso do atendimento |
| AC-M09-07 | feito | `/app/empresas/corp_0001`, botão "Encerrar contrato", perfil `partner` | O diálogo descreve o efeito com números (3 colaboradores ao Livre, 3 cartões inativados, 2 convites cancelados). Ao confirmar: assinaturas passam a Livre com pagador próprio, cartões ficam `inactive` com data, vagas viram `removed`, contrato `ended` com data de fim, e cada troca entra em `planChanges` e no log. Remover um colaborador sozinho tem o mesmo efeito para ele |
| AC-M09-08 | feito | `/app/parceiros`, `/app/parceiros/:id`, `/app/empresas`, `/app/empresas/:id`, perfil `support` | Lê tudo. Não vê "Novo parceiro", "Nova empresa", "Editar", caixas de validação, "Próximo passo", convidar nem remover, e o serviço recusa qualquer gravação desse perfil |

## Telas

| Tela | Status | Rota |
|---|---|---|
| SCR-M09-01 Parceiros (lista, funil somente leitura e uso do cartão geral) | feito | `/app/parceiros` (`?estado=`, `?categoria=`, `?visao=funil`) |
| SCR-M09-02 Ficha do parceiro (resumo, uso do cartão, histórico) | feito | `/app/parceiros/:id` (`?aba=uso`, `?aba=historico`) |
| SCR-M09-03 Empresas | feito | `/app/empresas` (`?estado=`) |
| SCR-M09-04 Ficha da empresa (resumo, colaboradores, histórico) | feito | `/app/empresas/:id` (`?aba=colaboradores`, `?aba=historico`) |
| SCR-M09-05 Convidar colaborador | feito | gaveta na aba Colaboradores da ficha da empresa |

## Decisões e suposições de protótipo

- Vaga ocupada é vaga ativa ou convite em aberto. O limite vale para as duas juntas.
- O aceite do convite acontece fora do ERP: "Registrar adesão" simula esse aceite pela gestão, usando só o código `CUI-0000` do cuidador.
- Suspender um contrato corporativo só bloqueia novos convites; os colaboradores ativos mantêm plano e cartão até a decisão sobre o contrato.
- O histórico das fichas mistura as datas gravadas no registro (cadastro, validações, início do contrato) com as alterações feitas na demonstração, lidas do log de acessos.
- A passagem de Prospecção a Ativo sempre pede o passo de validação jurídica e ética (a validação em si só é exigida quando há remuneração).
- Trocar o plano por vaga de um contrato com colaboradores ativos troca o plano deles (com diálogo de efeito e registro em `planChanges`).

## Mudanças em arquivos compartilhados

Nenhuma. O módulo usa só arquivos da própria pasta `src/app/features/partners/`.
