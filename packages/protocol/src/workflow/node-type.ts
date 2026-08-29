import { z } from 'zod';

/**
 * A workflow gráf tíz node típusa, drótszintű felsorolásként (SPEC-005 9.
 * szekció `workflow` téma, SPEC-003 4.3 táblázat). A `protocol` L1, tehát a
 * `db` (L2) `NodeType` unióját nem importálhatja (SPEC-005 F-23, 7.6
 * szekció): ez a felsorolás szándékos duplikáció, a sodródás védelmét az
 * `apps/server` regressziós tesztje adja (T-006-12).
 */
export const NodeTypeSchema = z.enum([
  'start',
  'agent_step',
  'branch',
  'fan_out',
  'join',
  'loop',
  'human_approval',
  'error_handler',
  'sub_workflow',
  'script',
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;
