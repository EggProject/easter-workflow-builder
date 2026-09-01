import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastViewport, type ToastViewportPosition } from './ToastViewport.tsx';
import type { ToastRecord } from './use-toasts.ts';

describe('ToastViewport', () => {
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

  function renderedViewport(): HTMLDivElement {
    const viewport = container.querySelector<HTMLDivElement>('div.toast-viewport');
    if (viewport === null) {
      throw new Error('a viewport nem található a kirajzolt fán');
    }
    return viewport;
  }

  it('alapertelmezesben (br) csak a "toast-viewport" osztalyt viseli', () => {
    act(() => {
      root.render(<ToastViewport toasts={[]} onDismiss={vi.fn()} />);
    });
    expect(renderedViewport().className).toBe('toast-viewport');
  });

  const nonDefaultPositions: readonly ToastViewportPosition[] = ['bl', 'tr', 'tl', 'tc', 'bc'];
  it.each(nonDefaultPositions)(
    'a position="%s" a "toast-viewport toast-viewport--%s" osztalylistat adja',
    (position) => {
      act(() => {
        root.render(<ToastViewport toasts={[]} onDismiss={vi.fn()} position={position} />);
      });
      expect(renderedViewport().className).toBe(`toast-viewport toast-viewport--${position}`);
    },
  );

  it('mind a hat pozicio lefedett', () => {
    const allPositions: readonly ToastViewportPosition[] = ['br', ...nonDefaultPositions];
    expect(allPositions).toHaveLength(6);
  });

  it('minden toast kirajzolodik, es a bezaras az onDismiss-t a toast id-javal hivja', () => {
    const onDismiss = vi.fn();
    const toasts: readonly ToastRecord[] = [
      { id: 1, title: 'Első' },
      { id: 2, title: 'Második' },
    ];
    act(() => {
      root.render(<ToastViewport toasts={toasts} onDismiss={onDismiss} />);
    });

    const toastElements = renderedViewport().querySelectorAll('.toast');
    expect(toastElements).toHaveLength(2);

    const closeButtons = renderedViewport().querySelectorAll<HTMLButtonElement>('.toast__close');
    act(() => {
      closeButtons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });
});
