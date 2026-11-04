# Nexus ERP: escopo do ERP

Documento do PM, derivado **somente** das regras do `01-regras-de-negocio.md` (citadas como `RN-...`). É a fonte única para UI, UX, Dev, QA e CS/CX, junto com `00-contexto.md`. Onde o catálogo é omisso, a decisão está marcada `[suposição]` e consolidada na seção 8.

## 0. Visão e convenções

### 0.1 O que é o ERP
Back-office da empresa Nexus (cuidado ao cuidador familiar de pessoas idosas, Uberlândia) mais o **Portal do Profissional Credenciado**. O aplicativo do cuidador **não** faz parte deste escopo (seção 8); o ERP guarda e administra os dados que ele geraria. Protótipo de front-end Angular: sem servidor, dados em `localStorage` (prefixo `nexus-erp:`), sessão em `sessionStorage`, tudo por serviços de repositório tipados.

### 0.2 Convenções deste documento
| Item | Convenção |
|---|---|
| Módulos | `M01` a `M15` |
| Telas | `SCR-Mxx-nn`, com rota sugerida (Angular, lazy por feature) |
| Critérios de aceite | `AC-Mxx-nn` (módulo) e `AC-GL-nn` (transversais). Cada um é uma frase verificável, no formato "dado, quando, então" compacto |
| Perfis | `partner` (Sócio/Gestão), `technical_lead` (Responsável técnico), `psychologist` (Psicólogo(a) da Nexus), `support` (Atendimento/Relacionamento), `provider` (Profissional credenciado) |
| Identificadores de código | Inglês; textos de tela em pt-BR (`00-contexto.md`) |
| Datas e valores | `04/11/2026`; `R$ 49,90`; dinheiro guardado em centavos inteiros |
| "Hoje" (D0) | Vem do serviço `Clock`: data do sistema ou, se definida em M15, a data simulada. Toda regra de prazo usa o `Clock`, nunca `Date.now()` direto |

### 0.3 Critérios de aceite transversais (valem para todos os módulos)
- [ ] **AC-GL-01** Toda lista tem estado vazio com texto acolhedor e ação sugerida, estado de carregamento e contagem de resultados.
- [ ] **AC-GL-02** Todo dinheiro aparece como `R$ 1.234,56`; toda data como `dd/MM/aaaa`; hora `HH:mm`; percentuais com vírgula e uma casa decimal quando fracionários.
- [ ] **AC-GL-03** Nenhum componente lê ou grava `localStorage` ou `sessionStorage` direto; tudo passa pelos repositórios. Chaves sempre com prefixo `nexus-erp:`.
- [ ] **AC-GL-04** Toda rota exige sessão; rota sem permissão leva a `SCR-M01-05` (acesso negado) e grava `denied` no log (RN-LGPD-12).
- [ ] **AC-GL-05** Aviso de protótipo visível no rodapé de toda tela e na entrada: "Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador" (RN-LGPD-25).
- [ ] **AC-GL-06** Layout responsivo de 360 px a 1440 px, sem rolagem horizontal da página; tabelas largas viram cartões ou rolam dentro do próprio contêiner.
- [ ] **AC-GL-07** Contraste mínimo de 4,5:1 em texto; foco visível; todo controle operável por teclado; formulários com rótulos e mensagens de erro ligadas ao campo.
- [ ] **AC-GL-08** Nenhum texto contém travessão (nem o longo nem o médio), "guerreira", "anjo", promessa de resultado terapêutico ou jargão clínico desnecessário (RN-ETICA-15).
- [ ] **AC-GL-09** Ações destrutivas ou irreversíveis (encerrar cadastro, descredenciar, anonimizar, eliminar, resetar demonstração) pedem confirmação com descrição do efeito.
- [ ] **AC-GL-10** Ações que gravam dado sensível geram linha de log com usuário, perfil, ação, entidade e data/hora.
- [ ] **AC-GL-11** Nenhuma requisição de rede para fora do navegador em tempo de execução (sem analytics, sem API externa).
- [ ] **AC-GL-12** Dados 100% fictícios: CPF inválido e marcado, e-mails `@exemplo.com.br`, telefones `(34) 90000-0000` a `(34) 90000-0999`.

---

## 1. Perfis (RBAC)

### 1.1 Perfis
| Perfil (`Role`) | Quem é (RN) | Função no ERP |
|---|---|---|
| `partner` Sócio/Gestão | Sócios e gestão do negócio e da plataforma (RN-ORG-02) | Decide o comercial: planos, rede, parcerias, finanças, comunicação. **Não decide o técnico** (RN-ORG-01, RN-ETICA-06). Vê saúde só pseudonimizada e agregada |
| `technical_lead` Responsável técnico | Psicólogo inscrito no CRP-04 (RN-ATD-06, RN-ORG-02) | Supervisão técnica de todos os casos, POP-05, POP-07, POP-09, parâmetros da ARBE, validação ética |
| `psychologist` Psicólogo(a) da Nexus | Equipe que atende (RN-ATD-01) | Agenda, sessões, anotações sigilosas, Zarit e alertas **dos seus** cuidadores |
| `support` Atendimento/Relacionamento | Gestão do relacionamento com usuários (RN-ORG-02) | Cadastros, assinaturas, caixa de mensagens, reclamações, solicitações do titular. **Sem dado clínico** |
| `provider` Profissional credenciado | Prestador da rede, exemplo principal: cirurgião-dentista com CRO (RN-REDE-15) | Portal: seu perfil, solicitações, sua nota, seus documentos. Vê só o mínimo necessário do usuário (RN-LGPD-08) |

### 1.2 Matriz de permissões por módulo
Legenda: `-` sem acesso. `L` leitura. `E` leitura e edição (criar, editar; sem excluir). `T` total (inclui arquivar, excluir ou decidir quando a regra permitir). `A` somente **agregado ou pseudonimizado** (códigos `CUI-0000`, contagens, médias; nunca nome, contato nem texto livre). `P` somente registros **próprios** ou **atribuídos**. `C` conteúdo **clínico** (restrito ao caso). `S` **supervisão**: leitura de todos os casos, com log obrigatório e justificativa; sem editar anotação de outro psicólogo.

| Módulo / recurso | partner | technical_lead | psychologist | support | provider |
|---|---|---|---|---|---|
| M01 Acesso e perfis | L (próprio) | L (próprio) | L (próprio) | L (próprio) | L (próprio) |
| M02 Painel | T (o seu) | T (o seu) | T (o seu) | T (o seu) | T (o seu, no portal) |
| M03 Cuidadores e pessoas idosas, dados cadastrais | A | S | P (seus cuidadores) | E | - |
| M03 Pessoa idosa, medicamentos e agenda de cuidados | - | S | P | L | - |
| M04 Planos, assinaturas e Cartão Nexus | T | L | L (plano do próprio cuidador) | E | - |
| M05 Agenda e sessões (sem conteúdo clínico) | A (horas) | L | P (E) | E (agendar em nome do usuário) | - |
| M05 Anotações sigilosas de sessão | - | S | C (autor) | - | - |
| M05 Ocupação e horas | L | L | P | - | - |
| M05 Salas do coworking | E | L | L | L | - |
| M06 Zarit e alertas, individual | - | S | C | - | - |
| M06 Zarit e ARBE, agregado | A | A | A (seus casos) | - | - |
| M06 Parâmetros da ARBE | L | T | L | - | - |
| M07 Grupos e capacitações | T | E (valida enquadramento) | E (seus grupos) | E (inscrições) | - |
| M08 Rede credenciada (credenciamento, ARP, auditoria, descredenciamento) | T | L (valida psicólogos da rede) | - | L (e E só para registrar solicitações e avaliações em nome do usuário, RN-CAN-05) | P (próprio, via M14) |
| M09 Parceiros do Cartão e canal corporativo | T | - | - | L | - |
| M10 Financeiro e indicadores | T | A (indicadores clínicos agregados) | A (seus casos) | L (operacionais: SLA, reclamações) | - |
| M11 Caixa de mensagens | T | L (casos de risco) | P (mensagens dos seus cuidadores) | T | P (mensagens com a Nexus) |
| M11 Reclamações | T | L (graves e POP-07) | - | T | P (as que o citam, sem identificar o cuidador) |
| M12 LGPD: consentimentos e solicitações do titular | T | E | - | E (registrar em nome do titular) | - |
| M12 LGPD: log de auditoria, incidentes, RIPD, política | L | T | - | - | - |
| M13 Governança: POPs, riscos, encaminhamentos, formação | T | T | L | L | L (POPs da integração) |
| M13 Ocorrências POP-05 e POP-07 | A (contagens) | T | C (seus casos) | - | - |
| M14 Portal do profissional | - | - | - | - | T (próprio) |
| M15 Configurações e dados de demonstração | T | E (apenas ARBE e conteúdos) | - | - | - |

### 1.3 O que cada perfil NÃO pode ver (regras de bloqueio)
| Perfil | Não pode ver, em hipótese alguma |
|---|---|
| `partner` | Nome, contato e CPF completos de cuidador em telas de saúde; escore de Zarit individual; alertas individuais; anotações; ocorrências; texto livre de reclamação que identifique o titular. Vê **códigos** e **agregados** (com mínimo de 5 por recorte, RN-KPI-02) |
| `technical_lead` | Valores financeiros detalhados (receita, custos, saldo); dados de prestadores além do necessário para validar psicólogos da rede |
| `psychologist` | Cuidadores atribuídos a outro psicólogo (a não ser por redistribuição formal); finanças; credenciamento; log de auditoria |
| `support` | Escore de Zarit, faixa, alertas ARBE, anotações, ocorrências POP-05 e POP-07 (nem "existe alerta"). Vê apenas se a aplicação da escala está "pendente" ou "em dia" (data de vencimento), sem resultado `[suposição]` |
| `provider` | Qualquer dado clínico, escore, faixa ARP dos outros prestadores, identificação do cuidador que o avaliou, dados de outros prestadores, finanças. Do usuário atendido vê só: nome, contato, necessidade do serviço, endereço quando domiciliar, e somente enquanto a solicitação estiver `accepted`, e só se tiver a cláusula de proteção de dados assinada (RN-LGPD-13) |
| Todos | Dados de outro perfil que a matriz marque com `-`. Link direto para recurso proibido mostra `SCR-M01-05` sem revelar se o recurso existe |

### 1.4 Sessão e login simulado (M01)
- Login é **seleção de perfil de demonstração**. Não há senha real.
- Perfis `partner`, `technical_lead`, `psychologist` e `support` exigem **verificação em dois fatores simulada** (RN-LGPD-15): o sistema exibe na tela um código de 6 dígitos (`123456`) e pede para digitá-lo. `provider` não é equipe: entra sem segundo fator `[suposição]`.
- Sessão em `sessionStorage` (`nexus-erp:session`): fecha com a aba. Expira por inatividade em 30 minutos `[suposição]`, com aviso 2 minutos antes.
- Trocar de perfil = encerrar sessão e escolher outro. Cada login e logout geram log.

---

## 2. Mapa de módulos

| ID | Módulo | Rota base | Perfis com acesso | Regras principais |
|---|---|---|---|---|
| M01 | Acesso e perfis | `/login`, `/403` | todos | LGPD-11, 12, 15, 25 |
| M02 | Painel por perfil | `/app/painel` | todos (o seu) | KPI-*, EQP, ARBE |
| M03 | Cuidadores e pessoas idosas | `/app/cuidadores` | partner(A), RT, psy, support | USR-*, LGPD-* |
| M04 | Planos, assinaturas e Cartão Nexus | `/app/assinaturas` | partner, RT(L), support | PLN-*, CRT-* |
| M05 | Atendimento psicológico | `/app/atendimento` | RT, psy, support, partner(A) | ATD-*, EQP-* |
| M06 | Zarit e ARBE | `/app/acompanhamento` | RT, psy, partner(A) | ZRT-*, ARBE-*, POP-05 |
| M07 | Grupos e capacitações | `/app/grupos` | partner, RT, psy, support | GRP-* |
| M08 | Rede credenciada | `/app/rede` | partner, RT(L), support(L) | REDE-*, ARP-*, POP-02 |
| M09 | Parceiros e canal corporativo | `/app/parceiros`, `/app/empresas` | partner, support(L) | CRT-*, CORP-* |
| M10 | Financeiro, indicadores e piloto | `/app/financeiro`, `/app/indicadores`, `/app/piloto` | partner, RT(A), psy(A) | FIN-*, KPI-*, PIL-* |
| M11 | Mensagens e reclamações | `/app/mensagens`, `/app/reclamacoes` | support, partner, RT(L) | CAN-*, POP-08 |
| M12 | LGPD | `/app/lgpd` | partner, RT, support | LGPD-* |
| M13 | Governança: POPs, riscos, encaminhamentos, formação | `/app/governanca` | partner, RT; leitura geral | POP-*, RISCO-*, ENC-*, CAP-* |
| M14 | Portal do profissional credenciado | `/portal` | provider | REDE-*, ARP-18 |
| M15 | Configurações e dados de demonstração | `/app/configuracoes` | partner, RT(E) | todas as suposições |

Fusões e divisões em relação à lista inicial: "Parceiros e canal corporativo" ficou no M09; o piloto (PIL) e os indicadores de People Analytics ficaram no M10; CAP, POPs, riscos e encaminhamentos formam o M13 (a lista inicial não tinha esse módulo e as regras RISCO, POP, ENC e CAP precisam de casa).

---

## 3. Módulos

Entidades citadas estão definidas na seção 4 (modelo de dados). "Regras" lista os RN do catálogo que o módulo implementa.

### M01 Acesso e perfis

**Objetivo.** Entrada simulada por perfil de demonstração, com dois fatores simulado para a equipe, sessão em `sessionStorage` e bloqueio por rota (RBAC).
**Usuários.** Todos.
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M01-01 Entrada | `/login` | Aviso de protótipo; banner de uso de armazenamento local (LP-01); cartões dos 12 usuários de demonstração (nome fictício, perfil, descrição em uma frase); botão "Entrar como..." |
| SCR-M01-02 Segundo fator | `/login/2fa` | Código de 6 dígitos exibido na tela; campo de confirmação; "voltar" |
| SCR-M01-03 Sair e trocar perfil | menu do usuário | Encerra sessão e volta à entrada |
| SCR-M01-04 Sessão expirando | modal | Aviso 2 minutos antes dos 30 de inatividade; "continuar" ou "sair" |
| SCR-M01-05 Acesso negado | `/403` | Texto neutro, sem revelar o recurso; botão para o painel |
| SCR-M01-06 Não encontrado | `**` | Página 404 com link ao painel |

**Entidades.** `AppUser`, `Session`, `AccessLogEntry`.
**Estados.** `anonymous` para `pending_2fa` (se perfil exige) para `authenticated`; `authenticated` para `expiring` para `expired` ou `authenticated`; qualquer um para `anonymous` por logout.
**Ações.** Selecionar perfil; confirmar código; sair; trocar perfil; estender sessão.
**Validações.** Código: exatamente 6 dígitos numéricos e igual ao exibido; três erros seguidos voltam à tela de entrada; sessão só existe em `sessionStorage`; usuário inativo não entra.
**Regras.** RN-LGPD-11, 12, 15, 25.
**Critérios de aceite.**
- [ ] AC-M01-01 A entrada lista exatamente os 12 usuários de demonstração do seed (seção 5.1) com perfil e descrição.
- [ ] AC-M01-02 Entrar como `partner`, `technical_lead`, `psychologist` ou `support` exige o código; entrar como `provider` não exige.
- [ ] AC-M01-03 Código errado mostra erro no campo e não entra; o terceiro erro seguido volta a SCR-M01-01.
- [ ] AC-M01-04 Fechar a aba e reabrir exige novo login (sessão em `sessionStorage`).
- [ ] AC-M01-05 Cada login, logout e acesso negado cria linha no log com perfil e horário.
- [ ] AC-M01-06 Digitar na barra de endereço uma rota de outro perfil (por exemplo, `provider` abrindo `/app/financeiro`) mostra SCR-M01-05 e registra `denied`.
- [ ] AC-M01-07 Após 28 minutos sem interação aparece o aviso de expiração; aos 30 a sessão encerra.
- [ ] AC-M01-08 O menu lateral mostra apenas os módulos permitidos ao perfil (matriz 1.2).

### M02 Painel por perfil

**Objetivo.** Primeira tela de cada perfil, com o que exige ação hoje e os indicadores do seu escopo, nunca além dele.
**Usuários.** Todos, cada um o seu painel.
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M02-01 Painel | `/app/painel` (`/portal` para provider) | Conteúdo por perfil, tabela abaixo |
| SCR-M02-02 Busca global | atalho `Ctrl+K` ou campo no topo | Busca em cuidadores, prestadores, parceiros, atividades; respeita RBAC e mostra só campos permitidos |
| SCR-M02-03 Notificações | sino no topo | Lista de pendências geradas pelo sistema (vencimentos, alertas) do perfil, com "marcar como visto" |

Conteúdo por perfil:
| Perfil | Blocos (fórmulas na seção 7) |
|---|---|
| `partner` | Assinantes por plano; usuários gratuitos; conversão; resultado do mês e ponto de equilíbrio; projeção versus plano; rede (prestadores por faixa, risco de saída, credenciamentos pendentes); equipe (ocupação, alerta de sobrecarga); alertas **agregados** (contagens); SLA; reclamações; solicitações LGPD a vencer; POPs a revisar; riscos prioritários |
| `technical_lead` | Alertas vermelhos e amarelos abertos (todos os casos); vermelhos vencidos; ARBE abertos; ocorrências POP-05 e POP-07; conteúdos aguardando revisão (POP-09); POPs a revisar; ocupação da equipe; validações pendentes |
| `psychologist` | Minha agenda de hoje; minha fila de acompanhamento (alertas, Zarit vencendo); sessões a registrar; minha ocupação do mês; tarefas "revisar rede de apoio" |
| `support` | Fila de mensagens por SLA (atrasadas primeiro); reclamações abertas; solicitações de serviço sem retorno; solicitações do titular a registrar; cadastros novos; assinaturas com cancelamento agendado |
| `provider` | Solicitações novas; minha nota ARP e faixa em linguagem neutra; taxa de recusa em 30 dias; documentos a vencer; próximos serviços; integração pendente |

**Entidades.** Leitura de todas; `Notification`.
**Estados.** Notificação: `unread`, `seen`, `resolved` (some quando a causa some).
**Ações.** Abrir item (leva à tela do módulo); marcar notificação como vista; buscar.
**Validações.** Cada bloco só consulta dados que o perfil pode ver; contagens para `partner` respeitam mínimo de 5 por recorte (RN-KPI-02).
**Regras.** RN-KPI-*, EQP-02, ZRT-14, ARBE-07, REDE-28, LGPD-21.
**Critérios de aceite.**
- [ ] AC-M02-01 Cada perfil vê só os blocos da tabela acima; `partner` nunca vê nome de cuidador em bloco de saúde.
- [ ] AC-M02-02 No seed, o painel do `technical_lead` mostra pelo menos: 1 alerta vermelho do dia sem contato, 1 vermelho vencido, 2 amarelos abertos, 1 ARBE `critical`.
- [ ] AC-M02-03 O painel do `partner` mostra 17 assinantes, conversão 5,0% e "faltam 10 para o ponto de equilíbrio" (seção 5.14).
- [ ] AC-M02-04 O painel do `psychologist` Rafael Moreira (seed) mostra alerta de sobrecarga de agenda; o de Beatriz Nogueira não.
- [ ] AC-M02-05 O painel do `support` destaca mensagens `overdue` no topo com o tempo de atraso.
- [ ] AC-M02-06 O painel do `provider` (dentista) mostra a sua nota e a faixa só como "em destaque" ou "em acompanhamento", sem números de outros prestadores.
- [ ] AC-M02-07 A busca global por "Ana" para `support` devolve cuidadores; para `partner` devolve apenas códigos pseudonimizados; para `provider` não devolve cuidadores.
- [ ] AC-M02-08 Cada item de painel leva à tela correta do módulo com o filtro aplicado.

### M03 Cuidadores e pessoas idosas

**Objetivo.** Cadastro e acompanhamento administrativo do cuidador (cliente) e da pessoa idosa, plano gratuito, piloto e encerramento.
**Usuários.** `support` (edita), `psychologist` e `technical_lead` (leem/supervisionam), `partner` (vê pseudonimizado).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M03-01 Lista | `/app/cuidadores` | Busca por código, nome (conforme perfil), plano, status, piloto, cidade; paginação (340 registros no seed); exportar CSV da lista visível (sem dados sensíveis) |
| SCR-M03-02 Novo cuidador | `/app/cuidadores/novo` | Formulário em etapas: cuidador, pessoa idosa, consentimentos, plano (Livre por padrão), resumo |
| SCR-M03-03 Perfil | `/app/cuidadores/:id` | Abas: Resumo; Pessoa idosa; Cuidados (medicamentos e compromissos, leitura); Plano e cartão; Acompanhamento (Zarit, só psy e RT); Atendimento (só psy e RT); Consentimentos; Pedidos de serviço; Mensagens; Histórico e log |
| SCR-M03-04 Pessoa idosa | `/app/cuidadores/:id/idoso` | Dados, grau de dependência, medicamentos, compromissos |
| SCR-M03-05 Encerrar cadastro | modal em SCR-M03-03 | Fluxo POP-10: motivo, resumo do que será eliminado e do que ficará bloqueado (RN-LGPD-24) |
| SCR-M03-06 Elegibilidade ao piloto | aba Resumo | Checagem dos três critérios (RN-PIL-04) com resultado |
| SCR-M03-07 Exportar dados do titular | aba Consentimentos | Gera JSON (portabilidade) |

**Entidades.** `Caregiver`, `Elder`, `Medication`, `CareAppointment`, `WellbeingCheck`, `PilotEnrollment` (ver 4).
**Estados.** Cadastro: `active` para `paused_by_consent_revocation` (revogação do consentimento de saúde, volta a `active` se reconcedido) ; `active` ou `paused...` para `closure_requested` para `closed` (final) (RN-USR-17).
**Ações.** Criar; editar; atribuir psicólogo responsável (RT); marcar/desmarcar piloto (exige TCLE ativo); pedir encerramento; exportar JSON; revelar dado mascarado (com justificativa e log); registrar horas diárias de cuidado.
**Validações.**
- Nome completo obrigatório; **maioridade (18 anos ou mais)** pela data de nascimento (RN-USR-14).
- CPF: formato `000.000.000-00` e **dígitos verificadores inválidos** (o sistema **rejeita CPF válido** com a mensagem "Parece um CPF real. Use um CPF fictício"); botão "Gerar CPF fictício"; campo `cpfIsFictitious` sempre `true` (AC-GL-12).
- E-mail termina em `@exemplo.com.br`; telefone no padrão `(34) 90000-0000` a `(34) 90000-0999`.
- Horas diárias de cuidado: inteiro de 0 a 24 (RN-USR-04).
- Pessoa idosa vinculada a **um** cuidador principal (RN-USR-10); grau de dependência obrigatório.
- Piloto só com os três critérios: cuidador principal, dependência `partial` ou `total`, cidade Uberlândia, e TCLE ativo (RN-PIL-04, RN-USR-12, 13).
- Consentimento de saúde ausente: a aba Acompanhamento mostra "sem consentimento" e não permite aplicar Zarit.
**Regras.** RN-USR-01 a 20, RN-PLN-02, RN-PIL-04, 10, RN-LGPD-03 a 06, 08, 14, 24, 26.
**Critérios de aceite.**
- [ ] AC-M03-01 Criar cuidador com CPF matematicamente válido é rejeitado; com CPF fictício é aceito.
- [ ] AC-M03-02 Cadastro novo nasce no plano Livre, sem Cartão Nexus, com os 6 consentimentos em "pendente".
- [ ] AC-M03-03 Menor de 18 anos é rejeitado; exatamente 18 anos completos hoje é aceito.
- [ ] AC-M03-04 Para `partner`, a lista mostra `CUI-0042`, plano e status, **sem** nome, CPF, telefone nem e-mail; não há botão "revelar".
- [ ] AC-M03-05 Para `support`, CPF aparece mascarado `***.***.***-**`; "mostrar" pede justificativa e gera log `reveal`.
- [ ] AC-M03-06 `support` abrindo o perfil não vê as abas Acompanhamento e Atendimento (ou as vê bloqueadas sem conteúdo).
- [ ] AC-M03-07 `psychologist` Rafael Moreira só lista os cuidadores atribuídos a ele; abrir outro por URL leva a SCR-M01-05.
- [ ] AC-M03-08 `technical_lead` abre qualquer perfil e cada abertura da aba Acompanhamento gera log `view` com perfil `S`.
- [ ] AC-M03-09 Marcar piloto num cuidador sem TCLE ativo é bloqueado com a lista dos critérios que faltam; no cuidador de Uberaba com pessoa idosa independente a elegibilidade mostra os 2 critérios reprovados.
- [ ] AC-M03-10 Revogar consentimento de saúde (M12) muda o status para `paused_by_consent_revocation` e a aba Acompanhamento mostra o motivo.
- [ ] AC-M03-11 Pedir encerramento mostra a lista do que será eliminado e do que será bloqueado por registro documental; confirmar muda o status para `closure_requested` e cria solicitação POP-10.
- [ ] AC-M03-12 A lista pagina 340 registros e filtra por plano com resposta em menos de 1 segundo.
- [ ] AC-M03-13 Exportar JSON do titular baixa um arquivo com cadastro, pessoa idosa, consentimentos, assinaturas, Zarit, solicitações e mensagens do cuidador, e nada de outros titulares.
- [ ] AC-M03-14 Atribuir psicólogo responsável é permitido ao `technical_lead` e negado ao `support`.

### M04 Planos, assinaturas e Cartão Nexus

**Objetivo.** Catálogo dos 4 planos, gestão de assinaturas (troca, cancelamento) e emissão/uso do Cartão Nexus.
**Usuários.** `partner` (total), `support` (edita), `technical_lead` (lê).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M04-01 Planos | `/app/assinaturas/planos` | Comparativo da Figura 1 (A.1 do catálogo), preços, benefícios progressivos, cores do plano; aviso de que a mensalidade não inclui serviços da rede nem atendimento psicológico (RN-PLN-22) |
| SCR-M04-02 Assinaturas | `/app/assinaturas` | Lista com plano, status, pagador (próprio ou empresa), início, próximo ciclo; filtros; totais por plano |
| SCR-M04-03 Detalhe da assinatura | `/app/assinaturas/:id` | Histórico de trocas, cartão, ações de upgrade, downgrade, cancelar, reativar |
| SCR-M04-04 Cartões | `/app/assinaturas/cartoes` | Lista de cartões com número, status; uso por parceiro; economia gerada |
| SCR-M04-05 Registrar uso do cartão | modal | Parceiro, data, valor, desconto calculado |
| SCR-M04-06 Parâmetros dos benefícios | `/app/configuracoes/beneficios` | Desconto da sessão por plano, prioridade de agenda (RN-ATD-05, PLN-21) |

**Entidades.** `Plan`, `Subscription`, `PlanChange`, `BenefitCard`, `CardUsage`.
**Estados.** `Subscription.status`: `active` para `cancel_scheduled` para `cancelled`; `cancel_scheduled` volta a `active` (desistência) antes do fim do ciclo; `cancelled` para nova assinatura (reativar cria nova). Livre: sempre `active`, sem cobrança. Cartão: `active` quando existe assinatura paga `active` ou `cancel_scheduled`; `inactive` depois.
**Ações.** Upgrade (imediato; cobrança do novo valor no próximo ciclo); downgrade e cancelamento (fim do ciclo); desistir do cancelamento; emitir cartão (automático ao assinar plano pago); registrar uso do cartão.
**Validações.** Para `partner`, o cuidador aparece sempre por código (`CUI-0000`), sem nome nem contato; Livre não tem cartão (RN-CRT-02); troca para o mesmo plano é bloqueada; assinatura paga por empresa não pode ser cancelada pelo cuidador (só pelo contrato, M09); desconto do cartão vem do parceiro (RN-CRT-11); registrar uso só em parceiro `active`.
**Regras.** RN-PLN-01 a 22, RN-CRT-01 a 12.
**Critérios de aceite.**
- [ ] AC-M04-01 O catálogo mostra exatamente R$ 0,00, R$ 49,90, R$ 119,90 e R$ 149,90, nessa ordem, e a progressão de benefícios da Figura 1 (A.1).
- [ ] AC-M04-02 A tela não mostra "R$ 169,90" nem plano "Integral" em lugar nenhum.
- [ ] AC-M04-03 Grupos e capacitações aparecem a partir do Cuida; o Essencial não os mostra.
- [ ] AC-M04-04 Fazer upgrade de Livre para Essencial emite o cartão na hora e muda o plano na hora.
- [ ] AC-M04-05 Downgrade de Cuida para Essencial vale no fim do ciclo (status `cancel_scheduled` do plano atual) e mantém grupos até lá.
- [ ] AC-M04-06 Cancelar plano pago agenda o cancelamento; no fim do ciclo (use o relógio simulado) o cartão fica `inactive` e o plano vira Livre.
- [ ] AC-M04-07 Registrar uso de R$ 100,00 em parceiro com 10% grava desconto de R$ 10,00; parceiro `suspended` não aparece na lista.
- [ ] AC-M04-08 O total de assinaturas pagas no seed é 17: 7 Essencial, 5 Cuida (3 pagas pela empresa), 5 Sustenta.
- [ ] AC-M04-09 Usuário Livre não tem linha em Cartões.
- [ ] AC-M04-10 `support` altera plano; `psychologist` não vê a tela.
- [ ] AC-M04-11 A tela de planos exibe o aviso "A mensalidade não inclui serviços da rede nem atendimento psicológico".

### M05 Atendimento psicológico

**Objetivo.** Agenda dos psicólogos da Nexus, sessões on-line e presenciais, anotações sigilosas, salas acessíveis e ocupação (EQP).
**Usuários.** `psychologist` (os seus), `technical_lead` (supervisão), `support` (agenda em nome do usuário), `partner` (horas agregadas).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M05-01 Agenda | `/app/atendimento/agenda` | Semana e mês; vagas abertas, reservadas, bloqueadas; filtro por psicólogo e modalidade |
| SCR-M05-02 Disponibilidade | `/app/atendimento/disponibilidade` | Psicólogo define vagas de 1 hora, marca vagas "prioritárias" (RN-ATD-12) |
| SCR-M05-03 Agendar sessão | modal | Cuidador, vaga, modalidade, sala ou endereço; mostra valor e desconto do plano (RN-ATD-05) |
| SCR-M05-04 Detalhe da sessão | `/app/atendimento/sessoes/:id` | Estado, checklist de pertinência remota ou de domicílio, ações de transição |
| SCR-M05-05 Anotação da sessão | `/app/atendimento/sessoes/:id/anotacao` | Texto sigiloso, classificação psicoterapia ou orientação, assinar, adendo |
| SCR-M05-06 Ocupação | `/app/atendimento/ocupacao` | Por psicólogo e mês: disponibilizadas, realizadas, %, alerta de dois meses acima de 80% |
| SCR-M05-07 Redistribuir | modal em SCR-M05-06 | Transferir sessões futuras e cuidadores para outro psicólogo, com motivo |
| SCR-M05-08 Salas | `/app/atendimento/salas` | Salas do coworking e quatro atributos de acessibilidade (RN-ATD-10) |
| SCR-M05-09 Fila de acompanhamento | `/app/atendimento/fila` | Cuidadores do psicólogo, ordenados por prioridade (vermelho, amarelo, Zarit vencida) |

**Entidades.** `PsychologistProfile`, `AvailabilitySlot`, `Session`, `SessionNote`, `Room`, `PsychologistMonthSummary`, `OccupancyView` (calculada).
**Estados.** `Session.status`: `scheduled` para `confirmed` (até 24 horas antes), `cancelled_by_user`, `cancelled_by_psychologist`; `confirmed` para `done`, `no_show`, cancelamentos. Final: `done`, `no_show`, cancelamentos. `SessionNote`: `draft` para `signed` (imutável; correção por adendo).
**Ações.** Abrir/fechar vagas; agendar; confirmar; cancelar (24 horas); marcar realizada; marcar falta; escrever, assinar e adendar anotação; redistribuir; reservar sala; calcular ocupação.
**Validações.**
- Vaga já reservada não pode receber outra sessão.
- Sessão `in_person_coworking` exige sala com **os 4 atributos de acessibilidade** verdadeiros (RN-ATD-10).
- Sessão `in_person_home` exige o checkbox "domicílio adequado e seguro" (RN-ATD-09).
- Sessão `online` exige "formato remoto é pertinente" confirmado pelo psicólogo para ser marcada `done` (RN-ATD-07); se o psicólogo marcar "há risco, violência ou urgência", o sistema exige encaminhamento à rede presencial e abre ocorrência POP-05 (M13).
- Psicólogo precisa de CRP ativo (RN-ATD-06); sem CRP ativo não aparece na agenda.
- Cancelar com menos de 24 horas vira `no_show` (RN-ATD-16).
- Só sessão `done` conta como hora realizada (RN-ATD-15).
- Anotação assinada não pode ser editada; só recebe adendo com data e hora.
- A fila de acompanhamento põe cuidador em alerta amarelo no topo e usa vagas prioritárias (RN-ATD-12).
- A classificação `psychotherapy` ou `guidance` é obrigatória e aparece ao usuário (RN-ATD-19).
**Regras.** RN-ATD-01 a 20, RN-EQP-01 a 09, RN-ETICA-02 a 04, RN-LGPD-16.
**Critérios de aceite.**
- [ ] AC-M05-01 Rafael Moreira (seed) mostra ocupação de 86,3% (mês -2) e 91,3% (mês -1) e o alerta "agenda acima de 80% por dois meses seguidos".
- [ ] AC-M05-02 Letícia Amaral (80,0% e 80,0%) **não** dispara o alerta (limite é estritamente maior que 80).
- [ ] AC-M05-03 Beatriz Nogueira (85,0% e 70,0%) não dispara alerta (não são dois meses seguidos).
- [ ] AC-M05-04 Tiago Brandão, com mês -2 sem agenda, mostra "n/d" no mês -2 e nenhum alerta.
- [ ] AC-M05-05 O mês corrente aparece como "parcial" e não entra na regra dos dois meses.
- [ ] AC-M05-06 Redistribuir de Rafael para Tiago transfere sessões futuras e cuidadores, grava motivo e a ocupação de Rafael cai no cálculo seguinte; o log registra a transferência.
- [ ] AC-M05-07 Sessão presencial no coworking com sala que tem 3 dos 4 atributos de acessibilidade é bloqueada.
- [ ] AC-M05-08 Marcar sessão on-line como realizada sem confirmar "formato remoto pertinente" é bloqueado.
- [ ] AC-M05-09 Cancelar a menos de 24 horas muda o estado para `no_show`; a mais de 24 horas, para `cancelled_by_user`.
- [ ] AC-M05-10 Anotação assinada não tem botão "editar"; "adendo" cria registro datado.
- [ ] AC-M05-11 `support` agenda a sessão de um cuidador sem acessar nenhuma anotação nem a aba clínica.
- [ ] AC-M05-12 `psychologist` não consegue abrir anotação de sessão de outro psicólogo (SCR-M01-05); `technical_lead` consegue e gera log de supervisão.
- [ ] AC-M05-13 Cuidador do plano Cuida ou Sustenta, ou em alerta amarelo (inclusive no Livre, como C03), vê as vagas prioritárias; cuidador Livre sem alerta não vê.
- [ ] AC-M05-14 O valor da sessão mostra o desconto do plano (0%, 10%, 15%, 20%) conforme M15.
- [ ] AC-M05-15 `partner` vê horas por psicólogo (disponibilizadas, realizadas, %) sem nenhum cuidador identificado.

### M06 Zarit e ARBE

**Objetivo.** Aplicar e acompanhar a Escala de Zarit, gerar alertas amarelo e vermelho, tratar o vermelho no mesmo dia (POP-05) e cruzar horas de cuidado, pedidos de apoio e Zarit na ARBE.
**Usuários.** `psychologist` (os seus casos), `technical_lead` (todos, supervisão), `partner` (agregados).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M06-01 Fila de acompanhamento | `/app/acompanhamento/fila` | Cuidadores com alerta aberto, Zarit vencida ou a vencer; ordenação: vermelho vencido, vermelho do dia, amarelo, ARBE critical, vencidas |
| SCR-M06-02 Aplicar Zarit | `/app/acompanhamento/zarit/:caregiverId/nova` | Assistente de 22 itens (0 a 4), um por tela ou em blocos, barra de progresso, rascunho salvo; total e faixa só ao concluir |
| SCR-M06-03 Resultado e conduta | após concluir | Total, faixa, conduta da equipe (A.5), alerta criado; botões: "Registrar contato" (vermelho) e "Criar tarefa de revisão da rede de apoio" (amarelo) |
| SCR-M06-04 Histórico do cuidador | `/app/acompanhamento/cuidador/:id` | Linha do tempo de pontuações e faixas, evolução (%), próxima aplicação, alertas |
| SCR-M06-05 Alerta vermelho | `/app/acompanhamento/alertas/:id` | Cronômetro até 23h59 do dia; contato (hora, quem, canal); avaliação de risco; encaminhamento (liga a M13); encerrar |
| SCR-M06-06 Alerta amarelo | idem | Tarefa "revisar rede de apoio da família"; plano de acompanhamento prioritário |
| SCR-M06-07 ARBE | `/app/acompanhamento/arbe` | Lista de alertas ARBE, critérios atendidos (horas, pedidos de apoio, Zarit), confirmar ou descartar |
| SCR-M06-08 Parâmetros ARBE | `/app/configuracoes/arbe` | Limites editáveis pelo `technical_lead` (RN-ARBE-05) |
| SCR-M06-09 Pedidos de revisão | `/app/acompanhamento/revisoes` | Pedidos do cuidador para rever decisão tomada com base nos resultados (RN-ZRT-20) |
| SCR-M06-10 Painel agregado | `/app/acompanhamento/agregado` | Distribuição por faixa, evolução média, contagem de alertas; mínimo de 5 por recorte |

**Entidades.** `ZaritAssessment`, `ZaritAlert`, `ArbeAlert`, `ArbeSettings`, `ReviewRequest`, `WellbeingCheck`.
**Estados.** `ZaritAssessment.status`: `scheduled` (vencimento calculado) para `due` (vence em até 14 dias) para `overdue` (venceu) para `completed`. `ZaritAlert.status`: `open` para `contacted` para `risk_assessed` para `closed`; vermelho vira `overdue` às 23h59 do dia sem contato e volta ao fluxo normal quando o contato é registrado. `ArbeAlert.status`: `generated` para `confirmed` para `contacted` para `closed`; `generated` ou `confirmed` para `discarded` (com motivo).
**Ações.** Aplicar Zarit (psicólogo do caso); registrar contato; registrar avaliação de risco; criar encaminhamento; encerrar alerta; adendo à aplicação; confirmar ou descartar ARBE; editar limites (RT); responder pedido de revisão.
**Validações.**
- 22 itens obrigatórios, inteiros de 0 a 4; total é **calculado**; fora de 0 a 4 é rejeitado (RN-ZRT-25).
- Sem consentimento de saúde ativo, **não** é possível aplicar nem salvar rascunho (RN-ZRT-07, RN-LGPD-14).
- Faixas inclusivas: 0 a 20, 21 a 40, 41 a 60, 61 a 88. Amarelo: 41 a 60. Vermelho: 61 a 88 (RN-ZRT-08, 12, 13).
- Vermelho: prazo até 23h59 da data da aplicação; sem contato registrado passa a `overdue` e escala ao RT (RN-ZRT-14); não pode encerrar sem horário do contato, quem fez, resultado da avaliação de risco e, se houver, encaminhamento (RN-ZRT-15).
- Evolução (%) = (atual − adesão) ÷ adesão × 100; adesão 0 mostra "n/d" (RN-ZRT-16, 17).
- Próxima aplicação = 3 meses depois da última (dia inexistente cai no último dia do mês) (RN-ZRT-05).
- Aplicação assinada é imutável; correção por adendo.
- ARBE: nível `attention` com 2 de 3 critérios; `critical` com 3 de 3 ou Zarit 61 ou mais; sem novo alerta do mesmo nível enquanto houver um aberto (RN-ARBE-05, 06, 08).
- Cuidador com consentimento revogado sai do cálculo (RN-ARBE-09).
- O sistema nunca usa a palavra "diagnóstico" nem "eficácia" para esses resultados (RN-ZRT-18, 22).
**Regras.** RN-ZRT-01 a 26, RN-ARBE-01 a 10, RN-POP-05, RN-ENC-03, RN-LGPD-16.
**Critérios de aceite.**
- [ ] AC-M06-01 Total de 0 aparece como "Sobrecarga ausente ou pequena"; 20, idem; 21 como "moderada"; 40, idem; 41 como "moderada a severa" com alerta amarelo; 60, idem; 61 como "severa" com alerta vermelho; 88, idem.
- [ ] AC-M06-02 Não é possível concluir com algum item sem resposta; botão "Concluir" fica desabilitado e o item faltante é indicado.
- [ ] AC-M06-03 Total fora de 0 a 88 é impossível pela interface; respostas fora de 0 a 4 são rejeitadas no serviço.
- [ ] AC-M06-04 Aplicar Zarit com resultado 63 hoje cria alerta vermelho com prazo 23h59 de hoje, cronômetro visível e tarefa "contato no mesmo dia".
- [ ] AC-M06-05 Pelo seed, o alerta de Maria Aparecida Lemos (79 ontem, sem contato) está `overdue` e visível ao `technical_lead`.
- [ ] AC-M06-06 Encerrar alerta vermelho sem avaliação de risco preenchida é bloqueado com a lista dos campos faltantes.
- [ ] AC-M06-07 Aplicar Zarit com resultado 41 a 60 cria alerta amarelo e a tarefa "revisar rede de apoio"; o cuidador sobe na fila de prioridade de agenda.
- [ ] AC-M06-08 João Batista Carneiro (66 na adesão, 52 no 1º trimestre) mostra evolução de −21,2%; Maria (adesão 40, depois 28, depois 18) mostra −55,0% no último ponto; o caso com adesão 0 mostra "n/d".
- [ ] AC-M06-09 Revogar o consentimento de saúde de um cuidador impede nova aplicação, fecha alertas abertos com motivo "consentimento revogado" e o tira do painel agregado.
- [ ] AC-M06-10 `support` não encontra Zarit, faixa nem alerta em nenhuma tela; vê apenas "aplicação pendente" ou "em dia" com data.
- [ ] AC-M06-11 `partner` vê o painel agregado com contagens por faixa, sem nenhum recorte com menos de 5 pessoas (recortes menores aparecem como "menos de 5").
- [ ] AC-M06-12 A ARBE gera alerta `critical` para Ana Paula Ferraz (11 h por dia, 4 pedidos em 30 dias, Zarit 63) e `attention` para o caso com 9 h, 3 pedidos e Zarit 35.
- [ ] AC-M06-13 Mudar os limites da ARBE em M06-08 (`technical_lead`) recalcula os alertas; `partner` só lê.
- [ ] AC-M06-14 Pedido de revisão criado pelo cuidador aparece para o psicólogo do caso com prazo e permite resposta registrada.
- [ ] AC-M06-15 Nenhuma tela mostra escore individual a quem não é o psicólogo do caso nem o RT; tentativa por URL gera `denied` no log.
- [ ] AC-M06-16 A fila ordena: vermelho vencido, vermelho do dia, ARBE `critical`, amarelo, Zarit vencida, Zarit a vencer.
- [ ] AC-M06-17 O indicador "contato no mesmo dia" (janela dos últimos 30 dias, RN-KPI-17) mostra no seed 66,7% (2 de 3 vermelhos com prazo vencido: contatos no mesmo dia de Cuidador C10 e C11, sem contato de C02); o vermelho de hoje (C01) só entra depois das 23h59.

### M07 Grupos e capacitações

**Objetivo.** Programar e operar grupos de apoio, capacitações, terapia de grupo e rodas de conversa abertas, com acesso por plano, sigilo e presença.
**Usuários.** `partner` (total), `technical_lead` (valida enquadramento), `psychologist` (os seus), `support` (inscrições).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M07-01 Programação | `/app/grupos` | Lista e calendário mensal; filtros por tipo, tema, estado, local; selo do caráter ("orientação e psicoeducação" ou "psicoterapia") |
| SCR-M07-02 Nova atividade | `/app/grupos/novo` | Tipo, tema, responsáveis (psicólogo Nexus, convidado ou credenciado), modalidade, sala, datas, vagas, texto do contrato de sigilo, divulgação com número de inscrição profissional |
| SCR-M07-03 Detalhe da atividade | `/app/grupos/:id` | Inscritos, lista de espera, presença por encontro, contrato de sigilo, indicadores |
| SCR-M07-04 Inscrever | modal | Escolhe cuidador (checa plano, elegibilidade e sigilo) ou participante externo (roda aberta) |
| SCR-M07-05 Presença | `/app/grupos/:id/presenca` | Marcar presentes e ausentes por encontro |
| SCR-M07-06 Indicadores de participação | `/app/grupos/indicadores` | Inscritos, presentes, taxa de presença, preenchimento de vagas (RN-KPI-08) |

**Entidades.** `Activity`, `ActivityMeeting`, `ActivityEnrollment`.
**Estados.** `Activity.status`: `draft` para `open` para `full` (vagas esgotadas; volta a `open` se vaga abre) para `in_progress` para `finished`; `cancelled` a partir de `draft`, `open`, `full` ou `in_progress`. Inscrição: `enrolled` ou `waitlist` para `attended`, `absent` ou `cancelled`; `waitlist` para `enrolled` (promoção automática na liberação da vaga).
**Ações.** Criar, publicar, cancelar; inscrever; entrar na lista de espera; promover da lista; marcar presença; registrar aceite do contrato de sigilo; encerrar atividade.
**Validações.**
- Grupo de apoio e capacitação: só cuidador com plano **Cuida ou Sustenta** (RN-GRP-02); Livre e Essencial são bloqueados com a explicação "disponível a partir do Cuida".
- Roda de conversa aberta: aceita qualquer plano e participante externo (nome e e-mail mínimo) (RN-GRP-03).
- Terapia de grupo: responsável precisa ser psicólogo Nexus com CRP ativo; inscrição exige "elegível" marcado pelo psicólogo do cuidador (RN-GRP-04, 14).
- Inscrição só se o participante aceitou o **contrato de sigilo** (data e hora gravadas) (RN-GRP-09).
- Capacidade padrão 12 (editável); lotada abre lista de espera.
- Modalidade presencial exige sala com os 4 atributos de acessibilidade.
- Divulgação sem promessa de resultado e com nº de inscrição profissional quando for serviço de Psicologia (RN-GRP-15).
- Temas só dos conjuntos de RN-GRP-05 e 06.
- Cuidador que muda de plano e perde acesso sai das turmas futuras (RN-GRP-17).
**Regras.** RN-GRP-01 a 17, RN-POP-04, RN-ETICA-04, 05, 07.
**Critérios de aceite.**
- [ ] AC-M07-01 Inscrever cuidador do plano Essencial em grupo de apoio é bloqueado com mensagem de que o acesso é do Cuida em diante.
- [ ] AC-M07-02 Inscrever cuidador Cuida ou Sustenta é permitido; sem aceite do sigilo, a inscrição não conclui.
- [ ] AC-M07-03 Roda de conversa aberta aceita usuário Livre e participante externo.
- [ ] AC-M07-04 O grupo "Sobrecarga e autocuidado" (seed, 8 vagas) aparece como `full`, com 8 inscritos e 2 na lista de espera; cancelar um inscrito promove o primeiro da fila e o estado volta a `open`/`full` conforme o caso.
- [ ] AC-M07-05 Terapia de grupo exibe o selo "psicoterapia" e só inscreve cuidador marcado elegível.
- [ ] AC-M07-06 Atividade presencial em sala sem acessibilidade completa é bloqueada.
- [ ] AC-M07-07 A página da atividade mostra o caráter e o texto "não promete resultado terapêutico"; divulgação de Psicologia mostra o número de inscrição profissional (fictício).
- [ ] AC-M07-08 Presença marcada atualiza a taxa de presença e o indicador de participação (RN-KPI-08).
- [ ] AC-M07-09 Mudar o plano de Cuida para Essencial (M04) remove o cuidador das turmas futuras e mantém as turmas do ciclo em andamento.
- [ ] AC-M07-10 Os 6 temas de capacitação e 8 de grupo de RN-GRP-05 e 06 são os únicos oferecidos no cadastro.
- [ ] AC-M07-11 Atividade `cancelled` e `draft` existem no seed e aparecem nos filtros.

### M08 Rede credenciada

**Objetivo.** Credenciar, avaliar (ARP) e descredenciar prestadores; acompanhar solicitações de serviço, taxa de recusa e disponibilidade; mostrar "como o usuário vê" a busca com mais de uma opção por especialidade.
**Usuários.** `partner` (total), `technical_lead` (valida psicólogos da rede), `support` (leitura).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M08-01 Prestadores | `/app/rede/prestadores` | Lista com categoria, status, nota, faixa, taxa de recusa, selo "risco de saída"; filtros |
| SCR-M08-02 Ficha do prestador | `/app/rede/prestadores/:id` | Dados, conselho e validade, documentos, contrato, termo, cláusula de proteção de dados, integração, solicitações, avaliações, histórico de status, e-mails registrados |
| SCR-M08-03 Credenciamento | `/app/rede/credenciamento` | Quadro por estado (`requested`, `in_review`, `pending_documents`, `approved`, `rejected`) com **checklist dos 5 critérios** (RN-REDE-03) |
| SCR-M08-04 Processo de credenciamento | `/app/rede/credenciamento/:id` | Checklist, documentos com validade, decisão (aprovar, reprovar com motivo, pedir documentos) |
| SCR-M08-05 Solicitações de serviço | `/app/rede/solicitacoes` | Lista e detalhe; estados; recusa e cancelamento com motivo |
| SCR-M08-06 Avaliações ARP | `/app/rede/avaliacoes` | Avaliações por prestador, notas, comentário, classificação de "reclamação grave" |
| SCR-M08-07 Auditoria quinzenal | `/app/rede/auditoria` | "Rodar auditoria" gera instantâneos de todos os prestadores; classifica nas faixas; lista pendências (monitoramento a contatar, suspensões) |
| SCR-M08-08 Avaliação interna | `/app/rede/avaliacao-interna/:id` | Justificativas do prestador, decisão (confirmar descredenciamento, reinstalar, manter em monitoramento), e-mail de encerramento registrado |
| SCR-M08-09 Busca como o usuário vê | `/app/rede/busca` | Simula a busca por especialidade: mostra todos os ativos e o destaque; "única opção disponível" e "nenhuma opção disponível" |
| SCR-M08-10 Sinais da rede | `/app/rede/sinais` | Taxa de recusa em 30 dias, queda de disponibilidade, entradas e saídas por mês |

**Entidades.** `Provider`, `Accreditation`, `ProviderDocument`, `ServiceRequest`, `ProviderEvaluation`, `ArpSnapshot`, `InternalReview`, `ProviderStatusEvent`, `ProviderAvailabilityWeek`.
**Estados.** Credenciamento (RN-REDE-20): `requested` para `in_review` para `pending_documents` (volta a `in_review` ao regularizar), `approved` ou `rejected`; `approved` para `active`. Prestador: `active`, `monitoring`, `suspended`, `deaccredited`; `suspended` volta a `active` ou `monitoring` por reinstalação, ou segue a `deaccredited`. Solicitação (RN-REDE-26): `requested` para `accepted` ou `refused_by_provider` ou `cancelled_by_user`; `accepted` para `completed` ou `cancelled_by_provider` ou `cancelled_by_user`; `completed` para `evaluated`.
**Ações.** Abrir processo; conferir cada critério; anexar documento (simulado) com validade; aprovar; reprovar com motivo; pedir documentos; ativar após integração; registrar solicitação; aceitar, recusar ou cancelar; registrar avaliação (por `support`, em nome do usuário que a deu por telefone ou WhatsApp); classificar reclamação grave; rodar auditoria; contatar prestador em monitoramento (registro); suspender; abrir e decidir avaliação interna; reinstalar; enviar e-mail de encerramento (registro com texto e data).
**Validações.**
- **Aprovação** só com os 5 critérios cumpridos (ou "não se aplica" no registro de conselho para categorias sem conselho) e **todos os documentos dentro da validade** (RN-REDE-21, 22).
- Documento vencido: processo em `pending_documents`; prestador ativo com documento vencido recebe alerta e, em 30 dias sem regularizar, vai a `suspended` (motivo "documento vencido").
- Reprovação exige motivo textual.
- Ativação exige integração concluída e ciência dos POPs (RN-REDE-24, RN-POP-12) e aceite da vedação de captação paralela (RN-REDE-16).
- Dados de usuários só vão ao prestador com a cláusula de proteção de dados assinada (RN-LGPD-13).
- Avaliação: duas notas inteiras de 1 a 5 obrigatórias; só para solicitação `completed`; uma por serviço (RN-ARP-02, 16).
- **Média só com 5 ou mais avaliações**; abaixo, "sem média" (RN-ARP-04). Arredondamento a 2 casas antes de classificar (RN-ARP-15).
- Faixas: `excellence` (média igual ou superior a 4,5), `alert` (4,0 a menos de 4,5), `deaccreditation` (menos de 4,0 **ou** mais de 2 reclamações graves, isto é, 3 ou mais; vale mesmo sem média) (RN-ARP-06 a 08).
- Entrar em `deaccreditation` **suspende na hora** (sai da busca) e abre avaliação interna; descredenciamento definitivo só com decisão registrada e **e-mail de encerramento** gravado (RN-ARP-10, 11).
- Taxa de recusa = (recusadas ou canceladas pelo prestador em 30 dias) ÷ (recebidas em 30 dias) × 100; selo "risco de saída" com 30% ou mais e no mínimo 5 solicitações (RN-REDE-27, 28).
- Queda de disponibilidade superior a 50% sobre a média das 4 semanas anteriores gera sinal (RN-REDE-29).
- A busca mostra todos os ativos e em monitoramento; suspensos e descredenciados **não** aparecem; o destaque da excelência não elimina os demais (RN-REDE-18, 19, 10).
- Não existe campo de comissão, taxa ou repasse em nenhuma tela da rede (RN-REDE-12).
**Regras.** RN-REDE-01 a 33, RN-ARP-01 a 19, RN-POP-02, RN-ETICA-08 a 13, RN-CAP-02.
**Critérios de aceite.**
- [ ] AC-M08-01 Prestador com 5 critérios ok e documentos válidos é aprovável; com um critério pendente, o botão "Aprovar" fica desabilitado e lista o que falta.
- [ ] AC-M08-02 A candidata a fisioterapeuta com CREFITO vencido (seed) fica em `pending_documents` e não pode ser aprovada até anexar documento válido.
- [ ] AC-M08-03 Prestador com 4 avaliações mostra "sem média (menos de 5 avaliações)"; com 5 avaliações de média 4,0 mostra faixa `alert`; com média 4,5 exatamente, `excellence`.
- [ ] AC-M08-04 Média 3,9 ou menos, ou 3 reclamações graves com média 4,3, classifica `deaccreditation`, suspende e abre avaliação interna; 2 reclamações graves com média 4,3 não suspende.
- [ ] AC-M08-05 Prestador suspenso some de SCR-M08-09; o ativo da mesma especialidade continua; especialidade com um só ativo mostra "única opção disponível"; especialidade sem ativo mostra "nenhuma opção disponível no momento" e sugere encaminhamento (M13).
- [ ] AC-M08-06 Dentista Dr. Eduardo Falcão e Dra. Sônia Peixoto (Odontologia) aparecem juntos na busca, com o destaque do primeiro sem esconder a segunda.
- [ ] AC-M08-07 Aline Cristina Pires (seed) mostra taxa de recusa 62,5% (5 de 8 em 30 dias) e selo "risco de saída"; Fisio em Casa Uberlândia mostra 28,6% (2 de 7) sem selo; Cuidar Bem Home Care mostra 30,0% (3 de 10) com selo.
- [ ] AC-M08-08 "Rodar auditoria" grava um instantâneo por prestador com data, média, nº de avaliações, faixa e nº de reclamações graves; rodar de novo no mesmo dia pergunta se deseja substituir.
- [ ] AC-M08-09 Decidir "confirmar descredenciamento" exige texto de e-mail e grava o e-mail no histórico; decidir "reinstalar" exige motivo e devolve o prestador à busca.
- [ ] AC-M08-10 Avaliação interna do prestador suspenso (seed Clínica Saúde Integral) mostra a justificativa que ele enviou pelo portal.
- [ ] AC-M08-11 Dar nota fora de 1 a 5 ou deixar uma das duas notas em branco é rejeitado; avaliação duplicada do mesmo serviço é rejeitada.
- [ ] AC-M08-12 Nenhuma tela de rede tem campo "comissão", "porcentagem" ou "repasse".
- [ ] AC-M08-13 O prestador novo sem integração concluída não consegue ir a `active`.
- [ ] AC-M08-14 `technical_lead` consegue validar o registro de psicólogo da rede (CRP); `support` apenas lê.
- [ ] AC-M08-15 Nutricionista Camila Rezende (média 4,3 com 3 reclamações graves) está `suspended` e sem aparecer na busca.

### M09 Parceiros e canal corporativo

**Objetivo.** Cadastro e acompanhamento dos parceiros do Cartão Nexus (POP-03) e dos contratos do canal corporativo.
**Usuários.** `partner` (total), `support` (leitura).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M09-01 Parceiros | `/app/parceiros` | Funil `prospect` a `active`; lista; filtros; contagem de ativos (RN-CRT-09) |
| SCR-M09-02 Ficha do parceiro | `/app/parceiros/:id` | Dados, desconto, **validação jurídica e ética** do modelo de remuneração (duas caixas de verificação, data), uso do cartão, histórico |
| SCR-M09-03 Empresas | `/app/empresas` | Contratos corporativos; estado; vagas contratadas e ativas |
| SCR-M09-04 Ficha da empresa | `/app/empresas/:id` | Contato de RH, plano por vaga, preço por vaga (fora da projeção), colaboradores (código pseudonimizado), adesão agregada |
| SCR-M09-05 Convidar colaborador | modal | E-mail do colaborador, vínculo à vaga e ao plano da empresa |

**Entidades.** `Partner`, `PartnerReview`, `CorporateAccount`, `CorporateSeat`.
**Estados.** Parceiro: `prospect` para `legal_ethics_review` para `active` para `suspended` para `ended`; `suspended` volta a `active`. Empresa: `prospect` para `negotiation` para `active` para `suspended` ou `ended`. Vaga: `invited` para `active` para `removed`.
**Ações.** Criar parceiro; mover no funil; registrar validação jurídica e ética; definir desconto; suspender; criar empresa; contratar vagas; convidar colaborador; remover colaborador; encerrar contrato.
**Validações.**
- Parceiro só vai a `active` com remuneração "sem remuneração" **ou** com validação jurídica **e** ética registradas (RN-CRT-06).
- Remuneração só para serviços não privativos da Psicologia; nenhuma opção de "percentual sobre atendimento psicológico" (RN-CRT-07).
- Desconto de 0 a 100% com uma casa decimal.
- Número de colaboradores ativos não passa as vagas contratadas.
- A empresa **nunca** vê dado individual de saúde nem uso individual do atendimento; a ficha mostra agregado com mínimo de 5 (RN-CORP-08).
- Colaborador de empresa tem assinatura paga com pagador "empresa" e conta como assinante; encerrar contrato leva-o ao Livre (RN-CORP-07).
- Preço corporativo é rotulado "não faz parte da projeção do plano" (RN-CORP-05).
**Regras.** RN-CRT-05 a 12, RN-CORP-01 a 10, RN-ETICA-12, RN-POP-03.
**Critérios de aceite.**
- [ ] AC-M09-01 Parceiro `legal_ethics_review` (Clínica de Imagem Delta, seed) não pode ir a `active` sem as duas validações; com as duas, vai.
- [ ] AC-M09-02 Não existe opção de remuneração por psicólogo nem por atendimento psicológico em nenhum formulário.
- [ ] AC-M09-03 O seed tem 5 parceiros `active`, 1 `legal_ethics_review`, 1 `prospect`, 1 `suspended` e 1 `ended`; o painel mostra "5 parceiros ativos".
- [ ] AC-M09-04 Empresa Exemplo Logística tem 5 vagas, 3 ativas; convidar a 6ª é bloqueado.
- [ ] AC-M09-05 Os 3 colaboradores da empresa aparecem como assinantes Cuida com pagador "empresa" e contam em M04 e M10.
- [ ] AC-M09-06 A ficha da empresa não mostra nome, Zarit, alerta nem uso do atendimento de nenhum colaborador; mostra somente vagas e adesão agregada.
- [ ] AC-M09-07 Encerrar o contrato da empresa passa os 3 colaboradores ao Livre e inativa os cartões (RN-CRT-03).
- [ ] AC-M09-08 `support` lê parceiros e empresas mas não edita.

### M10 Financeiro, indicadores e piloto

**Objetivo.** Mostrar o realizado, o ponto de equilíbrio, a projeção de 24 meses em três cenários, o investimento inicial e os indicadores de People Analytics; acompanhar o piloto (MVP).
**Usuários.** `partner` (total), `technical_lead` e `psychologist` (indicadores clínicos agregados), `support` (indicadores operacionais).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M10-01 Visão financeira | `/app/financeiro` | Realizado: assinantes, receita bruta e líquida, gastos, resultado; ponto de equilíbrio e quanto falta |
| SCR-M10-02 Projeção 24 meses | `/app/financeiro/projecao` | Cenários 3, 5 e 7%; tabela mês a mês (A.13); gráfico de barras do resultado e linha do saldo; marcos (primeiro lucro, retorno); "referência literal do plano" ao lado da projeção |
| SCR-M10-03 Parâmetros financeiros | `/app/financeiro/parametros` | Preços, mix, taxa de 11%, gastos, manutenção anual, investimento, reserva, série de gratuitos |
| SCR-M10-04 Investimento e capital | `/app/financeiro/investimento` | Quadro 3, reserva, aporte total; aporte extra por cenário |
| SCR-M10-05 Custos | `/app/financeiro/custos` | Quadro 5, anual, manutenção do site, hospedagem "a confirmar" |
| SCR-M10-06 Indicadores (People Analytics) | `/app/indicadores` | Três frentes: cuidadores (agregado), rede, equipe; fórmulas e janelas (seção 7) |
| SCR-M10-07 Piloto (MVP) | `/app/piloto` | Coorte, janelas de coleta (adesão, 3, 6 meses), os 7 indicadores do Quadro 10, metas e critério de sucesso |
| SCR-M10-08 Exportar | botão | CSV da tabela e JSON dos parâmetros |

**Entidades.** `FinancialParams`, `ProjectionScenario` (calculada), `PilotConfig`, `PilotEnrollment`, `PilotInstrumentRecord`.
**Estados.** Meta do piloto: `editable` (antes do início) para `locked` (após início; mudança exige justificativa). Janela do piloto: `pending` para `done` ou `missed`.
**Ações.** Editar parâmetros (`partner`); trocar cenário; exportar; editar metas do piloto antes do início; registrar justificativa depois do início.
**Validações.**
- Fórmulas da RN-FIN-24; assinantes inteiros, arredondamento meio para cima.
- Ponto de equilíbrio = teto de gastos ÷ receita líquida média (RN-KPI-20): com os padrões, 27.
- Valores de projeção sempre rotulados "estimativa do plano" (RN-FIN-32); receita de psicologia, parcerias e corporativo mostrada à parte (RN-FIN-10).
- Alterar um parâmetro recalcula tudo; botão "restaurar valores do plano" volta aos do documento.
- Indicadores clínicos são **agregados com mínimo de 5** (RN-KPI-02); nenhum nome de cuidador.
- Piloto: só entram cuidadores com TCLE ativo (RN-PIL-10).
**Regras.** RN-FIN-01 a 37, RN-KPI-01 a 25, RN-PIL-01 a 11, RN-EQP-06.
**Critérios de aceite.**
- [ ] AC-M10-01 Com os parâmetros-padrão, o ponto de equilíbrio exibido é **27 assinantes** e a conta mostrada é R$ 2.355,00 ÷ R$ 89,80 = 26,2.
- [ ] AC-M10-02 O cenário 5% mostra: primeiro lucro no mês 7, retorno no mês 14, 85 assinantes no mês 12, 212 no mês 24, e a tabela A.13.1 do catálogo exatamente.
- [ ] AC-M10-03 O cenário 3% mostra primeiro lucro no mês 9, retorno no mês 18 e aporte extra de R$ 2.755,91; o cenário 7%, primeiro lucro no mês 6 e retorno no mês 12.
- [ ] AC-M10-04 O resultado do primeiro ano exibe R$ 7.889,00 e ao lado "referência do plano: R$ 7.905,00"; mensalidades do primeiro ano R$ 41.066,30 ao lado de R$ 41.084,00; diferenças dentro de 0,5%.
- [ ] AC-M10-05 O realizado do seed mostra 17 assinantes, receita bruta R$ 1.698,30, líquida R$ 1.511,49, gastos R$ 2.355,00, resultado −R$ 843,51 e "faltam 10 assinantes para o ponto de equilíbrio".
- [ ] AC-M10-06 Mudar o preço do Essencial para R$ 59,90 recalcula média, líquida e ponto de equilíbrio; "restaurar valores do plano" volta aos números do documento.
- [ ] AC-M10-07 Investimento mostra R$ 15.000,00 + R$ 1.200,00 + R$ 1.000,00 = R$ 17.200,00; reserva R$ 9.300,00; aporte total R$ 26.500,00; sem empréstimos.
- [ ] AC-M10-08 Custos mostram R$ 499,00, R$ 250,00, R$ 300,00 e R$ 1.306,00 = R$ 2.355,00 por mês; R$ 28.260,00 por ano; manutenção do site R$ 400,00 por ano; hospedagem "a confirmar, não incluída"; recorrente conhecido R$ 28.660,00.
- [ ] AC-M10-09 A tabela e o gráfico lançam a manutenção anual nos meses 3 e 15 (gasto de R$ 2.755,00 nesses meses).
- [ ] AC-M10-10 O indicador de conversão do seed mostra 5,0% (17 de 340) ao lado das referências 3%, 5% e 7%.
- [ ] AC-M10-11 Os indicadores de Zarit mostram distribuição por faixa sem nome; recortes com menos de 5 aparecem como "menos de 5".
- [ ] AC-M10-12 O piloto lista 15 cuidadores com TCLE ativo; o cuidador de Uberaba e o sem TCLE não aparecem.
- [ ] AC-M10-13 Os 7 indicadores do Quadro 10 (A.7) aparecem com o instrumento e o momento; sobrecarga mostra adesão, 3 e 6 meses; o texto do painel diz "indício", nunca "eficácia" (RN-ZRT-22).
- [ ] AC-M10-14 Metas do piloto são editáveis antes do início; depois de iniciado, exigem justificativa registrada.
- [ ] AC-M10-15 `support` vê SLA e reclamações; não vê finanças. `technical_lead` não vê valores em reais.

### M11 Mensagens e reclamações

**Objetivo.** Caixa unificada dos quatro canais com prazo (SLA) e tratamento de reclamações (POP-08), incluindo a classificação de "grave" que alimenta a ARP e o encaminhamento à POP-07.
**Usuários.** `support` (total), `partner` (total), `technical_lead` (leitura de graves e POP-07), `psychologist` (mensagens dos seus cuidadores), `provider` (mensagens com a Nexus, via portal).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M11-01 Caixa de entrada | `/app/mensagens` | Quatro canais (aplicativo, WhatsApp, telefone, e-mail), prazo restante por mensagem, filtros, atrasadas em destaque |
| SCR-M11-02 Mensagem | `/app/mensagens/:id` | Conversa, resposta, marcar "pedido de apoio" (alimenta ARBE), vincular a cuidador |
| SCR-M11-03 Registrar contato | modal | Telefone ou WhatsApp recebido, registrado em nome do usuário (RN-CAN-05) |
| SCR-M11-04 Reclamações | `/app/reclamacoes` | Lista por estado e prazo; filtros |
| SCR-M11-05 Reclamação | `/app/reclamacoes/:id` | Descrição, alvo (prestador, serviço, plataforma), gravidade, suspeita de violência, linha do tempo, resposta, encerramento |
| SCR-M11-06 Modelos de resposta | `/app/mensagens/modelos` | Textos padrão no tom da marca (RN-CAN-07) |

**Entidades.** `Message`, `Complaint`, `ComplaintEvent`, `MessageTemplate`.
**Estados.** Mensagem: `new` para `in_progress` para `answered`; `overdue` é **derivado** (agora maior que prazo e não respondida). Reclamação: `open` para `in_progress` para `answered` para `closed`; `dismissed` (improcedente, com motivo).
**Ações.** Responder; atribuir; marcar pedido de apoio; registrar contato por telefone/WhatsApp; abrir reclamação a partir de mensagem; classificar gravidade; marcar suspeita de violência (abre ocorrência POP-07 em M13); responder e encerrar.
**Validações.**
- Prazo por canal: aplicativo 24 horas úteis; WhatsApp 4 horas úteis; telefone imediato em horário comercial; e-mail 48 horas úteis (RN-CAN-02). Horas úteis: segunda a sexta, 8h às 18h, sem feriados nacionais (RN-CAN-03). Mensagem fora do horário começa a contar na abertura seguinte.
- Reclamação formal tem prazo de resposta de 5 dias úteis (RN-POP-08).
- Classificar **grave** exige categoria (falta sem justificativa, quebra de sigilo, outra) e vincula ao prestador; conta na ARP (RN-ARP-09).
- "Suspeita de violência ou negligência" cria ocorrência POP-07 restrita ao RT (RN-ARP-13, RN-POP-07).
- Mensagens padrão não prometem resultado terapêutico.
- Mensagem de risco (palavras como risco de suicídio, anotadas pelo atendente como "risco") abre ocorrência POP-05 e avisa o RT.
**Regras.** RN-CAN-01 a 07, RN-POP-08, RN-ARP-09, 13, RN-KPI-12, 23.
**Critérios de aceite.**
- [ ] AC-M11-01 O prazo exibido: app 24 h úteis, WhatsApp 4 h úteis, telefone imediato, e-mail 48 h úteis.
- [ ] AC-M11-02 Mensagem do WhatsApp recebida sexta às 17h30 tem prazo a partir de segunda 8h (4 horas úteis, até 12h de segunda).
- [ ] AC-M11-03 As mensagens atrasadas do seed aparecem no topo com tempo de atraso e contam no indicador de SLA.
- [ ] AC-M11-04 Marcar "pedido de apoio" soma ao contador de pedidos dos últimos 30 dias do cuidador e pode disparar ARBE.
- [ ] AC-M11-05 Classificar a reclamação do seed contra a Nutricionista como "grave, quebra de sigilo" soma ao nº de graves do prestador na próxima auditoria; a 3ª grave aciona suspensão.
- [ ] AC-M11-06 Marcar "suspeita de violência" cria ocorrência POP-07 visível ao `technical_lead` e não ao `support` nem `partner` (só contagem).
- [ ] AC-M11-07 `support` registra em nome do usuário um pedido recebido por telefone, e o item entra na caixa com canal "telefone".
- [ ] AC-M11-08 Reclamação aberta há 8 dias úteis aparece como vencida (prazo 5 dias úteis).
- [ ] AC-M11-09 `provider` só vê as reclamações que o citam, sem identificar o cuidador.
- [ ] AC-M11-10 Os modelos de resposta não contêm promessa de resultado, travessão ou jargão.

### M12 LGPD

**Objetivo.** Operar consentimentos granulares, direitos do titular, log de auditoria, incidentes, retenção e documentos de governança simulados (política e RIPD).
**Usuários.** `partner` (total), `technical_lead` (edita; log), `support` (registra solicitações).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M12-01 Consentimentos | `/app/lgpd/consentimentos` | Matriz titular x 6 consentimentos; filtros (revogados, pendentes); histórico append-only |
| SCR-M12-02 Termos | `/app/lgpd/termos` | Textos e versões dos termos (saúde, People Analytics, compartilhamento, imagem, WhatsApp, TCLE); três termos separados (RN-LGPD-04) |
| SCR-M12-03 Solicitações do titular | `/app/lgpd/solicitacoes` | Lista com tipo, prazo (15 dias), dias restantes, estados |
| SCR-M12-04 Solicitação | `/app/lgpd/solicitacoes/:id` | Ações por tipo (acesso, correção, anonimização/bloqueio, portabilidade, eliminação, revogação, informação sobre compartilhamento, revisão de decisão) |
| SCR-M12-05 Log de auditoria | `/app/lgpd/log` | Filtros por usuário, perfil, ação, entidade, titular, data; exportar CSV |
| SCR-M12-06 Incidentes | `/app/lgpd/incidentes` | Registro e comunicações (POP-06) |
| SCR-M12-07 Política de privacidade | `/app/lgpd/politica` | Texto simulado em linguagem acessível; encarregado e canal do titular |
| SCR-M12-08 RIPD | `/app/lgpd/ripd` | Relatório de impacto simulado: dados, finalidades, bases, riscos R10, medidas |
| SCR-M12-09 Retenção e eliminação | `/app/lgpd/retencao` | Política de prazos, simulação da passagem do tempo |
| SCR-M12-10 Meus dados no navegador | rodapé | O que está guardado, tamanho, "apagar todos os dados do navegador" |

**Entidades.** `ConsentTerm`, `Consent`, `ConsentEvent`, `DataSubjectRequest`, `AccessLogEntry`, `Incident`, `RetentionPolicy`, `PrivacyDocument`.
**Estados.** Consentimento: `pending`, `granted`, `refused`, `revoked`; `granted` para `revoked` e de volta a `granted` (novo evento). Solicitação do titular: `open` para `in_progress` para `completed` ou `rejected_with_reason`. Incidente: `open` para `contained` para `communicated` para `closed`.
**Ações.** Registrar concessão, recusa ou revogação (em nome do titular, com canal e evidência); abrir e tratar solicitação; gerar JSON de portabilidade; anonimizar; bloquear; eliminar (respeitando retenção); registrar incidente e comunicações; exportar log; apagar dados do navegador.
**Validações.**
- Seis consentimentos independentes; **recusar** imagem ou WhatsApp não bloqueia o resto (RN-LGPD-05).
- Cada evento de consentimento guarda: chave, status, versão do termo, data/hora, canal, quem registrou; histórico **não se edita nem se apaga** (append-only).
- Revogação do consentimento de saúde aplica na hora os efeitos de RN-LGPD-14.
- Prazo da solicitação: 15 dias corridos; "vence em breve" nos últimos 3 dias; "vencida" depois (RN-LGPD-21).
- **Eliminação**: apaga o que não é registro documental; bloqueia o que é, informa o motivo e o prazo (5 anos) (RN-LGPD-23, 24).
- **Anonimização**: substitui identificadores por código, mantém agregados; irreversível, com confirmação.
- **Portabilidade**: JSON com os dados do titular apenas.
- Incidente: registra data, descrição, dados afetados, nº de titulares, medidas e comunicações à ANPD e aos titulares (prazo-alvo 3 dias úteis) (RN-LGPD-22).
- Todo acesso a dado sensível e toda ação neste módulo geram log (RN-LGPD-12).
- Aviso de protótipo fixo (RN-LGPD-25).
**Regras.** RN-LGPD-01 a 27, RN-POP-06, 10, RN-USR-15, 16.
**Critérios de aceite.**
- [ ] AC-M12-01 Cada cuidador tem os 6 consentimentos com status e histórico; recusar "imagem" não muda os demais.
- [ ] AC-M12-02 No seed, a cuidadora com consentimento de saúde revogado aparece em "revogados"; sua aba Acompanhamento está bloqueada e ela não conta no painel agregado.
- [ ] AC-M12-03 A cuidadora com pedido de exclusão em aberto (seed) mostra prazo "vence em 5 dias"; a de correção mostra "vence em breve" (2 dias); a de portabilidade está `completed` com JSON baixável.
- [ ] AC-M12-04 Executar "eliminar" na cuidadora com Zarit apaga cadastro de contato e mensagens, **bloqueia** Zarit e anotações e exibe "retido por registro documental por 5 anos; motivo: Res. CFP 1/2009 (a confirmar)".
- [ ] AC-M12-05 "Anonimizar" pede confirmação, troca nome, CPF, e-mail e telefone por código e mantém a contagem nos agregados.
- [ ] AC-M12-06 O log lista acessos do seed por perfil, inclui `denied`, `reveal`, `export` e `view` de supervisão; filtra por usuário e por titular.
- [ ] AC-M12-07 Histórico de consentimento não tem botão editar nem apagar.
- [ ] AC-M12-08 A política de privacidade mostra o encarregado, o canal do titular, as finalidades e as bases legais; o RIPD lista os riscos e as medidas.
- [ ] AC-M12-09 O incidente do seed (e-mail ao destinatário errado, simulado) mostra comunicações registradas e estado `closed`.
- [ ] AC-M12-10 "Apagar todos os dados do navegador" pede confirmação, limpa as chaves `nexus-erp:` e volta à entrada.
- [ ] AC-M12-11 `support` registra solicitação em nome do titular, mas não vê o log nem o RIPD.
- [ ] AC-M12-12 O termo de consentimento de saúde, o termo de uso de imagem e o contrato de prestação de serviços existem como três documentos separados, cada um com versão e data (RN-LGPD-04).

### M13 Governança: POPs, riscos, encaminhamentos, ocorrências e formação

**Objetivo.** Biblioteca dos 10 POPs, registro de riscos (matriz 5x5), registro de encaminhamentos (Quadro 12), ocorrências POP-05 e POP-07, formação (CAP) e conteúdos de orientação (POP-09).
**Usuários.** `partner` e `technical_lead` (total), demais leitura conforme matriz.
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M13-01 POPs | `/app/governanca/pops` | 10 POPs com responsável, última revisão, estado (`up_to_date`, `due`, `revision_triggered`) |
| SCR-M13-02 POP | `/app/governanca/pops/:code` | Os 7 campos (objetivo, responsável, materiais, passo a passo, registro exigido, indicadores, data da última revisão); registrar revisão; ciência |
| SCR-M13-03 Riscos | `/app/governanca/riscos` | Matriz 5x5 (calor), registro R1 a R12 com P, I, C, categoria, tratamento e controles do sistema |
| SCR-M13-04 Risco | `/app/governanca/riscos/:id` | Editar P e I (C calculado), tratamento, controles vinculados |
| SCR-M13-05 Encaminhamentos | `/app/governanca/encaminhamentos` | Quadro 12 e registro de encaminhamentos feitos |
| SCR-M13-06 Novo encaminhamento | modal | Categoria (7), destino (da lista do quadro), cuidador, data, responsável, retorno |
| SCR-M13-07 Ocorrências | `/app/governanca/ocorrencias` | POP-05 e POP-07, restrição de acesso, passos e prazos |
| SCR-M13-08 Ocorrência | `/app/governanca/ocorrencias/:id` | Passos do POP, registro de cada passo com hora, notificações a órgãos, encerramento |
| SCR-M13-09 Formação | `/app/governanca/formacao` | Eventos por frente (integração, grupos e capacitações, gestão, continuada), presença, status por pessoa |
| SCR-M13-10 Conteúdos de orientação | `/app/governanca/conteudos` | Conteúdos com estado de revisão (POP-09), aprovação do RT, data |
| SCR-M13-11 Normas citadas | `/app/governanca/normas` | CFP 2005, 1/2009, 6/2019, 13/2022, 9/2024, LGPD; campo "vigência confirmada em" (RN-ETICA-17) |

**Entidades.** `Pop`, `PopReview`, `PopAcknowledgement`, `RiskItem`, `Referral`, `Occurrence`, `OccurrenceStep`, `TrainingEvent`, `TrainingAttendance`, `GuidanceContent`, `NormReference`.
**Estados.** POP: `up_to_date` quando revisado há menos de 12 meses, `due` a partir de 12 meses, `revision_triggered` quando incidente registra lacuna (RN-POP-13). Ocorrência: `open` para `in_progress` para `closed`. Encaminhamento: `registered` para `acknowledged` (retorno do destino) para `closed`. Conteúdo: `draft` para `in_review` para `published` (só o RT publica).
**Ações.** Registrar revisão de POP; editar P e I de risco; registrar encaminhamento; abrir e conduzir ocorrência; registrar notificação compulsória; criar evento de formação e presença; aprovar conteúdo.
**Validações.**
- Criticidade C = P × I, P e I inteiros de 1 a 5; prioritário se C maior ou igual a 12 (RN-RISCO-01, 02, 15).
- Ações do RT (POP-05, 07, 09) só o RT fecha; ações da gestão (01, 02, 03, 06, 08, 10) só a gestão (RN-POP-14).
- Ocorrência POP-05 exige os passos 1 a 7 com hora e responsável; sem eles, não encerra (RN-POP-05).
- Ocorrência POP-07 registra sinais de alerta, comunicação aos órgãos (CREAS, Disque 100, delegacia especializada, Ministério Público, Conselho Municipal da Pessoa Idosa) e notificação compulsória; mensagem do sistema lembra de **proteger a pessoa idosa sem abandonar quem cuida** (RN-POP-07).
- Encaminhamento: categoria do Quadro 12 com os destinos permitidos daquela categoria; "agravamento clínico" exige marcar "família comunicada" (RN-ENC-07); "cuidador sem condição" mantém o plano gratuito (RN-ENC-08).
- Nenhum campo de valor ou comissão em encaminhamento (RN-ENC-10).
- Ocorrências restritas ao RT e ao psicólogo do caso (RN-ENC-11).
- Conteúdo só publica após aprovação do RT com data (RN-POP-09).
**Regras.** RN-POP-01 a 15, RN-RISCO-01 a 21, RN-ENC-01 a 11, RN-CAP-01 a 08, RN-ETICA-14 a 17.
**Critérios de aceite.**
- [ ] AC-M13-01 A biblioteca mostra POP-01 a POP-10 com os responsáveis do Quadro 11, e cada POP tem os 7 campos.
- [ ] AC-M13-02 No seed, POP-02 e POP-06 aparecem `due`, POP-08 `revision_triggered` e os demais `up_to_date`.
- [ ] AC-M13-03 O registro de riscos mostra R1 (4x5=20) no topo; 8 riscos prioritários e 4 não; mudar P de R9 de 2 para 5 muda C para 25 e o move a prioritário.
- [ ] AC-M13-04 A matriz 5x5 posiciona cada risco pela célula P x I.
- [ ] AC-M13-05 Registrar encaminhamento por risco de suicídio mostra destinos "rede de urgência em saúde mental" e "CVV (188)" e exibe o lembrete de "conforme POP-05".
- [ ] AC-M13-06 Ocorrência POP-05 do seed (caso de Zarit 88) está encerrada com os 7 passos; a ocorrência aberta do dia de Ana Paula Ferraz mostra os passos pendentes.
- [ ] AC-M13-07 Ocorrência POP-07 aberta do seed mostra a notificação ainda não comunicada e o lembrete de proteger sem abandonar o cuidador.
- [ ] AC-M13-08 `support` e `partner` não abrem ocorrência (partner vê só contagem).
- [ ] AC-M13-09 O quadro de encaminhamentos reproduz as 7 linhas do Quadro 12 com observações.
- [ ] AC-M13-10 Formação mostra as 3 frentes de formação mais a continuada, e o prestador sem integração aparece como `pending`.
- [ ] AC-M13-11 Conteúdo em `in_review` não pode ser publicado por `partner`; só pelo `technical_lead`.
- [ ] AC-M13-12 "Normas citadas" lista as seis normas, com "vigência confirmada em" vazio.

### M14 Portal do profissional credenciado

**Objetivo.** Dar ao credenciado (exemplo principal: cirurgião-dentista com CRO) seu espaço: perfil, disponibilidade, solicitações, nota, documentos, integração e mensagens, vendo só o mínimo de dados de usuários.
**Usuários.** `provider`.
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M14-01 Meu painel | `/portal` | Solicitações novas, nota, taxa de recusa 30 dias, documentos a vencer, integração |
| SCR-M14-02 Meu perfil | `/portal/perfil` | Especialidade, conselho e número, cidade, domicílio sim/não, condições para usuários Nexus, atualizar |
| SCR-M14-03 Disponibilidade | `/portal/disponibilidade` | Horários por semana (alimenta RN-REDE-29) |
| SCR-M14-04 Solicitações | `/portal/solicitacoes` | Aceitar, recusar (com motivo), cancelar, concluir |
| SCR-M14-05 Solicitação | `/portal/solicitacoes/:id` | Dados mínimos do usuário (nome, contato, necessidade, endereço se domiciliar), só se `accepted` e com cláusula assinada |
| SCR-M14-06 Minha avaliação | `/portal/avaliacao` | Nota (média), nº de avaliações, faixa em linguagem neutra, comentários **sem identificação**, taxa de recusa |
| SCR-M14-07 Documentos e contrato | `/portal/documentos` | Registro no conselho com validade, comprovação de formação, contrato, termo de proteção de dados, cláusula; enviar documento (simulado) |
| SCR-M14-08 Integração e POPs | `/portal/integracao` | Conteúdo da integração, ciência dos POPs, vedação de captação paralela |
| SCR-M14-09 Avaliação interna | `/portal/avaliacao-interna` | Aparece só se suspenso: enviar justificativas (RN-ARP-10) |
| SCR-M14-10 Mensagens | `/portal/mensagens` | Canal com a Nexus |
| SCR-M14-11 Privacidade | `/portal/privacidade` | O que o profissional pode ver e por quê (RN-LGPD-08) |

**Entidades.** As de M08 (somente as do próprio prestador), `Message`.
**Estados.** Os de M08; mais `InternalReview.justification`.
**Ações.** Atualizar perfil e disponibilidade; aceitar, recusar, cancelar e concluir solicitação; enviar documento; assinar termo e cláusula; dar ciência dos POPs; enviar justificativa; mensagem.
**Validações.**
- Recusa e cancelamento pedem motivo e contam na taxa de recusa (RN-REDE-27).
- Dados do usuário só visíveis com `accepted` e cláusula de proteção de dados **assinada** (RN-LGPD-13); sem cláusula, a solicitação mostra "assine a cláusula para ver os dados".
- Comentários de avaliação aparecem sem identificar o cuidador (RN-ARP-18).
- Não vê notas nem faixa de outros prestadores, nem dados clínicos, nem finanças.
- Se suspenso, vê aviso neutro e o formulário de justificativas; sem ver a nota numérica exata de outros.
- Não existe campo de valor de repasse ou comissão.
**Regras.** RN-REDE-*, RN-ARP-18, 19, RN-LGPD-08, 13, RN-CAP-02.
**Critérios de aceite.**
- [ ] AC-M14-01 Entrar como o dentista (CRO) leva a `/portal`; tentar `/app/painel` mostra acesso negado.
- [ ] AC-M14-02 O painel do dentista mostra a nota 4,7 e a faixa "em destaque", taxa de recusa e 2 solicitações novas.
- [ ] AC-M14-03 Solicitação `requested` mostra só especialidade e data, sem dados pessoais; ao aceitar, mostra nome, contato e necessidade, e endereço se for domiciliar.
- [ ] AC-M14-04 Prestador sem cláusula assinada (seed: o novo ativo) não vê dados do usuário mesmo com a solicitação aceita.
- [ ] AC-M14-05 Recusar sem motivo é bloqueado; recusar com motivo atualiza a taxa de recusa no painel.
- [ ] AC-M14-06 Os comentários não trazem nome nem código do cuidador.
- [ ] AC-M14-07 O prestador suspenso (Clínica Saúde Integral) vê o aviso neutro e o formulário de justificativas; ao enviar, a justificativa aparece em SCR-M08-08.
- [ ] AC-M14-08 Documento vencido mostra alerta vermelho no painel com a data e o prazo de 30 dias para regularizar.
- [ ] AC-M14-09 Atualizar disponibilidade para menos de 50% da média das 4 semanas anteriores gera sinal em M08 (SCR-M08-10).
- [ ] AC-M14-10 O portal não mostra Zarit, alerta, faixa de outros, nem qualquer valor financeiro.

### M15 Configurações e dados de demonstração

**Objetivo.** Dar ao dono, ao QA e ao CS/CX o controle do protótipo: resetar, exportar, importar, simular a data de hoje, ajustar parâmetros e ver as suposições.
**Usuários.** `partner` (total), `technical_lead` (apenas ARBE e conteúdo).
**Telas.**
| Tela | Rota | Conteúdo |
|---|---|---|
| SCR-M15-01 Dados de demonstração | `/app/configuracoes/dados` | Resetar para o seed; exportar JSON de tudo; importar JSON; tamanho ocupado no navegador; "apagar tudo" |
| SCR-M15-02 Relógio simulado | `/app/configuracoes/relogio` | Definir a data de "hoje" (D0) para testar prazos; botões "+1 dia", "+7 dias", "+1 mês"; voltar ao relógio real |
| SCR-M15-03 Parâmetros | `/app/configuracoes/parametros` | Benefícios por plano, capacidade padrão de grupo, limiar da taxa de recusa, mínimo de avaliações (fixo em 5, somente leitura), prazos de solicitação do titular, SLA calendário |
| SCR-M15-04 ARBE | `/app/configuracoes/arbe` | Mesmo conteúdo de SCR-M06-08 |
| SCR-M15-05 Usuários de demonstração | `/app/configuracoes/usuarios` | Os 12 usuários (leitura) e quem está ativo |
| SCR-M15-06 Suposições | `/app/configuracoes/suposicoes` | Lista da seção 8 e do catálogo (Anexo D) com valor padrão e valor atual |
| SCR-M15-07 Sobre | `/app/configuracoes/sobre` | Versão, aviso de protótipo, créditos, link das regras |

**Entidades.** `AppSettings`, `DemoState`.
**Ações.** Resetar; exportar; importar; definir data; editar parâmetros; restaurar padrões.
**Validações.**
- Resetar e apagar pedem confirmação com o efeito descrito (AC-GL-09).
- Importar JSON valida o esquema e a versão; arquivo inválido é recusado sem alterar dados.
- A data simulada afeta **todos** os cálculos de prazo, ciclo, auditoria e SLA via `Clock`.
- Parâmetros têm faixas válidas (por exemplo, desconto de 0 a 100; capacidade de 1 a 100; taxa de recusa de 1 a 100).
- Mínimo de 5 avaliações da ARP, faixas de Zarit e limites de 4,5 e 4,0 **não são editáveis** (são regras `[doc]`).
**Regras.** Todas as suposições (Anexo D do catálogo), RN-LGPD-18, 25.
**Critérios de aceite.**
- [ ] AC-M15-01 Resetar devolve exatamente o seed da seção 5 (conferir contagens da tabela 5.15).
- [ ] AC-M15-02 Exportar JSON gera arquivo com todas as entidades; importar o mesmo arquivo restaura o estado.
- [ ] AC-M15-03 Importar JSON inválido mostra erro e não altera nada.
- [ ] AC-M15-04 Avançar o relógio 8 dias faz a Zarit "vence em 7 dias" virar `overdue`, o alerta vermelho de hoje virar `overdue` e a solicitação LGPD de 5 dias virar "vencida".
- [ ] AC-M15-05 Avançar o relógio para depois de 15 dias da última auditoria mostra "auditoria quinzenal pendente" em M08.
- [ ] AC-M15-06 Mudar o desconto da sessão do Cuida para 25% reflete em SCR-M05-03.
- [ ] AC-M15-07 Os limites 4,5, 4,0, o mínimo de 5 avaliações e as faixas da Zarit aparecem somente leitura.
- [ ] AC-M15-08 `technical_lead` só edita ARBE e conteúdos; `support` não vê o módulo.
- [ ] AC-M15-09 A lista de suposições mostra cada uma com valor padrão e atual.

---

## 4. Modelo de dados (pseudo-TypeScript)

Nomes em inglês. Todo registro tem `id`, `createdAt` e `updatedAt`. Dinheiro em **centavos inteiros**. Datas `ISODate` (`2026-11-04`) e `ISODateTime` (`2026-11-04T09:30:00-03:00`). Campos marcados `// SENSITIVE` são dados de saúde ou clínicos (RN-LGPD-01) e entram no log de acesso. Chaves de armazenamento: `nexus-erp:<collection>`; sessão: `nexus-erp:session` (sessionStorage); relógio simulado: `nexus-erp:clock`.

```ts
// ===== Primitivos =====
type ID = string;                      // prefixo por entidade: 'cg_', 'el_', 'sub_', 'prv_' ...
type ISODate = string;
type ISODateTime = string;
type Cents = number;
interface Audited { id: ID; createdAt: ISODateTime; updatedAt: ISODateTime; }

// ===== Acesso (M01) =====
type Role = 'partner' | 'technical_lead' | 'psychologist' | 'support' | 'provider';
interface AppUser extends Audited {
  displayName: string; email: string;          // @exemplo.com.br
  role: Role; active: boolean; requiresTwoFactor: boolean;
  psychologistId?: ID; providerId?: ID;
  demoDescription: string;                     // frase exibida na entrada
}
interface Session { userId: ID; role: Role; startedAt: ISODateTime; lastActivityAt: ISODateTime; twoFactorVerified: boolean; }
type AccessAction = 'login' | 'logout' | 'view' | 'create' | 'update' | 'delete' | 'export' | 'print' | 'reveal' | 'denied' | 'supervise';
interface AccessLogEntry extends Audited {
  at: ISODateTime; userId: ID; role: Role; action: AccessAction;
  entity: string; entityId?: ID; subjectCaregiverId?: ID;   // titular afetado
  justification?: string; detail?: string;
}

// ===== Planos, assinaturas e cartão (M04) =====
type PlanId = 'livre' | 'essencial' | 'cuida' | 'sustenta';
type BenefitKey =
  | 'app_access' | 'basic_organization' | 'agenda_reminders' | 'content' | 'network_initial_access'      // Livre
  | 'extended_organization' | 'card_discounts' | 'exclusive_content' | 'network_special_conditions'      // Essencial
  | 'greater_organization_support' | 'support_groups' | 'trainings'                                       // Cuida
  | 'close_organizational_follow_up' | 'higher_support_level' | 'network_differentiated_benefits';       // Sustenta
interface Plan {
  id: PlanId; name: string; monthlyPriceCents: Cents;             // 0, 4990, 11990, 14990
  benefits: BenefitKey[];                                          // acumulativo conforme Figura 1
  psychSessionDiscountPercent: number;                             // [suposição] 0, 10, 15, 20
  priorityScheduling: boolean;                                     // [suposição] Cuida e Sustenta
  color: string;
}
type SubscriptionStatus = 'active' | 'cancel_scheduled' | 'cancelled';
interface Subscription extends Audited {
  caregiverId: ID; planId: PlanId; status: SubscriptionStatus;
  payer: 'self' | 'corporate'; corporateAccountId?: ID;
  startedAt: ISODate; nextCycleAt?: ISODate; scheduledChangeAt?: ISODate; scheduledPlanId?: PlanId;
}
interface PlanChange extends Audited { subscriptionId: ID; from: PlanId; to: PlanId; kind: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate'; effectiveAt: ISODate; byUserId: ID; }
interface BenefitCard extends Audited { caregiverId: ID; number: string /* NX-0000-0000 */; status: 'active' | 'inactive'; issuedAt: ISODate; inactivatedAt?: ISODate; }
interface CardUsage extends Audited { cardId: ID; partnerId: ID; date: ISODate; amountCents: Cents; discountCents: Cents; }

// ===== Cuidador e pessoa idosa (M03) =====
type Sex = 'female' | 'male' | 'other' | 'undisclosed';
type Relationship = 'daughter' | 'son' | 'spouse' | 'daughter_in_law' | 'grandchild' | 'other';
type Channel = 'app' | 'whatsapp' | 'phone' | 'email';
type CaregiverStatus = 'active' | 'paused_by_consent_revocation' | 'closure_requested' | 'closed';
interface Caregiver extends Audited {
  code: string;                                    // 'CUI-0001', usado para pseudonimização
  fullName: string;
  cpf: string; cpfIsFictitious: true;              // sempre fictício e matematicamente inválido
  email: string; phone: string; whatsapp?: string;
  birthDate: ISODate; sex: Sex; relationship: Relationship;   // RN-USR-03
  city: string;
  dailyCareHours: number;                          // 0..24, RN-USR-04
  weeklyOrganizationHours?: number;                // piloto, Quadro 10
  sociodemographics?: { education?: string; incomeBand?: string; employment?: string };
  preferredChannel: Channel; digitalLiteracy: 'low' | 'medium' | 'high';
  status: CaregiverStatus;
  enrolledAt: ISODate;                             // "adesão"
  assignedPsychologistId?: ID;                     // psicólogo responsável
  corporateAccountId?: ID;
  isPilot: boolean;
  closureRequestedAt?: ISODate; closedAt?: ISODate;
}
type Dependency = 'independent' | 'partial' | 'total';
interface Elder extends Audited {
  caregiverId: ID;                                 // um cuidador principal por idoso
  fullName: string; birthDate: ISODate; dependency: Dependency;
  conditionsSummary?: string;                      // SENSITIVE, minimizado
}
interface Medication extends Audited { elderId: ID; name: string; dosage: string; times: string[] /* 'HH:mm' */; active: boolean; }
interface CareAppointment extends Audited { elderId: ID; title: string; at: ISODateTime; kind: 'medical' | 'physio' | 'psychological' | 'other'; providerId?: ID; reminder: boolean; }
interface WellbeingCheck extends Audited { caregiverId: ID; date: ISODate; mood: 1 | 2 | 3 | 4 | 5; }   // SENSITIVE

// ===== Atendimento psicológico (M05) =====
interface PsychologistProfile extends Audited {
  userId: ID; displayName: string; crp: string /* fictício */; crpStatus: 'active' | 'inactive'; isTechnicalLead: false;
  weeklyAvailableHours: number;
}
interface Room extends Audited {
  name: string; address: string;
  accessibility: { stepFreeAccess: boolean; adaptedRestroom: boolean; goodLighting: boolean; armrestSeating: boolean }; // RN-ATD-10
  active: boolean;
}
interface AvailabilitySlot extends Audited {
  psychologistId: ID; date: ISODate; start: string /* HH:mm */; end: string;   // 1 hora
  status: 'open' | 'booked' | 'blocked'; priorityOnly: boolean;
}
type SessionStatus = 'scheduled' | 'confirmed' | 'done' | 'cancelled_by_user' | 'cancelled_by_psychologist' | 'no_show';
type SessionModality = 'online' | 'in_person_coworking' | 'in_person_home';
interface Session extends Audited {
  caregiverId: ID; psychologistId: ID; slotId: ID; startAt: ISODateTime; durationMin: 60;
  modality: SessionModality; roomId?: ID; homeAddress?: string;
  kind: 'psychotherapy' | 'guidance';              // RN-ATD-19
  status: SessionStatus;
  remoteFormatConfirmedPertinent?: boolean;        // RN-ATD-07
  homeVisitConfirmedSafe?: boolean;                // RN-ATD-09
  riskFlag?: boolean;                              // risco, violência ou urgência
  priceCents: Cents; discountPercent: number;
  cancelledAt?: ISODateTime;
}
interface SessionNote extends Audited {
  sessionId: ID; authorPsychologistId: ID;
  content: string;                                  // SENSITIVE
  status: 'draft' | 'signed'; signedAt?: ISODateTime;
  addenda: { at: ISODateTime; content: string }[];  // SENSITIVE
}
interface PsychologistMonthSummary extends Audited {   // meses fechados, vindos do seed ou fechamento
  psychologistId: ID; month: string /* '2026-10' */; availableHours: number; doneHours: number;
}
interface OccupancyView {                              // calculada, não persistida
  psychologistId: ID; month: string; availableHours: number; doneHours: number;
  occupancyPercent: number | null;                     // null = n/d
  isPartialMonth: boolean; overloadAlert: boolean;     // > 80 em dois meses fechados seguidos
}

// ===== Zarit e ARBE (M06) =====
type ZaritBand = 'absent_or_small' | 'moderate' | 'moderate_to_severe' | 'severe';   // 0-20, 21-40, 41-60, 61-88
interface ZaritAssessment extends Audited {
  caregiverId: ID; psychologistId: ID;
  kind: 'enrollment' | 'quarterly'; sequence: number;      // 0 = adesão
  dueDate: ISODate; appliedAt?: ISODate;
  answers?: number[];                                       // SENSITIVE, 22 inteiros 0..4
  total?: number;                                           // SENSITIVE, 0..88
  band?: ZaritBand;                                         // SENSITIVE
  status: 'scheduled' | 'completed';                        // 'due' (vence em até 14 dias) e 'overdue' são derivados de dueDate
  signedAt?: ISODateTime; addenda: { at: ISODateTime; content: string }[];
}
interface ZaritAlert extends Audited {
  assessmentId: ID; caregiverId: ID; level: 'yellow' | 'red';
  status: 'open' | 'contacted' | 'risk_assessed' | 'closed';  // 'overdue' é derivado: vermelho sem contato após deadlineAt
  deadlineAt?: ISODateTime;                                 // vermelho: 23:59 do dia
  contact?: { at: ISODateTime; byUserId: ID; channel: Channel; note?: string };
  riskAssessment?: { at: ISODateTime; byUserId: ID; level: 'low' | 'moderate' | 'high'; note: string };
  supportNetworkReviewDone?: boolean;                       // amarelo
  referralIds: ID[]; occurrenceId?: ID; closedAt?: ISODateTime; closureNote?: string;
}
interface ArbeSettings { hoursThreshold: number /*8*/; supportRequestsThreshold: number /*3*/; windowDays: number /*30*/; zaritThreshold: number /*41*/; criticalZarit: number /*61*/; }
interface ArbeAlert extends Audited {
  caregiverId: ID; level: 'attention' | 'critical'; generatedAt: ISODateTime;
  criteria: { hoursPerDay: { value: number; met: boolean }; supportRequests: { value: number; met: boolean }; zarit: { value: number | null; met: boolean } };
  status: 'generated' | 'confirmed' | 'contacted' | 'closed' | 'discarded';
  reviewedByUserId?: ID; contactedAt?: ISODateTime; closedAt?: ISODateTime; discardReason?: string;
}
interface ReviewRequest extends Audited { caregiverId: ID; psychologistId: ID; about: 'zarit_decision' | 'arbe_alert'; text: string; dueAt: ISODate; answer?: string; answeredAt?: ISODateTime; }

// ===== Grupos e capacitações (M07) =====
type ActivityKind = 'support_group' | 'training' | 'group_therapy' | 'open_conversation_circle';
type ActivityStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'finished' | 'cancelled';
type GroupTheme = 'caregiver_burden' | 'communication_with_elder' | 'routine_organization' | 'handling_difficult_situations' | 'self_care' | 'emotional_health' | 'family_conflict_prevention' | 'basic_care_guidance';
type TrainingTheme = 'first_aid' | 'bed_bath_hygiene' | 'fall_prevention' | 'safe_medication' | 'feeding_choking_prevention' | 'dementia_communication';
interface Activity extends Audited {
  kind: ActivityKind; title: string; theme: GroupTheme | TrainingTheme;
  character: 'guidance' | 'psychotherapy';                      // RN-GRP-16
  leaders: { type: 'psychologist' | 'provider' | 'guest'; id?: ID; name: string; professionalRegistration?: string }[];
  mode: 'online' | 'in_person'; roomId?: ID; partnerOrg?: string /* CRAS, UBS... */;
  meetings: ActivityMeeting[]; capacity: number /* padrão 12 */; status: ActivityStatus;
  minPlan: 'cuida' | null;                                       // null = aberta a todos
  requiresEligibility: boolean; confidentialityText: string;
}
interface ActivityMeeting { id: ID; startAt: ISODateTime; endAt: ISODateTime; done: boolean; }
interface ActivityEnrollment extends Audited {
  activityId: ID; caregiverId?: ID; external?: { name: string; email: string };
  status: 'enrolled' | 'waitlist' | 'attended' | 'absent' | 'cancelled'; waitlistPosition?: number;
  confidentialityAcceptedAt?: ISODateTime; eligibleForGroupTherapy?: boolean;
  attendance: { meetingId: ID; present: boolean }[];
}

// ===== Rede credenciada (M08, M14) =====
type ProviderCategory = 'physiotherapy' | 'professional_caregiver' | 'home_care' | 'nursing' | 'pharmacy' | 'clinic' | 'dentistry' | 'psychology' | 'nutrition' | 'legal' | 'specialized_service';
type ProviderStatus = 'active' | 'monitoring' | 'suspended' | 'deaccredited';
type CouncilBody = 'CRO' | 'CREFITO' | 'COREN' | 'CRN' | 'CRP' | 'OAB' | 'NONE';
interface Provider extends Audited {
  name: string; personType: 'person' | 'company'; category: ProviderCategory; specialtyLabel: string;
  council: { body: CouncilBody; number?: string; state?: string; status: 'active' | 'inactive' | 'not_applicable'; validUntil?: ISODate };
  city: string; homeCare: boolean; conditionsForNexusUsers: string;
  email: string; phone: string;
  status: ProviderStatus; accreditationId: ID;
  integrationDoneAt?: ISODate; popsAcknowledgedAt?: ISODate; parallelSolicitationBanAcceptedAt?: ISODate;
  dataProtectionClauseSignedAt?: ISODate;                         // RN-LGPD-13
  availability: { weekStart: ISODate; slots: number }[];          // últimas semanas
  highlight: boolean;                                             // zona de excelência
}
type AccreditationStatus = 'requested' | 'in_review' | 'pending_documents' | 'approved' | 'rejected' | 'active';
type ChecklistKey = 'council_registry' | 'training_proof' | 'accreditation_contract' | 'data_protection_term' | 'continuous_evaluation_accepted';
interface Accreditation extends Audited {
  providerId: ID; status: AccreditationStatus;
  checklist: Record<ChecklistKey, { status: 'pending' | 'ok' | 'not_applicable' | 'failed'; checkedBy?: ID; checkedAt?: ISODate; note?: string }>;
  rejectionReason?: string; decidedAt?: ISODate; decidedBy?: ID;
}
interface ProviderDocument extends Audited {
  providerId: ID; kind: 'council_registry' | 'training_proof' | 'contract' | 'data_protection_term' | 'identity';
  fileName: string; issuedAt: ISODate; validUntil?: ISODate; status: 'valid' | 'expired' | 'pending';
}
type ServiceRequestStatus = 'requested' | 'accepted' | 'refused_by_provider' | 'cancelled_by_provider' | 'cancelled_by_user' | 'completed' | 'evaluated';
interface ServiceRequest extends Audited {
  caregiverId: ID; providerId: ID; specialty: ProviderCategory; need: string;
  modality: 'home' | 'at_provider'; status: ServiceRequestStatus; requestedAt: ISODateTime;
  respondedAt?: ISODateTime; completedAt?: ISODateTime; reason?: string; evaluationId?: ID;
}
interface ProviderEvaluation extends Audited {
  serviceRequestId: ID; providerId: ID; caregiverId: ID;
  technicalQuality: 1 | 2 | 3 | 4 | 5; punctualityCourtesy: 1 | 2 | 3 | 4 | 5; comment?: string;
  score: number;                                                   // média das duas notas
  grave?: { category: 'unjustified_absence' | 'confidentiality_breach' | 'other'; classifiedBy: ID; classifiedAt: ISODate };
  editableUntil: ISODate;                                          // 7 dias
}
interface ArpSnapshot extends Audited {
  providerId: ID; auditDate: ISODate; average: number | null; evaluationCount: number;
  band: 'excellence' | 'alert' | 'deaccreditation' | 'no_average'; graveComplaintCount: number; auditedBy: ID;
}
interface InternalReview extends Audited {
  providerId: ID; openedAt: ISODate; trigger: 'average_below_4' | 'grave_complaints' | 'manual';
  justification?: string; justificationAt?: ISODateTime;
  decision?: 'confirm_deaccreditation' | 'reinstate' | 'keep_monitoring'; decidedBy?: ID; decidedAt?: ISODate; decisionNote?: string;
  closureEmail?: { to: string; subject: string; body: string; sentAt: ISODateTime };
}
interface ProviderStatusEvent extends Audited { providerId: ID; from: ProviderStatus | null; to: ProviderStatus; reason: string; byUserId: ID; }

// ===== Parceiros e canal corporativo (M09) =====
type PartnerStatus = 'prospect' | 'legal_ethics_review' | 'active' | 'suspended' | 'ended';
interface Partner extends Audited {
  name: string; category: 'pharmacy' | 'clinic' | 'market' | 'optical' | 'laboratory' | 'gym' | 'other'; status: PartnerStatus;
  discountPercent: number; contactName: string; contactEmail: string; city: string;
  remuneration: { model: 'none' | 'fixed_fee' | 'commission_non_psychological'; notes?: string; legalValidatedAt?: ISODate; ethicsValidatedAt?: ISODate };
}
type CorporateStatus = 'prospect' | 'negotiation' | 'active' | 'suspended' | 'ended';
interface CorporateAccount extends Audited {
  companyName: string; cnpj: string /* fictício */; hrContactName: string; hrContactEmail: string;
  status: CorporateStatus; planId: Exclude<PlanId, 'livre'>; seats: number; seatPriceCents: Cents /* [suposição], fora da projeção */;
  startDate?: ISODate; endDate?: ISODate;
}
interface CorporateSeat extends Audited { corporateAccountId: ID; caregiverId?: ID; invitedEmail: string; status: 'invited' | 'active' | 'removed'; }

// ===== Mensagens e reclamações (M11) =====
interface Message extends Audited {
  channel: Channel; direction: 'in' | 'out'; caregiverId?: ID; providerId?: ID; subject?: string; body: string;
  receivedAt: ISODateTime; dueAt: ISODateTime; firstResponseAt?: ISODateTime;
  status: 'new' | 'in_progress' | 'answered'; assignedToUserId?: ID; isSupportRequest: boolean; riskFlag?: boolean;
}
interface Complaint extends Audited {
  protocol: string /* REC-0001 */; channel: Channel; caregiverId?: ID;
  target: { type: 'provider' | 'service' | 'platform' | 'nexus_psychologist' | 'other'; providerId?: ID };
  description: string; severity: 'normal' | 'grave';
  graveCategory?: 'unjustified_absence' | 'confidentiality_breach' | 'other'; suspectedElderAbuse: boolean;
  status: 'open' | 'in_progress' | 'answered' | 'closed' | 'dismissed'; openedAt: ISODateTime; dueAt: ISODateTime;
  events: { at: ISODateTime; byUserId: ID; text: string }[]; occurrenceId?: ID;
}
interface MessageTemplate extends Audited { title: string; body: string; }

// ===== LGPD (M12) =====
type ConsentKey = 'health_data' | 'people_analytics' | 'family_sharing' | 'image_testimony' | 'whatsapp_contact' | 'pilot_tcle';
interface ConsentTerm extends Audited { key: ConsentKey; version: string; title: string; text: string; publishedAt: ISODate; active: boolean; }
interface Consent extends Audited { caregiverId: ID; key: ConsentKey; status: 'pending' | 'granted' | 'refused' | 'revoked'; currentTermVersion: string; }
interface ConsentEvent extends Audited {                          // append-only
  caregiverId: ID; key: ConsentKey; status: 'granted' | 'refused' | 'revoked'; termVersion: string;
  at: ISODateTime; channel: Channel | 'in_person'; registeredByUserId: ID; evidence?: string;
}
type DsrType = 'access' | 'correction' | 'anonymization_or_blocking' | 'portability' | 'erasure' | 'consent_revocation' | 'sharing_info' | 'decision_review';
interface DataSubjectRequest extends Audited {
  protocol: string /* DSR-0001 */; caregiverId: ID; type: DsrType;
  status: 'open' | 'in_progress' | 'completed' | 'rejected_with_reason';
  openedAt: ISODate; dueAt: ISODate /* +15 dias */; completedAt?: ISODate; handledByUserId?: ID; resolutionNote?: string; rejectedReason?: string;
  retentionBlockNote?: string;
}
interface Incident extends Audited {
  occurredAt: ISODateTime; description: string; dataAffected: string[]; affectedSubjects: number; measures: string;
  status: 'open' | 'contained' | 'communicated' | 'closed';
  communications: { to: 'ANPD' | 'subjects'; at: ISODateTime; text: string }[];
}
interface RetentionPolicy { dataClass: string; retentionYears: number | null; basis: string; note?: string; }
interface PrivacyDocument extends Audited { kind: 'privacy_policy' | 'ripd' | 'service_contract'; version: string; body: string; dpoName: string; dpoEmail: string; }

// ===== Governança (M13) =====
interface Pop extends Audited {
  code: `POP-${string}`; title: string; responsibleRole: 'management' | 'technical_lead' | 'management_and_technical_lead';
  objective: string; responsible: string; materials: string; steps: string[]; requiredRecord: string; indicators: string; lastReviewedAt: ISODate;
  reviewState: 'up_to_date' | 'due' | 'revision_triggered';
}
interface PopAcknowledgement extends Audited { popCode: string; personType: 'provider' | 'user'; personId: ID; at: ISODate; }
interface RiskItem extends Audited { code: `R${number}`; title: string; category: string; probability: 1|2|3|4|5; impact: 1|2|3|4|5; /* criticality = P*I, calculada */ treatment: string; controls: string[]; }
type ReferralCategory = 'psychiatric_follow_up' | 'severe_distress_or_suicide_risk' | 'social_vulnerability' | 'rights_violation_or_neglect' | 'social_security_or_guardianship' | 'elder_clinical_worsening' | 'caregiver_cannot_afford_care';
interface Referral extends Audited {
  caregiverId: ID; elderId?: ID; category: ReferralCategory; destinations: string[]; at: ISODate; byUserId: ID;
  status: 'registered' | 'acknowledged' | 'closed'; outcome?: string; familyCommunicated?: boolean; occurrenceId?: ID;
}
interface Occurrence extends Audited {
  kind: 'pop05_risk' | 'pop07_violence_suspicion'; caregiverId: ID; elderId?: ID; openedAt: ISODateTime; status: 'open' | 'in_progress' | 'closed';
  restrictedToUserIds: ID[];                                      // RT e psicólogo do caso
  steps: { n: number; label: string; doneAt?: ISODateTime; byUserId?: ID; note?: string }[];
  authoritiesNotified: { body: string; at?: ISODate; protocol?: string }[]; sourceAlertId?: ID; sourceComplaintId?: ID;
}
interface TrainingEvent extends Audited {
  front: 'provider_integration' | 'group_professionals' | 'management' | 'continuing'; title: string; date: ISODate;
  attendees: { personType: 'provider' | 'user'; personId: ID; present: boolean }[];
}
interface GuidanceContent extends Audited { title: string; body: string; status: 'draft' | 'in_review' | 'published'; approvedByUserId?: ID; approvedAt?: ISODate; exclusive: boolean; }
interface NormReference { id: ID; name: string; subject: string; confirmedInForceAt?: ISODate; }

// ===== Financeiro e piloto (M10) =====
interface FinancialParams {
  planPricesCents: Record<Exclude<PlanId, 'livre'>, Cents>;      // 4990, 11990, 14990
  planMix: Record<Exclude<PlanId, 'livre'>, number>;             // 0.4, 0.3, 0.3
  feesRate: number;                                              // 0.11
  monthlyCostsCents: { coworking: 49900; appMaintenance: 25000; accounting: 30000; travel: 130600 };
  annualSiteMaintenanceCents: 40000; annualSiteMaintenanceMonths: number[]; // [3, 15]
  hostingAnnualCents: number | null;                             // a confirmar, fora do cálculo
  initialInvestmentCents: { appAndSite: 1500000; company: 120000; lawyer: 100000 };
  reserveCents: 930000; breakEvenSubscribers?: number;           // calculado: 27
  cumulativeFreeUsersByMonth: number[];                          // 24 valores, RN-FIN-25
  scenarios: { pessimistic: 0.03; base: 0.05; optimistic: 0.07 };
}
interface PilotConfig {
  startedAt?: ISODate; durationMonths: 6; goals: { zaritReductionPercent: number; satisfactionMin: number; conversionPercent: number }; goalsLocked: boolean; goalChangeLog: { at: ISODate; byUserId: ID; justification: string }[];
}
interface PilotEnrollment extends Audited {
  caregiverId: ID; enrolledAt: ISODate; tcleConsentEventId: ID;
  windows: { name: 'enrollment' | 'month3' | 'month6'; dueDate: ISODate; status: 'pending' | 'done' | 'missed' }[];
  weeklyHoursStart?: number; weeklyHoursEnd?: number; satisfaction?: 1|2|3|4|5; wouldRecommend?: boolean; chosenPlan?: PlanId; chosenReason?: string;
}

// ===== Configurações (M15) =====
interface AppSettings {
  demoToday?: ISODate;                                           // relógio simulado
  groupDefaultCapacity: number;                                  // 12
  refusalRateThresholdPercent: number; refusalRateMinRequests: number;   // 30, 5
  dsrDeadlineDays: number;                                       // 15
  slaHours: { app: 24; whatsapp: 4; phone: 0; email: 48 };
  sessionCancellationHours: number;                              // 24
  arbe: ArbeSettings; minGroupSizeForAggregates: number;         // 5
  schemaVersion: string;
}
```

Relações principais: cada `Caregiver` tem exatamente uma `Elder` (RN-USR-10); tem várias `Subscription` ao longo do tempo (uma ativa por vez) e no máximo um `BenefitCard` ativo; tem seis `Consent` (uma por chave) e o histórico `ConsentEvent`; tem várias `ZaritAssessment` e várias `ServiceRequest`, cada uma dirigida a um `Provider`; cada `ServiceRequest` tem no máximo uma `ProviderEvaluation`; cada `Provider` tem uma `Accreditation`, vários `ProviderDocument` e vários `ArpSnapshot`; cada `Session` ocupa um `AvailabilitySlot`; cada `Activity` tem várias `ActivityEnrollment`; cada `CorporateAccount` tem várias `CorporateSeat`, e cada vaga ativa aponta para um `Caregiver`.

**Campos derivados (nunca persistidos, sempre calculados):** total e faixa da Zarit; evolução percentual; nota ARP de cada avaliação e do prestador; faixa ARP do dia; taxa de recusa; ocupação da agenda; criticidade de risco; ponto de equilíbrio; projeção; status `overdue` de mensagem; status `due`/`overdue` da aplicação de Zarit; `overdue` do alerta vermelho; dias restantes de solicitação do titular.

---

## 5. Especificação do seed de dados fictícios

### 5.0 Princípios
- **Determinístico**: mesma semente (`nexus-seed-1`), mesmo resultado a cada reset. Nenhum `Math.random()` sem semente.
- **Datas relativas**: `D0` é "hoje" (`Clock`); `D-10` é 10 dias antes; `D+5`, 5 dias depois. Assim prazos, ciclos e alertas continuam coerentes em qualquer dia do teste.
- **100% fictício**: CPF no formato `000.000.NNN-00` com dígitos verificadores **inválidos** e `cpfIsFictitious: true`; CNPJ idem; e-mails `@exemplo.com.br`; telefones `(34) 90000-0NNN`; endereços "Rua Exemplo, N"; registros de conselho com número fictício e rótulo "(fictício)". Nenhum nome, RA ou dado dos autores do documento é usado.
- **Cobertura**: cada situação da seção 5.16 tem pelo menos um registro de seed. Os critérios de aceite dos módulos usam os nomes e números abaixo.

### 5.1 Usuários de demonstração (12)
| ID | Nome fictício | Perfil | Observação |
|---|---|---|---|
| u1 | Helena Prado Vasconcelos | `partner` | Sócia e gestão |
| u2 | Dra. Cecília Montenegro | `technical_lead` | CRP-04/00001 (fictício) |
| u3 | Dr. Rafael Moreira | `psychologist` | CRP-04/00102 (fictício); agenda sobrecarregada |
| u4 | Dra. Beatriz Nogueira | `psychologist` | CRP-04/00103 (fictício) |
| u5 | Dra. Letícia Amaral | `psychologist` | CRP-04/00104 (fictício); caso-limite de 80% |
| u6 | Dr. Tiago Brandão | `psychologist` | CRP-04/00105 (fictício); começou há 1 mês |
| u7 | Camila Duarte | `support` | Atendimento |
| u8 | Wesley Lacerda | `support` | Atendimento |
| u9 | Dr. Eduardo Falcão | `provider` | Cirurgião-dentista, CRO-MG 00000 (fictício). **Persona do CS/CX** |
| u10 | Dra. Renata Sampaio | `provider` | Fisioterapeuta, CREFITO fictício |
| u11 | Clínica Saúde Integral | `provider` | Prestador **suspenso** (avaliação interna) |
| u12 | Cuidadora Rosimeire Tavares | `provider` | Prestadora nova, sem cláusula de dados assinada |

### 5.2 Psicólogos, agenda e ocupação
Horário de agenda: segunda a sexta, vagas de 1 hora. Os meses fechados vêm de `PsychologistMonthSummary`; o mês corrente, das sessões detalhadas (5.2.2).

| Psicólogo | Mês -2: disponíveis / realizadas | % | Mês -1: disponíveis / realizadas | % | Resultado esperado |
|---|---|---|---|---|---|
| Rafael Moreira | 160 / 138 | 86,3% | 160 / 146 | 91,3% | **Alerta**: acima de 80% por dois meses seguidos |
| Beatriz Nogueira | 160 / 136 | 85,0% | 160 / 112 | 70,0% | Sem alerta (não são seguidos) |
| Letícia Amaral | 160 / 128 | 80,0% | 160 / 128 | 80,0% | Sem alerta (80,0% não é acima de 80) |
| Tiago Brandão | 0 / 0 | n/d | 80 / 40 | 50,0% | Sem alerta; mês -2 sem agenda |

#### 5.2.2 Sessões detalhadas (D-14 a D+14)
60 sessões: 24 `done`, 3 `no_show`, 4 canceladas (2 pelo usuário, 2 pelo psicólogo), 8 `confirmed`, 21 `scheduled`. Modalidades: 50% on-line, 35% presencial no coworking, 15% em domicílio. Classificação: 85% psicoterapia, 15% orientação. 20 anotações assinadas e 4 em rascunho. 12 vagas `open` e 3 `blocked` nas próximas duas semanas, 4 delas `priorityOnly`. Toda sessão on-line `done` tem a confirmação de pertinência remota gravada.

### 5.3 Salas do coworking (3)
| Sala | Degraus | Sanitário adaptado | Iluminação | Assentos com apoio | Uso |
|---|---|---|---|---|---|
| Sala Girassol | acesso sem degraus | sim | sim | sim | Reservável |
| Sala Ipê | acesso sem degraus | sim | sim | sim | Reservável |
| Sala Jacarandá | acesso sem degraus | **não** | sim | sim | **Bloqueada** (3 de 4), serve ao teste de bloqueio |

### 5.4 Cuidadores de cenário (29)
Códigos `CUI-0001` a `CUI-0029` (C01 a C29). Todos têm pessoa idosa vinculada. Cidade: Uberlândia, salvo indicação. Nomes fictícios; as três personas do documento (Ana, Maria, João) aparecem com sobrenomes inventados.

| ID | Nome fictício (idade) | Plano | Psicólogo | Cenário-chave |
|---|---|---|---|---|
| C01 | Ana Paula Ferraz (45) | Cuida | Rafael | **Persona Ana.** Zarit 48 na adesão e **63 hoje (alerta vermelho do dia, contato pendente, prazo 23h59)**; ARBE `critical` (11 h por dia, 4 pedidos de apoio em 30 dias); ocorrência POP-05 aberta; não participa do piloto |
| C02 | Maria Aparecida Lemos (52) | Essencial | Beatriz | **Persona Maria.** Zarit 55 na adesão e **79 ontem, sem contato: alerta vermelho `overdue`**, escalado ao RT; pedido de revisão de decisão aberto |
| C03 | João Batista Carneiro (68) | Livre | Rafael | **Persona João.** Baixa familiaridade digital, canal preferido telefone; Zarit **66 na adesão (D-100, vermelho, contato no mesmo dia, risco moderado, encaminhado ao CAPS)** e 52 em D-10 (amarelo): evolução −21,2%; piloto |
| C04 | Marlene Cardoso (61) | Livre | Letícia | Zarit **0** (limite inferior) |
| C05 | Sueli Prado (57) | Livre | Rafael | Zarit **20** (limite superior da faixa 1) |
| C06 | Débora Gontijo (49) | Essencial | Beatriz | Zarit **21** (início da faixa 2); piloto |
| C07 | Vera Lúcia Teixeira (54) | Essencial | Letícia | Zarit **40** (fim da faixa 2); piloto |
| C08 | Rita de Cássia Moura (50) | Cuida | Beatriz | Zarit **41** (início do amarelo), alerta amarelo aberto com tarefa "revisar rede de apoio" pendente; piloto |
| C09 | Neusa Aparecida Borges (63) | Sustenta | Letícia | Zarit **60** (fim do amarelo), contatada; piloto |
| C10 | Lúcia Helena Freitas (47) | Livre | Rafael | Zarit **61** (início do vermelho) em D-3, contato no mesmo dia, risco baixo, encerrado |
| C11 | Eliane Costa Rezende (58) | Sustenta | Letícia | Zarit **88** (máximo) em D-2, contato no mesmo dia, risco alto, encaminhado à rede de urgência e CVV; ocorrência POP-05 **encerrada** |
| C12 | Terezinha Alves (66) | Essencial | Beatriz | Piloto concluído (6 meses): Zarit **40, 28, 18**: evolução **−55,0%** |
| C13 | Cláudia Mendes (43) | Livre | Letícia | Zarit **0 na adesão** e 12 depois: evolução **n/d** (divisão por zero); piloto |
| C14 | Ivone Barros (71) | Essencial | Beatriz | Zarit **vencida** (última D-110, venceu em D-20); pessoa idosa com agravamento clínico (encaminhamento à UBS) |
| C15 | Fátima Ribeiro (59) | Livre | Letícia | Zarit **a vencer em 7 dias** |
| C16 | Sônia Maria Dutra (55) | Essencial | Beatriz | **Consentimento de saúde revogado em D-15**; status `paused_by_consent_revocation`; sem ARBE nem painéis |
| C17 | Aparecida Neves (60) | Sustenta | Letícia | Consentimentos parciais: imagem **recusada**, People Analytics **recusado**, saúde e WhatsApp concedidos; fora dos agregados |
| C18 | Raimunda Siqueira (53) | Livre | Tiago | **Pedido de exclusão aberto** (D-10, vence em D+5); possui Zarit (retenção por registro documental); encaminhamento CRAS |
| C19 | Luciana Ornelas (46) | Livre | Tiago | Solicitação de **portabilidade concluída**; JSON gerado |
| C20 | Patrícia Vilela (41) | Livre | Tiago | Solicitação de **correção** em andamento, **vence em 2 dias** |
| C21 | Gisele Marques (44) | Cuida (empresa) | Beatriz | Colaboradora da **Exemplo Logística**; Zarit 18 |
| C22 | Rogério Peixoto (48) | Cuida (empresa) | Tiago | Colaborador da Exemplo Logística; Zarit 35 |
| C23 | Simone Arantes (42) | Cuida (empresa) | Tiago | Colaboradora da Exemplo Logística; Zarit 29 |
| C24 | Lourdes Campos (64) | Sustenta | Rafael | Piloto no mês 4: Zarit 52 e 44; em lista de espera do grupo lotado |
| C25 | Osvaldo Pimentel (62), **Uberaba** | Livre | Tiago | **Não elegível ao piloto**: Uberaba e pessoa idosa `independent`; Zarit 15 |
| C26 | Marcos Vinícius Leal (39) | Essencial | Tiago | **Cancelamento agendado** (D+9); Zarit 27 |
| C27 | Elza Guimarães (68) | Sustenta | Tiago | Alto uso do Cartão Nexus (8 usos); avaliou a nutricionista com **reclamação grave (quebra de sigilo)**; Zarit 38 |
| C28 | Vanessa Torres (37) | Livre | Tiago | Zarit **59** em D-6; **ocorrência POP-07 aberta** (suspeita de negligência com a pessoa idosa); notificação ainda não comunicada |
| C29 | Adriana Fonseca (51) | Livre | Tiago | ARBE `attention`: 9 h por dia, 3 pedidos em 30 dias, Zarit 35 (2 de 3 critérios) |

Totais por plano nesses 29: Livre 12, Essencial 7, Cuida 5, Sustenta 5.

### 5.5 Aplicações de Zarit e alertas (cenário)
Aplicação 22 respostas de 0 a 4 cujos valores somem o total indicado. Faixa: 0 a 20, 21 a 40, 41 a 60, 61 a 88. Estado de alertas esperado no seed:

| Alerta | Cuidador | Nível | Estado | Observação |
|---|---|---|---|---|
| Z-a | C01 | vermelho | `open` (hoje) | Prazo D0 23h59, sem contato |
| Z-b | C02 | vermelho | `open` com prazo vencido (`overdue`) | D-1, sem contato |
| Z-c | C03 | vermelho (D-100) | `closed` | Contato no mesmo dia |
| Z-d | C03 | amarelo (D-10) | `contacted` | Revisão da rede de apoio feita |
| Z-e | C08 | amarelo | `open` | Tarefa pendente |
| Z-f | C09 | amarelo | `contacted` | |
| Z-g | C10 | vermelho (D-3) | `closed` | Contato no mesmo dia |
| Z-h | C11 | vermelho (D-2) | `closed` | Contato no mesmo dia; ocorrência POP-05 |
| Z-i | C28 | amarelo | `open` | Ligado à ocorrência POP-07 |

Indicador "contato no mesmo dia", últimos 30 dias: Z-b (não), Z-g (sim), Z-h (sim); Z-a não entra até as 23h59: **66,7%**.

### 5.6 Cuidadores de volume (311)
`CUI-0030` a `CUI-0340`, todos no **plano Livre**, status `active`, nomes gerados de listas fixas de 60 nomes e 60 sobrenomes, pessoa idosa mínima, consentimento de saúde concedido em 85% (os demais `pending`). 120 deles têm uma aplicação de Zarit de adesão concluída, distribuída assim: **24** na faixa 0 a 20, **46** em 21 a 40, **36** em 41 a 60 e **14** em 61 a 88 (alertas desses casos já encerrados, com datas entre D-170 e D-60). Servem aos painéis agregados (mínimo de 5 por recorte), à paginação e à conversão.

Conversão do seed: 17 assinantes pagos ÷ 340 cadastros = **5,0%**.

### 5.7 Pedidos de apoio e horas (apoio à ARBE)
Registros `Message.isSupportRequest = true` nos últimos 30 dias: C01 com 4; C29 com 3; C02 com 3; C03 com 2; demais 0 a 1. `dailyCareHours`: C01 11; C29 9; C02 10; C03 8 (limite); C24 7; demais 2 a 6.

### 5.8 Prestadores (20)
Nota ARP = soma das notas individuais ÷ (2 × nº de avaliações). Gerar as avaliações de modo que a **soma das notas** seja exatamente a indicada. "Recusa 30d" = recusadas ou canceladas pelo prestador ÷ recebidas nos últimos 30 dias.

| ID | Nome fictício | Categoria | Status | Aval. | Soma das notas | Média | Graves | Recusa 30d | Cenário |
|---|---|---|---|---|---|---|---|---|---|
| P01 | Dra. Renata Sampaio | Fisioterapia | `active` | 12 | 116 | 4,83 | 0 | 1/10 = 10,0% | Excelência; login do portal (u10) |
| P02 | Clínica Movimento Vital | Fisioterapia | `active` | 9 | 83 | 4,61 | 0 | 0/6 | Excelência |
| P03 | Fisio em Casa Uberlândia | Fisioterapia | `monitoring` | 8 | 68 | 4,25 | 0 | 2/7 = 28,6% | **Alerta**; sócio contatou; **28,6% abaixo do limiar** |
| P04 | Aline Cristina Pires | Cuidador(a) profissional | `monitoring` | 7 | 58 | 4,14 | 1 | **5/8 = 62,5%** | **Taxa de recusa alta**, queda de 60% na disponibilidade; selo "risco de saída" |
| P05 | Valdir Antunes | Cuidador(a) profissional | `active` | 10 | 94 | 4,70 | 0 | 0/5 | Excelência |
| P06 | Cuidar Bem Home Care | Home care | `monitoring` | 6 | 53 | 4,42 | 0 | **3/10 = 30,0%** | Alerta; **limiar exato** (30%) com selo; **única opção** de home care |
| P07 | Enf. Priscila Gouveia | Enfermagem | `active` | 14 | 137 | 4,89 | 0 | 1/12 | Excelência; única opção de enfermagem |
| P08 | Farmácia Vida Plena | Farmácia | `active` | 6 | 54 | **4,50** | 0 | 0/6 | **Limite**: exatamente 4,50 é excelência |
| P09 | Drogaria Santa Clara | Farmácia | `monitoring` | 5 | 40 | **4,00** | 0 | 0/4 | **Limite**: exatamente 4,00 é alerta; 5 avaliações |
| P10 | Clínica Saúde Integral | Clínica | `suspended` | 7 | 50 | **3,57** | 1 | 2/3 | **Candidata a descredenciamento** (média menor que 4,0); avaliação interna aberta, justificativa enviada pelo portal (u11); **nenhuma opção** de clínica na busca |
| P11 | **Dr. Eduardo Falcão** | **Odontologia (CRO)** | `active` | 10 | 94 | 4,70 | 0 | 0/4 | **Dentista.** Excelência; **2 solicitações novas**; persona do CS/CX (u9) |
| P12 | Dra. Sônia Peixoto | Odontologia (CRO) | `monitoring` | 6 | 52 | 4,33 | 0 | 0/3 | Alerta; segunda opção de odontologia |
| P13 | Dra. Valéria Costa | Psicologia (rede, CRP) | `active` | 3 | 27 | sem média | 0 | 0/3 | **Menos de 5 avaliações**; única opção de psicologia; validada pelo RT |
| P14 | Nutri Camila Rezende | Nutrição | `suspended` | 8 | 69 | 4,31 | **3** | 1/4 | **Mais de 2 reclamações graves** (quebra de sigilo + 2 faltas) com média 4,31; avaliação interna aberta sem justificativa; **nenhuma opção** de nutrição |
| P15 | Dr. Heitor Magalhães | Advocacia (OAB) | `active` | 5 | 46 | 4,60 | 0 | 0/2 | **Exatamente 5 avaliações**; única opção de advocacia |
| P16 | Dra. Isadora Leal | Fisioterapia | credenciamento `pending_documents` | 0 | n/d | n/d | n/d | n/d | **Documento vencido** (CREFITO validade D-12) |
| P17 | Equipamentos Cuidar+ | Serviço especializado | credenciamento `in_review` | 0 | n/d | n/d | n/d | n/d | Documentos ok, integração pendente |
| P18 | Cuidadores Express | Cuidador(a) profissional | credenciamento `rejected` | 0 | n/d | n/d | n/d | n/d | Reprovado: sem contrato e sem comprovação de formação |
| P19 | Dr. Otávio Lima | Fisioterapia | `deaccredited` (D-60) | 6 | 36 | 3,00 | 3 | n/d | **Descredenciado** com e-mail de encerramento registrado (histórico) |
| P20 | Cuidadora Rosimeire Tavares | Cuidador(a) profissional | `active` | 2 | 17 | sem média | 0 | 0/2 | **Ativa sem cláusula de dados assinada**; integração concluída; login u12 |

Opções por especialidade na busca (ativos e em monitoramento): Fisioterapia 3 (P01, P02, P03); Cuidador(a) 3 (P04, P05, P20); Farmácia 2; Odontologia 2; **única opção**: Home care, Enfermagem, Psicologia, Advocacia; **nenhuma**: Clínica, Nutrição, Serviço especializado.

Auditoria quinzenal: duas auditorias anteriores (D-28 e D-14) com `ArpSnapshot` para todos os prestadores avaliáveis; a seguinte vence em D+1. Disponibilidade semanal dos últimos 4 períodos: média de 10 horários por semana; P04 caiu para 4 na última semana.

### 5.9 Solicitações de serviço e avaliações
- Histórico: uma solicitação `evaluated` por avaliação da tabela 5.8 (124 no total), datadas D-200 a D-31, de cuidadores variados (inclusive Livre, que tem "acesso inicial à rede").
- Últimos 30 dias: as contagens "Recusa 30d" da tabela 5.8 (89 solicitações no total), com estados `requested`, `accepted`, `completed`, `refused_by_provider`, `cancelled_by_provider`, `cancelled_by_user`.
- P11 (dentista): 2 em `requested` (novas) para C03 e C27 (sem dados pessoais visíveis até aceitar); 1 `accepted`; 1 `completed` sem avaliação ainda.
- Comentários livres das avaliações com linguagem neutra; os que caracterizam reclamação grave estão marcados (P14: 2 faltas sem justificativa; P19: 3; P10: 1 falta).

### 5.10 Grupos e capacitações (8)
| ID | Atividade | Tipo | Estado | Vagas | Cenário |
|---|---|---|---|---|---|
| G1 | Sobrecarga e autocuidado | Grupo de apoio | `full` | 8 | **Lotado**: 8 inscritos (C01, C08, C09, C11, C17, C21, C22, C23) e **2 na lista de espera** (C24, C27); Dr. Rafael; sala Girassol; D+3 |
| G2 | Prevenção de quedas | Capacitação | `open` | 12 | 7 inscritos; conduzida por Dra. Renata Sampaio (profissional parceira); D+10 |
| G3 | Luto ambíguo, em grupo | Terapia de grupo | `in_progress` | 8 | 5 inscritos elegíveis; 3 de 8 encontros feitos; selo "psicoterapia" |
| G4 | Roda de conversa: cuidar de quem cuida | Roda aberta | `open` | 30 | 11 inscritos: 7 usuários (inclui Livre) e 4 externos; parceria CRAS; D+15 |
| G5 | Comunicação com pessoas com demência | Capacitação | `finished` | 12 | 11 inscritos: 9 presentes e 2 ausentes |
| G6 | Administração segura de medicamentos | Capacitação | `cancelled` | 12 | Cancelada por baixa inscrição |
| G7 | Prevenção de conflitos familiares | Grupo de apoio | `draft` | 12 | Rascunho |
| G8 | Organização da rotina | Grupo de apoio | `open` | 12 | 4 inscritos |

### 5.11 Parceiros do Cartão e canal corporativo
Parceiros (9): **ativos** (5): Farmácia Bem-Estar 10%, Drogaria Cuidar 12%, Ótica Visão Clara 15%, Laboratório Análise Exemplo 8%, Mercado Vida Saudável 5%; **em validação jurídica e ética** (1): Clínica de Imagem Delta (modelo "valor fixo", sem validações registradas); **prospecção** (1): Loja de Ortopedia Passo Firme; **suspenso** (1): Drogaria Popular Central; **encerrado** (1): Academia Mexa-se. Uso do cartão: 25 registros, 8 deles de C27.
Empresas (3): **Exemplo Logística Ltda.** `active`, 5 vagas, 3 ativas (C21, C22, C23), plano Cuida, preço por vaga fictício; **Indústria Modelo S.A.** `negotiation`; **Comércio Varejista Alfa** `prospect`.

### 5.12 Mensagens e reclamações
- **28 mensagens**: aplicativo 10, WhatsApp 8, telefone 4, e-mail 6. **5 atrasadas** (`overdue`): WhatsApp de C01 há 6 horas úteis sem resposta; aplicativo de C02 há 3 dias sem resposta; aplicativo de C20; e-mail de P17; WhatsApp de C28. 3 mensagens marcadas "pedido de apoio" de C29 nos últimos 30 dias. 1 mensagem com `riskFlag` ligada ao POP-05.
- **Reclamações (5)**: REC-0001 contra P14, grave (quebra de sigilo), `in_progress`, aberta por C27; REC-0002 contra P04, grave (falta sem justificativa), `open`; REC-0003 sobre a plataforma, `closed` com resposta; REC-0004 com `suspectedElderAbuse` ligada à ocorrência POP-07 de C28, restrita ao RT; REC-0005 aberta há 8 dias úteis (prazo de 5 vencido).
- 6 modelos de resposta no tom da marca.

### 5.13 LGPD
- 6 `ConsentTerm` (v1.0) e os documentos `privacy_policy`, `ripd` e `service_contract`. Encarregado fictício.
- Consentimentos: C01 a C29 conforme 5.4; volume conforme 5.6; piloto: 15 com TCLE concedido. `ConsentEvent` com histórico (inclui a concessão e a revogação de C16).
- **5 solicitações do titular**: C18 exclusão (D-10, vence D+5); C19 portabilidade `completed`; C20 correção (vence em 2 dias); C16 revogação `completed`; C02 revisão de decisão `in_progress`.
- **Log de auditoria**: 80 entradas nos últimos 30 dias: `login` 14, `view` 40, `supervise` 12, `reveal` 5, `export` 3, `denied` 6.
- **1 incidente** simulado: e-mail com agenda enviado ao destinatário errado (D-45), `closed`, comunicações registradas.
- Retenção: tabela com registro documental 5 anos (a confirmar), cadastro 30 dias, log 5 anos.

### 5.14 Governança
- 10 POPs; revisões: POP-01 D-200, POP-02 D-400 (**`due`**), POP-03 D-150, POP-04 D-90, POP-05 D-120, POP-06 D-380 (**`due`**), POP-07 D-100, POP-08 D-30 (**`revision_triggered`**: incidente de resposta atrasada), POP-09 D-60, POP-10 D-250.
- 12 riscos R1 a R12 com P e I do Quadro 13 (A.8 do catálogo).
- 10 encaminhamentos cobrindo as 7 categorias do Quadro 12 (C03 CAPS; C11 rede de urgência e CVV; C18 CRAS; C28 CREAS e Disque 100; C27 advogado da rede P15; C14 UBS com família comunicada; C26 clínica-escola; e três outros).
- Ocorrências: **O-1** POP-05 de C11, `closed`, 7 passos; **O-2** POP-05 de C01, `in_progress` (passos 1 e 2 feitos, 3 pendente); **O-3** POP-07 de C28, `open`, notificação a órgão ainda não comunicada.
- 6 eventos de formação (2 integrações de credenciados, 1 de profissionais de grupos, 1 da gestão, 2 continuadas); P17 com integração pendente.
- 8 conteúdos de orientação: 5 `published`, 2 `in_review`, 1 `draft`; 1 deles exclusivo de plano pago.
- 6 normas citadas, sem "vigência confirmada em".

### 5.15 Financeiro, piloto e conferência de contagens
- Parâmetros do plano (A.0 do catálogo) e série de gratuitos acumulados da RN-FIN-25.
- **Realizado** derivado do seed: 17 assinantes (7 Essencial, 5 Cuida, 5 Sustenta); receita bruta R$ 1.698,30; líquida R$ 1.511,49; gastos R$ 2.355,00; resultado −R$ 843,51; faltam 10 assinantes para o ponto de equilíbrio.
- **Piloto**: 15 cuidadores (C03, C06, C07, C08, C09, C12, C13, C24 e 7 de volume), todos com TCLE; C12 concluiu 6 meses; os demais entre 1 e 5 meses; janelas de coleta com estados `done`, `pending` e 1 `missed`; metas padrão da RN-PIL-09, já bloqueadas (`goalsLocked: true`) porque o piloto começou.

| Coleção | Quantidade esperada |
|---|---|
| Usuários de demonstração | 12 |
| Psicólogos / salas | 4 / 3 |
| Cuidadores (cenário + volume) | 340 (29 + 311) |
| Pessoas idosas | 340 |
| Assinaturas ativas / cartões ativos | 340 / 17 |
| Aplicações de Zarit concluídas (cenário + volume) | 158 (38 de cenário + 120 de volume), mais as próximas aplicações agendadas |
| Alertas de Zarit nomeados (tabela 5.5) | 9 |
| Prestadores / credenciamentos | 20 / 20 |
| Solicitações de serviço | 213 (124 históricas + 89 recentes) |
| Avaliações de prestadores | 124 |
| Grupos e capacitações | 8 |
| Parceiros / empresas | 9 / 3 |
| Mensagens / reclamações | 28 / 5 |
| Solicitações do titular | 5 |
| Entradas de log | 80 |
| POPs / riscos / encaminhamentos / ocorrências | 10 / 12 / 10 / 3 |

### 5.16 Situações que o seed **obrigatoriamente** cobre
Todos os 4 planos; Zarit em cada faixa e nos limites 0, 20, 21, 40, 41, 60, 61 e 88; **alerta vermelho no mesmo dia** (C01) e vermelho vencido (C02); amarelo aberto e contatado; evolução negativa, positiva e "n/d"; ARBE `critical` e `attention`; prestador com **taxa de recusa alta** (P04) e no limiar (P06) e abaixo (P03); prestador com **nota baixa candidato a descredenciamento** (P10) e por **reclamações graves** (P14); nota exatamente 4,5 e 4,0; **menos de 5 avaliações** (P13, P20) e exatamente 5 (P15); psicólogo com **agenda acima de 80% por dois meses** (Rafael), caso de 80,0% (Letícia), não seguidos (Beatriz) e mês sem agenda (Tiago); **credenciamento pendente com documento vencido** (P16); em análise (P17); reprovado (P18); descredenciado (P19); **consentimento revogado** (C16) e parciais (C17); **solicitação de exclusão em aberto** (C18), de correção a vencer (C20), de portabilidade concluída (C19); **empresa do canal corporativo** com vagas (Exemplo Logística) e prospectos; **grupo lotado com lista de espera** (G1), grupo cancelado e rascunho; **reclamação em aberto** (REC-0001, 0002), vencida (REC-0005) e suspeita de violência (REC-0004); mensagens atrasadas; parceiro em validação, suspenso e encerrado; POP vencido e com revisão acionada; ocorrência POP-05 aberta e encerrada, POP-07 aberta; especialidade com **uma única opção** e com **nenhuma**; dentista (CRO) credenciado e persona do CS/CX; cuidador de fora de Uberlândia não elegível ao piloto; assinatura com cancelamento agendado (C26); estados vazios testáveis (por exemplo, Marcos Vinícius sem mensagens, Rosimeire sem solicitações aceitas).

---

## 6. Requisitos de LGPD para o protótipo

O ERP é protótipo, mas se comporta como se tratasse dado real (RN-LGPD-01 a 27). Cada requisito abaixo é verificável.

### 6.1 Aviso, banner e limites do protótipo
- [ ] **LP-01** Na primeira visita, banner na entrada (não bloqueante, mas com "Entendi" e "Ver detalhes"): explica que é protótipo, que os dados são fictícios, que ficam **só neste navegador** (`localStorage` e `sessionStorage`), que não há envio a servidor e como apagar (SCR-M12-10). O "Entendi" grava `nexus-erp:ui-notice` com data; o banner não reaparece, mas o rodapé mantém o aviso (RN-LGPD-25).
- [ ] **LP-02** Nenhum formulário aceita dado pessoal real: CPF matematicamente válido é rejeitado; e-mail fora de `@exemplo.com.br` é rejeitado; mensagem de ajuda "use dados fictícios".
- [ ] **LP-03** Sem requisição externa em tempo de execução (AC-GL-11). Fontes e ícones são locais.

### 6.2 Consentimento granular e registro
Seis consentimentos, cada um com **texto próprio, versão, data**, aceite independente. Os três documentos de RN-LGPD-04 são separados (consentimento de saúde, uso de imagem, contrato de prestação).

| Chave | Finalidade | Base legal (RN-LGPD-02) | Se recusar | Se revogar |
|---|---|---|---|---|
| `health_data` | Acompanhamento psicológico, Zarit, ARBE, registro documental | Consentimento específico e destacado; tutela da saúde em procedimento por profissional de saúde, quando aplicável | Livre e agenda continuam; Zarit, ARBE e atendimento clínico não ocorrem | Efeitos de RN-LGPD-14 na hora; histórico retido por registro documental |
| `people_analytics` | Indicadores e painéis agregados sobre o cuidador, a rede e a equipe | Consentimento específico | Fora dos agregados e painéis | Sai dos agregados a partir da data |
| `family_sharing` | Compartilhar informações organizadas da pessoa idosa com familiares | Consentimento, item a item | Nenhum compartilhamento | Compartilhamentos ativos são desfeitos |
| `image_testimony` | Uso de imagem e depoimento em comunicação (Anexo D do documento) | Consentimento específico em **documento próprio** | Nenhum uso de imagem | Marcação "pode usar" removida e materiais sinalizados para retirada |
| `whatsapp_contact` | Contato e avaliação pós-atendimento por WhatsApp | Consentimento | Contato por aplicativo, telefone ou e-mail | Para de enviar por WhatsApp |
| `pilot_tcle` | Participar do piloto (TCLE) | Consentimento livre e esclarecido | Fora do piloto | Sai do piloto; dados já coletados seguem as regras de retenção |

- [ ] **LP-04** Cada concessão, recusa e revogação é um `ConsentEvent` **append-only** com chave, status, versão do termo, data e hora, canal, quem registrou e evidência. O histórico mostra a linha do tempo e não tem editar nem apagar.
- [ ] **LP-05** Recusar um consentimento não condiciona o uso do plano Livre nem muda os outros consentimentos.
- [ ] **LP-06** Mudança de versão de termo exige novo aceite; consentimentos na versão antiga ficam "desatualizado" no painel LGPD.

### 6.3 Finalidade e base legal por campo sensível
| Campo / dado | Categoria | Finalidade | Base legal | Quem vê (identificado) | Visão da gestão |
|---|---|---|---|---|---|
| Escore, respostas, faixa e alertas da Zarit | Saúde | Acompanhamento do cuidador | Consentimento `health_data`; tutela da saúde | Psicólogo do caso; RT (supervisão); o próprio cuidador | Só agregado, mínimo 5 |
| Anotação de sessão, adendos | Saúde, registro documental | Prontuário psicológico (Res. CFP 1/2009) | Tutela da saúde; obrigação regulatória | Psicólogo autor; RT | Nada |
| Alerta ARBE | Saúde (derivado) | Detecção precoce de esgotamento | Consentimento `health_data` e `people_analytics` | Psicólogo do caso; RT | Contagem por nível |
| Ocorrências POP-05 e POP-07 | Saúde, proteção | Segurança do cuidador e da pessoa idosa | Tutela da saúde; obrigação legal (notificação compulsória) | RT; psicólogo do caso | Total por categoria |
| Horas diárias de cuidado, registro de bem-estar | Saúde (declarado) | ARBE e acompanhamento | Consentimento `health_data` | Psicólogo do caso; RT | Agregado |
| Condições de saúde da pessoa idosa, medicamentos | Saúde de terceiro | Organizar a rotina de cuidados | Consentimento do cuidador, minimizado | Cuidador; support (consulta sem edição) | Nada |
| CPF, e-mail, telefone | Pessoal | Cadastro e contato | Execução de contrato | Support (mascarado); psicólogo do caso | Nada (código) |
| Idade, sexo, parentesco, dados sociodemográficos | Pessoal | Perfil do cuidador para análise | Consentimento `people_analytics` | Support; psicólogo do caso | Agregado |
| Avaliações e comentários da rede | Pessoal | Qualidade da rede (ARP) | Legítimo interesse, com aviso | Gestão (pseudonimizado) | Código do cuidador |
| Imagem e depoimento | Pessoal | Comunicação | Consentimento `image_testimony` | Gestão (comunicação) apenas com termo ativo | Termo ativo sim ou não |
| Dados do usuário repassados ao credenciado | Pessoal | Execução do serviço contratado | Execução de contrato, mínimo necessário | Credenciado com cláusula assinada e solicitação aceita | Nada |

### 6.4 Minimização, mascaramento e pseudonimização
- [ ] **LP-07** **Mascaramento padrão** em listas e fichas: CPF `***.***.***-**`; telefone `(34) 9****-0123`; e-mail `a***@exemplo.com.br`. "Mostrar" exige perfil autorizado e **justificativa**, e gera `reveal` no log (RN-LGPD-26).
- [ ] **LP-08** **Pseudonimização na visão da gestão**: `partner` vê `CUI-0042`, plano, status e agregados; nunca nome, contato, CPF, texto livre. Não existe botão de reidentificar para `partner`.
- [ ] **LP-09** **Mínimo de 5** por recorte em agregados de saúde; abaixo disso aparece "menos de 5" (RN-KPI-02).
- [ ] **LP-10** **Minimização ao credenciado**: o portal mostra só nome, contato, necessidade e endereço (se domiciliar), e só com solicitação aceita e cláusula assinada (RN-LGPD-13). Nunca Zarit, faixa, anotações, histórico de outros serviços.
- [ ] **LP-11** **Empresa do canal corporativo** só vê agregados de adesão com mínimo de 5 (RN-CORP-08).
- [ ] **LP-12** Exportações CSV/JSON da gestão excluem campos sensíveis e identificadores; a exportação do titular (portabilidade) inclui apenas seus dados.
- [ ] **LP-13** Impressão e captura: telas com dado sensível mostram marca d'água "Confidencial" na impressão `[suposição]` e geram log `print`.

### 6.5 Log de acesso a dado sensível
- [ ] **LP-14** Geram log: `login`, `logout`, `denied`; `view`, `create`, `update`, `delete`, `export`, `print`, `reveal` sobre qualquer entidade marcada `SENSITIVE` (Zarit, alertas, ARBE, anotações, ocorrências, `conditionsSummary`, bem-estar) e sobre dados pessoais revelados; `supervise` quando o RT abre caso que não é seu.
- [ ] **LP-15** Cada linha: data e hora, usuário, perfil, ação, entidade, id, titular afetado (código), justificativa (quando houver), detalhe. Visível a `partner` (leitura) e `technical_lead` (total). Não pode ser editado nem apagado (só "resetar demonstração" o recria).
- [ ] **LP-16** Filtros por usuário, perfil, ação, entidade, titular e período; exportar CSV sem conteúdo clínico.

### 6.6 Direitos do titular (SCR-M12-03 e 04)
| Direito | Como o ERP atende | Efeito no sistema |
|---|---|---|
| Confirmação e acesso | Gera visão imprimível e JSON do titular | Log `export` |
| Correção | Edita o dado com registro da alteração (valor anterior em histórico) | Log `update`; Zarit assinada só por adendo |
| Anonimização, bloqueio ou eliminação de desnecessários | Anonimiza (irreversível, com confirmação) ou bloqueia o uso | Código no lugar de identificadores; agregados preservados |
| Portabilidade | JSON estruturado do titular | Arquivo baixável |
| Eliminação (de dado tratado por consentimento) | Apaga o que não é registro documental; **bloqueia** o que é, informa motivo e prazo (RN-LGPD-24) | Cadastro de contato e mensagens eliminados; Zarit e anotações bloqueados por 5 anos (a confirmar) |
| Informação sobre compartilhamento | Lista prestadores e empresas que receberam dados (solicitações aceitas) | Visão somente leitura |
| Revogação do consentimento | Registra `ConsentEvent revoked` | Efeitos de RN-LGPD-14 na hora |
| Revisão de decisões | Cria `ReviewRequest` ao psicólogo do caso (RN-ZRT-20) | Prazo e resposta registrados |

- [ ] **LP-17** Toda solicitação tem protocolo `DSR-0000`, prazo de **15 dias corridos**, contador, "vence em breve" nos 3 últimos dias e "vencida" depois (RN-LGPD-21).
- [ ] **LP-18** Rejeitar solicitação exige motivo escrito.

### 6.7 Retenção
| Classe de dado | Retenção (protótipo) | Observação |
|---|---|---|
| Registro documental psicológico (Zarit, anotações, ocorrências clínicas) | mínimo 5 anos `[suposição]`, a confirmar (Apêndice B item 11 do documento) | Bloqueado após pedido de eliminação |
| Cadastro e contato | até 30 dias depois do encerramento | Eliminação |
| Mensagens e solicitações de serviço | até 30 dias depois do encerramento, se sem dado clínico | Eliminação |
| Log de acesso | 5 anos | Preservado |
| Consentimentos (eventos) | 5 anos depois do fim do vínculo | Prova de consentimento |

- [ ] **LP-19** A tela de retenção tem "simular passagem do tempo" (usa o relógio simulado) e mostra o que seria eliminado.

### 6.8 Segurança simulada e verificações finais
- [ ] **LP-20** Selos de segurança são **simulados** e rotulados como tal: "cifrado em repouso (simulado)" em dados sensíveis; 2FA simulado; "cópia de segurança" = exportar JSON.
- [ ] **LP-21** Dados sensíveis nunca aparecem em URL, título da aba, mensagem de erro nem log de console.
- [ ] **LP-22** Sessão em `sessionStorage`; trocar de perfil limpa dados em memória do perfil anterior.
- [ ] **LP-23** O encarregado (DPO fictício), a política de privacidade em linguagem acessível e o canal do titular estão acessíveis em dois toques a partir de qualquer tela (RN-LGPD-19).
- [ ] **LP-24** Incidentes: registro com data, descrição, dados e titulares afetados, medidas e comunicações à ANPD e aos titulares (prazo-alvo de 3 dias úteis) (RN-LGPD-22).

---

## 7. Dashboards e KPIs

Fórmulas exatas. "Fonte" usa as entidades da seção 4. Janela padrão: mês calendário (RN-KPI-25), salvo indicação. Indicador clínico para `partner`/`support` é **sempre agregado com mínimo de 5**.

| ID | Indicador | Fórmula | Fonte | Janela | Perfis |
|---|---|---|---|---|---|
| K01 | Assinantes (total e por plano) | contagem de `Subscription` com `planId` diferente de `livre` e `status` em (`active`, `cancel_scheduled`), incluindo `payer = corporate` | Subscription | agora | partner, support |
| K02 | Usuários gratuitos acumulados | contagem de `Caregiver` com `status` diferente de `closed` | Caregiver | agora | partner |
| K03 | Taxa de conversão (%) | K01 ÷ K02 × 100; mostrar ao lado 3%, 5% e 7% | Subscription, Caregiver | agora | partner |
| K04 | Receita bruta mensal | soma de `monthlyPriceCents` das assinaturas de K01 | Subscription, Plan | mês | partner |
| K05 | Receita líquida mensal | K04 × (1 − `feesRate` 0,11) | FinancialParams | mês | partner |
| K06 | Receita média por assinante | K04 ÷ K01 (plano: R$ 100,90) | idem | mês | partner |
| K07 | Receita líquida média por assinante | K05 ÷ K01; referência do plano R$ 89,80 | idem | mês | partner |
| K08 | Gastos do mês | R$ 2.355,00 + R$ 400,00 no mês de manutenção anual | FinancialParams | mês | partner |
| K09 | Resultado do mês | K05 − K08 | idem | mês | partner |
| K10 | Ponto de equilíbrio (assinantes) | teto de (gastos mensais ÷ líquida média do **plano** R$ 89,80) = 27 | FinancialParams | agora | partner |
| K11 | Assinantes que faltam | max(0, K10 − K01) | K10, K01 | agora | partner |
| K12 | Projeção 24 meses | série de RN-FIN-24 com a série de gratuitos e a conversão do cenário | FinancialParams | 24 meses | partner |
| K13 | Retorno do investimento | primeiro mês com saldo maior ou igual a zero; saldo = −17.200 + Σ resultado | K12 | 24 meses | partner |
| K14 | Aporte extra | max(0, maior prejuízo acumulado − 9.300) | K12 | 24 meses | partner |
| K15 | Distribuição de Zarit por faixa | contagem por faixa da **última** aplicação concluída de cada cuidador com `health_data` e `people_analytics` concedidos | ZaritAssessment | agora | partner(A), technical_lead(A), psychologist(A) |
| K16 | Evolução média da sobrecarga (%) | média de (atual − adesão) ÷ adesão × 100 entre cuidadores com 2 ou mais aplicações e adesão maior que 0 | ZaritAssessment | agora | idem |
| K17 | Alertas de Zarit abertos | contagem por nível (`yellow`, `red`) com `status` diferente de `closed` | ZaritAlert | agora | partner(A), technical_lead, psychologist(seus) |
| K18 | Contato no mesmo dia (%) | vermelhos com `contact.at` na mesma data da aplicação ÷ vermelhos com prazo vencido × 100 | ZaritAlert | 30 dias | technical_lead, partner(A) |
| K19 | ARBE abertos | contagem por nível com `status` diferente de `closed` e `discarded` | ArbeAlert | agora | technical_lead, psychologist(seus), partner(A) |
| K20 | Ocupação da agenda (%) | horas `done` do mês ÷ horas disponibilizadas do mês × 100, por psicólogo | PsychologistMonthSummary, Session, AvailabilitySlot | mês | partner, technical_lead, psychologist(si) |
| K21 | Sobrecarga de agenda | ocupação maior que 80 nos **dois últimos meses fechados** | K20 | 2 meses | idem |
| K22 | Avaliação da rede | média ponderada pelo nº de avaliações das notas de todos os prestadores avaliáveis (5 ou mais) | ProviderEvaluation | agora | partner |
| K23 | Prestadores por faixa ARP | contagem por `band` do último `ArpSnapshot` | ArpSnapshot | última auditoria | partner, technical_lead |
| K24 | Taxa de recusa (%) | (`refused_by_provider` + `cancelled_by_provider`) ÷ solicitações recebidas × 100 | ServiceRequest | 30 dias móveis | partner, support |
| K25 | Prestadores em risco de saída | taxa de recusa maior ou igual a 30% com 5 ou mais recebidas, ou queda de disponibilidade acima de 50% | K24, availability | 30 dias | partner |
| K26 | Credenciamentos em andamento | contagem em `requested`, `in_review`, `pending_documents` | Accreditation | agora | partner |
| K27 | Entradas e saídas da rede | ativações e `deaccredited` por mês | ProviderStatusEvent | mês | partner |
| K28 | Participação em atividades | inscritos, presentes, presença % = presentes ÷ inscritos × 100, preenchimento = inscritos ÷ vagas × 100 | Activity, ActivityEnrollment | mês | partner, psychologist(suas) |
| K29 | Reclamações | recebidas no mês; abertas; resolvidas; tempo médio até a 1ª resposta | Complaint | mês | partner, support |
| K30 | SLA por canal (%) | mensagens respondidas dentro do prazo ÷ mensagens do canal × 100 | Message | mês | partner, support |
| K31 | Uso do aplicativo | acessos por usuário em 30 dias; % ativos (1 ou mais acesso em 30 dias); funções distintas usadas | AccessLog de uso simulado (seed) | 30 dias | partner |
| K32 | Parceiros ativos e economia | contagem de `active`; soma de `discountCents` em `CardUsage` | Partner, CardUsage | agora; mês | partner |
| K33 | Solicitações LGPD | abertas; vencendo em até 3 dias; vencidas | DataSubjectRequest | agora | partner, technical_lead, support |
| K34 | POPs a revisar | contagem de `due` e `revision_triggered` | Pop | agora | partner, technical_lead |
| K35 | Riscos prioritários | contagem com C maior ou igual a 12; C = P × I | RiskItem | agora | partner, technical_lead |
| K36 | Piloto: sobrecarga percebida | média de Zarit na adesão, aos 3 e aos 6 meses (coorte com TCLE) | ZaritAssessment, PilotEnrollment | piloto | partner(A), technical_lead |
| K37 | Piloto: tempo dedicado | média de `weeklyHoursEnd` − `weeklyHoursStart` | PilotEnrollment | piloto | partner(A), technical_lead |
| K38 | Piloto: satisfação e recomendação | média da satisfação 1 a 5; recomendação % = `wouldRecommend` verdadeiro ÷ respondentes × 100 | PilotEnrollment | final do piloto | partner(A), technical_lead |
| K39 | Piloto: conversão e disposição a pagar | conversão da coorte; distribuição de `chosenPlan` e motivos | PilotEnrollment, Subscription | piloto | partner |
| K40 | Horas de atendimento dos psicólogos | soma de horas `done` por psicólogo e total | Session, PsychologistMonthSummary | mês | partner, technical_lead |

Painéis por perfil: ver M02. Gráficos obrigatórios (todos com alternativa em tabela e contraste mínimo 4,5:1): barras do resultado mensal e linha do saldo (K12, K13); barras empilhadas de assinantes por plano (K01); distribuição de Zarit por faixa (K15); medidor de ponto de equilíbrio (K10, K11); matriz 5x5 de riscos (M13); barras de ocupação por psicólogo com linha de 80% (K20); distribuição de faixas ARP (K23).

---

## 8. Fora de escopo e suposições de protótipo

### 8.1 Fora de escopo (explícito)
- Aplicativo do cuidador (agenda, lembretes, conteúdo). O ERP guarda e administra os dados resultantes, não simula o app.
- Servidor, banco de dados, autenticação real, e-mail, SMS, WhatsApp, telefone e videochamada reais. Tudo é simulado e persistido no navegador.
- Pagamentos, cobrança, emissão fiscal, folha, contabilidade (apenas parâmetros e projeção do plano).
- Verificação automática de registros em conselhos (CRO, CREFITO e outros) e assinatura digital de contratos. O ERP registra a conferência manual e o arquivo simulado.
- Prontuário eletrônico completo: só anotação de sessão e registro documental mínimo.
- Multi-empresa, multi-idioma (somente pt-BR), notificações push, integração com Google Forms/Sheets.
- Atendimento à pessoa idosa como usuário (ela não é cliente, RN-USR-01).
- Receitas de atendimento psicológico, parcerias e canal corporativo na **projeção** (RN-FIN-10): registradas à parte.
- Qualquer comissão, taxa de intermediação, porcentagem ou repasse sobre encaminhamentos (vedado, RN-REDE-12, RN-ETICA-08).
- Perfil de estagiário com acesso clínico (RN-ETICA-14).

### 8.2 Suposições do ERP (além das do catálogo, Anexo D)
| ID | Suposição | Valor |
|---|---|---|
| E-01 | Login é seleção de perfil; código do 2FA simulado | `123456`, exibido na tela |
| E-02 | `provider` entra sem 2FA | RN-LGPD-15 fala em "equipe" |
| E-03 | Expiração da sessão por inatividade | 30 minutos, aviso aos 28 |
| E-04 | CPF: rejeita CPF válido, aceita só inválido e fictício | LP-02 |
| E-05 | `support` vê da Zarit apenas "pendente" ou "em dia" com data | Sem resultado |
| E-06 | `Clock` com data simulada em M15 | Afeta todos os prazos |
| E-07 | Mínimo de 5 por recorte em agregados | RN-KPI-02 |
| E-08 | 311 cuidadores de volume gerados de listas fixas | Seção 5.6 |
| E-09 | `support` agenda sessões em nome do usuário sem acesso clínico | Canais alternativos (RN-CAN-05) |
| E-10 | Aviso de impressão "Confidencial" | LP-13 |
| E-11 | Escalada do alerta vermelho vencido ao RT | RN-ZRT-14 |
| E-12 | Série de gratuitos e fórmulas da projeção | RN-FIN-24 e 25 |
| E-13 | Paráfrases dos 22 itens da Zarit | Apêndice 10 |
| E-14 | Notificações do sino são geradas por regra, sem envio | SCR-M02-03 |
| E-15 | Uso do aplicativo (K31) vem de eventos simulados no seed | Sem telemetria real |

---

## 9. Ordem de entrega sugerida (fatias verticais)

Cada fatia deixa algo **demonstrável de ponta a ponta** (tela, regra, dado, teste). LGPD entra desde a primeira fatia (consentimento, mascaramento, log), porque é requisito do dono.

### P0: fundação e o coração do negócio
| Fatia | Conteúdo | Módulos e telas | Pronto quando |
|---|---|---|---|
| P0.1 Fundação | Shell responsivo, tema da marca, RBAC e rotas, `Clock`, repositórios, motor de seed, log, aviso de protótipo, estados vazios | M01 completo; M15 (resetar, exportar, relógio); M02 esqueleto | AC-GL-01 a 12, AC-M01-01 a 08, AC-M15-01 a 04 |
| P0.2 Cuidadores, planos e consentimento | Cadastro, pessoa idosa, plano gratuito, assinatura e cartão, consentimentos granulares, mascaramento e pseudonimização | M03, M04, M12 (consentimentos, log) | AC-M03-01 a 14, AC-M04-01 a 11, AC-M12-01 a 02, 06 e 07 |
| P0.3 Zarit e alertas | Aplicação de 22 itens, faixas, alertas amarelo e vermelho, mesmo dia, evolução, ARBE, fila | M06 completo, M05 (fila, agenda básica) | AC-M06-01 a 17 |
| P0.4 Rede e ARP | Credenciamento com checklist, prestadores, solicitações, avaliações, auditoria quinzenal, suspensão e avaliação interna, busca com mais de uma opção, portal do dentista | M08, M14 | AC-M08-01 a 15, AC-M14-01 a 10 |
| P0.5 Financeiro | Realizado, ponto de equilíbrio, projeção em 3 cenários, parâmetros | M10 (SCR-M10-01 a 05) | AC-M10-01 a 10 |
| P0.6 Painéis | Painel de cada perfil com os blocos acima | M02 completo | AC-M02-01 a 08 |

### P1: operação completa
| Fatia | Conteúdo | Módulos | Pronto quando |
|---|---|---|---|
| P1.1 Atendimento | Agenda, vagas, sessões, anotações sigilosas, salas, ocupação e redistribuição | M05 completo | AC-M05-01 a 15 |
| P1.2 Grupos | Programação, inscrição por plano, lista de espera, sigilo, presença | M07 | AC-M07-01 a 11 |
| P1.3 Mensagens e reclamações | Caixa com SLA, reclamações, classificação grave, ligação com ARP | M11 | AC-M11-01 a 10 |
| P1.4 LGPD completa | Solicitações do titular, anonimização, eliminação com retenção, incidentes, política, RIPD | M12 completo | AC-M12-01 a 12 |
| P1.5 Governança | POPs, riscos, encaminhamentos, ocorrências POP-05 e POP-07 | M13 (SCR-M13-01 a 08) | AC-M13-01 a 09 |
| P1.6 Parceiros e corporativo | Funil de parceiros, validação jurídica e ética, empresas, vagas | M09 | AC-M09-01 a 08 |

### P2: acabamento e profundidade
| Fatia | Conteúdo | Módulos | Pronto quando |
|---|---|---|---|
| P2.1 Piloto e People Analytics | Coorte, janelas, os 7 indicadores, metas travadas; painel de indicadores em 3 frentes | M10 (SCR-M10-06 e 07) | AC-M10-11 a 14 |
| P2.2 Formação e conteúdos | CAP, integração, conteúdos de orientação (POP-09), normas citadas | M13 (SCR-M13-09 a 11) | AC-M13-10 a 12 |
| P2.3 Conforto | Busca global, notificações, exportações CSV, impressão com marca d'água, importar JSON | M02, M15, transversal | AC-M02-07, AC-M15-02 e 03 |
| P2.4 Qualidade | Acessibilidade revisada, responsividade fina, textos da marca, estados vazios e de erro | todos | AC-GL-01 a 12 revalidados |

---

## 10. Apêndice: 22 enunciados de demonstração da Zarit `[suposição S-21]`

O documento descreve os 22 itens por tema e não os transcreve. Os enunciados abaixo são **paráfrases curtas de demonstração**; trocar pelo texto oficial licenciado da versão brasileira (Scazufca, 2002) antes de qualquer uso real. Escala de resposta: 0 nunca, 1 raramente, 2 algumas vezes, 3 frequentemente, 4 sempre/quase sempre (RN-ZRT-02).

| # | Enunciado de demonstração |
|---|---|
| 1 | Sinto que a pessoa que cuido pede mais ajuda do que realmente precisa. |
| 2 | Sinto que, por causa do cuidado, não tenho tempo suficiente para mim. |
| 3 | Sinto-me dividido entre cuidar e dar conta das outras responsabilidades (família, trabalho). |
| 4 | Sinto vergonha de comportamentos da pessoa que cuido. |
| 5 | Sinto irritação quando estou perto dela. |
| 6 | Sinto que o cuidado prejudica minha relação com outros familiares ou amigos. |
| 7 | Tenho receio do que o futuro reserva para ela. |
| 8 | Sinto que ela depende de mim. |
| 9 | Sinto-me tenso quando estou com ela. |
| 10 | Sinto que minha saúde piorou por causa do cuidado. |
| 11 | Sinto que não tenho a privacidade que gostaria. |
| 12 | Sinto que minha vida social foi prejudicada. |
| 13 | Sinto desconforto em receber amigos em casa. |
| 14 | Sinto que ela espera que só eu cuide dela. |
| 15 | Sinto que não tenho dinheiro suficiente para os cuidados. |
| 16 | Sinto que não vou conseguir cuidar por muito mais tempo. |
| 17 | Sinto que perdi o controle da minha vida desde que o cuidado começou. |
| 18 | Gostaria de poder deixar o cuidado nas mãos de outra pessoa. |
| 19 | Sinto insegurança sobre o que fazer por ela. |
| 20 | Sinto que deveria estar fazendo mais por ela. |
| 21 | Sinto que poderia cuidar melhor dela. |
| 22 | No geral, sinto-me sobrecarregado com o cuidado. |

