# Visão do cuidador (aplicativo do cliente): contexto e decisões (leia antes de qualquer tarefa)

## Por que existe
O ERP (docs 00 a 09) é a visão da **equipe** da Nexus. O foco do plano de negócios, porém, é o **cuidador familiar**, o cliente. O dono pediu a visão do usuário: "o foco inicial é a visão do usuário". Esta frente constrói o **aplicativo do cuidador** dentro do mesmo projeto Angular e sobre os mesmos dados. O que o cuidador faz aparece para a equipe (agenda do psicólogo, fila de mensagens, solicitações da rede, inscrição em grupo, assinatura), e o que a equipe registra aparece para ele.

Isto revoga o item "Aplicativo do cuidador" de `docs/02-escopo-erp.md` seção 8.1 (fora de escopo). As regras de negócio continuam as de `docs/01-regras-de-negocio.md`, sem discussão.

## Para quem se desenha
O público é o familiar que cuida de uma pessoa idosa: em sua maioria mulheres de 40 a 65 anos, com pouco tempo, cansadas, que adiam o cuidado consigo mesmas. Parte tem baixa familiaridade digital. Personas do plano:
- **Ana, 45**, filha, trabalha, concilia consultas, remédios e profissionais da mãe. Precisa de organização e praticidade.
- **Maria, 52**, divide trabalho e cuidado da mãe com Alzheimer; dor: ninguém para dividir.
- **João, 68**, cuida da esposa, pouca familiaridade com tecnologia, precisa de canais simples (telefone e WhatsApp); dor: isolamento.

**Princípio de produto (feedback direto do dono sobre outro app deste público): "tem MUITA informação, essa plataforma é para o CLIENTE."** Cada tela tem um propósito e uma ação principal. Pouco texto, termos simples, nada de jargão clínico, nada de painel. O que não é para agora fica atrás de um toque. Conferir cada tela com a pergunta: "uma pessoa cansada, com 2 minutos e uma mão ocupada, entende o que fazer?"

Tom de voz (RN-ETICA-15, doc 4.1.3): acolhedor, direto, sem jargão. Não infantiliza, não romantiza o sacrifício (nada de "guerreira", "anjo", "heroína"), não promete resultado terapêutico, não usa o sofrimento como apelo. Fala em "você". Nada de travessão (— ou –) em nenhum texto.

## Arquitetura de informação (fixa: não mude a navegação principal)
Barra inferior no celular (5 itens) e a mesma navegação no topo em tela larga. Conteúdo em coluna de até 720 px no celular e tablet; em tela larga, coluna central de até 960 px.

| Item | Rota base | O que reúne |
|---|---|---|
| Hoje | `/cuidador/hoje` | O dia: próximo compromisso, remédios de hoje com "dei", como você está, um convite para você, "Ajuda agora" |
| Rotina | `/cuidador/rotina` | **Agenda** (`/agenda`) e **Remédios** (`/remedios`) da pessoa idosa, em duas abas simples |
| Cuidar de mim | `/cuidador/cuidar-de-mim` | Porta de entrada com 4 cartões: **Conversar com um psicólogo** (`/atendimento`), **Como estou** (`/como-estou`), **Grupos e capacitações** (`/grupos`), **Conteúdos** (`/conteudos`) |
| Rede | `/cuidador/rede` | Buscar profissionais e serviços (`/buscar`, `/profissional/:id`), **Meus pedidos** (`/pedidos`), **Cartão Nexus** (`/cartao`) |
| Mais | `/cuidador/mais` | **Meu plano** (`/plano`), **Falar com a Nexus** (`/ajuda`), **Família** (`/familia`), **Privacidade e meus dados** (`/privacidade`), **Meu perfil** (`/perfil`), tamanho da letra, **Sair** |

Rotas fora da barra: `/cuidador/comecar` (cadastro de quem é novo, passo a passo), `/cuidador/ajuda-agora` (SAMU 192, CVV 188, falar com a Nexus; sempre a um toque, no cabeçalho de todas as telas).

## Entrada
- `/login` passa a ter duas portas: **"Sou cuidador(a)"** (primeira e em destaque) e **"Sou da equipe Nexus"** (a lista atual, mais discreta, com o segundo fator de sempre). O cuidador **não** tem segundo fator (RN-LGPD-15 vale só para a equipe) e não tem senha no protótipo: escolhe a pessoa de demonstração ou toca em "Criar minha conta".
- A sessão do cuidador fica em `sessionStorage` (chave `nexus-erp:caregiver-session`), separada da sessão da equipe. Sessão de cuidador nunca abre `/app/**` (volta a `/cuidador/hoje`) e sessão da equipe nunca abre `/cuidador/**` (volta a `/app/painel`).
- Pessoas de demonstração (6 na entrada e mais 4 em "Ver mais exemplos"; ids do seed, ver `docs/08` seção 7.2):

| Pessoa | Id | Plano | Por que está na lista |
|---|---|---|---|
| Ana Paula Ferraz, 45 | `cg_0001` | Cuida | Persona Ana. Zarit 63 hoje, a equipe vai ligar hoje (contato pendente); ARBE crítico; grupos e capacitações liberados |
| Maria Aparecida Lemos, 52 | `cg_0002` | Essencial | Persona Maria. Zarit 79, contato vencido; pediu revisão de decisão; Cartão Nexus ativo; grupos bloqueados pelo plano |
| João Batista Carneiro, 68 | `cg_0003` | Livre | Persona João. Pouca familiaridade digital, prefere telefone; Zarit caiu de 66 para 52; sem Cartão |
| Rita de Cássia Moura, 50 | `cg_0008` | Cuida | Zarit 41, acompanhamento prioritário |
| Elza Guimarães, 68 | `cg_0027` | Sustenta | Usa muito o Cartão Nexus; já avaliou a rede |
| Lourdes Campos, 64 | `cg_0024` | Sustenta | Em lista de espera de um grupo lotado; piloto |
| Terezinha Alves, 66 | `cg_0012` | Essencial | Piloto concluído, evolução de 40 para 18 |
| Marcos Vinícius Leal, 39 | `cg_0026` | Essencial | Cancelamento agendado; nunca mandou mensagem (estado vazio) |
| Sônia Maria Dutra, 55 | `cg_0016` | Essencial | Consentimento de saúde revogado (a Zarit e o acompanhamento ficam parados) |
| Marlene Cardoso, 61 | `cg_0004` | Livre | Caso simples: Zarit 0, só organização |

Cuidador com cadastro `closed`, `anonymizedAt` ou `erasedAt` não entra. Quem tem pedido de exclusão aberto entra normalmente.

## A jornada do plano (Figura 2) vira telas
1 a 3 conhece, baixa e cadastra a si e a pessoa idosa: **`/cuidador/comecar`** (quem é novo) | 4 organiza a rotina: **Rotina** e **Hoje** | 5 identifica uma necessidade: **Cuidar de mim** e **Rede** | 6 agenda psicólogo ou consulta a rede: **Conversar com um psicólogo** e **Buscar** | 7 encontra o profissional ou serviço: **Buscar e Profissional** | 8 contrata conforme as condições: **Pedidos** (o cuidador pede, o prestador aceita pela equipe, o cuidador avalia) | 9 usa descontos e acompanha a rotina: **Cartão** e **Hoje**.

## Regras que mais pesam nesta frente (todas em `docs/01`)
- **Cadastro e rotina**: RN-USR-02 a 11, 14, 17, 18 (cadastro, horas de cuidado 0 a 24, canal preferido, 18 anos ou mais, um cuidador principal por pessoa idosa, informações da família só com autorização expressa item a item). RN-USR-07 (o que o app oferece: agenda, lembretes de remédio e consulta, registro de remédios, conteúdos, mensagens).
- **Planos**: RN-PLN-01 a 08, 10, 13, 14, 19, 22. Livre = organização básica, agenda e lembretes, conteúdos, acesso inicial à rede. Essencial = mais organização ampliada, Cartão Nexus, conteúdos exclusivos, condições especiais na rede. Cuida = mais grupos e capacitações. Sustenta = mais acompanhamento próximo e benefícios diferenciados. **Sem pegadinha**: quadro de planos sem letra miúda, aviso "a mensalidade não inclui serviços da rede nem atendimento psicológico" na contratação, cancelamento a qualquer mês, rebaixar ou cancelar vale no fim do ciclo pago, upgrade vale na hora. **Dados de Zarit, alertas e ARBE nunca viram oferta, desconto nem convite de upgrade** (RN-PLN-19).
- **Atendimento psicológico**: RN-ATD-02 (on-line, coworking, domicílio), 03 a 05 (agenda pelo app, vale para todos os planos; assinantes têm condições próprias: padrão R$ 120,00 por sessão com 0, 10, 15 e 20% de desconto), 07 a 11 (formato remoto, domicílio só com segurança confirmada, SAMU 192), 12 (prioridade de vaga para acompanhamento prioritário, **sem o cuidador ser informado do motivo**), 15 a 16 (cancelar com 24 h ou mais), 19 (mostrar se é psicoterapia ou orientação).
- **Zarit**: RN-ZRT-04 (a equipe aplica; o cuidador **não** preenche sozinho), 19 e 23 (o cuidador vê a própria evolução: linha do tempo de pontuações e faixas), 20 (pode pedir revisão de decisão), 18 e 22 (nunca diagnóstico, nunca a palavra "eficácia"), 26 e LGPD-14 (sem consentimento de saúde não há Zarit). Alerta vermelho: contato da equipe no mesmo dia (RN-ZRT-13).
- **Grupos**: RN-GRP-02 (inscrição só Cuida e Sustenta; rodas abertas valem para todos), 09 (aceite do contrato de sigilo antes de entrar), 13 (12 vagas, lista de espera, promoção automática), 16 e ATD-19 (mostrar se é orientação ou psicoterapia).
- **Rede e Cartão**: RN-REDE-10 (sempre mais de uma opção por especialidade; se só há uma, aviso "única opção disponível no momento", nunca esconder), 17 (a Nexus organiza, não presta o serviço), 18 (prestador suspenso não aparece), 19 e 30 (destaque, ficha com nota quando há 5 avaliações ou mais, a faixa de monitoramento **não** aparece ao usuário), 25 e 26 (todos os planos consultam, comparam e pedem; condições especiais só do Essencial em diante; fluxo de pedido), RN-ARP-02 e 16 (duas notas de 1 a 5, comentário, uma avaliação por serviço concluído, pode corrigir em até 7 dias), RN-CRT-02, 10, 11 (cartão só para assinante pago, só parceiro ativo, percentual do parceiro, número `NX-0000-0000`; Livre vê que o benefício existe, como convite).
- **Canais**: RN-CAN-01 a 06 e USR-18 (aplicativo, WhatsApp, telefone, e-mail; prazos de resposta 24 h úteis, 4 h úteis, imediato em horário comercial, 48 h úteis; **nenhuma função essencial depende só do app**; aviso por escrito de que os canais não substituem atendimento clínico nem orientação sobre medicação e de que emergência é SAMU 192).
- **LGPD do titular**: RN-LGPD-04 e 05 (consentimentos separados e granulares: saúde para acompanhamento, indicadores agregados, compartilhar com a família, imagem e depoimento, WhatsApp; cada um aceito, recusado ou revogado sem condicionar o Livre), 14 (revogar o de saúde pausa a Zarit e o acompanhamento, mas Livre e agenda continuam), 18 e 20 e 21 (exportar os dados, correção, eliminação, informação, revisão; prazo de 15 dias corridos com dias restantes visíveis), 24 (o que é registro documental fica bloqueado, o cuidador é informado do motivo e do prazo), 25 (aviso de protótipo visível).
- **Ética**: ninguém recebe valor por encaminhar; a escolha é do cliente (ATD-13, ENC-10).

## Decisões de produto (já tomadas, não reabrir)
1. Mesma aplicação, mesmo `Database`, mesmo relógio simulado (`Clock`), mesmo seed. Nada de regra duplicada: reaproveite `core/rules`, os serviços `core/*` e os serviços de `features/*/state`. Se um serviço da equipe tem checagem de perfil que impede o cuidador, **extraia o miolo** para uma função ou serviço de núcleo e mantenha a checagem de perfil na borda; não copie a lógica.
2. O cuidador vê **os próprios dados sem máscara** (CPF mascarado só em listas longas, nunca no próprio perfil). Não existe visão de outro cuidador. O log de auditoria registra acesso da **equipe**; o cuidador não gera linha de "view" do próprio dado, mas ações dele que a equipe precisa saber (agendou, cancelou, pediu, inscreveu-se, mudou consentimento, pediu eliminação) geram o registro de domínio normal e, onde já existe, o evento de consentimento.
3. **Coleção nova permitida**: `doseChecks` (tomada de remédio: `medicationId`, `date`, `time`, `givenAt`). Siga `docs/08` seção 9 (coleção, prefixo de id `dose`, `emptyCollections`, migração se o formato exigir). Nenhuma outra sem justificar na seção "Decisões do Dev" do doc de arquitetura.
4. Autorização de compartilhamento com a família: usa o consentimento (c) existente; o compartilhamento é **um texto pronto para copiar** (agenda e remédios do dia, só o que o cuidador marcar, nunca nada de atendimento, grupo ou Zarit). Sem envio real.
5. Pagamento é simulado e nunca coleta número de cartão real (campos de formulário de pagamento não existem; a assinatura é "confirmar troca de plano").
6. WhatsApp e telefone: números fictícios `(34) 90000-0000`; nenhum link `tel:` nem `wa.me` real abre sozinho: o toque abre um diálogo "Como falar com a gente" com o número, "Copiar número" e o aviso "No protótipo, a ligação não é feita". Resolve também o CX-041 pendente: se o canal preferido é WhatsApp e o cuidador não tem número, avisar no perfil.
7. Tamanho da letra: três níveis (Normal, Grande, Bem grande) em "Mais", guardado no navegador; o nível padrão do app do cuidador já é maior que o da equipe (corpo em 18 px, alvos de toque de 48 px ou mais).
8. Idioma e identificadores: código em inglês, textos em pt-BR; `node scripts/check-core.mjs` precisa passar.

## Critérios de aceite
Prefixo `AC-CG-NN`, escritos pelo agente de UX em `docs/10-cuidador-ux.md` e acompanhados por cada dev em `docs/ac-status/caregiver-<area>.md`.

## Divisão do trabalho e posse de arquivos
| Papel | Pasta ou arquivo que possui | Não toca |
|---|---|---|
| UX e UI do cuidador | `docs/10-cuidador-ux.md` | código |
| Base (Dev F) | `src/app/features/caregiver-app/{shell,state,ui,routing}`, `core/auth` (sessão do cuidador), `features/auth` (a escolha de entrada), `app.routes.ts`, `src/styles/_caregiver.scss`, coleção `doseChecks` no `core`, seed das pessoas de demonstração | páginas das áreas |
| Dev P1 | `features/caregiver-app/{start,today,routine,family}` | o resto |
| Dev P2 | `features/caregiver-app/{care,my-wellbeing,help,privacy}` | o resto |
| Dev P3 | `features/caregiver-app/{network,card,plan,groups,content}` | o resto |

Cada área é uma pasta com `<area>.routes.ts` (que exporta `ROUTES`), `pages/`, `state/` e `<area>.spec.ts`. A Base cria os esqueletos e o carregamento sob demanda de cada área; os devs só preenchem a própria pasta. Mudança em arquivo de outra posse vira pedido ao líder.

## Regras de trabalho (as mesmas de `docs/00-contexto.md`, com um reforço)
- RAM é limitada: nada de `ng serve` ou navegador deixados abertos. Só a Base e o líder sobem servidor. Devs de página validam por **testes, typecheck e build**, sem servidor. Um `ng` por vez.
- Não faça `git commit` nem `git push`: o líder commita.
- Não invente regra. Omissão do plano vira **suposição de protótipo** marcada em `docs/10-cuidador-ux.md` (UX) ou no doc de arquitetura (Dev).
- Escreva os arquivos cedo e grave o progresso nos docs: se a sessão cair, o trabalho precisa estar no disco.
- Nenhum nome, RA ou dado das autoras do trabalho em lugar nenhum. Todos os dados são fictícios.
- Não reintroduzir dentista nem portal do prestador (decisões do dono).
