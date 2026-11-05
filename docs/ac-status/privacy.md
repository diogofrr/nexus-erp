# Status de aceite: M12 LGPD (`privacy`)

Dev A. Rotas em `/app/lgpd`: `consentimentos`, `termos`, `solicitacoes`, `solicitacoes/:id`, `log`, `incidentes`, `incidentes/novo`, `incidentes/:id`, `politica`, `ripd`, `retencao`. A raiz leva a `consentimentos`. Perfis de teste: `u7` (atendimento registra), `u1` (gestão: leitura do log e execução das ações irreversíveis), `u2` (RT: edita, único que exporta o log e conduz incidentes). O psicólogo não abre o módulo.

| AC | Status | Onde ver (rota e perfil) | Observação |
|---|---|---|---|
| AC-M12-01 | feito | `/app/lgpd/consentimentos`, `u7`: "Histórico" de um titular, "Registrar recusa" em Imagem | Seis consentimentos independentes por titular; recusar um não muda os outros (teste confere). Cada ação grava evento append-only e log |
| AC-M12-02 | feito | `/app/lgpd/consentimentos?visao=revogados`, `u1`; `/app/cuidadores/cg_0016?aba=acompanhamento`, `u4` | CUI-0016 aparece em "Revogados"; a aba Acompanhamento dela fica sem conteúdo e explica o motivo. "Não conta no painel agregado" depende das regras de agregado (`eligibleForAggregates`) usadas por M02 e M06, que não são desta entrega |
| AC-M12-03 | feito | `/app/lgpd/solicitacoes`, `u7`; `/app/lgpd/solicitacoes/dsr_0002` | DSR-0001 "Vence em 5 dias"; DSR-0003 "Vence em breve (2 dias)"; DSR-0002 concluída com "Baixar o arquivo do titular (JSON)". Texto, ícone e cor juntos. Ordem pelo prazo mais próximo |
| AC-M12-04 | feito | `/app/lgpd/solicitacoes/dsr_0001`, `u1` ou `u2`: "Eliminar o que pode ser eliminado" | Diálogo de duas colunas (será eliminado, ficará bloqueado) e digitar `CUI-0018`. Apaga contato e mensagens, bloqueia Zarit e anotações e grava "retido por registro documental por 5 anos; motivo: Res. CFP 1/2009 (a confirmar)". O atendimento só vê "Registrado. Um sócio ou o responsável técnico executa esta etapa." |
| AC-M12-05 | feito | `/app/lgpd/solicitacoes/<DSR de anonimização>`, `u1` ou `u2`: "Anonimizar dados" | Pede o código para confirmar; troca nome, CPF, e-mail e telefone por código; a contagem nos agregados permanece (o registro continua) |
| AC-M12-06 | feito | `/app/lgpd/log`, `u2` (exporta) ou `u1` (só lê) | Filtros por usuário, perfil, ação, titular (pelo código) e período, na URL. Mostra `denied`, `reveal`, `export`, `view` e `supervise` do seed |
| AC-M12-07 | feito | `/app/lgpd/consentimentos`, drawer do titular, "Ver histórico" | Linha do tempo sem editar nem apagar (teste confere que não há esses botões) |
| AC-M12-08 | feito | `/app/lgpd/politica` e `/app/lgpd/ripd`, `u1` ou `u2` | A política mostra a encarregada, o canal do titular, finalidades, bases legais, os seis consentimentos e os direitos. O RIPD lista o risco R10 e as medidas. A política em dois toques, aberta a todos, é a página do rodapé (layout, A-43) |
| AC-M12-09 | feito | `/app/lgpd/incidentes`, `u1` ou `u2` | Incidente do seed (e-mail ao destinatário errado) encerrado, com as duas comunicações e sem nenhum botão de edição |
| AC-M12-10 | feito (no layout) | Rodapé "Meus dados no navegador", `/app/meus-dados`, qualquer perfil da equipe | Tela do layout (não é do `privacy`): digitar APAGAR, limpa as chaves `nexus-erp:` e volta à entrada |
| AC-M12-11 | feito | `u7` em `/app/lgpd/solicitacoes?acao=nova` e `/app/lgpd/log` | O atendimento registra em nome do titular; `log`, `incidentes`, `politica`, `ripd` e `retencao` levam a `/403` e gravam `denied` |
| AC-M12-12 | feito | `/app/lgpd/termos`, `u1` ou `u2` | Três documentos separados e destacados: termo de saúde, termo de imagem e depoimento, contrato de prestação (mais os outros termos), cada um com versão e data. Publicar versão nova deixa consentimentos como "Desatualizado" (LP-06) |

## Telas (SCR-M12)

01 consentimentos, 02 termos, 03 solicitações, 04 solicitação (ações por tipo), 05 log, 06 incidentes (lista, registrar, acompanhar), 07 política, 08 RIPD, 09 retenção (simulação da passagem do tempo): feitas. 10 "Meus dados no navegador": layout.

## Decisões e suposições

- Ações por tipo da solicitação: acesso e portabilidade geram o arquivo do titular (RT completo; atendimento e gestão em pacote selado, A-17); correção grava o valor anterior; anonimizar e eliminar são da gestão e do RT (U-11); revogação usa o diálogo de efeito; informação sobre compartilhamento lista prestadores e empresa; revisão de decisão abre o pedido ao psicólogo do caso. "Bloqueio" não tem efeito distinto no modelo e fica como parte de anonimização.
- Concluir exige nota; rejeitar exige motivo (LP-18); a resposta ao titular sai em bloco copiável.
- Campos acrescentados (só opcionais) em `DataSubjectRequest`: `channel`, `description` e `corrections` (valor anterior).
- Incidente: etapas contido, ANPD, titulares e encerrar; encerrar só com as duas comunicações; checagem de lacuna leva o POP escolhido a `revision_triggered`. O prazo-alvo é de 3 dias úteis.
