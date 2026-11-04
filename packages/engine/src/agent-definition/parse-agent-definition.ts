import { isMcpServerReference, type McpServerReference } from '@easter-workflow-builder/db';
import { isEnvironmentVariableName, isRecord, isStringArray } from '@easter-workflow-builder/typeguards';
import type { ParsedAgentDefinition } from './parsed-agent-definition.ts';

function isStoredSkills(value: unknown): value is ParsedAgentDefinition['skills'] {
  return value === null || value === 'all' || isStringArray(value);
}

/**
 * A hivatkozás szerver oldali nevei env változó név alakúak (SPEC-009 6.1,
 * T-012-27): az `envBindings` minden értéke és a nem `null` `authEnvName`. A
 * lépés azonos mezőjét a `protocol` mentési sémája ellenőrzi; az `agents`
 * rekord ott szűkítetlen, ezért az agent definícióét a motor.
 */
function hasEnvironmentVariableNames(reference: McpServerReference): boolean {
  return (
    Object.values(reference.envBindings).every((name) => isEnvironmentVariableName(name)) &&
    (reference.authEnvName === null || isEnvironmentVariableName(reference.authEnvName))
  );
}

function isMcpServerReferenceRecord(value: unknown): value is Readonly<Record<string, McpServerReference>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (reference: unknown) => isMcpServerReference(reference) && hasEnvironmentVariableNames(reference),
    )
  );
}

/**
 * Egy agent definíció olvasása a motor két mezőjére (SPEC-009 5.2, 6.2,
 * M-147). Az `agents` rekord a `db` és a `protocol` oldalon szűkítetlen
 * (`Readonly<Record<string, unknown>>`, `.claude/CLAUDE.md` 5. szekció),
 * ezért az alakot itt kell ellenőrizni: `undefined` a válasz, ha az érték nem
 * objektum, a `skills` nem lista, `'all'` vagy `null`, a
 * `mcpServerReferences` nem hivatkozás rekord (vagy egy szerver oldali neve
 * nem env változó név alakú), vagy a régi `mcpServers` SDK
 * mező jelen van, de nem lista (a `AgentDefinition.mcpServers` tömb, telepített
 * `sdk.d.ts`). A hívó ezt `malformed_node_config` hibára képezi.
 */
export function parseAgentDefinition(value: unknown): ParsedAgentDefinition | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  // eslint-disable-next-line unicorn/no-null -- a hiányzó `skills` kulcs a tárolt alak `null` értéke (SPEC-003 4.4)
  const { skills = null, mcpServerReferences = {}, ...rest } = value;
  if (!isStoredSkills(skills) || !isMcpServerReferenceRecord(mcpServerReferences)) {
    return undefined;
  }
  if (rest['mcpServers'] !== undefined && !Array.isArray(rest['mcpServers'])) {
    return undefined;
  }
  return { rest, skills, mcpServerReferences };
}
