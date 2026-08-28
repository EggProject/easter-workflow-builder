/**
 * A `branch_taken` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `branch_taken` sor): egy `branch` node lefutásakor íródik. A `branchKey`
 * `null`, ha a `branch` node az alapértelmezett élre lépett.
 */
export interface BranchTakenPayload {
  readonly branchKey: string | null;
  readonly usedDefault: boolean;
}
