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
 * (`run-view-layout.ts`): a kettő két különböző elosztás, az egyiken
 * beállított arány a másikra nem értelmes.
 *
 * **A saját arány a kulcs megléte, és a kulcs ezért új** (2026-09-26, user
 * döntés 2026-09-25: "ha a user húzott, az ő aránya marad"). A kulcsra
 * kizárólag a felhasználó változtatása ír (a `Resizable` `onSizesChange`
 * 2026-09-25 óta csak arról értesít), tehát egy érvényes tárolt pár a
 * felhasználó döntése, egy pontosan az alapértelmezésre visszahúzott arány
 * is. **A két korábbi kulcs értéke nem olvasott:** az
 * `eggRunViewTranscriptApprovalLayout` kulcsra a `Resizable` 2026-09-25-ig
 * a kezdőértéket is írta, minden megnyitáskor, tehát felhasználói húzás
 * nélkül is az alapértelmezést tartalmazhatja
 * (`docs/research/2026-09-24-jovahagyas-panel-helye.md` 12.2 szekció); az
 * `eggRunViewApprovalLayout` kulcson a pár a CLI sorrend (`2743b6b`) előtt
 * fordított sorrendben (jóváhagyás, transcript) állt, utána ugyanott már a
 * mostaniban, tehát a sorrendje nem dönthető el. A régi kulcsokon maradt
 * értéket senki nem olvassa, a következő húzás az új kulcsra ír.
 */
export const RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY = 'eggRunViewTranscriptApprovalUserLayout';

/**
 * A kezdő arány, amikor nincs tárolt érték: a transcript és a jóváhagyás
 * szövege fele-fele (user döntés 2026-09-25: "kezdetben felén").
 */
export const DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES: readonly number[] = [50, 50];

/**
 * A felhasználó tárolt aránya, vagy `undefined`, ha nincs saját arány (a
 * hívó ilyenkor az alapértelmezést használja, és az elválasztó egy függő
 * jóváhagyás kedvéért ideiglenesen elmozdulhat). A `try`/`catch` kötelező:
 * privát ablakban és letiltott tárolás mellett már a `localStorage` elérése
 * is dobhat (`SecurityError`), a `JSON.parse` pedig hibás szövegre dob. Egyik
 * eset sem törheti el a felületet; a hiányzó, a hibás és a rossz alakú érték
 * sem saját arány, mert a felhasználó írása mindig érvényes pár.
 */
export function readStoredRunViewApprovalLayoutSizes(): readonly number[] | undefined {
  try {
    const raw = globalThis.localStorage.getItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY);
    if (typeof raw !== 'string') {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    return isLayoutSizePair(parsed) ? parsed : undefined;
  } catch {
    return undefined;
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
