import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogHostComponent } from './dialog-host.component';
import { ConfirmResult, DialogService } from './dialog.service';

async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  await fixture.whenStable();
}

describe('DialogService e DialogHostComponent', () => {
  let fixture: ComponentFixture<DialogHostComponent>;
  let service: DialogService;
  let opener: HTMLButtonElement;

  const dialogEl = (): HTMLDialogElement =>
    fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
  const button = (role: string): HTMLButtonElement =>
    dialogEl().querySelector(`[data-role="${role}"]`) as HTMLButtonElement;
  const press = (key: string): void => {
    dialogEl().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(DialogHostComponent);
    service = TestBed.inject(DialogService);
    opener = document.createElement('button');
    opener.textContent = 'Abrir';
    document.body.appendChild(opener);
    opener.focus();
    await flush(fixture);
  });

  afterEach(() => opener.remove());

  it('abre o diálogo de efeito com os três blocos e foco no botão seguro (Voltar)', async () => {
    const result = service.confirm({
      title: 'Descredenciar a Clínica Saúde Integral?',
      message: 'O descredenciamento tira o prestador da busca.',
      effects: {
        erase: ['o perfil na busca'],
        block: ['novas solicitações, porque o registro está suspenso'],
        keep: ['o histórico de avaliações'],
      },
      confirmLabel: 'Descredenciar',
    });
    await flush(fixture);

    expect(dialogEl().hasAttribute('open')).toBe(true);
    expect(dialogEl().querySelector('h2')?.textContent).toContain('Descredenciar a Clínica');
    const effects = dialogEl().querySelectorAll('.effects li');
    expect(effects).toHaveLength(3);
    expect(effects[0]?.textContent).toContain('Será eliminado');
    expect(effects[1]?.textContent).toContain('Ficará bloqueado');
    expect(effects[2]?.textContent).toContain('Continua registrado');
    expect(button('cancel').textContent?.trim()).toBe('Voltar');
    expect(document.activeElement).toBe(button('cancel'));

    button('confirm').click();
    await expect(result).resolves.toEqual({ confirmed: true, checkbox: false });
    await flush(fixture);
    expect(dialogEl().hasAttribute('open')).toBe(false);
  });

  it('Esc cancela e devolve o foco a quem abriu', async () => {
    const result = service.confirm({
      title: 'Encerrar o alerta?',
      confirmLabel: 'Encerrar alerta',
    });
    await flush(fixture);
    expect(document.activeElement).toBe(button('cancel'));

    press('Escape');
    await expect(result).resolves.toEqual({ confirmed: false, checkbox: false });
    await flush(fixture);
    expect(dialogEl().hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('nível 3: o botão perigoso só habilita ao digitar o texto exigido', async () => {
    const result = service.confirm({
      level: 3,
      title: 'Apagar todos os dados do navegador?',
      confirmLabel: 'Apagar tudo',
      typeToConfirm: 'APAGAR',
    });
    await flush(fixture);

    expect(button('confirm').disabled).toBe(true);
    expect(button('confirm').className).toContain('btn--danger');
    const input = dialogEl().querySelector('input[type="text"]') as HTMLInputElement;
    expect(dialogEl().querySelector('label[for]')?.textContent).toContain('Digite APAGAR');
    input.value = 'apagu';
    input.dispatchEvent(new Event('input'));
    await flush(fixture);
    expect(button('confirm').disabled).toBe(true);

    input.value = 'apagar';
    input.dispatchEvent(new Event('input'));
    await flush(fixture);
    expect(button('confirm').disabled).toBe(false);

    button('confirm').click();
    await expect(result).resolves.toEqual({ confirmed: true, checkbox: false });
  });

  it('a caixa opcional vem marcada e o resultado informa o estado', async () => {
    const result = service.confirm({
      title: 'Voltar aos dados de demonstração?',
      confirmLabel: 'Voltar aos dados de demonstração',
      checkbox: { label: 'Baixar uma cópia antes', checked: true },
    });
    await flush(fixture);
    const box = dialogEl().querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.click();
    await flush(fixture);
    button('confirm').click();
    const value: ConfirmResult = await result;
    expect(value).toEqual({ confirmed: true, checkbox: false });
  });

  it('enquanto `run` trabalha o botão fica em carregamento e o clique duplo é ignorado', async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const result = service.confirm({
      title: 'Restaurar a demonstração?',
      confirmLabel: 'Restaurar',
      busyLabel: 'Restaurando 340 cuidadores...',
      run: async () => {
        calls += 1;
        await gate;
      },
    });
    await flush(fixture);

    button('confirm').click();
    await flush(fixture);
    expect(button('confirm').getAttribute('aria-busy')).toBe('true');
    expect(button('confirm').textContent).toContain('Restaurando 340 cuidadores');
    expect(button('cancel').disabled).toBe(true);
    button('confirm').click();
    press('Escape');
    expect(calls).toBe(1);
    expect(dialogEl().hasAttribute('open')).toBe(true);

    release();
    await expect(result).resolves.toEqual({ confirmed: true, checkbox: false });
  });

  it('se `run` falha, mostra o erro e mantém o diálogo aberto', async () => {
    void service.confirm({
      title: 'Importar a cópia?',
      confirmLabel: 'Importar',
      run: () => Promise.reject(new Error('falhou')),
    });
    await flush(fixture);
    button('confirm').click();
    await flush(fixture);
    expect(dialogEl().hasAttribute('open')).toBe(true);
    expect(dialogEl().querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível concluir',
    );
    service.cancelAll();
    await flush(fixture);
  });

  it('diálogos em sequência esperam a vez (fila)', async () => {
    const first = service.confirm({ title: 'Primeiro?', confirmLabel: 'Sim, primeiro' });
    const second = service.confirm({ title: 'Segundo?', confirmLabel: 'Sim, segundo' });
    await flush(fixture);
    expect(dialogEl().querySelector('h2')?.textContent).toContain('Primeiro');
    button('cancel').click();
    await expect(first).resolves.toMatchObject({ confirmed: false });
    await flush(fixture);
    expect(dialogEl().querySelector('h2')?.textContent).toContain('Segundo');
    expect(dialogEl().hasAttribute('open')).toBe(true);
    button('confirm').click();
    await expect(second).resolves.toMatchObject({ confirmed: true });
  });

  it('o ícone do sprite usa o namespace SVG e aponta para o arquivo local', async () => {
    void service.confirm({ title: 'Teste?', confirmLabel: 'Fazer' });
    await flush(fixture);
    const use = dialogEl().querySelector('svg use') as SVGUseElement;
    expect(use.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(use.getAttribute('href')).toMatch(/^icons\/sprite\.svg#i-/);
    service.cancelAll();
    await flush(fixture);
  });
});
