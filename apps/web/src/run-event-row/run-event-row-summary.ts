import { isNonEmptyString, isNumber, isRecord } from '@easter-workflow-builder/typeguards';
import type { RunEventOrigin, RunEventRecord } from '@easter-workflow-builder/protocol';

/**
 * Egy transcript sor összegzett, magyar szövegű tartalma (SPEC-008 7.1,
 * PLAN-009 T-009-24). A `RunEventRow` komponens ebből építi a panel
 * fejlécének szövegét; a nyers `payload` a sor kinyitott állapotában,
 * változatlan JSON formában látszik.
 */
export interface RunEventRowSummary {
  readonly originLabel: string;
  readonly kindLabel: string;
  readonly bodyText: string;
  /**
   * Kizárólag az `sdk_result` sornál van értéke: a `total_cost_usd` mező
   * kijelzésre formázva, vagy `ismeretlen`, ha a payloadban nincs szám. Az
   * érték az Agent SDK saját becslése, nem valós költség (user döntés
   * 2026-09-23, `docs/research/2026-09-23-sdk-koltseg-becsles.md`), ezért a
   * felület mindig ezzel a megnevezéssel mutatja.
   */
  readonly costEstimateText: string | undefined;
}

interface KindDescription {
  readonly kindLabel: string;
  readonly bodyText: string;
  readonly costEstimateText?: string;
}

const ORIGIN_LABEL: Readonly<Record<RunEventOrigin, string>> = {
  sdk: 'SDK',
  engine: 'Motor',
};

/**
 * A stream esemény `delta` objektumának szöveget hordozó mezői, a mért
 * `text_delta`, `thinking_delta` és `input_json_delta` alfajta szerint
 * (`docs/research/2026-09-23-sdk-koltseg-becsles.md` 6. szekció). A
 * `signature_delta` aláírása nem szöveg, ezért nincs a listán.
 */
const STREAM_DELTA_TEXT_KEYS = ['text', 'thinking', 'partial_json'] as const;

/**
 * Ismeretlen elemű tömb-e az érték. Ugyanaz a minta, mint a
 * `packages/db/src/run-event/sdk-message/normalize-sdk-message.ts`
 * `isUnknownArray` segédfüggvénye: az `Array.isArray` `unknown` bemenetről
 * `any[]`-re szűkítene, amit a `no-unsafe-*` szabálycsalád jogosan tiltana.
 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Egy mező a nyers, `unknown` típusú payloadból, ha az objektum.
 */
function readPayloadField(payload: unknown, key: string): unknown {
  return isRecord(payload) ? payload[key] : undefined;
}

/**
 * Egy nem üres szöveges mező a nyers, `unknown` típusú payloadból.
 */
function readPayloadString(payload: unknown, key: string): string | undefined {
  const value = readPayloadField(payload, key);
  return isNonEmptyString(value) ? value : undefined;
}

/**
 * Egy beágyazott objektum egy nem üres szöveges mezője a payloadból.
 */
function readNestedPayloadString(payload: unknown, outerKey: string, innerKey: string): string | undefined {
  return readPayloadString(readPayloadField(payload, outerKey), innerKey);
}

/**
 * Egy véges szám mező a payloadból (a `NaN` és a végtelen kiesik).
 */
function readPayloadNumber(payload: unknown, key: string): number | undefined {
  const value = readPayloadField(payload, key);
  return isNumber(value) ? value : undefined;
}

/**
 * Egy tömb mező elemszáma a payloadból.
 */
function readPayloadArrayLength(payload: unknown, key: string): number | undefined {
  const value = readPayloadField(payload, key);
  return isUnknownArray(value) ? value.length : undefined;
}

/**
 * A négy token szám kompakt, magyar nyelvű összefoglalója (SPEC-008 7.1,
 * `sdk_assistant` és `sdk_result` sor).
 */
function formatTokenCounts(record: RunEventRecord): string {
  const parts: string[] = [];
  if (record.inputTokens !== null) {
    parts.push(`bemenet: ${String(record.inputTokens)}`);
  }
  if (record.outputTokens !== null) {
    parts.push(`kimenet: ${String(record.outputTokens)}`);
  }
  if (record.cacheReadInputTokens !== null) {
    parts.push(`gyorsítótár olvasás: ${String(record.cacheReadInputTokens)}`);
  }
  if (record.cacheCreationInputTokens !== null) {
    parts.push(`gyorsítótár írás: ${String(record.cacheCreationInputTokens)}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'nincs token adat';
}

/**
 * A `total_cost_usd` kijelzett alakja. A kerekítés a pinelt CLI saját
 * `/cost` kijelzésének szabálya: fél dollár felett két, alatta négy tizedes
 * (`docs/research/2026-09-23-sdk-koltseg-becsles.md` 5. szekció), hogy a
 * szám a CLI kimenetével összevethető maradjon.
 */
function formatCostEstimate(costUsd: number | undefined): string {
  if (costUsd === undefined) {
    return 'ismeretlen';
  }
  return `$${costUsd > 0.5 ? costUsd.toFixed(2) : costUsd.toFixed(4)}`;
}

/**
 * Egy üzenet `content` mezőjének szöveges részei: a puszta szöveg, a
 * `text` blokkok, és a `tool_result` blokkok szöveges vagy blokk listás
 * `content` mezője, rekurzívan.
 */
function collectContentTexts(content: unknown): readonly string[] {
  if (isNonEmptyString(content)) {
    return [content];
  }
  if (!isUnknownArray(content)) {
    return [];
  }
  return content.flatMap((block) => {
    const text = readPayloadString(block, 'text');
    return text === undefined ? collectContentTexts(readPayloadField(block, 'content')) : [text];
  });
}

/**
 * Az `sdk_assistant` sor leírása: eszközhívás névvel és azonosítóval, ha van.
 */
function describeAssistant(record: RunEventRecord): KindDescription {
  const tokenSummary = formatTokenCounts(record);
  if (record.toolName !== null && record.toolUseId !== null) {
    return {
      kindLabel: 'Eszközhívás',
      bodyText: `${record.toolName} (${record.toolUseId}), tokenek: ${tokenSummary}`,
    };
  }
  return { kindLabel: 'Asszisztens üzenet', bodyText: `Válasz szöveg, tokenek: ${tokenSummary}` };
}

/**
 * Az `sdk_user` sor leírása (SPEC-008 7.1): a felhasználói fordulat
 * szövege, és a `parentToolUseId`, ha eszköz eredmény.
 */
function describeUser(record: RunEventRecord): KindDescription {
  const turnText = collectContentTexts(readPayloadField(readPayloadField(record.payload, 'message'), 'content')).join(
    ' ',
  );
  const turnDescription = turnText.length > 0 ? turnText : 'Felhasználói bemenet';
  if (record.parentToolUseId !== null) {
    return {
      kindLabel: 'Felhasználói üzenet',
      bodyText: `Eszköz eredmény (hívás: ${record.parentToolUseId}): ${turnDescription}`,
    };
  }
  return { kindLabel: 'Felhasználói üzenet', bodyText: turnDescription };
}

/**
 * Az `sdk_stream_event` sor leírása (SPEC-008 7.1): a részleges szöveg a
 * `event.delta` objektumból; ha az esemény nem hordoz szöveget (pl.
 * `message_start`), az esemény típusa.
 */
function describeStreamEvent(payload: unknown): KindDescription {
  const delta = readPayloadField(readPayloadField(payload, 'event'), 'delta');
  const partialText = STREAM_DELTA_TEXT_KEYS.map((key) => readPayloadString(delta, key)).find(
    (text) => text !== undefined,
  );
  if (partialText !== undefined) {
    return { kindLabel: 'Streamelt részlet', bodyText: partialText };
  }
  const eventType = readNestedPayloadString(payload, 'event', 'type');
  return {
    kindLabel: 'Streamelt részlet',
    bodyText: eventType === undefined ? 'Stream esemény' : `Stream esemény: ${eventType}`,
  };
}

/**
 * A három hook alfajta közös leírása: a `hook_name` a payloadból, ha jelen van.
 */
function describeHook(payload: unknown, kindLabel: string, fallbackBodyText: string): KindDescription {
  const hookName = readPayloadString(payload, 'hook_name');
  return { kindLabel, bodyText: hookName === undefined ? fallbackBodyText : `Hook: ${hookName}` };
}

/**
 * A `run_event.kind` mind a huszonöt értékének leképezése egy sor
 * fejlécéhez tartozó címkére és törzs szövegre (SPEC-008 7.1, AC36).
 *
 * **Kimerítő `switch`, alapértelmezett ág nélkül**: a `RunEventKind` unió a
 * `packages/protocol` csomagból jön, nem saját, duplikált listából, tehát
 * egy huszonhatodik érték felvétele ott a `switch-exhaustiveness-check`
 * ESLint szabály és a TypeScript ellenőrzés miatt itt fordítási hibát ad.
 */
function describeRunEventKind(record: RunEventRecord): KindDescription {
  switch (record.kind) {
    case 'sdk_assistant': {
      return describeAssistant(record);
    }
    case 'sdk_user': {
      return describeUser(record);
    }
    case 'sdk_stream_event': {
      return describeStreamEvent(record.payload);
    }
    case 'sdk_result': {
      const turnsLabel = record.numTurns === null ? 'ismeretlen' : String(record.numTurns);
      return {
        kindLabel: 'Eredmény',
        bodyText: `${formatTokenCounts(record)}, fordulók: ${turnsLabel}`,
        costEstimateText: formatCostEstimate(readPayloadNumber(record.payload, 'total_cost_usd')),
      };
    }
    case 'sdk_system': {
      const subtype = record.sdkMessageSubtype;
      return { kindLabel: 'Rendszerüzenet', bodyText: subtype === null ? 'Rendszerüzenet' : `Altípus: ${subtype}` };
    }
    case 'sdk_hook_started': {
      return describeHook(record.payload, 'Hook indult', 'Hook indult');
    }
    case 'sdk_hook_progress': {
      return describeHook(record.payload, 'Hook folyamatban', 'Hook folyamatban');
    }
    case 'sdk_hook_response': {
      return describeHook(record.payload, 'Hook válasz', 'Hook lezárult');
    }
    case 'sdk_informational': {
      const content = readPayloadString(record.payload, 'content');
      return { kindLabel: 'Tájékoztatás', bodyText: content ?? 'Tájékoztató üzenet' };
    }
    case 'sdk_commands_changed': {
      const commandCount = readPayloadArrayLength(record.payload, 'commands');
      return {
        kindLabel: 'Parancsok frissültek',
        bodyText: commandCount === undefined ? 'A parancslista frissült' : `${String(commandCount)} parancs érhető el`,
      };
    }
    case 'sdk_rate_limit': {
      const status = readNestedPayloadString(record.payload, 'rate_limit_info', 'status');
      return {
        kindLabel: 'Sebességkorlát',
        bodyText: status === undefined ? 'Sebességkorlát esemény' : `Állapot: ${status}`,
      };
    }
    case 'sdk_context_usage': {
      // A pinelt SDK-ban nincs önálló üzenet erre (research 2. szekció); a
      // felület a `kind` értéket kezeli, de élő gyakorlatban nem kap sort.
      return { kindLabel: 'Kontextushasználat', bodyText: 'Kontextushasználati esemény' };
    }
    case 'run_started': {
      return { kindLabel: 'Futás indult', bodyText: 'A futás elindult' };
    }
    case 'run_finished': {
      return { kindLabel: 'Futás befejeződött', bodyText: 'A futás véget ért' };
    }
    case 'run_interrupted': {
      return { kindLabel: 'Futás megszakítva', bodyText: 'A futás megszakítás alatt áll' };
    }
    case 'step_started': {
      return { kindLabel: 'Lépés elindult', bodyText: 'Egy lépés végrehajtása elkezdődött' };
    }
    case 'step_finished': {
      return { kindLabel: 'Lépés befejeződött', bodyText: 'Egy lépés végrehajtása lezárult' };
    }
    case 'branch_taken': {
      return { kindLabel: 'Elágazás', bodyText: 'A motor kiválasztott egy ágat' };
    }
    case 'fan_out_expanded': {
      return { kindLabel: 'Szétosztás', bodyText: 'A motor több ágra bontotta a végrehajtást' };
    }
    case 'join_resolved': {
      return { kindLabel: 'Összefésülés', bodyText: 'A szétosztott ágak összefésülődtek' };
    }
    case 'loop_iteration_started': {
      return { kindLabel: 'Ciklus iteráció', bodyText: 'Egy új ciklus iteráció kezdődött' };
    }
    case 'approval_requested': {
      return { kindLabel: 'Jóváhagyás kérve', bodyText: 'A motor jóváhagyásra vár' };
    }
    case 'approval_decided': {
      return { kindLabel: 'Jóváhagyási döntés', bodyText: 'A jóváhagyási döntés megszületett' };
    }
    case 'sub_workflow_started': {
      return { kindLabel: 'Al-workflow indult', bodyText: 'Egy al-workflow futása elindult' };
    }
    case 'sub_workflow_finished': {
      return { kindLabel: 'Al-workflow befejeződött', bodyText: 'Egy al-workflow futása lezárult' };
    }
  }
}

/**
 * Egy `RunEventRecord` sor összegzése, a `RunEventRow` komponens bemenete.
 */
export function summarizeRunEventRow(record: RunEventRecord): RunEventRowSummary {
  const description = describeRunEventKind(record);
  return {
    originLabel: ORIGIN_LABEL[record.origin],
    kindLabel: description.kindLabel,
    bodyText: description.bodyText,
    costEstimateText: description.costEstimateText,
  };
}
