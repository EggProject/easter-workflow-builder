import { z } from 'zod';

/**
 * A két provider azonosítója, drótszintű felsorolásként (SPEC-000 5.,
 * `.claude/CLAUDE.md` 9. szekció). A `protocol` L1, tehát a
 * `provider-capability` (szintén L1, `tooling/scripts/src/dependency-graph/
 * package-layer.ts`) `ProviderId` típusát nem importálhatja: egy L1 csomag
 * másik L1 csomagra nem hivatkozhat (`bun run check:graph`). Ez a felsorolás
 * ezért szándékos duplikáció, ugyanaz a minta, mint a hat, `db`-vel szemben
 * duplikált felsorolás (`workflow/node-type.ts`); a sodródás védelmét a
 * `node-config` téma esetében is az `apps/server` regressziós tesztje adja
 * (PLAN-009 T-009-13).
 */
export const ProviderIdSchema = z.enum(['claude-subscription', 'minimax']);

export type ProviderId = z.infer<typeof ProviderIdSchema>;
