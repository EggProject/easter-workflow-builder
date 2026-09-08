import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageFooter } from './PageFooter.tsx';

describe('PageFooter', () => {
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

  function renderedFooter(): HTMLDivElement {
    const footer = container.querySelector<HTMLDivElement>('div.page-footer');
    if (footer === null) {
      throw new Error('a lábléc nem található a kirajzolt fán');
    }
    return footer;
  }

  it('a státuszt balra, a gyerekeket jobbra teszi, két külön sávba', () => {
    act(() => {
      root.render(
        <PageFooter status={<span role="status">Mentetlen változtatások</span>}>
          <button type="button">Mentés</button>
        </PageFooter>,
      );
    });

    const footer = renderedFooter();
    const [statusSlot, actionsSlot] = [...footer.children];
    expect(statusSlot?.className).toBe('page-footer__status');
    expect(statusSlot?.textContent).toBe('Mentetlen változtatások');
    expect(actionsSlot?.className).toBe('page-footer__actions');
    expect(actionsSlot?.textContent).toBe('Mentés');
  });

  it('a gyökér NEM footer elem, tehát nem képződik contentinfo landmarkra', () => {
    act(() => {
      root.render(<PageFooter status={undefined}>x</PageFooter>);
    });
    expect(renderedFooter().tagName).toBe('DIV');
    expect(container.querySelector('footer')).toBeNull();
  });

  it('a saját className hozzáadódik, a többi attribútum áttovábbítódik', () => {
    act(() => {
      root.render(
        <PageFooter status={undefined} className="egyedi" data-testid="lablec">
          x
        </PageFooter>,
      );
    });
    expect(renderedFooter().className).toBe('page-footer egyedi');
    expect(renderedFooter().dataset['testid']).toBe('lablec');
  });
});
