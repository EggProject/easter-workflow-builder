import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Alert, type AlertVariant } from './Alert.tsx';

describe('Alert', () => {
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

  function renderedAlert(): HTMLDivElement {
    const alert = container.querySelector<HTMLDivElement>('div.alert');
    if (alert === null) {
      throw new Error('az alert nem található a kirajzolt fán');
    }
    return alert;
  }

  it('alapértelmezésben az "alert alert--info" osztálylistát és status szerepet adja', () => {
    act(() => {
      root.render(<Alert />);
    });
    expect(renderedAlert().className).toBe('alert alert--info');
    expect(renderedAlert().getAttribute('role')).toBe('status');
  });

  const nonDangerVariants: readonly AlertVariant[] = ['info', 'success', 'warning', 'ink'];
  it.each(nonDangerVariants)('a variant="%s" osztálylistát és status szerepet ad, ikonnal', (variant) => {
    act(() => {
      root.render(<Alert variant={variant} />);
    });
    expect(renderedAlert().className).toBe(`alert alert--${variant}`);
    expect(renderedAlert().getAttribute('role')).toBe('status');
    expect(renderedAlert().querySelector(':scope .alert__icon svg')).not.toBeNull();
  });

  it('a danger variáns alert szerepet kap, ahogy a forrás adja', () => {
    act(() => {
      root.render(<Alert variant="danger" />);
    });
    expect(renderedAlert().className).toBe('alert alert--danger');
    expect(renderedAlert().getAttribute('role')).toBe('alert');
  });

  it('az ikon dekoratív, a hozzáférhetőségi fából rejtett', () => {
    act(() => {
      root.render(<Alert variant="warning" />);
    });
    expect(renderedAlert().querySelector('.alert__icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('cím és üzenet megadásakor mindkettő kirajzolódik', () => {
    act(() => {
      root.render(
        <Alert variant="warning" title="Várakozás">
          Az utolsó ismert állapot látszik.
        </Alert>,
      );
    });
    expect(renderedAlert().querySelector('.alert__title')?.textContent).toBe('Várakozás');
    expect(renderedAlert().querySelector('.alert__message')?.textContent).toBe('Az utolsó ismert állapot látszik.');
  });

  it('cím és üzenet hiányában egyik sor sem rajzolódik ki', () => {
    act(() => {
      root.render(<Alert />);
    });
    expect(renderedAlert().querySelector('.alert__title')).toBeNull();
    expect(renderedAlert().querySelector('.alert__message')).toBeNull();
  });

  it('a className a design system osztályok mögé kerül', () => {
    act(() => {
      root.render(<Alert variant="warning" className="kulso" />);
    });
    expect(renderedAlert().className).toBe('alert alert--warning kulso');
  });
});
