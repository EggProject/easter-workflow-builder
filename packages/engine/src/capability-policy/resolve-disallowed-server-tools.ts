import type { Fact, ServerToolDescriptor } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import type { DisallowedServerToolsDecision } from './disallowed-server-tools-decision.ts';

/**
 * A nem működő szerver oldali toolok letiltása (SPEC-004 11.3 táblázat 12.
 * sora, leíró mezők: `serverTools[].available` és `serverTools[].clientToolName`):
 *
 * - elérhető (`available` `known` igaz): nem tiltunk.
 * - nem elérhető (`available` `known` hamis) **és** ismert a kliens tool neve:
 *   a név felkerül a lépés `Options.disallowedTools` listájára (F-9).
 * - `unknown`: nem tiltunk, és a `step_started` payload jelöli.
 *
 * A szabály teljesen generikus: a tiltandó nevet kizárólag a leíró
 * `clientToolName` mezője adja, a motorban egyetlen konkrét tool név sem
 * szerepel (SPEC-004 17. szekció 61. kritérium).
 *
 * Két `Fact` mező van egymásba ágyazva, ezért három úton keletkezik bizonytalan
 * állapot, és mindhárom ugyanazt a konzervatív visszaesést kapja (nem tiltunk,
 * de jelöljük):
 *
 * 1. a teljes `serverTools` mező `unknown`: a tool lista maga sem ismert,
 * 2. egy tool `available` mezője `unknown`: nem tudjuk, működik-e,
 * 3. egy nem elérhető tool `clientToolName` mezője `unknown`: tudjuk, hogy
 *    nem működik, de nem tudjuk, mit kellene letiltani.
 *
 * A `clientToolName` `known` `null` értéke ezzel szemben **nem** bizonytalan:
 * az azt jelenti, hogy a szerver oldali toolnak nincs kliens oldali
 * megfelelője, tehát nincs is mit a tiltólistára tenni.
 */
export function resolveDisallowedServerTools(
  serverTools: Fact<readonly ServerToolDescriptor[]>,
): DisallowedServerToolsDecision {
  if (!isKnownFact(serverTools)) {
    return { disallowedTools: [], serverToolAvailabilityUnproven: true };
  }

  const disallowedTools: string[] = [];
  let hasUnprovenAvailability = false;

  for (const tool of serverTools.value) {
    if (!isKnownFact(tool.available)) {
      hasUnprovenAvailability = true;
      continue;
    }

    if (tool.available.value) {
      continue;
    }

    if (!isKnownFact(tool.clientToolName)) {
      hasUnprovenAvailability = true;
      continue;
    }

    if (tool.clientToolName.value !== null) {
      disallowedTools.push(tool.clientToolName.value);
    }
  }

  return { disallowedTools, serverToolAvailabilityUnproven: hasUnprovenAvailability };
}
