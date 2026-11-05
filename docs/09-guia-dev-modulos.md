# Guia dos devs de módulo (onda de módulos)

Vale para os 4 devs que constroem os módulos ao mesmo tempo. Quem escreve este guia é o líder técnico. Em caso de dúvida entre este guia e os outros documentos, vale a ordem: `01-regras-de-negocio.md` (regra do documento, nunca se questiona) > `02-escopo-erp.md` > `04-ux.md` > `03-design-system.md` > este guia.

## 1. Leitura obrigatória, nesta ordem
1. `docs/00-contexto.md` e `docs/08-arquitetura.md`.
2. `src/app/core/README.md`, `src/app/shared/ui/README.md`, `src/app/shared/ui/overlay/README.md`, `src/app/layout/README.md`.
3. Em `docs/02-escopo-erp.md`: seções 0, 1 (perfis e matriz), 2, **os módulos que são seus na seção 3 (telas SCR, entidades, estados, ações, validações, critérios de aceite AC)**, 6 (LGPD) e 7 (KPIs) quando tocar no seu módulo.
4. Em `docs/01-regras-de-negocio.md`: os domínios (RN) citados nos módulos que são seus.
5. Em `docs/04-ux.md`: os fluxos F-xx dos seus módulos, os padrões PD-xx que usar, seção 6 (privacidade) e seção 7 (microcopy). A seção 11.2 traz conflitos internos do escopo: **adote a sugestão de UX** em todos eles.
6. Em `docs/03-design-system.md`: os wireframes (seção 6) das suas telas. Veja `docs/styleguide.html` e a rota `/app/_kit` do app para os componentes prontos.

## 2. Quem é dono de quê (para ninguém pisar em ninguém)
- Você é dono dos slugs que recebeu em `src/app/features/<slug>/` (rotas, páginas, componentes, estado, testes).
- `src/app/core/**`, `src/app/shared/ui/**`, `src/app/layout/**`, `src/styles/**`, `app.routes.ts` e `package.json` são **compartilhados e congelados**: só adicione arquivos NOVOS. Código novo reutilizável por mais de um módulo vai para `src/app/core/<area>/` (regras, serviços) ou `src/app/shared/ui/` (componente), em arquivo novo com nome claro e teste. Se achar um defeito num arquivo existente deles, corrija com edição mínima e cirúrgica (nunca reescreva o arquivo) e registre no relatório. Nunca rode `pnpm add`; se precisar de dependência, registre e contorne.
- **Um módulo nunca importa de outro módulo.** Para ligar telas use `routerLink` com o caminho. Para mostrar um resumo vindo de outro módulo, leia os repositórios do `Database` e use as regras de `core/rules`.
- As rotas ficam só no `<slug>.routes.ts` (com `data: { title }` e um `h1` por página, sem desenhar menu nem migalhas). Os guards já estão no roteador central.
- Prefixo de seletor `app-`. Importe componentes de `@shared/ui`, `@shared/ui/overlay`, `@shared/ui/charts`; ícones com `appIcon` (há um só componente de ícone).

## 3. Definição de pronto de cada módulo
Todas as telas `SCR-Mxx-nn` do módulo existem e funcionam de ponta a ponta com os dados do seed, e **cada critério `AC-Mxx-nn` está implementado**. Além disso:
- **Dados**: tudo por repositórios do `Database` (nunca `localStorage` direto). Criar, editar, mudar estado, arquivar e (quando a regra permitir) excluir realmente gravam e a tela reflete na hora. Dinheiro em centavos; datas pelo `Clock`.
- **Regras**: use as funções puras de `core/rules` (não reimplemente fórmula). Se faltar uma regra pura, crie-a em arquivo novo no núcleo, com RN no comentário e teste.
- **Permissões e privacidade**: use `can(...)`/`accessLevel(...)` do núcleo; nada de aparecer o que o perfil não pode ver (a matriz 1.2 e os bloqueios 1.3 do escopo). Dado sensível: `app-masked-field`, `class="discreet"` em nome e contato, gestão só vê `CUI-0000` e agregados com mínimo 5. Toda gravação sensível, supervisão e "mostrar" grava no `AuditLogService`.
- **Fluxos de UX**: implemente os F-xx do seu módulo com os passos, estados de erro, confirmações com efeito (`DialogService.confirm`) e toasts (`ToastService`) previstos. Listas leem `?filtro=` e usam `app-data-table` (filtros na URL, voltar restaura).
- **Estados completos em toda tela**: carregando, vazio (texto acolhedor com ação), erro, sem permissão. Formulários com validação em linha, mensagens do catálogo de erros, rascunho automático nos longos, "Preencher com exemplo" quando `UiPrefsService.fillWithExample()`.
- **Marca e microcopy**: tom acolhedor e direto, sem jargão clínico, sem travessão, sem "guerreira" ou "anjo", sem prometer resultado terapêutico, Zarit nunca como diagnóstico.
- **Responsivo e acessível**: 360 a 1440 px sem rolagem horizontal da página, alvos de 44 px, foco visível, teclado completo, rótulos em todos os campos, estado nunca só por cor.
- **Os mocks cobrem todas as situações**: confira que cada cenário do seed (`docs/08-arquitetura.md`, lista dos 29) que toca o seu módulo está visível e demonstrável por alguma tela, e que as regras de negócio disparam de verdade (alerta vermelho no mesmo dia, ocupação acima de 80%, prestador com taxa de recusa alta, etc.). Se o seed não cobrir uma situação que o escopo exige, acrescente dados em arquivo novo do `core/seed` e peça no relatório (sem quebrar os testes do seed existentes: se precisar mudar contagens, atualize o teste com a justificativa).

## 4. Testes
Vitest. Use `bootApp()` de `src/app/layout/testing.ts` e os ajudantes de `src/app/shared/ui/testing/dom.ts`. Por módulo: fumaça de cada tela (renderiza com dados do seed sem erro), os fluxos principais ponta a ponta, as permissões (perfil sem acesso é bloqueado e nada vaza no DOM), as regras de negócio visíveis (por exemplo faixa e conduta do Zarit na tela) e um teste de acessibilidade básica (rótulos e papéis). Rode só o seu pedaço: `pnpm exec ng test --watch=false --include 'src/app/features/<slug>/**/*.spec.ts'`. Typecheck: `pnpm run typecheck`. Todos os seus testes devem passar ao final, e a suíte inteira não pode quebrar por sua causa.

## 5. Verificação visual (limitada, sem virar loop)
Quando o módulo estiver pronto, rode `pnpm exec ng serve --port <sua porta>` em background, entre com os perfis relevantes (use `mcp__Claude_Browser__*`; `resize_window` para 1440 e 390), percorra as telas e os fluxos principais, inspecione UMA vez, corrija tudo em lote e confirme no máximo mais uma vez. Depois PARE e mate o servidor pela porta (`Get-NetTCPConnection -LocalPort <porta> -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`). Feche as abas que abriu.

## 6. Regras de RAM e de git
RAM é limitada e 4 devs trabalham juntos: sem servidor aberto ao terminar, no máximo o servidor da sua porta, `ng build` no máximo uma vez e só ao final (se houver lock em `.tmp/build.lock`, ainda não rode; crie o diretório `.tmp/build.lock` com `mkdir` antes e apague depois). Não faça `git commit` nem `git push` (o líder técnico faz). Não mexa em arquivos de outros devs.

## 7. Relatório final (obrigatório)
1. Crie `docs/ac-status/<slug>.md` para cada slug seu: tabela com TODOS os `AC-Mxx-nn` do módulo (id, status `feito`, `parcial` ou `não feito`, onde ver: rota e perfil, motivo se não for `feito`). O QA vai usar isso para testar, então seja honesto: não marque `feito` o que não funciona.
2. Resposta final ao líder (até 250 palavras): o que entregou, contagem de testes, o que ficou parcial ou de fora e por quê, mudanças feitas em arquivos compartilhados, pedidos de seed, e o que o QA e o CS/CX devem testar primeiro.

## 8. Portas de verificação
Dev A: 4211. Dev B: 4212. Dev C: 4213. Dev D: 4214.
