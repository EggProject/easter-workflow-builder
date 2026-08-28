/* eslint-disable unicorn/no-null -- ennek a fájlnak minden `null` literálja egy
   nullázható `run_event` OSZLOP értéke, nem helyőrző `undefined`: a SPEC-003 6.2
   szekció szerint "minden SDK eredetű normalizált mező nullable", és a hiányzó
   mező NULL-t ad, nem kitalált értéket. Az `undefined` nem élné túl a
   Drizzle/SQLite írási utat úgy, hogy NULL legyen belőle. */
import { isInt, isNonEmptyString, isRecord } from '@easter-workflow-builder/typeguards';
import type { Outcome } from '@easter-workflow-builder/core';
import type { RunEventKind } from './run-event-kind.ts';
import type { SdkMessageEnvelope } from './is-sdk-message-envelope.ts';
import { isSdkMessageEnvelope } from './is-sdk-message-envelope.ts';

/**
 * A `run_event` tábla normalizált oszlopai egyetlen nyers SDK üzenetből
 * (SPEC-003 6.2 szekció mezőkészlete). A `RunEventRepository` (T-003-21) ezt
 * tolja bele az egyetlen beszúró utasításba; ez a modul **nem** ír adatbázist.
 *
 * A `payload` a teljes nyers üzenet, típus nélkül: a `run_event.payload` oszlop
 * `.$type<unknown>()` alakú.
 */
export interface NormalizedSdkMessage {
  readonly kind: RunEventKind;
  readonly sdkMessageType: string;
  readonly sdkMessageSubtype: string | null;
  readonly sdkSessionId: string | null;
  readonly sdkUuid: string | null;
  readonly parentToolUseId: string | null;
  readonly toolName: string | null;
  readonly toolUseId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly numTurns: number | null;
  readonly payload: unknown;
}

const UNRECOGNIZED = 'unrecognized_sdk_message_type';

interface ToolUseColumns {
  readonly toolName: string | null;
  readonly toolUseId: string | null;
}

interface UsageColumns {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
}

const NO_TOOL_USE: ToolUseColumns = { toolName: null, toolUseId: null };

const NO_USAGE: UsageColumns = {
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
};

/**
 * Nem üres szöveg egy nyers rekord mezőjéből, különben NULL. Az üres szöveg
 * azért NULL, nem üres szöveg: az `sdk_uuid` oszlopon a `run_event_run_uuid_uq`
 * egyedi index fut (6.5), és ott két üres szöveg ÜTKÖZNE, míg két NULL nem
 * (F-10). Egy üres azonosító nem adat, hanem hiányzó adat.
 */
function readOptionalString(source: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = source[key];
  return isNonEmptyString(value) ? value : null;
}

/**
 * Egész szám egy nyers rekord mezőjéből, különben NULL. A `?? 0` alapérték
 * szándékosan hiányzik: az hiányzó adatot mutatna nullának, és a `SUM()`
 * összesítés nem tudná megkülönböztetni a kettőt (6.2 szekció, 10. kritérium).
 */
function readOptionalInt(source: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = source[key];
  return isInt(value) ? value : null;
}

function readNestedRecord(
  source: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> | null {
  const value = source[key];
  return isRecord(value) ? value : null;
}

/**
 * Ismeretlen elemű tömb-e az érték. Az `Array.isArray` `unknown` bemenetről
 * `any[]` alakra szűkít, amit a `no-unsafe-*` szabálycsalád jogosan tiltana;
 * ez a guard `readonly unknown[]` alakra szűkít helyette.
 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * A `kind` leképezés a `system` üzenet `subtype` mezőjéből.
 *
 * Forrás, szó szerint a pinelt `@anthropic-ai/claude-agent-sdk@0.3.245`
 * `sdk.d.ts` típusdefinícióiból: az `SDKHookStartedMessage`,
 * `SDKHookProgressMessage`, `SDKHookResponseMessage`, `SDKInformationalMessage`
 * és `SDKCommandsChangedMessage` mind `type: 'system'` értéket hordoz, és
 * kizárólag a `subtype` mezőjük különbözteti meg őket
 * (`hook_started`, `hook_progress`, `hook_response`, `informational`,
 * `commands_changed`). A research fájl 1. szekciója az `SDKMessage` uniót
 * típusNÉVEN sorolja fel, drótalak nélkül; a drótalak táblázata ugyanennek a
 * szekciónak az "Az `SDKMessage` ágak drótalakja és a normalizáláshoz használt
 * mezők" alszekciójában áll, forrás URL-lel
 * (`docs/research/2026-08-26-agent-sdk-minimax.md`).
 *
 * Minden más `system` subtype (`init`, `status`, `thinking_tokens`,
 * `compact_boundary`, ...) a gyűjtő `sdk_system` értéket kapja, mert a 6.4
 * szekció huszonöt értékű listája zárt, és nincs hozzájuk saját `kind`.
 */
function resolveSystemKind(subtype: string | null): RunEventKind {
  // A `null` ág külön áll, nem `case null:`-ként: a `switch`-nek így `string`
  // a bemenete, nem `string | null`, és a `switch-exhaustiveness-check`
  // szabály nem kérné rajta számon az összes unió tagot.
  if (subtype === null) {
    return 'sdk_system';
  }

  switch (subtype) {
    case 'hook_started': {
      return 'sdk_hook_started';
    }
    case 'hook_progress': {
      return 'sdk_hook_progress';
    }
    case 'hook_response': {
      return 'sdk_hook_response';
    }
    case 'informational': {
      return 'sdk_informational';
    }
    case 'commands_changed': {
      return 'sdk_commands_changed';
    }
    default: {
      return 'sdk_system';
    }
  }
}

/**
 * A `type`/`subtype` páros leképezése a 6.4 szekció `sdk` eredetű `kind`
 * értékeire. Ismeretlen `type` esetén NULL, amiből a hívó nevesített hibaágat
 * csinál: **nincs csendes "ismeretlen" `kind`**, mert az sértené a zárt,
 * huszonöt értékű listát.
 *
 * A tizenkettedik `sdk` eredetű érték, a `sdk_context_usage`, ebből a
 * leképezésből szándékosan hiányzik: a pinelt SDK-ban nincs olyan `SDKMessage`
 * ág, aminek a `type` vagy a `subtype` mezője `context_usage` lenne (az
 * `SDKContextUsage` az `SDKAssistantMessage.context_usage` mezőjének a típusa,
 * nem önálló üzenet). Nyitott pontként dokumentálva a `packages/db/CLAUDE.md`
 * fájlban; kitalált leképezést nem adunk hozzá.
 */
function resolveKind(type: string, subtype: string | null): RunEventKind | null {
  switch (type) {
    case 'system': {
      return resolveSystemKind(subtype);
    }
    case 'assistant': {
      return 'sdk_assistant';
    }
    case 'user': {
      return 'sdk_user';
    }
    case 'stream_event': {
      return 'sdk_stream_event';
    }
    case 'result': {
      return 'sdk_result';
    }
    case 'rate_limit_event': {
      return 'sdk_rate_limit';
    }
    default: {
      return null;
    }
  }
}

/**
 * A `tool_name` és a `tool_use_id` oszlop az asszisztens üzenet `tool_use`
 * blokkjából (6.2 szekció). A blokk `id`, `name` és `input` mezőt hordoz
 * (`BetaToolUseBlock`, `@anthropic-ai/sdk`; hivatalos doksi: a tool use válasz
 * blokkja `id`, `name`, `input` mezős). Az `input` nem kap oszlopot, az a nyers
 * `payload`-ban marad.
 *
 * **A két oszlop egyértékű, a `content` viszont tömb.** Egy nem streamelt
 * asszisztens üzenet több `tool_use` blokkot is hordozhat; ilyenkor az ELSŐ, a
 * mezőire nézve is érvényes blokk kerül az oszlopokba, a többi a `payload`-ban
 * marad. Ez a 6.2 mezőkészlet következménye, nem választás: a séma nem ad
 * ismétlődő oszlopot, és nem találunk ki újat.
 */
function readToolUseColumns(kind: RunEventKind, envelope: SdkMessageEnvelope): ToolUseColumns {
  if (kind !== 'sdk_assistant') {
    return NO_TOOL_USE;
  }

  const message = readNestedRecord(envelope, 'message');
  if (message === null) {
    return NO_TOOL_USE;
  }

  const blocks = message['content'];
  if (!isUnknownArray(blocks)) {
    return NO_TOOL_USE;
  }

  for (const block of blocks) {
    if (!isRecord(block) || block['type'] !== 'tool_use') {
      continue;
    }
    const name = block['name'];
    const id = block['id'];
    if (isNonEmptyString(name) && isNonEmptyString(id)) {
      return { toolName: name, toolUseId: id };
    }
  }

  return NO_TOOL_USE;
}

/**
 * Az az EGYETLEN hely, ahonnan a négy `usage` oszlop értéke jöhet.
 *
 * A lista **engedélyező**, nem tiltó: csak a `sdk_assistant` és a `sdk_result`
 * ágnak van forrása, minden más `kind` NULL-t kap. Ez a 6.2 szekció
 * "a négy `usage` oszlopot ... `sdk_stream_event` sorból soha" szabálya és a
 * 61. elfogadási kritérium. Két oka van: ugyanaz a `usage` a részleges stream
 * eseményben és a kész üzenetben is megérkezik, tehát mindkettőből kitöltve a
 * `SUM()` duplán számolna; és így az esemény szintű token összesítés a 6.6
 * delta kapcsoló mindkét állásában ugyanazt az értéket adja.
 *
 * A két forrás helye eltér, ezért nem lehet egyetlen kulcsolvasás:
 * a `result` üzenet `usage` mezője top-level, az asszisztens üzeneté a
 * beágyazott Anthropic `Message` objektumon áll (`message.usage`).
 */
function readUsageSource(kind: RunEventKind, envelope: SdkMessageEnvelope): Readonly<Record<string, unknown>> | null {
  if (kind === 'sdk_result') {
    return readNestedRecord(envelope, 'usage');
  }

  if (kind === 'sdk_assistant') {
    const message = readNestedRecord(envelope, 'message');
    return message === null ? null : readNestedRecord(message, 'usage');
  }

  return null;
}

function readUsageColumns(kind: RunEventKind, envelope: SdkMessageEnvelope): UsageColumns {
  const usage = readUsageSource(kind, envelope);
  if (usage === null) {
    return NO_USAGE;
  }

  return {
    inputTokens: readOptionalInt(usage, 'input_tokens'),
    outputTokens: readOptionalInt(usage, 'output_tokens'),
    cacheReadInputTokens: readOptionalInt(usage, 'cache_read_input_tokens'),
    cacheCreationInputTokens: readOptionalInt(usage, 'cache_creation_input_tokens'),
  };
}

/**
 * Egy nyers SDK üzenet normalizálása a `run_event` tábla oszlopaira
 * (SPEC-003 6.2 és 6.4 szekció, 10., 11. és 61. elfogadási kritérium).
 *
 * A bemenet `unknown`: a `Query` AsyncGenerator által kiadott üzenet nem
 * bizonyíték a típusára, a szűkítést végig typeguard végzi.
 *
 * **Minden normalizált mező nullable, hiányzó mező NULL-t ad.** Nincs `?? 0` és
 * nincs `?? ''` alapérték, ami hiányzó adatot valós adatnak álcázna. Ezért
 * egyetlen SDK mező meglétét sem feltételezzük, és egy SDK verzióváltás nem tud
 * kitalált értéket beírni.
 *
 * **Költség oszlop nincs.** A `result.total_cost_usd` first-party árazással
 * számol, és a `minimax` providernél nem használható (6.2 szekció); az érték a
 * nyers `payload`-ban marad, de nem lesz belőle összegezhető oszlop.
 *
 * **Kivételt nem dob**, ismeretlen `type` esetén `unrecognized_sdk_message_type`
 * hibaágat ad. Motor eredetű (`origin = 'engine'`) esemény nem megy át ezen a
 * függvényen: annak nincs nyers SDK üzenete, csak `payload`-ja (T-003-21).
 */
export function normalizeSdkMessage(message: unknown): Outcome<NormalizedSdkMessage> {
  if (!isSdkMessageEnvelope(message)) {
    return {
      kind: 'error',
      message: `A nyers SDK üzenetnek nincs nem üres, szöveges type mezője, ezért nem normalizálható (${UNRECOGNIZED}).`,
    };
  }

  const sdkMessageType = message.type;
  // A `sdk_message_subtype` oszlop forrása a 6.2 szekció szerint pontosan a
  // `system` és a `result` üzenet `subtype` mezője, más ágé nem.
  const sdkMessageSubtype =
    sdkMessageType === 'system' || sdkMessageType === 'result' ? readOptionalString(message, 'subtype') : null;

  const kind = resolveKind(sdkMessageType, sdkMessageSubtype);
  if (kind === null) {
    return {
      kind: 'error',
      message: `A(z) "${sdkMessageType}" SDK üzenettípus nem szerepel a SPEC-003 6.4 szekció zárt kind listáján (${UNRECOGNIZED}).`,
    };
  }

  return {
    kind: 'ok',
    value: {
      kind,
      sdkMessageType,
      sdkMessageSubtype,
      sdkSessionId: readOptionalString(message, 'session_id'),
      sdkUuid: readOptionalString(message, 'uuid'),
      parentToolUseId: readOptionalString(message, 'parent_tool_use_id'),
      ...readToolUseColumns(kind, message),
      ...readUsageColumns(kind, message),
      // A `num_turns` kizárólag a `result` üzenet mezője (6.2 szekció).
      numTurns: kind === 'sdk_result' ? readOptionalInt(message, 'num_turns') : null,
      payload: message,
    },
  };
}
