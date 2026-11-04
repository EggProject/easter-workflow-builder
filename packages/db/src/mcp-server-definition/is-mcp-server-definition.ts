import {
  isRecord,
  isRecordWithKnownKeys,
  isString,
  isStringArray,
  isStringRecord,
} from '@easter-workflow-builder/typeguards';
import type {
  HttpMcpServerDefinition,
  McpServerDefinition,
  SseMcpServerDefinition,
  StdioMcpServerDefinition,
} from './mcp-server-definition.ts';

// Zárt kulcslisták ágankénti: a `Record<keyof T, true>` annotáció miatt a
// fordító hibát ad, ha egy ág mezővel bővül, de a lista nem.
const STDIO_KEYS: Readonly<Record<keyof StdioMcpServerDefinition, true>> = {
  type: true,
  command: true,
  args: true,
  envNames: true,
  envBindings: true,
};

const SSE_KEYS: Readonly<Record<keyof SseMcpServerDefinition, true>> = {
  type: true,
  url: true,
  authEnvName: true,
};

const HTTP_KEYS: Readonly<Record<keyof HttpMcpServerDefinition, true>> = {
  type: true,
  url: true,
  authEnvName: true,
};

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

/**
 * Typeguard a központi MCP szerver definíció alakjára (SPEC-009 6.1). A
 * bemenet `unknown`, mert az adatbázis JSON oszlopa nem bizonyíték a típusra.
 * Minden ágon elutasítja az ismeretlen kulcsot, tehát egy érték rekordot
 * hordozó `env` vagy `headers` mező sem jut át. A név és az env változó név
 * alakját nem vizsgálja: azt a `protocol` mentési sémája kényszeríti ki.
 */
export function isMcpServerDefinition(value: unknown): value is McpServerDefinition {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['type']) {
    case 'stdio': {
      return (
        isRecordWithKnownKeys(value, STDIO_KEYS) &&
        isString(value.command) &&
        isStringArray(value.args) &&
        isStringArray(value.envNames) &&
        isStringRecord(value.envBindings)
      );
    }
    case 'sse': {
      return isRecordWithKnownKeys(value, SSE_KEYS) && isString(value.url) && isNullableString(value.authEnvName);
    }
    case 'http': {
      return isRecordWithKnownKeys(value, HTTP_KEYS) && isString(value.url) && isNullableString(value.authEnvName);
    }
    default: {
      return false;
    }
  }
}
