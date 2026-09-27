import { readPixels } from './read-pixels.ts';

/**
 * Egy panelbe ágyazott, FÜGGŐLEGES `Resizable` csoport saját, teljes
 * pixeles minimuma: a csoport közvetlen `.resizable-panel` gyerekeinek CSS
 * `min-height` értéke összesen. Nulla, ha a panelben nincs ilyen beágyazott
 * csoport. Közvetlen gyerek, nem `querySelectorAll` mélyen: egy harmadik
 * szintű beágyazás (a projektben ma nincs) duplán számolná a közbülső
 * csoport paneljeinek minimumát.
 */
function measureNestedVerticalGroupMinimumPixels(panel: Element): number {
  const nestedGroup = panel.querySelector('.resizable-group--vertical');
  if (nestedGroup === null) {
    return 0;
  }
  let total = 0;
  for (const child of nestedGroup.children) {
    if (child.classList.contains('resizable-panel')) {
      total += readPixels(globalThis.getComputedStyle(child).minHeight);
    }
  }
  return total;
}

/**
 * Egy elem tartalom szerinti minimális szélessége, a jelenlegi
 * elrendezéstől függetlenül: a `width` ideiglenes `max-content` felülírásával
 * mérve, majd azonnal, szinkron visszaállítva (nincs köztes festés).
 *
 * Miért kell: az elem a keresztirányú tengelyen (egy függőleges flex
 * konténer szélessége) `align-items: stretch` alatt a befoglalója
 * szélességére nyúlik, amíg belefér. A natúr `getBoundingClientRect()` ezért
 * csak akkor mutatná a valódi minimumot, ha már túlnyúlik a befoglalóján; egy
 * még nem szűkített panelnél a MAI szélességet adná a szükséges helyett, és a
 * `Resizable` húzása az aktuális méreten ragadna be (a mért minimum minden
 * húzási lépés előtt újraszámol, `Resizable.tsx` `refreshGeometry`).
 */
function measureIntrinsicWidthPixels(element: HTMLElement): number {
  const previousInlineWidth = element.style.width;
  element.style.width = 'max-content';
  const width = element.getBoundingClientRect().width;
  element.style.width = previousInlineWidth;
  return width;
}

/**
 * Egy panel tartalom alapú kiegészítő minimuma pixelben (SPEC-008 8. és 10.
 * szekció, O-13, user döntés 2026-09-27): a `regionElementId` elem a panel
 * FIX, nem húzható tartalma (a futás nézetben a lapozó és a döntés
 * akciósávja, az eredménnyel vagy hibával együtt), tehát a mérete a panel
 * minimumához adódik, hogy a régió a panel semelyik méretén se vágódjon le.
 * Nulla, ha az elem nincs a DOM-ban (nincs függő jóváhagyás).
 *
 * **Függőleges csoportban** (a panel a csoport MAGASSÁGÁÉRT felel): a régió
 * NEM zsugorodik a natúr magassága alá (a flex fő tengelyén nincs
 * `flex-grow`, az automatikus minimum a tartalom mérete, mert az `overflow`
 * rajta `visible`), tehát a `getBoundingClientRect().height` a jelenlegi
 * mérettől függetlenül stabil. Ehhez adódik a panelbe ágyazott, ugyanazon a
 * tengelyen álló `Resizable` csoport saját minimuma (a transcript és a
 * jóváhagyás szövege közötti elválasztó két paneljének együttes CSS
 * minimuma), mert az a régió FÖLÖTT, a panel MARADÉK helyén áll.
 *
 * **Vízszintes csoportban** (a panel a csoport SZÉLESSÉGÉÉRT felel): a régió
 * a kereszttengelyen nyújtva jelenik meg, tehát a natúr szélessége csak
 * `max-content` méréssel érhető el (`measureIntrinsicWidthPixels`); a
 * beágyazott csoport ilyenkor MÁS tengelyen áll (a jóváhagyás elválasztója
 * függőleges), a szélességéhez nem ad hozzá.
 */
export function measureContentMinimumPixels(panel: Element, regionElementId: string, isVertical: boolean): number {
  const region = globalThis.document.querySelector<HTMLElement>(`#${CSS.escape(regionElementId)}`);
  if (region === null) {
    return 0;
  }
  if (!isVertical) {
    return measureIntrinsicWidthPixels(region);
  }
  return region.getBoundingClientRect().height + measureNestedVerticalGroupMinimumPixels(panel);
}
