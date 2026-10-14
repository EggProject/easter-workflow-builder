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
 * A React Flow törlés billentyű szűrőjének köre (`@xyflow/system`
 * `isInputDOMNode`, M-102, M-117): a beviteli elem, a `contenteditable` elem és
 * a `.nokey` osztályú elem vagy ős. A cél elem a `composedPath()` első eleme,
 * ugyanúgy, mint a könyvtárban.
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
 * A kezelt billentyűk, a módosítón kívüli állapot szerint: `Ctrl+Z` visszavon,
 * `Ctrl+Shift+Z` és `Ctrl+Y` újra elvégez (user döntés). A kulcs a `Shift`
 * állapota és a leütött karakter kisbetűs alakja, mert a `Shift` (és a
 * `CapsLock`) a `key` értékét nagybetűre váltja, a `Ctrl` viszont nem
 * (UI Events KeyboardEvent key Values).
 */
const SHORTCUT_ACTIONS = new Map<string, UndoShortcutAction>([
  ['z', 'undo'],
  ['shift+z', 'redo'],
  ['y', 'redo'],
]);

/**
 * A szerkesztő visszavonás billentyűjének szűrője (SPEC-008 5.10, 1. és 2.
 * szabály): beviteli célponton (a szöveg mező natív visszavonása marad) és nem
 * kezelt billentyűn `undefined`. Módosítóként kizárólag a `Ctrl` számít; a
 * `Meta` vagy az `Alt` mellett a billentyű nem kezelt. A beállítható módosító
 * a PLAN-009 T-009-58 lépése.
 */
export function resolveUndoShortcut(event: UndoShortcutKeyboardEvent): UndoShortcutAction | undefined {
  if (!event.ctrlKey || event.metaKey || event.altKey || isKeyboardInputTarget(event)) {
    return undefined;
  }
  return SHORTCUT_ACTIONS.get(`${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`);
}
