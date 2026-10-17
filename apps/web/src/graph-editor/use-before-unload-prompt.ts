import { useEffect } from 'react';

/**
 * A lap elhagyásának megerősítése (SPEC-008 5.10, 2. pont): amíg az
 * `isEnabled` igaz, a `beforeunload` figyelő `preventDefault()` hívással a
 * böngésző saját párbeszédét kéri (M-114). Hamis értéknél figyelő nincs, mert
 * az MDN a figyelőt csak mentetlen változás idejére ajánlja felvenni. A
 * párbeszéd szövegét a böngésző adja.
 */
export function useBeforeUnloadPrompt(isEnabled: boolean): void {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEnabled]);
}
