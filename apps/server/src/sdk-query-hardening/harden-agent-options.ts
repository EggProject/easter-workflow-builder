import { isRecord } from '@easter-workflow-builder/typeguards';
import { wrapStdioServers } from './wrap-stdio-servers.ts';

/**
A `hardenAgentOptions` eredménye: a módosított `Options` és a parancssorból kivett `mcpServers` rekord.
*/
export interface HardenedAgentOptions {
  readonly options: Readonly<Record<string, unknown>>;
  readonly mcpServers: Readonly<Record<string, unknown>> | undefined;
}

function hardenAgentDefinition(definition: unknown): unknown {
  if (!isRecord(definition) || !Array.isArray(definition['mcpServers'])) {
    return definition;
  }
  const servers: readonly unknown[] = definition['mcpServers'];
  return { ...definition, mcpServers: servers.map((element) => wrapStdioServers(element)) };
}

/**
 * A motor kimenő `Options` objektumának szállítás előtti átalakítása (SPEC-009 6.4, O-45, O-52):
 *
 * 1. A lépés `mcpServers` rekordja kikerül az `Options`-ból: a hívó egy `0600` jogú ideiglenes fájlba
 *    írja, és az `extraArgs` `mcp-config` kulcsával adja át, mert az SDK a rekordot különben
 *    `--mcp-config <JSON>` parancssori argumentumként adja a CLI-nek, és a feloldott titok a
 *    folyamatlistában látszana (telepített `sdk.mjs`, research `2026-10-28-plan-012-vegrehajtas.md`
 *    4.5).
 * 2. Minden stdio szerver (a lépésé és az agent definíciók objektum elemei) az indító programon át
 *    fut (`wrapStdioServers`).
 *
 * A többi mező változatlan; `mcpServers` nélkül az `Options` is változatlan, kivéve az agent
 * definíciók stdio elemeit.
 */
export function hardenAgentOptions(options: Readonly<Record<string, unknown>>): HardenedAgentOptions {
  const { mcpServers, agents, ...rest } = options;
  const hardenedAgents = isRecord(agents)
    ? Object.fromEntries(Object.entries(agents).map(([name, definition]) => [name, hardenAgentDefinition(definition)]))
    : agents;
  const wrappedServers = wrapStdioServers(mcpServers);
  return {
    options: { ...rest, ...(agents !== undefined && { agents: hardenedAgents }) },
    mcpServers: isRecord(wrappedServers) ? wrappedServers : undefined,
  };
}
