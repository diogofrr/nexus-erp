# CS/CX do aplicativo do cuidador

Rodada de uso feita no navegador embutido, como cada pessoa de demonstração, em celular de 375 px (altura de 760 a 812 px), com passadas em 1280 px, em 812 x 375 px (paisagem) e em letra "Bem grande". Nada foi corrigido: este documento só descreve o que foi visto e sentido.

## 0. Como foi feito e o que ficou de fora

- Entrada pela tela de entrada (com o toque no cartão da pessoa) para Ana, Maria, João e para a pessoa nova (Beatriz). Para Rita, Elza, Lourdes, Marcos e Sônia a sessão foi trocada pelo console do navegador (atalho), porque o caminho de entrada é o mesmo.
- Tempos são **estimados pelo caminho** (toques mais rolagem), não cronometrados com relógio. Os toques são contados de verdade.
- Os botões "Ligar para o SAMU 192" e "Ligar para o CVV 188" **não foram tocados**: o ambiente negou a ação por ser uma ligação. Foram lidos no código e no teste do projeto (abrem um diálogo com o número, "Copiar número" e a frase "No protótipo, a ligação não é feita"). O número 192 e 188 já aparece grande na tela de Ajuda agora, sem precisar do toque.
- O botão "Copiar número" falha no navegador embutido (a área de transferência é negada). Foi avaliado o plano B do próprio app (selecionar o número e dizer como copiar à mão).
- O relógio do protótipo acompanha a hora real do aparelho (21h, quinta-feira 05/11), o que importa para vários achados (equipe "fechada", remédios "passou do horário").
- Estado do navegador: ao terminar, o banco local foi **reposto para o seed** (`localStorage` e `sessionStorage` limpos) e o preset voltou para desktop.
- Console: nenhum erro e nenhum aviso em toda a rodada.

## 1. Resumo

O app está **calmo, curto e honesto** na maior parte das telas: uma ação principal, folhas de baixo com "Voltar", erros que dizem o que fazer, efeito dito antes de gravar, "Desfazer" em ações leves, e nenhuma oferta ligada ao cansaço da pessoa. A letra "Bem grande" funciona, persiste e não vaza em Hoje, Remédios, Meu plano e Como estou.

Os problemas que o cliente sentiria primeiro são:

1. **Duas telas parecem quebradas** em 375 px: a linha de compromisso que "passou do horário" na Agenda (o texto vira uma coluna de letras com mais de 690 px de altura) e o seletor de humor de Como estou (caixas estreitas, sem rostos). Os dois são P1.
2. **Hoje cobra**: dois a três "Passou do horário" seguidos, em âmbar, para quem já está cansada, mais a promessa "a equipe vai falar com você hoje" às 21h, com a equipe fechada.
3. **Cadastro da pessoa nova cansa na etapa 4 e na 5** (3.600 px e 2.800 px de rolagem, com a barra fixa ocupando um quarto da tela).
4. **Texto técnico** em lugares que o dono quer leves: "psicoeducação", "Luto ambíguo", "objetivo clínico", "escala de cansaço do cuidador", "Números somados", "DSR-0006", "responsável técnica".

### Nota média de satisfação por pessoa (0 a 10)

| Pessoa | Plano | Nota | Por quê, em uma frase |
|---|---|---|---|
| Ana | Cuida | 6,0 | Hoje é claro, mas a Agenda quebra, o humor quebra e "Sobrecarga severa" aparece junto de "vai falar com você hoje" |
| Maria | Essencial | 5,5 | Três "Passou do horário", nota com "responsável técnica foi avisada" e humor quebrado em Como estou |
| João | Livre | 7,5 | Tudo simples e sem oferta; o telefone aparece, mas só no fim de Hoje |
| Rita | Cuida | 8,0 | Avaliar um serviço é rápido e claro |
| Elza | Sustenta | 7,5 | Cartão claro, mas com uma lista longa de compras |
| Lourdes | Sustenta | 8,0 | "Lista de espera, posição 1. Avisamos quando abrir uma vaga" |
| Marcos | Essencial | 8,0 | "Manter meu plano" em 1 toque e estado vazio acolhedor |
| Sônia | Essencial | 7,5 | A pausa é bem explicada em Como estou; Hoje perde o humor sem explicar |
| Beatriz (nova) | Livre | 6,5 | Começar é leve e o rascunho funciona; as etapas 4 e 5 pesam |

Média geral: **7,2**. Os achados por severidade: **2 P1, 13 P2, 13 P3** (28 no total).

## 2. Tarefas

SEQ: 1 (muito difícil) a 7 (muito fácil). Toques contados a partir da tela citada. "Tempo percebido" é estimado (sem tela de rolagem longa = rápido).

| Pessoa | Tarefa | Toques | Tempo percebido | SEQ | Observação |
|---|---|---|---|---|---|
| Ana | Entrar | 1 | rápido | 6 | Cartão da pessoa, sem senha; só os 2 primeiros cartões cabem na tela |
| Ana | Marcar o remédio das 08:00 e desfazer | 1 + 1 | rápido | 6 | Para ver o botão, rola uma tela; "Dei" e "Desfazer" ficam no mesmo ponto (CXC-008) |
| Ana | Saber o próximo compromisso | 0 | rápido | 7 | Cartão logo abaixo da nota |
| Ana | Achar o telefone da Nexus (de Hoje) | 2 | rápido | 6 | "Prefere falar agora?" abre a folha; sem a nota, Ajuda agora e Como falar com a gente |
| Ana | Achar o telefone sem estar entrada | 1 mais rolagem de 2 telas | médio | 4 | "Ajuda agora" fica no fim da entrada (CXC-014) |
| Ana | Adicionar uma consulta de amanhã | 7 | médio (cerca de 1 min) | 5 | Data pelo seletor do aparelho; o item novo aparece abaixo da linha quebrada (CXC-001) |
| Ana | Mudar o horário | 4 | rápido | 5 | A folha reabre 5 campos para mudar só a hora (CXC-018) |
| Ana | Marcar conversa com psicólogo | 7 | médio (cerca de 1 min 30) | 6 | Preço claro; folha de confirmação com 1,7 tela |
| Ana | Remarcar a conversa | 4 | rápido | 4 | Avisa "falta", mesma consequência de cancelar (CXC-006) |
| Ana | Cancelar a conversa (mais de 24 h) | 3 | rápido | 7 | "Cancelar libera o horário. Não há custo." |
| Ana | Como estou e pedir revisão | 2 e 4 | médio | 5 | Linguagem calma; humor quebrado (CXC-002); "decisão tomada com base nos seus resultados" é abstrato |
| Ana | Grupos: entrar e ver o sigilo | 6 | médio | 6 | Aceite com erro calmo |
| Ana | Rede: buscar, comparar, ver a ficha e pedir | 10 | médio (cerca de 2 min) | 5 | Resultados abaixo das 10 categorias (CXC-011); comparação empilhada (CXC-012) |
| Ana | Meu plano: trocar de plano | 7 | médio | 5 | Segundo passo só com aviso de emergência (CXC-010); sem desfazer |
| Ana | Retirar a autorização de saúde | 5 | médio | 6 | Efeito dito antes; Hoje perde nota e humor sem avisar |
| Ana | Pedir cópia dos dados | 3 | rápido | 7 | "Avisa você em até 15 dias" |
| Ana | Pedir eliminação e retirar o pedido | 5 e 1 | médio | 5 | Prazo só aparece depois (CXC-009) |
| Ana | Família: gerar o texto | 5 | rápido | 6 | Nada pré-marcado; a garantia "nada de conversa com psicólogo" fica abaixo do botão |
| Maria | Hoje, ler a nota e agir | 0 a 1 | rápido | 5 | "Falar com a gente agora" é claro; o tom pesa (CXC-003) |
| Maria | Grupos bloqueados pelo plano | 3 | médio | 5 | Bloqueio calmo e sem pressão, mas só no fim da ficha (CXC-021) |
| Maria | Perfil: WhatsApp sem número | 5 | médio | 5 | O app barra e avisa ("Informe o número do WhatsApp") |
| João | Entrar e ler Hoje | 1 | rápido | 6 | Telefone dele no fim da tela (CXC-025) |
| João | Cartão Nexus (sem cartão) | 2 | rápido | 7 | Convite curto, sem pressão |
| João | Conversa: preço | 7 | médio | 6 | R$ 120,00 sem desconto, sem oferta de plano |
| Rita | Avaliar serviço concluído | 4 | rápido | 7 | Duas notas, comentário opcional, 1 sheet |
| Lourdes | Lista de espera | 2 | rápido | 7 | Posição e promessa de aviso |
| Marcos | "Manter meu plano" | 3 | rápido | 7 | Sem confirmação, com aviso "Plano mantido." |
| Marcos | Cancelar plano | 2 | rápido | 7 | Diz o que acontece com o cartão e o plano |
| Marcos | Estado vazio de mensagens | 0 | rápido | 7 | "Você ainda não mandou nenhuma mensagem" |
| Sônia | Ver a pausa da saúde | 2 | rápido | 6 | Bem explicada em Como estou |
| Beatriz | Criar conta (5 etapas) | cerca de 25 entre toques e campos | longo (4 a 6 min) | 4 | Etapas 4 e 5 pesam (CXC-015); rascunho funciona |
| Beatriz | Fechar no meio e voltar | 2 | rápido | 7 | "Você tem um cadastro em andamento. Retomar ou começar de novo?" |
| Equipe | Ver Beatriz, a mensagem e a conversa na visão da equipe | 8 | médio | 6 | Tudo apareceu (seção 6) |

## 3. Achados

Severidade: P1 bloqueia ou machuca, P2 atrapalha, P3 melhoria.

### P1

**CXC-001 (P1) Linhas com etiqueta larga quebram letra por letra.** Pessoa: Ana (e qualquer pessoa com compromisso do dia já passado; em Falar com a Nexus, qualquer pessoa cujo canal preferido seja o aplicativo, visto com Ana). Tela: Rotina, Agenda (375 px) e Mais, Falar com a Nexus. O que aconteceu: o primeiro item da Agenda ("16:00 Sessão de fisioterapia", com a etiqueta "Passou do horário (16:00)") ficou com o texto em 8 px de largura e a linha com 693 px de altura, uma coluna de letras. Em "Bem grande" o texto fica com 0 px. Em Falar com a Nexus, "Mensagem no aplicativo" vira "Mensag / em no / aplicativ / o" porque "Seu canal preferido" toma o espaço. Em 1280 px não acontece. Por que importa: acontece todo dia a partir da hora do primeiro compromisso, na tela que a pessoa abre para ver "o que tenho hoje"; parece defeito do app e esconde o compromisso. Sugestão: a etiqueta vai para baixo do título em telas estreitas (ou o texto ganha largura mínima e a etiqueta quebra para a linha de baixo).

**CXC-002 (P1) Humor de Como estou sem rostos e com caixas estreitas.** Pessoa: Ana, Maria (qualquer pessoa com saúde autorizada). Tela: Cuidar de mim, Como estou (375 e 1280 px, letra normal e Bem grande). O que aconteceu: as 5 opções saem como uma lista de caixas de 36 px de largura, sem o rosto (o ícone tem largura 0) e com o texto colado na caixa e quebrando ("Mais / ou / menos"). O mesmo componente em Hoje funciona bem (lista de botões largos com rosto, em Bem grande; fileira de 5 rostos em letra normal). Por que importa: é a tela mais sensível do app e o ponto onde a pessoa conta como está; parece quebrada e a área de toque é pequena. Sugestão: usar na tela Como estou o mesmo desenho de Hoje (largura total, rosto e texto).

### P2

**CXC-003 (P2) A nota de cuidado promete "hoje" à noite e soa como protocolo.** Pessoa: Ana, Maria. Tela: Hoje e Como estou. O que aconteceu: às 21h, Ana lê "A equipe de psicologia vai falar com você hoje" e, ao tocar em "Prefere falar agora?", a folha diz "Fechado agora. Abrimos amanhã às 8h". Maria lê "A equipe ainda não conseguiu falar com você. A responsável técnica foi avisada e vai procurar você." Por que importa: a promessa de "hoje" vira quebra de promessa depois das 18h; "responsável técnica foi avisada" soa a alarme e a vigilância, e "ainda não conseguiu falar com você" soa como se a pessoa tivesse faltado. Sugestão: usar "hoje" só em horário comercial (à noite, "amanhã de manhã"); para Maria, "Queremos falar com você. Se quiser, fale com a gente agora" (cortar "responsável técnica foi avisada").

**CXC-004 (P2) "Sobrecarga severa, 63 pontos" logo abaixo da nota de cuidado.** Pessoa: Ana (63), Maria (79). Tela: Como estou. O que aconteceu: a linha do tempo mostra "Sobrecarga severa" e "63 pontos" em destaque, depois "Entender as faixas" explica bem ("o cuidado está pesando muito"), mas fica atrás de um toque. Por que importa: é fiel à regra (faixa por extenso, "Não é um diagnóstico") e calmo no desenho, mas a palavra "severa" e o número chegam sem moldura para quem acabou de ler que a equipe vai ligar. Sugestão: mostrar primeiro a frase da faixa ("o cuidado está pesando muito") e deixar o nome técnico e os pontos na legenda.

**CXC-005 (P2) Hoje acumula "Passou do horário".** Pessoa: Maria (3), João (3), Ana (2). Tela: Hoje, Remédios. O que aconteceu: cada remédio sem marca mostra uma linha âmbar "Passou do horário (08:00)", e os já dados ficam no topo, com os pendentes mais abaixo. Por que importa: para Maria, que não tem com quem dividir, três avisos amarelos seguidos soam como cobrança; em Bem grande o primeiro "Dei" pendente fica a 2 telas de distância. Sugestão: mostrar o que falta primeiro, trocar o texto por algo neutro ("08:00, ainda não anotado") e usar o âmbar só uma vez.

**CXC-006 (P2) Cancelar ou remarcar com menos de 24 h: a saída "segura" tem a mesma consequência.** Pessoa: Ana. Tela: Conversar com um psicólogo. O que aconteceu: a conversa marcada para amanhã às 17h (cerca de 20 h depois) foi aceita. Ao cancelar, a folha diz "Faltam menos de 24 horas. Se cancelar agora, o horário fica registrado como falta" e oferece "Remarcar em vez de cancelar". Ao remarcar, a folha diz "Se remarcar agora, o horário atual fica registrado como falta". Por que importa: a pessoa foi levada a achar que remarcar evitava a falta. "Falta" também não diz o que muda para ela (cobrança, perda de vaga). Sugestão: dizer o efeito em uma frase ("a conversa conta como perdida; não há cobrança") e tirar o "em vez de cancelar" quando o efeito é o mesmo.

**CXC-007 (P2) Confirmação da conversa diz duas coisas e repete três vezes.** Pessoa: Ana, Beatriz. Tela: Conversar com um psicólogo, depois de marcar. O que aconteceu: aparece "Conversa marcada: sex, 06/11, às 17:00" junto de "Aguardando confirmação do psicólogo" (a conversa está marcada ou não?), o texto "psicólogoVer na agenda" sai sem espaço, a mesma informação vem de novo no cartão "Sua próxima conversa" e no aviso rápido. Quem escolheu "Não sei" vê depois "On-line · Orientação psicológica". Por que importa: uma pessoa cansada precisa de uma frase só e certa; a escolha "Não sei" foi trocada sem aviso. Sugestão: uma faixa só ("Pedido enviado. O psicólogo confirma em até X"), o cartão com "A confirmar", e mostrar "A definir na conversa" quando a pessoa escolheu "Não sei".

**CXC-008 (P2) "Dei" e "Desfazer" ocupam o mesmo ponto da tela.** Pessoa: qualquer uma (testado com Maria). Tela: Hoje e Remédios. O que aconteceu: depois de tocar em "Dei", o botão vira "Desfazer" no mesmo lugar; um segundo toque, 400 ms depois (o hábito de dar dois toques), desfaz o que acabou de marcar. O duplo toque instantâneo não duplicou nem desfez. Por que importa: a pessoa acha que marcou, o remédio volta para "Passou do horário" e ela pode dar duas doses. Sugestão: manter o "Desfazer" só no aviso inferior ou separar bem a posição do botão por 1 s.

**CXC-009 (P2) Pedir eliminação não diz o prazo antes de confirmar.** Pessoa: Ana. Tela: Privacidade e meus dados. O que aconteceu: a folha diz o que será eliminado e o que fica guardado por 5 anos (claro), mas não o prazo. O prazo ("Faltam 15 dias") só aparece depois do pedido, com o código "DSR-0006". Por que importa: a pessoa decide sem saber quanto tempo leva; "DSR" é código interno. Sugestão: pôr "A equipe responde em até 15 dias" na folha (como já é em "Pedir uma cópia dos meus dados") e tirar o código.

**CXC-010 (P2) Trocar de plano: segundo passo vazio e lista do plano novo sem o que já valia.** Pessoa: Ana. Tela: Meu plano. O que aconteceu: depois de "Mudar para o Sustenta?" aparece outra folha, "Antes de confirmar", cujo conteúdo é o aviso de emergência com a caixa "Li e entendi", sem dizer o que se entendeu. Depois da troca, "Seu plano agora" lista só o que é novo do Sustenta e some "Grupos de apoio" e "Capacitações", que continuam valendo. Não há como desfazer uma subida (só "Manter meu plano" em mudança agendada). Por que importa: dois passos para uma decisão que já foi dita bem no primeiro; a pessoa pode achar que perdeu os grupos. Sugestão: juntar os dois passos (o aviso de emergência como uma linha), listar tudo o que o plano inclui, e dizer em uma frase como voltar atrás.

**CXC-011 (P2) Na Rede, escolher "Fisioterapia" não mostra nada.** Pessoa: Ana. Tela: Rede, Buscar. O que aconteceu: a tela continua igual, só com o selo de marcado; as 5 opções ficam mais de 600 px abaixo das 10 categorias, sem rolar sozinho. Por que importa: "toquei e nada aconteceu". Sugestão: rolar até os resultados ou mostrar "5 opções, ver" junto da categoria.

**CXC-012 (P2) "Lado a lado" empilha e compara pouco.** Pessoa: Ana. Tela: Rede, comparar. O que aconteceu: em 375 px as duas opções aparecem uma sob a outra (duas telas), com "Condições" idênticas e só a nota e "Atende em casa" diferentes. Por que importa: comparar exige lembrar de uma tela para a outra e o texto repetido não ajuda a decidir. Sugestão: uma tabela curta de 3 linhas (nota, atende em casa, o que muda) ou ocultar a linha igual para as duas.

**CXC-013 (P2) O botão voltar do aparelho não fecha folhas nem passos.** Pessoa: Ana. Tela: Rotina, Conversar com um psicólogo. O que aconteceu: com uma folha aberta, o "voltar" do navegador sai da tela e a folha some junto; os passos de marcar conversa (formato, horário, confirmar) não entram no histórico e o voltar do aparelho pula todos. Por que importa: no Android o gesto de voltar é o mais usado. Sugestão: registrar a folha e o passo no histórico.

**CXC-014 (P2) Na entrada, "Ajuda agora" e "Criar minha conta" ficam longe.** Pessoa: Ana, Beatriz. Tela: Entrada. O que aconteceu: "Criar minha conta" está a 1.590 px do topo (2 telas) e "Ajuda agora" a 1.680 px, sem o botão fixo do cabeçalho das outras telas. A lista de pessoas de demonstração é o que empurra. Por que importa: quem está em emergência e ainda não entrou encontra o número no fim de uma lista de 6 pessoas; o cuidador novo vê o caminho de cadastro só no fim. Sugestão: o botão "Ajuda agora" no cabeçalho também na entrada e "Criar minha conta" logo abaixo do título (no produto real a lista de pessoas some).

**CXC-015 (P2) Cadastro: as etapas 4 e 5 cansam.** Pessoa: Beatriz. Tela: Começar. O que aconteceu: a etapa 4 tem 5 autorizações em 3.600 px (a de saúde sozinha tem 5 blocos de texto), a etapa 5 repete tudo o que foi digitado, 2.830 px, e a barra fixa de baixo (Continuar, Voltar e "Rascunho salvo") ocupa um quarto da tela. A etapa 1 tem 6 campos e pede CPF sem dizer o porquê. Por que importa: é o primeiro contato e o ponto onde a pessoa nova desiste. Sugestão: uma autorização por tela (ou "Decidir depois para todas"), a de saúde em duas frases com "Ler mais", a etapa 5 só com uma linha por bloco e "Editar", e uma frase antes do CPF.

### P3

**CXC-016 (P3) Folha "Como falar com a gente" é longa.** Pessoa: Ana, João. Tela: Hoje, Ajuda agora. O que aconteceu: 4 canais em 2,3 telas, com "Voltar" só no fim (tocar fora fecha, mas nada avisa); o e-mail em fonte grande quebra no meio ("atendimento@exe / mplo.com.br"); quando "Copiar número" falha, a mensagem de plano B aparece no fim da folha, longe do botão e em verde. Sugestão: o canal preferido e o telefone no alto, os outros dois atrás de "Mais jeitos", mensagem de falha ao lado do botão em cor de aviso.

**CXC-017 (P3) O aviso rápido cobre botões e repete o aviso da tela.** Pessoa: Ana. Tela: Hoje, Rede, Conversar. O que aconteceu: "Anotado às 21:11" cobre o "Dei" do remédio de baixo; "Pedido enviado. A equipe avisa você..." e "Conversa marcada" aparecem na faixa da tela e de novo no aviso rápido. Sugestão: só um dos dois.

**CXC-018 (P3) "Remarcar" um compromisso reabre o formulário inteiro.** Pessoa: Ana. Tela: Agenda. Cinco campos para mudar só a hora. Sugestão: abrir só o dia e a hora.

**CXC-019 (P3) Jargão em telas que o dono quer leves.** Pessoa: todas. Telas: Grupos ("Orientação e psicoeducação", "Luto ambíguo, em grupo", "Terapia de grupo"), Conversar ("Acompanhamento regular, com objetivo clínico"), Privacidade ("escala de cansaço do cuidador", "Números somados da Nexus"), Como estou ("conversa de acompanhamento", "decisão tomada com base nos seus resultados"), Cartão e Rede ("Registro: CREFITO-MG ... (fictício)"). Sugestão: "Para aprender e trocar" no lugar de psicoeducação; "Ajuda com o cansaço" no lugar de escala; "Resultados sem o seu nome" no lugar de números somados.

**CXC-020 (P3) Pequenas inconsistências de texto.** "Pausas curtas para quem cuida" é "Leitura de 3 minutos" em Hoje e "Leitura de 1 minuto" em Conteúdos; na pessoa nova, "Para você" aparece como etiqueta e como título logo abaixo; "Precisa de ajuda com o app ou com a sua conta?" acompanha o botão "Falar com a gente" que é o caminho para a equipe de cuidado; "Faltam 15 dias" não diz o que falta; o assunto da mensagem para a equipe parece obrigatório e não é.

**CXC-021 (P3) Grupos: repete a lista e o bloqueio vem tarde.** Pessoa: Ana, Maria. Tela: Grupos. "Minhas inscrições" e "Programação" repetem os mesmos grupos. Para Maria (Essencial) a lista não tem cadeado: o bloqueio ("Disponível no plano Cuida... As rodas de conversa abertas são para todos") só aparece no fim da ficha, depois de ler tudo. O texto é calmo e sem pressão. Sugestão: "Plano Cuida" na própria linha e a roda aberta primeiro para quem não tem acesso.

**CXC-022 (P3) Letra "Bem grande": funciona, com três ressalvas.** A preferência vale para o app e persiste (também depois de sair e entrar com outra pessoa no mesmo aparelho), mas não vale para a tela de entrada; a palavra "NEXUS" do logotipo some do cabeçalho; e Hoje e Agenda ficam com o botão pendente a 2 telas de distância. A barra inferior continua com 5 itens legíveis.

**CXC-023 (P3) Pequenos tropeços no cadastro.** Na página "Vamos começar" e nas etapas, a palavra "NEXUS" do cabeçalho encosta no botão "Ajuda agora" em 375 px; o aviso de protótipo aparece duas vezes (faixa e rodapé); o campo "Número do WhatsApp" aparece sob a barra fixa quando se escolhe o canal; o aviso de erro "Há 5 pontos para corrigir" repete a lista que já está junto dos campos; a tela final diz "Tudo bem." depois de "Decidir depois", como se respondesse a um "não".

**CXC-024 (P3) Meu perfil é longo e mostra o CPF por inteiro.** 2.046 px; três botões "Editar" iguais para leitor de tela; o rótulo "Quantas horas por dia..." fica deslocado ao lado do botão "-"; um erro de um campo vira "Há 1 ponto para corrigir" em caixa grande.

**CXC-025 (P3) João tem de rolar até o telefone.** Pessoa: João. Tela: Hoje. O cartão "Prefere falar com a gente? (34) 90000-0000" é o último bloco (3,5 telas em Bem grande), embora o canal preferido dele seja o telefone. O texto "No protótipo, a ligação não é feita." aparece dentro do cartão em vez de só no toque.

**CXC-026 (P3) Cartão de quem usa muito é longo.** Pessoa: Elza. Tela: Cartão Nexus. Oito compras listadas em 2.158 px. Sugestão: as 3 últimas e o total.

**CXC-027 (P3) Paisagem (812 x 375 px).** Cabeçalho e barra inferior ocupam um terço da altura; tudo continua utilizável.

**CXC-028 (P3) Hoje perde o humor sem explicar depois da retirada da autorização de saúde.** Pessoa: Ana, Sônia. A explicação ("O acompanhamento está pausado") está bem escrita, mas só em Como estou.

## 4. Carga de informação por tela

Nota 1 (leve) a 5 (pesada demais).

| Tela | Nota | O que cortar |
|---|---|---|
| Entrada | 3 | (Protótipo) a lista de 6 pessoas; no produto, só "Entrar" e "Criar minha conta" |
| Hoje, Ana | 3 | Mostrar o que falta primeiro; um aviso âmbar só |
| Hoje, Maria | 4 | Três "Passou do horário" e a nota de 4 linhas |
| Hoje, João | 3 | Telefone mais alto; manter o resto |
| Hoje, pessoa nova | 2 | O rótulo "Para você" duplicado |
| Rotina, Agenda | 2 | (A linha quebrada é CXC-001) |
| Rotina, Remédios | 3 | A lista "Todos os remédios" repete a de hoje; "Dei em outro horário" em cada dado |
| Cuidar de mim | 1 | Nada |
| Conversar, abertura | 1 | Nada |
| Conversar, horários | 2 | 12 horários de 5 profissionais; mostrar 3 primeiros e "Ver mais" |
| Conversar, confirmação | 4 | Preço e desconto em uma linha; o aviso do formato e a pergunta "O que você procura?" em uma só |
| Como estou | 4 | Introdução de 3 linhas, nota, humor, 7 dias, linha do tempo, datas, 2 links; manter nota, humor e a linha do tempo, mover o resto para "Saber mais" |
| Grupos (lista) | 4 | Repetição de inscrições, 5 cartões com 4 linhas cada, jargão |
| Grupos (ficha) | 3 | "Orientação e psicoeducação" duas vezes |
| Conteúdos | 2 | Nada |
| Rede | 1 | Nada |
| Rede, Buscar | 3 | Campo de nome opcional no alto; resultados escondidos |
| Rede, Ficha | 2 | Nada |
| Rede, Comparar | 3 | Linha "Condições" repetida |
| Meus pedidos | 2 | Nada |
| Cartão, ativo (Elza) | 4 | Histórico de 8 compras; "Onde usar" em 5 cartões |
| Cartão, convite (João) | 1 | Nada |
| Mais | 1 | Nada |
| Meu plano | 2 | A lista do que está incluso, completa |
| Meu plano, outros planos | 4 | "Tudo do plano anterior, mais:" (somar em 4 cartões) |
| Falar com a Nexus | 3 | Formulário já aberto com 3 assuntos; histórico longo |
| Folha "Como falar com a gente" | 3 | 4 canais; fechar com os dois principais |
| Ajuda agora | 2 | Mantém: 3 blocos curtos |
| Família | 2 | Mover a frase de garantia para antes do botão |
| Privacidade | 3 | 5 autorizações e 5 ações; "Números somados" renomear |
| Perfil | 4 | 2 telas de dados que a pessoa já sabe; CPF recolhido |
| Cadastro, etapa 1 | 3 | CPF e cidade em "depois" |
| Cadastro, etapa 2 | 2 | Nada |
| Cadastro, etapa 3 | 3 | Tamanho da letra pode ficar para Hoje |
| Cadastro, etapa 4 | 5 | Uma autorização por tela; texto curto |
| Cadastro, etapa 5 | 4 | Repetição integral dos dados |

## 5. O que está bom (manter)

- **Ajuda agora** em 1 toque de qualquer tela dentro do app, com 192 e 188 grandes na própria tela e tom calmo; funciona sem estar entrada.
- **Folhas de baixo** com texto curto, botão principal ao alcance do polegar e "Voltar" sempre presente; tocar fora fecha.
- **Erros calmos e junto do campo**: "Escolha uma das opções para continuar", "Marque que você leu o contrato de sigilo para entrar", "Conte em uma frase...".
- **Efeito dito antes de gravar**: "Cancelar libera o horário. Não há custo." (mais de 24 h), a retirada da autorização de saúde (o que fica pausado, o que continua, o que é guardado por 5 anos), o cancelamento de plano ("o cartão deixa de valer e o plano vira Livre").
- **Desfazer onde cabe**: remédio, compromisso, "Manter meu plano" (1 toque), "Retirar o pedido" (com "Nada foi eliminado.").
- **Sem pressão comercial**: Cartão para João como convite curto, conversa com preço neutro, bloqueio por plano calmo, nada de oferta ligada ao cansaço.
- **Estados vazios acolhedores** ("Você ainda não mandou nenhuma mensagem", "Nenhum remédio cadastrado", "Não encontramos esta atividade").
- **Cadastro**: rascunho guardado, "Retomar ou começar de novo" ao voltar, etapas de 5 passos com a barra de progresso.
- **Avaliar um serviço**: duas notas, rótulos nas pontas, comentário opcional, "O profissional não vê o seu nome".
- **Texto da Família**: nada pré-marcado, o texto muda na hora, só o que a pessoa liga.
- **Letra "Bem grande"** sem rolagem horizontal, sem texto cortado, humor de Hoje em lista vertical, barra inferior legível.
- **Alvos de toque**: todos os botões e links medidos em Hoje têm 48 px ou mais.
- **Console limpo** em toda a rodada, e a equipe vê a pessoa nova, a mensagem e a conversa.

## 6. Visão da equipe (Atendimento)

Entrando como Atendimento, pela porta da equipe e com o botão "Usar o código mostrado" do segundo fator simulado:

- **Painel**: Beatriz Nogueira Teste aparece em "Aguardando resposta" com o prazo de 10/11/2026, 12:00; a mensagem de Ana ("Outro assunto: Oi, queria combinar um horario...") também; "Cadastros novos" inclui a pessoa nova.
- **Mensagens**: as duas mensagens aparecem com o assunto escolhido (a de Ana, sem escolha, como "Outro assunto").
- **Atendimento, Sessões**: a conversa de Beatriz aparece "Agendada", 12/11/2026 17:00, Dra. Letícia, On-line, Orientação psicológica, código CUI-0341. O cuidador vê "Aguardando confirmação do psicólogo" para o mesmo registro.

## 7. Os 10 principais ajustes, em ordem de valor

1. **Corrigir as linhas com etiqueta larga** (Agenda com "Passou do horário", Falar com a Nexus com "Seu canal preferido"): CXC-001.
2. **Refazer o humor de Como estou** com o desenho de Hoje: CXC-002.
3. **Reescrever a nota de cuidado** para Ana e Maria (hora certa, sem "responsável técnica", sem "ainda não conseguiu") e **suavizar "Sobrecarga severa"** com a frase da faixa: CXC-003 e CXC-004.
4. **Hoje: mostrar o que falta primeiro** e trocar "Passou do horário" por texto neutro; separar "Dei" de "Desfazer": CXC-005 e CXC-008.
5. **Encurtar o cadastro**: uma autorização por tela, a de saúde em duas frases, etapa 5 sem repetir tudo, barra fixa menor: CXC-015.
6. **Cancelar e remarcar com menos de 24 h**: dizer a consequência e tirar a falsa saída: CXC-006 e confirmação única da conversa: CXC-007.
7. **Voltar do aparelho fecha folha e passo**, e a Rede rola até os resultados: CXC-013, CXC-011 e CXC-012.
8. **Eliminação com o prazo antes de confirmar**, sem código; **troca de plano em um passo** e com a lista completa do que inclui: CXC-009 e CXC-010.
9. **Cortar o jargão** (psicoeducação, luto ambíguo, objetivo clínico, escala de cansaço, números somados): CXC-019.
10. **Entrada: "Ajuda agora" no cabeçalho e "Criar minha conta" no alto**; telefone de João mais alto em Hoje: CXC-014 e CXC-025.

## 8. Anexo: testes técnicos

| Teste | Resultado |
|---|---|
| Botão voltar do navegador | Sai da tela e não fecha folha; passos de marcar conversa pulam juntos (CXC-013) |
| Recarregar no meio do cadastro | Volta com "Você tem um cadastro em andamento" e retoma na etapa 2 |
| Recarregar no meio de "marcar conversa" | O passo se perde (não há rascunho); a tela volta ao começo |
| Toque duplo em "Dei" | Marca uma vez; um segundo toque 400 ms depois desfaz (CXC-008) |
| Rotação 812 x 375 | Usável, mas o cabeçalho e a barra tomam um terço da altura (CXC-027) |
| Letra "Bem grande" | Sem rolagem horizontal em Hoje, Remédios, Plano e Como estou; humor de Como estou continua quebrado (CXC-002); a linha da Agenda piora (CXC-001) |
| Fechar folha com Escape e tocando fora | Funciona |
| Estado vazio (Marcos, sem mensagens) | Acolhedor |
| Console (`read_console_messages`) | Nenhum erro e nenhum aviso |
| Alvos de toque em Hoje | Todos com 48 px ou mais |
| Travessão, "!" ou emoji nas telas lidas | Nenhum visto |
