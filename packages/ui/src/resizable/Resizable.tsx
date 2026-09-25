import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import './resizable.css';
import { computeDragDeltaPercent } from './compute-drag-delta-percent.ts';
import { measurePanelGeometry, type PanelGeometry } from './measure-panel-geometry.ts';
import { ResizableContext, type ResizableContextValue } from './resizable-context.ts';
import { resizeAt } from './resize-at.ts';

export interface ResizableProperties {
  readonly children: ReactNode;
  readonly direction?: 'horizontal' | 'vertical';
  /**
   * A panelek kezdő mérete százalékban, panelenként. Kötelező: a komponens
   * nem találja ki az arányt, a hívó adja meg (Simplicity First - nincs
   * automatikus egyenlő elosztás, amit a forrás `Resizable.jsx` a gyerekek
   * darabszámából számolt volna).
   */
  readonly defaultSizes: readonly number[];
  /**
   * A panelméretek minden változásánál meghívódik, a kezdő renderen is.
   * Kizárólag ÉRTESÍTÉS: a méretet továbbra is a komponens tartja, a hívó
   * ebből legfeljebb perzisztálni tud (a gráf szerkesztő a
   * `localStorage`-be írja, felhasználói kérés 2026-09-09). Vezérelt
   * `sizes` prop szándékosan NINCS: az a komponens teljes állapotkezelését
   * kifordítaná, holott egyetlen fogyasztónak sem kell kívülről beállítania
   * a méretet a kezdőérték után.
   */
  readonly onSizesChange?: (sizes: readonly number[]) => void;
}

interface DragState {
  readonly handleIndex: number;
  readonly startClientPos: number;
  readonly totalSizePixels: number;
  readonly startSizes: readonly number[];
  readonly minSizePercents: readonly number[];
}

/**
 * A `ResizableHandle` `Enter` billentyűje ide/innen csomagolja össze/ki a
 * panelt (T-009-11, dokumentált eltérés a W3C Window Splitter mintától, ami
 * az `Enter`-t nem sorolja fel).
 */
const COLLAPSED_SIZE_PERCENT = 5;
/**
 * Ha nincs korábban feljegyzett kibontott méret (a panel már összecsomagolva
 * indult), erre a méretre nyílik vissza.
 */
const DEFAULT_RESTORE_SIZE_PERCENT = 50;

/**
 * Összecsomagolt a panel, ha a mért minimumán (vagy a forrás 5 százalékán)
 * áll: egy pixeles minimumú panel ennél kisebb nem lehet.
 */
function isCollapsed(sizePercent: number, minSizePercent: number): boolean {
  return sizePercent <= Math.max(COLLAPSED_SIZE_PERCENT, minSizePercent);
}

/**
 * Minden elválasztó két szomszédját a mért minimumokhoz igazítja (nulla
 * eltolással a `resizeAt` csak a határra vág).
 */
function clampToMinimums(sizes: readonly number[], minSizePercents: readonly number[]): readonly number[] {
  let clamped = sizes;
  for (let handleIndex = 0; handleIndex < sizes.length - 1; handleIndex += 1) {
    clamped = resizeAt(clamped, handleIndex, 0, minSizePercents);
  }
  return clamped;
}

function isSameSizes(first: readonly number[], second: readonly number[]): boolean {
  return first.every((size, index) => size === second[index]);
}

/**
 * Az `eggproject-design-components` `resizable` komponensének portja
 * (SPEC-007 6.2 négy szabálya, PLAN-009 T-009-11). A forrás `Resizable.jsx`
 * `Children.toArray`-jal maga szúrta be a handle-öket a panelek közé; ez a
 * port helyette explicit összetételt vár (`<Resizable><ResizablePanel
 * index={0}/><ResizableHandle beforeIndex={0}/><ResizablePanel
 * index={1}/></Resizable>`), mert ez tesztelhetőbb és a mount sorrendtől
 * függő, StrictMode alatt törékeny számlálót küszöböl ki.
 *
 * A forrás billentyűzet kezelése (nyilak, `Shift` dupla lépésköz, `Home`,
 * `End`) változatlan; az `Enter` billentyű ÚJ, nem a forrásból jön: az
 * elválasztóhoz tartozó bal/felső panelt csomagolja össze a minimumára,
 * majd a legutóbb feljegyzett méretre nyitja vissza (a W3C WAI Window
 * Splitter minta az `Enter`-t nem sorolja fel opcionális billentyűként,
 * szemben a `Home`/`End`/`F6` hármassal; a döntés a T-009-11 kifejezett
 * kérése).
 *
 * **Három további eltérés a forrástól (2026-09-25, SPEC-008 14.2 O-10 ...
 * O-12, `docs/research/2026-09-24-jovahagyas-panel-helye.md` 10. szekció):**
 *
 * - **A panelek zsugorodhatnak** (`ResizablePanel`: `flex-shrink: 1` a
 *   forrás `0` értéke helyett). A forrás panelei a 100 százalékon felül az
 *   elválasztó 5 pixelét is elfoglalták, a csoport ennyivel túllógott, és az
 *   `overflow: hidden` levágta (a forrás saját `resizable.html` demójában is,
 *   4,98 pixel).
 * - **A határ és a jelentett érték a panelek pixeles minimumához igazodik**
 *   (`measure-panel-geometry.ts`, `resize-at.ts`): a forrás CSS
 *   `min-height: 60px`/`min-width: 80px` minimuma mellett a százalékos
 *   `[5, 95]` határ olyan értéket is jelentett, amit a kirajzolás nem
 *   követett, és a túlnőtt panel a másikat a csoport levágott területére
 *   tolta. A W3C WAI-ARIA szerint egy fókuszálható `separator`
 *   `aria-valuenow` értéke az elválasztó TÉNYLEGES helye, az
 *   `aria-valuemin`/`aria-valuemax` pedig az a hely, ahol az elsődleges panel
 *   a legkisebb, illetve a legnagyobb (APG Window Splitter Pattern). A mérés
 *   a csatoláskor, egy panel későbbi csatolásakor, az ablak átméretezésekor,
 *   az elválasztó fókuszakor, és minden húzás és billentyű lépés előtt fut; a
 *   csoport más okú
 *   méretváltozását (például egy szülő elrendezés húzását) a következő ilyen
 *   esemény követi, mert a `ResizeObserver` a csomagban tiltott (SPEC-007 16.
 *   szekció 24. kritérium).
 * - **A `pointercancel` is lezárja a húzást**, ugyanúgy, mint a
 *   `pointerup`. A W3C Pointer Events szerint a böngésző `pointercancel`
 *   eseménnyel zárja a pointer esemény folyamát, ha a mozdulatot maga
 *   veszi át (érintéses pásztázás), és utána arra a pointerre több eseményt
 *   nem küld, tehát `pointerup` sem jön. A forrás csak a `pointerup`
 *   eseményre zárt, így a húzás állapota bent ragadt, és a következő
 *   egérmozgás vagy görgetés mozdította az elválasztót.
 *
 * A húzás állapota (`DragState`) szándékosan `useState`-ben él, nem
 * `useRef`-ben: az effektus így a `dragState === undefined` ágra a KEZDŐ
 * renderen természetesen lefut (nincs húzás), a definiált ágra pedig
 * `beginDrag` hívásakor - mindkét ág valódi, mesterkedés nélküli teszttel
 * fedhető. Egy `useRef`-alapú váltat elvetettük, mert ott a "nincs aktív
 * húzás" ág a gyakorlatban bizonyíthatóan sosem futna le eseményen
 * keresztül, ami a projekt szabálya szerint tiltott ág lenne (.claude/
 * CLAUDE.md 5. szekció, "100 százalékos... küszöb").
 */
export function Resizable(properties: Readonly<ResizableProperties>): ReactElement {
  const { children, direction = 'horizontal', defaultSizes, onSizesChange } = properties;
  const isVertical = direction === 'vertical';

  const [sizes, setSizes] = useState<readonly number[]>(defaultSizes);
  const [minSizePercents, setMinSizePercents] = useState<readonly number[]>([]);
  const [activeHandleIndex, setActiveHandleIndex] = useState(-1);
  const [dragState, setDragState] = useState<DragState | undefined>(undefined);
  // A panelek csatolásának száma: egy később felcsatolt panel (a gráf
  // szerkesztő beállítás panelje a csomópont kijelölésekor, a futás nézet
  // jóváhagyás törzse egy élőben érkező jóváhagyáskor) újramérést vált ki,
  // különben a határ és az `aria-valuemin`/`aria-valuemax` a következő
  // fókuszig a csatolás előtti, egy panelos mérésen (a forrás [5, 95]
  // tartományán) maradna.
  const [panelMountCount, setPanelMountCount] = useState(0);
  const collapseMemory = useRef(new Map<number, number>());
  const panelElements = useRef(new Map<number, HTMLDivElement>());
  const idBase = useId();
  const panelCount = sizes.length;

  const panelDomId = useCallback((index: number): string => `${idBase}-panel-${String(index)}`, [idBase]);

  const registerPanel = useCallback((index: number, element: HTMLDivElement | null): void => {
    if (element === null) {
      panelElements.current.delete(index);
      return;
    }
    panelElements.current.set(index, element);
    setPanelMountCount((count) => count + 1);
  }, []);

  // A panelek mérése és a méretek igazítása a mért minimumhoz. A mért
  // geometriát vissza is adja, hogy a hívó (húzás, billentyű) ugyanabban a
  // lépésben a friss minimummal számoljon, ne a még meg nem jelent
  // állapottal.
  const refreshGeometry = useCallback((): PanelGeometry | undefined => {
    const panels = Array.from({ length: panelCount }, (_, index) => panelElements.current.get(index));
    const geometry = measurePanelGeometry(panels, isVertical);
    const measuredMinimums = geometry?.minSizePercents ?? [];
    setMinSizePercents(measuredMinimums);
    setSizes((previous) => {
      const clamped = clampToMinimums(previous, measuredMinimums);
      return isSameSizes(clamped, previous) ? previous : clamped;
    });
    return geometry;
  }, [panelCount, isVertical]);

  const beginDrag = useCallback(
    (handleIndex: number, clientPos: number): void => {
      const geometry = refreshGeometry();
      const measuredMinimums = geometry?.minSizePercents ?? [];
      setDragState({
        handleIndex,
        startClientPos: clientPos,
        totalSizePixels: geometry?.availableSizePixels ?? 0,
        startSizes: clampToMinimums(sizes, measuredMinimums),
        minSizePercents: measuredMinimums,
      });
      setActiveHandleIndex(handleIndex);
    },
    [refreshGeometry, sizes],
  );

  const resizeByDelta = useCallback(
    (handleIndex: number, deltaPercent: number): void => {
      const measuredMinimums = refreshGeometry()?.minSizePercents ?? [];
      setSizes((previous) => resizeAt(previous, handleIndex, deltaPercent, measuredMinimums));
    },
    [refreshGeometry],
  );

  const toggleCollapse = useCallback(
    (handleIndex: number): void => {
      const measuredMinimums = refreshGeometry()?.minSizePercents ?? [];
      setSizes((previous) => {
        const currentSize = previous[handleIndex];
        if (currentSize === undefined) {
          return previous;
        }
        if (isCollapsed(currentSize, measuredMinimums[handleIndex] ?? 0)) {
          const rememberedSize = collapseMemory.current.get(handleIndex) ?? DEFAULT_RESTORE_SIZE_PERCENT;
          collapseMemory.current.delete(handleIndex);
          return resizeAt(previous, handleIndex, rememberedSize - currentSize, measuredMinimums);
        }
        collapseMemory.current.set(handleIndex, currentSize);
        return resizeAt(previous, handleIndex, COLLAPSED_SIZE_PERCENT - currentSize, measuredMinimums);
      });
    },
    [refreshGeometry],
  );

  // A kezdő méret a csatoláskor, a kirajzolás előtt igazodik a mért
  // minimumhoz (egy tárolt 5 százalék egy kis ablakban a minimumra vált), és
  // minden ablak átméretezéskor és panel csatoláskor újra. A
  // `panelMountCount` szándékosan dependency, holott a törzs nem olvassa: egy
  // később felcsatolt panel ugyanazt a mérést váltja ki, mint a csoport
  // csatolása.
  useLayoutEffect(() => {
    const handleResize = (): void => {
      refreshGeometry();
    };
    handleResize();
    globalThis.addEventListener('resize', handleResize);
    return (): void => {
      globalThis.removeEventListener('resize', handleResize);
    };
  }, [refreshGeometry, panelMountCount]);

  // Amíg nincs aktív húzás (a kezdő renderen is), nincs mit feliratkoztatni.
  // Húzás alatt a window szintű pointermove/pointerup/pointercancel a forrás
  // egyetlen eseményforrása (a handle csak a pointerdown-t kapja natívan);
  // leszereléskor vagy a húzás lezárásakor (dragState undefined-ra vált) a
  // cleanup mindhárom listenert eltávolítja.
  useEffect(() => {
    if (dragState === undefined) {
      return;
    }
    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      const currentPos = isVertical ? event.clientY : event.clientX;
      const deltaPercent = computeDragDeltaPercent(dragState.startClientPos, currentPos, dragState.totalSizePixels);
      setSizes(resizeAt(dragState.startSizes, dragState.handleIndex, deltaPercent, dragState.minSizePercents));
    };
    const endDrag = (): void => {
      setDragState(undefined);
      setActiveHandleIndex(-1);
    };
    globalThis.addEventListener('pointermove', handlePointerMove);
    globalThis.addEventListener('pointerup', endDrag);
    globalThis.addEventListener('pointercancel', endDrag);
    return (): void => {
      globalThis.removeEventListener('pointermove', handlePointerMove);
      globalThis.removeEventListener('pointerup', endDrag);
      globalThis.removeEventListener('pointercancel', endDrag);
    };
  }, [dragState, isVertical]);

  // Az értesítés hatásban megy, nem a `setSizes` hívási helyein: a méret
  // négy úton változhat (húzás, billentyű, összecsomagolás, a mért
  // minimumhoz igazítás), és a frissítők függvény alakúak, tehát az ÚJ méret
  // a hívás helyén még nem ismert. A `sizes` állapotra kötött hatás mindet
  // egyetlen ponton fogja el, a kezdő renderen pedig a kezdőértéket adja
  // tovább.
  useEffect(() => {
    onSizesChange?.(sizes);
  }, [sizes, onSizesChange]);

  const contextValue: ResizableContextValue = {
    sizes,
    minSizePercents,
    direction,
    activeHandleIndex,
    panelDomId,
    registerPanel,
    beginDrag,
    resizeByDelta,
    toggleCollapse,
    refreshGeometry,
  };

  return (
    <div className={`resizable-group${isVertical ? ' resizable-group--vertical' : ''}`}>
      <ResizableContext.Provider value={contextValue}>{children}</ResizableContext.Provider>
    </div>
  );
}
