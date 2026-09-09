import { z } from 'zod';
import { AgentToolIdSchema } from './agent-tool-id.ts';
import { EngineHookIdSchema } from './engine-hook-id.ts';
import { ProviderIdSchema } from './provider-id.ts';
import { SandboxConfigSchema } from './sandbox-config.ts';
import { SessionModeSchema } from './session-mode.ts';
import { StorableMcpServerSchema } from './storable-mcp-server.ts';
import { StructuredOutputStrategyIdSchema } from './structured-output-strategy-id.ts';
import { ThinkingModeSchema } from './thinking-mode.ts';

/**
 * Az `Options.systemPrompt` preset alakja, a `packages/db` `agent-step-config.ts`
 * `PresetSystemPrompt` mirror sémája.
 */
export const PresetSystemPromptSchema = z
  .strictObject({
    type: z.literal('preset'),
    preset: z.literal('claude_code'),
    append: z.string().nullable(),
    excludeDynamicSections: z.boolean().nullable(),
  })
  .readonly();

export type PresetSystemPrompt = z.infer<typeof PresetSystemPromptSchema>;

/**
 * Strukturált kimenet beállítása, a `packages/db` `agent-step-config.ts`
 * `StructuredOutputConfig` mirror sémája. A `schema` a séma szintjén is
 * `unknown` marad (SPEC-003 4.6), nem szűkíthető.
 */
export const StructuredOutputConfigSchema = z
  .strictObject({
    strategy: StructuredOutputStrategyIdSchema,
    schema: z.unknown(),
  })
  .readonly();

export type StructuredOutputConfig = z.infer<typeof StructuredOutputConfigSchema>;

/**
 * A `skills` mező listás ága, önálló névvel a beágyazás mélységi korlátja
 * miatt (`unicorn/max-nested-calls`).
 */
const SkillsListSchema = z.array(z.string()).readonly();

/**
 * Az agent lépés beállításai, a `packages/db` `agent-step-config.ts`
 * `AgentStepConfig` mirror sémája (SPEC-003 4.4 táblázat). Az `agents` mező
 * **nem szűkíthető** `AgentDefinition` alakra: a `db` oldalon is nyitott
 * rekord marad, ezért a séma sem szűkíti, különben a sodródás védelem
 * típusszintű egyenlősége megbukna (`.claude/CLAUDE.md` 5. szekció,
 * SPEC-005 7.7).
 */
export const AgentStepConfigSchema = z
  .strictObject({
    promptTemplate: z.string(),
    providerId: ProviderIdSchema.nullable(),
    modelId: z.string().nullable(),
    effort: z.string().nullable(),
    thinking: ThinkingModeSchema.nullable(),
    allowedTools: z.array(z.string()).readonly(),
    disallowedTools: z.array(z.string()).readonly(),
    permissionMode: z.string().nullable(),
    maxTurns: z.number().nullable(),
    maxBudgetUsd: z.number().nullable(),
    systemPrompt: z.union([z.string(), PresetSystemPromptSchema]).nullable(),
    agents: z.record(z.string(), z.unknown()).readonly(),
    skills: z.union([SkillsListSchema, z.literal('all')]).nullable(),
    mcpServers: z.record(z.string(), StorableMcpServerSchema).readonly(),
    enabledEngineHooks: z.array(EngineHookIdSchema).readonly(),
    cwd: z.string().nullable(),
    additionalDirectories: z.array(z.string()).readonly(),
    sandbox: SandboxConfigSchema.nullable(),
    agentTools: z.array(AgentToolIdSchema).readonly(),
    sessionMode: SessionModeSchema,
    structuredOutput: StructuredOutputConfigSchema.nullable(),
  })
  .readonly();

export type AgentStepConfig = z.infer<typeof AgentStepConfigSchema>;
