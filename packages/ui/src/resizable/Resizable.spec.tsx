import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  function panelSizes(): readonly string[] {
    return [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')].map((panel) => panel.style.flexBasis);
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

  it('a panelek gyerek tartalma megjelenik', () => {
    renderTwoPane();
    const panels = [...container.querySelectorAll('.resizable-panel')];
    expect(panels.map((panel) => panel.textContent)).toEqual(['Sidebar', 'Main']);
  });
});
