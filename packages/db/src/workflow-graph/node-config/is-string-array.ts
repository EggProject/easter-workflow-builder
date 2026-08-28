import { isString } from '@easter-workflow-builder/typeguards';

/**
 * Szövegtömb-e az érték. A node config unió és az `AgentStepConfig` több mezője
 * (`allowedTools`, `envNames`, `excludedCommands`, ...) ilyen alakú, ezért a
 * `workflow-graph` téma egy helyen tartja. Az üres tömb érvényes: a mezők
 * kötelezőek, de üresek lehetnek.
 */
export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((element: unknown) => isString(element));
}
