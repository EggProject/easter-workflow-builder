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
 * **Egy sor kinyitása vagy becsukása** szünetelteti a követést, és amíg a
 * szünet tart, egy jelentés a követést nem kapcsolhatja vissza. A becsukás
 * szünete a lista méréséig tart (addig a jelentések a mérés előtti
 * elrendezést írják le), utána a predikátum dönt, az utolsó jelentés
 * szerint. A kinyitás szünete a mérés után is megmarad (user döntés
 * 2026-09-25): a kinyitott sor akkor is a helyén marad, ha maga az utolsó
 * sor, és a mérés utáni jelentés szerint látszik. A szünetet az ugrás gomb,
 * a kézi visszatérés az aljára és a váltások visszaállása (páros számú
 * kattintás ugyanazon a fejlécen) zárja; hogy melyik váltás mikor zárul, a
 * hook tartja nyilván (`use-transcript-auto-scroll.ts`).
 *
 * **A kézi visszatérés az aljára** (user döntés 2026-09-24) visszakapcsolja
 * a követést. Hogy a jelentés valóban visszatérés-e, nem pedig a kattintás
 * előtti elrendezés késve érkező jelentése, vagy egy kinyitott utolsó sor
 * görgetése, azt a hook dönti el: a szünet alatt a listának előbb el kell
 * hagynia az alját.
 */
export function reduceTranscriptAutoScroll(
  state: TranscriptAutoScrollState,
  action: TranscriptAutoScrollAction,
): TranscriptAutoScrollState {
  switch (action.type) {
    case 'rows_rendered': {
      if (isLastRowVisible(action, action.rowCount) && !state.isPausedByToggle) {
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
    case 'bottom_reached_while_paused': {
      return { ...state, isFollowing: true, unseenCount: 0, isPausedByToggle: false };
    }
    case 'row_toggle_started': {
      return { ...state, isFollowing: false, isPausedByToggle: true };
    }
    case 'row_toggle_settled': {
      const settled = { ...state, isPausedByToggle: false };
      return isLastRowVisible({ stopIndex: state.lastStopIndex }, state.settledRowCount)
        ? { ...settled, isFollowing: true, unseenCount: 0 }
        : settled;
    }
  }
}
