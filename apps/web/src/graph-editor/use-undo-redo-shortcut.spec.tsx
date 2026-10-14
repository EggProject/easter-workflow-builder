import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UndoShortcutAction } from './resolve-undo-shortcut.ts';
import { useUndoRedoShortcut } from './use-undo-redo-shortcut.ts';

function ShortcutProbe({ onShortcut }: { readonly onShortcut: (action: UndoShortcutAction) => void }): ReactElement {
  useUndoRedoShortcut(onShortcut);
  return <input aria-label="mező" />;
}

function pressKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('useUndoRedoShortcut', () => {
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

  it('a dokumentumon érkező Ctrl+Z visszavonást, a Ctrl+Y újra elvégzést kér, és a kezelt billentyűn preventDefault fut', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} />);
    });

    const undoEvent = pressKey(document.body, { key: 'z', ctrlKey: true });
    const redoEvent = pressKey(document.body, { key: 'y', ctrlKey: true });

    expect(onShortcut.mock.calls).toEqual([['undo'], ['redo']]);
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(redoEvent.defaultPrevented).toBe(true);
  });

  it('a nem kezelt billentyű és a beviteli mezőn lenyomott Ctrl+Z érintetlen marad', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} />);
    });
    const field = container.querySelector('input');
    if (field === null) {
      throw new Error('a teszt nem találta a mezőt');
    }

    const unhandled = pressKey(document.body, { key: 'a', ctrlKey: true });
    const inField = pressKey(field, { key: 'z', ctrlKey: true });

    expect(onShortcut).not.toHaveBeenCalled();
    expect(unhandled.defaultPrevented).toBe(false);
    expect(inField.defaultPrevented).toBe(false);
  });

  it('leszerelés után a figyelő nem fut', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} />);
    });
    act(() => {
      root.render(<p>másik képernyő</p>);
    });

    const event = pressKey(document.body, { key: 'z', ctrlKey: true });

    expect(onShortcut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
