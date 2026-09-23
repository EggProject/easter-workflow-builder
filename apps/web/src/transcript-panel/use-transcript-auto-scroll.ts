import { useCallback, useEffect, useReducer, useState, type Dispatch, type SetStateAction } from 'react';
import { useListCallbackRef, type ListImperativeAPI } from 'react-window';
import { reduceTranscriptAutoScroll } from './reduce-transcript-auto-scroll.ts';
import type { TranscriptAutoScrollState } from './transcript-auto-scroll-state.ts';

export interface TranscriptAutoScroll {
  /**
   * A `List` `listRef` propja. Állapot alapú hivatkozás
   * (`useListCallbackRef`), hogy a lista csatolása újrafuttassa a görgető
   * effektet.
   */
  readonly setList: Dispatch<SetStateAction<ListImperativeAPI | null>>;
  /**
   * A `List` `onRowsRendered` propja. Unit tesztben szintetikusan hívható
   * (SPEC-008 7.4).
   */
  readonly onRowsRendered: (visibleRows: Readonly<{ startIndex: number; stopIndex: number }>) => void;
  /**
   * A `List` `onResize` propja: követés közben átméretezéskor is az utolsó
   * sorra görget. A könyvtár dokumentációja szerint a callback pontosan erre
   * való ("This may be used to (re)scroll a row into view"). Enélkül a fül
   * sávban (a `--ep-screen-md` alatt) a csatoláskori görgetés elveszne, mert
   * a transcript fül ekkor még rejtett, és egy rejtett elem nem görgethető:
   * a fül megnyitásakor a lista a tetején állna (saját mérés, 375 pixelen).
   *
   * A callback maga NEM görget, csak jelez, és a görgetés a következő
   * passzív effektben fut. Ok, saját mérés és a telepített forrás
   * (`react-window.js`, a `useVirtualizer` törzse) szerint: a lista az
   * `onResize` hívást egy layout effektben adja ki, ami a komponensen belül
   * MEGELŐZI azt a layout effektet, ami a `scrollToRow` mögötti függvényt az
   * aktuális sorszámra frissíti. Ha ugyanabban a commitban a méret és a
   * sorszám is változik, egy azonnali `scrollToRow` a régi sorszámmal
   * ellenőriz, és `RangeError` bontja le a teljes fát ("Invalid index
   * specified"), mért, 3000 soros pótlásnál.
   */
  readonly onResize: () => void;
  /**
   * A felgörgetés óta érkezett, nem látott sorok száma; nulla fölött
   * jelenik meg az "ugrás az aljára" gomb.
   */
  readonly unseenCount: number;
  readonly jumpToBottom: () => void;
}

const INITIAL_STATE: TranscriptAutoScrollState = {
  isFollowing: true,
  settledRowCount: 0,
  unseenCount: 0,
  lastStopIndex: -1,
};

/**
 * A transcript automatikus görgetése (SPEC-008 7.4, AC40, AC41, T-009-25).
 *
 * Követés közben egy új sor érkezésekor a panel a
 * `scrollToRow({ index: rowCount - 1 })` hívással az aljára görget; ha a
 * felhasználó felgörgetett, nem görget, hanem számol. A gomb megnyomása
 * visszakapcsolja a követést, amire ugyanez az effekt az aljára görget. Az
 * állapotgép a `reduceTranscriptAutoScroll` tiszta függvényben áll.
 *
 * A panel a csatoláskor is követ: az első renderkor már meglévő sorok (a
 * pótlás) ugyanúgy "érkeznek", tehát a lista az aljáról indul.
 */
export function useTranscriptAutoScroll(rowCount: number): TranscriptAutoScroll {
  const [state, dispatch] = useReducer(reduceTranscriptAutoScroll, INITIAL_STATE);
  // A könyvtár saját hookja `typeof useState<ListImperativeAPI | null>`
  // szignatúrájú, és a React ref szerződése leválasztáskor `null`-t ad át,
  // tehát a kezdőérték is `null`.
  // eslint-disable-next-line unicorn/no-null -- a react-window ref állapotának dokumentált üres értéke
  const [list, setList] = useListCallbackRef(null);

  const followToBottom = useCallback(() => {
    if (list !== null && state.isFollowing && rowCount > 0) {
      list.scrollToRow({ index: rowCount - 1, align: 'end' });
    }
  }, [list, rowCount, state.isFollowing]);

  // Az átméretezés jelzése: a számláló változása futtatja újra a görgető
  // effektet (lásd az `onResize` doksiját).
  const [resizeCount, setResizeCount] = useState(0);
  const onResize = useCallback(() => {
    setResizeCount((count) => count + 1);
  }, []);

  useEffect(() => {
    followToBottom();
    dispatch({ type: 'rows_arrived', rowCount });
  }, [followToBottom, rowCount, resizeCount]);

  const onRowsRendered = useCallback(
    (visibleRows: Readonly<{ startIndex: number; stopIndex: number }>) => {
      dispatch({ type: 'rows_rendered', stopIndex: visibleRows.stopIndex, rowCount });
    },
    [rowCount],
  );

  const jumpToBottom = useCallback(() => {
    dispatch({ type: 'jump_requested' });
  }, []);

  return { setList, onRowsRendered, onResize, unseenCount: state.unseenCount, jumpToBottom };
}
