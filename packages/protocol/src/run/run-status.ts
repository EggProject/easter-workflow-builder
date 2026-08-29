import { z } from 'zod';

/**
 * A futás hat állapota, drótszintű felsorolásként (SPEC-003 7.1 szekció,
 * SPEC-005 7.6 szekció). A `protocol` L1, tehát a `db` (L2) `RunStatus`
 * unióját nem importálhatja: szándékos duplikáció, a sodródás védelmét az
 * `apps/server` regressziós tesztje adja (T-006-12).
 */
export const RunStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted']);

export type RunStatus = z.infer<typeof RunStatusSchema>;

/**
 * A lépés futás nyolc állapota, drótszintű felsorolásként (SPEC-003 7.2
 * szekció, SPEC-005 7.6 szekció). Ugyanaz a duplikációs indok, mint a
 * `RunStatusSchema`-nál.
 */
export const StepRunStatusSchema = z.enum([
  'pending',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'rejected',
  'cancelled',
  'interrupted',
]);

export type StepRunStatus = z.infer<typeof StepRunStatusSchema>;
