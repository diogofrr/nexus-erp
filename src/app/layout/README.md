# Layout: shell, busca, notificações e atalhos (`src/app/layout`)

Guia curto para quem constrói um módulo. O shell envolve a sua tela; você só entrega o conteúdo.

## Onde a sua tela aparece

- `/app/**` abre dentro do **shell da equipe** (`TeamShellComponent`): menu lateral por perfil, barra superior, `main`, rodapé com o aviso de protótipo. Responsivo: gaveta abaixo de 1024 px, trilho de 1024 a 1279 px, menu completo de 1280 px.
- `/login`, `/403` e `**` não têm shell.
- Sua página renderiza só o conteúdo, dentro de `<div class="page">`. **Não** desenhe menu, topo, rodapé nem migalhas.
- Registre rotas só em `features/<slug>/<slug>.routes.ts`. O roteador central (`app.routes.ts`) já monta o shell e os guards.

## Título da aba, migalhas e foco

Cada rota declara `data: { title: 'Perfil do cuidador' }` (e, se o texto da migalha for outro, `crumb`). O shell:

- põe o título da aba como `Tipo da tela · Nexus ERP` (nunca nome, código ou escore);
- monta as migalhas da barra superior com o módulo à frente (`Cuidadores / Perfil do cuidador`);
- leva o foco ao `h1` da página nova (só quando o caminho muda; trocar filtro na URL não rouba o foco). **Toda tela precisa de um `h1`.**

Quando o texto só se sabe depois de carregar (a ficha de um cuidador), use `PageContextService` (`@shared/ui/overlay`):

```ts
private readonly page = inject(PageContextService);
this.page.setCrumbs([{ label: 'Cuidadores', link: '/app/cuidadores' }, { label: caregiver.code }]);
```

## Menu e permissões

O menu vem de `menuFor(role)` do núcleo, com os rótulos e grupos de `core/search/screens.ts`. Nenhum perfil vê item que não pode abrir. Para um módulo novo na matriz, basta o `MODULES` do núcleo (e uma linha em `NAV_ITEMS`).

## Busca global e paleta (`Ctrl+K`)

`SearchService` (`@core/search`): telas e ações permitidas ao perfil, mais registros respeitando a privacidade. Gestão busca cuidador só por código (`CUI-0042`), nunca por nome; psicólogo só os seus; atendimento vê contato mascarado; credenciado não vê cuidador. O texto buscado nunca é guardado. Ações da paleta só **abrem** telas: nunca executam nada.

Para a sua lista ter campo de busca focável pela tecla `/`, marque o campo com `data-search-field`.

## Notificações

`NotificationService` (`@core/notifications`) gera as pendências por perfil a partir do banco, a cada mudança. Regras em `notification-rules.ts`.

```ts
const notifications = inject(NotificationService);
notifications.unreadCount();          // número do sino
notifications.counterFor('messages'); // contador do item de menu (ou null)
```

O título descreve a TAREFA ("Contato do mesmo dia pendente"); nunca escore, faixa ou condição. Ao clicar, a tela abre com `?filtro=<chave>`: **leia o parâmetro `filtro`** na sua lista. Chaves usadas: `contato-hoje`, `contato-vencido`, `em-andamento`, `tarefas`, `aplicacao-vencendo`, `alertas-a-confirmar`, `pedidos-de-revisao`, `sem-anotacao`, `minha-ocupacao`, `atrasadas`, `sinalizadas`, `vencendo`, `vencidas`, `cancelamento-agendado`, `documento-vencendo`. Também aceitam chave os links dos painéis (M02, AC-M02-08): cuidadores `novos`; rede `excelencia`, `alerta`, `risco-de-saida`, `em-andamento` (credenciamento) e `sem-retorno` (solicitações); reclamações `abertas`; LGPD `?visao=abertas`. Não há mais portal do prestador (removido por decisão do dono).

## Atalhos de teclado

`ShortcutService` resolve os globais (Ctrl+K, `/`, `?`, G e letra). Os de página chegam como eventos:

```ts
inject(ShortcutService).page$.pipe(takeUntilDestroyed()).subscribe(({ id, value, event }) => {
  if (id === 'list-next') { this.next(); event.preventDefault(); }   // J
  // 'list-previous' K, 'list-filters' F, 'list-new' N, 'message-reply' R,
  // 'scale-answer' (value 0 a 4), 'step-previous' e 'step-next' (setas), 'form-submit' (Ctrl+Enter)
});
```

Os de uma tecla só valem fora de campo de texto e podem ser desligados pela pessoa (preferência). Só assine o que a sua tela realmente faz.

## Preferências e modo discreto

`UiPrefsService` (`@shared/ui/overlay`): `theme`, `density` (leia para `data-density` da tabela), `discreet`, `reduceMotion`, `fillWithExample` (mostre o botão "Preencher com exemplo" só se estiver `true`, U-07). Tudo grava pelo repositório (`nexus-erp:ui-prefs`), nunca direto no navegador.

Modo discreto: marque nomes e contatos com `class="discreet"`. O CSS borra e um clique revela.

## Páginas do rodapé

`/app/canal-do-titular` e `/app/meus-dados` são do layout e abrem para todos os perfis. Não crie outras.

## Testar

`bootApp({ userId: 'u1', url: '/app/painel' })` em `layout/testing.ts` sobe o app com o roteador, o seed e o usuário conectado. Veja `layout/shell/shell.spec.ts`.
