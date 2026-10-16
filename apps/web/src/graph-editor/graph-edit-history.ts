import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * A szerkesztett dokumentum: a vászon és a mentés `PUT` törzsének csomópont és
 * él listája. Nézeti állapot (kiválasztás, mért méret, nagyítás) nincs benne,
 * tehát a visszavonás sem hat rájuk (SPEC-008 5.10).
 */
export interface GraphEditorDocument {
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
}

/**
 * Egy összevonható szerkesztési menet: az azonos kulcsú, egymás után érkező
 * változások egyetlen visszavonható lépést adnak (a húzás a végéig, a mező a
 * `blur`-ig, SPEC-008 5.10). Az `isFinal` változás a menet utolsó tagja, utána
 * a következő azonos kulcsú változás már új lépés.
 */
export interface GraphEditSession {
  readonly key: string;
  readonly isFinal: boolean;
}

/**
 * A lineáris visszavonás története (SPEC-008 5.10): a jelenlegi dokumentum, a
 * visszavonás lista a korábbi, az újra lista a visszavont dokumentumokkal, és a
 * nyitott szerkesztési menet kulcsa. Felső darabszám korlát nincs, mert a
 * számra nincs forrás (`.claude/CLAUDE.md` 4. szekció 1. pont).
 */
export interface GraphEditHistory {
  readonly document: GraphEditorDocument;
  readonly undoStack: readonly GraphEditorDocument[];
  readonly redoStack: readonly GraphEditorDocument[];
  readonly openSessionKey: string | undefined;
}

/**
 * Üres listákkal induló történet a kiinduló dokumentumról: a betöltés és a
 * sikeres mentés után (mentés után mindkét lista kiürül, user döntés). A
 * visszavonás ennél korábbra nem lép.
 */
export function startGraphEditHistory(document: GraphEditorDocument): GraphEditHistory {
  return { document, undoStack: [], redoStack: [], openSessionKey: undefined };
}

/**
 * Egy gráf változás rögzítése. Ha a változás a nyitott menetet folytatja, a
 * visszavonás lista nem nő, csak a dokumentum cserélődik; különben a korábbi
 * dokumentum a lista végére kerül. Az újra lista mindkét esetben üres: egy új
 * változás mellett a visszavont ág nem állhat fenn egy lineáris listában, és
 * egy folytatott menet indulásakor már kiürült.
 */
export function recordGraphEdit(
  history: GraphEditHistory,
  nextDocument: GraphEditorDocument,
  session?: GraphEditSession,
): GraphEditHistory {
  const isSessionContinued = session !== undefined && session.key === history.openSessionKey;
  return {
    document: nextDocument,
    undoStack: isSessionContinued ? history.undoStack : [...history.undoStack, history.document],
    redoStack: [],
    openSessionKey: session === undefined || session.isFinal ? undefined : session.key,
  };
}

/**
 * A nyitott menet lezárása (a beállítás panel mezőjének elhagyása). Menet
 * nélkül ugyanazt az objektumot adja vissza, hogy a React állapot frissítése
 * újrarenderelés nélkül maradjon.
 */
export function closeGraphEditSession(history: GraphEditHistory): GraphEditHistory {
  return history.openSessionKey === undefined ? history : { ...history, openSessionKey: undefined };
}

/**
 * Visszavonás: a legutóbbi korábbi dokumentum lesz a jelenlegi, a jelenlegi az
 * újra lista végére kerül, a nyitott menet lezárul. Üres listánál a történet
 * változatlan.
 */
export function undoGraphEdit(history: GraphEditHistory): GraphEditHistory {
  const previous = history.undoStack.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    document: previous,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, history.document],
    openSessionKey: undefined,
  };
}

/**
 * Újra elvégzés: a legutóbb visszavont dokumentum lesz a jelenlegi, a jelenlegi
 * a visszavonás lista végére kerül. Üres listánál a történet változatlan.
 */
export function redoGraphEdit(history: GraphEditHistory): GraphEditHistory {
  const next = history.redoStack.at(-1);
  if (next === undefined) {
    return history;
  }
  return {
    document: next,
    undoStack: [...history.undoStack, history.document],
    redoStack: history.redoStack.slice(0, -1),
    openSessionKey: undefined,
  };
}
