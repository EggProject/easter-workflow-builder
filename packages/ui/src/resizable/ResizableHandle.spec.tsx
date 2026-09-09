import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Resizable } from './Resizable.tsx';
import { ResizableHandle } from './ResizableHandle.tsx';
import { ResizablePanel } from './ResizablePanel.tsx';

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
    expect(separator().getAttribute('aria-label')).toBe('Resize panels 1 and 2');

    expect(() => {
      act(() => {
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
});
