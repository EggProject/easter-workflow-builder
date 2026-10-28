import { ProviderIdSchema } from '@easter-workflow-builder/protocol';
import { createContext } from 'react';
import type { ProviderOptions } from './provider-options.ts';

/**
 * A "Provider felülírás" mező opciói a panel fájának mélyén (SPEC-008 9.
 * szekció 4. async pontja). Kontextus és nem prop a `field-errors-context.ts`
 * indoklásával: a mező az `agent_step` és a `join` `ai_synthesis` módjának
 * komponensében áll, a köztes szinteknek nincs dolga az értékkel. Az
 * alapérték a protokoll konstansa betöltés nélkül és kapcsolat teszt nélkül
 * (a gomb ilyenkor tiltott), tehát az önálló komponens teszt szolgáltató nélkül
 * is változatlanul renderel; az egyetlen éles szolgáltató a
 * `GraphEditorScreen`.
 *
 * Az alapérték szándékosan puszta adat, nem függvény: egy e2e úton
 * elérhetetlen alapérték-függvény a fedetlen e2e tételek számát növelné
 * (`.claude/CLAUDE.md` 8. szekció, ratchet; ugyanez a minta a
 * `skill-library-context.ts` fájlban).
 */
export const ProviderOptionsContext = createContext<ProviderOptions>({
  isLoading: false,
  providerIds: ProviderIdSchema.options,
  testConnection: undefined,
});
