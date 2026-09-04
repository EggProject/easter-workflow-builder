import type { RefObject } from 'react';

/**
 * A menü panel DOM elemét adja vissza a reactref-ből, feltétel nélkül.
 *
 * A `panelReference.current` típusa `HTMLDivElement | null`, de a
 * gyakorlatban SOHA nem `null` a `Menu.tsx` hívási pontjain: a panel `<div>`
 * mindig renderelve van, csak a `hidden` attribútum rejti zárt állapotban
 * (lásd `Menu.tsx`) - a `null` ág a komponensen keresztül nem idézhető elő.
 * Egy `if (panel === null) return;` ág a hívási helyen ezért egy soha nem
 * futó, tesztelhetetlen branch-et vinne be, ami a SPEC-003 12.4 szekció
 * 100 százalékos, kizárás nélküli lefedettségi küszöbét sértené. Ide
 * kiemelve a `null` eset szintetikus bemenettel közvetlenül tesztelhető -
 * ugyanaz a minta, mint a `packages/db`
 * `run-event/event-record/extract-error-cause.ts`-e.
 */
export function readPanelElement(panelReference: RefObject<HTMLDivElement | null>): HTMLDivElement {
  const panel = panelReference.current;
  if (panel === null) {
    throw new Error('a menü panel nincs csatolva a DOM-hoz');
  }
  return panel;
}
