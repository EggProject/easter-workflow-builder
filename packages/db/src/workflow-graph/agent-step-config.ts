import type {
  AgentToolId,
  ProviderId,
  StructuredOutputStrategyId,
  ThinkingMode,
} from '@easter-workflow-builder/provider-capability';
import type { EngineHookId } from './engine-hook-id.ts';
import type { SandboxConfig } from './sandbox-config.ts';
import type { SessionMode } from './session-mode.ts';
import type { StorableMcpServer } from './storable-mcp-server.ts';

/**
 * Az `Options.systemPrompt` preset alakja (research 1. szekció:
 * `{ type:'preset', preset:'claude_code', append?, excludeDynamicSections? }`).
 * A két opcionális mező tárolt alakja `null`-lal jelöli a hiányt, mert az
 * `undefined` nem éli túl a JSON oszlopot. Az `append` szöveg, az
 * `excludeDynamicSections` logikai, forrás: az Agent SDK TypeScript referencia
 * `systemPrompt` sora (https://docs.claude.com/en/api/agent-sdk/typescript).
 */
export interface PresetSystemPrompt {
  readonly type: 'preset';
  readonly preset: 'claude_code';
  readonly append: string | null;
  readonly excludeDynamicSections: boolean | null;
}

/**
 * Strukturált kimenet beállítása (SPEC-003 4.6). A `strategy` a meglévő
 * `StructuredOutputStrategyId`, a `schema` JSON Schema dokumentum, ami a séma
 * szintjén `unknown` marad.
 */
export interface StructuredOutputConfig {
  readonly strategy: StructuredOutputStrategyId;
  readonly schema: unknown;
}

/**
 * Az agent lépés beállításai (SPEC-003 4.4 táblázat). Minden mező forrása az
 * Agent SDK `Options` típusa a research 1. szekciója szerint; egyetlen mező
 * sincs kitalálva, és egyetlen mező sem fogad env **értéket**.
 *
 * Két mező szándékosan tágabb a többinél:
 *
 * - `agents`: a research a mezőt `Record<string, AgentDefinition>` alakban
 *   nevesíti, de az `AgentDefinition` mezőlistáját nem rögzíti, és az az SDK
 *   verziójához kötött. A tárolt alak ezért rekord, `unknown` értékekkel; a
 *   szűkítés a motor dolga lesz, nem a perzisztenciáé.
 * - `structuredOutput.schema`: JSON Schema dokumentum, a SPEC-003 4.6 szerint
 *   `unknown` a séma szintjén.
 */
export interface AgentStepConfig {
  /**
  A lépés bemenete, sablonozva a futás kontextusából.
  */
  readonly promptTemplate: string;
  /**
  Lépés szintű provider felülírás; `null` esetén a workflow vagy a globális dönt.
  */
  readonly providerId: ProviderId | null;
  /**
  A **wire** modellazonosító (SPEC-003 4.4), nem a kliensnek átadott suffixes alak.
  */
  readonly modelId: string | null;
  readonly effort: string | null;
  readonly thinking: ThinkingMode | null;
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
  readonly permissionMode: string | null;
  readonly maxTurns: number | null;
  readonly maxBudgetUsd: number | null;
  readonly systemPrompt: string | PresetSystemPrompt | null;
  readonly agents: Readonly<Record<string, unknown>>;
  readonly skills: readonly string[] | 'all' | null;
  readonly mcpServers: Readonly<Record<string, StorableMcpServer>>;
  /**
  A motor beépített hookjai, NEM az SDK `hooks` callback mapje.
  */
  readonly enabledEngineHooks: readonly EngineHookId[];
  readonly cwd: string | null;
  readonly additionalDirectories: readonly string[];
  readonly sandbox: SandboxConfig | null;
  /**
  Lépésenként kapcsolható in-process MCP eszközök.
  */
  readonly agentTools: readonly AgentToolId[];
  readonly sessionMode: SessionMode;
  readonly structuredOutput: StructuredOutputConfig | null;
}
