import { createContext } from 'react';

/**
 * A `Resizable` állapota és vezérlői, amiket a `ResizablePanel` és a
 * `ResizableHandle` a saját renderelésükhöz és eseménykezelőikhöz olvasnak.
 */
export interface ResizableContextValue {
  readonly sizes: readonly number[];
  readonly direction: 'horizontal' | 'vertical';
  /**
   * A jelenleg húzott (vagy fókuszált, húzás alatt lévő) elválasztó
   * sorszáma, -1 ha nincs ilyen.
   */
  readonly activeHandleIndex: number;
  readonly panelDomId: (index: number) => string;
  readonly beginDrag: (handleIndex: number, clientPos: number) => void;
  readonly resizeByDelta: (handleIndex: number, deltaPercent: number) => void;
  readonly toggleCollapse: (handleIndex: number) => void;
}

/**
 * Alapérték: no-op burkoló, hogy egy `Resizable`-n kívül renderelt
 * `ResizablePanel`/`ResizableHandle` (pl. önálló tesztben) ne dobjon hibát -
 * ugyanaz a minta, mint a `menu-close-context.ts` no-op alapértéke.
 */
const NOOP_CONTEXT_VALUE: ResizableContextValue = {
  sizes: [],
  direction: 'horizontal',
  activeHandleIndex: -1,
  panelDomId: (index) => `resizable-panel-${String(index)}`,
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  beginDrag: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  resizeByDelta: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
  toggleCollapse: () => {},
};

export const ResizableContext = createContext<ResizableContextValue>(NOOP_CONTEXT_VALUE);
