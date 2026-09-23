import { FeedIndicator, type FeedIndicatorState } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import type { StreamConnectionPhase } from '../stream-client/use-stream-connection.ts';
import { useIsDarkTheme } from '../themed-skeleton/use-is-dark-theme.ts';

interface StreamStatusPresentation {
  readonly state: FeedIndicatorState;
  readonly label: string;
}

/**
 * A négy stream fázis leképezése a design system `FeedIndicator` forrás
 * állapotaira (SPEC-007 11. szekció 14 ... 16. async pont, 2026-09-23). A
 * forrás taxonómiája szerint a `connecting` "tárcsáz, hamarosan jön adat", a
 * `streaming` "élő frissítéseket kap", a `disconnected` "nincs kapcsolat".
 *
 * - `connecting` -> `connecting`: az első kapcsolódás.
 * - `replaying` -> `connecting`: a kapcsolat nyitva, de a pótlás végéig a
 *   nézet még nem élő, tehát "hamarosan jön az élő adat".
 * - `reconnecting` -> `disconnected`: a kapcsolat megszakadt, a böngésző újra
 *   próbálja; a szakadásnak láthatónak kell lennie (SPEC-007 11. szekció 16.
 *   pont), és a forrás ink példája is `disconnected` állapotot ad az
 *   újracsatlakozó forrásnak.
 * - `live` -> `streaming`.
 *
 * A forrás `stale` és `idle` állapotára nincs megfelelő fázisunk.
 */
const STREAM_STATUS_PRESENTATION: Readonly<Record<StreamConnectionPhase, StreamStatusPresentation>> = {
  connecting: { state: 'connecting', label: 'kapcsolódás' },
  replaying: { state: 'connecting', label: 'előzmények betöltése' },
  reconnecting: { state: 'disconnected', label: 'újracsatlakozás' },
  live: { state: 'streaming', label: 'élő' },
};

export interface StreamStatusIndicatorProperties {
  readonly phase: StreamConnectionPhase;
}

/**
 * A topnav `.app-tn__actions` sávjának stream kapcsolat jelzője, a design
 * system `FeedIndicator` komponensén (a korábbi nyers `<span>` helyett). A
 * felület sötét témában a forrás `ink` változata, ugyanazzal a feloldással,
 * mint a `ThemedSkeleton` (`useIsDarkTheme`, user döntés 2026-09-23 a
 * skeleton `ink` változatára): a forrás nem kompakt alakja `role="status"`
 * élő régió, a forrás `"<felirat> feed"` angol neve helyett a hozzáférhető név
 * magyar, a forrás saját attribútum továbbadásán át.
 */
export function StreamStatusIndicator(properties: Readonly<StreamStatusIndicatorProperties>): ReactElement {
  const { state, label } = STREAM_STATUS_PRESENTATION[properties.phase];
  const isDarkTheme = useIsDarkTheme();

  return (
    <FeedIndicator
      state={state}
      label={label}
      surface={isDarkTheme ? 'ink' : 'paper'}
      aria-label={`Stream kapcsolat: ${label}`}
    />
  );
}
