import type { Outcome } from '@easter-workflow-builder/core';
import type { ToolChoiceCapability, ToolChoiceValue } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * A `tool_choice` két **kényszerítő** értéke. Forrás: a Messages API hivatalos
 * dokumentációja, "Forcing tool use" szakasz: az `any` azt mondja a modellnek,
 * hogy valamelyik toolt kötelező használnia, a `tool` egy konkrét toolt
 * kényszerít ki; az `auto` és a `none` nem kényszerít
 * (https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools).
 */
const FORCING_TOOL_CHOICE_VALUES: ReadonlySet<ToolChoiceValue> = new Set(['any', 'tool']);

/**
 * A kényszerített `tool_choice` kockázata (SPEC-004 11.3 táblázat 4. sora,
 * leíró mezők: `toolChoice.accepted`, `toolChoice.rejectionBehaviour`,
 * `toolChoice.sdkSendsForcedChoice`).
 *
 * A hiba (`forced_tool_choice_silently_dropped`) **három** feltétel együttes
 * teljesülésekor áll fenn, mindhárom `known` bizonyítékkal:
 *
 * 1. az SDK küld kényszerítést (`sdkSendsForcedChoice` igaz),
 * 2. a provider egyetlen kényszerítő értéket sem fogad el (`accepted` egyik
 *    eleme sem `any` és nem `tool`),
 * 3. az elutasítás **csendes** (`rejectionBehaviour` `silently_dropped`),
 *    tehát nincs 400-as biztonsági háló, ami a hibát futásidőben megmutatná
 *    (F-6).
 *
 * Bármelyik mező `unknown` állapota megállítja a hibaágat: a motor ilyenkor
 * "nem épít kényszerítésre", és a strukturált kimenet utóellenőrzése így is
 * kötelező marad (F-6, SPEC-004 11.3 4. sor `unknown` oszlopa). Ha a
 * `rejectionBehaviour` `http_400`, szintén nincs hiba: az elutasítás látható
 * lesz, nem csendes.
 */
export function validateForcedToolChoiceRisk(toolChoice: ToolChoiceCapability): Outcome<void> {
  const noRisk: Outcome<void> = { kind: 'ok', value: undefined };

  if (!isKnownFact(toolChoice.sdkSendsForcedChoice) || !toolChoice.sdkSendsForcedChoice.value) {
    return noRisk;
  }

  if (!isKnownFact(toolChoice.accepted)) {
    return noRisk;
  }

  if (toolChoice.accepted.value.some((value) => FORCING_TOOL_CHOICE_VALUES.has(value))) {
    return noRisk;
  }

  if (!isKnownFact(toolChoice.rejectionBehaviour) || toolChoice.rejectionBehaviour.value !== 'silently_dropped') {
    return noRisk;
  }

  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'forced_tool_choice_silently_dropped',
      'Az SDK kényszerített tool_choice értéket küld, amit a provider nem fogad el és csendben eldob',
    ),
  };
}
