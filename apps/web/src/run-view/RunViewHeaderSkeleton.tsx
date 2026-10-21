import type { ReactElement } from 'react';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';

/**
 * A futás nézet fejlécének betöltés alatti csontváza (SPEC-008 9. szekció 7.
 * async pontja): a valódi fejléc három sorának alakját követi, a morzsasor
 * és a pillanatkép megjegyzés szöveg csontváza, a vezérlő sáv gomb csontváza.
 * A fejléc a futás rekordjából és a pillanatképből is olvas (az al-workflow
 * útvonal, a workflow neve, az SDK verzió), ezért a csontváz addig áll, amíg
 * mindkettő meg nem érkezett. A fejléc `RunViewHeader` osztályát viseli, tehát
 * az oldalsó térköz és a sorok közti távolság azonos.
 */
export function RunViewHeaderSkeleton(): ReactElement {
  return (
    <header className="run-view-screen__header" aria-busy="true">
      <ThemedSkeleton shape="text" w={240} />
      <ThemedSkeleton shape="text" w="60%" />
      <ThemedSkeleton shape="btn" />
    </header>
  );
}
