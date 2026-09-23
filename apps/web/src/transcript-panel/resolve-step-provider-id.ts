import { ProviderIdSchema, type ProviderId, type StepRunRecord } from '@easter-workflow-builder/protocol';

/**
 * Egy transcript sor lépésének ténylegesen feloldott providere (SPEC-008
 * 7.1, T-009-25): a `stepRunId` alapján kikeresett `StepRunRecord.providerId`
 * mező, amit az engine a háromszintű feloldás eredményeként ír a lépés futás
 * sorába. A modell név szövegéből nem találgatunk.
 *
 * `undefined`, ha a sornak nincs lépése, ha a lépés futás nincs a betöltött
 * listában, vagy ha a tárolt érték nem ismert provider azonosító (a
 * `StepRunRecord.providerId` a dróton szabad `string`). A szűkítés a
 * `ProviderIdSchema` felsorolásán megy, ugyanúgy, mint a
 * `node-inspector/AgentStepConfigFields.tsx` választójában.
 */
export function resolveStepProviderId(
  stepRuns: readonly StepRunRecord[],
  stepRunId: string | null,
): ProviderId | undefined {
  const stepRun = stepRuns.find((candidate) => candidate.id === stepRunId);
  return ProviderIdSchema.options.find((option) => option === stepRun?.providerId);
}
