import { isLastRowVisible } from './is-last-row-visible.ts';
import type { TranscriptAutoScrollAction, TranscriptAutoScrollState } from './transcript-auto-scroll-state.ts';

/**
 * Az automatikus görgetés állapotgépe (SPEC-008 7.4, AC40, AC41, T-009-25).
 *
 * **A követés bekapcsol**, amint egy jelentés szerint az utolsó sor látható
 * (`isLastRowVisible`, pixel küszöb nélkül), és ilyenkor a nem látott sorok
 * száma nullázódik.
 *
 * **A követés kikapcsol**, ha egy jelentés szerint az utolsó sor nem látható,
 * ÉS a látható tartomány felfelé mozdult (`stopIndex` kisebb az előzőnél).
 * A második feltétel azért kell, mert egy új sor érkezése a még el sem
 * görgetett listán ugyanazt a látható tartományt jelenti egy eggyel nagyobb
 * sorszám mellett: a predikátum ilyenkor hamis, pedig a felhasználó az
 * alján állt, és a panel éppen oda készül görgetni. Egy ilyen jelentés
 * nem kapcsolhatja ki a követést, különben a gyorsan érkező élő sorok közül
 * a második már nem görgetne. Felfelé mozdulni viszont csak a felhasználó
 * görgetésétől (vagy a panel szűkülésétől, sor kinyitásától) tud a
 * tartomány, és ilyenkor az utolsó sor valóban nem látszik.
 *
 * **Az érkezés** nem számol, ha a panel követte, különben a nem látott
 * sorok számához adódik.
 *
 * **Egy sor kinyitása vagy becsukása** a lista mérése előtt kikapcsolja a
 * követést: a sor új magassága ekkor már a DOM-ban áll, de a lista még a
 * régivel számol, tehát a jelentései a mérés előtti elrendezést írják le, és
 * egy ekkor érkező sor követése a kinyitott sort elrántaná. Amíg a mérés
 * nem jött meg, egy jelentés a követést nem kapcsolhatja vissza. A lezárás
 * után a predikátum dönt, az utolsó jelentés szerint; a hook a lezárást a
 * mérés utáni jelentés után adja ki (`use-transcript-auto-scroll.ts`). Az
 * ugrás gomb a várakozást is lezárja.
 *
 * **A kézi visszatérés az aljára** (user döntés 2026-09-24) szintén lezárja a
 * várakozást, és visszakapcsolja a követést: ha a mérés elmarad (a sor a
 * mérése előtt leszerelődik, például fülváltáskor), enélkül csak az ugrás gomb
 * oldaná fel. Hogy a jelentés valóban visszatérés-e, nem pedig a kattintás
 * előtti elrendezés késve érkező jelentése, azt a hook dönti el
 * (`use-transcript-auto-scroll.ts`).
 */
export function reduceTranscriptAutoScroll(
  state: TranscriptAutoScrollState,
  action: TranscriptAutoScrollAction,
): TranscriptAutoScrollState {
  switch (action.type) {
    case 'rows_rendered': {
      if (isLastRowVisible(action, action.rowCount) && !state.isToggleUnmeasured) {
        return { ...state, isFollowing: true, unseenCount: 0, lastStopIndex: action.stopIndex };
      }
      const hasMovedUp = action.stopIndex < state.lastStopIndex;
      return { ...state, isFollowing: hasMovedUp ? false : state.isFollowing, lastStopIndex: action.stopIndex };
    }
    case 'rows_arrived': {
      if (action.rowCount === state.settledRowCount) {
        return state;
      }
      const arrivedCount = action.rowCount - state.settledRowCount;
      return {
        ...state,
        settledRowCount: action.rowCount,
        unseenCount: action.isFollowed ? 0 : state.unseenCount + arrivedCount,
      };
    }
    case 'jump_requested':
    case 'bottom_reached_while_unmeasured': {
      return { ...state, isFollowing: true, unseenCount: 0, isToggleUnmeasured: false };
    }
    case 'row_toggle_started': {
      return { ...state, isFollowing: false, isToggleUnmeasured: true };
    }
    case 'row_toggle_settled': {
      const settled = { ...state, isToggleUnmeasured: false };
      return isLastRowVisible({ stopIndex: state.lastStopIndex }, state.settledRowCount)
        ? { ...settled, isFollowing: true, unseenCount: 0 }
        : settled;
    }
  }
}
