import { BLANK_FIELD_MESSAGE, type NodeConfig } from '@easter-workflow-builder/protocol';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { AGENT_DEFINITION_FIELD_TABLE } from './agent-definition-field-table.ts';
import type { ZodIssueLike } from './field-errors-from-zod-error.ts';

const REQUIRED_AGENT_DEFINITION_FIELD_KEYS: readonly string[] = AGENT_DEFINITION_FIELD_TABLE.filter(
  (field) => field.required,
).map((field) => field.key);

interface LocatedAgents {
  readonly path: readonly string[];
  readonly agents: Readonly<Record<string, unknown>>;
}

function locateAgents(config: NodeConfig): LocatedAgents | undefined {
  if (config.type === 'agent_step') {
    return { path: ['agents'], agents: config.agents };
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return { path: ['settings', 'agents'], agents: config.settings.agents };
  }
  return undefined;
}

function isBlankAgentDefinitionField(value: unknown): boolean {
  return !isString(value) || value.trim() === '';
}

/**
 * Az `agents` bejegyzések üres kötelező mezői (SPEC-008 5.2, 5.4; user döntés
 * 2026-10-17, O-38, "Üresen ne legyen menthető."): a `agent-definition-field-table.ts`
 * `required: true` sorai (`description`, `prompt`) bejegyzésenként, a mező
 * `config`-on belüli útvonalán (`agents.<név>.description`, a `join`
 * `ai_synthesis` módjában `settings.agents.<név>.description`), a mentési séma
 * üres mező mondatával. Az "üres" jelentése a kötelező szöveg mezőké: üres
 * vagy csak szóközből áll; a hiányzó és a nem szöveg érték is az, mert az
 * űrlap ezt üres mezőként mutatja (`AgentDefinitionEntryFields`).
 *
 * Miért nem a mentési sémában: az `agents` a `db` oldalon `Record<string,
 * unknown>`, tehát a `protocol` séma sem szűkíti (`.claude/CLAUDE.md` 5.
 * szekció); ez az űrlap saját ellenőrzése. A nem objektum alakú bejegyzésnek
 * nincs szerkeszthető mezője (az űrlap meg is nevezi), tehát nincs hova
 * horgonyozni a hibát, és nem kap ilyet.
 */
export function findBlankAgentDefinitionFields(config: NodeConfig): readonly ZodIssueLike[] {
  const located = locateAgents(config);
  if (located === undefined) {
    return [];
  }
  return Object.entries(located.agents).flatMap(([name, entry]) =>
    isRecord(entry)
      ? REQUIRED_AGENT_DEFINITION_FIELD_KEYS.filter((key) => isBlankAgentDefinitionField(entry[key])).map((key) => ({
          path: [...located.path, name, key],
          message: BLANK_FIELD_MESSAGE,
        }))
      : [],
  );
}
