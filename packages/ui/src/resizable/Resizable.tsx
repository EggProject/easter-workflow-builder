import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import './resizable.css';
import { computeDragDeltaPercent } from './compute-drag-delta-percent.ts';
import { computeTotalSizePixels } from './compute-total-size-pixels.ts';
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
}

interface DragState {
  readonly handleIndex: number;
  readonly startClientPos: number;
  readonly totalSizePixels: number;
  readonly startSizes: readonly number[];
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

function isCollapsed(sizePercent: number): boolean {
  return sizePercent <= COLLAPSED_SIZE_PERCENT;
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
 * elválasztóhoz tartozó bal/felső panelt csomagolja össze az 5 százalékos
 * minimumra, majd a legutóbb feljegyzett méretre nyitja vissza (a W3C WAI
 * Window Splitter minta az `Enter`-t nem sorolja fel opcionális
 * billentyűként, szemben a `Home`/`End`/`F6` hármassal - docs/research/
 * 2026-08-29-playwright-teszt-szabalyok.md nem érinti ezt, a döntés a jelen
 * feladat kifejezett kérése).
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
  const { children, direction = 'horizontal', defaultSizes } = properties;
  const isVertical = direction === 'vertical';

  const [sizes, setSizes] = useState<readonly number[]>(defaultSizes);
  const [activeHandleIndex, setActiveHandleIndex] = useState(-1);
  const [dragState, setDragState] = useState<DragState | undefined>(undefined);
  const containerReference = useRef<HTMLDivElement | null>(null);
  const collapseMemory = useRef(new Map<number, number>());
  const idBase = useId();

  const panelDomId = useCallback((index: number): string => `${idBase}-panel-${String(index)}`, [idBase]);

  const beginDrag = useCallback(
    (handleIndex: number, clientPos: number): void => {
      const totalSizePixels = computeTotalSizePixels(containerReference.current, isVertical);
      setDragState({ handleIndex, startClientPos: clientPos, totalSizePixels, startSizes: sizes });
      setActiveHandleIndex(handleIndex);
    },
    [isVertical, sizes],
  );

  const resizeByDelta = useCallback((handleIndex: number, deltaPercent: number): void => {
    setSizes((previous) => resizeAt(previous, handleIndex, deltaPercent));
  }, []);

  const toggleCollapse = useCallback((handleIndex: number): void => {
    setSizes((previous) => {
      const currentSize = previous[handleIndex];
      if (currentSize === undefined) {
        return previous;
      }
      if (isCollapsed(currentSize)) {
        const rememberedSize = collapseMemory.current.get(handleIndex) ?? DEFAULT_RESTORE_SIZE_PERCENT;
        collapseMemory.current.delete(handleIndex);
        return resizeAt(previous, handleIndex, rememberedSize - currentSize);
      }
      collapseMemory.current.set(handleIndex, currentSize);
      return resizeAt(previous, handleIndex, COLLAPSED_SIZE_PERCENT - currentSize);
    });
  }, []);

  // Amíg nincs aktív húzás (a kezdő renderen is), nincs mit feliratkoztatni.
  // Húzás alatt a window szintű pointermove/pointerup a forrás egyetlen
  // eseményforrása (a handle csak a pointerdown-t kapja natívan); leszereléskor
  // vagy a húzás lezárásakor (dragState undefined-ra vált) a cleanup mindkét
  // listenert eltávolítja.
  useEffect(() => {
    if (dragState === undefined) {
      return;
    }
    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      const currentPos = isVertical ? event.clientY : event.clientX;
      const deltaPercent = computeDragDeltaPercent(dragState.startClientPos, currentPos, dragState.totalSizePixels);
      setSizes(resizeAt(dragState.startSizes, dragState.handleIndex, deltaPercent));
    };
    const handlePointerUp = (): void => {
      setDragState(undefined);
      setActiveHandleIndex(-1);
    };
    globalThis.addEventListener('pointermove', handlePointerMove);
    globalThis.addEventListener('pointerup', handlePointerUp);
    return (): void => {
      globalThis.removeEventListener('pointermove', handlePointerMove);
      globalThis.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, isVertical]);

  const contextValue: ResizableContextValue = {
    sizes,
    direction,
    activeHandleIndex,
    panelDomId,
    beginDrag,
    resizeByDelta,
    toggleCollapse,
  };

  return (
    <div ref={containerReference} className={`resizable-group${isVertical ? ' resizable-group--vertical' : ''}`}>
      <ResizableContext.Provider value={contextValue}>{children}</ResizableContext.Provider>
    </div>
  );
}
