import {
  useCallback,
  useContext,
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
import { measureGroupAvailable } from './measure-group-available.ts';
import { measurePanelGeometry, type PanelGeometry } from './measure-panel-geometry.ts';
import { measureRevealRequirement } from './measure-reveal-requirement.ts';
import { planContainerGrowth } from './plan-container-growth.ts';
import { planReveal } from './plan-reveal.ts';
import { ResizableContext, type ResizableContextValue } from './resizable-context.ts';
import { resizeAt } from './resize-at.ts';

/**
 * A felfedendő elem (`Resizable` `reveal`, 2026-09-25).
 */
export interface ResizableReveal {
  /**
   * Az elem `id` értéke; a csoport egyik paneljében áll.
   */
  readonly elementId: string;
  /**
   * A felfedés kulcsa: ha változik (például egy másik jóváhagyás látszik), a
   * számítás újra fut.
   */
  readonly key: string;
}

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
   * A FELHASZNÁLÓ minden méretváltoztatása után meghívódik (húzás, nyíl,
   * `Home`, `End`, `Enter`), az új méretekkel. Kizárólag ÉRTESÍTÉS: a méretet
   * továbbra is a komponens tartja, a hívó ebből legfeljebb perzisztálni tud
   * (a gráf szerkesztő a `localStorage`-be írja, felhasználói kérés
   * 2026-09-09). Vezérelt `sizes` prop szándékosan NINCS: az a komponens
   * teljes állapotkezelését kifordítaná.
   *
   * **2026-09-25 óta csak a felhasználó változtatására hív**, a kezdő renderen,
   * a mért minimumhoz igazításkor és a felfedéskor (`reveal`) nem. Korábban
   * minden változásra hívott, tehát a kezdőérték minden csatoláskor a
   * tárolóba íródott, és egy kis csoportban a minimumhoz igazított érték
   * felülírta a felhasználó tárolt arányát (mérve 768x1024-en a tárolt
   * `[70, 30]` helyett `[54,44, 45,56]`, `docs/research/2026-09-24-jovahagyas-panel-helye.md`
   * 12. szekció). A tárolt érték így a felhasználó döntése, és a felfedés
   * ideiglenes igazítása sosem kerül bele.
   */
  readonly onSizesChange?: (sizes: readonly number[]) => void;
  /**
   * Ideiglenes felfedés (2026-09-25, user döntés, SPEC-008 8. szekció 1.
   * pont): a megadott elem teljes egészében látsszon. Előbb a befoglaló
   * `Resizable` ad helyet (ha ugyanazon a tengelyen áll és mozdulhat), a
   * csoport saját arányát megtartva, és csak a maradékot fizeti a saját
   * elválasztó, ha az `adjustsForReveal` igaz (`plan-reveal.ts`). A számítás
   * a felfedés kezdetekor, a kulcs változásakor, egy panel csatolásakor, az
   * ablak átméretezésekor és a befoglaló csoport tengelyváltásakor fut; a
   * felfedés végén (a prop `undefined`) a korábbi méretek visszaállnak, ha a
   * felhasználó közben nem húzta az elválasztót.
   */
  readonly reveal?: ResizableReveal | undefined;
  /**
   * Mozdulhat-e az elválasztó egy felfedés kedvéért (a saját `reveal`, vagy
   * egy beágyazott `Resizable` kérése). Alapból hamis. A hívó akkor adja
   * igaznak, ha a felhasználónak nincs saját aránya; egy felhasználói
   * méretváltoztatás után a csoport a leszereléséig nem igazodik.
   */
  readonly adjustsForReveal?: boolean;
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
  const {
    children,
    direction = 'horizontal',
    defaultSizes,
    onSizesChange,
    reveal,
    adjustsForReveal = false,
  } = properties;
  const isVertical = direction === 'vertical';
  // A befoglaló `Resizable` kontextusa (befoglaló nélkül a no-op alapérték):
  // a felfedés innen kér helyet.
  const {
    direction: containerDirection,
    resizeForReveal: resizeContainerForReveal,
    endReveal: endContainerReveal,
  } = useContext(ResizableContext);

  const [sizes, setSizes] = useState<readonly number[]>(defaultSizes);
  // A felhasználói méretváltoztatások száma: az értesítés (`onSizesChange`)
  // erre a számlálóra fut, nem a méretekre, hogy csak a felhasználó
  // változtatása jusson a hívóhoz.
  const [userResizeCount, setUserResizeCount] = useState(0);
  // A felfedés állapota. A `revealBase` a felfedés előtti méretek (a
  // felfedés végén ezek állnak vissza); a `userResizedReference` a felhasználó
  // első méretváltoztatása után igaz, és onnan a csoport nem igazodik. A
  // `sizesReference` és az `adjustsForRevealReference` a legutóbbi
  // kirajzolás értékei, mert a felfedést az ablak átméretezése is futtatja,
  // és egy beágyazott csoport kérése is olvassa.
  const revealBase = useRef<readonly number[] | undefined>(undefined);
  const userResizedReference = useRef(false);
  const sizesReference = useRef(sizes);
  const adjustsForRevealReference = useRef(adjustsForReveal);
  const revealActiveReference = useRef(false);
  const groupElement = useRef<HTMLDivElement | undefined>(undefined);
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

  const setGroupElement = useCallback((element: HTMLDivElement | null): void => {
    groupElement.current = element ?? undefined;
  }, []);

  // A felhasználó méretváltoztatása: onnan a méret az övé. A felfedés előtti
  // méretek elvesznek (a felfedés vége nem írja felül a felhasználó
  // döntését), és a csoport a leszereléséig nem igazodik felfedéshez.
  const markUserResize = useCallback((): void => {
    userResizedReference.current = true;
    revealBase.current = undefined;
    setUserResizeCount((count) => count + 1);
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
      markUserResize();
      setSizes((previous) => resizeAt(previous, handleIndex, deltaPercent, measuredMinimums));
    },
    [refreshGeometry, markUserResize],
  );

  const toggleCollapse = useCallback(
    (handleIndex: number): void => {
      const measuredMinimums = refreshGeometry()?.minSizePercents ?? [];
      markUserResize();
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
    [refreshGeometry, markUserResize],
  );

  // A felfedés vége: a felfedés előtti méretek visszaállnak. Ha a
  // felhasználó közben húzta az elválasztót, nincs mit visszaállítani
  // (`markUserResize`).
  const endReveal = useCallback((): void => {
    const base = revealBase.current;
    if (base !== undefined) {
      revealBase.current = undefined;
      setSizes(base);
    }
  }, []);

  // A felfedés geometriája: a panelek, a kirajzolt méretük, és a csoport
  // TÉNYLEGESEN rendelkezésre álló mérete (`measure-group-available.ts`),
  // amihez a pixeles minimumok is igazodnak. Nincs, ha egy panel nincs
  // kirajzolva, vagy a csoport rejtett (`measurePanelGeometry`).
  const measureRevealLayout = useCallback(():
    | {
        readonly group: HTMLDivElement;
        readonly panels: readonly HTMLDivElement[];
        readonly panelSizePixels: readonly number[];
        readonly availablePixels: number;
        readonly minSizePercents: readonly number[];
      }
    | undefined => {
    const group = groupElement.current;
    const panels = Array.from({ length: panelCount }, (_, index) => panelElements.current.get(index));
    const geometry = measurePanelGeometry(panels, isVertical);
    if (group === undefined || geometry === undefined) {
      return undefined;
    }
    const availablePixels = measureGroupAvailable(group, isVertical);
    return {
      group,
      // Mérhető geometria mellett minden panel ki van rajzolva
      // (`measurePanelGeometry`), a szűrés csak a típust szűkíti.
      panels: panels.filter((panel): panel is HTMLDivElement => panel !== undefined),
      panelSizePixels: geometry.panelSizePixels,
      availablePixels,
      minSizePercents: geometry.minSizePercents.map(
        (minimum) => (minimum * geometry.availableSizePixels) / availablePixels,
      ),
    };
  }, [panelCount, isVertical]);

  // Egy beágyazott csoport felfedési kérése (`resizable-context.ts`): a
  // kérőt tartó panel az alapállásából a kért méretre nő, vagy ha a csoport
  // nem mozdulhat, az alapállás áll vissza (`plan-container-growth.ts`). A
  // mai méret a kirajzolt, mért méret, mert egy korábbi kérés már
  // növelhette.
  const resizeForReveal = useCallback(
    (requester: Element, deltaPixels: number, requesterDirection: 'horizontal' | 'vertical'): number => {
      const layout = measureRevealLayout();
      const panelIndex = layout?.panels.findIndex((panel) => panel.contains(requester)) ?? -1;
      const currentPixels = layout?.panelSizePixels[panelIndex];
      if (layout === undefined || currentPixels === undefined) {
        return 0;
      }
      const canGrow =
        adjustsForRevealReference.current && !userResizedReference.current && requesterDirection === direction;
      const baseSizes = revealBase.current ?? sizesReference.current;
      const growth = planContainerGrowth({
        baseSizes,
        panelIndex,
        currentPixels,
        deltaPixels,
        availablePixels: layout.availablePixels,
        minSizePercents: layout.minSizePercents,
        canGrow,
      });
      revealBase.current = canGrow ? baseSizes : undefined;
      setSizes(growth.sizes);
      return growth.growthPixels;
    },
    [measureRevealLayout, direction],
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

  useLayoutEffect(() => {
    sizesReference.current = sizes;
    adjustsForRevealReference.current = adjustsForReveal;
  }, [sizes, adjustsForReveal]);

  // A felfedés (`reveal`). A számítás a felfedendő elemet tartó panel
  // szükséges méretéből indul (`measureRevealRequirement`), és a
  // `planReveal` szerint előbb a befoglaló csoporttól kér helyet, a saját
  // arányt megtartva, és csak a maradékot fizeti a saját elválasztó. Az
  // alapállás a felfedés előtti méret; a számítás mindig abból indul, tehát
  // egy rövidebb elem (másik jóváhagyás) vagy egy nagyobb ablak után a
  // csoport visszafelé is igazodik, de az alapállás alá nem. A kulcs, a
  // mozdíthatóság, egy panel csatolása, a befoglaló csoport tengelye és az
  // ablak átméretezése futtatja újra; a felfedés végén az alapállás áll
  // vissza, a sajátban és a befoglaló csoportban is.
  const revealElementId = reveal?.elementId;
  const revealKey = reveal?.key;
  useLayoutEffect(() => {
    if (revealElementId === undefined) {
      // Csak egy valóban futó felfedés ér véget: egy csak befoglaló csoport
      // (a saját `reveal` nélkül) a beágyazott csoport kérését nem vonhatja
      // vissza, például amikor a kettő egyszerre csatolódik.
      if (revealActiveReference.current) {
        revealActiveReference.current = false;
        endReveal();
        endContainerReveal();
      }
      return;
    }
    revealActiveReference.current = true;
    const revealNow = (): void => {
      const element = globalThis.document.querySelector(`#${CSS.escape(revealElementId)}`);
      const layout = measureRevealLayout();
      const panelIndex = layout?.panels.findIndex((panel) => element !== null && panel.contains(element)) ?? -1;
      const panel = layout?.panels[panelIndex];
      if (layout === undefined || element === null || panel === undefined) {
        return;
      }
      const canGrow = adjustsForRevealReference.current && !userResizedReference.current;
      const base = revealBase.current ?? sizesReference.current;
      const next = planReveal(
        {
          sizes: base,
          panelIndex,
          requiredPixels: measureRevealRequirement(panel, element, isVertical),
          availablePixels: layout.availablePixels,
          minSizePercents: layout.minSizePercents,
          canGrow,
        },
        (deltaPixels) => resizeContainerForReveal(layout.group, deltaPixels, direction),
      );
      revealBase.current = canGrow ? base : undefined;
      setSizes(next);
    };
    revealNow();
    globalThis.addEventListener('resize', revealNow);
    return (): void => {
      globalThis.removeEventListener('resize', revealNow);
    };
    // A `revealKey`, az `adjustsForReveal`, a `panelMountCount` és a
    // `containerDirection` szándékosan dependency, holott a törzs nem (vagy
    // csak a hivatkozáson át) olvassa: mindegyik változása ugyanazt a
    // számítást váltja ki.
  }, [
    revealElementId,
    revealKey,
    adjustsForReveal,
    panelMountCount,
    containerDirection,
    isVertical,
    direction,
    measureRevealLayout,
    endReveal,
    endContainerReveal,
    resizeContainerForReveal,
  ]);

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
      markUserResize();
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
  }, [dragState, isVertical, markUserResize]);

  // Az értesítés hatásban megy, nem a `setSizes` hívási helyein: a frissítők
  // függvény alakúak, tehát az ÚJ méret a hívás helyén még nem ismert. A
  // hatás a felhasználói számlálóra fut, nem a méretekre (2026-09-25): a
  // számláló ugyanabban a renderben változik, mint a felhasználó által
  // mozdított méret, a kezdő render (nulla), a mért minimumhoz igazítás és a
  // felfedés viszont nem növeli, tehát ezek nem jutnak a hívóhoz. A `sizes`
  // és az `onSizesChange` ezért szándékosan nem dependency.
  useEffect(() => {
    if (userResizeCount > 0) {
      onSizesChange?.(sizes);
    }
  }, [userResizeCount]);

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
    resizeForReveal,
    endReveal,
  };

  return (
    <div ref={setGroupElement} className={`resizable-group${isVertical ? ' resizable-group--vertical' : ''}`}>
      <ResizableContext.Provider value={contextValue}>{children}</ResizableContext.Provider>
    </div>
  );
}
