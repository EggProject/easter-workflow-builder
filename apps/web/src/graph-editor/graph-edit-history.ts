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
 * kiinduló dokumentum, a visszavonás lista a korábbi, az újra lista a
 * visszavont dokumentumokkal, és a nyitott szerkesztési menet kulcsa. Felső
 * darabszám korlát nincs, mert a számra nincs forrás (`.claude/CLAUDE.md` 4.
 * szekció 1. pont).
 */
export interface GraphEditHistory {
  readonly document: GraphEditorDocument;
  /**
   * A kiinduló dokumentum: a betöltés, illetve a legutóbbi sikeres mentés
   * utáni dokumentum. A változtatások elvetése erre állít vissza.
   */
  readonly initialDocument: GraphEditorDocument;
  readonly undoStack: readonly GraphEditorDocument[];
  readonly redoStack: readonly GraphEditorDocument[];
  readonly openSessionKey: string | undefined;
}

/**
 * Üres listákkal induló történet: a betöltés és a sikeres mentés után (mentés
 * után mindkét lista kiürül, user döntés). A visszavonás a jelenlegi
 * dokumentumnál korábbra nem lép. A kiinduló dokumentum alapból a jelenlegi;
 * mentés után a mentett dokumentum, ami a mentés futása alatti szerkesztés
 * miatt eltérhet a jelenlegitől (SPEC-008 5.10, "A kiinduló dokumentum").
 */
export function startGraphEditHistory(
  document: GraphEditorDocument,
  initialDocument: GraphEditorDocument = document,
): GraphEditHistory {
  return { document, initialDocument, undoStack: [], redoStack: [], openSessionKey: undefined };
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
    initialDocument: history.initialDocument,
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
    initialDocument: history.initialDocument,
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
    initialDocument: history.initialDocument,
    undoStack: [...history.undoStack, history.document],
    redoStack: history.redoStack.slice(0, -1),
    openSessionKey: undefined,
  };
}

/**
 * Eltér-e a jelenlegi dokumentum a kiinduló dokumentumtól: a "Változtatások
 * elvetése" menüpont ekkor választható (SPEC-008 5.10). A `JSON.stringify`
 * összehasonlítás elég, mert mindkét oldal ugyanazon a leképezési láncon megy
 * át, tehát a mezők sorrendje azonos (`is-graph-dirty.ts`).
 */
export function canDiscardGraphEdits(history: GraphEditHistory): boolean {
  return JSON.stringify(history.document) !== JSON.stringify(history.initialDocument);
}

/**
 * A változtatások elvetése (SPEC-008 5.10): a jelenlegi dokumentum a kiinduló
 * dokumentumra áll vissza, egyetlen visszavonható lépésként, tehát egy
 * visszavonás a változásokat visszahozza.
 */
export function discardGraphEdits(history: GraphEditHistory): GraphEditHistory {
  return recordGraphEdit(history, history.initialDocument);
}
