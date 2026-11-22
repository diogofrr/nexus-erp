# Regras de plano, versão 2 (decisão do dono em 06/11 e 11/11/2026)

Substitui, no que conflitar, RN-PLN-04 a 11, RN-GRP-01 a 03 e RN-ATD-03 a 05 de `docs/01-regras-de-negocio.md`. O plano de negócios (Google Docs) já foi atualizado nesse sentido (itens 4.3.4, 4.4, 4.4.1, 4.4.3, 4.7.3 e 4.7.4).

## O que cada plano inclui por mês

| | Livre (R$ 0) | Essencial (R$ 49,90) | Cuida (R$ 119,90) | Sustenta (R$ 149,90) |
|---|---|---|---|---|
| Organização da rotina | básica (agenda, lembretes, remédios) | ampliada | maior suporte | acompanhamento próximo |
| Conteúdos | abertos | abertos e exclusivos | idem | idem |
| Rede credenciada | consulta, compara e pede serviço | + condições especiais | idem | + benefícios diferenciados |
| Cartão Nexus | não | sim | sim | sim |
| Capacitações incluídas | nenhuma (paga avulsa) | 2 por mês | todas do mês | todas do mês |
| Terapia em grupo (= grupo de apoio) | não | não | 2 encontros por mês | 2 encontros por mês |
| Atendimento psicológico individual (on-line ou presencial, à escolha) | não | não | 1 sessão por mês | 2 sessões por mês |

Tabela revista pelo dono em 22/11/2026 (quadro "Os planos" do material da Nexus): Cuida com 1 sessão individual e Sustenta com 2. No Livre a capacitação é só avulsa, nenhuma incluída (correção do dono ao quadro, que mostrava 1 por mês). Preços sem mudança (R$ 0, R$ 49,90, R$ 119,90 e R$ 149,90). Além da cota, a capacitação continua avulsa para qualquer plano.

- **Não existe roda de conversa** (decisão do dono, 22/11/2026): os encontros da Nexus são só capacitação e terapia em grupo. O tipo `open_circle` saiu do código; a migração v3 apaga as rodas e as inscrições delas.
- **Cotas mensais não acumulam.** Cancelamento com menos de 24 h consome a cota (RN-ATD-16).
- **Avulsos**: sessão individual e encontro de terapia em grupo além da cota só para Cuida e Sustenta (valor de referência R$ 120,00 a sessão e R$ 60,00 o encontro de grupo [suposição]); capacitação avulsa para qualquer pessoa com cadastro, em qualquer plano (R$ 40,00 por encontro [suposição]). Pagamento simulado.
- **O atendimento psicológico da equipe não é vendido a quem está no Livre ou no Essencial.** A conduta da Zarit para esses planos (faixas 21 a 60) é: conteúdos, capacitações e encaminhamento à rede pública ou a clínicas-escola (Quadro 15 do plano). O alerta vermelho (61 a 88) continua: contato da equipe no mesmo dia e POP-05, para qualquer plano. **Nada de Zarit vira convite de upgrade** (RN-PLN-19 continua).
- **Quem atende**: os 7 integrantes do grupo (Jessica Rosa, Isabelle Ramos, João Eduardo, Marina Gomes, Maria José, Gustavo Medeiros e Luzia Luzdalma), com CRP fictício no protótipo, sem retirada; a capacidade cresce conforme os integrantes se formam. O financeiro do plano (27 assinantes, mês 7, mês 14) não muda.

## Tipos de atividade (categorização obrigatória)

| Tipo | Chave | Quem conduz | Quem vê e participa |
|---|---|---|---|
| Capacitação | `training` | equipe e profissionais parceiros (orientação, aplicação imediata) | todos os cadastrados; incluída conforme o plano, senão avulsa |
| Terapia em grupo | `group_therapy` | psicólogo da Nexus (psicoterapia, contrato de sigilo, turma de até 12) | só Cuida e Sustenta |

O antigo `support_group` (grupo de apoio) vira `group_therapy`. Não existem outros tipos.

## Regras de exibição ao cuidador (UX, decisão do dono em 11/11)

1. **O app nunca anuncia o que o plano não inclui fora da tela Meu plano.** Sem cartões "Disponível no plano X", sem cadeados em listas, sem "a partir do plano Essencial" em linhas de condição. O que a pessoa não pode usar simplesmente não aparece; o que ela pode usar aparece inteiro.
2. **Eventos que o plano não dá acesso não são listados** (nem como vitrine). Livre e Essencial veem só capacitações (com "incluída" ou o valor avulso); Cuida e Sustenta veem tudo.
3. **Eventos sempre categorizados** por tipo, com seção, ícone e cor próprios, e filtro quando há mais de um tipo.
4. **Nada de texto solto**: toda página é cabeçalho (título e, no máximo, uma linha), seções com título e cartões. Aviso de protótipo só no rodapé. Aviso de emergência só em Ajuda agora, Conversar com um psicólogo e Como estou.
5. Meu plano é o único lugar que explica os planos e as diferenças, com calma e sem urgência.
