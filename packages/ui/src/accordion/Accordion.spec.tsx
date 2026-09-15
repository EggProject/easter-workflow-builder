import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Accordion } from './Accordion.tsx';
import { AccordionItem } from './AccordionItem.tsx';

describe('Accordion', () => {
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

  it('a .accordion osztálylistát adja, és a gyerekeit változatlanul rajzolja ki', () => {
    act(() => {
      root.render(
        <Accordion>
          <AccordionItem title="Első">egy</AccordionItem>
          <AccordionItem title="Második">kettő</AccordionItem>
        </Accordion>,
      );
    });
    expect(container.querySelector('.accordion')?.className).toBe('accordion');
    expect(container.querySelectorAll('.accordion__item')).toHaveLength(2);
  });

  it('a className hozzáfűződik az alaposztályhoz', () => {
    act(() => {
      root.render(
        <Accordion className="sajat">
          <AccordionItem title="Első">egy</AccordionItem>
        </Accordion>,
      );
    });
    expect(container.querySelector('.accordion')?.className).toBe('accordion sajat');
  });

  it('a panelek egymástól függetlenül nyithatók (nincs "egyszerre egy" mód)', () => {
    act(() => {
      root.render(
        <Accordion>
          <AccordionItem title="Első">egy</AccordionItem>
          <AccordionItem title="Második">kettő</AccordionItem>
        </Accordion>,
      );
    });
    const headers = [...container.querySelectorAll<HTMLButtonElement>('.accordion__header')];
    act(() => {
      headers[0]?.click();
    });
    act(() => {
      headers[1]?.click();
    });
    expect(headers.map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
  });
});
