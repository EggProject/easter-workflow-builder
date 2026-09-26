import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { isInstanceof } from '@easter-workflow-builder/typeguards';
import { useListCallbackRef, type DynamicRowHeight, type ListImperativeAPI } from 'react-window';
import { isLastRowVisible } from './is-last-row-visible.ts';
import { isPreArrivalRangeReport } from './is-pre-arrival-range-report.ts';
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
  isPausedByToggle: false,
};

/**
 * Egy kinyitható sor fejléce: a `packages/ui` `AccordionItem` fejléce
 * `aria-expanded` állapotú gomb, aminek minden `click` eseménye pontosan
 * egyszer váltja a sort (a `Space`, az `Enter` és a csak `click` út is
 * `click` eseményt ad, research 15. szekció).
 */
const DISCLOSURE_CONTROL_SELECTOR = '[aria-expanded]';

/**
 * A fejléc `aria-expanded` értéke a kattintás előtt, ha a kattintás a sort
 * kinyitja. A lista kattintás figyelője a React saját kezelője ELŐTT fut: a
 * telepített `react-dom` a gyökér tárolón figyel (`listenToAllSupportedEvents`),
 * a lista annak leszármazottja, és a `click` buborékol.
 */
const COLLAPSED_ARIA_EXPANDED = 'false';

/**
 * A transcript automatikus görgetése (SPEC-008 7.4, AC40, AC41, T-009-25).
 *
 * Követés közben egy új sor érkezésekor a panel a
 * `scrollToRow({ index: rowCount - 1 })` hívással az aljára görget; ha a
 * felhasználó felgörgetett, nem görget, hanem számol. A gomb megnyomása
 * visszakapcsolja a követést, és ugyanez az effekt az aljára görget. Az
 * állapotgép a `reduceTranscriptAutoScroll` tiszta függvényben áll.
 *
 * A panel a csatoláskor is követ: az első renderkor már meglévő sorok (a
 * pótlás) ugyanúgy "érkeznek", tehát a lista az aljáról indul.
 *
 * Az aljára görgetés azért pontos, mert minden összecsukott sor egyforma
 * magas, tehát a lista becslése a még ki nem rajzolt sorokra is a valódi
 * magasság (`collapsed-transcript-row-height.ts`, research 16. szekció).
 *
 * **Sor kinyitása élő stream közben.** Egy fejléc `click` eseménye
 * szünetelteti a követést. A kinyitás szünete addig tart, amíg a felhasználó
 * vissza nem ér az aljára vagy meg nem nyomja az "ugrás az aljára" gombot
 * (user döntés 2026-09-25): a kinyitott sor akkor is a helyén marad, ha maga
 * az utolsó sor. A becsukás szünete a mérésig tart (a `rowHeight`
 * gyorsítótár új identitása), mert addig a lista jelentései egy már nem
 * létező elrendezést írnak le; a mérés utáni jelentés után a predikátum dönt.
 * A váltások fejlécenként párosodnak: ha egy fejléc a szünet alatt páros
 * számú kattintást kap (például egy képkockán belüli ki-be csukás, ami után
 * mérés sem jön), a sor ugyanaz, mint előtte, és ha minden váltás
 * visszaállt, a szünet a predikátum szerint zárul. A szünetnek mindig van
 * kilépése: a mérés (becsukásnál), a páros kattintás, az "ugrás az aljára"
 * gomb és a kézi visszatérés az aljára; a nem látott sorok száma közben is
 * nő (`docs/research/2026-09-23-transcript-panel-meresek.md` 16-18.
 * szekció).
 */
export function useTranscriptAutoScroll(rowCount: number, rowHeight: DynamicRowHeight): TranscriptAutoScroll {
  const [state, dispatch] = useReducer(reduceTranscriptAutoScroll, INITIAL_STATE);
  // A könyvtár saját hookja `typeof useState<ListImperativeAPI | null>`
  // szignatúrájú, és a React ref szerződése leválasztáskor `null`-t ad át,
  // tehát a kezdőérték is `null`.
  // eslint-disable-next-line unicorn/no-null -- a react-window ref állapotának dokumentált üres értéke
  const [list, setList] = useListCallbackRef(null);

  // A követést szüneteltető váltások fejlécenként: a szünet kezdete óta
  // páratlan számú kattintást kapott fejlécek. Az érték igaz, ha a váltás
  // kinyitás volt: annak a szünete a mérés után is tart, a becsukásé a
  // mérésig.
  const pausingTogglesReference = useRef(new Map<Element, boolean>());
  // Jelentett-e a lista a szünet kezdete óta olyan elrendezést, amiben az
  // utolsó sor nem látszik. Csak az ezután érkező, az utolsó sort mutató
  // jelentés számít visszatérésnek az aljára: a kattintás előtti görgetés
  // késve érkező jelentése (a mérés előtti gyorsítótárral, research 16.
  // szekció) nem, és a kinyitott utolsó sor görgetése sem (research 18.
  // szekció).
  const hasLeftBottomWhilePausedReference = useRef(false);
  // Az előző jelentés idején érvényes sorszám: ebből dől el, hogy egy
  // jelentés még az érkezés előtti tartományt írja-e le
  // (`isPreArrivalRangeReport`).
  const lastReportedRowCountReference = useRef(0);

  // A görgetés a követés pillanatnyi állapotát olvassa, de csak a görgető
  // effekt indítói futtatják: a lista csatolása, új sor, átméretezés és az
  // ugrás. A követés visszakapcsolása önmagában nem görget. A szüneteltető
  // váltást a hivatkozásból is olvassa, mert a kattintás egy már kirajzolt,
  // de effektjét még le nem futtatott érkezés ELÉ is eshet, és ilyenkor az
  // állapot még a kattintás előtti. A visszatérési érték: az érkezést a
  // panel követte-e (ha nem, a sor a nem látottak közé kerül).
  const followToBottom = useEffectEvent((): boolean => {
    const isFollowed = state.isFollowing && pausingTogglesReference.current.size === 0;
    if (isFollowed && list !== null && rowCount > 0) {
      list.scrollToRow({ index: rowCount - 1, align: 'end' });
    }
    return isFollowed;
  });

  // Az átméretezés jelzése: a számláló változása futtatja újra a görgető
  // effektet (lásd az `onResize` doksiját).
  const [resizeCount, setResizeCount] = useState(0);
  const onResize = useCallback(() => {
    setResizeCount((count) => count + 1);
  }, []);
  const [jumpCount, setJumpCount] = useState(0);

  useEffect(() => {
    const isFollowed = followToBottom();
    dispatch({ type: 'rows_arrived', rowCount, isFollowed });
  }, [list, rowCount, resizeCount, jumpCount]);

  useEffect(() => {
    const element = list?.element;
    if (element === undefined || element === null) {
      return;
    }
    const onClick = (event: Event): void => {
      const { target } = event;
      const control = isInstanceof(target, Element) && target.closest(DISCLOSURE_CONTROL_SELECTOR);
      if (control === false || control === null) {
        return;
      }
      const toggles = pausingTogglesReference.current;
      if (toggles.delete(control)) {
        if (toggles.size === 0) {
          dispatch({ type: 'row_toggle_settled' });
        }
        return;
      }
      if (toggles.size === 0) {
        hasLeftBottomWhilePausedReference.current = false;
      }
      toggles.set(control, control.getAttribute('aria-expanded') === COLLAPSED_ARIA_EXPANDED);
      dispatch({ type: 'row_toggle_started' });
    };
    element.addEventListener('click', onClick, { passive: true });
    return () => {
      element.removeEventListener('click', onClick);
    };
  }, [list]);

  // A `rowHeight` identitása pontosan akkor új, amikor egy kirajzolt sor
  // mért magassága eltér a tárolttól: a telepített `useDynamicRowHeight`
  // `setRowHeight` hívása azonos értékre az előző állapotot adja vissza, és
  // a visszaadott objektum `useMemo` a gyorsítótár térképén (research 13.
  // szekció). A mérés után a lista a látható tartományt ugyanebben a
  // commitban, egy layout effektben számolja újra, és a változást csak a
  // következő renderben jelenti. A lezárás ezért egy állapot frissítéssel
  // egy későbbi renderre tolódik, aminek a passzív effektjei a lista
  // jelentése UTÁN futnak (saját mérés, research 16. szekció). A mérés csak a
  // becsukásokat zárja: egy kinyitott sor, akár az utolsó, a mérés után is a
  // helyén marad (user döntés 2026-09-25, research 18. szekció).
  const [settleRequestCount, setSettleRequestCount] = useState(0);
  const requestSettle = useEffectEvent(() => {
    const toggles = pausingTogglesReference.current;
    if (toggles.size === 0) {
      return;
    }
    for (const [control, isExpansion] of toggles) {
      if (!isExpansion) {
        toggles.delete(control);
      }
    }
    if (toggles.size === 0) {
      setSettleRequestCount((count) => count + 1);
    }
  });
  useEffect(() => {
    requestSettle();
  }, [rowHeight]);
  // Egy azóta kattintott fejléc a lezárást elhalasztja: egy becsukás a saját
  // méréséig, egy kinyitás a szünet valamelyik kilépéséig.
  const settle = useEffectEvent(() => {
    if (pausingTogglesReference.current.size === 0) {
      dispatch({ type: 'row_toggle_settled' });
    }
  });
  useEffect(() => {
    if (settleRequestCount > 0) {
      settle();
    }
  }, [settleRequestCount]);

  // A szünet alatt a lista elhagyta az alját, majd újra az utolsó sort
  // mutatja: a felhasználó visszaért az aljára (user döntés 2026-09-24). Ez a
  // szünet kilépése akkor is, ha a mérés sosem jön: egy fülváltás a sort a
  // mérése előtt leszereli (a rejtett sor 0 magasságát a könyvtár nem
  // tárolja), és utána a gyorsítótár nem változik. A kinyitott utolsó sor
  // után az alj elhagyása az első, nem követett új sor. Az érkezés utáni
  // első, még a régi tartományt leíró jelentés nem elhagyás: nem teli listán
  // az új sor a következő jelentésben már látszik, és a kettő együtt egy
  // hamis "elhagyás, majd visszatérés" párt adna, ami a szünetet lezárná
  // (research 19. szekció).
  const onRowsRendered = useCallback(
    (visibleRows: Readonly<{ startIndex: number; stopIndex: number }>) => {
      dispatch({ type: 'rows_rendered', stopIndex: visibleRows.stopIndex, rowCount });
      const previousRowCount = lastReportedRowCountReference.current;
      lastReportedRowCountReference.current = rowCount;
      const toggles = pausingTogglesReference.current;
      if (toggles.size === 0) {
        return;
      }
      if (!isLastRowVisible(visibleRows, rowCount)) {
        if (!isPreArrivalRangeReport(visibleRows, rowCount, previousRowCount)) {
          hasLeftBottomWhilePausedReference.current = true;
        }
        return;
      }
      if (hasLeftBottomWhilePausedReference.current) {
        toggles.clear();
        dispatch({ type: 'bottom_reached_while_paused' });
      }
    },
    [rowCount],
  );

  // Az ugrás a szüneteltető váltásokat is elengedi: egy a mérése előtt
  // leszerelt sor (a kirajzolt tartományból kigörgetve) sosem kap mérést.
  const jumpToBottom = useCallback(() => {
    pausingTogglesReference.current.clear();
    dispatch({ type: 'jump_requested' });
    setJumpCount((count) => count + 1);
  }, []);

  return { setList, onRowsRendered, onResize, unseenCount: state.unseenCount, jumpToBottom };
}
