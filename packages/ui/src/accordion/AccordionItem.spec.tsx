import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccordionItem } from './AccordionItem.tsx';

describe('AccordionItem', () => {
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

  function header(): HTMLButtonElement {
    const element = container.querySelector<HTMLButtonElement>('.accordion__header');
    if (element === null) {
      throw new Error('a panel fejléc gombja nem található a kirajzolt fán');
    }
    return element;
  }

  function body(): HTMLDivElement {
    const element = container.querySelector<HTMLDivElement>('.accordion__body');
    if (element === null) {
      throw new Error('a panel törzse nem található a kirajzolt fán');
    }
    return element;
  }

  it('alapértelmezésben zárva indul: hidden törzs, aria-expanded="false"', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
    expect(container.querySelector('.accordion__item')?.className).toBe('accordion__item');
  });

  it('defaultOpen esetén nyitva indul', () => {
    act(() => {
      root.render(
        <AccordionItem title="Futási korlátok" defaultOpen>
          tartalom
        </AccordionItem>,
      );
    });
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    expect(container.querySelector('.accordion__item')?.className).toBe('accordion__item is-open');
  });

  it('a fejlécre kattintva nyílik, újra kattintva zárul', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    act(() => {
      header().click();
    });
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    act(() => {
      header().click();
    });
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
  });

  it('a fejléc natív gomb egy natív h3 fejlécben, tehát billentyűzetről is működik', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    expect(header().tagName).toBe('BUTTON');
    expect(header().type).toBe('button');
    expect(header().parentElement?.tagName).toBe('H3');
    expect(container.querySelector('.accordion__title')?.textContent).toBe('Futási korlátok');
  });

  it('a törzs role="region" szerepű, és a fejlécre mutató aria-labelledby névvel bír', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    expect(body().getAttribute('role')).toBe('region');
    expect(body().getAttribute('aria-labelledby')).toBe(header().id);
    expect(header().getAttribute('aria-controls')).toBe(body().id);
    expect(header().id.length).toBeGreaterThan(0);
    expect(body().id.length).toBeGreaterThan(0);
  });

  it('icon és meta nélkül egyik szlot sem kerül a DOM-ba', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    expect(container.querySelector('.accordion__icon')).toBeNull();
    expect(container.querySelector('.accordion__meta')).toBeNull();
  });

  it('az icon a cím előtt, a meta a cím után és a chevron előtt áll, a forrás sorrendjében', () => {
    act(() => {
      root.render(
        <AccordionItem title="Futási korlátok" icon={<svg aria-hidden="true" />} meta="3 mező">
          tartalom
        </AccordionItem>,
      );
    });
    const slotClassNames = [...header().children].map((child) => child.getAttribute('class'));
    expect(slotClassNames).toEqual(['accordion__icon', 'accordion__title', 'accordion__meta', 'accordion__chevron']);
    expect(container.querySelector('.accordion__icon')?.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.accordion__meta')?.textContent).toBe('3 mező');
  });

  it('az icon szlot állandó szélességű oszlop: a forrás CSS szerint 18x18-as és nem zsugorodik', () => {
    // A happy-dom nem számol elrendezést, ezért a szélességet a bájtra
    // átemelt `accordion.css` szabálya adja; ez a teszt azt őrzi, hogy a
    // jelölő oszlopra építő hívók (pl. a transcript sor) alól ne tűnjön el.
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(path.join(directory, 'accordion.css'), 'utf8');
    const iconRule = /\.accordion__icon\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(iconRule).toMatch(/width:\s*18px/);
    expect(iconRule).toMatch(/height:\s*18px/);
    expect(iconRule).toMatch(/flex-shrink:\s*0/);
  });

  it('a chevron ikon a hozzáférhetőségi fából ki van zárva', () => {
    act(() => {
      root.render(<AccordionItem title="Futási korlátok">tartalom</AccordionItem>);
    });
    expect(container.querySelector('.accordion__chevron')?.getAttribute('aria-hidden')).toBe('true');
  });
});
