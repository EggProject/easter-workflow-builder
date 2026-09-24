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
 * A felhasználó saját beavatkozása a lista elemén, ami felfüggeszti az
 * igazítást: görgetés (kerék, érintés), a görgetősáv vagy egy sor
 * megnyomása, billentyű, és a `click`. Az első négy a `react-window` 2.3.2
 * görgetés javításának megszakító eseménylistája (upstream PR #914). A
 * `click` azért kell, mert egy sor kinyitása mindig `click` eseménnyel jár,
 * de a `pointerdown` és a `keydown` nem mindig ugyanabban a követési
 * ciklusban előzi meg: a `Space` a gombot a `keyup`-ra aktiválja, tehát a
 * `keydown` után érkező új sor újraélesítené az igazítást, az
 * `element.click()` pedig csak `click`-et ad, és a böngésző módú NVDA és
 * JAWS is billentyű esemény nélkül aktivál
 * (`docs/research/2026-09-23-transcript-panel-meresek.md` 13. és 15.
 * szekció).
 */
const USER_INTERACTION_EVENT_TYPES = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'click'] as const;

/**
 * Egy kinyitható sor fejléce: a `packages/ui` `AccordionItem` fejléce
 * `aria-expanded` állapotú gomb, tehát a `click` pontosan akkor nyit ki vagy
 * csuk be egy sort, ha a célja ezen belül áll.
 */
const DISCLOSURE_CONTROL_SELECTOR = '[aria-expanded]';

/**
 * Egy sor kinyitása vagy becsukása utáni várakozás. `measurement`: a lista
 * még a sor régi magasságával számol. `report`: a mért magasság megérkezett,
 * de a lista a vele számolt látható tartományt még nem jelentette (a
 * `react-window` a tartományt egy layout effektben számolja újra, és a
 * következő renderben jelenti). `none`: nincs várakozás.
 */
type TogglePhase = 'none' | 'measurement' | 'report';

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
 *
 * **Igazítás a mért magassághoz.** A `scrollToRow` a még ki nem rajzolt
 * sorokat a `defaultRowHeight` becslésével számolja, és a telepített
 * `react-window@2.3.1` a görgetés után nem igazít, amikor a kirajzolt sor
 * mért magassága eltér a becsléstől (az átmeneti sor egy pixellel magasabb,
 * `collapsed-transcript-row-height.ts`). Ezért követés közben a lista
 * sormagasság gyorsítótárának (`rowHeight`) minden változása után a hook
 * újra az aljára görget, amíg a felhasználó a legutóbbi követő görgetés óta
 * nem nyúlt a listához (`USER_INTERACTION_EVENT_TYPES`). A beavatkozás
 * utáni változás (például egy kinyitott sor) nem görget: a sor ott marad,
 * ahol a felhasználó kinyitotta, és ha az utolsó sor kicsúszik, a követés a
 * `reduceTranscriptAutoScroll` szerint kikapcsol. Új sor, átméretezés vagy
 * az ugrás gomb újra élesíti az igazítást. Az upstream javítástól eltérően
 * az igazítás nem egyetlen görgetéshez kötött és nincs határideje: a
 * felfüggesztésig tart, mert a projekt időzítőt nem használ (research 13.
 * szekció).
 *
 * **Kinyitás élő stream közben.** Egy sor kinyitása és a lista mért
 * magassággal számolt jelentése között az `isFollowing` a kinyitás előtti
 * helyzetet írja le, tehát az ebben az ablakban érkező új sor követése a
 * kinyitott sort elrántaná. Ezért egy sor kinyitása vagy becsukása után a
 * görgető effekt kimarad, amíg a mérés utáni első jelentés meg nem érkezik
 * (`TogglePhase`), és utána, a friss állapottal fut le. Ha a kinyitás nem változtat a látható tartományon
 * (például az utolsó sor nyílik ki), a lista nem jelent, és a várakozást a
 * következő új sor jelentése zárja
 * (`docs/research/2026-09-23-transcript-panel-meresek.md` 15. szekció).
 */
export function useTranscriptAutoScroll(rowCount: number, rowHeight: DynamicRowHeight): TranscriptAutoScroll {
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

  // Igaz, amíg a legutóbbi követő görgetés óta a felhasználó nem nyúlt a
  // listához: ennyi ideig igazít a hook a mért sormagassághoz.
  const isMeasurementFollowArmedReference = useRef(true);

  // Egy sor kinyitása vagy becsukása utáni várakozás (`TogglePhase`). Amíg
  // tart, a görgető effekt kimarad (`hasHeldFollowReference`), és a
  // várakozás végén (`releaseCount`) a friss jelentéssel fut le.
  const togglePhaseReference = useRef<TogglePhase>('none');
  const hasHeldFollowReference = useRef(false);
  const [releaseCount, setReleaseCount] = useState(0);

  useEffect(() => {
    if (togglePhaseReference.current !== 'none') {
      hasHeldFollowReference.current = true;
      return;
    }
    isMeasurementFollowArmedReference.current = true;
    followToBottom();
    dispatch({ type: 'rows_arrived', rowCount });
  }, [followToBottom, rowCount, resizeCount, releaseCount]);

  // A `rowHeight` identitása pontosan akkor új, amikor egy kirajzolt sor
  // mért magassága eltér a tárolttól: a telepített `useDynamicRowHeight`
  // `setRowHeight` hívása azonos értékre az előző állapotot adja vissza, és
  // a visszaadott objektum `useMemo` a gyorsítótár térképén. A kinyitás
  // utáni első mérés nem görget, csak a várakozást lépteti.
  const followAfterMeasurement = useEffectEvent(() => {
    if (togglePhaseReference.current === 'measurement') {
      togglePhaseReference.current = 'report';
      return;
    }
    if (isMeasurementFollowArmedReference.current) {
      followToBottom();
    }
  });
  useEffect(() => {
    followAfterMeasurement();
  }, [rowHeight]);

  useEffect(() => {
    const element = list?.element;
    if (element === undefined || element === null) {
      return;
    }
    const disarm = (): void => {
      isMeasurementFollowArmedReference.current = false;
    };
    const holdForToggle = (event: Event): void => {
      const { target } = event;
      if (isInstanceof(target, Element) && target.closest(DISCLOSURE_CONTROL_SELECTOR) !== null) {
        togglePhaseReference.current = 'measurement';
      }
    };
    for (const type of USER_INTERACTION_EVENT_TYPES) {
      element.addEventListener(type, disarm, { passive: true });
    }
    element.addEventListener('click', holdForToggle, { passive: true });
    return () => {
      for (const type of USER_INTERACTION_EVENT_TYPES) {
        element.removeEventListener(type, disarm);
      }
      element.removeEventListener('click', holdForToggle);
    };
  }, [list]);

  const onRowsRendered = useCallback(
    (visibleRows: Readonly<{ startIndex: number; stopIndex: number }>) => {
      dispatch({ type: 'rows_rendered', stopIndex: visibleRows.stopIndex, rowCount });
      // A mérés utáni első jelentés zárja a várakozást. A kimaradt görgető
      // effektet a számláló UGYANABBA a renderbe teszi, amelyik ezt a
      // jelentést a reducerben feldolgozza, tehát a követés a kinyitás
      // utáni helyzetről dönt.
      if (togglePhaseReference.current === 'report') {
        togglePhaseReference.current = 'none';
        if (hasHeldFollowReference.current) {
          hasHeldFollowReference.current = false;
          setReleaseCount((count) => count + 1);
        }
      }
    },
    [rowCount],
  );

  const jumpToBottom = useCallback(() => {
    dispatch({ type: 'jump_requested' });
  }, []);

  return { setList, onRowsRendered, onResize, unseenCount: state.unseenCount, jumpToBottom };
}
