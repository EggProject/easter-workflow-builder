import { isRecordWithKnownKeys, isString, isStringRecord } from '@easter-workflow-builder/typeguards';
import type { McpServerReference } from './mcp-server-reference.ts';

// Zárt kulcslista: a `Record<keyof T, true>` annotáció miatt a fordító hibát
// ad, ha a típus mezővel bővül, de a lista nem.
const MCP_SERVER_REFERENCE_KEYS: Readonly<Record<keyof McpServerReference, true>> = {
  envBindings: true,
  authEnvName: true,
};

/**
 * Typeguard egy központi MCP szerver definícióra mutató hivatkozás alakjára
 * (SPEC-009 6.2, O-42 (b)): a lépés `mcpServerReferences` rekordjának és az
 * agent definíció azonos nevű mezőjének értéke. Ismeretlen kulcsot nem enged,
 * a név alakot nem vizsgálja (azt a `protocol` mentési sémája kényszeríti ki).
 *
 * Az `envBindings` saját `__proto__` kulcsát (a `JSON.parse` így hozza létre)
 * elutasítja: a `protocol` `z.record` sémája egy ilyen kulcsot csendben
 * eldobna, a két oldal tehát csak elutasítással dönthet egyformán (T-012-27).
 */
export function isMcpServerReference(value: unknown): value is McpServerReference {
  return (
    isRecordWithKnownKeys(value, MCP_SERVER_REFERENCE_KEYS) &&
    isStringRecord(value.envBindings) &&
    !Object.hasOwn(value.envBindings, '__proto__') &&
    (value.authEnvName === null || isString(value.authEnvName))
  );
}
