import type { ConcurrencyLimitView, ProviderSummary } from '@easter-workflow-builder/protocol';
import { Alert } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { ConcurrencyLimitRow } from './ConcurrencyLimitRow.tsx';

export interface ConcurrencyLimitsSettingsCardProperties {
  readonly providersState: RequestState<readonly ProviderSummary[]>;
  readonly limitsState: RequestState<readonly ConcurrencyLimitView[]>;
  readonly saveLimit: (providerId: string, maxConcurrentSteps: number) => Promise<RouteOutcome<ConcurrencyLimitView>>;
  readonly clearLimit: (providerId: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A Beállítások "Párhuzamossági korlát" kártyája (SPEC-009 3.1 2. pont):
 * providerenként egy `ConcurrencyLimitRow` sor, a szerver listájának
 * sorrendjében. A provider nevét a képernyő közös provider listája adja; a
 * betöltés alatt csontváz, a betöltés hibája danger `Alert`.
 */
export function ConcurrencyLimitsSettingsCard(
  properties: Readonly<ConcurrencyLimitsSettingsCardProperties>,
): ReactElement {
  const { providersState, limitsState, saveLimit, clearLimit } = properties;
  const headingId = useId();

  function renderBody(): ReactElement {
    if (providersState.status === 'failure') {
      return <Alert variant="danger">{providersState.message}</Alert>;
    }
    if (limitsState.status === 'failure') {
      return <Alert variant="danger">{limitsState.message}</Alert>;
    }
    if (providersState.status !== 'success' || limitsState.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const providers = providersState.value;
    return (
      <>
        {limitsState.value.map((limit) => (
          <ConcurrencyLimitRow
            key={limit.providerId}
            limit={limit}
            providerName={
              providers.find((provider) => provider.id === limit.providerId)?.displayName ?? limit.providerId
            }
            saveLimit={saveLimit}
            clearLimit={clearLimit}
          />
        ))}
      </>
    );
  }

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card__header">
        <h3 id={headingId}>Párhuzamossági korlát</h3>
      </div>
      {renderBody()}
    </section>
  );
}
