import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useIsDarkTheme } from './use-is-dark-theme.ts';

function IsDarkThemeProbe(): ReactElement {
  const isDarkTheme = useIsDarkTheme();
  return <span>{isDarkTheme ? 'dark' : 'light'}</span>;
}

describe('useIsDarkTheme', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  function renderedText(): string | null {
    return container.textContent;
  }

  it('hianyzo data-theme attributum mellett a "light" agat adja (isDarkTheme hamis)', () => {
    act(() => {
      root.render(<IsDarkThemeProbe />);
    });
    expect(renderedText()).toBe('light');
  });

  it('data-theme="dark" mellett a "dark" agat adja (isDarkTheme igaz)', () => {
    document.documentElement.dataset['theme'] = 'dark';
    act(() => {
      root.render(<IsDarkThemeProbe />);
    });
    expect(renderedText()).toBe('dark');
  });

  it('elo valtas: a data-theme attributum megjelenese atvalt "dark" agra ujratoltes nelkul', async () => {
    act(() => {
      root.render(<IsDarkThemeProbe />);
    });
    expect(renderedText()).toBe('light');

    await act(async () => {
      document.documentElement.dataset['theme'] = 'dark';
      await Promise.resolve();
    });
    expect(renderedText()).toBe('dark');
  });

  it('elo valtas: a data-theme attributum eltunese visszavalt "light" agra ujratoltes nelkul', async () => {
    document.documentElement.dataset['theme'] = 'dark';
    act(() => {
      root.render(<IsDarkThemeProbe />);
    });
    expect(renderedText()).toBe('dark');

    await act(async () => {
      delete document.documentElement.dataset['theme'];
      await Promise.resolve();
    });
    expect(renderedText()).toBe('light');
  });

  it('leszereles utan a figyeles lekapcsolodik, kesobbi attributum valtas nem dob hibat', async () => {
    act(() => {
      root.render(<IsDarkThemeProbe />);
    });
    act(() => {
      root.unmount();
    });

    await act(async () => {
      document.documentElement.dataset['theme'] = 'dark';
      await Promise.resolve();
    });

    expect(container.textContent).toBe('');
  });
});
