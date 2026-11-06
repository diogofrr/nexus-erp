import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

/** Uma "camada" da tela: uma folha aberta ou um passo de um fluxo, com o que fazer quando a pessoa volta. */
interface Layer {
  id: string;
  /** Desfaz a camada (fecha a folha, volta ao passo de antes). Roda quando o botão voltar do aparelho é tocado. */
  back: () => void;
}

/** O marcador que as nossas entradas levam em `history.state` (o roteador usa `navigationId`, nunca este). */
const MARK = 'cgLayer';

/**
 * O botão voltar do aparelho fecha a folha ou o passo, em vez de sair da tela (CXC-013). No Android o gesto de voltar é o
 * mais usado: sem isto, uma folha aberta some junto com a tela e os passos de "Marcar conversa" e do cadastro pulam todos.
 *
 * Como funciona, de forma limpa: **uma entrada de histórico por camada aberta** (mesmo endereço, só um marcador em
 * `history.state`, nada de parâmetro de URL sujando o endereço). Abrir uma folha ou avançar um passo empurra a entrada;
 * tocar em voltar no aparelho dispara o `popstate`, que desfaz a camada do topo. Quando o próprio app fecha a camada
 * (o botão "Voltar" da folha, Esc, concluir o fluxo), a entrada é retirada de volta, então o histórico não cresce.
 *
 * Cuidados:
 * - Duas camadas que se trocam no mesmo instante (o detalhe fecha e a confirmação abre) reaproveitam a mesma entrada.
 * - A entrada só é retirada se ainda for a nossa: se o roteador já foi a outra tela, ela fica órfã (mesmo endereço) e
 *   nada é desfeito.
 * - Ao sair de uma tela com a camada aberta a entrada também fica órfã; o roteador ignora a navegação para o mesmo endereço.
 *
 * ```ts
 * // folha: o CgSheetComponent já faz isto sozinho
 * layers.open('minha-folha', () => this.open.set(false));
 * layers.release('minha-folha');
 * // passo: voltar do aparelho e o botão "Voltar" seguem o mesmo caminho
 * layers.open('passo-2', () => this.step.set(1));
 * layers.goBack(() => this.step.set(1));
 * ```
 */
@Injectable({ providedIn: 'root' })
export class HistoryLayersService implements OnDestroy {
  private readonly win = inject(DOCUMENT).defaultView;

  private stack: Layer[] = [];
  /** Quantas entradas o app vai retirar (e por isso quantos `popstate` deve ignorar). */
  private ignoredPops = 0;
  /** Entradas a retirar no próximo ciclo, a menos que outra camada as reaproveite. */
  private pendingBack = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly onPopState = (): void => this.handlePop();

  constructor() {
    this.win?.addEventListener('popstate', this.onPopState);
  }

  ngOnDestroy(): void {
    this.win?.removeEventListener('popstate', this.onPopState);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
  }

  /** Quantas camadas estão abertas. */
  get depth(): number {
    return this.stack.length;
  }

  /** A camada `id` está aberta? */
  isOpen(id: string): boolean {
    return this.stack.some((layer) => layer.id === id);
  }

  /** Abre a camada: uma entrada de histórico. `back` desfaz a camada quando a pessoa volta pelo aparelho. */
  open(id: string, back: () => void): void {
    const win = this.win;
    if (!win) {
      return;
    }
    const existing = this.stack.find((layer) => layer.id === id);
    if (existing) {
      existing.back = back;
      return;
    }
    if (this.pendingBack > 0) {
      // Outra camada acabou de fechar: ela e esta se trocam e dividem a mesma entrada.
      this.pendingBack -= 1;
      win.history.replaceState({ [MARK]: id }, '');
    } else {
      win.history.pushState({ [MARK]: id }, '');
    }
    this.stack.push({ id, back });
  }

  /** O app fechou a camada (botão, Esc, fim do fluxo): retira a entrada de histórico que ela abriu. */
  release(id: string): void {
    const index = this.stack.findIndex((layer) => layer.id === id);
    if (index === -1) {
      return;
    }
    const wasTop = index === this.stack.length - 1;
    this.stack.splice(index, 1);
    if (wasTop) {
      this.pendingBack += 1;
      this.schedule();
    }
  }

  /** A tela foi destruída com a camada aberta: só esquece a camada (a entrada de histórico fica, sem efeito). */
  forget(id: string): void {
    this.stack = this.stack.filter((layer) => layer.id !== id);
  }

  /**
   * Volta uma camada, como o botão do aparelho. Sem camada aberta (o rascunho foi retomado, a tela abriu direto no
   * passo) faz o `fallback`.
   */
  goBack(fallback: () => void): void {
    if (this.stack.length > 0 && this.win) {
      this.win.history.back();
    } else {
      fallback();
    }
  }

  /** Fecha todas as camadas de uma vez, sem desfazer nada na tela (o fluxo acabou). */
  clear(): void {
    const count = this.stack.length + this.pendingBack;
    this.stack = [];
    this.pendingBack = 0;
    if (count > 0) {
      this.back(count);
    }
  }

  // ===== Internos =====

  private handlePop(): void {
    if (this.ignoredPops > 0) {
      this.ignoredPops -= 1;
      return;
    }
    const top = this.stack.pop();
    top?.back();
  }

  private schedule(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      const count = this.pendingBack;
      this.pendingBack = 0;
      if (count > 0) {
        this.back(count);
      }
    }, 0);
  }

  /** Retira `count` entradas nossas, se a entrada atual ainda for nossa (senão o roteador já foi adiante). */
  private back(count: number): void {
    const win = this.win;
    const state: unknown = win?.history.state;
    const ours = typeof state === 'object' && state !== null && MARK in state;
    if (!win || !ours) {
      return;
    }
    this.ignoredPops += 1;
    win.history.go(-count);
  }
}
