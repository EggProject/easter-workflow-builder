import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type {
  AgentToolId,
  ProviderId,
  StructuredOutputStrategyId,
  ThinkingMode,
} from '@easter-workflow-builder/provider-capability';
import { isBoolean, isNumber, isRecord, isString, isStringArray } from '@easter-workflow-builder/typeguards';
import type { AgentStepConfig, PresetSystemPrompt, StructuredOutputConfig } from './agent-step-config.ts';
import type { EngineHookId } from './engine-hook-id.ts';
import type { SandboxConfig } from './sandbox-config.ts';
import type { SessionMode } from './session-mode.ts';
import type { StorableMcpServer } from './storable-mcp-server.ts';

// A zárt értékkészletek kulcsonként. A `Record<Unió, true>` annotáció miatt a
// fordító hibát ad, ha az unió bővül, de a lista nem.
const THINKING_MODE_KEYS: Readonly<Record<ThinkingMode, true>> = {
  disabled: true,
  adaptive: true,
  always_on: true,
};

const AGENT_TOOL_ID_KEYS: Readonly<Record<AgentToolId, true>> = {
  web_search: true,
  web_fetch: true,
  understand_image: true,
};

const ENGINE_HOOK_ID_KEYS: Readonly<Record<EngineHookId, true>> = {
  emit_output_tool_stop: true,
};

const SESSION_MODE_KEYS: Readonly<Record<SessionMode, true>> = {
  isolated: true,
  continued: true,
};

const STRUCTURED_OUTPUT_STRATEGY_KEYS: Readonly<Record<StructuredOutputStrategyId, true>> = {
  emit_output_tool: true,
  sdk_output_format: true,
};

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || isBoolean(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isSessionMode(value: unknown): value is SessionMode {
  return isString(value) && Object.hasOwn(SESSION_MODE_KEYS, value);
}

function isEngineHookIdArray(value: unknown): value is readonly EngineHookId[] {
  return (
    Array.isArray(value) &&
    value.every((element: unknown) => isString(element) && Object.hasOwn(ENGINE_HOOK_ID_KEYS, element))
  );
}

function isAgentToolIdArray(value: unknown): value is readonly AgentToolId[] {
  return (
    Array.isArray(value) &&
    value.every((element: unknown) => isString(element) && Object.hasOwn(AGENT_TOOL_ID_KEYS, element))
  );
}

function isNullableThinkingMode(value: unknown): value is ThinkingMode | null {
  return value === null || (isString(value) && Object.hasOwn(THINKING_MODE_KEYS, value));
}

function isNullableProviderId(value: unknown): value is ProviderId | null {
  return value === null || isProviderId(value);
}

/**
`Options.skills`: névlista, a mindent engedő `'all'`, vagy nincs beállítva.
*/
function isSkills(value: unknown): value is readonly string[] | 'all' | null {
  return value === null || value === 'all' || isStringArray(value);
}

function isPresetSystemPrompt(value: unknown): value is PresetSystemPrompt {
  return (
    isRecord(value) &&
    value['type'] === 'preset' &&
    value['preset'] === 'claude_code' &&
    isNullableString(value['append']) &&
    isNullableBoolean(value['excludeDynamicSections'])
  );
}

/**
`Options.systemPrompt` két alakja, plusz a "nincs beállítva" eset.
*/
function isSystemPrompt(value: unknown): value is string | PresetSystemPrompt | null {
  return value === null || isString(value) || isPresetSystemPrompt(value);
}

/**
 * A tárolható MCP szerver három variánsa. Az `sdk` variáns szándékosan
 * elutasított: nem szerializálható. Titkot egyik ág sem fogad el, csak env
 * változó nevet (`envNames`, `authEnvName`).
 */
function isStorableMcpServer(value: unknown): value is StorableMcpServer {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['type']) {
    case 'stdio': {
      return isString(value['command']) && isStringArray(value['args']) && isStringArray(value['envNames']);
    }
    case 'sse':
    case 'http': {
      return isString(value['url']) && isNullableString(value['authEnvName']);
    }
    default: {
      return false;
    }
  }
}

function isMcpServerRecord(value: unknown): value is Readonly<Record<string, StorableMcpServer>> {
  return isRecord(value) && Object.values(value).every((server: unknown) => isStorableMcpServer(server));
}

/**
 * Az `Options.sandbox` öt, forrásból levezethető alakú mezőjét ellenőrzi. A
 * másik öt mező alakja nyitott (lásd `sandbox-config.ts`), ezért azokat a
 * guard szándékosan nem szűkíti: tippelni tilos.
 */
function isSandboxConfig(value: unknown): value is SandboxConfig {
  return (
    isRecord(value) &&
    isBoolean(value['enabled']) &&
    isBoolean(value['failIfUnavailable']) &&
    isBoolean(value['autoAllowBashIfSandboxed']) &&
    isBoolean(value['enableWeakerNestedSandbox']) &&
    isStringArray(value['excludedCommands'])
  );
}

function isNullableSandboxConfig(value: unknown): value is SandboxConfig | null {
  return value === null || isSandboxConfig(value);
}

function isStructuredOutputConfig(value: unknown): value is StructuredOutputConfig {
  if (!isRecord(value)) {
    return false;
  }
  const strategy = value['strategy'];
  // A `schema` JSON Schema dokumentum, `unknown` a séma szintjén (4.6), ezért
  // csak a kulcs meglétét követeljük meg, az alakját nem.
  return isString(strategy) && Object.hasOwn(STRUCTURED_OUTPUT_STRATEGY_KEYS, strategy) && 'schema' in value;
}

function isNullableStructuredOutputConfig(value: unknown): value is StructuredOutputConfig | null {
  return value === null || isStructuredOutputConfig(value);
}

/**
 * Typeguard az `AgentStepConfig` alakra (SPEC-003 4.4 és 9.4 szekció). A
 * bemenet `unknown`, mert az adatbázisból jövő JSON nem bizonyíték a típusra.
 * Az ellenőrzés minden mezőre kiterjed, a beágyazott rekordokra (`mcpServers`)
 * és objektumokra (`sandbox`, `systemPrompt`, `structuredOutput`) is.
 */
export function isAgentStepConfig(value: unknown): value is AgentStepConfig {
  return (
    isRecord(value) &&
    isString(value['promptTemplate']) &&
    isNullableProviderId(value['providerId']) &&
    isNullableString(value['modelId']) &&
    isNullableString(value['effort']) &&
    isNullableThinkingMode(value['thinking']) &&
    isStringArray(value['allowedTools']) &&
    isStringArray(value['disallowedTools']) &&
    isNullableString(value['permissionMode']) &&
    isNullableNumber(value['maxTurns']) &&
    isNullableNumber(value['maxBudgetUsd']) &&
    isSystemPrompt(value['systemPrompt']) &&
    isRecord(value['agents']) &&
    isSkills(value['skills']) &&
    isMcpServerRecord(value['mcpServers']) &&
    isEngineHookIdArray(value['enabledEngineHooks']) &&
    isNullableString(value['cwd']) &&
    isStringArray(value['additionalDirectories']) &&
    isNullableSandboxConfig(value['sandbox']) &&
    isAgentToolIdArray(value['agentTools']) &&
    isSessionMode(value['sessionMode']) &&
    isNullableStructuredOutputConfig(value['structuredOutput'])
  );
}
