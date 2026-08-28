import { isString } from '../is-string/is-string.ts';

/**
 * Szövegtömb-e az érték. A `packages/db` csomag `workflow-graph` tárgykörében a node
 * config unió és az `AgentStepConfig` több mezője (`allowedTools`, `envNames`,
 * `excludedCommands`, ...) ilyen alakú; a guardnak nincs domain témája, ezért ide
 * került (PLAN-004 4.5 szekció). Az üres tömb érvényes: a mezők kötelezőek, de
 * üresek lehetnek.
 */
export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((element: unknown) => isString(element));
}
