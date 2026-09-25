import { isLayoutSizePair } from '../graph-editor/graph-editor-layout.ts';

/**
 * A futás nézet transcript oldalán a transcript és a jóváhagyás szövege közti
 * húzható elválasztó perzisztált aránya (user döntés 2026-09-25: "húzható
 * elválasztó ... kezdetben felén, és a beállítás megmarad"), a panelek
 * sorrendjében: az első érték a transcripté, a második a jóváhagyás
 * szövegéé (a CLI sorrend, 2026-09-25). Ugyanaz a minta,
 * mint a két meglévő elosztásé (`graph-editor-layout.ts`,
 * `run-view-layout.ts`): `egg` előtagú, camelCase kulcs, a meglévő
 * `isLayoutSizePair` typeguard, és `try`/`catch` mindkét irányban.
 *
 * A kulcs SZÁNDÉKOSAN külön a gráf és a transcript arányáétól
 * (`eggRunViewLayout`): a kettő két különböző elosztás, az egyiken beállított
 * arány a másikra nem értelmes.
 *
 * **A kulcs új, a régi (`eggRunViewApprovalLayout`) értéke figyelmen kívül
 * marad** (2026-09-25). A régi kulcs alatt a CLI sorrend (`2743b6b`) előtt a
 * pár fordított sorrendben (jóváhagyás, transcript) állt, utána ugyanazon a
 * kulcson már a mostaniban, tehát a régi érték sorrendje nem dönthető el: egy
 * egyszeri átfordítás a `2743b6b` után mentett arányt rontaná el. Az új kulcs
 * a nevében is a sorrendet mondja; a régi kulcson maradt érték senkit nem
 * olvas, a következő húzás az új kulcsra ír.
 */
export const RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY = 'eggRunViewTranscriptApprovalLayout';

/**
 * A kezdő arány, amikor nincs tárolt érték: a transcript és a jóváhagyás
 * szövege fele-fele (user döntés 2026-09-25: "kezdetben felén").
 */
export const DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES: readonly number[] = [50, 50];

/**
 * A tárolt arány, vagy az alapértelmezés. A `try`/`catch` kötelező: privát
 * ablakban és letiltott tárolás mellett már a `localStorage` elérése is
 * dobhat (`SecurityError`), a `JSON.parse` pedig hibás szövegre dob. Egyik
 * eset sem törheti el a felületet, mindkettő az alapértelmezésre esik vissza.
 */
export function readStoredRunViewApprovalLayoutSizes(): readonly number[] {
  try {
    const raw = globalThis.localStorage.getItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY);
    if (typeof raw !== 'string') {
      return DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES;
    }
    const parsed: unknown = JSON.parse(raw);
    return isLayoutSizePair(parsed) ? parsed : DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES;
  } catch {
    return DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES;
  }
}

/**
 * Az arány elmentése. A `try`/`catch` itt is kötelező, ugyanazzal az
 * indokkal: a `setItem` privát ablakban, letiltott tárolás mellett és tele
 * kvóta esetén is dobhat. A mentés elmaradása nem hiba a felhasználó felé,
 * csak annyit jelent, hogy a következő betöltés az alapértelmezéssel indul.
 */
export function storeRunViewApprovalLayoutSizes(sizes: readonly number[]): void {
  try {
    globalThis.localStorage.setItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Szándékosan elnyelt: a perzisztálás legjobb szándékú, nem kötelező.
  }
}
