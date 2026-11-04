# Nexus ERP: catálogo de regras de negócio

Documento do PM. Fonte única das regras para UI, UX, Dev, QA e CS/CX. Derivado do plano de negócios da Nexus (documento de graduação), lido por inteiro, incluindo as figuras e quadros que só existem como imagem.

## 0. Como ler este catálogo

### 0.1 Regra de ouro
As regras do documento são respeitadas sem questionamento. "Refinar" aqui significa transformar o texto em regra precisa, completa e testável (valores exatos, estados, transições, casos de borda). Nenhuma regra do documento foi suavizada, contradita ou "melhorada".

### 0.2 Marcas de origem
| Marca | Significado |
|---|---|
| `[doc §x]` | Literal do documento (ou valor lido de quadro/figura), com a seção de origem. "Fig." = Figura, "Q." = Quadro. |
| `[derivada: RN-...]` | Consequência lógica direta de uma ou mais regras `[doc]`. Quando houver dúvida, vale a regra de origem. |
| `[suposição]` | Lacuna do documento preenchida só para o protótipo funcionar. Todas estão consolidadas no Anexo D e podem ser trocadas por decisão do dono sem afetar as regras `[doc]`. |

### 0.3 Identificadores
`RN-<DOMÍNIO>-NN`. Domínios pedidos: PLN, CRT, USR, ATD, GRP, REDE, ARP, ZRT, ARBE, EQP, KPI, FIN, CORP, POP, LGPD, ETICA, RISCO, CAP, PIL. Domínios adicionais, necessários para cobrir o documento sem forçar regras em domínios errados: ORG (funções e separação gestão/técnica), CAN (canais de comunicação e SLA), ENC (encaminhamento à rede de apoio, 5.11).

### 0.4 Precedência quando o documento diverge de si mesmo
1. Texto principal do capítulo 4 (modelo de negócio e plano financeiro) e Figura 1 (planos).
2. Quadros numerados do capítulo 5 e 6.
3. Figuras 3 e 4 (viabilidade e resultado mensal), que confirmam os números do texto principal.
4. Conclusão (capítulo 7) e figuras com texto divergente: apenas registradas na seção "Inconsistências" (Anexo B).

### 0.5 Observações sobre as fontes visuais
- `docs/referencias/fluxo-encaminhamento.png` é, na verdade, a capa do capítulo 6 (sem conteúdo útil). O fluxo de encaminhamento (5.11) existe como Quadro 12 no texto e está reproduzido no Anexo A.10.
- A matriz de riscos (6.2, Quadro 13) existe como tabela no texto e está reproduzida no Anexo A.8.
- A Figura 4 (resultado mensal e retorno, 24 meses) só traz barras e linha, sem tabela. A projeção mês a mês do Anexo A.13 foi reconstruída para reproduzir todos os marcos numéricos do documento (ver RN-FIN-24 a RN-FIN-27).

### 0.6 Resumo e índice

| Domínio | Seção | Regras | Domínio | Seção | Regras |
|---|---|---|---|---|---|
| PLN planos e assinatura | 1 | 22 | KPI indicadores | 11 | 25 |
| CRT Cartão Nexus e parceiros | 2 | 12 | FIN finanças e viabilidade | 12 | 37 |
| USR cuidador, pessoa idosa, plano gratuito | 3 | 20 | CORP canal corporativo | 13 | 10 |
| ATD atendimento psicológico | 4 | 20 | POP procedimentos operacionais | 14 | 15 |
| GRP grupos e capacitações | 5 | 17 | ENC encaminhamento (5.11) | 15 | 11 |
| REDE rede credenciada | 6 | 33 | LGPD proteção de dados e imagem | 16 | 27 |
| ARP avaliação da rede | 7 | 19 | ETICA aspectos éticos | 17 | 17 |
| ZRT Escala de Zarit | 8 | 26 | RISCO matriz de riscos | 18 | 21 |
| ARBE risco de burnout | 9 | 10 | CAP capacitação | 19 | 8 |
| EQP carga da equipe | 10 | 9 | PIL piloto e MVP | 20 | 11 |
| ORG organização (adicional) | 21 | 7 | CAN canais (adicional) | 22 | 7 |

Total: **384 regras**. Anexos: A (tabelas numéricas), B (inconsistências), C (glossário), D (suposições de protótipo).

---

## 1. PLN: planos e assinatura

- **RN-PLN-01** `[doc §4.4.1, Fig.1]` Existem quatro planos: **Nexus Livre** (R$ 0,00, gratuito), **Nexus Essencial** (R$ 49,90 por mês), **Nexus Cuida** (R$ 119,90 por mês) e **Nexus Sustenta** (R$ 149,90 por mês). Os preços são os da Figura 1 e do texto 4.4.3. Não existe plano "Integral" (ver Anexo B, I-07).
- **RN-PLN-02** `[doc §4.4.1, 6.3]` O plano gratuito é a porta de entrada e é permanente: qualquer família o usa sem custo, sem prazo e sem exigir cartão. Ele é mantido mesmo quando o cuidador não pode custear acompanhamento (ver RN-ENC-08).
- **RN-PLN-03** `[doc §4.4.1, Fig.1]` Os benefícios são progressivos: cada plano pago inclui "tudo do plano anterior, mais" os itens próprios. Ordem de progressão: Livre, Essencial, Cuida, Sustenta.
- **RN-PLN-04** `[doc Fig.1]` **Nexus Livre** inclui: acesso ao aplicativo; organização básica; agenda e lembretes; conteúdos; acesso inicial à rede.
- **RN-PLN-05** `[doc Fig.1]` **Nexus Essencial** inclui o do Livre, mais: organização ampliada; descontos exclusivos do Cartão Nexus; conteúdos exclusivos; condições especiais na rede.
- **RN-PLN-06** `[doc Fig.1]` **Nexus Cuida** inclui o do Essencial, mais: maior suporte à organização; grupos de apoio; capacitações.
- **RN-PLN-07** `[doc Fig.1]` **Nexus Sustenta** inclui o do Cuida, mais: acompanhamento organizacional mais próximo; maior nível de suporte; benefícios diferenciados na rede.
- **RN-PLN-08** `[doc §4.4.1]` Os descontos do Cartão Nexus são exclusivos de usuários com assinatura paga e não fazem parte do plano gratuito.
- **RN-PLN-09** `[derivada: RN-PLN-05..07, Apêndice A]` Itens exclusivos de plano pago: Cartão Nexus; organização ampliada; conteúdos exclusivos; condições especiais na rede (Essencial em diante); grupos de apoio e capacitações (Cuida em diante); maior suporte, acompanhamento organizacional próximo e benefícios diferenciados na rede (Cuida e Sustenta, conforme a figura).
- **RN-PLN-10** `[doc Apêndice A, Fig.1]` Grupos de apoio e capacitações valem **a partir do Nexus Cuida**. O Essencial **não** inclui grupos nem capacitações. (Os trechos que dizem apenas "planos pagos" são lidos à luz da Figura 1; ver Anexo B, I-06.)
- **RN-PLN-11** `[doc Apêndice A, §4.4.1]` A mensalidade remunera: organização da rotina, recursos ampliados do aplicativo, benefícios do Cartão Nexus, condições especiais na rede e, a partir do Cuida, grupos e capacitações. **Não** inclui serviços profissionais da rede, que são contratados e pagos separadamente pelo usuário ao prestador.
- **RN-PLN-12** `[derivada: RN-PLN-11, §4.7.3]` O atendimento psicológico realizado pelos psicólogos da Nexus não é parte do valor da mensalidade: ele é agendado pelo aplicativo "com condições próprias para assinantes" (RN-ATD-05), e sua receita não entra na projeção financeira (RN-FIN-10).
- **RN-PLN-13** `[doc §3.5, §5.9]` A assinatura é reavaliada pelo usuário a cada mês. `[derivada]` Portanto, o cancelamento é possível a qualquer mês, sem multa nem fidelidade (o documento não prevê nenhuma das duas).
- **RN-PLN-14** `[suposição]` Troca de plano: o **upgrade** libera os benefícios imediatamente e passa a cobrar o novo valor a partir da próxima fatura; o **downgrade** e o **cancelamento** valem ao fim do ciclo já pago (estado "cancelamento agendado" até lá). Sem pró-rata no protótipo.
- **RN-PLN-15** `[suposição]` Estados da assinatura: `active` (inclui o Livre, sem cobrança), `cancel_scheduled`, `cancelled`. Pagamento é simulado; falha de pagamento está fora do escopo.
- **RN-PLN-16** `[doc §4.7.3]` Mix de assinantes pagos usado nas projeções: de cada 10 assinantes, 4 escolhem Essencial, 3 escolhem Cuida e 3 escolhem Sustenta (40%, 30%, 30%). Valor médio pago por assinante: R$ 100,90 por mês.
- **RN-PLN-17** `[doc §4.7.3]` Impostos e taxas das plataformas de pagamento somam cerca de 11% da mensalidade. Receita líquida média por assinante: R$ 89,80 por mês.
- **RN-PLN-18** `[doc §5.6]` Gatilhos de conversão do Livre para plano pago (os três momentos em que a passagem "tende a ocorrer"): quadro da pessoa idosa se agrava; cuidador declara esgotamento; família precisa contratar profissionais e percebe o valor dos benefícios. O sistema pode exibir convite de upgrade nesses momentos, **exceto** o gatilho "declara esgotamento" quando derivado de dado de Zarit/ARBE (ver RN-PLN-19).
- **RN-PLN-19** `[derivada: RN-ETICA-06, RN-LGPD-17]` Dados de Zarit, alertas e ARBE nunca alimentam oferta comercial, desconto ou convite de upgrade: decisões técnicas não podem ser tomadas por critério comercial, e a finalidade do dado de saúde é o acompanhamento psicológico.
- **RN-PLN-20** `[doc §4.4.3]` Plano pago também pode ser adquirido pela empresa do colaborador (canal corporativo). Nesse caso a empresa paga e o colaborador usa (ver CORP).
- **RN-PLN-21** `[suposição]` Os parâmetros numéricos dos benefícios que o documento deixa em aberto (Apêndice B, item 1: "benefícios exatos de cada plano") ficam em configuração editável: percentual de desconto do Cartão por parceiro, condição do atendimento psicológico para assinantes (RN-ATD-05), prioridade de agenda. Valores padrão do protótipo no Anexo D.
- **RN-PLN-22** `[doc §4.1.2]` Transparência: o usuário deve saber com clareza o que está incluído em cada plano e o que não está. O quadro comparativo de planos é exibido sem letras miúdas, e o aviso "a mensalidade não inclui serviços da rede nem atendimento psicológico" aparece na contratação.

## 2. CRT: Cartão Nexus e estabelecimentos parceiros

- **RN-CRT-01** `[doc §4.4.1, 4.2.1]` O Cartão Nexus (também chamado "Cartão de Benefícios") dá descontos exclusivos em estabelecimentos parceiros (farmácias, serviços e produtos do dia a dia). Podem integrá-lo clínicas, farmácias, serviços de home care e profissionais autônomos.
- **RN-CRT-02** `[doc §4.4.1]` Só tem Cartão Nexus ativo o usuário com assinatura paga (Essencial, Cuida ou Sustenta). Usuário Livre não tem cartão nem vê descontos aplicáveis (pode ver que o benefício existe, como convite).
- **RN-CRT-03** `[derivada: RN-CRT-02, RN-PLN-13]` Quando a assinatura paga é cancelada (ao fim do ciclo) ou o usuário passa ao Livre, o cartão é inativado no mesmo instante em que a assinatura deixa de valer.
- **RN-CRT-04** `[doc §4.4.1]` Função estratégica: o cartão incentiva a passagem do Livre ao pago e a permanência, porque os descontos se repetem a cada compra.
- **RN-CRT-05** `[doc §5.10 POP-03]` O cadastro e o acompanhamento de parceiros do Cartão Nexus seguem o POP-03 (responsável: gestão). A jornada exige "manter parcerias ativas" (Q.8, etapa Benefícios).
- **RN-CRT-06** `[doc §4.4.2, 6.4]` Eventuais modelos de remuneração entre a empresa parceira e a pessoa jurídica Nexus **só podem ser adotados após validação jurídica e ética**, com informação clara ao usuário e sem diferença de tratamento que favoreça um parceiro em detrimento de outro. Antes da validação, o parceiro fica com remuneração "não definida" e não gera receita nos relatórios.
- **RN-CRT-07** `[doc §6.4, 4.4.2]` A remuneração de parceiros recai apenas sobre serviços **não privativos da Psicologia** (farmácias, estabelecimentos do cartão). Nunca existe porcentagem sobre atendimento psicológico.
- **RN-CRT-08** `[doc §4.7.3]` Receita de parcerias ainda depende de definição de preços e de negociação e **não** entra na projeção financeira.
- **RN-CRT-09** `[doc §6.2 R11]` Risco "poucos parceiros no Cartão Nexus" (criticidade 9): tratamento previsto é prospecção na fase 1 e benefícios simples para o parceiro. O painel de parceiros mostra a quantidade de parceiros ativos e o funil de prospecção.
- **RN-CRT-10** `[suposição]` Estados do parceiro: `prospect`, `legal_ethics_review`, `active`, `suspended`, `ended`. Só parceiros `active` aparecem aos usuários e aceitam uso do cartão.
- **RN-CRT-11** `[suposição]` Cada parceiro define um percentual de desconto (0 a 100, uma casa decimal), igual para todos os planos pagos. Registro de uso do cartão (data, parceiro, valor, desconto) serve aos indicadores de economia da família (Q.8: "economia para a família").
- **RN-CRT-12** `[suposição]` O número do cartão é um código fictício no formato `NX-0000-0000` gerado no cadastro da assinatura paga.

## 3. USR: cadastro do cuidador e da pessoa idosa, plano gratuito

- **RN-USR-01** `[doc §4.3.2]` O cliente da Nexus é o **familiar cuidador**, não a pessoa idosa. A pessoa idosa é cadastrada como dependente do cuidador e alcançada de forma indireta.
- **RN-USR-02** `[doc §4.1, 4.5.1]` Ao baixar o aplicativo, o cuidador cadastra a si mesmo e a pessoa idosa (etapas 2 e 3 da jornada, plano gratuito).
- **RN-USR-03** `[doc §5.4]` Com o consentimento do usuário, o cadastro do cuidador registra: idade, sexo e grau de parentesco com a pessoa idosa; e o tempo diário dedicado ao cuidado.
- **RN-USR-04** `[doc §5.4, Q.10]` Tempo de cuidado: informado pelo cuidador no cadastro como **horas por dia** (0 a 24) e atualizável ("horas dedicadas ao cuidado direto"). O piloto também mede **horas semanais** dedicadas à organização do cuidado no início e no final.
- **RN-USR-05** `[doc §5.4]` Dados declarados adicionais: dados sociodemográficos, resposta a um breve registro periódico de bem-estar e avaliações de satisfação.
- **RN-USR-06** `[doc §5.4]` Dados passivos do uso: frequência de acesso, funções utilizadas e pedidos de apoio feitos à equipe pelos canais de atendimento.
- **RN-USR-07** `[doc §1.2, §5.4]` O aplicativo oferece: agenda de consultas e compromissos, lembretes de medicamentos e consultas, registro de medicamentos, conteúdos de orientação para familiares, canal de mensagens com a equipe.
- **RN-USR-08** `[doc §3.5, Fig.1]` Plano Livre: agenda e lembretes, organização básica, conteúdos, acesso inicial à rede. Não inclui Cartão Nexus, conteúdos exclusivos, grupos nem capacitações.
- **RN-USR-09** `[doc §4.1.2]` Respeito à dignidade e à autonomia da pessoa idosa: "organizar o cuidado não significa decidir por quem é cuidado". O cadastro da pessoa idosa guarda só o necessário à organização da rotina (minimização, RN-LGPD-08) e nunca registra decisões em nome dela.
- **RN-USR-10** `[derivada: RN-USR-01]` Cada pessoa idosa pertence a um cuidador principal. O sistema não permite dois cuidadores principais para a mesma pessoa idosa. Outros familiares podem apenas receber informações compartilhadas (RN-USR-11).
- **RN-USR-11** `[doc §4.3.3, §6.4]` As informações organizadas da pessoa idosa são "compartilháveis" com a família estendida **somente com autorização expressa do cuidador**, item a item. Informações vindas de atendimentos e grupos psicológicos jamais entram nesse compartilhamento sem autorização expressa específica.
- **RN-USR-12** `[doc §5.8]` Elegibilidade ao piloto: ser o familiar cuidador principal de pessoa idosa com **algum grau de dependência**, residir em **Uberlândia** e concordar com o termo de consentimento (ver PIL).
- **RN-USR-13** `[suposição]` Grau de dependência da pessoa idosa: enum `independent`, `partial`, `total`. Um cuidador sem pessoa idosa com dependência `partial` ou `total` pode usar o Livre, mas não é elegível ao piloto.
- **RN-USR-14** `[suposição]` O cuidador tem 18 anos ou mais. CPF, e-mail e telefone são obrigatórios; no protótipo, CPFs são sempre fictícios e inválidos (Anexo D).
- **RN-USR-15** `[doc §6.3, §6.5]` O usuário pode exportar seus dados (portabilidade) e pedir revisão de qualquer decisão tomada com base em seus dados (ver LGPD).
- **RN-USR-16** `[doc §5.10 POP-10]` Encerramento do cadastro e exclusão de dados seguem o POP-10 (responsável: gestão) e os direitos do titular (RN-LGPD-20).
- **RN-USR-17** `[suposição]` Estados do cadastro do cuidador: `active`, `paused_by_consent_revocation` (consentimento de saúde revogado, ver RN-LGPD-14), `closure_requested`, `closed`.
- **RN-USR-18** `[doc §5.4, §5.7]` Preferência de canal de contato: aplicativo, WhatsApp ou telefone. Nenhuma função essencial depende exclusivamente do aplicativo (RN-CAN-05).
- **RN-USR-19** `[doc §5.4]` Após cada atendimento da rede, o cuidador recebe, pelo WhatsApp, um formulário curto de avaliação (ver ARP). A avaliação é vinculada a um serviço solicitado e executado.
- **RN-USR-20** `[doc §4.3.1]` Perfil predominante do público (usado só para seed e personas, nunca como regra de acesso): filhas, cônjuges, noras e, com menor frequência, filhos e netos; mulheres de 40 a 65 anos. Personas de referência: Ana (45), Maria (52) e João (68, menos familiaridade com tecnologia, precisa de canais simples).

## 4. ATD: atendimento psicológico

- **RN-ATD-01** `[doc §4.1, §4.4]` O atendimento psicológico é realizado pelos **psicólogos da própria Nexus**, não pela rede credenciada. Os demais serviços são da rede.
- **RN-ATD-02** `[doc §4.1, §4.4.1]` Modalidades: **on-line** ou **presencial**. O presencial ocorre **em domicílio** ou **nas salas do espaço de coworking**. Matriz: online (sem local), presencial_coworking (sala), presencial_domicílio (endereço do cuidador).
- **RN-ATD-03** `[doc §4.4.1, §4.5.1]` O agendamento é feito pelo aplicativo. A etapa "agenda psicólogo ou consulta a rede" (Fig.2, etapa 6) está na fase "atendimento psicológico e rede", disponível a todos os planos.
- **RN-ATD-04** `[derivada: RN-ATD-03, RN-PLN-12]` Usuário Livre pode agendar atendimento psicológico. O que muda por plano são as **condições próprias para assinantes** (RN-ATD-05).
- **RN-ATD-05** `[doc §4.4.1] [suposição para valores]` Assinantes têm "condições próprias" no atendimento psicológico. Os valores não foram definidos pelo documento (§4.7.3 diz que dependem de definição de preços). No protótipo: valor de referência por sessão e desconto por plano são parâmetros editáveis. Padrão do protótipo: sessão de R$ 120,00; desconto de 0% (Livre), 10% (Essencial), 15% (Cuida), 20% (Sustenta); prioridade de agenda para Cuida e Sustenta.
- **RN-ATD-06** `[doc §4.7.1, §6.4, §3.5]` Todo psicólogo que atende pela Nexus tem **inscrição ativa no Conselho Regional de Psicologia**. O responsável técnico é inscrito no CRP-04. Sem registro ativo e válido, o psicólogo não aparece na agenda e não atende.
- **RN-ATD-07** `[doc §6.4, Res. CFP nº 9/2024]` Atendimento remoto: exige inscrição ativa; o profissional é responsável pela adequação da tecnologia, pelo sigilo dos dados e pela **avaliação da pertinência do formato remoto**; em situação de **risco, violência ou urgência** o caso é encaminhado à rede presencial. O sistema obriga o psicólogo a registrar, em cada sessão on-line, a confirmação de pertinência do formato remoto.
- **RN-ATD-08** `[doc §6.4, Res. CFP nº 1/2009 e nº 6/2019]` Cada sessão gera registro documental (anotação) conforme a Res. 1/2009; documentos escritos seguem a Res. 6/2019. O registro integra o prontuário psicológico, é imutável depois de assinado (correções por adendo) e é visível apenas ao psicólogo do caso e ao responsável técnico (RN-LGPD-16).
- **RN-ATD-09** `[doc §4.3.3]` Atendimento em domicílio só quando técnica e legalmente aplicável. O sistema exige confirmação do psicólogo de que o domicílio é adequado e seguro antes de confirmar a sessão presencial em domicílio.
- **RN-ATD-10** `[doc §5.3]` Salas do coworking atendem a requisitos de acessibilidade: acesso sem degraus, sanitário adaptado, boa iluminação e assentos com apoio de braços. A sala tem esses quatro atributos cadastrados e só pode ser reservada se os quatro forem "sim".
- **RN-ATD-11** `[doc §5.7]` Os canais da Nexus não substituem atendimento clínico nem orientação sobre medicação (que cabe ao profissional prescritor). Em emergência, encaminhar ao **SAMU (192)** ou à unidade de urgência mais próxima. O usuário é informado disso por escrito na contratação (aceite registrado).
- **RN-ATD-12** `[derivada: RN-ZRT-12]` Cuidadores em alerta amarelo têm **acompanhamento psicológico prioritário**: ao agendar, ocupam as vagas marcadas como "prioritárias" e aparecem no topo da fila do psicólogo.
- **RN-ATD-13** `[doc §4.4.2]` Quando o psicólogo identifica que a família precisa de outro serviço, ele informa as opções disponíveis na rede e a escolha é do cliente. Nenhum psicólogo da Nexus recebe valor por encaminhar (RN-ETICA-08). O sistema oferece a lista de prestadores (sempre que possível mais de uma opção por especialidade, RN-REDE-10) e **não** oferece campo de indicação de um único prestador preferido.
- **RN-ATD-14** `[suposição]` A agenda do psicólogo é formada por **vagas (slots)** de uma hora, em horário comercial (segunda a sexta, entre 8h e 18h; o psicólogo define quantas horas disponibiliza por mês). As horas disponibilizadas alimentam a ocupação (RN-EQP-01).
- **RN-ATD-15** `[suposição]` Estados da sessão: `scheduled`, `confirmed`, `done`, `cancelled_by_user`, `cancelled_by_psychologist`, `no_show`. Transições: `scheduled` para `confirmed` (até 24 horas antes) ou para qualquer cancelamento; `confirmed` para `done`, `no_show` ou cancelamento. Só sessão `done` conta como "horas realizadas".
- **RN-ATD-16** `[suposição]` Cancelamento pelo usuário com antecedência mínima de 24 horas; menos que isso vira `no_show` para fins de ocupação, sem cobrança no protótipo.
- **RN-ATD-17** `[doc §4.2.3 e §5.4]` O psicólogo tem a visão da fila de acompanhamento: cuidadores sob sua responsabilidade, com alertas Zarit/ARBE (somente os que lhe cabem) e próximas aplicações da escala (ver ZRT).
- **RN-ATD-18** `[doc §6.4]` Informações trazidas em atendimento não são compartilhadas com familiares sem autorização expressa. O sistema não possui função de "enviar resumo para familiar" sem registrar autorização específica.
- **RN-ATD-19** `[doc §6.4, Res. CFP nº 13/2022]` Psicoterapia (inclusive terapia de grupo) e atividades de orientação/psicoeducação são distintas. O sistema classifica cada atendimento como `psychotherapy` ou `guidance` e exibe essa classificação ao usuário.
- **RN-ATD-20** `[doc §6.4]` Nenhuma decisão técnica do atendimento (frequência, duração, encaminhamento) usa critério comercial, nem o plano do cuidador como motivo de recusa de atendimento ou de priorização clínica (a prioridade de agenda do RN-ATD-05 é só de disponibilidade de vaga, nunca de decisão clínica).

## 5. GRP: grupos de apoio e capacitações

- **RN-GRP-01** `[doc §4.3.4, §6.4]` Tipos de atividade: **grupo de apoio** (orientação e psicoeducação), **capacitação** (orientação e psicoeducação aplicada), **terapia de grupo** (psicoterapia, "quando oferecida"), e **roda de conversa aberta** à comunidade.
- **RN-GRP-02** `[doc Fig.1, §4.5.1, Q.8, Apêndice A]` Acesso a grupos de apoio e capacitações: planos **Cuida e Sustenta**. Livre e Essencial não se inscrevem.
- **RN-GRP-03** `[doc §5.2, §5.6]` Rodas de conversa abertas são abertas à comunidade (inclusive usuários Livre e não usuários), podem ser feitas em parceria com CRAS, unidades básicas de saúde e associações de bairro, e funcionam como canal de captação.
- **RN-GRP-04** `[doc §4.3.4, §6.4]` Terapia de grupo, quando oferecida, é conduzida **por psicólogos da Nexus com inscrição ativa no CRP**, com objetivo clínico definido, e sob os parâmetros do CFP. É um dispositivo distinto dos grupos de apoio e das capacitações, e o usuário é informado dessa distinção.
- **RN-GRP-05** `[doc §4.3.4]` Temas dos grupos: sobrecarga do cuidador; comunicação com a pessoa idosa; organização da rotina; manejo de situações difíceis; autocuidado; saúde emocional; prevenção de conflitos familiares; orientações básicas sobre o cuidado.
- **RN-GRP-06** `[doc §4.3.4]` Temas das capacitações (de aplicação imediata): primeiros socorros; higiene e banho no leito; prevenção de quedas; administração segura de medicamentos; alimentação e prevenção de engasgo; comunicação com pessoas com demência.
- **RN-GRP-07** `[doc §4.3.4]` As capacitações são conduzidas pela equipe da Nexus e por profissionais parceiros. Os grupos de apoio e as terapias de grupo são conduzidos por profissionais convidados ou credenciados (Q.7), com a formação do item 5.9 (RN-CAP-03), e a terapia de grupo exclusivamente por psicólogo Nexus (RN-GRP-04).
- **RN-GRP-08** `[doc §4.5.1, §5.5]` A Nexus organiza as turmas, define os profissionais responsáveis e informa a programação pelo aplicativo. A programação dos grupos e das capacitações é montada **mensalmente** e divulgada no aplicativo.
- **RN-GRP-09** `[doc §6.4]` Cada grupo tem um **contrato inicial de sigilo** entre os participantes. O participante só entra na turma depois de aceitar esse contrato (aceite registrado com data e hora).
- **RN-GRP-10** `[doc §6.4]` O que é dito em grupo não é compartilhado com familiares sem autorização expressa (RN-USR-11).
- **RN-GRP-11** `[doc §4.5.2, §5.3]` Os encontros presenciais ocorrem nas salas do coworking, com os requisitos de acessibilidade do RN-ATD-10; encontros on-line são permitidos.
- **RN-GRP-12** `[doc §5.5]` A participação em grupos e capacitações é indicador de acompanhamento (RN-KPI-08): contam inscritos, presentes e taxa de presença por atividade.
- **RN-GRP-13** `[suposição]` Capacidade por turma de 12 participantes (padrão, editável). Turma lotada abre **lista de espera**; vaga liberada promove o primeiro da fila e o avisa. Estados da turma: `draft`, `open`, `full`, `in_progress`, `finished`, `cancelled`.
- **RN-GRP-14** `[suposição]` Terapia de grupo exige indicação do psicólogo responsável pelo cuidador (campo "elegível"). Grupos de apoio e capacitações não exigem indicação.
- **RN-GRP-15** `[doc §4.6.2, §6.4]` A divulgação de grupos e capacitações não promete resultado terapêutico, não usa o sofrimento como apelo e, quando divulgar serviço de Psicologia, informa o número de inscrição profissional do responsável.
- **RN-GRP-16** `[doc §4.3.4]` O dispositivo informa, na página da atividade, qual é o caráter dela ("orientação e psicoeducação" ou "psicoterapia"), com o registro documental exigido para cada caso (RN-ATD-08).
- **RN-GRP-17** `[doc Fig.1, derivada]` Usuário que cai de plano (por exemplo, Cuida para Essencial) perde a inscrição em turmas futuras; turmas em andamento no ciclo já pago permanecem até o fim do ciclo.

## 6. REDE: rede credenciada

- **RN-REDE-01** `[doc §4.4.2, Fig.5]` A rede credenciada **complementa** o atendimento psicológico da Nexus e reúne profissionais e empresas de outras áreas do cuidado da pessoa idosa: fisioterapia, cuidadores, home care, profissionais de saúde, farmácias, clínicas e serviços especializados. A Figura 5 inclui psicologia na rede (ver RN-REDE-13).
- **RN-REDE-02** `[doc §4.4.2, Fig.5]` A rede é **aberta a diferentes áreas**; a variedade não compromete a confiança porque o credenciamento segue critérios. Categorias aceitas no protótipo: fisioterapia, cuidador(a) profissional, home care, enfermagem, farmácia, clínica, odontologia, psicologia, nutrição, advocacia, serviço especializado.
- **RN-REDE-03** `[doc §4.4.2]` Critérios de credenciamento (todos obrigatórios): (1) **verificação de registro ativo no conselho de classe, quando houver**; (2) **comprovação de formação**; (3) **contrato de credenciamento**; (4) **termo de proteção de dados**; (5) **avaliação contínua pelos usuários**, com possibilidade de descredenciamento.
- **RN-REDE-04** `[doc §4.4.2, §6.3]` Para categorias com conselho (a lista é ilustrativa: CREFITO, COREN, CRO, CRN, CRP, OAB e similares), o registro precisa estar **ativo** e é verificado no credenciamento. Para categorias sem conselho (por exemplo, cuidador sem regulamentação própria, farmácia como empresa), o critério (1) é registrado como "não se aplica", e os demais continuam obrigatórios.
- **RN-REDE-05** `[doc §4.4.2]` A formação do profissional é comprovada por documento (diploma, certificado ou equivalente) anexado ao processo.
- **RN-REDE-06** `[doc §4.4.2, §6.3, Apêndice B item 4]` O contrato de credenciamento tem cláusulas de conduta, sigilo e proteção de dados. A minuta (Anexo H do documento) é do jurídico; o ERP registra versão do contrato, data de assinatura e o arquivo.
- **RN-REDE-07** `[doc §4.4.2, §6.5]` O termo de proteção de dados é assinado por todo credenciado; os que tiverem acesso a dados de usuários assinam cláusula específica de proteção de dados (RN-LGPD-13).
- **RN-REDE-08** `[doc §4.4.2, §5.10]` Avaliação contínua pelos usuários e possibilidade de descredenciamento seguem o POP-02 e o ARP (ver ARP).
- **RN-REDE-09** `[doc §4.4.2, Fig.5]` A Nexus é **organizadora e conectora** da rede, sem substituir a responsabilidade técnica dos profissionais. Os profissionais da rede respondem tecnicamente pelo que prestam e **não são empregados** da Nexus (Q.7).
- **RN-REDE-10** `[doc §4.5.1]` Para preservar a autonomia de escolha da família e evitar direcionamento comercial, a busca apresenta, **sempre que possível, mais de uma opção por especialidade**, com informações claras sobre cada prestador. Se houver apenas um prestador ativo na especialidade, o sistema o mostra com aviso "única opção disponível no momento", nunca o esconde.
- **RN-REDE-11** `[doc §4.4, §4.4.2]` Serviços da rede são **contratados diretamente pelo usuário** e pagos por ele ao prestador, conforme condições estabelecidas com cada prestador. O ERP não intermedeia pagamento ao prestador.
- **RN-REDE-12** `[doc §4.4.2, §6.4, Fig.5]` A Nexus **não cobra porcentagem** sobre atendimentos da rede. A receita da Nexus vem de assinaturas, parcerias comerciais e canal corporativo. Não existe, no ERP, campo de comissão, taxa de intermediação, repasse ou "percentual por encaminhamento" para prestadores de qualquer categoria, e menos ainda para psicólogos. (O título do item 4.4.2 cita "taxa de intermediação", mas o texto afirma que ela não incide sobre atendimentos; ver Anexo B, I-11.)
- **RN-REDE-13** `[doc §6.4, Fig.5]` Psicólogos da rede (diferentes dos psicólogos da equipe da Nexus) são credenciados como qualquer outro profissional e são pagos diretamente pelo usuário.
- **RN-REDE-14** `[doc §5.1, §6.4]` Integrantes do grupo fundador que sejam psicólogos e atuem na rede o fazem **como qualquer outro credenciado**, nas mesmas condições, sem participação em valores ligados a encaminhamentos.
- **RN-REDE-15** `[doc 00-contexto, §4.4.2]` Um dentista com registro ativo no CRO é credenciado legítimo (a rede aceita "profissionais de saúde, clínicas e serviços especializados"). Exemplo oficial de teste: cirurgião-dentista fictício com CRO fictício.
- **RN-REDE-16** `[doc §5.9]` Vedação de **captação paralela**: o credenciado não pode usar o contato com usuários Nexus para captá-los fora das condições da rede. O contrato e a integração registram o aceite dessa vedação.
- **RN-REDE-17** `[doc §6.3]` O usuário é informado com clareza sobre o papel da Nexus como organizadora da rede (não prestadora). O aviso aparece na ficha de cada prestador e no momento da solicitação.
- **RN-REDE-18** `[doc §5.10 POP-02, §5.10.1]` Prestador com status `suspended` **deixa de aparecer na busca** do aplicativo (RN-ARP-10). Prestador em `monitoring` continua aparecendo.
- **RN-REDE-19** `[doc §5.10.1]` Prestador na zona de excelência (média igual ou superior a 4,5) tem permanência assegurada e **destaque nas buscas**, sem prejuízo da regra de mais de uma opção por especialidade (RN-REDE-10): o destaque nunca elimina os demais da lista.
- **RN-REDE-20** `[doc §5.10 POP-02] [suposição para estados]` Fluxo de credenciamento (responsável: gestão): `requested` (solicitado) para `in_review` (em análise) para `pending_documents` (pendente) ou `approved` ou `rejected`; `approved` para `active`. Ativo evolui para `monitoring`, `suspended` e `deaccredited` pelas regras do ARP. `rejected` e `deaccredited` são estados finais, e um novo credenciamento abre novo processo.
- **RN-REDE-21** `[derivada: RN-REDE-03]` O processo só passa a `approved` quando os cinco critérios estiverem cumpridos (ou "não se aplica" no caso do registro em categorias sem conselho) e todos os documentos estiverem **dentro da validade**.
- **RN-REDE-22** `[suposição]` Documento vencido (registro do conselho com validade expirada, por exemplo) impede aprovação. Em prestador já ativo, documento vencido gera alerta para a gestão e, se não regularizado em 30 dias, a suspensão automática da busca (`suspended`, motivo "documento vencido").
- **RN-REDE-23** `[suposição]` Reprovação exige motivo textual e fica registrada; o candidato recebe comunicação por e-mail.
- **RN-REDE-24** `[doc §5.9]` Todo credenciado passa pela **integração** (modelo Nexus, lugar do cuidador, regras de atendimento, sigilo, proteção de dados, vedação de captação paralela) e recebe os POPs (RN-POP-12). Aprovação registra a data da integração.
- **RN-REDE-25** `[doc Fig.1, §4.4.1]` Usuário Livre tem **acesso inicial à rede**: pode consultar a rede e comparar opções. **Condições especiais na rede** valem do Essencial em diante, e **benefícios diferenciados na rede** valem no Sustenta. As condições de cada prestador (valores, descontos) são as que ele combina com a Nexus para usuários Nexus.
- **RN-REDE-26** `[doc §4.5.1, §5.5]` Fluxo de solicitação (`ServiceRequest`): o usuário consulta, compara, escolhe e solicita um serviço; o prestador aceita ou recusa; o serviço é realizado; o usuário avalia. Estados: `requested`, `accepted`, `refused_by_provider`, `cancelled_by_provider`, `cancelled_by_user`, `completed`, `evaluated`.
- **RN-REDE-27** `[doc §5.4, Q. de indicadores]` **Taxa de recusa** do prestador = solicitações **recusadas ou canceladas pelo prestador** nos últimos 30 dias ÷ solicitações recebidas no período × 100. Serve para antecipar a saída de prestadores e planejar novas parcerias.
- **RN-REDE-28** `[suposição para limiar]` Limiar de atenção da taxa de recusa: 30% ou mais, com no mínimo 5 solicitações recebidas em 30 dias (editável). Acima do limiar o prestador aparece com selo "risco de saída" na gestão e no painel. Não há ação automática de descredenciamento por recusa.
- **RN-REDE-29** `[doc §5.4]` A **redução da disponibilidade de agenda** do prestador é sinal de possível saída. O ERP registra o número de horários disponíveis publicados pelo prestador por semana e sinaliza queda superior a 50% em relação à média das 4 semanas anteriores `[suposição para o limiar de 50%]`.
- **RN-REDE-30** `[derivada: RN-REDE-10, §4.5.1]` Ficha do prestador mostra: especialidade, registro profissional e conselho, cidade, se atende em domicílio, condições para usuários Nexus, disponibilidade, nota ARP (quando houver média válida), número de avaliações e selo "em destaque" quando estiver na zona de excelência. A zona de monitoramento não é exibida ao usuário.
- **RN-REDE-31** `[doc §6.3]` Descredenciamento segue **procedimento formal**: suspensão da busca, avaliação interna com direito a justificativas, decisão registrada e comunicação por e-mail (ver ARP-10 a ARP-13).
- **RN-REDE-32** `[doc §4.4.2, §6.3]` O prestador responde tecnicamente pelos serviços que presta, e o ERP não registra decisões técnicas em nome dele.
- **RN-REDE-33** `[doc §3.5, §5.1]` Na fase inicial pode haver rotatividade de prestadores (remuneração proporcional ao volume). O painel de rede mostra entradas e saídas por mês para acompanhamento.

## 7. ARP: Avaliação da Rede Profissional

- **RN-ARP-01** `[doc §4.3.5, §5.4]` A ARP reúne as avaliações feitas pelos usuários após cada atendimento da rede e acompanha indicadores como taxa de recusa e redução da disponibilidade de agenda. Seus dados alimentam o POP-02.
- **RN-ARP-02** `[doc §5.10, §5.10.1]` Após cada atendimento da rede, o cuidador recebe pelo WhatsApp (no protótipo: pelo registro do serviço concluído) um formulário com **duas notas de 1 a 5**: (a) qualidade técnica; (b) pontualidade e cordialidade; mais **campo aberto** para comentários. As duas notas são obrigatórias, inteiras, de 1 a 5.
- **RN-ARP-03** `[derivada: RN-ARP-02, Q. de indicadores]` Nota da avaliação = média aritmética das duas notas (por exemplo, 5 e 4 resultam 4,5). A nota do prestador = média aritmética das notas de todas as suas avaliações válidas ("média histórica", 5.10.1). Equivale à média de todas as notas individuais.
- **RN-ARP-04** `[doc §5.10]` A média só é calculada quando o prestador tem **pelo menos cinco avaliações**. Abaixo disso, o prestador aparece com "sem média (menos de 5 avaliações)" e não entra em nenhuma faixa, mas as reclamações graves (RN-ARP-09) continuam contando.
- **RN-ARP-05** `[doc §5.10, §5.10.1]` A média de cada prestador é calculada **a cada 15 dias** (auditoria quinzenal). O resultado de cada auditoria é gravado como instantâneo (data, média, número de avaliações, faixa, reclamações graves) e não é recalculado depois.
- **RN-ARP-06** `[doc §5.10, §5.10.1]` Faixa **excelência**: média **igual ou superior a 4,5**. Permanência assegurada; destaque nas buscas (RN-REDE-19).
- **RN-ARP-07** `[doc §5.10, §5.10.1]` Faixa **alerta (monitoramento)**: média **igual ou superior a 4,0 e inferior a 4,5**. O sócio responsável entra em contato com o prestador para entender se a queda decorreu de problema logístico ou de conflito pontual, combina ajustes e acompanha a evolução **nas quinzenas seguintes**. Prestador em monitoramento continua na busca.
- **RN-ARP-08** `[doc §5.10, §5.10.1]` Faixa **descredenciamento**: média **inferior a 4,0**, **ou** registro de **mais de duas reclamações graves** (três ou mais) no campo aberto, como faltas sem justificativa ou quebra de sigilo. A regra "ou" vale independentemente da média; `[derivada: RN-ARP-04]` por isso vale também com menos de cinco avaliações, já que só a média exige o mínimo.
- **RN-ARP-09** `[doc §5.10, §5.10.1]` "Reclamação grave" é a registrada no campo aberto ou em reclamação formal (POP-08) e classificada pela gestão como grave: falta sem justificativa, quebra de sigilo e equivalentes. A classificação é feita por pessoa autorizada, com data, e fica vinculada ao prestador.
- **RN-ARP-10** `[doc §5.10.1]` Entrar na faixa de descredenciamento **suspende imediatamente** o prestador das indicações (sai da busca) e abre **avaliação interna**, na qual ele pode apresentar justificativas.
- **RN-ARP-11** `[doc §5.10, §5.10.1]` Se a avaliação interna **confirma o problema**, o credenciamento é **encerrado**; o fim do vínculo é **formalizado por e-mail** (registrado no ERP com data, texto e destinatário). Se não confirma, o prestador volta à faixa correspondente à média, e a decisão fica registrada com motivo.
- **RN-ARP-12** `[doc §5.10.1]` O desligamento assegura a conformidade ética e jurídica da Nexus e protege as pessoas idosas atendidas de condutas negligentes.
- **RN-ARP-13** `[doc §5.10.1, §6.3]` Reclamação que envolva **suspeita de violência ou negligência contra a pessoa idosa** segue, além do ARP, o **POP-07** (RN-POP-07), com encaminhamento imediato ao responsável técnico.
- **RN-ARP-14** `[doc §5.5]` Rotina: **quinzenalmente** as avaliações da rede são auditadas; **a cada trimestre** os resultados consolidados são apresentados aos sócios; **mensalmente** a reunião de equipe revisa a rede e as reclamações.
- **RN-ARP-15** `[suposição]` Arredondamento: a média é arredondada a duas casas decimais (meio para cima) antes da classificação. Assim, 4,495 vira 4,50 (excelência) e 3,995 vira 4,00 (alerta).
- **RN-ARP-16** `[derivada: RN-USR-19]` Só avalia quem solicitou o serviço e o teve concluído, uma avaliação por serviço. Avaliação não pode ser editada pelo prestador. O cuidador pode corrigir a própria avaliação em até 7 dias `[suposição]`.
- **RN-ARP-17** `[doc §5.10.1] [suposição para mecânica]` A gestão pode marcar o prestador "reinstalado" se a avaliação interna reverter a suspensão. Reinstalação por decisão exige motivo e registro; o prestador volta à busca e a próxima auditoria quinzenal reclassifica.
- **RN-ARP-18** `[doc §6.5, §5.4]` O prestador (portal) vê a própria nota, a faixa em que está (só o nome da faixa em linguagem neutra) e comentários **sem identificação do cuidador**. A gestão vê as avaliações com identificação pseudonimizada do cuidador.
- **RN-ARP-19** `[doc §5.4]` Sinais complementares ao ARP exibidos junto à nota: taxa de recusa (RN-REDE-27) e variação da disponibilidade de agenda (RN-REDE-29).

## 8. ZRT: Escala de Sobrecarga do Cuidador de Zarit

- **RN-ZRT-01** `[doc §5.4, §5.8]` A Escala de Zarit (Zarit Burden Interview), validada para o Brasil por Scazufca (2002), mede a sobrecarga percebida pelo cuidador. O ERP a usa como instrumento de acompanhamento, nunca como diagnóstico.
- **RN-ZRT-02** `[doc §5.4, §5.8]` A versão brasileira tem **22 itens**, cada um respondido de **0 a 4** (0 = nunca; 4 = sempre/quase sempre). Rótulos intermediários do protótipo: 1 raramente, 2 algumas vezes, 3 frequentemente `[suposição]`. Todos os 22 itens são obrigatórios.
- **RN-ZRT-03** `[doc §5.4, §5.8]` Pontuação total = soma dos 22 itens, inteiro de **0 a 88**. Quanto maior, maior a sobrecarga percebida. O total é sempre calculado pelo sistema, não digitado.
- **RN-ZRT-04** `[doc §5.4, §5.8]` A escala é **aplicada pela equipe de psicologia** (psicólogo responsável pelo cuidador). O cuidador não a preenche sozinho. O resultado fica visível a ele no aplicativo (RN-ZRT-19).
- **RN-ZRT-05** `[doc §5.4, Q. de indicadores]` Frequência: **na adesão** e **a cada três meses** depois dela. A próxima aplicação vence 3 meses calendário depois da última (por exemplo, 15/02 resulta 15/05; dia inexistente cai no último dia do mês).
- **RN-ZRT-06** `[doc §5.8, Q.10]` No piloto, a aplicação é na **adesão, aos 3 e aos 6 meses**. A aplicação aos 6 meses coincide com a segunda reaplicação trimestral. (O texto 5.4 diz também "três a seis meses de uso"; ver Anexo B, I-09.)
- **RN-ZRT-07** `[doc §5.4] [suposição para Livre]` "Adesão" é o ingresso do cuidador no serviço, com o consentimento de dados de saúde concedido. A primeira aplicação deve ocorrer na adesão, independentemente do plano, incluído o Livre. Se o consentimento não existir, a aplicação não pode ser registrada (RN-LGPD-14).
- **RN-ZRT-08** `[doc §5.8, Q. de faixas]` Faixas de pontuação e classificação (valores inclusivos): **0 a 20** sobrecarga ausente ou pequena; **21 a 40** sobrecarga moderada; **41 a 60** sobrecarga moderada a severa; **61 a 88** sobrecarga severa. Classificação conforme Luzardo, Gorini e Silva (2006).
- **RN-ZRT-09** `[doc §5.8]` Conduta na faixa **0 a 20**: conteúdos de orientação e convite para os grupos de apoio. O convite é informativo; a participação em grupos obedece ao plano (RN-GRP-02), e rodas abertas valem para todos (RN-GRP-03). Ver Anexo B, I-10.
- **RN-ZRT-10** `[doc §5.8]` Conduta na faixa **21 a 40**: oferta de atendimento psicológico e convite para os grupos e as capacitações.
- **RN-ZRT-11** `[doc §5.8]` Conduta na faixa **41 a 60**: ver RN-ZRT-12 (alerta amarelo).
- **RN-ZRT-12** `[doc §5.8]` **Alerta amarelo** (41 a 60): **acompanhamento psicológico prioritário**, com foco no manejo do estresse, e **revisão da rede de apoio da família**. O sistema cria o alerta, cria tarefa "revisar rede de apoio" para o psicólogo responsável e dá prioridade de agenda (RN-ATD-12).
- **RN-ZRT-13** `[doc §5.8]` **Alerta vermelho** (61 a 88): **contato da equipe no mesmo dia**, **avaliação de risco pelo psicólogo** e, **se necessário**, **encaminhamento à rede de urgência conforme o POP-05** (RN-POP-05, RN-ENC-03).
- **RN-ZRT-14** `[doc §5.8, derivada]` "Mesmo dia" = mesma data civil do registro da aplicação, em horário de Brasília. O alerta vermelho nasce com prazo até 23h59 desse dia. Se não houver registro de contato até lá, o alerta passa a `overdue` e é escalado ao responsável técnico `[suposição para a escalada]`.
- **RN-ZRT-15** `[doc §5.8, §6.5]` O alerta vermelho exige registro de: horário do contato, quem fez, resultado da avaliação de risco e, se houve, o encaminhamento (RN-POP-05, RN-ENC). Sem esses campos o alerta não pode ser encerrado.
- **RN-ZRT-16** `[doc §5.4, Q. de indicadores]` **Evolução da sobrecarga (%)** = (pontuação atual − pontuação na adesão) ÷ pontuação na adesão × 100. **Valores negativos indicam redução** de sobrecarga.
- **RN-ZRT-17** `[derivada: RN-ZRT-16]` Casos de borda: pontuação de adesão igual a 0 (divisão por zero) exibe "n/d" (não definido) e a evolução em pontos absolutos; aplicação de adesão é a própria referência (evolução 0%, exibida como "referência"). Exibição com uma casa decimal, formato pt-BR, e sinal explícito (+/−).
- **RN-ZRT-18** `[doc §4.3.5, §5.4]` Nenhum alerta gerado pelos dados é diagnóstico. Os indicadores apoiam a escuta clínica; toda decisão sobre o acompanhamento cabe ao psicólogo responsável.
- **RN-ZRT-19** `[doc §6.5]` Os resultados da Zarit e os alertas ficam **restritos aos psicólogos responsáveis pelo acompanhamento e ao próprio cuidador**, que os consulta no aplicativo. Gestão e atendimento **não** veem escores individuais (ver RN-LGPD-16 e RN-KPI-02 para o que é agregado).
- **RN-ZRT-20** `[doc §6.5]` O cuidador pode **pedir a revisão** de qualquer decisão tomada com base nos resultados e alertas. O sistema registra o pedido, o prazo e a resposta do psicólogo.
- **RN-ZRT-21** `[doc §6.5]` Os resultados fazem parte do acompanhamento psicológico e integram o **registro documental** exigido pelo CFP (Res. 1/2009): aplicação assinada e imutável (correção por adendo `[suposição]`).
- **RN-ZRT-22** `[doc §5.8]` No piloto sem grupo de comparação, a redução dos escores ao longo de seis meses é lida como **indício** de que o acompanhamento ajuda, **não como prova** de eficácia clínica. Painéis e textos do ERP não usam a palavra "eficácia" para esse resultado.
- **RN-ZRT-23** `[doc §4.3.2]` O cuidador vê no aplicativo como o próprio cansaço evolui (linha do tempo de pontuações e faixas) e recebe apoio antes que ele se agrave.
- **RN-ZRT-24** `[suposição]` Estados da aplicação: `scheduled` (vencimento calculado), `due` (vence em até 14 dias), `overdue` (venceu), `completed`. Estados do alerta (amarelo e vermelho): `open`, `contacted`, `risk_assessed`, `closed`, e `overdue` para o vermelho sem contato no mesmo dia.
- **RN-ZRT-25** `[derivada: RN-ZRT-08]` Valores de fronteira testáveis: 0, 20 e 21, 40 e 41, 60 e 61, 88. Total fora de 0 a 88 é impossível por construção; respostas fora de 0 a 4 são rejeitadas.
- **RN-ZRT-26** `[doc §4.3.5, §6.5]` Aplicar a Zarit para fins de People Analytics exige **consentimento específico** do titular (RN-LGPD-03). Sem consentimento de tratamento de dados de saúde para o acompanhamento, o cuidador não é incluído em nenhum painel.

## 9. ARBE: Avaliação de Risco de Burnout e Esgotamento

- **RN-ARBE-01** `[doc §5.4]` A ARBE cruza dados informados no aplicativo, **horas diárias de cuidado** e **frequência dos pedidos de apoio**, com os resultados da **Escala de Zarit**. Quando a combinação **ultrapassa os limites definidos pela equipe**, é emitido **alerta aos psicólogos da Nexus**, que **entram em contato com o cuidador**.
- **RN-ARBE-02** `[doc §5.4]` Exemplo do documento: a persona Ana, caso seus registros indicassem que ela chega a níveis críticos de sobrecarga emocional. O seed inclui uma cuidadora assim (Anexo de seed no 02).
- **RN-ARBE-03** `[doc §4.3.5, §5.4]` A ARBE não é diagnóstico (RN-ZRT-18). O alerta é um sinal para a escuta clínica; a decisão é do psicólogo.
- **RN-ARBE-04** `[doc §5.4]` Na fase de MVP, os alertas são gerados por **regras configuradas** e **revisados pela equipe**; automação dentro do aplicativo é avaliada depois. No ERP, o alerta gerado por regra nasce `generated` e só vira `confirmed` quando um psicólogo o revisa.
- **RN-ARBE-05** `[suposição]` Limites padrão (o documento diz que a equipe os define e não informa valores): (a) horas diárias de cuidado **maiores ou iguais a 8**; (b) **3 ou mais** pedidos de apoio nos últimos 30 dias; (c) última Zarit **maior ou igual a 41**. Os três limites são editáveis em Configurações, por responsável técnico.
- **RN-ARBE-06** `[suposição]` Nível do alerta: `attention` quando **2 dos 3** critérios são atendidos; `critical` quando **os 3** são atendidos **ou** a última Zarit é maior ou igual a 61. Alerta vermelho de Zarit segue o RN-ZRT-13 e RN-ZRT-14 (mesmo dia). Para alerta ARBE sem Zarit vermelha, prazo de referência para o contato do psicólogo: `critical` em até 1 dia útil; `attention` em até 5 dias úteis `[suposição]`.
- **RN-ARBE-07** `[doc §6.5]` Os alertas ARBE seguem a mesma restrição de acesso da Zarit: somente psicólogos responsáveis, responsável técnico e o próprio cuidador. A gestão vê apenas contagens agregadas (RN-KPI-02).
- **RN-ARBE-08** `[suposição]` Estados do alerta ARBE: `generated`, `confirmed`, `contacted`, `closed`, `discarded` (descartado com motivo). Não se gera novo alerta enquanto houver um aberto para o mesmo cuidador com o mesmo nível.
- **RN-ARBE-09** `[derivada: RN-LGPD-14]` Cuidador com consentimento de saúde revogado sai do cálculo da ARBE e dos painéis; alertas abertos são encerrados com motivo "consentimento revogado".
- **RN-ARBE-10** `[doc §5.4]` Horas diárias e pedidos de apoio são dados declarados e passivos do aplicativo. O cuidador pode corrigir as horas informadas a qualquer momento; a correção gera nova avaliação ARBE.

## 10. EQP: carga da equipe de psicologia

- **RN-EQP-01** `[doc §5.4, §5.5, Q. de indicadores]` **Ocupação da agenda** = horas de atendimento **realizadas** no mês ÷ horas **disponibilizadas** na agenda × 100, por psicólogo, em mês calendário.
- **RN-EQP-02** `[doc §5.5]` Regra de sobrecarga: ocupação **acima de 80%** (estritamente maior que 80) por **dois meses seguidos** faz a agenda ser **redistribuída** ou, **quando a receita permitir**, a equipe ser **ampliada**.
- **RN-EQP-03** `[doc §5.4]` Finalidade: as horas dos psicólogos são acompanhadas para que **quem cuida do cuidador não fique sobrecarregado** (terceira frente do People Analytics).
- **RN-EQP-04** `[derivada: RN-EQP-02]` O alerta nasce quando, para um psicólogo, a ocupação dos **dois últimos meses fechados** é, em cada um, maior que 80%. O mês corrente é exibido como parcial e **não** conta para a regra. O alerta é desfeito quando o último mês fechado fica igual ou inferior a 80%.
- **RN-EQP-05** `[suposição]` Redistribuição: o responsável técnico ou a gestão transfere sessões futuras agendadas e cuidadores sob responsabilidade para outro psicólogo com ocupação inferior a 80%. A transferência registra motivo e preserva o sigilo (o novo psicólogo só vê o prontuário após receber o caso, com registro no log).
- **RN-EQP-06** `[doc §5.5, derivada]` Ampliação da equipe só é recomendada quando o resultado mensal realizado for positivo (receita permitindo). O painel mostra a condição, mas a decisão é dos sócios.
- **RN-EQP-07** `[doc §6.5, derivada]` A gestão vê horas disponibilizadas, realizadas e ocupação por psicólogo, **sem** conteúdo clínico nem identificação de pacientes.
- **RN-EQP-08** `[derivada: RN-EQP-01]` Horas disponibilizadas = 0 no mês: ocupação "n/d" (sem agenda), sem alerta. Horas realizadas maiores que as disponibilizadas (extras): ocupação pode passar de 100% e é exibida como está.
- **RN-EQP-09** `[doc §5.5]` Os indicadores de equipe entram na reunião mensal e na apresentação trimestral aos sócios.

## 11. KPI: indicadores

Todos os indicadores listados no documento (5.5, Quadro de indicadores, Quadro 10 do piloto, 4.7) com fórmula. Eles "mostram onde olhar", não decidem (RN-ZRT-18).

- **RN-KPI-01** `[doc §5.5]` Os indicadores revistos na reunião mensal da equipe são oito: número de usuários gratuitos; número de assinantes; taxa de conversão; uso do aplicativo; avaliação dos prestadores; escores de sobrecarga dos cuidadores; participação em grupos e capacitações; reclamações recebidas. O quadro de indicadores do item 5.5 acrescenta evolução da sobrecarga, taxa de recusa e ocupação da agenda (RN-KPI-03, 10 e 11).
- **RN-KPI-02** `[doc Q. de indicadores, §6.5]` **Sobrecarga do cuidador** = pontuação da Escala de Zarit (0 a 88), aplicada na adesão e a cada 3 meses; serve para identificar a faixa e definir a conduta. Para a gestão, só existe em forma **agregada e pseudonimizada**: distribuição por faixa, média e contagem de alertas, sempre com **mínimo de 5 cuidadores por grupo exibido** `[suposição para o mínimo]`.
- **RN-KPI-03** `[doc Q. de indicadores]` **Evolução da sobrecarga (%)** = (pontuação atual − pontuação na adesão) ÷ pontuação na adesão × 100; negativo indica redução. Agregado: média das evoluções dos cuidadores com pelo menos duas aplicações.
- **RN-KPI-04** `[doc §5.5, §4.7.3]` **Usuários gratuitos (acumulados)** = total de cuidadores cadastrados (todo cadastro nasce no Livre, e quem assina continua contando na base de origem), excluídos os cadastros encerrados `[suposição para a exclusão]`.
- **RN-KPI-05** `[doc §5.5]` **Assinantes** = assinaturas pagas ativas (inclui as pagas por empresas do canal corporativo), com abertura por plano (Essencial, Cuida, Sustenta).
- **RN-KPI-06** `[doc §4.7.3, §5.5]` **Taxa de conversão (%)** = assinantes ÷ usuários gratuitos acumulados × 100. Referência do plano: 5 a cada 100 (5%), com cenários de 3% e 7%; a literatura do freemium citada vai de 2% a 5%. O painel mostra a conversão realizada ao lado das três referências.
- **RN-KPI-07** `[doc §5.4, §5.5, Q.10]` **Uso do aplicativo**: acessos, funções usadas e frequência, medido de forma contínua. No protótipo: acessos por usuário nos últimos 30 dias; porcentagem de usuários ativos (pelo menos 1 acesso em 30 dias); quantidade de funções distintas usadas `[suposição para as definições operacionais]`.
- **RN-KPI-08** `[doc §5.5]` **Participação em grupos e capacitações** = inscritos, presentes e taxa de presença (presentes ÷ inscritos × 100) por atividade, mais o preenchimento de vagas `[suposição para as fórmulas]`.
- **RN-KPI-09** `[doc Q. de indicadores]` **Avaliação da rede** = média das notas de 1 a 5 dadas pelos cuidadores após cada atendimento; serve para manter a qualidade e embasar descredenciamento. Calculada por prestador (ARP) e agregada para a rede inteira (média ponderada pelo número de avaliações).
- **RN-KPI-10** `[doc Q. de indicadores, §5.4]` **Taxa de recusa (%)** = solicitações recusadas ou canceladas pelo prestador nos últimos 30 dias ÷ solicitações recebidas no período × 100; antecipa a saída de prestadores.
- **RN-KPI-11** `[doc Q. de indicadores]` **Ocupação da agenda (%)** = horas de atendimento realizadas no mês ÷ horas disponibilizadas na agenda × 100; acima de 80% por dois meses seguidos, redistribuição ou ampliação (RN-EQP-02).
- **RN-KPI-12** `[doc §5.5, §6.3]` **Reclamações recebidas** = quantidade no período, com abertas, resolvidas e tempo médio até a primeira resposta `[suposição para os subitens]`. O canal tem prazo de resposta (RN-POP-08).
- **RN-KPI-13** `[doc Q.10]` **Tempo dedicado à organização do cuidado** = horas semanais informadas pelo cuidador, no início e no final do piloto; variação = final menos início.
- **RN-KPI-14** `[doc Q.10]` **Satisfação e recomendação** (final do piloto): questionário e entrevista semiestruturada. No protótipo: nota de satisfação de 1 a 5 e resposta "recomendaria" (sim/não); recomendação (%) = "sim" ÷ respondentes × 100 `[suposição para as fórmulas]`.
- **RN-KPI-15** `[doc Q.10]` **Disposição a pagar** (final do piloto): plano escolhido e motivo; distribuição dos planos escolhidos.
- **RN-KPI-16** `[doc §5.4]` **Horas de atendimento dos psicólogos** = soma das horas realizadas no mês por psicólogo (base da ocupação).
- **RN-KPI-17** `[derivada: RN-ZRT-14]` **Cumprimento do contato no mesmo dia** (alerta vermelho) = alertas vermelhos com contato registrado na mesma data civil ÷ alertas vermelhos × 100. Meta implícita do documento: 100%.
- **RN-KPI-18** `[doc §5.4]` **Alertas ARBE** em aberto por nível (somente contagens para a gestão).
- **RN-KPI-19** `[doc §4.7.3]` **Receita bruta mensal** = Σ mensalidades das assinaturas pagas ativas. **Receita líquida mensal** = receita bruta × (1 − 0,11). **Receita média por assinante** = receita bruta ÷ assinantes (referência do plano: R$ 100,90); **líquida média por assinante** (referência: R$ 89,80).
- **RN-KPI-20** `[doc §4.7.5]` **Ponto de equilíbrio (assinantes)** = teto de (gastos mensais ÷ receita líquida média por assinante). Com os valores do plano: 2.355,00 ÷ 89,80 = 26,2, logo **27 assinantes**.
- **RN-KPI-21** `[doc §4.7.5]` **Resultado do mês** = receita líquida do mês − gastos do mês (mensais mais, no mês do pagamento, a manutenção anual do site). **Saldo do investimento** = −17.200,00 + soma dos resultados mensais; **retorno do investimento** é o primeiro mês em que o saldo é maior ou igual a zero.
- **RN-KPI-22** `[doc §5.5]` Rede: prestadores por faixa ARP (excelência, alerta, descredenciamento), credenciamentos em andamento, entradas e saídas por mês.
- **RN-KPI-23** `[doc §5.7 Q.9]` **Cumprimento de SLA por canal** = mensagens respondidas dentro do prazo ÷ mensagens do canal × 100 (RN-CAN-02) `[suposição para a fórmula]`.
- **RN-KPI-24** `[doc Q.8, §4.4.1]` **Parceiros do Cartão** ativos e **economia concedida** (soma dos descontos registrados) `[suposição para a fórmula de economia]`.
- **RN-KPI-25** `[doc §5.5]` Janela temporal padrão dos indicadores: mês calendário; exceção: taxa de recusa em 30 dias móveis (doc) e ARBE em 30 dias móveis.

## 12. FIN: finanças e viabilidade

- **RN-FIN-01** `[doc §4.7.1]` Natureza jurídica proposta: **Sociedade Empresária Limitada (LTDA)**. A definição final (natureza, regime tributário, atividades econômicas) depende de orientação contábil e jurídica.
- **RN-FIN-02** `[doc §4.7.1, Apêndice B item 6]` A constituição prevê **responsável técnico inscrito no CRP** e a verificação da necessidade de registro da pessoa jurídica no CRP-04. O ERP registra "RT indicado" e "registro PJ: pendente de confirmação".
- **RN-FIN-03** `[doc §4.7.2, Q.3]` **Investimento inicial** (feito uma única vez): desenvolvimento do site e do aplicativo R$ 15.000,00; abertura do CNPJ R$ 1.200,00; serviços de advogado R$ 1.000,00 (contrato social, termos de uso e contratos de credenciamento). **Total: R$ 17.200,00.**
- **RN-FIN-04** `[doc §4.7.2]` O serviço de advogado é pontual (pago uma vez), não assessoria mensal; novas demandas jurídicas só quando necessárias.
- **RN-FIN-05** `[doc §4.7.2, Fig.3]` Os sócios mantêm **reserva de cerca de R$ 9.300,00** para despesas dos primeiros meses. (A conclusão cita R$ 9.000; ver Anexo B, I-02.)
- **RN-FIN-06** `[doc §4.7.2]` **Aporte total dos sócios ≈ R$ 26.500,00** (17.200,00 + 9.300,00), **sem empréstimos**.
- **RN-FIN-07** `[doc §4.4.3, §4.7.3]` Receita: três origens. (1) Assinaturas dos planos pagos (principal): R$ 49,90, R$ 119,90, R$ 149,90. (2) Parcerias (rede e Cartão Nexus), mediante modelos comerciais validados jurídica e eticamente. (3) Canal corporativo.
- **RN-FIN-08** `[doc §4.7.3, Q.4]` Valor médio pago por assinante: 4 Essencial (R$ 199,60) + 3 Cuida (R$ 359,70) + 3 Sustenta (R$ 449,70) = R$ 1.009,00 por 10 assinantes = **R$ 100,90 por assinante**.
- **RN-FIN-09** `[doc §4.7.3]` Impostos e taxas das plataformas de pagamento: **cerca de 11%**. De cada R$ 100,90 sobram **R$ 89,80** para a Nexus.
- **RN-FIN-10** `[doc §4.7.3]` A projeção considera **apenas mensalidades**. Atendimentos psicológicos da equipe, parcerias com estabelecimentos e canal corporativo **não** entram no cálculo (dependem de preço e negociação), o que torna os resultados conservadores. O ERP pode registrar essas receitas, mas as mostra à parte, fora da "projeção do plano".
- **RN-FIN-11** `[doc §4.7.4, Q.5]` **Gastos mensais**: coworking (salas) R$ 499,00; manutenção do aplicativo R$ 250,00; contabilidade (Contabilizei, estimado) R$ 300,00; deslocamentos R$ 1.306,00. **Total R$ 2.355,00 por mês** (R$ 28.260,00 por ano).
- **RN-FIN-12** `[doc §4.7.4]` Por prudência, os gastos mensais são considerados **desde o primeiro mês**, inclusive durante o desenvolvimento do aplicativo.
- **RN-FIN-13** `[doc §4.7.4, Fig.3]` Despesas anuais do site: **manutenção R$ 400,00 por ano** e **hospedagem na Locaweb** em plano anual, cujo valor ainda será confirmado e por isso **não** entra nos cálculos. Gasto recorrente conhecido: **R$ 28.660,00 por ano** (28.260,00 + 400,00), sem a hospedagem.
- **RN-FIN-14** `[doc §4.7.5, Q.6]` A manutenção anual do site, por ser paga uma vez ao ano, é lançada **no mês em que ocorre o pagamento** (mês 3 do primeiro ano, junto do lançamento do aplicativo) e **não é diluída** entre os meses.
- **RN-FIN-15** `[suposição]` Nos anos seguintes a manutenção anual é lançada de novo 12 meses depois (mês 15 do horizonte de 24 meses). É a leitura que reproduz a Figura 4 (barra do mês 15 menor que a do mês 14 apesar do crescimento de assinantes).
- **RN-FIN-16** `[doc §4.7.4]` A gestão inicial é dos sócios, **sem retirada de salário**. Novas despesas (contratação, remuneração dos sócios) só serão assumidas quando a receita permitir, e os valores foram mantidos nos dois anos projetados.
- **RN-FIN-17** `[doc §4.7.3]` Lançamento do aplicativo no **mês 3**, com **100 novos usuários gratuitos**; número que cresce aos poucos com divulgação e parcerias. Meses 1 e 2: empresa aberta e produto em desenvolvimento, **0 usuários e 0 assinantes**.
- **RN-FIN-18** `[doc §4.7.3]` Conversão-base: **5 de cada 100** usuários gratuitos passam a plano pago (limite superior da faixa de 2% a 5% do freemium, justificado por Cartão Nexus, grupos, capacitações e condições no atendimento).
- **RN-FIN-19** `[doc §4.7.3]` No fim do primeiro ano: **cerca de 1.700 usuários gratuitos e 85 assinantes**.
- **RN-FIN-20** `[doc §4.7.5]` **Ponto de equilíbrio**: R$ 2.355,00 ÷ R$ 89,80 = 26,2, logo **27 assinantes**. Com 27 assinantes, a receita líquida cobre os gastos mensais e cada assinante a mais gera lucro (R$ 89,80).
- **RN-FIN-21** `[doc §4.7.5, Q.6, Fig.4]` Marcos do cenário-base (5%): meses 1 e 2 com 0 assinantes; **mês 3: 5 assinantes**; **mês 7: cerca de 33 assinantes, primeiro mês de lucro**, e todos os meses seguintes com lucro; **mês 12: 85 assinantes**, primeiro ano fecha com **lucro de R$ 7.905,00**; **mês 14: 110 assinantes**, investimento recuperado; **mês 24: 212 assinantes**, resultado acumulado **cerca de R$ 132.000,00** (Figura 4: R$ 132,2 mil), sem hospedagem, sem remuneração de sócios e sem novas contratações.
- **RN-FIN-22** `[doc §4.7.5]` Mensalidades do primeiro ano somam **R$ 41.084,00**; descontados impostos e taxas (11%), gastos mensais e manutenção anual do site, o resultado do primeiro ano é **R$ 7.905,00**.
- **RN-FIN-23** `[doc §4.7.5]` **Retorno do investimento no mês 14**: os sócios recuperam todo o dinheiro investido menos de um ano após o lançamento do aplicativo (mês 3).
- **RN-FIN-24** `[derivada: RN-FIN-08..22]` Fórmulas da projeção (por mês m, de 1 a 24): `assinantes(m) = arredondar(conversão × gratuitos_acumulados(m))`, meio para cima; `receita_bruta(m) = assinantes(m) × 100,90`; `receita_líquida(m) = receita_bruta(m) × 0,89`; `gastos(m) = 2.355,00 + 400,00 nos meses 3 e 15`; `resultado(m) = receita_líquida(m) − gastos(m)`; `saldo(m) = −17.200,00 + Σ resultado(1..m)`.
- **RN-FIN-25** `[suposição]` Série de **gratuitos acumulados** do cenário-base, calibrada para reproduzir todos os marcos do documento (Anexo A.13): 0, 0, 100, 200, 340, 500, 660, 860, 1.060, 1.240, 1.480, 1.700, 1.940, 2.200, 2.400, 2.660, 2.880, 3.120, 3.320, 3.500, 3.700, 3.900, 4.080, 4.240 (meses 1 a 24). Os cenários 3% e 7% usam **a mesma série** com outra conversão, como o documento indica.
- **RN-FIN-26** `[derivada: RN-FIN-25]` Com essa série, o modelo entrega: primeiro mês de lucro = 7 (33 assinantes); retorno = mês 14; mês 24 = 212 assinantes e saldo de R$ 132.381,50; primeiro ano com mensalidades de R$ 41.066,30 e resultado de R$ 7.889,00. As diferenças contra o documento (R$ 17,70 nas mensalidades, R$ 16,00 no resultado, R$ 381,50 no saldo do mês 24) vêm do uso de assinantes inteiros e de estimativas do documento ("cerca de").
- **RN-FIN-27** `[suposição]` Tolerância de aceite da projeção reproduzida pelo ERP: marcos (mês do primeiro lucro, mês do retorno, assinantes nos meses 3, 7, 12, 14, 24) devem ser **exatos**; valores em reais do primeiro ano e do mês 24 devem estar a **até 0,5%** dos valores do documento. O ERP exibe, lado a lado, "referência do plano de negócios (literal)" e "projeção simulada".
- **RN-FIN-28** `[doc §4.7.5, Apêndice A]` **Cenário pessimista (3 a cada 100)**: lucro mensal começa no **mês 9**, investimento recuperado no **mês 18**, e os sócios precisam de **aporte extra de cerca de R$ 2.700,00** nos primeiros meses.
- **RN-FIN-29** `[derivada: RN-FIN-28, RN-FIN-06]` Aporte extra = máximo entre 0 e (maior prejuízo acumulado de operação − reserva de R$ 9.300,00). No cenário de 3%, o maior prejuízo acumulado é R$ 12.055,91 (mês 8), logo extra de R$ 2.755,91, compatível com "cerca de R$ 2.700,00". No cenário-base o maior prejuízo acumulado é R$ 9.411,34 (mês 6), que excede a reserva em R$ 111,34, ou seja, "cerca de" zero, dentro da folga de arredondamento do documento.
- **RN-FIN-30** `[doc §4.7.5]` **Cenário otimista (7 a cada 100)**: lucro mensal começa no **mês 6**; investimento recuperado no **mês 12**, ainda no primeiro ano.
- **RN-FIN-31** `[doc §4.7.5, Apêndice A]` Em todos os cenários a Nexus se paga **em menos de dois anos**.
- **RN-FIN-32** `[doc §4.7.5, §5.8]` Os números são estimativas do grupo, a confirmar no piloto, incluindo o valor da hospedagem, antes de qualquer investimento maior. O ERP rotula todos os valores de projeção como "estimativa do plano".
- **RN-FIN-33** `[doc §4.6.3]` O orçamento específico de comunicação **não** está incluído nos gastos mensais; até ser definido, a divulgação se apoia nos próprios sócios. (O Apêndice B cita R$ 1.000 mensais de marketing digital como ponto a detalhar; ver Anexo B, I-12. Esse valor **não** entra na projeção.)
- **RN-FIN-34** `[doc §4.6.3]` Critério de alocação de comunicação: prioriza produção de conteúdo próprio e parcerias (ativos permanentes, menos investimento); mídia paga é ampliada gradualmente conforme os resultados de conversão.
- **RN-FIN-35** `[doc §3.5]` O resultado mensal é negativo até o sexto mês e positivo a partir do sétimo (cenário-base); isso exige capital de giro (a reserva).
- **RN-FIN-36** `[derivada: RN-FIN-20]` Para o realizado do ERP: "assinantes que faltam para o ponto de equilíbrio" = max(0, 27 − assinantes atuais). Se a receita líquida realizada for maior ou igual aos gastos, o painel marca "acima do ponto de equilíbrio".
- **RN-FIN-37** `[doc 00-contexto]` Formatação: moeda `R$ 49,90`, datas `04/11/2026`, milhar com ponto e decimal com vírgula.

## 13. CORP: canal corporativo

- **RN-CORP-01** `[doc §4.4.3]` Canal corporativo é a **venda dos planos Nexus para empresas**, que os oferecem como benefício aos funcionários que cuidam de familiares idosos, como benefício de academia ou alimentação.
- **RN-CORP-02** `[doc §4.4.3]` A **empresa paga o plano**; o colaborador usa o aplicativo, os descontos, os grupos e o atendimento psicológico.
- **RN-CORP-03** `[doc §4.2.1, §4.4.3, §5.6]` Público: empresas de médio e grande porte da região, com colaboradores que acumulam trabalho e cuidado familiar (faltas, queda de produtividade e esgotamento). A prospecção é feita junto aos departamentos de recursos humanos.
- **RN-CORP-04** `[doc §3.5, §4.4.3]` O canal reduz a dependência da venda direta a famílias sobrecarregadas e amplia o acesso sem depender da renda da família; é uma das decisões estratégicas (a sustentabilidade depende mais de parcerias e canal corporativo que da venda direta).
- **RN-CORP-05** `[doc §4.7.3]` Preço do canal corporativo ainda não definido; **não** entra na projeção financeira (RN-FIN-10). O ERP registra preço por vaga como `[suposição]` editável, rotulado "não faz parte da projeção do plano".
- **RN-CORP-06** `[suposição]` Contrato corporativo: empresa, vagas contratadas, plano pago por vaga (um dos três pagos, escolhido pela empresa), valor por vaga, vigência, contato de RH e estado (`prospect`, `negotiation`, `active`, `suspended`, `ended`).
- **RN-CORP-07** `[derivada: RN-CORP-02, RN-KPI-05]` Cada colaborador ativo em contrato `active` tem assinatura paga com pagador "empresa" e conta como **assinante**. Se o contrato é encerrado, o colaborador passa ao Livre (ou assume o plano pago por conta própria, se quiser).
- **RN-CORP-08** `[derivada: RN-LGPD-16, RN-LGPD-17]` A empresa contratante **nunca** vê dados de saúde individuais, escores de Zarit, alertas, anotações, nem se um colaborador específico usou o atendimento psicológico. Ela vê apenas dados agregados de adesão (vagas contratadas e ativas, participação geral em atividades) com mínimo de 5 colaboradores por recorte.
- **RN-CORP-09** `[derivada: RN-LGPD-03]` Para o colaborador que entra pelo canal corporativo valem os mesmos consentimentos (saúde, imagem, compartilhamento) do usuário comum. O consentimento não é condição do emprego nem do benefício.
- **RN-CORP-10** `[doc §4.2.2]` A referência de mercado para o canal (plataformas de psicologia on-line vendidas a empresas e operadoras) deve ser acompanhada; não gera regra de sistema.

## 14. POP: procedimentos operacionais padrão

Os números RN-POP-01 a RN-POP-10 coincidem com os códigos POP-01 a POP-10 do Quadro 11. As regras RN-POP-11 em diante são gerais.

- **RN-POP-01** `[doc §5.10 Q.11]` **POP-01, cadastro e acolhimento do usuário.** Responsável: gestão. O ERP exige no cadastro: aceite de termos de uso, aviso de canais (RN-ATD-11), consentimentos (RN-LGPD-03 a 06), perfil do cuidador, pessoa idosa e primeira aplicação da Zarit marcada (RN-ZRT-07). `[derivada]` para o conteúdo, `[doc]` para o responsável.
- **RN-POP-02** `[doc §5.10 Q.11, §5.10.1]` **POP-02, credenciamento, avaliação e descredenciamento de prestadores.** Responsável: gestão. Procedimento completo no documento, reproduzido em RN-REDE-03 a RN-REDE-31 e RN-ARP-01 a RN-ARP-19, com as quatro etapas: coleta da avaliação, consolidação, classificação em três faixas, encerramento.
- **RN-POP-03** `[doc §5.10 Q.11]` **POP-03, cadastro e acompanhamento de parceiros do Cartão Nexus.** Responsável: gestão. Ver RN-CRT-05 a RN-CRT-12.
- **RN-POP-04** `[doc §5.10 Q.11]` **POP-04, organização de grupos e capacitações.** Responsável: gestão e responsável técnico. Ver RN-GRP-01 a RN-GRP-17. A gestão cuida de turmas, locais e comunicação; o responsável técnico valida o conteúdo e o enquadramento (orientação versus psicoterapia).
- **RN-POP-05** `[doc §5.10 Q.11, §5.8, §6.3, Q.12]` **POP-05, situações de risco e encaminhamento de urgência.** Responsável: **responsável técnico**. Gatilhos: alerta vermelho da Zarit (61 a 88); ARBE `critical`; relato de risco de suicídio ou sofrimento psíquico grave em atendimento, grupo ou canal de mensagens. Passos mínimos do protótipo: (1) **acolhimento** imediato; (2) **contato da equipe no mesmo dia**; (3) **avaliação de risco pelo psicólogo**, com registro; (4) se necessário, **encaminhamento imediato** à rede de urgência em saúde mental, com informação sobre o **CVV (188)**, e **SAMU (192)** em emergência; (5) se o atendimento era remoto, encaminhamento à rede presencial (Res. CFP 9/2024); (6) registro da ocorrência e do encaminhamento; (7) acompanhamento posterior. Registro exigido: horário de cada passo, responsável, resultado da avaliação de risco, destino do encaminhamento e retorno. Indicador: contato no mesmo dia (RN-KPI-17). Os passos 1 a 7 são `[derivada]` do texto; o texto não detalha mais que isso.
- **RN-POP-06** `[doc §5.10 Q.11, §6.5]` **POP-06, proteção de dados e resposta a incidentes.** Responsável: gestão. Plano de resposta com comunicação à ANPD e aos titulares afetados **nos prazos legais** (RN-LGPD-22).
- **RN-POP-07** `[doc §5.10 Q.11, §6.3]` **POP-07, suspeita de violência contra a pessoa idosa.** Responsável: **responsável técnico**. Conteúdo do documento: **sinais de alerta, registro e comunicação aos órgãos competentes**, com **notificação compulsória** (Estatuto da Pessoa Idosa, redação da Lei 12.461/2011), atenção ao fato de que muitas vezes o autor da negligência é um **cuidador em colapso**, o que exige **proteger a pessoa idosa sem abandonar quem cuida**. Destinos (RN-ENC-05): CREAS; Disque 100; delegacia especializada; Ministério Público; Conselho Municipal da Pessoa Idosa. O ERP registra a ocorrência com restrição de acesso ao RT e ao psicólogo do caso.
- **RN-POP-08** `[doc §5.10 Q.11, §6.3]` **POP-08, atendimento a reclamações.** Responsável: gestão. Existe canal de reclamações **com prazo de resposta**; as reclamações são revisadas na reunião mensal. Prazo de resposta de reclamação formal: 5 dias úteis `[suposição]`. Reclamação sobre prestador pode ser classificada como grave (RN-ARP-09); suspeita de violência ou negligência segue o POP-07.
- **RN-POP-09** `[doc §5.10 Q.11, Q.7]` **POP-09, revisão de conteúdos de orientação.** Responsável: **responsável técnico**, que "revisa os conteúdos de orientação". Conteúdo só é publicado depois de aprovado pelo RT, com data da última revisão.
- **RN-POP-10** `[doc §5.10 Q.11, §6.5]` **POP-10, encerramento do cadastro e exclusão de dados.** Responsável: gestão. Segue RN-LGPD-20, 23 e 24: exclui o que pode ser excluído, bloqueia o que compõe registro documental até o prazo legal e registra tudo no log.
- **RN-POP-11** `[doc §5.10]` Estrutura fixa de cada POP: **objetivo, responsável, materiais, passo a passo, registro exigido, indicadores e data da última revisão**. A biblioteca de POPs do ERP guarda esses sete campos para cada POP.
- **RN-POP-12** `[doc §5.10, §5.9]` Os POPs são **revistos anualmente** ou **sempre que um incidente mostrar uma lacuna**, e **apresentados a todos os novos credenciados** (registro de ciência na integração).
- **RN-POP-13** `[doc §5.10, derivada]` O ERP exibe, por POP, o estado de revisão: `up_to_date` (revisado há menos de 12 meses), `due` (12 meses ou mais), `revision_triggered` (incidente registrado).
- **RN-POP-14** `[doc §5.10]` Responsabilidades por POP são as do Quadro 11 e não mudam por perfil de acesso: ações do RT (POP-05, 07, 09) só podem ser fechadas pelo RT; ações da gestão (01, 02, 03, 06, 08, 10) pela gestão (RN-ORG-01).
- **RN-POP-15** `[doc §6.4]` O responsável técnico revisa o enquadramento ético dos POPs que envolvem psicólogos; "decisões técnicas não podem ser tomadas com critério comercial" (RN-ETICA-06).

## 15. ENC: encaminhamento à rede de apoio (item 5.11)

- **RN-ENC-01** `[doc §5.11]` Quando a demanda **ultrapassa o escopo da Nexus**, o encaminhamento faz parte do serviço. O ERP registra cada encaminhamento: categoria do Quadro 12, destino, data, responsável, retorno e, quando exigido, o POP.
- **RN-ENC-02** `[doc Q.12]` **Necessidade de acompanhamento psiquiátrico** → CAPS de referência, rede privada ou UBS. Observação: **com orientação do responsável técnico**.
- **RN-ENC-03** `[doc Q.12]` **Sofrimento psíquico grave ou risco de suicídio** → rede de urgência em saúde mental; **CVV (188)**. Observação: **conforme POP-05**.
- **RN-ENC-04** `[doc Q.12]` **Vulnerabilidade social e benefícios** → CRAS do território. Observação: orientação sobre direitos.
- **RN-ENC-05** `[doc Q.12]` **Violação de direitos, violência ou negligência** → CREAS; Disque 100; delegacia especializada; Ministério Público; Conselho Municipal da Pessoa Idosa. Observação: **notificação compulsória, conforme POP-07**.
- **RN-ENC-06** `[doc Q.12]` **Demandas previdenciárias ou de curatela** → advogado da rede; Defensoria Pública. Observação: Defensoria quando houver hipossuficiência.
- **RN-ENC-07** `[doc Q.12]` **Agravamento clínico da pessoa idosa** → UBS de referência; serviço de urgência. Observação: **comunicação imediata à família**.
- **RN-ENC-08** `[doc Q.12, §6.3]` **Cuidador sem condição de custear acompanhamento** → clínicas-escola; serviços públicos. Observação: **plano gratuito mantido**. A Nexus atua ao lado das políticas públicas e não as substitui.
- **RN-ENC-09** `[doc §5.7]` Em emergência, o usuário é orientado a acionar o **SAMU (192)** ou a unidade de urgência mais próxima; os canais da Nexus não substituem atendimento clínico.
- **RN-ENC-10** `[doc §4.4.2, §6.4]` Encaminhamento a serviço da rede privada **informa as opções** disponíveis e a **escolha é do cliente**; nenhum psicólogo ou sócio recebe valor por encaminhar (RN-ETICA-08).
- **RN-ENC-11** `[derivada: RN-ENC-05, RN-LGPD-16]` Ocorrências de encaminhamento por risco ou violência têm acesso restrito ao RT e ao psicólogo do caso; a gestão vê apenas o total por categoria.

## 16. LGPD: proteção de dados e uso de imagem (item 6.5 e correlatos)

- **RN-LGPD-01** `[doc §6.5]` Os dados tratados incluem **dados pessoais sensíveis**: a Lei 13.709/2018 classifica como sensíveis os dados de saúde. Isso exige hipóteses específicas de tratamento e maior cuidado com a segurança.
- **RN-LGPD-02** `[doc §6.5]` Bases legais: o **consentimento específico e destacado do titular** e, **quando aplicável, a tutela da saúde em procedimento realizado por profissionais de saúde**. O ERP registra, por tratamento, qual base legal se aplica.
- **RN-LGPD-03** `[doc §4.3.5, §6.5]` O tratamento de dados de saúde para People Analytics e acompanhamento exige **consentimento específico** do titular.
- **RN-LGPD-04** `[doc §6.5]` O consentimento é colhido **em documento próprio**, **separado** do contrato de prestação de serviços **e** da autorização de uso de imagem, que tem finalidade diferente. No ERP, três termos independentes, cada um com texto, versão e data.
- **RN-LGPD-05** `[derivada: RN-LGPD-03, RN-LGPD-04] [suposição para a lista]` Consentimentos granulares: (a) dados de saúde para acompanhamento psicológico (inclui Zarit e ARBE); (b) People Analytics e indicadores agregados; (c) compartilhamento de informações da pessoa idosa com familiares; (d) uso de imagem e depoimento; (e) contato por WhatsApp; (f) TCLE do piloto, quando for o caso. Cada um é aceito, recusado ou revogado de forma independente, sem condicionar o acesso ao Livre.
- **RN-LGPD-06** `[doc §4.6.2, §6.3, Q.14]` **Uso de imagem e depoimento**: só com **consentimento específico** (Anexo D do documento, termo de autorização de uso de imagem e depoimento). Comunicação não expõe pessoas idosas em situação de vulnerabilidade. Sem termo ativo, o ERP bloqueia qualquer marcação de "pode usar em campanha".
- **RN-LGPD-07** `[doc §6.5]` **Coleta limitada à finalidade declarada**: cada campo sensível tem finalidade e base legal declaradas; o que não tem finalidade não é coletado.
- **RN-LGPD-08** `[derivada: RN-LGPD-07]` **Minimização**: o cadastro da pessoa idosa, o repasse a credenciados e as visões de gestão exibem só o necessário para o fim (por exemplo, o credenciado recebe nome, contato e necessidade do serviço, nunca escores nem observações psicológicas).
- **RN-LGPD-09** `[doc §5.4]` **Pseudonimização**: planilhas e painéis de análise usam dados pseudonimizados sempre que possível. No ERP, a gestão enxerga o cuidador por código (por exemplo, `CUI-0042`) e dados agregados, e a reidentificação só é possível a quem tem acesso clínico.
- **RN-LGPD-10** `[doc §5.4, §6.5]` Dados de saúde são armazenados com **criptografia** (protótipo: indicador de "cifrado em repouso" simulado e mascaramento visual; ver 02, seção 6).
- **RN-LGPD-11** `[doc §6.5]` **Controle de acesso por perfil** (RBAC), com matriz do 02 (seção 1).
- **RN-LGPD-12** `[doc §6.5]` **Registro de acessos**: todo acesso a dado sensível (visualizar, editar, exportar, imprimir) gera linha de log com usuário, perfil, ação, entidade, data e hora e justificativa quando aplicável.
- **RN-LGPD-13** `[doc §6.5, §6.3]` **Profissionais credenciados** que tiverem acesso a dados de usuários assinam **cláusula específica de proteção de dados**. Sem a cláusula registrada, o prestador não recebe dados de usuários.
- **RN-LGPD-14** `[derivada: RN-LGPD-03, RN-ZRT-26]` **Revogação do consentimento de saúde**: cessa o tratamento a partir da data da revogação; novas aplicações da Zarit não podem ser registradas; ARBE e painéis deixam de incluir o cuidador; alertas abertos são encerrados (motivo "consentimento revogado"); o cadastro vai a `paused_by_consent_revocation`, mas o Livre e a agenda continuam acessíveis. Registros já feitos permanecem como registro documental (RN-LGPD-24). O cuidador pode reconceder o consentimento depois.
- **RN-LGPD-15** `[doc §6.5]` **Autenticação em dois fatores para a equipe** (sócios, RT, psicólogos, atendimento). No protótipo é simulada (código exibido na tela).
- **RN-LGPD-16** `[doc §6.5]` Resultados da Zarit e alertas ficam **restritos aos psicólogos responsáveis pelo acompanhamento e ao próprio cuidador**. Estendido por derivação aos demais dados clínicos (anotações de sessão, ocorrências POP-05/07): somente psicólogo do caso e responsável técnico (supervisão). Gestão e atendimento veem apenas agregados pseudonimizados.
- **RN-LGPD-17** `[derivada: RN-ETICA-06, §4.3.5]` **Finalidade**: dados de saúde só são usados para acompanhar o cuidador e qualificar a rede. É vedado usá-los para precificação, oferta comercial, desconto, seleção de clientes ou decisões de RH em empresas contratantes.
- **RN-LGPD-18** `[doc §6.3, §6.5]` **Cópias de segurança** periódicas e **exportação de dados** pelo usuário (portabilidade). No ERP, "exportar JSON" da base de demonstração e do titular.
- **RN-LGPD-19** `[doc §6.5]` A Nexus designa um **encarregado pelo tratamento de dados**, publica **política de privacidade em linguagem acessível** e mantém **canal para os direitos do titular**.
- **RN-LGPD-20** `[doc §6.5; direitos da LGPD citada no doc]` Direitos do titular tratados pelo canal: **confirmação e acesso**; **correção**; **anonimização, bloqueio ou eliminação** de dados desnecessários; **portabilidade**; **eliminação** dos dados tratados com consentimento; **informação sobre compartilhamento**; **revogação do consentimento**; **revisão de decisões** tomadas com base nos dados (RN-ZRT-20).
- **RN-LGPD-21** `[suposição]` Prazo de atendimento de solicitação do titular: **15 dias corridos** a partir do protocolo; o painel mostra dias restantes e marca "vence em breve" nos últimos 3 dias e "vencida" depois. Estados: `open`, `in_progress`, `completed`, `rejected_with_reason`.
- **RN-LGPD-22** `[doc §6.5, §6.3]` **Plano de resposta a incidentes**, com comunicação à ANPD e aos titulares afetados nos prazos legais. O ERP registra o incidente (data, descrição, dados afetados, titulares afetados, medidas, comunicações). Prazo-alvo de comunicação do protótipo: 3 dias úteis `[suposição]`.
- **RN-LGPD-23** `[suposição]` **Retenção**: registro documental psicológico (aplicações da Zarit, anotações de sessão, ocorrências clínicas) é retido por **no mínimo 5 anos** (valor de referência à Res. CFP 1/2009, a confirmar, Apêndice B item 11). Dados de cadastro sem função de registro documental são eliminados em até 30 dias depois do encerramento do cadastro. Logs de acesso, 5 anos.
- **RN-LGPD-24** `[derivada: RN-ZRT-21, RN-LGPD-23]` **Eliminação versus registro documental**: o pedido de eliminação é atendido para tudo que não compõe o registro documental; o que compõe fica **bloqueado** (sem uso nem acesso comum) até o fim do prazo de retenção, e o titular é informado do motivo e do prazo.
- **RN-LGPD-25** `[suposição]` **Aviso de protótipo**: em todas as telas de entrada e no rodapé do ERP, o aviso "Protótipo de demonstração. Todos os dados são fictícios e ficam apenas neste navegador" é visível; nenhum dado sai do navegador.
- **RN-LGPD-26** `[derivada: RN-LGPD-08]` Mascaramento padrão em tela: CPF `***.***.***-**` e telefone/e-mail parcialmente ocultos para perfis sem necessidade; "mostrar" gera log e exige perfil autorizado.
- **RN-LGPD-27** `[doc §5.4]` Dados passivos (acessos, funções, pedidos de apoio) e ativos (horas, bem-estar, sociodemográficos, satisfação) são coletados **com consentimento** e listados no aviso de privacidade.

## 17. ETICA: aspectos éticos (item 6.4)

- **RN-ETICA-01** `[doc §6.4]` No que envolve serviços psicológicos, a atuação é regida pelo **Código de Ética Profissional do Psicólogo** (CFP, 2005).
- **RN-ETICA-02** `[doc §6.4, §5.4]` **Res. CFP nº 9/2024** (serviços psicológicos por meios digitais): inscrição ativa no CRP; responsabilidade do profissional pela adequação da tecnologia, pelo sigilo dos dados e pela avaliação da pertinência do formato remoto; encaminhamento à rede presencial em situações de risco, violência ou urgência (RN-ATD-07).
- **RN-ETICA-03** `[doc §6.4]` **Res. CFP nº 1/2009**, registro documental; **Res. CFP nº 6/2019**, elaboração de documentos escritos (RN-ATD-08).
- **RN-ETICA-04** `[doc §6.4, §4.3.4]` **Res. CFP nº 13/2022**: distinção entre psicoterapia e atividades de orientação e psicoeducação; a Nexus deixa isso claro ao usuário em grupos, capacitações e terapia de grupo (RN-ATD-19).
- **RN-ETICA-05** `[doc §6.4, §4.6.2]` Divulgação: **vedado prometer resultados**, usar o sofrimento como apelo e fazer autopromoção sensacionalista; é **obrigatória a identificação do número de inscrição profissional** nos materiais que divulgam serviços de Psicologia. Vale para todo o plano de comunicação.
- **RN-ETICA-06** `[doc §5.1, §6.4]` **Independência técnica**: nenhuma decisão técnica sobre o cuidado pode ser tomada por critério comercial; a gestão decide o comercial e o profissional decide o técnico.
- **RN-ETICA-07** `[doc §6.4]` **Sigilo em contexto familiar**: informações de atendimentos e grupos não são compartilhadas com familiares sem autorização expressa; grupos têm contrato inicial de sigilo entre participantes (RN-GRP-09).
- **RN-ETICA-08** `[doc §4.4.2, §6.4, Código de Ética art. 2º, alínea "o"]` É **vedado ao psicólogo receber, pagar remuneração ou porcentagem por encaminhamento** de serviços. Nenhum psicólogo, sócio ou credenciado recebe ou paga valor por encaminhar usuários.
- **RN-ETICA-09** `[doc §6.4]` A Nexus **não cobra porcentagem** sobre atendimentos psicológicos.
- **RN-ETICA-10** `[doc §6.4]` A receita provém das **assinaturas**, das **parcerias comerciais** e do **canal corporativo**, recebidos pela **pessoa jurídica Nexus**.
- **RN-ETICA-11** `[doc §6.4]` Serviços psicológicos contratados **na rede** são pagos pelo usuário **diretamente ao profissional**, conforme combinado entre eles.
- **RN-ETICA-12** `[doc §6.4]` Modelos de remuneração com parceiros de serviços não privativos da Psicologia (farmácias, estabelecimentos do cartão) são firmados entre a PJ e a empresa parceira, **com validação jurídica e ética prévia**, **informação clara ao usuário** e **sem diferença de tratamento** que favoreça um prestador em detrimento de outro.
- **RN-ETICA-13** `[doc §5.1, §6.4]` Integrantes psicólogos do grupo que atuam na rede o fazem como qualquer credenciado, sem participação em valores de encaminhamentos (RN-REDE-14).
- **RN-ETICA-14** `[doc §5.2]` Não há substituição de trabalho técnico por voluntariado. O programa de **estágio supervisionado** (estudantes de Psicologia) cobre produção de conteúdo e tabulação de indicadores, sempre com supervisão de profissional inscrito e **sem atendimento clínico autônomo**. O perfil "estagiário" não tem acesso clínico no ERP.
- **RN-ETICA-15** `[doc §4.1.3]` Tom de voz de textos e interfaces: acolhedor, direto, sem jargão clínico; não infantiliza o cuidador; não romantiza o sacrifício (sem "guerreira", "anjo"); não promete resultado terapêutico.
- **RN-ETICA-16** `[doc §4.1.3]` Posicionamento: a Nexus **não é** home care, clínica tradicional nem aplicativo apenas de lembretes. Nenhum texto do ERP descreve a Nexus como prestadora direta dos serviços da rede.
- **RN-ETICA-17** `[doc Apêndice B item 11]` A vigência das resoluções citadas deve ser confirmada no site do CFP. O ERP guarda a lista de normas citadas com campo "vigência confirmada em" (vazio no seed).

## 18. RISCO: matriz de riscos e mitigação (itens 6.2 e 6.3)

- **RN-RISCO-01** `[doc §6.2]` Cada risco é classificado por **probabilidade (P)** e **impacto (I)**, em escala de **1 a 5**; **criticidade C = P × I**.
- **RN-RISCO-02** `[doc §6.2]` Riscos com **C maior ou igual a 12** são **prioritários** e exigem **plano de tratamento**.
- **RN-RISCO-03** `[doc Q.13]` **R1**, conversão do plano gratuito abaixo do esperado (Financeiro): P4, I5, C20. Tratamento: medição no piloto antes da expansão; revisão dos benefícios dos planos. É o risco de maior impacto financeiro; o piloto deve medir a conversão antes de qualquer investimento adicional.
- **RN-RISCO-04** `[doc Q.13]` **R2**, baixa adesão por resistência à busca de ajuda (Mercado): P4, I4, C16. Tratamento: comunicação de orientação; indicação de profissionais; rodas de conversa abertas.
- **RN-RISCO-05** `[doc Q.13]` **R3**, falta de padronização entre prestadores (Qualidade): P4, I4, C16. Tratamento: critérios de credenciamento; integração; avaliação pelos usuários.
- **RN-RISCO-06** `[doc Q.13]` **R4**, identificação de violência contra a pessoa idosa (Ético-legal): P3, I5, C15. Tratamento: POP-07; notificação compulsória; rede protetiva.
- **RN-RISCO-07** `[doc Q.13]` **R5**, agravamento do quadro psíquico do cuidador (Clínico): P3, I5, C15. Tratamento: POP-05; encaminhamento à rede de saúde mental.
- **RN-RISCO-08** `[doc Q.13]` **R6**, conduta inadequada de profissional da rede (Jurídico-reputacional): P3, I4, C12. Tratamento: verificação de registro; contrato; descredenciamento.
- **RN-RISCO-09** `[doc Q.13]` **R7**, baixa familiaridade digital do público (Operacional-social): P4, I3, C12. Tratamento: WhatsApp e telefone como canais alternativos.
- **RN-RISCO-10** `[doc Q.13]` **R8**, custo do aplicativo acima do previsto (Financeiro): P3, I4, C12. Tratamento: versão mínima; contratação por etapas.
- **RN-RISCO-11** `[doc Q.13]` **R9**, remuneração indevida por encaminhamento (Ético-legal): P2, I5, C10. Tratamento: vedação de porcentagem sobre serviços psicológicos; validação jurídica das parcerias.
- **RN-RISCO-12** `[doc Q.13]` **R10**, vazamento ou perda de dados sensíveis (Tecnológico-jurídico): P2, I5, C10. Tratamento: criptografia; controle de acesso; plano de resposta a incidentes.
- **RN-RISCO-13** `[doc Q.13]` **R11**, poucos parceiros no Cartão Nexus (Comercial): P3, I3, C9. Tratamento: prospecção na fase 1; benefícios simples para o parceiro.
- **RN-RISCO-14** `[doc Q.13]` **R12**, divergência entre sócios (Societário): P2, I4, C8. Tratamento: acordo de sócios com regras de saída.
- **RN-RISCO-15** `[derivada: RN-RISCO-02]` Prioritários (C maior ou igual a 12): R1, R2, R3, R4, R5, R6, R7, R8 (oito). Não prioritários: R9, R10, R11, R12. Ordem decrescente de criticidade: R1 (20), R2 e R3 (16), R4 e R5 (15), R6, R7 e R8 (12), R9 e R10 (10), R11 (9), R12 (8).
- **RN-RISCO-16** `[doc §6.3]` **Riscos reputacionais**: informar com clareza o que cada plano inclui e não inclui; não prometer resultados clínicos; manter canal de reclamações com prazo de resposta; solicitar consentimento específico para uso de imagem ou depoimento.
- **RN-RISCO-17** `[doc §6.3]` **Riscos tecnológicos**: cópias de segurança periódicas; contrato com nível de serviço junto ao desenvolvedor; exportação de dados pelo usuário; canais alternativos em caso de indisponibilidade.
- **RN-RISCO-18** `[doc §6.3]` **Riscos de responsabilidade por terceiros**: ao indicar profissionais a Nexus pode ser responsabilizada (Código de Defesa do Consumidor). Medidas: credenciamento com verificação de registro e formação; contrato com cláusulas de conduta, sigilo e proteção de dados; informação clara sobre o papel da Nexus como organizadora; procedimento formal de descredenciamento.
- **RN-RISCO-19** `[doc §6.3]` **Riscos sociais e geográficos**: concentração inicial em Uberlândia limita a escala e a desigualdade de renda limita a capacidade de pagamento. Medidas: plano gratuito permanente; canal corporativo; encaminhamento à rede pública quando o usuário não puder custear.
- **RN-RISCO-20** `[doc §6.3]` **Proteção a usuários e vítimas de violência**: o contexto do cuidado concentra fatores de risco (dependência funcional, convivência prolongada, sobrecarga, isolamento). POP-07 e POP-05 (RN-POP-05, RN-POP-07).
- **RN-RISCO-21** `[derivada]` O ERP exibe o **registro de riscos** (R1 a R12) com P, I, C calculado, categoria, tratamento e **vínculo com os controles do sistema** que o mitigam (por exemplo, R10 com log de acesso e consentimentos; R6 com checklist de credenciamento e ARP). Edição de P e I só pelo perfil Sócio/Gestão e pelo RT; C é sempre calculado.

## 19. CAP: capacitação e treinamento (item 5.9)

- **RN-CAP-01** `[doc §5.9]` A formação existe para **reduzir a variabilidade** dos serviços (a Nexus "vende, sobretudo, confiança"). Três frentes de formação.
- **RN-CAP-02** `[doc §5.9]` **Integração dos credenciados**: apresenta o modelo Nexus, o lugar do cuidador na proposta, as regras de atendimento, o sigilo, a proteção de dados e a **vedação de captação paralela**. É pré-requisito para a ativação do credenciado (RN-REDE-24).
- **RN-CAP-03** `[doc §5.9]` **Formação dos profissionais de grupos e capacitações**: perfil do público, sobrecarga, luto ambíguo, linguagem acessível e cuidados na demonstração prática.
- **RN-CAP-04** `[doc §5.9]` **Formação da equipe de gestão**: uso da plataforma, atendimento ao usuário, encaminhamentos e situações de risco.
- **RN-CAP-05** `[doc §5.9]` **Formação continuada**: encontros periódicos com a rede, alternando estudo de casos e atualização técnica.
- **RN-CAP-06** `[doc §5.9]` Revisão anual do **Guia de Boas Práticas da Nexus** (Anexo E do documento).
- **RN-CAP-07** `[derivada: RN-POP-12]` O ERP registra eventos de formação (frente, data, participantes, presença) e mostra, por prestador e por membro da equipe, o status de integração e de formação (`pending`, `done`).
- **RN-CAP-08** `[suposição]` Periodicidade da formação continuada: trimestral (o documento diz "encontros periódicos"); editável.

## 20. PIL: piloto e produto mínimo viável (item 5.8)

- **RN-PIL-01** `[doc §5.8]` O **produto mínimo viável é o próprio aplicativo** em versão inicial, com as funções do item 5.4, uma rede credenciada inicial e as primeiras parcerias do Cartão Nexus.
- **RN-PIL-02** `[doc §5.8]` **Hipótese central**: reunir organização da rotina, acesso a profissionais e benefícios em um único ambiente **reduz o tempo e a sobrecarga do cuidador** e gera **disposição para pagar** por um plano.
- **RN-PIL-03** `[doc §5.8]` O piloto prevê **um grupo inicial de famílias de Uberlândia**, que usa o aplicativo durante **seis meses**, com instrumentos na **adesão, aos 3 e aos 6 meses**.
- **RN-PIL-04** `[doc §5.8]` Critérios de inclusão: ser o **familiar cuidador principal** de pessoa idosa com **algum grau de dependência**; **residir em Uberlândia**; **concordar com o termo de consentimento** (TCLE, Anexo C).
- **RN-PIL-05** `[doc §5.8, Q.10]` Indicadores do piloto: sobrecarga percebida (Zarit; adesão, 3 e 6 meses); tempo dedicado à organização do cuidado (horas semanais; início e final); uso do aplicativo (contínuo); satisfação e recomendação (questionário e entrevista; final); conversão para planos pagos (contínuo); disposição a pagar (planos escolhidos e motivos; final); avaliação da rede (notas e comentários; contínuo).
- **RN-PIL-06** `[doc §5.8]` O **critério de sucesso** é definido pelo grupo **antes** do início do piloto, com metas para redução da sobrecarga, satisfação e conversão. Resultados abaixo das metas indicam **revisão do produto antes da expansão**.
- **RN-PIL-07** `[doc §5.8]` **Sem grupo de comparação**: redução de escores é indício, não prova (RN-ZRT-22). Mudanças no quadro da pessoa idosa ou na rotina podem influenciar o resultado.
- **RN-PIL-08** `[doc §6.2 R1]` O piloto mede a **conversão** antes de qualquer investimento adicional.
- **RN-PIL-09** `[suposição]` Metas padrão do piloto (editáveis, definidas antes do início): redução média da Zarit de pelo menos 10% entre adesão e 6 meses; satisfação média de pelo menos 4,0; conversão de pelo menos 3% (limite inferior do cenário pessimista). Antes do início do piloto, as metas podem ser editadas; depois, ficam bloqueadas e qualquer alteração exige justificativa registrada.
- **RN-PIL-10** `[derivada: RN-PIL-04]` Cada cuidador tem o marcador `pilot` (cohort), a data de entrada e as três janelas de coleta (adesão, 3 meses, 6 meses), com estados `pending`, `done`, `missed`. O painel do piloto só mostra cuidadores com TCLE ativo.
- **RN-PIL-11** `[doc §5.4]` Na fase MVP os dados são coletados por formulários gratuitos e consolidados em planilhas (Google Forms, Google Sheets) sob gestão dos sócios; os alertas são regras de planilha revisadas pela equipe. O ERP funciona como a versão do protótipo desse processo; acesso restrito com 2FA e dados pseudonimizados (RN-LGPD-09, 15).

## 21. ORG: funções e organização interna (item 5.1 e 5.5)

- **RN-ORG-01** `[doc §5.1, §5.5]` Princípio: **separação entre a gestão do negócio e a decisão técnica** dos profissionais. A gestão cuida da plataforma, do credenciamento, das parcerias e da comunicação; o **responsável técnico em Psicologia** orienta as atividades que envolvem serviços psicológicos e revisa conteúdos; os profissionais da rede respondem tecnicamente pelo que prestam.
- **RN-ORG-02** `[doc §5.1 Q.7]` Funções previstas na fase inicial: **sócios** (aporte de capital, decisões estratégicas, acompanhamento de indicadores); **gestão do negócio e da plataforma** (relacionamento com usuários, gestão da rede, parcerias, comunicação, acompanhamento do aplicativo); **responsável técnico em Psicologia** (supervisão técnica, orientação ética, validação de conteúdos; psicólogo com inscrição ativa no CRP-04); **profissionais de grupos e capacitações** (condução de grupos, terapia de grupo quando oferecida, capacitações; convidados ou credenciados); **rede credenciada** (atendimentos nas áreas do cuidado, contratados diretamente pelo usuário); **serviços terceirizados** (aplicativo, contabilidade, assessoria jurídica).
- **RN-ORG-03** `[doc §5.1]` Os demais integrantes do grupo idealizador atuam, se for o caso, na rede credenciada **nas mesmas condições** de qualquer prestador.
- **RN-ORG-04** `[doc §5.5]` Calendário de atividades: **mensalmente**, reunião da equipe, revisão dos indicadores e programação de grupos e capacitações; **quinzenalmente**, auditoria das avaliações da rede; **a cada trimestre**, apresentação aos sócios dos resultados consolidados; **anualmente**, revisão dos POPs e do Guia.
- **RN-ORG-05** `[doc §5.5]` Datas de mobilização para campanhas: Dia Mundial de Conscientização da Violência contra a Pessoa Idosa (**15 de junho**) e Dia Internacional da Pessoa Idosa (**1º de outubro**).
- **RN-ORG-06** `[doc §4.5.2, §5.3]` Sem sede própria na fase inicial: operação digital, salas de coworking alugadas (R$ 499,00 por mês) para presencial, grupos e capacitações; abertura de sede só se o volume justificar.
- **RN-ORG-07** `[doc §5.4]` Ferramentas de gestão: CRM, planilhas de indicadores, WhatsApp Business.

## 22. CAN: canais de comunicação e SLA (Quadro 9, 5.7)

- **RN-CAN-01** `[doc §5.7 Q.9]` Quatro canais diretos: **aplicativo (mensagens)**: dúvidas sobre uso, planos e rede; **WhatsApp**: atendimento, avisos e apoio a quem usa pouco o aplicativo; **telefone**: alternativa para quem não usa a plataforma; **e-mail**: documentos, contratos e parcerias.
- **RN-CAN-02** `[doc §5.7 Q.9]` Tempos de resposta: aplicativo **até 24 horas úteis**; WhatsApp **até 4 horas úteis**; telefone **imediato, em horário comercial**; e-mail **até 48 horas úteis**.
- **RN-CAN-03** `[suposição]` "Horas úteis" contam só em dia útil (segunda a sexta, exceto feriados nacionais) e horário comercial (8h às 18h, horário de Brasília). Mensagem recebida fora do horário começa a contar na abertura seguinte.
- **RN-CAN-04** `[derivada: RN-CAN-02]` Cada mensagem tem prazo calculado na chegada e estados `new`, `in_progress`, `answered`, `overdue`. Mensagens `overdue` aparecem em destaque na fila do atendimento e contam no KPI de SLA (RN-KPI-23).
- **RN-CAN-05** `[doc §5.4, §6.2 R7]` **Nenhuma função essencial depende exclusivamente do aplicativo.** WhatsApp e telefone são canais alternativos (risco R7). O ERP permite ao atendimento registrar em nome do usuário agendamentos, solicitações e pedidos recebidos por esses canais.
- **RN-CAN-06** `[doc §5.7]` Na contratação, o usuário é informado **por escrito** de que os canais da Nexus **não substituem atendimento clínico nem orientação sobre medicação** (cabe ao profissional prescritor) e de que emergências vão ao **SAMU (192)** ou à unidade de urgência mais próxima.
- **RN-CAN-07** `[doc §4.1.2, §4.1.3]` Mensagens padrão (templates) do atendimento seguem o tom de voz da marca (RN-ETICA-15) e nunca fazem promessa terapêutica.

---

# ANEXO A. Tabelas numéricas do documento (reprodução exata)

Os valores abaixo são os do documento. Onde o documento só traz figura ou gráfico, a origem está indicada. Valores marcados `[reconstruído]` não estão tabelados no documento e foram derivados (A.13).

## A.0 Parâmetros globais (constantes do negócio)

| Parâmetro | Valor | Origem |
|---|---|---|
| Preço Nexus Livre | R$ 0,00 | Fig.1 |
| Preço Nexus Essencial | R$ 49,90 por mês | Fig.1, §4.4.3 |
| Preço Nexus Cuida | R$ 119,90 por mês | Fig.1, §4.4.3 |
| Preço Nexus Sustenta | R$ 149,90 por mês | Fig.1, §4.4.3 |
| Mix de assinantes (de cada 10) | 4 Essencial, 3 Cuida, 3 Sustenta | Q.4 |
| Valor médio por assinante | R$ 100,90 por mês | Q.4 |
| Impostos e taxas de plataforma | cerca de 11% | §4.7.3 |
| Receita líquida média por assinante | R$ 89,80 por mês | §4.7.3 |
| Gastos mensais | R$ 2.355,00 | Q.5 |
| Manutenção anual do site | R$ 400,00 por ano | §4.7.4 |
| Investimento inicial | R$ 17.200,00 | Q.3 |
| Reserva dos sócios | cerca de R$ 9.300,00 | §4.7.2, Fig.3 |
| Aporte total | cerca de R$ 26.500,00 | §4.7.2 |
| Ponto de equilíbrio | 27 assinantes (26,2 arredondado para cima) | §4.7.5 |
| Conversão base, pessimista, otimista | 5, 3 e 7 a cada 100 gratuitos | §4.7.3, §4.7.5 |
| Usuários gratuitos no lançamento (mês 3) | 100 | §4.7.3 |
| Zarit: itens, escala, total | 22 itens, 0 a 4, total 0 a 88 | §5.4, §5.8 |
| Zarit: periodicidade | adesão e a cada 3 meses (piloto: adesão, 3 e 6 meses) | §5.4, §5.8 |
| Zarit: faixas | 0 a 20, 21 a 40, 41 a 60, 61 a 88 | §5.8 |
| ARP: mínimo de avaliações | 5 | §5.10 |
| ARP: auditoria | quinzenal (15 dias) | §5.10, §5.10.1 |
| ARP: faixas | 4,5 ou mais; 4,0 a menos de 4,5; menos de 4,0 ou mais de 2 reclamações graves | §5.10 |
| Taxa de recusa: janela | 30 dias | Q. de indicadores |
| Ocupação da agenda: limite | acima de 80% por 2 meses seguidos | §5.5 |
| Matriz de riscos: escala e corte | 1 a 5; prioritário se C maior ou igual a 12 | §6.2 |
| Contraste mínimo de texto | 4,5:1 | §4.1.3 |

## A.1 Planos (Figura 1)

| Item | Nexus Livre | Nexus Essencial | Nexus Cuida | Nexus Sustenta |
|---|---|---|---|---|
| Preço | R$ 0 (gratuito) | R$ 49,90 por mês | R$ 119,90 por mês | R$ 149,90 por mês |
| Acesso ao aplicativo | sim | sim | sim | sim |
| Organização básica | sim | sim | sim | sim |
| Agenda e lembretes | sim | sim | sim | sim |
| Conteúdos | sim | sim | sim | sim |
| Acesso inicial à rede | sim | sim | sim | sim |
| Organização ampliada | não | sim | sim | sim |
| Descontos exclusivos do Cartão Nexus | não | sim | sim | sim |
| Conteúdos exclusivos | não | sim | sim | sim |
| Condições especiais na rede | não | sim | sim | sim |
| Maior suporte à organização | não | não | sim | sim |
| Grupos de apoio | não | não | sim | sim |
| Capacitações | não | não | sim | sim |
| Acompanhamento organizacional mais próximo | não | não | não | sim |
| Maior nível de suporte | não | não | não | sim |
| Benefícios diferenciados na rede | não | não | não | sim |

Cores da Figura 1 (para UI): Livre cinza-azulado; Essencial azul claro; Cuida azul médio; Sustenta dourado.

## A.2 Valor médio pago por assinante (Quadro 4)

| Plano | Assinantes (de cada 10) | Mensalidade | Total |
|---|---|---|---|
| Nexus Essencial | 4 | R$ 49,90 | R$ 199,60 |
| Nexus Cuida | 3 | R$ 119,90 | R$ 359,70 |
| Nexus Sustenta | 3 | R$ 149,90 | R$ 449,70 |
| Total | 10 | | R$ 1.009,00 |

R$ 1.009,00 ÷ 10 = R$ 100,90 por assinante. Menos 11% = R$ 89,80.

## A.3 Investimento inicial (Quadro 3)

| Tipo de gasto | Descrição | Valor |
|---|---|---|
| Desenvolvimento do site e do aplicativo | Criação do produto digital | R$ 15.000,00 |
| Abertura do CNPJ | Constituição e registro da empresa | R$ 1.200,00 |
| Serviços de advogado | Contrato social, termos de uso e contratos de credenciamento | R$ 1.000,00 |
| **Total do investimento inicial** | | **R$ 17.200,00** |

Fontes de capital: aporte dos sócios de cerca de R$ 26.500,00 (R$ 17.200,00 de investimento mais reserva de cerca de R$ 9.300,00 para as despesas dos primeiros meses), sem empréstimos.

## A.4 Gastos mensais (Quadro 5) e anuais do site

| Tipo de gasto | Descrição | Valor mensal |
|---|---|---|
| Espaço de coworking | Locação das salas para atendimento | R$ 499,00 |
| Manutenção do aplicativo | Funcionamento e correções do aplicativo | R$ 250,00 |
| Contabilidade | Contabilizei (valor estimado) | R$ 300,00 |
| Deslocamentos | Visitas a parceiros e atividades de campo | R$ 1.306,00 |
| **Total de gasto mensal** | | **R$ 2.355,00** |

Anual: R$ 2.355,00 × 12 = R$ 28.260,00. Despesas anuais do site: manutenção R$ 400,00 por ano; hospedagem Locaweb anual, valor a confirmar (não incluída). Gasto recorrente conhecido: R$ 28.660,00 por ano.

## A.5 Faixas da Escala de Zarit e conduta da equipe

| Pontuação | Classificação | Conduta da equipe |
|---|---|---|
| 0 a 20 | Sobrecarga ausente ou pequena | Conteúdos de orientação e convite para os grupos de apoio |
| 21 a 40 | Sobrecarga moderada | Oferta de atendimento psicológico e convite para os grupos e as capacitações |
| 41 a 60 | Sobrecarga moderada a severa | **Alerta amarelo**: acompanhamento psicológico prioritário, com foco no manejo do estresse, e revisão da rede de apoio da família |
| 61 a 88 | Sobrecarga severa | **Alerta vermelho**: contato da equipe no mesmo dia, avaliação de risco pelo psicólogo e, se necessário, encaminhamento à rede de urgência conforme o POP-05 |

## A.6 Indicadores de acompanhamento da Nexus (quadro do item 5.5)

| Frente | Indicador | Como é calculado | Para que serve |
|---|---|---|---|
| Cuidadores | Sobrecarga do cuidador | Pontuação da Escala de Zarit (0 a 88), aplicada na adesão e a cada três meses | Identificar a faixa de sobrecarga de cada cuidador e definir a conduta da equipe |
| Cuidadores | Evolução da sobrecarga | (pontuação atual − pontuação na adesão) ÷ pontuação na adesão × 100 | Acompanhar se a sobrecarga diminui com o uso do serviço; valores negativos indicam redução |
| Rede | Avaliação da rede | Média das notas de 1 a 5 dadas pelos cuidadores após cada atendimento | Manter a qualidade da rede e embasar decisões de descredenciamento |
| Rede | Taxa de recusa | Solicitações recusadas ou canceladas pelo prestador nos últimos 30 dias ÷ solicitações recebidas no período × 100 | Antecipar a saída de prestadores e planejar novas parcerias |
| Equipe | Ocupação da agenda | Horas de atendimento realizadas no mês ÷ horas disponibilizadas na agenda × 100 | Evitar a sobrecarga dos psicólogos: acima de 80% por dois meses seguidos, a agenda é redistribuída ou, quando a receita permitir, a equipe é ampliada |

## A.7 Indicadores de avaliação do produto mínimo viável (Quadro 10)

| Indicador | Instrumento | Momento |
|---|---|---|
| Sobrecarga percebida | Escala de Sobrecarga do Cuidador de Zarit (Scazufca, 2002) | Na adesão, aos 3 e aos 6 meses |
| Tempo dedicado à organização do cuidado | Horas semanais informadas pelo cuidador | Início e final do piloto |
| Uso do aplicativo | Acessos, funções usadas e frequência | Contínuo |
| Satisfação e recomendação | Questionário e entrevista semiestruturada | Final do piloto |
| Conversão para planos pagos | Usuários gratuitos que passam a assinar | Contínuo |
| Disposição a pagar | Planos escolhidos e motivos | Final do piloto |
| Avaliação da rede | Notas e comentários sobre os prestadores | Contínuo |

## A.8 Matriz de riscos (Quadro 13)

| # | Risco | Categoria | P | I | C | Tratamento | Prioritário (C maior ou igual a 12) |
|---|---|---|---|---|---|---|---|
| R1 | Conversão do plano gratuito abaixo do esperado | Financeiro | 4 | 5 | 20 | Medição no piloto antes da expansão; revisão dos benefícios dos planos | sim |
| R2 | Baixa adesão por resistência à busca de ajuda | Mercado | 4 | 4 | 16 | Comunicação de orientação; indicação de profissionais; rodas de conversa abertas | sim |
| R3 | Falta de padronização entre prestadores | Qualidade | 4 | 4 | 16 | Critérios de credenciamento; integração; avaliação pelos usuários | sim |
| R4 | Identificação de violência contra a pessoa idosa | Ético-legal | 3 | 5 | 15 | POP-07; notificação compulsória; rede protetiva | sim |
| R5 | Agravamento do quadro psíquico do cuidador | Clínico | 3 | 5 | 15 | POP-05; encaminhamento à rede de saúde mental | sim |
| R6 | Conduta inadequada de profissional da rede | Jurídico-reputacional | 3 | 4 | 12 | Verificação de registro; contrato; descredenciamento | sim |
| R7 | Baixa familiaridade digital do público | Operacional-social | 4 | 3 | 12 | WhatsApp e telefone como canais alternativos | sim |
| R8 | Custo do aplicativo acima do previsto | Financeiro | 3 | 4 | 12 | Versão mínima; contratação por etapas | sim |
| R9 | Remuneração indevida por encaminhamento | Ético-legal | 2 | 5 | 10 | Vedação de porcentagem sobre serviços psicológicos; validação jurídica das parcerias | não |
| R10 | Vazamento ou perda de dados sensíveis | Tecnológico-jurídico | 2 | 5 | 10 | Criptografia; controle de acesso; plano de resposta a incidentes | não |
| R11 | Poucos parceiros no Cartão Nexus | Comercial | 3 | 3 | 9 | Prospecção na fase 1; benefícios simples para o parceiro | não |
| R12 | Divergência entre sócios | Societário | 2 | 4 | 8 | Acordo de sócios com regras de saída | não |

## A.9 Procedimentos operacionais padrão (Quadro 11)

| Código | Procedimento | Responsável |
|---|---|---|
| POP-01 | Cadastro e acolhimento do usuário | Gestão |
| POP-02 | Credenciamento, avaliação e descredenciamento de prestadores | Gestão |
| POP-03 | Cadastro e acompanhamento de parceiros do Cartão Nexus | Gestão |
| POP-04 | Organização de grupos e capacitações | Gestão e responsável técnico |
| POP-05 | Situações de risco e encaminhamento de urgência | Responsável técnico |
| POP-06 | Proteção de dados e resposta a incidentes | Gestão |
| POP-07 | Suspeita de violência contra a pessoa idosa | Responsável técnico |
| POP-08 | Atendimento a reclamações | Gestão |
| POP-09 | Revisão de conteúdos de orientação | Responsável técnico |
| POP-10 | Encerramento do cadastro e exclusão de dados | Gestão |

Estrutura fixa de cada POP: objetivo, responsável, materiais, passo a passo, registro exigido, indicadores, data da última revisão.

## A.10 Fluxo de encaminhamento à rede de apoio (Quadro 12)

| Situação identificada | Encaminhamento | Observações |
|---|---|---|
| Necessidade de acompanhamento psiquiátrico | CAPS de referência, rede privada ou UBS | Com orientação do responsável técnico |
| Sofrimento psíquico grave ou risco de suicídio | Rede de urgência em saúde mental; CVV (188) | Conforme POP-05 |
| Vulnerabilidade social e benefícios | CRAS do território | Orientação sobre direitos |
| Violação de direitos, violência ou negligência | CREAS; Disque 100; delegacia especializada; Ministério Público; Conselho Municipal da Pessoa Idosa | Notificação compulsória, conforme POP-07 |
| Demandas previdenciárias ou de curatela | Advogado da rede; Defensoria Pública | Defensoria quando houver hipossuficiência |
| Agravamento clínico da pessoa idosa | UBS de referência; serviço de urgência | Comunicação imediata à família |
| Cuidador sem condição de custear acompanhamento | Clínicas-escola; serviços públicos | Plano gratuito mantido |

Emergência: SAMU (192) ou unidade de urgência mais próxima (item 5.7).

## A.11 Momentos financeiros (Quadro 6)

| Mês | Assinantes | O que acontece |
|---|---|---|
| 1 e 2 | 0 | Abertura da empresa e desenvolvimento do site e do aplicativo |
| 3 | 5 | Lançamento do aplicativo, primeiras assinaturas e pagamento anual da manutenção do site |
| 7 | 33 | A Nexus passa a ter lucro todos os meses |
| 12 | 85 | O primeiro ano termina com lucro de R$ 7.905,00 |
| 14 | 110 | Os sócios recuperam todo o dinheiro investido |
| 24 | 212 | Resultado acumulado de cerca de R$ 132.000,00 |

## A.12 Cenários de conversão (texto 4.7.5 e Apêndice A)

| Conversão (assinantes a cada 100 gratuitos) | Primeiro mês de lucro | Investimento recuperado | Observação do documento |
|---|---|---|---|
| 3 (pessimista) | mês 9 | mês 18 | Aporte extra de cerca de R$ 2.700,00 nos primeiros meses |
| 5 (base) | mês 7 | mês 14 | Mensalidades do 1º ano R$ 41.084,00; lucro do 1º ano R$ 7.905,00; 85 assinantes e cerca de 1.700 gratuitos no fim do 1º ano; 212 assinantes e cerca de R$ 132.000,00 acumulados no mês 24 |
| 7 (otimista) | mês 6 | mês 12 | Ainda no primeiro ano |

Em todos os cenários a Nexus se paga em menos de dois anos.

## A.13 Projeção mês a mês, 24 meses `[reconstruído]`

O documento traz só os marcos (A.11) e a Figura 4 (barras e linha, sem tabela). A tabela abaixo é o **modelo de referência do protótipo**, gerado pelas fórmulas da RN-FIN-24 com a série da RN-FIN-25. Ela reproduz **exatamente** todos os marcos: primeiro mês de lucro (7, 9 e 6), retorno (14, 18 e 12), assinantes nos meses 3, 7, 12, 14 e 24 (5, 33, 85, 110, 212), e aproxima os valores em reais a menos de 0,5% (RN-FIN-26 e 27). Mês 3 e mês 15 incluem a manutenção anual do site (R$ 400,00).

### A.13.1 Cenário-base (5 assinantes a cada 100 gratuitos)

| Mês | Novos gratuitos | Gratuitos acumulados | Assinantes (5%) | Receita bruta (R$) | Receita líquida (R$) | Gastos (R$) | Resultado do mês (R$) | Resultado acumulado (R$) | Saldo do investimento (R$) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0,00 | 0,00 | 2.355,00 | -2.355,00 | -2.355,00 | -19.555,00 |
| 2 | 0 | 0 | 0 | 0,00 | 0,00 | 2.355,00 | -2.355,00 | -4.710,00 | -21.910,00 |
| 3 | 100 | 100 | 5 | 504,50 | 449,00 | 2.755,00 | -2.306,00 | -7.016,00 | -24.216,00 |
| 4 | 100 | 200 | 10 | 1.009,00 | 898,01 | 2.355,00 | -1.456,99 | -8.472,99 | -25.672,99 |
| 5 | 140 | 340 | 17 | 1.715,30 | 1.526,62 | 2.355,00 | -828,38 | -9.301,37 | -26.501,37 |
| 6 | 160 | 500 | 25 | 2.522,50 | 2.245,03 | 2.355,00 | -109,97 | -9.411,34 | -26.611,34 |
| 7 | 160 | 660 | 33 | 3.329,70 | 2.963,43 | 2.355,00 | 608,43 | -8.802,91 | -26.002,91 |
| 8 | 200 | 860 | 43 | 4.338,70 | 3.861,44 | 2.355,00 | 1.506,44 | -7.296,47 | -24.496,47 |
| 9 | 200 | 1.060 | 53 | 5.347,70 | 4.759,45 | 2.355,00 | 2.404,45 | -4.892,02 | -22.092,02 |
| 10 | 180 | 1.240 | 62 | 6.255,80 | 5.567,66 | 2.355,00 | 3.212,66 | -1.679,36 | -18.879,36 |
| 11 | 240 | 1.480 | 74 | 7.466,60 | 6.645,27 | 2.355,00 | 4.290,27 | 2.610,91 | -14.589,09 |
| 12 | 220 | 1.700 | 85 | 8.576,50 | 7.633,09 | 2.355,00 | 5.278,09 | 7.889,00 | -9.311,00 |
| 13 | 240 | 1.940 | 97 | 9.787,30 | 8.710,70 | 2.355,00 | 6.355,70 | 14.244,70 | -2.955,30 |
| 14 | 260 | 2.200 | 110 | 11.099,00 | 9.878,11 | 2.355,00 | 7.523,11 | 21.767,81 | 4.567,81 |
| 15 | 200 | 2.400 | 120 | 12.108,00 | 10.776,12 | 2.755,00 | 8.021,12 | 29.788,93 | 12.588,93 |
| 16 | 260 | 2.660 | 133 | 13.419,70 | 11.943,53 | 2.355,00 | 9.588,53 | 39.377,46 | 22.177,46 |
| 17 | 220 | 2.880 | 144 | 14.529,60 | 12.931,34 | 2.355,00 | 10.576,34 | 49.953,80 | 32.753,80 |
| 18 | 240 | 3.120 | 156 | 15.740,40 | 14.008,96 | 2.355,00 | 11.653,96 | 61.607,76 | 44.407,76 |
| 19 | 200 | 3.320 | 166 | 16.749,40 | 14.906,97 | 2.355,00 | 12.551,97 | 74.159,73 | 56.959,73 |
| 20 | 180 | 3.500 | 175 | 17.657,50 | 15.715,18 | 2.355,00 | 13.360,18 | 87.519,91 | 70.319,91 |
| 21 | 200 | 3.700 | 185 | 18.666,50 | 16.613,19 | 2.355,00 | 14.258,19 | 101.778,10 | 84.578,10 |
| 22 | 200 | 3.900 | 195 | 19.675,50 | 17.511,19 | 2.355,00 | 15.156,19 | 116.934,29 | 99.734,29 |
| 23 | 180 | 4.080 | 204 | 20.583,60 | 18.319,40 | 2.355,00 | 15.964,40 | 132.898,69 | 115.698,69 |
| 24 | 160 | 4.240 | 212 | 21.390,80 | 19.037,81 | 2.355,00 | 16.682,81 | 149.581,50 | 132.381,50 |

Conferência com o documento (cenário-base):

| Marco | Documento | Modelo de referência | Diferença |
|---|---|---|---|
| Assinantes no mês 3, 7, 12, 14, 24 | 5, cerca de 33, 85, 110, 212 | 5, 33, 85, 110, 212 | 0 |
| Primeiro mês de lucro | mês 7 | mês 7 | 0 |
| Retorno do investimento | mês 14 | mês 14 | 0 |
| Mensalidades do primeiro ano | R$ 41.084,00 | R$ 41.066,30 | R$ 17,70 (0,04%) |
| Resultado do primeiro ano | R$ 7.905,00 | R$ 7.889,00 | R$ 16,00 (0,20%) |
| Gratuitos acumulados no mês 12 | cerca de 1.700 | 1.700 | 0 |
| Saldo no mês 24 | cerca de R$ 132.000,00 (Figura 4: R$ 132,2 mil) | R$ 132.381,50 | 0,29% (0,14% sobre a figura) |
| Maior prejuízo acumulado de operação | cabe na reserva de cerca de R$ 9.300,00 | R$ 9.411,34 (mês 6) | R$ 111,34 acima da reserva (folga de arredondamento do "cerca de") |

### A.13.2 Cenários 3% e 7% (mesma série de gratuitos acumulados)

| Mês | Assinantes (3%) | Resultado do mês 3% (R$) | Saldo do investimento 3% (R$) | Assinantes (7%) | Resultado do mês 7% (R$) | Saldo do investimento 7% (R$) |
|---|---|---|---|---|---|---|
| 1 | 0 | -2.355,00 | -19.555,00 | 0 | -2.355,00 | -19.555,00 |
| 2 | 0 | -2.355,00 | -21.910,00 | 0 | -2.355,00 | -21.910,00 |
| 3 | 3 | -2.485,60 | -24.395,60 | 7 | -2.126,39 | -24.036,39 |
| 4 | 6 | -1.816,19 | -26.211,79 | 14 | -1.097,79 | -25.134,18 |
| 5 | 10 | -1.456,99 | -27.668,78 | 24 | -199,78 | -25.333,96 |
| 6 | 15 | -1.007,98 | -28.676,76 | 35 | 788,03 | -24.545,93 |
| 7 | 20 | -558,98 | -29.235,74 | 46 | 1.775,85 | -22.770,08 |
| 8 | 26 | -20,17 | -29.255,91 | 60 | 3.033,06 | -19.737,02 |
| 9 | 32 | 518,63 | -28.737,28 | 74 | 4.290,27 | -15.446,75 |
| 10 | 37 | 967,64 | -27.769,64 | 87 | 5.457,69 | -9.989,06 |
| 11 | 44 | 1.596,24 | -26.173,40 | 104 | 6.984,30 | -3.004,76 |
| 12 | 51 | 2.224,85 | -23.948,55 | 119 | 8.331,32 | 5.326,56 |
| 13 | 58 | 2.853,46 | -21.095,09 | 136 | 9.857,94 | 15.184,50 |
| 14 | 66 | 3.571,87 | -17.523,22 | 154 | 11.474,35 | 26.658,85 |
| 15 | 72 | 3.710,67 | -13.812,55 | 168 | 12.331,57 | 38.990,42 |
| 16 | 80 | 4.829,08 | -8.983,47 | 186 | 14.347,99 | 53.338,41 |
| 17 | 86 | 5.367,89 | -3.615,58 | 202 | 15.784,80 | 69.123,21 |
| 18 | 94 | 6.086,29 | 2.470,71 | 218 | 17.221,62 | 86.344,83 |
| 19 | 100 | 6.625,10 | 9.095,81 | 232 | 18.478,83 | 104.823,66 |
| 20 | 105 | 7.074,10 | 16.169,91 | 245 | 19.646,24 | 124.469,90 |
| 21 | 111 | 7.612,91 | 23.782,82 | 259 | 20.903,46 | 145.373,36 |
| 22 | 117 | 8.151,72 | 31.934,54 | 273 | 22.160,67 | 167.534,03 |
| 23 | 122 | 8.600,72 | 40.535,26 | 286 | 23.328,09 | 190.862,12 |
| 24 | 127 | 9.049,73 | 49.584,99 | 297 | 24.315,90 | 215.178,02 |

Conferência com o documento (cenários):

| Cenário | Primeiro lucro (doc / modelo) | Retorno (doc / modelo) | Outros |
|---|---|---|---|
| 3% | mês 9 / mês 9 | mês 18 / mês 18 | Maior prejuízo acumulado R$ 12.055,91 (mês 8), logo aporte extra de R$ 2.755,91 (doc: cerca de R$ 2.700,00). Saldo no mês 24: R$ 49.584,99 |
| 7% | mês 6 / mês 6 | mês 12 / mês 12 | Maior prejuízo acumulado R$ 8.133,96, dentro da reserva. Saldo no mês 24: R$ 215.178,02 |

## A.14 Canais de comunicação direta com usuários (Quadro 9)

| Canal | Finalidade | Tempo de resposta |
|---|---|---|
| Aplicativo (mensagens) | Dúvidas sobre uso, planos e rede | Até 24 horas úteis |
| WhatsApp | Atendimento, avisos e apoio a quem usa pouco o aplicativo | Até 4 horas úteis |
| Telefone | Alternativa para quem não usa a plataforma | Imediato, em horário comercial |
| E-mail | Documentos, contratos e parcerias | Até 48 horas úteis |

## A.15 Classificação ARP do prestador (POP-02 e 5.10.1)

| Faixa | Condição | Consequência |
|---|---|---|
| Excelência | Média igual ou superior a 4,5 | Permanece na rede sem ressalvas; destaque nas buscas, sem prejuízo de mais de uma opção por especialidade |
| Alerta (monitoramento) | Média igual ou superior a 4,0 e inferior a 4,5 | Sócio responsável entra em contato para entender o que aconteceu e combinar ajustes; acompanha a evolução nas quinzenas seguintes |
| Descredenciamento | Média inferior a 4,0, ou mais de duas reclamações graves (faltas sem justificativa, quebra de sigilo) | Deixa de aparecer na busca (suspenso das indicações), avaliação interna com direito a justificativas; confirmado o problema, credenciamento encerrado e comunicado por e-mail |
| Sem média | Menos de 5 avaliações | Sem faixa por média; reclamações graves continuam contando |

Cálculo: duas notas de 1 a 5 por avaliação (qualidade técnica; pontualidade e cordialidade) e campo aberto; média de cada prestador calculada a cada 15 dias, com pelo menos 5 avaliações.

## A.16 Jornada do usuário

Fluxograma (Figura 2), nove etapas em três fases:

| Etapa | Descrição | Fase |
|---|---|---|
| 1 | Conhece a Nexus | Entrada e organização (plano gratuito) |
| 2 | Baixa o aplicativo gratuitamente | Entrada e organização (plano gratuito) |
| 3 | Cadastra cuidador e pessoa idosa | Entrada e organização (plano gratuito) |
| 4 | Organiza a rotina de cuidados | Entrada e organização (plano gratuito) |
| 5 | Identifica uma necessidade | Atendimento psicológico e rede |
| 6 | Agenda psicólogo ou consulta a rede | Atendimento psicológico e rede |
| 7 | Encontra o profissional ou serviço | Atendimento psicológico e rede |
| 8 | Contrata conforme as condições | Atendimento psicológico e rede |
| 9 | Usa descontos (assinantes) e acompanha a rotina | Uso contínuo |

Rodapé da figura: em todas as etapas, WhatsApp e telefone são canais alternativos; planos pagos acrescentam grupos, capacitações e benefícios ampliados.

Quadro 8, jornada de atendimento ao usuário:

| Etapa | O que o usuário vive | O que a Nexus faz | Resultado esperado |
|---|---|---|---|
| Descoberta | Reconhece que o que sente tem nome | Conteúdo nas redes, indicação de profissionais, rodas de conversa | Identificação com o problema |
| Cadastro gratuito | Baixa o aplicativo e cadastra a si e à pessoa idosa | Oferece o plano Nexus Livre | Experiência antes da compra |
| Organização | Organiza agenda, medicamentos e lembretes | Disponibiliza ferramentas e conteúdos | Rotina mais previsível |
| Necessidade | Precisa de um profissional ou serviço | Apresenta opções da rede credenciada | Menos tempo procurando |
| Contratação | Escolhe e contrata o prestador | Informa condições e benefícios | Contratação com segurança |
| Apoio | Participa de grupos e capacitações (planos pagos) | Organiza turmas com profissionais habilitados | Menos isolamento e mais preparo |
| Benefícios | Usa o Cartão Nexus | Mantém parcerias ativas | Economia para a família |
| Acompanhamento | Avalia os serviços e acompanha a rotina | Monitora avaliações e reclamações | Melhoria contínua da rede |

## A.17 Funções previstas na fase inicial (Quadro 7)

| Função | Atribuições | Forma de atuação |
|---|---|---|
| Sócios | Aporte de capital, decisões estratégicas, acompanhamento de indicadores | Contrato social |
| Gestão do negócio e da plataforma | Relacionamento com usuários, gestão da rede, parcerias, comunicação, acompanhamento do aplicativo | Integrantes do grupo ou profissional contratado |
| Responsável técnico em Psicologia | Supervisão técnica das atividades que envolvem serviços psicológicos; orientação ética; validação de conteúdos | Psicólogo com inscrição ativa no CRP-04 |
| Profissionais de grupos e capacitações | Condução dos grupos de apoio, da terapia de grupo, quando oferecida, e das capacitações | Profissionais convidados ou credenciados |
| Rede credenciada | Atendimentos nas diferentes áreas do cuidado | Contratados diretamente pelo usuário |
| Serviços terceirizados | Desenvolvimento do aplicativo, contabilidade e assessoria jurídica | Contrato de prestação de serviços |

## A.18 Fases do plano de comunicação (Quadro 2)

| Fase | Ações |
|---|---|
| Fase 1: pré-lançamento | Criação das redes sociais, identidade visual, produção de conteúdo, apresentação do problema e captação de parceiros |
| Fase 2: lançamento | Divulgação do aplicativo, campanha de cadastro gratuito, divulgação dos primeiros parceiros e apresentação dos planos |
| Fase 3: crescimento | Anúncios segmentados, depoimentos, campanhas com parceiros, divulgação do canal corporativo e expansão da rede |

Frase de campanha: "Você cuida de todo mundo. Mas quem cuida de você?"

## A.19 Comparativo entre o Projeto Nexus e os concorrentes (Quadro 1)

| Critério | Home care | Gestão de cuidadores | ILPI | Aplicativo | Psicologia on-line | Nexus |
|---|---|---|---|---|---|---|
| Usuário central | Pessoa idosa | Pessoa idosa | Pessoa idosa | Cuidador (parcial) | Quem busca terapia | Cuidador familiar |
| Apoio ao cuidador | Não | Não | Não | Não | Não específico | Psicólogos próprios, grupos e capacitações |
| Plano gratuito | Não | Não | Não | Sim | Não identificado | Sim |
| Organização digital da rotina | Parcial | Não | Não | Sim | Não | Sim |
| Acesso a diferentes profissionais | Equipe própria | Parcial | Equipe própria | Não | Psicólogos | Psicólogos próprios e rede credenciada |
| Benefícios com parceiros | Não | Não | Não | Não | Não identificado | Cartão Nexus (planos pagos) |
| Atendimento presencial | Sim | Sim | Sim | Não | Não | Salas em coworking |
| Custo para a família | Alto | Alto | Muito alto | Gratuito | Varia conforme o canal | Gratuito ou acessível |

## A.20 Dados de mercado usados no documento

| Dado | Valor | Origem |
|---|---|---|
| Habitantes de Uberlândia (Censo 2022) | 713.224 | §4.2.1 |
| Proporção de pessoas com 60 anos ou mais (Brasil) | 15,8% | §4.2.1, IBGE 2023 |
| Idosos estimados em Uberlândia | cerca de 112 mil | §4.2.1 |
| Dependência funcional (hipótese de trabalho) | 15% a 20% | §4.2.1 |
| Famílias com algum nível de cuidado domiciliar | cerca de 17 mil a 22 mil | §4.2.1 |
| Pessoas com 60 anos ou mais no Brasil (Censo 2022) | 32,1 milhões (15,8%), 56% mais que em 2010 | §1.1 |
| Cuidadores domiciliares que são mulheres | 9 em cada 10 | §1.1 (Seade, 2021) |
| Conversão do freemium (literatura) | 2% a 5% dos gratuitos | §4.7.3 |

## A.21 Relação de anexos do documento (Quadro 14)

| Anexo | Conteúdo | Situação no documento |
|---|---|---|
| A | Roteiro de perguntas aos profissionais e cuidadores (primeira etapa) | Disponível |
| B | Roteiro da pesquisa de validação | Item 6.1 |
| C | Termo de Consentimento Livre e Esclarecido | Produzir |
| D | Termo de autorização de uso de imagem e depoimento | Produzir |
| E | Guia de Boas Práticas do Projeto Nexus | Produzir |
| F | Procedimentos Operacionais Padrão (POP-01 a POP-10) | Estrutura no item 5.10 |
| G | Telas do aplicativo (produto mínimo viável) | Produzir |
| H | Minuta do contrato de credenciamento | Produzir |
| I | Minuta do contrato social e acordo de sócios | Produzir |
| J | Mapeamento da rede de apoio de Uberlândia | Levantar |
| K | Planilha de investimento, receitas e custos | Produzir |

No ERP, os anexos C, D, E e H viram **modelos de documento simulados** (texto fictício de demonstração, versionado), porque são exigidos por RN-LGPD-04, RN-LGPD-06, RN-CAP-06 e RN-REDE-06.

---

# ANEXO B. Inconsistências do documento

Regra de resolução: vale o texto principal do capítulo 4 e a Figura 1 (precedência em 0.4). Nenhuma delas muda uma regra de negócio adotada.

| ID | Onde | O que diverge | Adotado |
|---|---|---|---|
| I-01 | Figura 5 (Estrutura e funcionamento) | Cita planos pagos "de R$ 49,90 a R$ 169,90". Texto 4.4.3, Figura 1 e Quadro 4 trazem R$ 49,90, R$ 119,90 e R$ 149,90 (o maior é R$ 149,90). | Texto e Figura 1. O R$ 169,90 não existe. |
| I-02 | Capítulo 7 (Conclusão) | Diz investimento de R$ 17.699, reserva de R$ 9.000, ponto de equilíbrio com 34 assinantes, lucro mensal no oitavo mês e retorno no décimo quinto. O item 4.7, a Figura 3, o Quadro 6 e o Apêndice A trazem R$ 17.200, R$ 9.300, 27 assinantes, mês 7 e mês 14. | Item 4.7 (27, mês 7, mês 14). |
| I-03 | Sumário e corpo, 4.7.2 | O item "Investimento inicial e fontes de capital" e o Quadro 3 aparecem duplicados. | Valores idênticos; sem efeito. |
| I-04 | Item 5.8 e quadros | O texto cita "Quadro 9" para os indicadores do piloto, mas esse é o Quadro 10 (o Quadro 9 é o de canais). Os quadros de indicadores (5.5) e de faixas da Zarit (5.8) não têm número. | Quadros identificados pelo conteúdo, não pelo número. |
| I-05 | 5.4 e 5.8 | Âncora do item 4 da Zarit: "sempre" (5.4) versus "quase sempre" (5.8). | Rótulo "sempre/quase sempre"; semântica igual (RN-ZRT-02). |
| I-06 | 4.1, 4.5.1, Q.8 e Fig.1 | O texto diz que grupos e capacitações são dos "planos pagos". A Figura 1 e o Apêndice A os colocam **a partir do Nexus Cuida** (o Essencial não os inclui). | Figura 1 e Apêndice A (RN-PLN-10). |
| I-07 | Apêndice B, item 1 | Lista cinco nomes de plano ("Nexus Livre, Essencial, Cuida, Sustenta e Integral"). O texto e a Figura 1 têm quatro. | Quatro planos; "Integral" não existe. |
| I-08 | Texto geral | "Cartão Nexus" e "Cartão de Benefícios" para o mesmo benefício; "Nexus Livre" e "Livre". | Cartão Nexus; Nexus Livre (nome completo em tela, "Livre" em espaços curtos). |
| I-09 | 5.4, quadros e 5.8 | Frequência da Zarit: "a cada três meses" (quadro e 5.4) versus "reaplicada após três a seis meses de uso" (5.4) versus piloto "na adesão, aos 3 e aos 6 meses". | A cada 3 meses; no piloto, adesão, 3 e 6 meses (RN-ZRT-05 e 06). |
| I-10 | Quadro de faixas, 0 a 20 | A conduta é "convite para os grupos de apoio", mas grupos só valem a partir do Cuida. | Convite informativo; participação segue o plano; rodas abertas valem para todos (RN-ZRT-09). |
| I-11 | Título 4.4.2 | O título fala em "taxa de intermediação", mas o texto e 6.4 afirmam que não há porcentagem sobre atendimentos e que a receita é de assinaturas, parcerias e canal corporativo. | Sem taxa de intermediação (RN-REDE-12). |
| I-12 | Apêndice B, itens 2 e 3 | Cita "marketing" nos custos mensais e "R$ 1.000 mensais de marketing digital". O 4.6.3 e o 4.7.4 dizem que o orçamento de comunicação não está nos gastos mensais (R$ 2.355,00). | R$ 2.355,00 sem marketing (RN-FIN-33). |
| I-13 | Quadro de indicadores, ARP | A ARP fala em "média das notas de 1 a 5" (uma nota), mas o formulário tem duas notas (técnica; pontualidade e cordialidade). | Nota da avaliação = média das duas (RN-ARP-03). |
| I-14 | 5.10 e 5.10.1 | A coleta ocorre "ao fim de cada atendimento da rede" (5.10) ou "logo após cada atendimento domiciliar, como fisioterapia ou enfermagem" (5.10.1). | Todo atendimento da rede; o domiciliar é o exemplo (RN-ARP-02). |
| I-15 | Apêndice A e Conclusão | "Investimento inicial de R$ 17.200 acrescido dos deslocamentos" trata deslocamentos como parte do investimento. O 4.7.4 e o Quadro 5 os tratam como gasto mensal (R$ 1.306,00). | Deslocamentos são gasto mensal. |
| I-16 | Repositório (não do documento) | `docs/referencias/fluxo-encaminhamento.png` é a capa do capítulo 6. | O fluxo é o Quadro 12 (A.10). |

Lacunas (não são inconsistências, e foram preenchidas como suposição): valores do atendimento psicológico (RN-ATD-05); limites da ARBE (RN-ARBE-05); limiar da taxa de recusa (RN-REDE-28); metas do piloto (RN-PIL-09); preço do canal corporativo (RN-CORP-05); prazos de resposta de reclamação formal (RN-POP-08); retenção de dados (RN-LGPD-23); benefícios exatos por plano (RN-PLN-21).

---

# ANEXO C. Glossário

| Termo | Significado |
|---|---|
| ANPD | Autoridade Nacional de Proteção de Dados |
| ARBE | Avaliação de Risco de Burnout e Esgotamento: cruza horas diárias de cuidado, frequência de pedidos de apoio e Zarit e emite alerta aos psicólogos |
| ARP | Avaliação da Rede Profissional: notas de 1 a 5 dadas pelos cuidadores aos prestadores, com taxa de recusa e disponibilidade de agenda |
| Cartão Nexus | Benefício de descontos em estabelecimentos parceiros, exclusivo de assinantes |
| CAPS | Centro de Atenção Psicossocial (rede pública de saúde mental) |
| CFP | Conselho Federal de Psicologia |
| CRAS | Centro de Referência de Assistência Social |
| CREAS | Centro de Referência Especializado de Assistência Social |
| CRO, CREFITO, COREN, CRN, OAB | Conselhos de classe de odontologia, fisioterapia, enfermagem, nutrição e advocacia |
| CRP-04 | Conselho Regional de Psicologia da 4ª Região (Minas Gerais) |
| CVV (188) | Centro de Valorização da Vida, apoio emocional e prevenção do suicídio |
| Credenciado, prestador | Profissional ou empresa da rede credenciada, não empregado da Nexus |
| Defensoria Pública | Assistência jurídica gratuita a quem comprova hipossuficiência |
| Disque 100 | Canal nacional de denúncia de violações de direitos humanos |
| Encarregado | Pessoa designada para tratar dados pessoais e atender titulares (DPO) |
| Freemium | Modelo com versão gratuita e cobrança por recursos adicionais |
| ILPI | Instituição de Longa Permanência para Idosos |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018) |
| Luto ambíguo | Perda sem marco claro, em que a pessoa cuidada está presente, mas se afasta aos poucos |
| MVP | Produto mínimo viável: o aplicativo em versão inicial, com rede e parcerias iniciais |
| People Analytics | Coleta, tratamento e análise ética de dados sobre pessoas para apoiar decisões, aplicada aqui ao cuidador, à rede e à equipe |
| POP | Procedimento operacional padrão (POP-01 a POP-10) |
| Pseudonimização | Substituição de identificadores por códigos, de modo que a pessoa só é reidentificada com informação adicional guardada à parte |
| RIPD | Relatório de Impacto à Proteção de Dados |
| RT | Responsável técnico em Psicologia, inscrito no CRP-04 |
| SAMU (192) | Serviço de Atendimento Móvel de Urgência |
| SLA | Prazo de resposta combinado (Quadro 9) |
| TCC | Terapia Cognitivo-Comportamental, base dos grupos e capacitações |
| TCLE | Termo de Consentimento Livre e Esclarecido (Anexo C do documento; piloto) |
| UBS | Unidade Básica de Saúde |
| Zarit (ZBI) | Escala de Sobrecarga do Cuidador de Zarit: 22 itens de 0 a 4, total de 0 a 88 (versão brasileira de Scazufca, 2002) |

---

# ANEXO D. Suposições de protótipo consolidadas

Todas as suposições abaixo são lacunas do documento. Valores padrão são editáveis em Configurações (02, módulo 15) quando for parâmetro; o dono pode trocá-las sem afetar nenhuma regra `[doc]`.

| ID | Regras | Suposição | Valor padrão |
|---|---|---|---|
| S-01 | PLN-14, PLN-15 | Troca de plano e estados da assinatura | Upgrade imediato; downgrade e cancelamento no fim do ciclo; pagamento simulado |
| S-02 | PLN-21, ATD-05 | Parâmetros dos benefícios por plano | Sessão R$ 120,00; desconto 0%, 10%, 15%, 20% (Livre a Sustenta); prioridade de vaga para Cuida e Sustenta |
| S-03 | CRT-10, 11, 12 | Estados do parceiro, desconto do cartão, número do cartão | `prospect`, `legal_ethics_review`, `active`, `suspended`, `ended`; percentual por parceiro; `NX-0000-0000` |
| S-04 | USR-13, 14, 17 | Grau de dependência, maioridade, estados do cadastro | `independent`, `partial`, `total`; 18 anos; ver RN-USR-17 |
| S-05 | ATD-14, 15, 16 | Agenda em vagas de 1 hora, estados da sessão, cancelamento | Segunda a sexta 8h às 18h; 24 horas de antecedência |
| S-06 | GRP-13, 14 | Capacidade e lista de espera, elegibilidade de terapia de grupo | 12 vagas; terapia de grupo por indicação |
| S-07 | REDE-20, 22, 23 | Estados do credenciamento, documento vencido, reprovação | Ver RN-REDE-20; 30 dias para regularizar documento vencido |
| S-08 | REDE-28, 29 | Limiares de recusa e de queda de agenda | 30% com mínimo de 5 solicitações; queda superior a 50% |
| S-09 | ARP-15, 16, 17 | Arredondamento, edição da avaliação, reinstalação | 2 casas, meio para cima; 7 dias; reinstalação com motivo |
| S-10 | ZRT-02, 07, 14, 21, 24 | Rótulos intermediários, Zarit na adesão ao Livre, escalada do vermelho, adendo, estados | 1 raramente, 2 algumas vezes, 3 frequentemente; escalada ao RT às 23h59 |
| S-11 | ARBE-05, 06, 08 | Limites e níveis da ARBE | 8 horas diárias; 3 pedidos em 30 dias; Zarit 41 ou mais; `attention` com 2 de 3; `critical` com 3 de 3 ou Zarit 61 ou mais |
| S-12 | EQP-05 | Mecânica da redistribuição de agenda | Transferência por RT ou gestão, com log |
| S-13 | KPI-02, 04, 07, 08, 12, 14, 23, 24 | Definições operacionais de indicadores sem fórmula no documento | Ver as regras; mínimo de 5 por grupo exibido |
| S-14 | FIN-15, 25, 27 | Manutenção do site no mês 15, série de gratuitos, tolerância | Série A.13; tolerância de 0,5% |
| S-15 | CORP-05, 06 | Preço e contrato corporativos | Preço por vaga editável, fora da projeção |
| S-16 | POP-08 | Prazo de reclamação formal | 5 dias úteis |
| S-17 | LGPD-05, 21, 22, 23, 25 | Granularidade de consentimentos, prazo do titular, prazo de comunicação de incidente, retenção, aviso de protótipo | Lista (a) a (f); 15 dias; 3 dias úteis; 5 anos; aviso fixo |
| S-18 | CAP-08 | Periodicidade da formação continuada | Trimestral |
| S-19 | PIL-09 | Metas do piloto | Redução da Zarit de 10%; satisfação 4,0; conversão 3% |
| S-20 | CAN-03 | Horário comercial e dias úteis | Segunda a sexta, 8h às 18h (Brasília), sem feriados nacionais |
| S-21 | (02) | Itens da Zarit em texto parafraseado | O ERP usa 22 enunciados parafraseados de demonstração; substituir pelo texto oficial licenciado (Scazufca, 2002) antes de qualquer uso real |
| S-22 | (02) | Login simulado, dados 100% fictícios, tudo no navegador | Ver 02, seções 1, 5 e 6 |

