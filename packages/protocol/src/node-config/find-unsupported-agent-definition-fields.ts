import { isRecord, isString } from '@easter-workflow-builder/typeguards';

function unsupportedPathsOf(agentName: string, definition: unknown): readonly (readonly string[])[] {
  if (!isRecord(definition)) {
    return [];
  }
  const found: (readonly string[])[] = [];
  if (Object.hasOwn(definition, 'memory')) {
    found.push(['agents', agentName, 'memory']);
  }
  const servers = definition['mcpServers'];
  if (Array.isArray(servers) && servers.some((element: unknown) => !isString(element))) {
    found.push(['agents', agentName, 'mcpServers']);
  }
  return found;
}

/**
 * Az agent definíciók nem támogatott mezői a lépés alakú konfigban (SPEC-009 6.2, O-53, user döntés
 * 2026-10-28): a `memory` mező (a d.ts szerint a gép `~/.claude/agent-memory/` vagy a projekt
 * `.claude/agent-memory/` könyvtárát tölti be), és a régi `mcpServers` lista nem szöveg (közvetlen
 * szerver objektum) eleme, ami a központi MCP listát megkerülné. A szöveg elem (név hivatkozás a lépés
 * szervereire) megengedett. Az útvonal a mezőre horgonyoz (`agents.<név>.memory`,
 * `agents.<név>.mcpServers`), az érték nem jelenik meg. Csak az írás oldala szigorodik: az `agents`
 * rekord az olvasó sémákban szűkítetlen (`.claude/CLAUDE.md` 5. szekció), és a motor a két mezőt a
 * tárolt adatból sem adja ki (`resolveOutgoingAgents`).
 */
export function findUnsupportedAgentDefinitionFields(agentStep: unknown): readonly (readonly string[])[] {
  const agents = isRecord(agentStep) ? agentStep['agents'] : undefined;
  if (!isRecord(agents)) {
    return [];
  }
  return Object.entries(agents).flatMap(([agentName, definition]) => unsupportedPathsOf(agentName, definition));
}
