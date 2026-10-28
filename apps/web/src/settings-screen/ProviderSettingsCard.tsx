import type { ProviderSummary, SettingsRecord, UpdateSettingsRequest } from '@easter-workflow-builder/protocol';
import { Alert } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import { describeRequiredEnvironment } from '../provider-select/describe-required-environment.ts';
import type { ProviderConnectionTester } from '../provider-select/provider-connection-tester.ts';
import { ProviderSelect } from '../provider-select/ProviderSelect.tsx';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';

export interface ProviderSettingsCardProperties {
  readonly providersState: RequestState<readonly ProviderSummary[]>;
  readonly settingsState: RequestState<SettingsRecord>;
  readonly saveSettings: (update: UpdateSettingsRequest) => Promise<RouteOutcome<SettingsRecord>>;
  readonly testConnection: ProviderConnectionTester;
}

/**
 * A Beállítások "Provider" kártyája (SPEC-009 3.1 1. pont): a globális
 * alapértelmezett provider választója a "Kapcsolat teszt" gombbal, alatta a
 * kiválasztott provider kötelező env változóinak NEVE.
 *
 * - **Nincs "nincs" opció** (O-4): az alapértelmezés csak átállítható, nem
 *   törölhető, ezért a választóban nincs üres értékű opció.
 * - **Első indulás** (O-5): alapértelmezés nélkül `warning` `Alert` mondja ki,
 *   hogy az agent lépés így nem indul; kötelező első indulási modális nincs.
 * - A választás azonnal `PUT /api/settings` hívással mentődik; a mentés alatt a
 *   választó betöltés feliratot mutat, a hiba danger `Alert` a kód mondatával,
 *   és a megjelenített érték a szerver válaszából jön.
 * - A betöltés alatt csontváz, a betöltés hibája danger `Alert`.
 */
export function ProviderSettingsCard(properties: Readonly<ProviderSettingsCardProperties>): ReactElement {
  const { providersState, settingsState, saveSettings, testConnection } = properties;
  const headingId = useId();
  const selectId = useId();
  const saveRequest = useRequestState<SettingsRecord>();

  function renderBody(): ReactElement {
    if (providersState.status === 'failure') {
      return <Alert variant="danger">{providersState.message}</Alert>;
    }
    if (settingsState.status === 'failure') {
      return <Alert variant="danger">{settingsState.message}</Alert>;
    }
    if (providersState.status !== 'success' || settingsState.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }

    const defaultProviderId = settingsState.value.defaultProviderId;
    const selectedProvider = providersState.value.find((provider) => provider.id === defaultProviderId);
    return (
      <>
        {defaultProviderId === null && (
          <Alert variant="warning" title="Nincs alapértelmezett provider">
            Az az agent lépés, amelynek sem a workflow-ja, sem a lépése nem ad meg providert, nem indul el. Válassz egy
            alapértelmezett providert.
          </Alert>
        )}
        <div className="preference-row">
          <div className="preference-row__body">
            <label className="preference-row__title" htmlFor={selectId}>
              Globális alapértelmezett provider
            </label>
            {selectedProvider !== undefined && (
              <span className="settings-screen__hint">
                {describeRequiredEnvironment(selectedProvider.requiredEnvNames)}
              </span>
            )}
          </div>
          <ProviderSelect
            id={selectId}
            size="sm"
            providers={providersState.value}
            value={defaultProviderId ?? ''}
            placeholder="Válassz providert"
            loading={saveRequest.state.status === 'pending'}
            loadingLabel="Mentés…"
            testConnection={testConnection}
            onChange={(providerId) => {
              void saveRequest.run(() => saveSettings({ defaultProviderId: providerId }));
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
        <h3 id={headingId}>Provider</h3>
      </div>
      {renderBody()}
    </section>
  );
}
