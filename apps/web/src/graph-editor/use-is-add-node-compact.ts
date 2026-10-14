import { useSyncExternalStore } from 'react';
import { ADD_NODE_COMPACT_MEDIA_QUERY } from './add-node-compact-media-query.ts';

function subscribe(onStoreChange: () => void): () => void {
  const media = globalThis.matchMedia(ADD_NODE_COMPACT_MEDIA_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => {
    media.removeEventListener('change', onStoreChange);
  };
}

function isCompactViewport(): boolean {
  return globalThis.matchMedia(ADD_NODE_COMPACT_MEDIA_QUERY).matches;
}

/**
 * Igaz, ha a viewport a `--ep-screen-sm` token alatt vagy azon áll, tehát a
 * "Hozzáadás" gomb csak ikonos alakja jár (SPEC-008 5.8). A `matchMedia` a
 * böngésző saját viewport modelljét olvassa, az `innerWidth` saját
 * összehasonlítása nem helyettesíti. Az esemény kezelés
 * `addEventListener('change', ...)` alakú, a deprecated `addListener` helyett
 * (MDN: <https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/addListener>).
 */
export function useIsAddNodeCompact(): boolean {
  return useSyncExternalStore(subscribe, isCompactViewport, isCompactViewport);
}
