/**
 * A futás hat állapota (SPEC-003 7.1 szekció). A `waiting_approval` szándékosan
 * nincs itt: az a lépés futás (`StepRunStatus`) állapota, nem a futásé, mert
 * egy futásnak egyszerre lehet váró és futó ága is.
 */
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
