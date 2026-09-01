import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Badge, type BadgeVariant } from './Badge.tsx';

describe('Badge', () => {
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

  function renderedBadge(): HTMLSpanElement {
    const badge = container.querySelector<HTMLSpanElement>('span.badge');
    if (badge === null) {
      throw new Error('a jelvény nem található a kirajzolt fán');
    }
    return badge;
  }

  it('alapértelmezésben a "badge badge--info" osztálylistát es pontot rajzolja ki', () => {
    act(() => {
      root.render(<Badge>Új</Badge>);
    });
    expect(renderedBadge().className).toBe('badge badge--info');
    expect(renderedBadge().querySelector('.badge__dot')).not.toBeNull();
  });

  const allVariants: readonly BadgeVariant[] = ['info', 'success', 'warning', 'danger', 'yolk', 'ink', 'outline'];
  it.each(allVariants)('a variant="%s" a "badge badge--%s" osztálylistát adja', (variant) => {
    act(() => {
      root.render(<Badge variant={variant}>x</Badge>);
    });
    expect(renderedBadge().className).toBe(`badge badge--${variant}`);
  });

  const dotDefaultVariants: readonly BadgeVariant[] = ['info', 'success', 'warning', 'danger'];
  it.each(dotDefaultVariants)('a "%s" variáns alapértelmezésben pontot rajzol', (variant) => {
    act(() => {
      root.render(<Badge variant={variant}>x</Badge>);
    });
    expect(renderedBadge().querySelector('.badge__dot')).not.toBeNull();
  });

  const noDotDefaultVariants: readonly BadgeVariant[] = ['yolk', 'ink', 'outline'];
  it.each(noDotDefaultVariants)('a "%s" variáns alapértelmezésben nem rajzol pontot', (variant) => {
    act(() => {
      root.render(<Badge variant={variant}>x</Badge>);
    });
    expect(renderedBadge().querySelector('.badge__dot')).toBeNull();
  });

  it('a dot prop explicit felülírja az alapértelmezést (true egy alapból pont nélküli variánson)', () => {
    act(() => {
      root.render(
        <Badge variant="outline" dot>
          x
        </Badge>,
      );
    });
    expect(renderedBadge().querySelector('.badge__dot')).not.toBeNull();
  });

  it('a dot prop explicit felülírja az alapértelmezést (false egy alapból pontos variánson)', () => {
    act(() => {
      root.render(
        <Badge variant="danger" dot={false}>
          x
        </Badge>,
      );
    });
    expect(renderedBadge().querySelector('.badge__dot')).toBeNull();
  });

  it('a saját className hozzáadódik a listához, a children megjelenik', () => {
    act(() => {
      root.render(
        <Badge variant="success" className="egyedi">
          Kész
        </Badge>,
      );
    });
    expect(renderedBadge().className).toBe('badge badge--success egyedi');
    expect(renderedBadge().textContent).toBe('Kész');
  });
});
