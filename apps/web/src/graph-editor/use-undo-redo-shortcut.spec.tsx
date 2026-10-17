import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UndoModifier } from './resolve-undo-modifier.ts';
import type { UndoShortcutAction } from './resolve-undo-shortcut.ts';
import { useUndoRedoShortcut } from './use-undo-redo-shortcut.ts';

function ShortcutProbe({
  onShortcut,
  isSaving = false,
  isNavigationConfirmationOpen = false,
  modifier = 'ctrl',
}: {
  readonly onShortcut: (action: UndoShortcutAction) => void;
  readonly isSaving?: boolean;
  readonly isNavigationConfirmationOpen?: boolean;
  readonly modifier?: UndoModifier;
}): ReactElement {
  useUndoRedoShortcut(onShortcut, isSaving, isNavigationConfirmationOpen, modifier);
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

  it('a mentés alatt a billentyű nem hat és nem kap preventDefault hívást, a mentés végén ismét hat (user döntés 2026-10-16)', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} isSaving />);
    });

    const duringSave = pressKey(document.body, { key: 'z', ctrlKey: true });
    const redoDuringSave = pressKey(document.body, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(onShortcut).not.toHaveBeenCalled();
    expect(duringSave.defaultPrevented).toBe(false);
    expect(redoDuringSave.defaultPrevented).toBe(false);

    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} isSaving={false} />);
    });
    const afterSave = pressKey(document.body, { key: 'z', ctrlKey: true });
    expect(onShortcut.mock.calls).toEqual([['undo']]);
    expect(afterSave.defaultPrevented).toBe(true);
  });

  it('a beállított módosítóra figyel: Cmd mellett a Cmd+Z hat, a Ctrl+Z nem, és a módosító váltása újrakötéssel érvényesül (O-31)', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} modifier="meta" />);
    });

    const ctrlEvent = pressKey(document.body, { key: 'z', ctrlKey: true });
    const metaEvent = pressKey(document.body, { key: 'z', metaKey: true });
    expect(onShortcut.mock.calls).toEqual([['undo']]);
    expect(ctrlEvent.defaultPrevented).toBe(false);
    expect(metaEvent.defaultPrevented).toBe(true);

    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} modifier="ctrl" />);
    });
    const metaAfterSwitch = pressKey(document.body, { key: 'z', metaKey: true });
    pressKey(document.body, { key: 'y', ctrlKey: true });
    expect(onShortcut.mock.calls).toEqual([['undo'], ['redo']]);
    expect(metaAfterSwitch.defaultPrevented).toBe(false);
  });

  it('nyitott megerősítő modálisnál a billentyű nem hat és nem kap preventDefault hívást, zárás után ismét hat (SPEC-008 5.10, 4. szabály)', () => {
    const onShortcut = vi.fn<(action: UndoShortcutAction) => void>();
    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} isNavigationConfirmationOpen />);
    });

    const whileOpen = pressKey(document.body, { key: 'z', ctrlKey: true });
    const redoWhileOpen = pressKey(document.body, { key: 'y', ctrlKey: true });
    expect(onShortcut).not.toHaveBeenCalled();
    expect(whileOpen.defaultPrevented).toBe(false);
    expect(redoWhileOpen.defaultPrevented).toBe(false);

    act(() => {
      root.render(<ShortcutProbe onShortcut={onShortcut} isNavigationConfirmationOpen={false} />);
    });
    const afterClose = pressKey(document.body, { key: 'z', ctrlKey: true });
    expect(onShortcut.mock.calls).toEqual([['undo']]);
    expect(afterClose.defaultPrevented).toBe(true);
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
