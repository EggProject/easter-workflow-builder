import { useEffect } from 'react';
import { resolveUndoShortcut, type UndoShortcutAction } from './resolve-undo-shortcut.ts';

/**
 * A szerkesztő visszavonás billentyűinek figyelője (SPEC-008 5.10): a
 * hívó képernyő élettartama alatt a dokumentum `keydown` eseményén áll. A
 * döntés a `resolveUndoShortcut` szűrőé; a kezelt billentyűn `preventDefault()`
 * fut, a nem kezelt érintetlen (3. szabály). Az `onShortcut` hivatkozásának
 * stabilnak kell lennie, különben a figyelő minden renderen újra kötődik.
 */
export function useUndoRedoShortcut(onShortcut: (action: UndoShortcutAction) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const action = resolveUndoShortcut(event);
      if (action === undefined) {
        return;
      }
      event.preventDefault();
      onShortcut(action);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onShortcut]);
}
