import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { StartRunRequest, StartedRun } from '../run-supervisor/run-supervisor.ts';
import type { ApprovalDecisionInput } from './approval-decision-input.ts';
import type { ConcurrencySuggestion } from './concurrency-suggestion.ts';
import type { ConnectionTestResult } from './connection-test-result.ts';
import type { InterruptSummary } from './interrupt-summary.ts';
import type { ShutdownSummary } from './shutdown-summary.ts';

/**
 * A motor teljes, kifelé mutatott felülete (SPEC-004 3.1 szekció, szó
 * szerint a spec `Engine` blokkja), amit a `createEngine(dependencies)`
 * (`create-engine.ts`) állít elő. Mind a hét metódus itt áll, egy fájlban,
 * mert ez egyetlen, oszthatatlan szerződés - a `apps/server` (L6) ezen a hét
 * metóduson keresztül éri el a motort, más felületen át nem.
 */
export interface Engine {
  readonly startRun: (request: StartRunRequest) => Promise<Outcome<StartedRun>>;
  readonly interruptRun: (runId: string) => Promise<Outcome<InterruptSummary>>;
  readonly decideApproval: (input: ApprovalDecisionInput) => Promise<Outcome<void>>;
  readonly restartRun: (runId: string) => Promise<Outcome<StartedRun>>;
  readonly suggestedConcurrencyLimit: (providerId: ProviderId) => ConcurrencySuggestion;
  readonly testProviderConnection: (providerId: ProviderId) => Promise<Outcome<ConnectionTestResult>>;
  readonly shutdown: () => Promise<Outcome<ShutdownSummary>>;
}
