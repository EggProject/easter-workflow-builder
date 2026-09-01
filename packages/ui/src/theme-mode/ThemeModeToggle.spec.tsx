import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_MODE_STORAGE_KEY } from './theme-mode.ts';
import { ThemeModeToggle } from './ThemeModeToggle.tsx';

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ThemeModeToggle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.localStorage.clear();
    delete document.documentElement.dataset['theme'];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete document.documentElement.dataset['theme'];
  });

  function renderedButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button.ep-theme-toggle');
    if (button === null) {
      throw new Error('a gomb nem talalhato a kirajzolt fan');
    }
    return button;
  }

  it('a design system osztalyat es mindket ikont kirajzolja', () => {
    act(() => {
      root.render(<ThemeModeToggle />);
    });

    const button = renderedButton();
    expect(button.querySelector('.ep-theme-toggle__moon')).not.toBeNull();
    expect(button.querySelector('.ep-theme-toggle__sun')).not.toBeNull();
    expect(button.getAttribute('type')).toBe('button');
  });

  it('nincs rajta data-ep-theme-toggle attributum', () => {
    act(() => {
      root.render(<ThemeModeToggle />);
    });

    expect(renderedButton().dataset['epThemeToggle']).toBeUndefined();
  });

  it('a kezdo aria-label a rendszerkoveto modot nevezi meg (nincs localStorage bejegyzes)', () => {
    act(() => {
      root.render(<ThemeModeToggle />);
    });

    expect(renderedButton().getAttribute('aria-label')).toBe('Téma: rendszerkövető');
  });

  it('kattintasra a mod korbefordul: system -> light -> dark -> system', () => {
    act(() => {
      root.render(<ThemeModeToggle />);
    });

    expect(renderedButton().getAttribute('aria-label')).toBe('Téma: rendszerkövető');

    clickButton(renderedButton());
    expect(renderedButton().getAttribute('aria-label')).toBe('Téma: világos');
    expect(document.documentElement.dataset['theme']).toBeUndefined();

    clickButton(renderedButton());
    expect(renderedButton().getAttribute('aria-label')).toBe('Téma: sötét');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(globalThis.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');

    clickButton(renderedButton());
    expect(renderedButton().getAttribute('aria-label')).toBe('Téma: rendszerkövető');
  });
});
