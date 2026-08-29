import { query } from '@anthropic-ai/claude-agent-sdk';
import { createAgentQueryRunner, type AgentQueryRunner } from '@easter-workflow-builder/agent';

/**
 * A valódi Agent SDK `query()` függvényének bekötése (SPEC-004 1. és 3.1
 * szekció, `packages/agent` `sdk-query-function.ts` doksija: "A valódi
 * query() bekötése az apps/server összeállítás dolga"). A `query` erre a
 * portra port-kompatibilis alakú, `as` kényszerítés nélkül (lásd ott).
 */
export function buildAgentQueryRunner(): AgentQueryRunner {
  return createAgentQueryRunner(query);
}
