import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { createContext } from 'react';
import type { RequestState } from '../request-state/request-state.ts';

/**
 * A központi MCP szerver lista és a szerver környezeti változóinak NEVEI a
 * beállítás panel fájának mélyén (SPEC-009 6.2): a lépés és az agent
 * definíció `mcpServerReferences` mezője ebből választ. Kontextus és nem
 * prop a `skill-library-context.ts` indoklásával: a mező az `agent_step`, a
 * `join` `ai_synthesis` módja és az `agents` bejegyzések komponenseiben áll,
 * a köztes szinteknek nincs dolga az értékkel. Az egyetlen éles szolgáltató
 * a `GraphEditorScreen`.
 *
 * Az alapérték szándékosan puszta adat (üres, betöltött lista), nem
 * függvény: egy e2e úton elérhetetlen alapérték-függvény a fedetlen e2e
 * tételek számát növelné (`.claude/CLAUDE.md` 8. szekció, ratchet).
 */
export const McpServerLibraryContext = createContext<{
  readonly servers: RequestState<readonly McpServerDefinitionRecord[]>;
  readonly environmentNames: RequestState<readonly string[]>;
}>({
  servers: { status: 'success', value: [] },
  environmentNames: { status: 'success', value: [] },
});
