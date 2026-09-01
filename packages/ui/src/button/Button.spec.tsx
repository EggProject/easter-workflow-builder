import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button, type ButtonSize, type ButtonVariant } from './Button.tsx';

describe('Button', () => {
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

  function renderedButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button');
    if (button === null) {
      throw new Error('a gomb nem talalhato a kirajzolt fan');
    }
    return button;
  }

  it('alapértelmezésben a "btn btn--primary" osztálylistát rajzolja ki', () => {
    act(() => {
      root.render(<Button>Mentés</Button>);
    });
    expect(renderedButton().className).toBe('btn btn--primary');
    expect(renderedButton().textContent).toBe('Mentés');
  });

  const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'ink', 'danger'];
  it.each(variants)('a variant="%s" a "btn btn--%s" osztálylistát adja', (variant) => {
    act(() => {
      root.render(<Button variant={variant}>x</Button>);
    });
    expect(renderedButton().className).toBe(`btn btn--${variant}`);
  });

  it('md méretre nem tesz hozzá méret módosítót', () => {
    act(() => {
      root.render(<Button size="md">x</Button>);
    });
    expect(renderedButton().className).toBe('btn btn--primary');
  });

  const nonDefaultSizes: readonly ButtonSize[] = ['sm', 'lg'];
  it.each(nonDefaultSizes)('a size="%s" hozzáadja a "btn--%s" módosítót', (size) => {
    act(() => {
      root.render(<Button size={size}>x</Button>);
    });
    expect(renderedButton().className).toBe(`btn btn--primary btn--${size}`);
  });

  it('a variant, a size és a saját className együtt jelenik meg', () => {
    act(() => {
      root.render(
        <Button variant="danger" size="lg" className="egyedi">
          x
        </Button>,
      );
    });
    expect(renderedButton().className).toBe('btn btn--danger btn--lg egyedi');
  });

  it('a natív button attribútumok (type, disabled) áttovábbítódnak', () => {
    act(() => {
      root.render(
        <Button type="submit" disabled>
          x
        </Button>,
      );
    });
    expect(renderedButton().getAttribute('type')).toBe('submit');
    expect(renderedButton().disabled).toBe(true);
  });
});
