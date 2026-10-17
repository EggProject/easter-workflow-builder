import { describe, expect, it } from 'vitest';
import { formatUndoShortcutLabels } from './format-undo-shortcut-labels.ts';

describe('formatUndoShortcutLabels', () => {
  it('ctrl módosítónál a Ctrl alakot adja', () => {
    expect(formatUndoShortcutLabels('ctrl')).toEqual({ undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z / Ctrl+Y' });
  });

  it('meta módosítónál a Cmd alakot adja', () => {
    expect(formatUndoShortcutLabels('meta')).toEqual({ undo: 'Cmd+Z', redo: 'Cmd+Shift+Z / Cmd+Y' });
  });
});
