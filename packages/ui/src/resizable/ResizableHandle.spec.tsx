import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Resizable } from './Resizable.tsx';
import { ResizableHandle } from './ResizableHandle.tsx';
import { ResizablePanel } from './ResizablePanel.tsx';
import { ResizableContext, type ResizableContextValue } from './resizable-context.ts';

describe('ResizableHandle', () => {
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

  function separator(): Element {
    const element = container.querySelector('[role="separator"]');
    if (element === null) {
      throw new Error('nincs kirajzolt elválasztó');
    }
    return element;
  }

  it('Resizable-n kívül, no-op kontextussal is kirajzolódik, és a pointer/billentyű események ártalmatlanok', () => {
    act(() => {
      root.render(<ResizableHandle beforeIndex={0} />);
    });
    expect(separator().getAttribute('aria-valuenow')).toBeNull();
    expect(separator().getAttribute('aria-valuemin')).toBeNull();
    expect(separator().getAttribute('aria-valuemax')).toBeNull();
    expect(separator().getAttribute('aria-label')).toBe('Resize panels 1 and 2');

    expect(() => {
      act(() => {
        separator().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        separator().dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, bubbles: true, cancelable: true }));
      });
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'a']) {
        separator().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
    }).not.toThrow();
  });

  it('egyéni aria-label felülírja az alapértelmezett feliratot', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[40, 60]}>
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} aria-label="Oldalsáv átméretezése" />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    expect(separator().getAttribute('aria-label')).toBe('Oldalsáv átméretezése');
  });

  it('Resizable-n belül a saját sorszáma szerinti méretet és panel párost jelöli', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[20, 30, 50]}>
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
          <ResizableHandle beforeIndex={1} />
          <ResizablePanel index={2} />
        </Resizable>,
      );
    });
    const separators = [...container.querySelectorAll('[role="separator"]')];
    expect(separators.map((element) => element.getAttribute('aria-valuenow'))).toEqual(['20', '30']);
    // A két határ a `Home`, illetve az `End` érkezési helye: az első
    // elválasztónál a párösszeg (50) mínusz a szomszéd 5 százaléka.
    expect(separators.map((element) => element.getAttribute('aria-valuemin'))).toEqual(['5', '5']);
    expect(separators.map((element) => element.getAttribute('aria-valuemax'))).toEqual(['45', '75']);
    expect(separators.map((element) => element.getAttribute('aria-label'))).toEqual([
      'Resize panels 1 and 2',
      'Resize panels 2 and 3',
    ]);
  });

  it('a fókusz megtartható a tabIndex 0 miatt', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[40, 60]}>
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    expect(container.querySelector<HTMLElement>('[role="separator"]')?.tabIndex).toBe(0);
  });

  it('a mért minimum alá eső nyers méretet a jelentett aria-valuenow a minimumra szorítja', () => {
    // A beágyazott csoport panelének pixeles minimuma a rendelkezésre álló hely 50
    // százaléka (`minSizePercents[0] = 50`): ez a MÉRT HIBA (`ResizableHandle.tsx`
    // fejléc), amikor a nyers, tárolt `sizes` állapot még nem igazodott a friss
    // minimumhoz. Levezetés a `resize-at.ts` `resizeAt` függvénye szerint:
    // pairTotal = 45 + 55 = 100, minBefore = max(5, 50) = 50, minAfter = max(5, 0) = 5,
    // maxBefore = min(95, 100 - 5) = 95.
    // Home (delta -100): lowestSize = max(50, min(95, 45 - 100)) = 50.
    // End (delta +100): highestSize = max(50, min(95, 45 + 100)) = 95.
    // A nyers sizeBefore (45) a lowestSize (50) ALATT van: a fix előtt az
    // aria-valuenow 45 lenne, a fix után a minimumra (50) szorítva.
    const contextValue: ResizableContextValue = {
      sizes: [45, 55],
      minSizePercents: [50, 0],
      direction: 'horizontal',
      activeHandleIndex: -1,
      panelDomId: (index) => `resizable-panel-${String(index)}`,
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      registerPanel: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      beginDrag: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      resizeByDelta: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      toggleCollapse: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      refreshGeometry: () => {},
      userResizeCount: 0,
      resizeForReveal: () => 0,
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      endReveal: () => {},
    };
    act(() => {
      root.render(
        <ResizableContext.Provider value={contextValue}>
          <ResizableHandle beforeIndex={0} />
        </ResizableContext.Provider>,
      );
    });
    expect(separator().getAttribute('aria-valuemin')).toBe('50');
    expect(separator().getAttribute('aria-valuemax')).toBe('95');
    expect(separator().getAttribute('aria-valuenow')).toBe('50');
  });

  it('a mért maximum fölé eső nyers méretet a jelentett aria-valuenow a maximumra szorítja', () => {
    // A fordított eset: a szomszéd (index 1) pixeles minimuma a hely 50 százaléka
    // (`minSizePercents[1] = 50`), tehát az elsődleges (index 0) nem nőhet 50 fölé.
    // pairTotal = 92 + 8 = 100, minBefore = max(5, 0) = 5, minAfter = max(5, 50) = 50,
    // maxBefore = min(95, 100 - 50) = 50.
    // Home (delta -100): lowestSize = max(5, min(50, 92 - 100)) = 5.
    // End (delta +100): highestSize = max(5, min(50, 92 + 100)) = 50.
    // A nyers sizeBefore (92) a highestSize (50) FÖLÖTT van: a fix előtt az
    // aria-valuenow 92 lenne, a fix után a maximumra (50) szorítva.
    const contextValue: ResizableContextValue = {
      sizes: [92, 8],
      minSizePercents: [0, 50],
      direction: 'horizontal',
      activeHandleIndex: -1,
      panelDomId: (index) => `resizable-panel-${String(index)}`,
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      registerPanel: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      beginDrag: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      resizeByDelta: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      toggleCollapse: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      refreshGeometry: () => {},
      userResizeCount: 0,
      resizeForReveal: () => 0,
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op, a teszt csak a renderelt attribútumokat vizsgálja
      endReveal: () => {},
    };
    act(() => {
      root.render(
        <ResizableContext.Provider value={contextValue}>
          <ResizableHandle beforeIndex={0} />
        </ResizableContext.Provider>,
      );
    });
    expect(separator().getAttribute('aria-valuemin')).toBe('5');
    expect(separator().getAttribute('aria-valuemax')).toBe('50');
    expect(separator().getAttribute('aria-valuenow')).toBe('50');
  });
});
