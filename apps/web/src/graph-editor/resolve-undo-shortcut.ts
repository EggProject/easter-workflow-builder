import type { UndoModifier } from './resolve-undo-modifier.ts';

/**
 * A visszavonás billentyű művelete (SPEC-008 5.10).
 */
export type UndoShortcutAction = 'undo' | 'redo';

/**
 * A billentyű esemény mezői, amikből a döntés áll. A `code` mező szándékosan
 * nincs benne: a fizikai billentyű kiosztásonként más karaktert jelenthet
 * (M-116), a döntés a leütött karakteren (`key`) áll.
 */
export type UndoShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'composedPath'
>;

/**
 * A szerkesztő állapota, amiből a döntés áll a billentyű eseményen kívül.
 */
export interface UndoShortcutState {
  /**
   * Fut-e a mentés (SPEC-008 5.10, 5. szabály).
   */
  readonly isSaving: boolean;
  /**
   * Nyitva van-e az elnavigálás megerősítő modálisa (SPEC-008 5.10, 4. szabály).
   */
  readonly isNavigationConfirmationOpen: boolean;
  /**
   * A beállított, feloldott módosító (SPEC-008 5.10, O-31).
   */
  readonly modifier: UndoModifier;
}

/**
 * A React Flow törlés billentyű szűrőjének köre (`@xyflow/system`
 * `isInputDOMNode`, M-102, M-117): a beviteli elem, a `contenteditable` elem és
 * a `.nokey` osztályú elem vagy ős. A cél elem a `composedPath()` első eleme,
 * ugyanúgy, mint a könyvtárban. A `.nokey` osztály nem szerepel a reactflow.dev
 * API referenciájában (keresés alapján, nem ellenőrzött kimerítően); a
 * viselkedés forrása a telepített `@xyflow/system` 0.0.82 `dist/esm/index.js`
 * 914-923. sora és a karbantartói ajánlás (xyflow/xyflow #2254), a regressziót
 * az `apps/web/e2e/graph-node-delete.spec.ts` őrzi.
 */
const INPUT_TAG_NAMES: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isKeyboardInputTarget(event: UndoShortcutKeyboardEvent): boolean {
  const target = event.composedPath()[0];
  return (
    target instanceof Element &&
    (INPUT_TAG_NAMES.has(target.nodeName) ||
      target.hasAttribute('contenteditable') ||
      target.closest('.nokey') !== null)
  );
}

/**
 * Pontosan a beállított módosító van lenyomva: `ctrl` esetén a `ctrlKey`,
 * `meta` esetén a `metaKey` (M-120), és a másik nincs (SPEC-008 5.10, 2.
 * szabály).
 */
function isOnlyModifierPressed(event: UndoShortcutKeyboardEvent, modifier: UndoModifier): boolean {
  return modifier === 'ctrl' ? event.ctrlKey && !event.metaKey : event.metaKey && !event.ctrlKey;
}

/**
 * A kezelt billentyűk, a módosítón kívüli állapot szerint: a módosító+Z
 * visszavon, a módosító+Shift+Z és a módosító+Y újra elvégez (user döntés).
 * A kulcs a `Shift` állapota és a leütött karakter kisbetűs alakja, mert a
 * `Shift` (és a `CapsLock`) a `key` értékét nagybetűre váltja, a `Ctrl` és a
 * `Meta` viszont nem (UI Events KeyboardEvent key Values).
 */
const SHORTCUT_ACTIONS = new Map<string, UndoShortcutAction>([
  ['z', 'undo'],
  ['shift+z', 'redo'],
  ['y', 'redo'],
]);

/**
 * A szerkesztő visszavonás billentyűjének szűrője (SPEC-008 5.10, 1., 2., 4. és 5.
 * szabály): beviteli célponton (a szöveg mező natív visszavonása marad), nem
 * kezelt billentyűn és a mentés futása alatt `undefined`, ugyanúgy, ahogy a
 * mentés alatt a két gomb is tiltott (user döntés 2026-10-16). Módosítóként
 * kizárólag a beállított módosító számít (O-31): a másik módosító vagy az
 * `Alt` mellett a billentyű nem kezelt.
 */
export function resolveUndoShortcut(
  event: UndoShortcutKeyboardEvent,
  state: UndoShortcutState,
): UndoShortcutAction | undefined {
  if (state.isSaving || !isOnlyModifierPressed(event, state.modifier) || event.altKey || isKeyboardInputTarget(event)) {
    return undefined;
  }
  // 4. szabály: nyitott megerősítő modálisnál a billentyű nem kezelt, tehát a
  // `preventDefault()` sem fut.
  if (state.isNavigationConfirmationOpen) {
    return undefined;
  }
  return SHORTCUT_ACTIONS.get(`${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`);
}
