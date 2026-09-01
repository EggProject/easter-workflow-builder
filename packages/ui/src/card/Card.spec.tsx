import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Card } from './Card.tsx';

describe('Card', () => {
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

  function renderedCard(): HTMLDivElement {
    const card = container.querySelector<HTMLDivElement>('div.card');
    if (card === null) {
      throw new Error('a kártya nem található a kirajzolt fán');
    }
    return card;
  }

  it('alapértelmezésben csak a "card" osztályt viseli, fejléc és meta nélkül', () => {
    act(() => {
      root.render(<Card />);
    });
    expect(renderedCard().className).toBe('card');
    expect(renderedCard().querySelector('.card__header')).toBeNull();
    expect(renderedCard().querySelector('.card__meta')).toBeNull();
  });

  it('feature=true eseten a "card card--feature" osztálylistát adja', () => {
    act(() => {
      root.render(<Card feature />);
    });
    expect(renderedCard().className).toBe('card card--feature');
  });

  it('title jelenlétében a fejléc és a h3 kirajzolódik', () => {
    act(() => {
      root.render(<Card title="Cím" />);
    });
    expect(renderedCard().querySelector('.card__header')).not.toBeNull();
    expect(renderedCard().querySelector('h3')?.textContent).toBe('Cím');
    expect(renderedCard().querySelector('.card__icn')).toBeNull();
  });

  it('icon jelenlétében a .card__icn aria-hidden elem kirajzolódik', () => {
    act(() => {
      root.render(<Card icon="A" />);
    });
    const icn = renderedCard().querySelector('.card__icn');
    expect(icn?.textContent).toBe('A');
    expect(icn?.getAttribute('aria-hidden')).toBe('true');
  });

  it('children eseten a p elem kirajzolódik', () => {
    act(() => {
      root.render(<Card>Törzsszöveg</Card>);
    });
    expect(renderedCard().querySelector('p')?.textContent).toBe('Törzsszöveg');
  });

  it('meta jelenlétében a bal es jobb ertek kirajzolódik', () => {
    act(() => {
      root.render(<Card meta={['2026-09-01', '3 lépés']} />);
    });
    const spans = renderedCard().querySelectorAll(':scope .card__meta span');
    expect(spans).toHaveLength(2);
    expect(spans[0]?.textContent).toBe('2026-09-01');
    expect(spans[1]?.textContent).toBe('3 lépés');
  });

  it('a sajat className hozzaadodik a listahoz', () => {
    act(() => {
      root.render(<Card className="egyedi" />);
    });
    expect(renderedCard().className).toBe('card egyedi');
  });
});
