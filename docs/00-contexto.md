# Nexus ERP: contexto compartilhado (leia antes de qualquer tarefa)

## O que é
Protótipo de front-end do **ERP da Nexus** (empresa que cuida do cuidador familiar de pessoas idosas, Uberlândia).
Todas as regras de negócio vêm do plano de negócios da Nexus (documento de graduação em Psicologia).
O texto integral está FORA do repositório, em:
`C:\Users\ddiog\AppData\Local\Temp\claude\8c05796fa52cc755\6aa37290-f8cd-42bf-8477-fcd72bb64aea\scratchpad\nexus-doc.txt`
(184 KB, 2100 linhas, linhas longas: leia em blocos de uns 200 linhas). As figuras úteis estão em `docs/referencias/`.
O documento tem nomes e RA dos alunos nas primeiras páginas: **nunca copie nomes, RA ou dados pessoais dos autores** para o repositório.

## Pedido do dono (literal)
1. Respeitar SEM QUESTIONAR as regras de negócio do documento.
2. Front-end em Angular usando localStorage/sessionStorage que possibilite a manipulação dos dados.
3. Protótipo, mas com o front-end 100% funcional, respeitando LGPD e responsivo.
4. Identidade visual da Nexus como já é, em suas cores e em sua proposta.
5. UI moderna e bonita, com UX bem pensada para um app ERP. Referências: interfaces de produtos famosos (Linear, Stripe Dashboard, Notion, Vercel, Airbnb host tools, Apple Health) e os conceitos de UX/UI do Origamid.
6. Time de agentes: PM (regras), UI, UX, Dev, QA, CS/CX (simula um dentista usando o sistema e acha falhas).
7. Ao final, tudo num repositório do GitHub.

## Esclarecimento sobre o "dentista"
O documento descreve uma rede credenciada aberta a "profissionais de saúde, clínicas e serviços especializados", com credenciamento por registro ativo no conselho de classe. Um **dentista (CRO)** é, portanto, um profissional credenciado legítimo. O ERP tem um **Portal do Profissional Credenciado** e o seed inclui um dentista. O CS/CX usa essa persona. Isso não altera nenhuma regra de negócio, só define persona de teste.

## Marca (documento, seção 4.1.3, e `docs/referencias/planos.png`)
- Nome vem do latim: vínculo, ligação. Símbolo: duas mãos abertas sustentando três figuras humanas (mãos abertas = sustentação, não controle).
- Paleta: **azul institucional** (títulos e peças principais, confiança e serenidade), **dourado** (só detalhes e destaques, calor humano), branco e off-white nas áreas de texto.
- Cores dos planos na Figura 1: Nexus Livre cinza-azulado, Essencial azul claro, Cuida azul médio, Sustenta dourado.
- Tipografia: serifada nos títulos (seriedade), sem serifa no corpo (leitura em tela). Contraste mínimo 4,5:1.
- Tom de voz: acolhedor, direto, sem jargão clínico. Não infantiliza, não romantiza o sacrifício (nada de "guerreira" ou "anjo"), não promete resultado terapêutico.
- A Nexus NÃO é home care, clínica tradicional nem app de lembretes.

## Stack e convenções
- Angular mais recente (22.x), componentes standalone, signals, controle de fluxo novo (`@if`, `@for`), SCSS, rotas com lazy loading por feature. Sem biblioteca de UI pesada (sem Material); `@angular/cdk` é opcional. Gerenciador: **pnpm**.
- Dados em `localStorage` (chave com prefixo `nexus-erp:`), sessão em `sessionStorage`. Tudo passa por serviços de repositório tipados; nenhum componente toca `localStorage` direto.
- Identificadores de código em **inglês** (ou siglas já consagradas: Zarit, ARP, ARBE, POP, CRP, CRO). Textos de interface, comentários e documentação em **português do Brasil**.
- Nada de travessão (— ou –) em textos de interface ou documentação: use vírgula, ponto ou dois-pontos.
- Datas, moeda e números no formato pt-BR (`R$ 49,90`, `04/11/2026`).
- Os mocks têm que cobrir **todas as situações** (estados vazios, limites, alertas amarelo e vermelho do Zarit, prestador com taxa de recusa alta, agenda acima de 80%, consentimento revogado, pedido de exclusão LGPD, etc.).

## Regras de trabalho para todos os agentes
- **RAM é limitada**: nunca deixe `ng serve`, `vite` ou navegador de teste rodando ao terminar. Um servidor por vez. Ao acabar, mate o processo pela porta (PowerShell: `Get-NetTCPConnection -LocalPort 4200 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).
- Não faça `git commit` nem `git push`: o líder técnico commita.
- Não invente regra de negócio. Se o documento for omisso, registre como **suposição de protótipo** no documento do PM e siga adiante, sem bloquear.
- Escreva só dentro do repositório (`C:\Users\ddiog\Documents\Projetos\nexus-erp`), exceto leitura do documento-fonte.
- Entregáveis em `docs/`, numerados: `01-regras-de-negocio.md`, `02-escopo-erp.md`, `03-design-system.md`, `04-ux.md`, `05-qa.md`, `06-cs-cx.md`.
