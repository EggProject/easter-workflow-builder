import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import { requireModelSelection } from '../capability-policy/require-model-selection.ts';
import { resolveDisallowedServerTools } from '../capability-policy/resolve-disallowed-server-tools.ts';
import { resolveEffortInclusion } from '../capability-policy/resolve-effort-inclusion.ts';
import { resolveModelWireIdentifier } from '../capability-policy/resolve-model-wire-identifier.ts';
import { resolveStructuredOutputStrategy } from '../capability-policy/resolve-structured-output-strategy.ts';
import { resolveThinkingMode } from '../capability-policy/resolve-thinking-mode.ts';
import { shouldIncludePartialMessages } from '../capability-policy/should-include-partial-messages.ts';
import { validateForcedToolChoiceRisk } from '../capability-policy/validate-forced-tool-choice-risk.ts';
import { validateMaxTurnsFloor } from '../capability-policy/validate-max-turns-floor.ts';
import { validateModelId } from '../capability-policy/validate-model-id.ts';
import type { StructuredOutputStrategyDecision } from '../capability-policy/structured-output-strategy-decision.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';

/**
 * A leírótól függő ellenőrzés eredménye.
 *
 * **Miért nem `Outcome`.** Az `Outcome` hibaága kizárólag szöveges üzenetet
 * hordoz (F-24), a hívónak viszont a hibaosztály **neve** külön is kell, mert
 * az a `step_run.error_kind` oszlopba kerül (SPEC-004 5. szekció közös
 * szabályai, 20. elfogadási kritérium). Az üzenetből visszafejteni a nevet
 * felesleges kerülőút lenne: a hívott `capability-policy` függvények
 * mindegyike **pontosan egy** hibaosztályt ad, amit a saját doksija nevez meg,
 * tehát a párosítás itt, a hívás helyén elvégezhető. A `status` mező
 * ugyanabban a szerepben áll, mint az `Outcome` `kind` mezője.
 */
export type AgentStepCapabilityOutcome =
  CapabilityFailure | { readonly status: 'ok'; readonly decisions: AgentStepCapabilityDecisions };

/**
 * A provider leírónak az a hét mezője, amit ez az ellenőrzés ténylegesen
 * olvas. A teljes `ProviderCapabilityDescriptor` helyett azért áll itt
 * `Pick`, mert a SPEC-004 11.3 szekció külön táblázatban sorolja fel, mit
 * olvas a motor a leíróból és mit nem: a szignatúra így maga dokumentálja a
 * határt, és egy új leíró mező felvétele nem látszik úgy, mintha a motor
 * bemenete lenne. A teljes leíró átadható, mert az illeszkedik erre az alakra.
 */
export type AgentStepDescriptorFields = Pick<
  ProviderCapabilityDescriptor<string, string>,
  'models' | 'thinking' | 'effort' | 'toolChoice' | 'structuredOutput' | 'serverTools' | 'streaming'
>;

// A hibaág önálló alakja, hogy a fájl két eredmény uniójának (a nyilvános
// `AgentStepCapabilityOutcome` és a belső `StructuredOutputResult`) közös
// hibaága legyen, és a segédfüggvény eredménye mindkettőben átadható.
interface CapabilityFailure {
  readonly status: 'failed';
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
}

// Az `Outcome` hibaágának átvétele a hozzá tartozó, előre ismert
// hibaosztállyal. Az `errorKind` a hívott függvény doksijában megnevezett
// egyetlen hibaosztály, az üzenet változatlanul megy tovább, mert az F-24
// konvenció szerint már tartalmazza ugyanezt a nevet zárójelben.
function failed(errorKind: EngineErrorKind, message: string): CapabilityFailure {
  return { status: 'failed', errorKind, errorMessage: message };
}

// A strukturált kimenet feloldásának eredménye. Nem exportált: kizárólag a
// `resolveStructuredOutput` segéd és a hívója közötti alak, hogy a hibaág
// változtatás nélkül továbbadható legyen az `AgentStepCapabilityOutcome`
// hibaágaként.
type StructuredOutputResult =
  CapabilityFailure | { readonly status: 'ok'; readonly decision: StructuredOutputStrategyDecision | undefined };

/**
 * A strukturált kimenet stratégia feloldása és a hozzá tartozó `maxTurns`
 * alsó korlát (SPEC-004 11.3 táblázat 1. és 3. sora). `undefined` döntés
 * akkor születik, ha a lépés nem vár strukturált kimenetet: ilyenkor nincs
 * választott stratégia, tehát alsó korlát sincs.
 */
function resolveStructuredOutput(
  config: AgentStepConfig,
  descriptor: AgentStepDescriptorFields,
): StructuredOutputResult {
  const requested = config.structuredOutput;
  if (requested === null) {
    return { status: 'ok', decision: undefined };
  }

  const strategy = resolveStructuredOutputStrategy(descriptor.structuredOutput.strategies, requested.strategy);
  if (strategy.kind === 'error') {
    return failed('structured_output_strategy_unsupported', strategy.message);
  }

  const maxTurns = validateMaxTurnsFloor(strategy.value.strategy, config.maxTurns);
  if (maxTurns.kind === 'error') {
    return failed('insufficient_max_turns', maxTurns.message);
  }

  return { status: 'ok', decision: strategy.value };
}

/**
 * A lépéshez tartozó, leírótól függő döntések kiszámítása és a leíró alapú
 * hibaágak lefuttatása egyetlen menetben (SPEC-004 5.2 4. pont: "Ez a lépés
 * az, ahol minden provider függő döntés megtörténik").
 *
 * A SPEC-004 11.3 táblázat sorai közül ide a lépéshez kötött tíz tartozik:
 * 1., 3., 4., 5., 6., 7., 8., 9., 12. és 13. A többi hat sor szándékosan
 * máshol áll: a 2. sor (`Stop` hook) az `Options` összeállításának része
 * (`buildStopHookMatcher`), a 10. és 11. sor a `provider-environment` témáé, a
 * 14. sor a beállítás felület javaslata, a 15. sor konstans döntés
 * (`RATE_LIMIT_RETRY_POLICY`), a 17. sor pedig a **telepített** SDK verziót
 * hasonlítja, ami nem a lépés bemenete: a motor nem függ az Agent SDK
 * csomagtól (58. elfogadási kritérium), tehát a verziót az összeállítás adja,
 * és az ellenőrzés a futás indításához tartozik (`validateSdkVersionMatch`,
 * 63. elfogadási kritérium).
 *
 * Tiszta függvény: adatbázist, portot és órát nem érint, tehát a futás
 * indításakor **szárazon** is lefuttatható minden agent lépésre, egyetlen
 * kódúton (lásd `packages/engine/CLAUDE.md`, "Az `agent-step` téma határa").
 */
export function validateAgentStepCapabilities(
  config: AgentStepConfig,
  descriptor: AgentStepDescriptorFields,
): AgentStepCapabilityOutcome {
  const selectedModelId = requireModelSelection(descriptor.models, config.modelId);
  if (selectedModelId.kind === 'error') {
    return failed('model_not_selected', selectedModelId.message);
  }

  const model = validateModelId(descriptor.models, selectedModelId.value);
  if (model.kind === 'error') {
    return failed('unknown_model_id', model.message);
  }

  const stepThinking = config.thinking;
  const thinking = resolveThinkingMode(descriptor.thinking.byModelFamily, model.value.family, stepThinking);
  if (thinking.kind === 'error') {
    return failed('thinking_mode_unsupported', thinking.message);
  }

  const stepEffort = config.effort;
  const effort = resolveEffortInclusion(descriptor.effort.accepted, stepEffort);
  if (effort.kind === 'error') {
    return failed('effort_unsupported', effort.message);
  }

  const toolChoiceRisk = validateForcedToolChoiceRisk(descriptor.toolChoice);
  if (toolChoiceRisk.kind === 'error') {
    return failed('forced_tool_choice_silently_dropped', toolChoiceRisk.message);
  }

  const structuredOutput = resolveStructuredOutput(config, descriptor);
  if (structuredOutput.status === 'failed') {
    return structuredOutput;
  }

  return {
    status: 'ok',
    decisions: {
      model: resolveModelWireIdentifier(model.value),
      structuredOutput: structuredOutput.decision,
      // A `null` ellenőrzés áll elöl, az `include` döntés utána: így mindkét
      // részfeltételnek van valós, előidézhető igaz és hamis ága (a lépés nem
      // állít módot, illetve állít, de a leíró elhagyatja a mezőt), tehát nem
      // keletkezik olyan feltétel, ami logikailag sosem bukik el.
      thinking: stepThinking !== null && thinking.value === 'include' ? stepThinking : undefined,
      effort: stepEffort !== null && effort.value === 'include' ? stepEffort : undefined,
      disallowedServerTools: resolveDisallowedServerTools(descriptor.serverTools),
      includePartialMessages: shouldIncludePartialMessages(descriptor.streaming.sse),
    },
  };
}
