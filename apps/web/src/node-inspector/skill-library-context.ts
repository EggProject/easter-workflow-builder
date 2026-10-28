import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { createContext } from 'react';
import type { RequestState } from '../request-state/request-state.ts';

/**
 * A skill könyvtár betöltési állapota a panel fájának mélyén (SPEC-009 5.2):
 * a `skills` mező listás módjának jelölőnégyzetei ebből a nevek listájából
 * épülnek. Kontextus és nem prop a `provider-options-context.ts`
 * indoklásával: a mező az `agent_step`, a `join` `ai_synthesis` módja és az
 * `agents` bejegyzések komponenseiben áll, a köztes szinteknek nincs dolga az
 * értékkel. Az egyetlen éles szolgáltató a `GraphEditorScreen`.
 *
 * Az alapérték szándékosan puszta adat (üres, betöltött könyvtár), nem
 * függvény: egy e2e úton elérhetetlen alapérték-függvény a fedetlen e2e
 * tételek számát növelné (`.claude/CLAUDE.md` 8. szekció, ratchet).
 */
export const SkillLibraryContext = createContext<RequestState<readonly SkillSummary[]>>({
  status: 'success',
  value: [],
});
