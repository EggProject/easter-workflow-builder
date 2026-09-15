import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Resizable } from './Resizable.tsx';
import { ResizablePanel } from './ResizablePanel.tsx';

describe('ResizablePanel', () => {
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

  it('Resizable-n kívül, no-op kontextussal 0 százalék flex-basis-szal rajzolódik ki, hibadobás nélkül', () => {
    act(() => {
      root.render(<ResizablePanel index={0}>tartalom</ResizablePanel>);
    });
    const panel = container.querySelector<HTMLDivElement>('.resizable-panel');
    expect(panel?.style.flexBasis).toBe('0%');
    expect(panel?.textContent).toBe('tartalom');
    expect(panel?.id).toBe('resizable-panel-0');
  });

  it('Resizable-n belül a saját indexéhez tartozó méretet és azonosítót veszi fel', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[30, 70]}>
          <ResizablePanel index={0}>elsőt</ResizablePanel>
          <ResizablePanel index={1}>második</ResizablePanel>
        </Resizable>,
      );
    });
    const panels = [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')];
    expect(panels.map((panel) => panel.style.flexBasis)).toEqual(['30%', '70%']);
    expect(panels.map((panel) => panel.textContent)).toEqual(['elsőt', 'második']);
    expect(panels[0]?.id).not.toBe(panels[1]?.id);
  });

  it('gyerek tartalom nélkül is renderelhető', () => {
    act(() => {
      root.render(
        <Resizable defaultSizes={[100]}>
          <ResizablePanel index={0} />
        </Resizable>,
      );
    });
    expect(container.querySelector('.resizable-panel')?.textContent).toBe('');
  });
});
