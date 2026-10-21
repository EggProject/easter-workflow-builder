import type { ReactElement } from 'react';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';

/**
 * A transcript lista betöltés alatti csontváza (SPEC-008 9. szekció 9. async
 * pontja): a lista helyén álló csontváz sorok, ismert sor alakkal. Két
 * helyen áll: a panelben, amíg a pótlás még egyetlen sort sem hozott, és a
 * futás nézetben, amíg a futás rekordja és a lépés futások még nem érkeztek
 * meg (a panel ezek nélkül nem dönthetné el, hogy az üres lista várakozás
 * vagy végleges). A két csontváz ugyanaz, hogy a két egymást követő ne
 * ugorjon. A sorok számának (4) forrása nincs igazolva (nyitott kérdés:
 * SPEC-008 O-35).
 */
export function TranscriptPanelSkeleton(): ReactElement {
  return (
    <div className="transcript-panel__loading">
      <ThemedSkeleton shape="text" lines={4} />
    </div>
  );
}
