import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import type { AgentStepOptions } from './agent-step-options.ts';
import { buildStopHookMatcher } from './build-stop-hook-matcher.ts';
import type { SessionBinding } from './session-binding.ts';

/**
 * A `buildAgentStepOptions` bemenete. A négy mező négy, egymástól független
 * forrásból jön, és mind a négy **készen** érkezik: a lépés tárolt configja,
 * a leírótól függő döntések (`validateAgentStepCapabilities`), a kimenő env
 * blokk (`buildProviderEnvironmentBlock`, a `processEnvironment` porton át) és
 * a session kötés (`resolveSessionBinding`). Így az összeállítás maga tiszta
 * függvény marad: sem portot, sem adatbázist nem érint.
 */
export interface BuildAgentStepOptionsInput {
  readonly config: AgentStepConfig;
  readonly decisions: AgentStepCapabilityDecisions;
  readonly environmentBlock: Readonly<Record<string, string>>;
  readonly sessionBinding: SessionBinding;
}

/**
 * A session mezők (SPEC-004 6.3 táblázat): `isolated` módban egyáltalán nem
 * kerül ki sem `resume`, sem `forkSession` mező (29. elfogadási kritérium),
 * `continued` módban mindkettő kimegy.
 */
function sessionFields(
  binding: SessionBinding,
): Record<string, never> | { readonly resume: string; readonly forkSession: boolean } {
  return binding.mode === 'isolated' ? {} : { resume: binding.resume, forkSession: binding.forkSession };
}

/**
 * A strukturált kimenet stratégiából következő mezők (SPEC-004 11.3 táblázat
 * 2. sora, F-7):
 *
 * - `sdk_output_format`: a kérés az SDK `outputFormat` mezőjén viszi a JSON
 *   Schema dokumentumot (`{ type: 'json_schema', schema }`, agent-sdk research
 *   1. szekció).
 * - `emit_output_tool`: a kimenetet egy kötelező eszköz hívása adja, amit a
 *   `Stop` hook kényszerít ki. A hook **csak akkor** kerül ki, ha a lépés
 *   configja be is kapcsolta (`enabledEngineHooks`), mert az `EngineHookId`
 *   éppen erre a lépésenkénti kapcsolásra való (SPEC-003 4.4).
 *
 * Ha a lépés nem vár strukturált kimenetet, egyik mező sem kerül ki. **A
 * stratégia azonosítója a lépés configjából jön, nem a leíró döntéséből**: a
 * kettő ugyanaz az érték (a `resolveStructuredOutputStrategy` a kért
 * stratégiát keresi meg), és a configból olvasva nem keletkezik olyan
 * ellenőrzés, ami logikailag sosem bukik el.
 */
function structuredOutputFields(
  config: AgentStepConfig,
):
  | Record<string, never>
  | { readonly outputFormat: NonNullable<AgentStepOptions['outputFormat']> }
  | { readonly hooks: NonNullable<AgentStepOptions['hooks']> } {
  const structuredOutput = config.structuredOutput;
  if (structuredOutput === null) {
    return {};
  }
  if (structuredOutput.strategy === 'sdk_output_format') {
    return { outputFormat: { type: 'json_schema', schema: structuredOutput.schema } };
  }
  return config.enabledEngineHooks.includes('emit_output_tool_stop')
    ? { hooks: { Stop: [buildStopHookMatcher()] } }
    : {};
}

/**
 * A kimenő Agent SDK `Options` objektum összeállítása (SPEC-004 5.2 4. pont).
 *
 * Három csoportból áll:
 *
 * 1. **Mindig kimenő mezők.** A `model` a leíró döntéséből jön (11.3 5. sor),
 *    a `disallowedTools` a lépés saját listája **plusz** a leíró szerint nem
 *    működő szerver oldali toolok kliens neve (12. sor), az
 *    `includePartialMessages` a 13. sor, az `env` a
 *    `provider-environment` téma blokkja (10. és 11. sor), a
 *    `persistSession` pedig minden lépésnél `true` (6.3, 32. elfogadási
 *    kritérium).
 * 2. **A lépés configjából átemelt, elhagyható mezők.** Mindegyik tárolt alakja
 *    `null`-lal jelzi a hiányt (SPEC-003 4.4), és a `null` érték itt nem
 *    kiküldött `null`-t, hanem **hiányzó mezőt** jelent.
 * 3. **A session és a strukturált kimenet mezői**, a két segédfüggvény szerint.
 *
 * **Ami szándékosan kimarad: az `mcpServers` és az `agentTools`.** A tárolt
 * `StorableMcpServer` alak titok helyett env változó **nevet** hordoz, az
 * `agentTools` pedig saját folyamatban futó eszközöket kapcsol be, amiknek a
 * példányosítása a tool csomagokban él; a motor egyiktől sem függ, és nem is
 * függhet (SPEC-004 12. szekció függőségi iránya). A két mező bekötése az
 * összeállítás (`apps/server`) dolga lesz; a motorban kitalált alakot nem
 * építünk (`.claude/CLAUDE.md` 4.).
 */
export function buildAgentStepOptions(input: BuildAgentStepOptionsInput): AgentStepOptions {
  const config = input.config;
  const decisions = input.decisions;

  return {
    model: decisions.model.outgoingModel,
    allowedTools: config.allowedTools,
    disallowedTools: [...config.disallowedTools, ...decisions.disallowedServerTools.disallowedTools],
    additionalDirectories: config.additionalDirectories,
    agents: config.agents,
    env: input.environmentBlock,
    includePartialMessages: decisions.includePartialMessages,
    persistSession: true,
    ...(decisions.thinking !== undefined && { thinking: decisions.thinking }),
    ...(decisions.effort !== undefined && { effort: decisions.effort }),
    ...(config.permissionMode !== null && { permissionMode: config.permissionMode }),
    ...(config.maxTurns !== null && { maxTurns: config.maxTurns }),
    ...(config.maxBudgetUsd !== null && { maxBudgetUsd: config.maxBudgetUsd }),
    ...(config.systemPrompt !== null && { systemPrompt: config.systemPrompt }),
    ...(config.skills !== null && { skills: config.skills }),
    ...(config.cwd !== null && { cwd: config.cwd }),
    ...(config.sandbox !== null && { sandbox: config.sandbox }),
    ...sessionFields(input.sessionBinding),
    ...structuredOutputFields(config),
  };
}
