import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationConfirmationModal } from './NavigationConfirmationModal.tsx';

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${name}" gombot`);
  }
  return button;
}

describe('NavigationConfirmationModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onLeave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();

  beforeEach(() => {
    onLeave.mockClear();
    onCancel.mockClear();
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

  function render(): void {
    act(() => {
      root.render(<NavigationConfirmationModal onLeave={onLeave} onCancel={onCancel} />);
    });
  }

  it('a dialógus a címével nevezett, a törzs a figyelmeztetés, a két gomb a "Mégse", majd a "Kilépés mentés nélkül", egyik sem sm méretű (user döntés 2026-10-17)', () => {
    render();
    const dialog = container.querySelector('[role="dialog"]');
    const titleId = dialog?.getAttribute('aria-labelledby') ?? '';
    expect(container.querySelector(`:scope [id="${CSS.escape(titleId)}"]`)?.textContent).toBe('Kilépés mentés nélkül?');
    expect(container.querySelector(':scope .modal__body')?.textContent).toBe('A mentetlen változtatások elvesznek.');

    const footerButtons = [...container.querySelectorAll(':scope .modal__footer button')];
    expect(footerButtons.map((button) => button.textContent)).toEqual(['Mégse', 'Kilépés mentés nélkül']);
    expect(footerButtons.every((button) => !button.classList.contains('btn--sm'))).toBe(true);
    expect(buttonNamed(container, 'Kilépés mentés nélkül').classList.contains('btn--danger')).toBe(true);
  });

  it('a "Kilépés mentés nélkül" az onLeave-et hívja', () => {
    render();
    act(() => {
      buttonNamed(container, 'Kilépés mentés nélkül').click();
    });
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('a "Mégse", a fejléc bezárás gombja és az Escape az onCancel-t hívja', () => {
    render();
    act(() => {
      buttonNamed(container, 'Mégse').click();
    });
    act(() => {
      buttonNamed(container, 'Bezárás').click();
    });
    act(() => {
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onLeave).not.toHaveBeenCalled();
  });
});
