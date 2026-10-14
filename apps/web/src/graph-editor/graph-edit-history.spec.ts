import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import {
  closeGraphEditSession,
  recordGraphEdit,
  redoGraphEdit,
  startGraphEditHistory,
  undoGraphEdit,
  type GraphEditorDocument,
} from './graph-edit-history.ts';

function node(id: string, positionX = 0): WorkflowNodeInput {
  return {
    id,
    type: 'script',
    label: id,
    positionX,
    positionY: 0,
    config: { type: 'script', source: 'x', runtime: 'expression', onUnhandledError: 'fail_run' },
  };
}

function documentOf(...nodes: readonly WorkflowNodeInput[]): GraphEditorDocument {
  return { nodes, edges: [] };
}

const INITIAL = documentOf(node('a'));
const FIRST = documentOf(node('a'), node('b'));
const SECOND = documentOf(node('a'), node('b'), node('c'));

const FIELD_SESSION = { key: 'field:a', isFinal: false };
const DRAG_MOVE = { key: 'node-drag', isFinal: false };
const DRAG_END = { key: 'node-drag', isFinal: true };

describe('graph-edit-history', () => {
  it('a kiinduló dokumentumról üres listákkal, nyitott menet nélkül indul', () => {
    expect(startGraphEditHistory(INITIAL)).toEqual({
      document: INITIAL,
      undoStack: [],
      redoStack: [],
      openSessionKey: undefined,
    });
  });

  it('a rögzítés a korábbi dokumentumot a visszavonás lista végére teszi', () => {
    const history = recordGraphEdit(recordGraphEdit(startGraphEditHistory(INITIAL), FIRST), SECOND);
    expect(history.document).toBe(SECOND);
    expect(history.undoStack).toEqual([INITIAL, FIRST]);
    expect(history.redoStack).toEqual([]);
    expect(history.openSessionKey).toBeUndefined();
  });

  it('a visszavonás pontosan a művelet előtti, az újra elvégzés a művelet utáni dokumentumot adja', () => {
    const recorded = recordGraphEdit(startGraphEditHistory(INITIAL), FIRST);
    const undone = undoGraphEdit(recorded);
    expect(undone.document).toBe(INITIAL);
    expect(undone.undoStack).toEqual([]);
    expect(undone.redoStack).toEqual([FIRST]);

    const redone = redoGraphEdit(undone);
    expect(redone.document).toBe(FIRST);
    expect(redone.undoStack).toEqual([INITIAL]);
    expect(redone.redoStack).toEqual([]);
  });

  it('a visszavonás a kiinduló dokumentumnál korábbra nem lép: üres listánál ugyanazt a történetet adja', () => {
    const history = startGraphEditHistory(INITIAL);
    expect(undoGraphEdit(history)).toBe(history);
  });

  it('üres újra listánál az újra elvégzés ugyanazt a történetet adja', () => {
    const history = recordGraphEdit(startGraphEditHistory(INITIAL), FIRST);
    expect(redoGraphEdit(history)).toBe(history);
  });

  it('egy új változás az újra listát kiüríti', () => {
    const undone = undoGraphEdit(recordGraphEdit(startGraphEditHistory(INITIAL), FIRST));
    expect(undone.redoStack).toEqual([FIRST]);
    const changed = recordGraphEdit(undone, SECOND);
    expect(changed.redoStack).toEqual([]);
    expect(changed.undoStack).toEqual([INITIAL]);
  });

  it('a mentés utáni újraindítás mindkét listát kiüríti, a jelenlegi dokumentum marad', () => {
    const recorded = recordGraphEdit(recordGraphEdit(startGraphEditHistory(INITIAL), FIRST), SECOND);
    const undone = undoGraphEdit(recorded);
    expect(undone.undoStack).toHaveLength(1);
    expect(undone.redoStack).toHaveLength(1);
    const afterSave = startGraphEditHistory(undone.document);
    expect(afterSave.document).toBe(FIRST);
    expect(afterSave.undoStack).toEqual([]);
    expect(afterSave.redoStack).toEqual([]);
  });

  it('felső darabszám korlát nélkül minden lépést megtart', () => {
    let history = startGraphEditHistory(INITIAL);
    for (let index = 1; index <= 1000; index += 1) {
      history = recordGraphEdit(history, documentOf(node('a', index)));
    }
    expect(history.undoStack).toHaveLength(1000);
    for (let index = 0; index < 1000; index += 1) {
      history = undoGraphEdit(history);
    }
    expect(history.document).toBe(INITIAL);
  });

  describe('a mező menete (SPEC-008 5.10)', () => {
    it('az ugyanazon kulcsú, egymás utáni változások egy lépéssé vonódnak össze', () => {
      let history = startGraphEditHistory(INITIAL);
      history = recordGraphEdit(history, documentOf(node('a', 1)), FIELD_SESSION);
      history = recordGraphEdit(history, documentOf(node('a', 2)), FIELD_SESSION);
      history = recordGraphEdit(history, documentOf(node('a', 3)), FIELD_SESSION);
      expect(history.undoStack).toEqual([INITIAL]);
      expect(history.openSessionKey).toBe('field:a');
      expect(undoGraphEdit(history).document).toBe(INITIAL);
    });

    it('a menet lezárása után a következő változás új lépés', () => {
      let history = startGraphEditHistory(INITIAL);
      history = recordGraphEdit(history, FIRST, FIELD_SESSION);
      history = closeGraphEditSession(history);
      expect(history.openSessionKey).toBeUndefined();
      history = recordGraphEdit(history, SECOND, FIELD_SESSION);
      expect(history.undoStack).toEqual([INITIAL, FIRST]);
    });

    it('nyitott menet nélkül a lezárás ugyanazt az objektumot adja', () => {
      const history = recordGraphEdit(startGraphEditHistory(INITIAL), FIRST);
      expect(closeGraphEditSession(history)).toBe(history);
    });

    it('más kulcsú menet és menet nélküli változás is új lépést kezd, és a menetet lezárja', () => {
      let history = startGraphEditHistory(INITIAL);
      history = recordGraphEdit(history, FIRST, FIELD_SESSION);
      history = recordGraphEdit(history, SECOND, { key: 'field:b', isFinal: false });
      expect(history.undoStack).toEqual([INITIAL, FIRST]);
      expect(history.openSessionKey).toBe('field:b');
      history = recordGraphEdit(history, INITIAL);
      expect(history.undoStack).toEqual([INITIAL, FIRST, SECOND]);
      expect(history.openSessionKey).toBeUndefined();
    });

    it('a visszavonás a nyitott menetet lezárja: utána az azonos kulcsú változás új lépés', () => {
      const opened = recordGraphEdit(recordGraphEdit(startGraphEditHistory(INITIAL), FIRST), SECOND, FIELD_SESSION);
      const undone = undoGraphEdit(opened);
      expect(undone.openSessionKey).toBeUndefined();
      const changedAgain = recordGraphEdit(undone, SECOND, FIELD_SESSION);
      expect(changedAgain.undoStack).toEqual([INITIAL, FIRST]);
      expect(redoGraphEdit(undoGraphEdit(changedAgain)).openSessionKey).toBeUndefined();
    });
  });

  describe('a húzás (SPEC-008 5.10)', () => {
    it('a húzás közbeni változások és a záró változás egy lépés, utána a következő húzás új lépés', () => {
      let history = startGraphEditHistory(INITIAL);
      history = recordGraphEdit(history, documentOf(node('a', 1)), DRAG_MOVE);
      history = recordGraphEdit(history, documentOf(node('a', 2)), DRAG_MOVE);
      history = recordGraphEdit(history, documentOf(node('a', 3)), DRAG_END);
      expect(history.undoStack).toEqual([INITIAL]);
      expect(history.openSessionKey).toBeUndefined();

      const afterEnd = history.document;
      history = recordGraphEdit(history, documentOf(node('a', 4)), DRAG_MOVE);
      history = recordGraphEdit(history, documentOf(node('a', 5)), DRAG_END);
      expect(history.undoStack).toEqual([INITIAL, afterEnd]);
    });

    it('nyitott menet nélküli záró változás (billentyűs mozgatás) önálló lépés', () => {
      const history = recordGraphEdit(
        recordGraphEdit(startGraphEditHistory(INITIAL), FIRST, DRAG_END),
        SECOND,
        DRAG_END,
      );
      expect(history.undoStack).toEqual([INITIAL, FIRST]);
      expect(history.openSessionKey).toBeUndefined();
    });
  });
});
