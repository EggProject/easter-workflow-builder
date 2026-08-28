/**
 * A lépés futás nyolc állapota (SPEC-003 7.2 szekció). A `waiting_approval`
 * itt van, nem a `RunStatus`-ban (`workflow-run/run-status.ts`): a
 * várakozás lépés szintű tulajdonság, mert egy futásnak egyszerre lehet
 * váró és futó ága is.
 */
export type StepRunStatus =
  'pending' | 'running' | 'waiting_approval' | 'succeeded' | 'failed' | 'rejected' | 'cancelled' | 'interrupted';
