import { Injectable, signal } from '@angular/core';

/** Tom do diálogo: define o ícone e o estilo do botão de confirmar. */
export type DialogTone = 'danger' | 'attention' | 'info';

/**
 * O que acontece ao confirmar, nos três blocos do guia de UX (seção 5.8):
 * "Será eliminado", "Ficará bloqueado" (e por quê) e "Continua registrado". Cada item é um trecho de
 * frase sem ponto final; os itens de um bloco são unidos por ponto e vírgula. Só entram os blocos que se
 * aplicam.
 */
export interface DialogEffects {
  erase?: readonly string[];
  block?: readonly string[];
  keep?: readonly string[];
}

export interface ConfirmResult {
  confirmed: boolean;
  /** Estado da caixa opcional ("Baixar uma cópia antes"). */
  checkbox: boolean;
}

export interface ConfirmConfig {
  /** A pergunta com o objeto: "Descredenciar a Clínica Saúde Integral?". Nunca "Tem certeza?". */
  title: string;
  /** Frase de contexto antes dos efeitos. */
  message?: string;
  /** 2 = diálogo de efeito (padrão). 3 = digitar para confirmar (irreversível em massa). */
  level?: 2 | 3;
  tone?: DialogTone;
  /** Nome de um ícone do sprite; por padrão vem do tom. */
  icon?: string;
  effects?: DialogEffects;
  /** Frase em destaque quando não há volta: "Não dá para desfazer." */
  irreversibleNote?: string;
  /** Verbo com objeto: "Descredenciar", "Voltar aos dados de demonstração". Nunca "OK". */
  confirmLabel: string;
  /** Padrão "Voltar". */
  cancelLabel?: string;
  /** Texto que a pessoa precisa digitar (nível 3): "APAGAR", "ELIMINAR" ou o código do cuidador. */
  typeToConfirm?: string;
  /** Caixa opcional, por exemplo "Baixar uma cópia antes" (marcada por padrão). */
  checkbox?: { label: string; checked?: boolean };
  /** Rótulo do botão enquanto `run` trabalha ("Restaurando 340 cuidadores..."). */
  busyLabel?: string;
  /**
   * Trabalho feito com o diálogo ainda aberto e o botão em carregamento (bloqueia clique duplicado).
   * Se lançar erro, o diálogo mostra a falha e fica aberto.
   */
  run?: (result: ConfirmResult) => void | Promise<void>;
  /** Foco inicial. Padrão: o botão seguro (cancelar), como pede o guia para ação irreversível. */
  initialFocus?: 'cancel' | 'confirm';
}

/** Pedido na fila: a configuração, normalizada, e a função que resolve a promessa. */
export interface ActiveDialog {
  readonly id: number;
  readonly config: ConfirmConfig;
  readonly level: 2 | 3;
  readonly tone: DialogTone;
  readonly resolve: (result: ConfirmResult) => void;
}

/**
 * Serviço de diálogos de confirmação. Os quatro níveis do guia de UX (seção 5.8):
 *
 * | Nível | Quando | Como |
 * |---|---|---|
 * | 0 | reversível e local | faça direto, sem diálogo |
 * | 1 | reversível e de baixo impacto | faça e mostre `ToastService.show({ action: Desfazer })` |
 * | 2 | irreversível, ou muda outros registros | `confirm({ level: 2, effects })` |
 * | 3 | destrói dado em massa, sem volta | `confirm({ level: 3, typeToConfirm })` |
 *
 * ```ts
 * const { confirmed } = await this.dialogs.confirm({
 *   title: 'Descredenciar a Clínica Saúde Integral?',
 *   effects: { erase: [], block: ['o perfil na busca da rede'], keep: ['o histórico de avaliações'] },
 *   confirmLabel: 'Descredenciar',
 * });
 * ```
 *
 * Os diálogos ficam numa fila (um por vez). O `DialogHostComponent`, montado uma vez na raiz do
 * aplicativo, desenha o `<dialog>` nativo.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private nextId = 1;
  private readonly queue: ActiveDialog[] = [];
  private readonly currentSignal = signal<ActiveDialog | null>(null);

  /** O diálogo aberto agora (ou `null`). */
  readonly current = this.currentSignal.asReadonly();

  confirm(config: ConfirmConfig): Promise<ConfirmResult> {
    const level = config.level ?? 2;
    const tone: DialogTone = config.tone ?? (level === 3 ? 'danger' : 'attention');
    return new Promise<ConfirmResult>((resolve) => {
      const dialog: ActiveDialog = { id: this.nextId++, config, level, tone, resolve };
      if (this.currentSignal() === null) {
        this.currentSignal.set(dialog);
      } else {
        this.queue.push(dialog);
      }
    });
  }

  /** Chamado pelo host quando a pessoa decide (ou cancela com Esc). */
  settle(id: number, result: ConfirmResult): void {
    const active = this.currentSignal();
    if (!active || active.id !== id) {
      return;
    }
    active.resolve(result);
    this.currentSignal.set(this.queue.shift() ?? null);
  }

  /** Cancela tudo o que está aberto ou na fila (usado ao sair da sessão). */
  cancelAll(): void {
    const active = this.currentSignal();
    active?.resolve({ confirmed: false, checkbox: false });
    this.queue.splice(0).forEach((d) => d.resolve({ confirmed: false, checkbox: false }));
    this.currentSignal.set(null);
  }
}
