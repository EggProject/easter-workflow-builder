import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast, type ToastVariant } from './Toast.tsx';

describe('Toast', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderedToast(): HTMLDivElement {
    const toast = container.querySelector<HTMLDivElement>('div.toast');
    if (toast === null) {
      throw new Error('a toast nem található a kirajzolt fán');
    }
    return toast;
  }

  it('alapértelmezésben a "toast toast--info" osztálylistát adja', () => {
    act(() => {
      root.render(<Toast />);
    });
    expect(renderedToast().className).toBe('toast toast--info');
    expect(renderedToast().querySelector('.toast__dot')).not.toBeNull();
  });

  const variants: readonly ToastVariant[] = ['info', 'success', 'warning', 'danger', 'ink'];
  it.each(variants)('a variant="%s" a "toast toast--%s" osztálylistát adja', (variant) => {
    act(() => {
      root.render(<Toast variant={variant} />);
    });
    expect(renderedToast().className).toBe(`toast toast--${variant}`);
  });

  it('title, message es meta jelenleteben mindharom kirajzolodik', () => {
    act(() => {
      root.render(<Toast title="Mentve" message="A workflow elmentve" meta="most" />);
    });
    expect(renderedToast().querySelector('.toast__title')?.textContent).toBe('Mentve');
    expect(renderedToast().querySelector('.toast__message')?.textContent).toBe('A workflow elmentve');
    expect(renderedToast().querySelector('.toast__meta')?.textContent).toBe('most');
  });

  it('action hianyaban nincs .toast__actions elem', () => {
    act(() => {
      root.render(<Toast />);
    });
    expect(renderedToast().querySelector('.toast__actions')).toBeNull();
  });

  it('action jelenleteben a gomb kirajzolodik es az onClick meghivodik', () => {
    const onClick = vi.fn();
    act(() => {
      root.render(<Toast action={{ label: 'Visszavonás', onClick }} />);
    });
    const actionButton = renderedToast().querySelector<HTMLButtonElement>('.toast__action');
    expect(actionButton?.textContent).toBe('Visszavonás');

    act(() => {
      actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('onClose hianyaban nincs .toast__close gomb', () => {
    act(() => {
      root.render(<Toast />);
    });
    expect(renderedToast().querySelector('.toast__close')).toBeNull();
  });

  it('onClose jelenleteben a bezaro gomb kirajzolodik es meghivodik kattintasra', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<Toast onClose={onClose} />);
    });
    const closeButton = renderedToast().querySelector<HTMLButtonElement>('.toast__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Dismiss');

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a sajat className hozzaadodik a listahoz', () => {
    act(() => {
      root.render(<Toast className="egyedi" />);
    });
    expect(renderedToast().className).toBe('toast toast--info egyedi');
  });
});
