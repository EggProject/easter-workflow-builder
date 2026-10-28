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
 * a név alakot nem vizsgálja (azt a központi definíció mentése kényszeríti ki).
 */
export function isMcpServerReference(value: unknown): value is McpServerReference {
  return (
    isRecordWithKnownKeys(value, MCP_SERVER_REFERENCE_KEYS) &&
    isStringRecord(value.envBindings) &&
    (value.authEnvName === null || isString(value.authEnvName))
  );
}
