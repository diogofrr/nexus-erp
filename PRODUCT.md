# PRODUCT.md: Nexus ERP

## Propósito
Protótipo de front-end do ERP da **Nexus**, empresa de Uberlândia que cuida de quem cuida: o cuidador familiar de pessoas idosas. O ERP é o back-office da empresa, usado só pela equipe (a rede credenciada é cadastro gerido pela equipe, sem login próprio). Não é home care, clínica tradicional nem app de lembretes. Roda só no navegador (Angular, `localStorage` e `sessionStorage`), com dados 100% fictícios, mas se comporta como se tratasse dado real (LGPD).

Registro: **produto** (a pessoa está em tarefa, não em campanha). A interface serve ao trabalho; a marca aparece em medida, nunca atrapalha o dado.

## Usuários
| Perfil | Quem é | O que precisa |
|---|---|---|
| `partner` | Sócia e gestão | Decidir o comercial: planos, rede, finanças; vê saúde só agregada e pseudonimizada |
| `technical_lead` | Responsável técnica (CRP) | Supervisionar todos os casos, tratar alertas vermelhos no mesmo dia |
| `psychologist` | Psicólogo(a) da Nexus | Agenda, sessões, Zarit e alertas dos seus cuidadores |
| `support` | Atendimento e relacionamento | Cadastros, mensagens no prazo, solicitações do titular; sem dado clínico |

São quatro papéis de login. Os prestadores da rede credenciada são cadastros gerenciados por esses perfis, sem acesso próprio ao sistema.

Passam horas por dia no sistema, lendo tabelas, agendas e casos delicados. Contexto: escritório e coworking, luz do dia, monitor; no celular, a equipe consulta o essencial entre atendimentos.

## Personalidade da marca (do documento, seção 4.1.3)
**Acolhimento, confiança e organização.** Mãos abertas sustentando pessoas: sustentação, não controle. Tom: acolhedor, direto, sem jargão clínico; não infantiliza, não romantiza o sacrifício (nada de "guerreira" ou "anjo"), não promete resultado terapêutico, nunca diz "diagnóstico" nem "eficácia" para a escala de Zarit.

## Princípios de design
1. **Calma que sustenta.** Superfície off-white, dados em branco com borda fina, nada pisca, nada grita. O alerta vermelho é firme e silencioso: ícone, texto claro, prazo e uma ação.
2. **O azul manda, o dourado pontua.** Azul institucional em títulos, ação e seleção; dourado só em detalhe (a linha fina, a aba atual, o plano Sustenta). Serifa nos títulos, sans no corpo.
3. **Estado nunca depende só de cor.** Ícone, rótulo e posição, sempre (faixas do Zarit, agenda, risco, selos).
4. **Privacidade é experiência.** Dado mascarado por padrão, pseudonimizado para a gestão (`CUI-0042`), "menos de 5" nos agregados, tudo que se revela vai ao log.
5. **Densidade com respiro.** Tabela é o componente principal; grade de 8 px agrupa; alvo de 44 px em toque; texto 4,5:1.
6. **Consistência antes de surpresa.** Um vocabulário de componentes em todas as telas; encanto fica para o momento (resultado do Zarit, estado vazio com as mãos da marca).

## O que evitar
Gradiente roxo, cartões iguais com ícone em quadrado colorido, vidro borrado, sombra dura, número gigante com acento, display em rótulo ou botão, modal como primeiro recurso, alarme (vermelho em tela cheia, piscar, exclamação), emoji como ícone, qualquer travessão no texto.

## Restrições
- Angular 22 (standalone, signals, SCSS), pnpm, sem biblioteca de UI pesada; fontes e ícones locais; **nenhuma requisição externa** em tempo de execução.
- Todos os dados fictícios (CPF inválido, e-mail `@exemplo.com.br`, telefone `(34) 90000-0000`); aviso de protótipo no rodapé de toda tela.
- Responsivo de 360 a 1440 px, sem rolagem horizontal da página; WCAG 2.2 AA.
- Textos em pt-BR; identificadores de código em inglês.

## Onde está o resto
Regras de negócio: `docs/01-regras-de-negocio.md`. Escopo e telas: `docs/02-escopo-erp.md`. Sistema de design: `docs/03-design-system.md` e `docs/styleguide.html`. UX: `docs/04-ux.md`. Identidade visual: `DESIGN.md`.
