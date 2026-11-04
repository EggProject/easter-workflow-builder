import type { SettingsRecord, UpdateSettingsRequest } from '@easter-workflow-builder/protocol';
import { Alert, Switch } from '@easter-workflow-builder/ui';
import { useId, type ChangeEvent, type ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';

export interface RunLogSettingsCardProperties {
  readonly settingsState: RequestState<SettingsRecord>;
  readonly saveSettings: (update: UpdateSettingsRequest) => Promise<RouteOutcome<SettingsRecord>>;
}

/**
 * A Beállítások "Futás napló" kártyája (SPEC-009 3.1 3. pont, O-7): a delta
 * perzisztálás kapcsolója (`persistStreamDeltas`) a `packages/ui` `Switch`
 * komponensével. Az érték alapból kikapcsolt (SPEC-003 6.6); a mondat kimondja,
 * hogy a kapcsoló csak az ezután indított futásokra hat, mert az érték a futás
 * indításakor befagy (`.claude/CLAUDE.md` 10. szekció 3. pont).
 *
 * A kapcsoló a szerver válaszából vezérelt (nincs optimista érték): a váltás
 * azonnal `PUT /api/settings` hívás a `persistStreamDeltas` mezővel, a mentés
 * alatt a kapcsoló tiltott és "Mentés…" állapotszöveg jelzi a várakozást, a
 * hiba danger `Alert` a kód mondatával, és a kapcsoló a legutóbb mentett
 * értéken marad. A betöltés alatt csontváz, a betöltés hibája danger `Alert`.
 */
export function RunLogSettingsCard(properties: Readonly<RunLogSettingsCardProperties>): ReactElement {
  const { settingsState, saveSettings } = properties;
  const headingId = useId();
  const titleId = useId();
  const hintId = useId();
  const saveRequest = useRequestState<SettingsRecord>();

  function renderBody(): ReactElement {
    if (settingsState.status === 'failure') {
      return <Alert variant="danger">{settingsState.message}</Alert>;
    }
    if (settingsState.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const isSaving = saveRequest.state.status === 'pending';
    return (
      <>
        <div className="preference-row">
          <div className="preference-row__body">
            <span className="preference-row__title" id={titleId}>
              Delta események tárolása
            </span>
            <span className="settings-screen__hint" id={hintId}>
              A streamelt részleges szöveg (content_block_delta) a futás előzményeibe is bekerül. A beállítás csak az
              ezután indított futásokra hat: az érték a futás indításakor befagy.
            </span>
            {isSaving && (
              <span className="settings-screen__hint" role="status">
                Mentés…
              </span>
            )}
          </div>
          <Switch
            aria-labelledby={titleId}
            aria-describedby={hintId}
            checked={settingsState.value.persistStreamDeltas}
            disabled={isSaving}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              void saveRequest.run(() => saveSettings({ persistStreamDeltas: event.target.checked }));
            }}
          />
        </div>
        {saveRequest.state.status === 'failure' && <Alert variant="danger">{saveRequest.state.message}</Alert>}
      </>
    );
  }

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card__header">
        <h3 id={headingId}>Futás napló</h3>
      </div>
      {renderBody()}
    </section>
  );
}
