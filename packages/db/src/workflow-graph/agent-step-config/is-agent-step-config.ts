import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type {
  ProviderId,
  StructuredOutputStrategyId,
  ThinkingMode,
} from '@easter-workflow-builder/provider-capability';
import {
  isBoolean,
  isNumber,
  isRecord,
  isRecordWithKnownKeys,
  isString,
  isStringArray,
} from '@easter-workflow-builder/typeguards';
import type { AgentStepConfig, PresetSystemPrompt, StructuredOutputConfig } from './agent-step-config.ts';
import { isMcpServerReference } from './is-mcp-server-reference.ts';
import type { SandboxConfig } from './sandbox-config.ts';
import type { SessionMode } from './session-mode.ts';
import type {
  StorableHttpMcpServer,
  StorableMcpServer,
  StorableSseMcpServer,
  StorableStdioMcpServer,
} from './storable-mcp-server.ts';

// A zárt értékkészletek kulcsonként. A `Record<Unió, true>` annotáció miatt a
// fordító hibát ad, ha az unió bővül, de a lista nem.
const THINKING_MODE_KEYS: Readonly<Record<ThinkingMode, true>> = {
  disabled: true,
  adaptive: true,
  always_on: true,
};

const SESSION_MODE_KEYS: Readonly<Record<SessionMode, true>> = {
  isolated: true,
  continued: true,
};

const STRUCTURED_OUTPUT_STRATEGY_KEYS: Readonly<Record<StructuredOutputStrategyId, true>> = {
  sdk_output_format: true,
};

// Az ellenőrzött objektumok zárt kulcslistái (SPEC-011 5.2): minden más kulcs
// ismeretlen, és a guard elutasítja. A `Record<keyof T, true>` annotáció miatt
// a fordító hibát ad, ha a típus egy mezővel bővül, de a lista nem. Ami szabad
// marad: az `agents` és a `mcpServers` rekord kulcsai, az `agents` értékei, a
// `structuredOutput.schema` belseje és a `SandboxConfig` öt nyitott mezőjének
// értéke (a kulcsuk ismert).
const AGENT_STEP_CONFIG_KEYS: Readonly<Record<keyof AgentStepConfig, true>> = {
  promptTemplate: true,
  providerId: true,
  modelId: true,
  effort: true,
  thinking: true,
  allowedTools: true,
  disallowedTools: true,
  permissionMode: true,
  maxTurns: true,
  maxBudgetUsd: true,
  systemPrompt: true,
  agents: true,
  skills: true,
  mcpServers: true,
  mcpServerReferences: true,
  cwd: true,
  additionalDirectories: true,
  sandbox: true,
  sessionMode: true,
  structuredOutput: true,
};

const PRESET_SYSTEM_PROMPT_KEYS: Readonly<Record<keyof PresetSystemPrompt, true>> = {
  type: true,
  preset: true,
  append: true,
  excludeDynamicSections: true,
};

const STRUCTURED_OUTPUT_CONFIG_KEYS: Readonly<Record<keyof StructuredOutputConfig, true>> = {
  strategy: true,
  schema: true,
};

const SANDBOX_CONFIG_KEYS: Readonly<Record<keyof SandboxConfig, true>> = {
  enabled: true,
  failIfUnavailable: true,
  autoAllowBashIfSandboxed: true,
  excludedCommands: true,
  enableWeakerNestedSandbox: true,
  allowUnsandboxedCommands: true,
  network: true,
  filesystem: true,
  ignoreViolations: true,
  ripgrep: true,
};

const STDIO_MCP_SERVER_KEYS: Readonly<Record<keyof StorableStdioMcpServer, true>> = {
  type: true,
  command: true,
  args: true,
  envNames: true,
};

const SSE_MCP_SERVER_KEYS: Readonly<Record<keyof StorableSseMcpServer, true>> = {
  type: true,
  url: true,
  authEnvName: true,
};

const HTTP_MCP_SERVER_KEYS: Readonly<Record<keyof StorableHttpMcpServer, true>> = {
  type: true,
  url: true,
  authEnvName: true,
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
    isRecordWithKnownKeys(value, PRESET_SYSTEM_PROMPT_KEYS) &&
    value.type === 'preset' &&
    value.preset === 'claude_code' &&
    isNullableString(value.append) &&
    isNullableBoolean(value.excludeDynamicSections)
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
      return (
        isRecordWithKnownKeys(value, STDIO_MCP_SERVER_KEYS) &&
        isString(value.command) &&
        isStringArray(value.args) &&
        isStringArray(value.envNames)
      );
    }
    case 'sse': {
      return (
        isRecordWithKnownKeys(value, SSE_MCP_SERVER_KEYS) && isString(value.url) && isNullableString(value.authEnvName)
      );
    }
    case 'http': {
      return (
        isRecordWithKnownKeys(value, HTTP_MCP_SERVER_KEYS) && isString(value.url) && isNullableString(value.authEnvName)
      );
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
 * A lépés hivatkozás mezője (SPEC-009 6.2, O-42 (b)): elhagyható, tehát a
 * kulcs hiánya érvényes (a régi gráf és pillanatkép így áll); ha a kulcs
 * jelen van, a rekord minden értéke hivatkozás. A név szabályt a központi
 * definíció mentése kényszeríti ki: egy szabálytalan kulcs egyetlen
 * definícióval sem egyezhet.
 */
function hasValidMcpServerReferences(value: Readonly<Record<string, unknown>>): boolean {
  if (!Object.hasOwn(value, 'mcpServerReferences')) {
    return true;
  }
  const references = value['mcpServerReferences'];
  return (
    isRecord(references) && Object.values(references).every((reference: unknown) => isMcpServerReference(reference))
  );
}

/**
 * Az `Options.sandbox` öt, forrásból levezethető alakú mezőjét ellenőrzi. A
 * másik öt mező alakja nyitott (lásd `sandbox-config.ts`), ezért azok értékét a
 * guard szándékosan nem szűkíti: tippelni tilos. A kulcsuk viszont ismert,
 * tehát a tíz kulcson kívül minden más elutasított.
 */
function isSandboxConfig(value: unknown): value is SandboxConfig {
  return (
    isRecordWithKnownKeys(value, SANDBOX_CONFIG_KEYS) &&
    isBoolean(value.enabled) &&
    isBoolean(value.failIfUnavailable) &&
    isBoolean(value.autoAllowBashIfSandboxed) &&
    isBoolean(value.enableWeakerNestedSandbox) &&
    isStringArray(value.excludedCommands)
  );
}

function isNullableSandboxConfig(value: unknown): value is SandboxConfig | null {
  return value === null || isSandboxConfig(value);
}

function isStructuredOutputConfig(value: unknown): value is StructuredOutputConfig {
  if (!isRecordWithKnownKeys(value, STRUCTURED_OUTPUT_CONFIG_KEYS)) {
    return false;
  }
  const strategy = value.strategy;
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
 * és objektumokra (`sandbox`, `systemPrompt`, `structuredOutput`) is, és
 * minden szinten elutasítja az ismeretlen kulcsot (SPEC-011 5.2). Az
 * `agent_step` node `type` és `onUnhandledError` kulcsát a hívó választja le
 * (`is-node-config.ts`), mert az a node config burkolata, nem ez az alak.
 */
export function isAgentStepConfig(value: unknown): value is AgentStepConfig {
  return (
    isRecordWithKnownKeys(value, AGENT_STEP_CONFIG_KEYS) &&
    isString(value.promptTemplate) &&
    isNullableProviderId(value.providerId) &&
    isNullableString(value.modelId) &&
    isNullableString(value.effort) &&
    isNullableThinkingMode(value.thinking) &&
    isStringArray(value.allowedTools) &&
    isStringArray(value.disallowedTools) &&
    isNullableString(value.permissionMode) &&
    isNullableNumber(value.maxTurns) &&
    isNullableNumber(value.maxBudgetUsd) &&
    isSystemPrompt(value.systemPrompt) &&
    isRecord(value.agents) &&
    isSkills(value.skills) &&
    isMcpServerRecord(value.mcpServers) &&
    hasValidMcpServerReferences(value) &&
    isNullableString(value.cwd) &&
    isStringArray(value.additionalDirectories) &&
    isNullableSandboxConfig(value.sandbox) &&
    isSessionMode(value.sessionMode) &&
    isNullableStructuredOutputConfig(value.structuredOutput)
  );
}
