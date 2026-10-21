import type { ReactElement } from 'react';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';

/**
 * A futás nézet gráf panelének betöltés alatti csontváza (SPEC-008 9.
 * szekció 6. async pontja, user döntés 2026-10-21): a pillanatkép
 * megérkezéséig a panel teljes területét kitöltő egyetlen csontváz áll, a
 * `RunGraphCanvas` helyén, tehát a panel mérete ismert, és a betöltés végén
 * nem ugrik a layout. A méretet a `run-view.css` adja.
 */
export function RunViewGraphSkeleton(): ReactElement {
  return (
    <div className="run-view-screen__graph-loading" aria-busy="true">
      <ThemedSkeleton shape="block" />
    </div>
  );
}
