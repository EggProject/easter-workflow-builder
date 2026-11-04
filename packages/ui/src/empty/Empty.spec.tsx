import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Empty, type EmptyArtVariant } from './Empty.tsx';

describe('Empty', () => {
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

  function renderedEmpty(): HTMLDivElement {
    const empty = container.querySelector<HTMLDivElement>('div.empty');
    if (empty === null) {
      throw new Error('az üres állapot nem található a kirajzolt fán');
    }
    return empty;
  }

  it('minden mező nélkül csak a burkoló rajzolódik ki', () => {
    act(() => {
      root.render(<Empty />);
    });
    expect(renderedEmpty().className).toBe('empty');
    expect(renderedEmpty().childElementCount).toBe(0);
  });

  it('a cím h3, az üzenet p, az eyebrow span, a művelet sáv div, ebben a sorrendben', () => {
    act(() => {
      root.render(
        <Empty
          eyebrow="Skillek"
          title="Nincs skill"
          message="Tölts fel egy csomagot."
          actions={<button type="button">Feltöltés</button>}
        />,
      );
    });
    const tags = [...renderedEmpty().children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`);
    expect(tags).toEqual(['span.empty__eyebrow', 'h3.empty__title', 'p.empty__message', 'div.empty__actions']);
    expect(container.querySelector('h3')?.textContent).toBe('Nincs skill');
    expect(container.querySelector('p')?.textContent).toBe('Tölts fel egy csomagot.');
    expect(container.querySelector(':scope .empty__actions button')?.textContent).toBe('Feltöltés');
  });

  it('az ikon díszítő (aria-hidden) paper változattal módosító osztály nélkül', () => {
    act(() => {
      root.render(<Empty icon={<svg data-testid="ikon" />} />);
    });
    const art = container.querySelector('.empty__art');
    expect(art?.className).toBe('empty__art');
    expect(art?.getAttribute('aria-hidden')).toBe('true');
    expect(art?.querySelector('svg')).not.toBeNull();
  });

  const variants: readonly EmptyArtVariant[] = ['ink', 'blue', 'success', 'warning', 'square'];
  it.each(variants)('az artVariant="%s" a hozzá tartozó módosító osztályt adja', (artVariant) => {
    act(() => {
      root.render(<Empty icon={<svg />} artVariant={artVariant} />);
    });
    expect(container.querySelector('.empty__art')?.className).toBe(`empty__art empty__art--${artVariant}`);
  });

  it('tone="card" a kártya osztályt, a hívó osztálya a végére kerül', () => {
    act(() => {
      root.render(<Empty tone="card" className="extra" />);
    });
    expect(renderedEmpty().className).toBe('empty empty--card extra');
  });

  it('inline esetén a szöveg az .empty__body dobozban áll, az ikon és a műveletek kívül', () => {
    act(() => {
      root.render(<Empty inline icon={<svg />} title="Nincs" message="Üres" actions={<span>gomb</span>} />);
    });
    expect(renderedEmpty().className).toBe('empty empty--inline');
    const body = renderedEmpty().querySelector(':scope > .empty__body');
    expect(body?.querySelector('h3.empty__title')).not.toBeNull();
    expect(body?.querySelector('p.empty__message')).not.toBeNull();
    expect(renderedEmpty().querySelector(':scope > .empty__art')).not.toBeNull();
    expect(renderedEmpty().querySelector(':scope > .empty__actions')).not.toBeNull();
  });

  it('nem inline esetén nincs .empty__body doboz', () => {
    act(() => {
      root.render(<Empty title="Nincs" />);
    });
    expect(container.querySelector('.empty__body')).toBeNull();
  });

  it('a hamis értékű mezők (üres szöveg, 0) nem rajzolnak elemet', () => {
    act(() => {
      root.render(<Empty icon="" eyebrow={0} title="" message="" actions={false} />);
    });
    expect(renderedEmpty().childElementCount).toBe(0);
  });
});
