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
 * **Az érkezés** követés közben nem számol, különben a nem látott sorok
 * számához adódik.
 */
export function reduceTranscriptAutoScroll(
  state: TranscriptAutoScrollState,
  action: TranscriptAutoScrollAction,
): TranscriptAutoScrollState {
  switch (action.type) {
    case 'rows_rendered': {
      if (isLastRowVisible(action, action.rowCount)) {
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
        unseenCount: state.isFollowing ? 0 : state.unseenCount + arrivedCount,
      };
    }
    case 'jump_requested': {
      return { ...state, isFollowing: true, unseenCount: 0 };
    }
  }
}
