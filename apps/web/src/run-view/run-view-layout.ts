import { isLayoutSizePair } from '../graph-editor/graph-editor-layout.ts';

/**
 * A futás nézet osztott elrendezésének perzisztált, a FELHASZNÁLÓ által
 * beállított aránya. Ugyanaz a minta, ami a gráf szerkesztőben már bevált
 * (`graph-editor-layout.ts`), ugyanazzal a kulcs betűzési konvencióval (`egg`
 * előtag, utána a beállítás neve camelCase alakban), és ugyanazzal a
 * `try`/`catch` védelemmel mindkét irányban. A typeguard NEM új: a
 * szerkesztő már tesztelt `isLayoutSizePair` guardját használjuk, mert a
 * kérdés ugyanaz (a szabálykönyv 5. szekciója a meglévő guard újraírását
 * tiltja).
 *
 * A kulcs SZÁNDÉKOSAN külön a szerkesztőétől: a két képernyő két különböző
 * osztott elrendezés (vászon plusz beállítás panel, illetve gráf plusz
 * transcript), tehát az egyiken beállított arány a másikra nem értelmes.
 *
 * **A saját arány a kulcs megléte** (2026-09-26, user döntés 2026-09-25: "ha
 * a user húzott, az ő aránya marad"). A kulcsra kizárólag a felhasználó
 * változtatása ír (a `Resizable` `onSizesChange` 2026-09-25 óta csak arról
 * értesít), tehát egy érvényes tárolt pár a felhasználó döntése, egy
 * pontosan az alapértelmezésre visszahúzott arány is. **A kulcs új, a régi
 * (`eggRunViewLayout`) értéke nem olvasott**: a `Resizable` 2026-09-25-ig a
 * kezdőértéket is a tárolóba írta, minden megnyitáskor, tehát a régi kulcs
 * az alapértelmezést felhasználói húzás nélkül is tartalmazhatja
 * (`docs/research/2026-09-24-jovahagyas-panel-helye.md` 12.2 szekció).
 */
export const RUN_VIEW_LAYOUT_STORAGE_KEY = 'eggRunViewUserLayout';

/**
 * A kezdő arány, amikor nincs tárolt érték: a gráf kapja a nagyobb részt.
 *
 * MIÉRT EZ A KÉT SZÁM. Egyrészt szó szerint ugyanaz, ami a gráf szerkesztő
 * szállított alapértelmezése (`DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES`): a
 * SPEC-008 10. szekciója kimondja, hogy a két képernyő ugyanazzal a
 * `Resizable` komponenssel, egyformán viselkedik, tehát az arányuk sem tér
 * el indok nélkül. Másrészt MÉRT alsó korlát is van: a React Flow `minZoom`
 * alapértelmezése `0.5`, a `fitView` pedig
 * `zoom = szélesség / (tartalom * (1 + padding))` alakban számol, tehát a
 * bemutató gráf 1582 pixeles tartalmi szélességéhez az 1440 pixeles
 * referencia ablakon legalább 1582 * 0.5 * 1.1 = 870 pixel, azaz a
 * szélesség kb. 61 százaléka kell, különben a nézet a `minZoom`-on megáll és
 * a gráf jobb széle levágódik (`apps/web/e2e/showcase-graph.ts` számítása,
 * `docs/research/2026-09-09-graf-el-vonal-meres.md` 6. szekció).
 */
export const DEFAULT_RUN_VIEW_LAYOUT_SIZES: readonly number[] = [70, 30];

/**
 * A felhasználó tárolt aránya, vagy `undefined`, ha nincs saját arány (a
 * hívó ilyenkor az alapértelmezést használja, és az elválasztó egy függő
 * jóváhagyás kedvéért ideiglenesen elmozdulhat). A `try`/`catch` kötelező:
 * privát ablakban és letiltott tárolás mellett már a `localStorage` elérése
 * is dobhat (`SecurityError`), a `JSON.parse` pedig hibás szövegre dob. Egyik
 * eset sem törheti el a felületet; a hiányzó, a hibás és a rossz alakú érték
 * sem saját arány, mert a felhasználó írása mindig érvényes pár.
 */
export function readStoredRunViewLayoutSizes(): readonly number[] | undefined {
  try {
    const raw = globalThis.localStorage.getItem(RUN_VIEW_LAYOUT_STORAGE_KEY);
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
export function storeRunViewLayoutSizes(sizes: readonly number[]): void {
  try {
    globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Szándékosan elnyelt: a perzisztálás legjobb szándékú, nem kötelező.
  }
}
