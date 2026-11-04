import { Injectable, signal } from '@angular/core';

/** Um nível da trilha de migalhas. O último não tem `link` (é a página atual, `aria-current="page"`). */
export interface Crumb {
  label: string;
  /** Rota do nível. Sem link, é texto. */
  link?: string;
}

/**
 * Contexto da página atual, para o shell (barra superior e título da aba). Por padrão o shell lê
 * `data: { title }` das rotas. Uma página cujo texto só se sabe depois de carregar (a ficha de um
 * cuidador) ajusta aqui:
 *
 * ```ts
 * private readonly page = inject(PageContextService);
 * ngOnInit() {
 *   this.page.setTitle('Perfil do cuidador');                    // título da aba: o TIPO da tela
 *   this.page.setCrumbs([{ label: 'Cuidadores', link: '/app/cuidadores' }, { label: code }]);
 * }
 * ```
 *
 * Regra de privacidade (UX 3.9, LP-21): o título da aba NUNCA leva nome, código, escore nem texto livre.
 * As migalhas aparecem só em tela e podem levar o nome (ou o código, para a gestão).
 * O shell limpa os dois valores a cada navegação.
 */
@Injectable({ providedIn: 'root' })
export class PageContextService {
  private readonly titleSignal = signal<string | null>(null);
  private readonly crumbsSignal = signal<readonly Crumb[] | null>(null);

  readonly title = this.titleSignal.asReadonly();
  readonly crumbs = this.crumbsSignal.asReadonly();

  /** Título da aba, sem o sufixo (o shell acrescenta " · Nexus ERP"). `null` volta ao da rota. */
  setTitle(title: string | null): void {
    this.titleSignal.set(title);
  }

  /** Migalhas completas da página, do mais alto ao atual. `null` volta às da rota. */
  setCrumbs(crumbs: readonly Crumb[] | null): void {
    this.crumbsSignal.set(crumbs);
  }

  reset(): void {
    this.titleSignal.set(null);
    this.crumbsSignal.set(null);
  }
}
