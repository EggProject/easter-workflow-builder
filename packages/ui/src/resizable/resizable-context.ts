import { createContext } from 'react';

/**
 * A `Resizable` állapota és vezérlői, amiket a `ResizablePanel` és a
 * `ResizableHandle` a saját renderelésükhöz és eseménykezelőikhöz olvasnak.
 */
export interface ResizableContextValue {
  readonly sizes: readonly number[];
  /**
   * A panelek pixeles minimuma százalékban a legutóbbi mérés szerint
   * (`measure-panel-geometry.ts`); üres, amíg nincs mérés.
   */
  readonly minSizePercents: readonly number[];
  readonly direction: 'horizontal' | 'vertical';
  /**
   * A jelenleg húzott (vagy fókuszált, húzás alatt lévő) elválasztó
   * sorszáma, -1 ha nincs ilyen.
   */
  readonly activeHandleIndex: number;
  readonly panelDomId: (index: number) => string;
  /**
   * A `ResizablePanel` ezen jelenti a kirajzolt DOM elemét (és leszereléskor
   * a `null` értéket), hogy a `Resizable` megmérhesse.
   */
  readonly registerPanel: (index: number, element: HTMLDivElement | null) => void;
  readonly beginDrag: (handleIndex: number, clientPos: number) => void;
  readonly resizeByDelta: (handleIndex: number, deltaPercent: number) => void;
  readonly toggleCollapse: (handleIndex: number) => void;
  /**
   * A panelek újramérése és a méretek igazítása a mért minimumhoz (az
   * elválasztó fókuszakor, hogy a felolvasott érték friss legyen).
   */
  readonly refreshGeometry: () => void;
  /**
   * Egy beágyazott `Resizable` felfedési kérése (2026-09-25, `plan-reveal.ts`):
   * a `requester` csoportot tartó panel nőjön `deltaPixels` pixellel a mai
   * méretéhez képest. Visszaadja, mennyivel változott a panel ténylegesen;
   * nulla, ha a csoport nem mozdulhat (saját arány, a felhasználó már húzta,
   * vagy a kérő más tengelyen áll). Ideiglenes: nem értesít, és az `endReveal`
   * visszaállítja.
   */
  readonly resizeForReveal: (
    requester: Element,
    deltaPixels: number,
    requesterDirection: 'horizontal' | 'vertical',
  ) => number;
  /**
   * A felfedés vége: a felfedés előtti méretek visszaállnak, ha a
   * felhasználó közben nem húzta az elválasztót.
   */
  readonly endReveal: () => void;
}

/**
 * Alapérték: no-op burkoló, hogy egy `Resizable`-n kívül renderelt
 * `ResizablePanel`/`ResizableHandle` (pl. önálló tesztben) ne dobjon hibát -
 * ugyanaz a minta, mint a `menu-close-context.ts` no-op alapértéke.
 */
const NOOP_CONTEXT_VALUE: ResizableContextValue = {
  sizes: [],
  minSizePercents: [],
  direction: 'horizontal',
  activeHandleIndex: -1,
  panelDomId: (index) => `resizable-panel-${String(index)}`,
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  registerPanel: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  beginDrag: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  resizeByDelta: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  toggleCollapse: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  refreshGeometry: () => {},
  // Befoglaló `Resizable` nélkül nincs, ami helyet adjon egy felfedésnek.
  resizeForReveal: () => 0,
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  endReveal: () => {},
};

export const ResizableContext = createContext<ResizableContextValue>(NOOP_CONTEXT_VALUE);
