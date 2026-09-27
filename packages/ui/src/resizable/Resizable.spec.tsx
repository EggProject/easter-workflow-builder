import { act, Profiler, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Resizable } from './Resizable.tsx';
import { ResizableHandle } from './ResizableHandle.tsx';
import { ResizablePanel } from './ResizablePanel.tsx';

function pressKeyOn(element: Element, key: string, isShiftPressed = false): void {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey: isShiftPressed, bubbles: true, cancelable: true }),
    );
  });
}

/**
 * Ablak átméretezés esemény kiváltása, hogy a `Resizable` a stub után
 * frissen mérje a paneleket (a mintát a meglévő tesztek is követik).
 */
function refresh(): void {
  act(() => {
    globalThis.dispatchEvent(new Event('resize'));
  });
}

/**
 * A csoport közvetlen paneljeinek `flex-basis` értéke.
 */
function sizesOf(group: Element | null | undefined): readonly string[] {
  return [...(group?.querySelectorAll<HTMLDivElement>(':scope > .resizable-panel') ?? [])].map(
    (panel) => panel.style.flexBasis,
  );
}

describe('Resizable', () => {
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

  function renderTwoPane(direction?: 'horizontal' | 'vertical'): void {
    act(() => {
      root.render(
        <Resizable {...(direction === undefined ? {} : { direction })} defaultSizes={[40, 60]}>
          <ResizablePanel index={0}>Sidebar</ResizablePanel>
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1}>Main</ResizablePanel>
        </Resizable>,
      );
    });
  }

  function handle(): Element {
    const element = container.querySelector('[role="separator"]');
    if (element === null) {
      throw new Error('nincs kirajzolt elválasztó');
    }
    return element;
  }

  function groups(): readonly Element[] {
    return [...container.querySelectorAll('.resizable-group')];
  }

  function panelSizes(): readonly string[] {
    return [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')].map((panel) => panel.style.flexBasis);
  }

  function labelledHandle(label: string): Element {
    const element = container.querySelector(`[aria-label="${CSS.escape(label)}"]`);
    if (element === null) {
      throw new Error(`nincs "${label}" elválasztó`);
    }
    return element;
  }

  /**
   * Az elválasztó jelentett `aria-valuemin`, `aria-valuenow` és
   * `aria-valuemax` értéke, ebben a sorrendben.
   */
  function reportedRange(label: string): readonly (string | null)[] {
    const element = labelledHandle(label);
    return ['aria-valuemin', 'aria-valuenow', 'aria-valuemax'].map((name) => element.getAttribute(name));
  }

  /**
   * Valódi geometria a happy-dom nulla téglalapja helyett: a két panel a
   * csoport tengelyén `pixels` méretű, és a forrás CSS pixeles minimumát
   * inline `min-width`/`min-height` adja (a `getComputedStyle` ezt olvassa).
   */
  function stubPanelGeometry(pixels: readonly number[], minimum: string): void {
    const panels = [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')];
    for (const [index, panel] of panels.entries()) {
      const size = pixels[index] ?? 0;
      panel.getBoundingClientRect = () => new DOMRect(0, 0, size, size);
      panel.style.minWidth = minimum;
      panel.style.minHeight = minimum;
    }
  }

  /**
   * A futás nézet mintája (`contentMinimum` tesztjeihez): a külső csoport
   * 1-es paneljében egy beágyazott, függőleges csoport (a transcript és a
   * jóváhagyás szövege) áll, alatta a "Függő jóváhagyások" régió (`region`
   * id-vel).
   */
  function renderWithRegion(contentMinimum?: Readonly<{ panelIndex: number; regionElementId: string }>): void {
    act(() => {
      root.render(
        <Resizable
          direction="vertical"
          defaultSizes={[70, 30]}
          {...(contentMinimum === undefined ? {} : { contentMinimum })}
        >
          <ResizablePanel index={0}>Gráf</ResizablePanel>
          <ResizableHandle beforeIndex={0} aria-label="Külső" />
          <ResizablePanel index={1}>
            <Resizable direction="vertical" defaultSizes={[60, 40]}>
              <ResizablePanel index={0}>Transcript</ResizablePanel>
              <ResizableHandle beforeIndex={0} aria-label="Belső" />
              <ResizablePanel index={1}>Jóváhagyás</ResizablePanel>
            </Resizable>
            <section id="region">Függő jóváhagyások</section>
          </ResizablePanel>
        </Resizable>,
      );
    });
  }

  function stubRegionHeight(height: number): void {
    const region = container.querySelector('#region');
    if (region === null) {
      throw new Error('nincs "region" elem');
    }
    region.getBoundingClientRect = () => new DOMRect(0, 0, 0, height);
  }

  it('a csoport osztálya vízszintes irányban nem hordozza a --vertical módosítót', () => {
    renderTwoPane();
    expect(container.querySelector('.resizable-group')?.className).toBe('resizable-group');
  });

  it('a csoport osztálya függőleges irányban a --vertical módosítót is hordozza', () => {
    renderTwoPane('vertical');
    expect(container.querySelector('.resizable-group')?.className).toBe('resizable-group resizable-group--vertical');
  });

  it('mind a hat ARIA attribútum és a role jelen van az elválasztón', () => {
    renderTwoPane();
    const separator = handle();
    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.getAttribute('aria-label')).toBe('Resize panels 1 and 2');
    expect(separator.getAttribute('aria-controls')).toContain('panel-0');
    expect(separator.getAttribute('aria-controls')).toContain('panel-1');
    expect(separator.getAttribute('aria-valuemin')).toBe('5');
    expect(separator.getAttribute('aria-valuemax')).toBe('95');
    expect(separator.getAttribute('aria-valuenow')).toBe('40');
  });

  it('vízszintes irányban az aria-orientation vízszintes tengelyt jelöl (a specifikáció szerint "horizontal" az elválasztó vizuális iránya)', () => {
    renderTwoPane('vertical');
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('vízszintes elrendezésben az ArrowRight növeli, az ArrowLeft csökkenti a bal panelt', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'ArrowRight');
    expect(panelSizes()).toEqual(['45%', '55%']);
    pressKeyOn(handle(), 'ArrowLeft');
    pressKeyOn(handle(), 'ArrowLeft');
    expect(panelSizes()).toEqual(['35%', '65%']);
  });

  it('vízszintes elrendezésben az ArrowUp/ArrowDown nem hat (merőleges tengely)', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'ArrowUp');
    pressKeyOn(handle(), 'ArrowDown');
    expect(panelSizes()).toEqual(['40%', '60%']);
  });

  it('függőleges elrendezésben az ArrowDown növeli, az ArrowUp csökkenti a felső panelt', () => {
    renderTwoPane('vertical');
    pressKeyOn(handle(), 'ArrowDown');
    expect(panelSizes()).toEqual(['45%', '55%']);
    pressKeyOn(handle(), 'ArrowUp');
    pressKeyOn(handle(), 'ArrowUp');
    expect(panelSizes()).toEqual(['35%', '65%']);
  });

  it('függőleges elrendezésben az ArrowLeft/ArrowRight nem hat (merőleges tengely)', () => {
    renderTwoPane('vertical');
    pressKeyOn(handle(), 'ArrowLeft');
    pressKeyOn(handle(), 'ArrowRight');
    expect(panelSizes()).toEqual(['40%', '60%']);
  });

  it('Shift lenyomva dupla lépésközzel mozgat', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'ArrowRight', true);
    expect(panelSizes()).toEqual(['50%', '50%']);
  });

  it('Home a bal/felső panelt a minimumra, End a maximumra vágja', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'Home');
    expect(panelSizes()).toEqual(['5%', '95%']);
    pressKeyOn(handle(), 'End');
    expect(panelSizes()).toEqual(['95%', '5%']);
  });

  it('nem kezelt billentyű nem változtat méretet', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'a');
    expect(panelSizes()).toEqual(['40%', '60%']);
  });

  it('Enter összecsomagolja a bal panelt, majd a legutóbbi méretre nyitja vissza (mindkét irány)', () => {
    renderTwoPane();
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['5%', '95%']);
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['40%', '60%']);
  });

  it('Enter emlékezet nélkül (már összecsomagolva induló panel) az alapértelmezett 50 százalékra nyit vissza', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[5, 95]}>
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['50%', '50%']);
  });

  it('Enter tartományon kívüli beforeIndex-szel nem változtat méretet (hibás összeállítás elleni védelem)', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[100]}>
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={5} />
        </Resizable>,
      );
    });
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['100%']);
  });

  it('pointerdown aktívvá teszi az elválasztót (is-dragging osztály), pointerup törli', () => {
    renderTwoPane();
    const separator = handle();
    expect(separator.className).toBe('resizable-handle');

    act(() => {
      separator.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }));
    });
    expect(handle().className).toBe('resizable-handle is-dragging');

    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(handle().className).toBe('resizable-handle');
  });

  it('pointermove-ra a happy-dom nulla méretű konténerén a méretek nem változnak (a guard ág)', () => {
    renderTwoPane();
    const separator = handle();

    act(() => {
      separator.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }));
    });
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }));
    });
    expect(panelSizes()).toEqual(['40%', '60%']);

    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointerup'));
    });
  });

  it('függőleges elrendezésben a pointerdown és a pointermove a clientY-t olvassa (nem a clientX-et)', () => {
    renderTwoPane('vertical');
    const separator = handle();
    act(() => {
      separator.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true, cancelable: true }));
    });
    expect(handle().className).toBe('resizable-handle is-dragging');
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientY: 150 }));
    });
    expect(panelSizes()).toEqual(['40%', '60%']);
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointerup'));
    });
  });

  it('leszereléskor eltávolítja a window listenereket, húzás közben is', () => {
    renderTwoPane();
    act(() => {
      handle().dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }));
    });
    expect(() => {
      act(() => {
        root.unmount();
      });
    }).not.toThrow();
  });

  it('az onSizesChange csak a felhasználó változtatását jelenti: a kezdő renderen nem, a nyíl, a húzás és az Enter után igen (2026-09-25)', () => {
    const reported: (readonly number[])[] = [];
    act(() => {
      root.render(
        <Resizable
          defaultSizes={[40, 60]}
          onSizesChange={(sizes) => {
            reported.push(sizes);
          }}
        >
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    expect(reported).toEqual([]);

    pressKeyOn(handle(), 'ArrowRight');
    expect(reported).toEqual([[45, 55]]);
    act(() => {
      handle().dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true, cancelable: true }));
    });
    expect(reported).toHaveLength(1);
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 }));
    });
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(reported).toHaveLength(2);
    pressKeyOn(handle(), 'Enter');
    expect(reported.at(-1)).toEqual([5, 95]);
  });

  it('a panelek zsugorodhatnak (flex-shrink: 1), hogy a csoport az elválasztóval együtt se lógjon túl', () => {
    renderTwoPane();
    const panels = [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')];
    expect(panels.map((panel) => panel.style.flexShrink)).toEqual(['1', '1']);
  });

  it('a mért pixeles minimum a Home és az End határa, és az aria-valuemin/valuemax is ezt jelenti', () => {
    renderTwoPane('vertical');
    stubPanelGeometry([160, 240], '60px');
    // A fókusz méri újra a paneleket: 60 / 400 = 15 százalék.
    act(() => {
      handle().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(handle().getAttribute('aria-valuemin')).toBe('15');
    expect(handle().getAttribute('aria-valuemax')).toBe('85');
    expect(handle().getAttribute('aria-valuenow')).toBe('40');
    pressKeyOn(handle(), 'Home');
    expect(panelSizes()).toEqual(['15%', '85%']);
    expect(handle().getAttribute('aria-valuenow')).toBe('15');
    pressKeyOn(handle(), 'End');
    expect(panelSizes()).toEqual(['85%', '15%']);
  });

  it('a minimum alatti tárolt méret az ablak átméretezésekor a mért minimumra igazodik, és ezt NEM jelenti (nem a felhasználó döntése)', () => {
    const reported: (readonly number[])[] = [];
    act(() => {
      root.render(
        <Resizable
          direction="vertical"
          defaultSizes={[5, 95]}
          onSizesChange={(sizes) => {
            reported.push(sizes);
          }}
        >
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    stubPanelGeometry([20, 380], '60px');
    act(() => {
      globalThis.dispatchEvent(new Event('resize'));
    });
    expect(panelSizes()).toEqual(['15%', '85%']);
    expect(reported).toEqual([]);
  });

  it('egy leszerelt panel kiesik a mérésből: ilyenkor nincs mért minimum, a forrás [5, 95] határa marad', () => {
    renderTwoPane('vertical');
    stubPanelGeometry([160, 240], '60px');
    act(() => {
      globalThis.dispatchEvent(new Event('resize'));
    });
    expect(handle().getAttribute('aria-valuemin')).toBe('15');

    act(() => {
      root.render(
        <Resizable direction="vertical" defaultSizes={[40, 60]}>
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1}>Main</ResizablePanel>
        </Resizable>,
      );
    });
    act(() => {
      globalThis.dispatchEvent(new Event('resize'));
    });
    expect(handle().getAttribute('aria-valuemin')).toBe('5');
    expect(handle().getAttribute('aria-valuemax')).toBe('95');
  });

  it('egy később felcsatolt panel a csatolásakor mérődik: az aria-valuemin/valuemax fókusz nélkül is a mért minimum', () => {
    // A két panel együtt 400 pixel, a pixeles minimum a forrás CSS szabálya
    // (a happy-dom a stíluslapot is kiértékeli a `getComputedStyle` hívásban).
    const style = document.createElement('style');
    style.textContent = '.resizable-panel { min-width: 60px; min-height: 60px; }';
    document.head.append(style);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 200));
    try {
      act(() => {
        root.render(
          <Resizable direction="vertical" defaultSizes={[40, 60]}>
            <ResizablePanel index={0}>Transcript</ResizablePanel>
          </Resizable>,
        );
      });
      act(() => {
        root.render(
          <Resizable direction="vertical" defaultSizes={[40, 60]}>
            <ResizablePanel index={0}>Transcript</ResizablePanel>
            <ResizableHandle beforeIndex={0} />
            <ResizablePanel index={1}>Jóváhagyás</ResizablePanel>
          </Resizable>,
        );
      });
      // 60 / 400 = 15 százalék, a fókusz, az átméretezés és a billentyű
      // előtt.
      expect(handle().getAttribute('aria-valuemin')).toBe('15');
      expect(handle().getAttribute('aria-valuemax')).toBe('85');
    } finally {
      rect.mockRestore();
      style.remove();
    }
  });

  it('a mérés nem ír új méretet, ha a méret a minimum fölött áll', () => {
    const reported: (readonly number[])[] = [];
    act(() => {
      root.render(
        <Resizable
          defaultSizes={[40, 60]}
          onSizesChange={(sizes) => {
            reported.push(sizes);
          }}
        >
          <ResizablePanel index={0} />
          <ResizableHandle beforeIndex={0} />
          <ResizablePanel index={1} />
        </Resizable>,
      );
    });
    stubPanelGeometry([400, 600], '80px');
    act(() => {
      globalThis.dispatchEvent(new Event('resize'));
    });
    expect(panelSizes()).toEqual(['40%', '60%']);
    expect(reported).toEqual([]);
  });

  it('húzáskor az elmozdulás a panelek együttes méretének százaléka, a mért minimummal vágva', () => {
    renderTwoPane();
    stubPanelGeometry([400, 600], '80px');
    act(() => {
      handle().dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }));
    });
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: 200 }));
    });
    expect(panelSizes()).toEqual(['50%', '50%']);
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: -1000 }));
    });
    expect(panelSizes()).toEqual(['8%', '92%']);
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointerup'));
    });
  });

  it('a pointercancel lezárja a húzást: az is-dragging osztály eltűnik, és egy utána jövő pointermove nem mozdít', () => {
    renderTwoPane();
    stubPanelGeometry([400, 600], '80px');
    act(() => {
      handle().dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true, cancelable: true }));
    });
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: 130 }));
    });
    expect(panelSizes()).toEqual(['43%', '57%']);
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointercancel'));
    });
    expect(handle().className).toBe('resizable-handle');
    act(() => {
      globalThis.dispatchEvent(new PointerEvent('pointermove', { clientX: 900 }));
    });
    expect(panelSizes()).toEqual(['43%', '57%']);
  });

  it('Enter a mért minimumra csomagol, és onnan a legutóbbi méretre nyit vissza', () => {
    renderTwoPane('vertical');
    stubPanelGeometry([160, 240], '60px');
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['15%', '85%']);
    pressKeyOn(handle(), 'Enter');
    expect(panelSizes()).toEqual(['40%', '60%']);
  });

  describe('felfedés (reveal, 2026-09-25)', () => {
    let restore: (() => void) | undefined;

    /**
     * Valódi geometria a happy-dom nulla téglalapja helyett, már a csatolás
     * előtt: a `.resizable-panel` elem mérete a legközelebbi
     * `data-panel-sizes` burkoló listájából jön (a panel sorszáma szerint,
     * `DOMRect(0, 0, méret, méret)`, tehát tengelytől független), a
     * `.resizable-group` csoporté a paneljei összege (az elválasztó a
     * happy-dom nulla téglalapja, tehát nem vesz el helyet, és szegély
     * nincs), minden más elemé a saját `data-rect` attribútumából
     * ("x,y,szélesség,magasság"). A pixeles minimum a forrás CSS szabálya,
     * stíluslapból.
     */
    function installGeometry(): void {
      const style = document.createElement('style');
      style.textContent = '.resizable-panel { min-width: 60px; min-height: 60px; }';
      document.head.append(style);
      const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ): DOMRect {
        const sizes = (this.closest<HTMLElement>('[data-panel-sizes]')?.dataset['panelSizes'] ?? '').split(',');
        if (this.classList.contains('resizable-panel')) {
          const siblings = [...(this.parentElement?.children ?? [])].filter((child) =>
            child.classList.contains('resizable-panel'),
          );
          const size = Number(sizes[siblings.indexOf(this)] ?? '0');
          return new DOMRect(0, 0, size, size);
        }
        if (this.classList.contains('resizable-group')) {
          let sum = 0;
          for (const size of sizes) {
            sum += Number(size);
          }
          return new DOMRect(0, 0, sum, sum);
        }
        const [x = 0, y = 0, width = 0, height = 0] = (this.dataset['rect'] ?? '').split(',').map(Number);
        return new DOMRect(x, y, width, height);
      });
      restore = () => {
        spy.mockRestore();
        style.remove();
      };
    }

    afterEach(() => {
      restore?.();
      restore = undefined;
    });

    interface InnerOptions {
      readonly reveal?: { readonly elementId: string };
      readonly adjustsForReveal?: boolean;
      readonly onSizesChange?: (sizes: readonly number[]) => void;
      readonly textRect?: string;
    }

    /**
     * A futás nézet belső csoportjának mintája: felül a "transcript", alul a
     * görgethető törzs (`overflow: auto`), benne a felfedendő szöveg. A két
     * panel 100 és 100 pixel, a görgető doboz a második panel teljes
     * dobozát kapja, a szöveg alja alapból 150 pixelen áll, tehát a
     * második panelnek 150 pixel kell.
     */
    function innerGroup(options: Readonly<InnerOptions>): ReactElement {
      return (
        <div data-panel-sizes="100,100">
          <Resizable
            direction="vertical"
            defaultSizes={[50, 50]}
            {...(options.reveal === undefined ? {} : { reveal: options.reveal })}
            {...(options.adjustsForReveal === undefined ? {} : { adjustsForReveal: options.adjustsForReveal })}
            {...(options.onSizesChange === undefined ? {} : { onSizesChange: options.onSizesChange })}
          >
            <ResizablePanel index={0}>Transcript</ResizablePanel>
            <ResizableHandle beforeIndex={0} />
            <ResizablePanel index={1}>
              <div data-rect="0,0,100,100" style={{ overflowY: 'auto' }}>
                <p id="kerdes" data-rect={options.textRect ?? '0,50,100,100'}>
                  Kérdés
                </p>
              </div>
            </ResizablePanel>
          </Resizable>
        </div>
      );
    }

    const REVEAL = { elementId: 'kerdes' } as const;

    it('a szöveg a saját elválasztó rovására kifér, értesítés nélkül, és a felfedés végén az alapállás visszaáll', () => {
      installGeometry();
      const reported: (readonly number[])[] = [];
      const onSizesChange = (sizes: readonly number[]): void => {
        reported.push(sizes);
      };
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true, onSizesChange }));
      });
      // 150 / 200 = 75 százalék, a felső panel minimuma 60 / 200 = 30.
      expect(sizesOf(groups()[0])).toEqual(['30%', '70%']);
      expect(reported).toEqual([]);
      act(() => {
        root.render(innerGroup({ adjustsForReveal: true, onSizesChange }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      expect(reported).toEqual([]);
    });

    it('ha a szöveg elfér, a méretek nem változnak', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true, textRect: '0,20,100,40' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
    });

    it('saját aránnyal (adjustsForReveal hamis, az alapérték) a méret nem változik', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: REVEAL }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
    });

    it('minden új leírásra újra számol: egy rövidebb szövegre az alapállás felé, egy hosszabbra tovább igazodik', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' }, adjustsForReveal: true, textRect: '0,20,100,110' }));
      });
      // 130 / 200 = 65 százalék.
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' }, adjustsForReveal: true, textRect: '0,20,100,40' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      // A hívó újrarenderelése (például egy hibaüzenet a csoport alatt) a
      // szöveget hosszabbá teszi: az új leírás újraszámolást vált ki, kulcs
      // és ablak átméretezés nélkül.
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' }, adjustsForReveal: true, textRect: '0,20,100,120' }));
      });
      // 140 / 200 = 70 százalék.
      expect(sizesOf(groups()[0])).toEqual(['30%', '70%']);
    });

    it('ugyanaz a leírás a hívó újrarenderelésekor nem számol újra, egy változatlan elrendezésre az új leírás sem ír új állapotot', () => {
      installGeometry();
      const commits: string[] = [];
      const render = (reveal: { readonly elementId: string }, textRect: string): void => {
        act(() => {
          root.render(
            <Profiler
              id="felfedes"
              onRender={(_, phase) => {
                commits.push(phase);
              }}
            >
              {innerGroup({ reveal, adjustsForReveal: true, textRect })}
            </Profiler>,
          );
        });
      };
      const reveal = { elementId: 'kerdes' };
      render(reveal, '0,20,100,110');
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      // Ugyanaz a leírás, hosszabb szöveggel: nincs újraszámolás.
      render(reveal, '0,20,100,120');
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      // Új leírás, de ugyanaz a szöveg, mint az első számításkor: a terv
      // ugyanaz, tehát a renderelésen túl nincs újabb véglegesítés.
      commits.length = 0;
      render({ elementId: 'kerdes' }, '0,20,100,110');
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      expect(commits).toEqual(['update']);
    });

    it('az ablak átméretezésekor újra számol', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true, textRect: '0,20,100,40' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      container.querySelector('#kerdes')?.setAttribute('data-rect', '0,20,100,110');
      act(() => {
        globalThis.dispatchEvent(new Event('resize'));
      });
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
    });

    it('rejtett, nulla méretű csoportban (például egy nem aktív fülön) nincs mit mérni, a méret nem változik', () => {
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
    });

    it('nem létező elemre és panelen kívüli elemre nincs változás', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'nincs-ilyen' }, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      const outside = document.createElement('p');
      outside.id = 'kivul';
      outside.dataset['rect'] = '0,0,100,900';
      document.body.append(outside);
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kivul' }, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      outside.remove();
    });

    it('a felhasználó húzása után a felfedés vége nem írja felül, és új leírásra sem igazodik', () => {
      installGeometry();
      const reported: (readonly number[])[] = [];
      const onSizesChange = (sizes: readonly number[]): void => {
        reported.push(sizes);
      };
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true, onSizesChange }));
      });
      pressKeyOn(handle(), 'ArrowDown');
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      expect(reported).toEqual([[35, 65]]);
      act(() => {
        root.render(innerGroup({ adjustsForReveal: true, onSizesChange }));
      });
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' }, adjustsForReveal: true, textRect: '0,50,100,140' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
    });

    it('egy már igazodó felfedést az adjustsForReveal hamisra váltása nem állít meg: a felfedés végéig igazodik, a végén visszaáll, és a következő felfedés már az új értékkel indul (2026-09-26)', () => {
      installGeometry();
      act(() => {
        root.render(innerGroup({ reveal: REVEAL, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['30%', '70%']);
      // A hívó a felfedés közben hamisra vált (a futás nézetben a külső
      // elválasztó húzása után), és egy új leírással rövidebb szöveget ad: a
      // csoport tovább igazodik, 130 / 200 = 65 százalék.
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' }, textRect: '0,20,100,110' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['35%', '65%']);
      act(() => {
        root.render(innerGroup({}));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      act(() => {
        root.render(innerGroup({ reveal: { elementId: 'kerdes' } }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
    });

    interface NestedOptions extends InnerOptions {
      readonly outerDirection?: 'horizontal' | 'vertical';
      readonly outerAdjusts?: boolean;
      readonly outerPanels?: string;
      readonly outerSizes?: readonly number[];
    }

    /**
     * A futás nézet függőleges sávjának mintája: a külső csoport második
     * panelje tartja a belső csoportot.
     */
    function nested(options: Readonly<NestedOptions>): ReactElement {
      return (
        <div data-panel-sizes={options.outerPanels ?? '500,300'}>
          <Resizable
            direction={options.outerDirection ?? 'vertical'}
            defaultSizes={options.outerSizes ?? [62.5, 37.5]}
            adjustsForReveal={options.outerAdjusts ?? true}
          >
            <ResizablePanel index={0}>Gráf</ResizablePanel>
            <ResizableHandle beforeIndex={0} aria-label="Külső" />
            <ResizablePanel index={1}>{innerGroup(options)}</ResizablePanel>
          </Resizable>
        </div>
      );
    }

    it('a befoglaló csoport ad helyet előbb, és a belső arány marad', () => {
      installGeometry();
      act(() => {
        root.render(nested({ adjustsForReveal: true }));
      });
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true }));
      });
      const [outer, inner] = groups();
      // A belső csoportnak 150 / 0,5 = 300 pixel kell, 100-zal több: a
      // külső második panel 300-ról 400 pixelre nő (800 pixelből 50 százalék).
      expect(sizesOf(outer)).toEqual(['50%', '50%']);
      expect(sizesOf(inner)).toEqual(['50%', '50%']);
      act(() => {
        root.render(nested({ adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['62.5%', '37.5%']);
    });

    it('együtt csatolva sem vonja vissza a befoglaló csoport a belső kérését', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
    });

    it('a befoglaló csoport minimumánál a maradékot a belső elválasztó fizeti', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true, outerPanels: '100,300', outerSizes: [25, 75] }));
      });
      const [outer, inner] = groups();
      // A külső első panel minimuma 60 / 400 = 15 százalék: 40 pixel jön, a
      // belső csoport 240 pixeléből 150 a törzsé (62,5 százalék).
      expect(sizesOf(outer)).toEqual(['15%', '85%']);
      expect(sizesOf(inner)).toEqual(['37.5%', '62.5%']);
    });

    it('más tengelyű vagy mozdíthatatlan befoglaló csoport nem ad helyet, a belső fizet', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true, outerDirection: 'horizontal' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['62.5%', '37.5%']);
      expect(sizesOf(groups()[1])).toEqual(['30%', '70%']);
      act(() => {
        root.unmount();
      });
      root = createRoot(container);
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true, outerAdjusts: false }));
      });
      expect(sizesOf(groups()[0])).toEqual(['62.5%', '37.5%']);
      expect(sizesOf(groups()[1])).toEqual(['30%', '70%']);
    });

    it('a befoglaló csoport tengelyváltásakor a befoglaló visszaáll, és a belső fizet', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true, outerDirection: 'horizontal' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['62.5%', '37.5%']);
      expect(sizesOf(groups()[1])).toEqual(['30%', '70%']);
    });

    it('a befoglaló csoport a felhasználó húzása után nem ad helyet, és a felfedés végén nem áll vissza', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, adjustsForReveal: true }));
      });
      const outerHandle = container.querySelector('[aria-label="Külső"]');
      if (outerHandle === null) {
        throw new Error('nincs külső elválasztó');
      }
      pressKeyOn(outerHandle, 'ArrowDown');
      expect(sizesOf(groups()[0])).toEqual(['55%', '45%']);
      // A rögzített geometria követi a kirajzolást: 800 pixelből 440 és 360.
      act(() => {
        root.render(nested({ adjustsForReveal: true, outerPanels: '440,360' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['55%', '45%']);
      act(() => {
        root.render(nested({ reveal: { elementId: 'kerdes' }, adjustsForReveal: true, outerPanels: '440,360' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['55%', '45%']);
      expect(sizesOf(groups()[1])).toEqual(['30%', '70%']);
    });

    it('saját belső aránnyal a befoglaló csoport csak a teljes igényt adja meg: ha teljesíthető, a belső arány mellett a szöveg kifér', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL }));
      });
      // A belső csoportnak a saját 50 százalékán 150 / 0,5 = 300 pixel kell:
      // a külső második panel 300-ról 400 pixelre nő.
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      expect(sizesOf(groups()[1])).toEqual(['50%', '50%']);
      // Egy új leírás ugyanarra az elrendezésre ugyanazt a tervet adja: a
      // befoglaló csoport nem ír új állapotot, és nem vonja vissza a helyet.
      act(() => {
        root.render(nested({ reveal: { elementId: 'kerdes' } }));
      });
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      expect(sizesOf(groups()[1])).toEqual(['50%', '50%']);
    });

    it('saját belső aránnyal, ha a befoglaló csoport a minimumáig sem adhatja meg a teljes igényt, egyik elválasztó sem mozdul', () => {
      installGeometry();
      act(() => {
        root.render(nested({ reveal: REVEAL, outerPanels: '100,300', outerSizes: [25, 75] }));
      });
      // 400 pixelből a második panel legfeljebb 340 (az első minimuma 60):
      // a 400 pixeles igény nem teljesíthető, a rajz nem húzódik össze.
      expect(sizesOf(groups()[0])).toEqual(['25%', '75%']);
      expect(sizesOf(groups()[1])).toEqual(['50%', '50%']);
    });

    it('a befoglaló csoport felhasználói méretváltoztatására a belső újra számol (a szöveg újratördelése után is kifér)', () => {
      installGeometry();
      act(() => {
        root.render(
          nested({ reveal: REVEAL, adjustsForReveal: true, outerDirection: 'horizontal', textRect: '0,20,100,40' }),
        );
      });
      expect(sizesOf(groups()[1])).toEqual(['50%', '50%']);
      // A külső elválasztó húzása keskenyebbé teszi a transcript oldalt, a
      // szöveg magasabb lesz (a geometria ezt a kirajzolás helyett rögzíti).
      container.querySelector('#kerdes')?.setAttribute('data-rect', '0,20,100,110');
      const outerHandle = container.querySelector('[aria-label="Külső"]');
      if (outerHandle === null) {
        throw new Error('nincs külső elválasztó');
      }
      pressKeyOn(outerHandle, 'ArrowRight');
      expect(sizesOf(groups()[0])).toEqual(['67.5%', '32.5%']);
      expect(sizesOf(groups()[1])).toEqual(['35%', '65%']);
    });
  });

  describe('a mért minimum a csoport minden méretváltozása után friss (2026-09-27)', () => {
    let restore: (() => void) | undefined;

    /**
     * A kirajzolást követő geometria (a fenti rögzített geometriával
     * szemben): a `.resizable-panel` elem mérete a csoportja méretének
     * `flex-basis` százaléka, egy `.resizable-group` méretét a befoglaló
     * panel adja, a legkülsőét a legközelebbi `data-group-size` burkoló.
     * Minden más elem a saját `data-rect` attribútumát kapja
     * ("x,y,szélesség,magasság"). A pixeles minimum a forrás CSS szabálya.
     */
    function installFlexGeometry(): void {
      const style = document.createElement('style');
      style.textContent = '.resizable-panel { min-width: 60px; min-height: 60px; }';
      document.head.append(style);
      // A burkoló mérete szorozva az elemet tartó (és az elem maga, ha panel)
      // összes panel `flex-basis` arányával, belülről kifelé.
      function sizeOf(element: Element): number {
        let size = Number(element.closest<HTMLElement>('[data-group-size]')?.dataset['groupSize'] ?? '0');
        let panel: HTMLElement | null | undefined = element.closest<HTMLElement>('.resizable-panel');
        while (panel !== null && panel !== undefined) {
          size *= Number(panel.style.flexBasis.slice(0, -'%'.length)) / 100;
          panel = panel.parentElement?.closest<HTMLElement>('.resizable-panel');
        }
        return size;
      }
      const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ): DOMRect {
        if (this.classList.contains('resizable-panel') || this.classList.contains('resizable-group')) {
          const size = sizeOf(this);
          return new DOMRect(0, 0, size, size);
        }
        const [x = 0, y = 0, width = 0, height = 0] = (this.dataset['rect'] ?? '').split(',').map(Number);
        return new DOMRect(x, y, width, height);
      });
      restore = () => {
        spy.mockRestore();
        style.remove();
      };
    }

    afterEach(() => {
      restore?.();
      restore = undefined;
    });

    interface FreshOptions {
      readonly reveal?: { readonly elementId: string };
      readonly textRect?: string;
    }

    /**
     * A belső csoport saját `[70, 30]` aránnyal: felül a "transcript", alul
     * a görgethető törzs (a látható doboza 100 pixel magas), benne a
     * felfedendő szöveg. Alapból a szöveg elfér.
     */
    function ownInnerGroup(options: Readonly<FreshOptions>): ReactElement {
      return (
        <Resizable
          direction="vertical"
          defaultSizes={[70, 30]}
          {...(options.reveal === undefined ? {} : { reveal: options.reveal })}
        >
          <ResizablePanel index={0}>Transcript</ResizablePanel>
          <ResizableHandle beforeIndex={0} aria-label="Belső" />
          <ResizablePanel index={1}>
            <div data-rect="0,0,100,100" style={{ overflowY: 'auto' }}>
              <p id="kerdes" data-rect={options.textRect ?? '0,0,100,10'}>
                Kérdés
              </p>
            </div>
          </ResizablePanel>
        </Resizable>
      );
    }

    /**
     * A futás nézet függőleges sávjának mintája: a külső csoport 1000
     * pixeles, a második panelje tartja a belső csoportot.
     */
    function nestedOwnInner(outerSizes: readonly number[], options: Readonly<FreshOptions>): ReactElement {
      return (
        <div data-group-size="1000">
          <Resizable direction="vertical" defaultSizes={outerSizes} adjustsForReveal>
            <ResizablePanel index={0}>Gráf</ResizablePanel>
            <ResizableHandle beforeIndex={0} aria-label="Külső" />
            <ResizablePanel index={1}>{ownInnerGroup(options)}</ResizablePanel>
          </Resizable>
        </div>
      );
    }

    function renderSizedOwnInner(groupSize: string): void {
      act(() => {
        root.render(<div data-group-size={groupSize}>{ownInnerGroup({ reveal: { elementId: 'kerdes' } })}</div>);
      });
    }

    it('a befoglaló csoport felfedés miatti növekedése után a belső elválasztó a megnőtt csoportból számol, újabb renderelés nélkül is: a saját arány nem vágódik a felfedés előtti tartományra', () => {
      installFlexGeometry();
      act(() => {
        root.render(nestedOwnInner([85, 15], { reveal: { elementId: 'kerdes' } }));
      });
      // A belső csoport 150 pixel, a minimum 60 / 150 = 40 százalék: a
      // második panel a minimumán áll, a jelentett hely a vágott 60.
      expect(sizesOf(groups()[1])).toEqual(['70%', '30%']);
      expect(reportedRange('Belső')).toEqual(['40', '60', '60']);
      // Egy hosszabb szöveg 90 pixeles második panelt kér: a belső saját
      // aránya mellett 90 / 0,3 = 300 pixeles csoport, a külső második
      // panelje 150-ről 300 pixelre nő.
      act(() => {
        root.render(nestedOwnInner([85, 15], { reveal: { elementId: 'kerdes' }, textRect: '0,45,100,100' }));
      });
      expect(sizesOf(groups()[0])).toEqual(['70%', '30%']);
      expect(sizesOf(groups()[1])).toEqual(['70%', '30%']);
      // A 300 pixeles csoportban a minimum 60 / 300 = 20 százalék.
      expect(reportedRange('Belső')).toEqual(['20', '70', '80']);
    });

    it('a befoglaló csoport felhasználói méretváltoztatása után a belső elválasztó fókusz nélkül is a friss tartományt jelenti, és a saját aránya megmarad', () => {
      installFlexGeometry();
      act(() => {
        root.render(nestedOwnInner([50, 50], {}));
      });
      // 500 pixeles belső csoport: 60 / 500 = 12 százalék.
      expect(reportedRange('Belső')).toEqual(['12', '70', '88']);
      pressKeyOn(labelledHandle('Külső'), 'ArrowDown', true);
      expect(sizesOf(groups()[0])).toEqual(['60%', '40%']);
      // 400 pixeles belső csoport: 60 / 400 = 15 százalék.
      expect(reportedRange('Belső')).toEqual(['15', '70', '85']);
      pressKeyOn(labelledHandle('Külső'), 'ArrowDown', true);
      pressKeyOn(labelledHandle('Külső'), 'ArrowDown', true);
      pressKeyOn(labelledHandle('Külső'), 'ArrowDown');
      expect(sizesOf(groups()[0])).toEqual(['85%', '15%']);
      // 150 pixeles belső csoport: a második panel a minimumán áll, a
      // jelentett hely a vágott 60, a belső méret viszont nem íródik át.
      expect(reportedRange('Belső')).toEqual(['40', '60', '60']);
      expect(sizesOf(groups()[1])).toEqual(['70%', '30%']);
      pressKeyOn(labelledHandle('Külső'), 'ArrowUp', true);
      pressKeyOn(labelledHandle('Külső'), 'ArrowUp', true);
      pressKeyOn(labelledHandle('Külső'), 'ArrowUp', true);
      pressKeyOn(labelledHandle('Külső'), 'ArrowUp');
      expect(sizesOf(groups()[0])).toEqual(['50%', '50%']);
      expect(reportedRange('Belső')).toEqual(['12', '70', '88']);
    });

    it('a saját felfedés számítása a csoport más okú méretváltozása után is friss tartományt ad (új leírásra, átméretezés esemény nélkül)', () => {
      installFlexGeometry();
      renderSizedOwnInner('500');
      expect(reportedRange('Belső')).toEqual(['12', '70', '88']);
      // A csoport egy szomszéd elem miatt 300 pixelre szűkül (a
      // `ResizeObserver` a csomagban tiltott): a hívó új leírása újramér.
      renderSizedOwnInner('300');
      expect(reportedRange('Belső')).toEqual(['20', '70', '80']);
      expect(sizesOf(groups()[0])).toEqual(['70%', '30%']);
    });
  });

  it('a panelek gyerek tartalma megjelenik', () => {
    renderTwoPane();
    const panels = [...container.querySelectorAll('.resizable-panel')];
    expect(panels.map((panel) => panel.textContent)).toEqual(['Sidebar', 'Main']);
  });

  describe('contentMinimum (2026-09-27, SPEC-008 8. és 10. szekció, O-13)', () => {
    const CONTENT_MINIMUM = { panelIndex: 1, regionElementId: 'region' };

    it('contentMinimum nélkül a régió mérete nem hat a minimumra', () => {
      renderWithRegion();
      stubPanelGeometry([400, 600, 60, 40], '60px');
      stubRegionHeight(300);
      refresh();
      // 60 / 1000 = 6 százalék, a régió mérete nem számít.
      expect(reportedRange('Külső')).toEqual(['6', '70', '94']);
    });

    it('nem létező panelindexre nem változtat', () => {
      renderWithRegion({ panelIndex: 5, regionElementId: 'region' });
      stubPanelGeometry([400, 600, 60, 40], '60px');
      stubRegionHeight(300);
      refresh();
      expect(reportedRange('Külső')).toEqual(['6', '70', '94']);
    });

    it('mérhető geometria nélkül (nulla együttes méret) nem változtat', () => {
      renderWithRegion(CONTENT_MINIMUM);
      refresh();
      // A panelek kirajzolt mérete happy-dom alapból nulla: nincs mérhető
      // geometria, a forrás [5, 95] határa marad, a régió mérete nem is fut.
      expect(reportedRange('Külső')).toEqual(['5', '70', '95']);
    });

    it('a régió mérete plusz a beágyazott csoport minimuma bővíti a panel minimumát, ha nagyobb a CSS minimumnál', () => {
      renderWithRegion(CONTENT_MINIMUM);
      // Beágyazott csoport két paneljének CSS minimuma együtt 120 (60+60);
      // a régió 90 magas: a tartalom minimuma 210, 1000-ből 21 százalék, a
      // panel saját CSS minimuma (60/1000 = 6 százalék) helyett.
      stubPanelGeometry([400, 600, 60, 60], '60px');
      stubRegionHeight(90);
      refresh();
      expect(reportedRange('Külső')).toEqual(['6', '70', '79']);
    });

    it('ha a régió mérete később nő meg (élő tartalom), a panel mérete felhasználói művelet nélkül is felfelé igazodik', () => {
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      stubPanelGeometry([400, 600, 60, 60], '60px');
      refresh();
      // Régió nélküli magasság (nem stubbolt, nulla): a minimum csak a
      // beágyazott csoport 120-ából jön, 1000-ből 12 százalék.
      pressKeyOn(labelledHandle('Külső'), 'End');
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);

      // A régió mérete 90-re nő (élő tartalom érkezik, egy döntés hibája
      // vagy egy betöltés utáni érkezés): a minimum 210-re nő, 21
      // százalékra. Egy ÚJ `contentMinimum` leírás (a hívó minden
      // renderelésekor újat ad) váltja ki az újramérést ÉS a méret felfelé
      // igazítását, felhasználói művelet nélkül - a `measureGeometry` maga
      // csak a jelentett minimumot frissítené, a kirajzolt méretet a CSS
      // statikus 60 pixele vágná (`refreshGeometry`, `Resizable.tsx`).
      stubRegionHeight(90);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['79%', '21%']);
    });

    it('a régió nélkül (nincs a DOM-ban) a mérés nulla, csak a CSS minimum marad', () => {
      act(() => {
        root.render(
          <Resizable direction="vertical" defaultSizes={[70, 30]} contentMinimum={CONTENT_MINIMUM}>
            <ResizablePanel index={0}>Gráf</ResizablePanel>
            <ResizableHandle beforeIndex={0} aria-label="Külső" />
            <ResizablePanel index={1}>
              <Resizable direction="vertical" defaultSizes={[60, 40]}>
                <ResizablePanel index={0}>Transcript</ResizablePanel>
                <ResizableHandle beforeIndex={0} aria-label="Belső" />
                <ResizablePanel index={1}>Jóváhagyás</ResizablePanel>
              </Resizable>
            </ResizablePanel>
          </Resizable>,
        );
      });
      stubPanelGeometry([400, 600, 60, 60], '60px');
      refresh();
      // Nincs "region" elem: a `measureContentMinimumPixels` nullát ad, a
      // beágyazott csoport minimuma sem számít bele, tehát a panel saját CSS
      // minimuma (60 / 1000 = 6 százalék) marad.
      expect(reportedRange('Külső')).toEqual(['6', '70', '94']);
    });

    it('vízszintes csoportban a régió max-content szélessége számít, a beágyazott csoport nem', () => {
      act(() => {
        root.render(
          <Resizable direction="horizontal" defaultSizes={[70, 30]} contentMinimum={CONTENT_MINIMUM}>
            <ResizablePanel index={0}>Gráf</ResizablePanel>
            <ResizableHandle beforeIndex={0} aria-label="Külső" />
            <ResizablePanel index={1}>
              <Resizable direction="vertical" defaultSizes={[60, 40]}>
                <ResizablePanel index={0}>Transcript</ResizablePanel>
                <ResizableHandle beforeIndex={0} aria-label="Belső" />
                <ResizablePanel index={1}>Jóváhagyás</ResizablePanel>
              </Resizable>
              <section id="region">Függő jóváhagyások</section>
            </ResizablePanel>
          </Resizable>,
        );
      });
      stubPanelGeometry([400, 600, 60, 40], '80px');
      const region = container.querySelector<HTMLElement>('#region');
      if (region === null) {
        throw new Error('nincs "region" elem');
      }
      region.getBoundingClientRect = () => new DOMRect(0, 0, region.style.width === 'max-content' ? 250 : 0, 0);
      refresh();
      // 80 / 1000 = 8 százalék helyett a régió 250 pixeles igénye, 25
      // százalék; a beágyazott (más tengelyű) csoport nem ad hozzá.
      expect(reportedRange('Külső')).toEqual(['8', '70', '75']);
    });

    it('a régió mérete UTÓBB csökken, a panel visszaáll a növekedés előtti méretre', () => {
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      stubPanelGeometry([400, 600, 60, 60], '60px');
      refresh();
      pressKeyOn(labelledHandle('Külső'), 'End');
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);

      stubRegionHeight(90);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['79%', '21%']);

      // A jóváhagyás eltűnik (a régió magassága visszaesik nullára): a panel
      // a növekedés előtti méretre áll vissza, mert a feljegyzett alap (12
      // százalék) eléri a friss, összehúzódott minimumot (12 százalék) - a
      // `clampToMinimums` egyirányú korlátozása önmagában ezt nem tenné meg
      // (`docs/research/2026-09-24-jovahagyas-panel-helye.md` 17.6 szekció).
      stubRegionHeight(0);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);
    });

    it('ismételt növekedés nem írja felül a legkorábbi, valódi alapot', () => {
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      stubPanelGeometry([400, 600, 60, 60], '60px');
      refresh();
      pressKeyOn(labelledHandle('Külső'), 'End');
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);

      stubRegionHeight(90);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['79%', '21%']);

      // A régió tovább nő: a panel tovább igazodik, de a feljegyzett alap
      // (a legkorábbi, 12 százalékos méret) NEM íródik át a köztes (21
      // százalékos) méretre.
      stubRegionHeight(150);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['73%', '27%']);

      // Teljes zsugorodás: a visszaállás a LEGKORÁBBI alapra megy, nem a
      // köztes méretre.
      stubRegionHeight(0);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);
    });

    it('ha a felhasználó a növekedés alatt saját méretet állít be, a régió zsugorodása nem írja felül azt egy korábbi alapra', () => {
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      stubPanelGeometry([400, 600, 60, 60], '60px');
      refresh();
      pressKeyOn(labelledHandle('Külső'), 'End');
      expect(sizesOf(groups()[0])).toEqual(['88%', '12%']);

      stubRegionHeight(90);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['79%', '21%']);

      // A felhasználó saját döntése (nyíl billentyű) törli a feljegyzett
      // alapot: onnantól a méret az övé, a mechanizmus nem nyúl bele
      // (`markUserResize`).
      pressKeyOn(labelledHandle('Külső'), 'ArrowUp');
      expect(sizesOf(groups()[0])).toEqual(['74%', '26%']);

      // A jóváhagyás eltűnik: nincs feljegyzett alap, tehát nincs
      // visszaállítás, a felhasználó mérete változatlan marad.
      stubRegionHeight(0);
      renderWithRegion({ panelIndex: 1, regionElementId: 'region' });
      expect(sizesOf(groups()[0])).toEqual(['74%', '26%']);
    });
  });
});
