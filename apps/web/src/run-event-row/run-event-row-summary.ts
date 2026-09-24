import { isNonEmptyString, isNumber, isRecord } from '@easter-workflow-builder/typeguards';
import type { ProviderId, RunEventOrigin, RunEventRecord } from '@easter-workflow-builder/protocol';
import type { RunEventRowTextSegment } from './run-event-row-text-segment.ts';

/**
 * Egy transcript sor összegzett, magyar szövegű tartalma (SPEC-008 7.1,
 * PLAN-009 T-009-24). A `RunEventRow` komponens ebből építi a panel
 * fejlécének szövegét; a nyers `payload` a sor kinyitott állapotában,
 * változatlan JSON formában látszik.
 */
export interface RunEventRowSummary {
  readonly originLabel: string;
  readonly kindLabel: string;
  /**
   * A típusonként eltérő törzs, darabokra bontva: a meta (eszköznév,
   * azonosító, szám) `code`, a többi `text` darab (user döntés 2026-09-24,
   * `run-event-row-text-segment.ts`).
   */
  readonly bodySegments: readonly RunEventRowTextSegment[];
  /**
   * Kizárólag az `sdk_result` sornál és kizárólag `claude-subscription`
   * providernél van értéke: a `total_cost_usd` mező kijelzésre formázva,
   * vagy `ismeretlen`, ha a payloadban nincs szám. `minimax` providernél a
   * mező sosem kap értéket, lásd `costHiddenForMinimax` (user döntés
   * 2026-09-23, pontosítva: "MiniMaxnál ne látszódjon",
   * `docs/research/2026-09-23-sdk-koltseg-becsles.md`).
   */
  readonly costEstimateText: string | undefined;
  /**
   * Igaz, ha a sor `sdk_result` és a lépés feloldott providere `minimax`:
   * ilyenkor a költség mező helyett egy mondat mondja ki, hogy az SDK erre
   * a providerre nem számol valós költséget. A `RunEventRow` ebből dönti
   * el, hogy a magyarázó mondatot megjeleníti-e.
   */
  readonly costHiddenForMinimax: boolean;
  /**
   * Igaz, ha a sor `sdk_result`, de a lépés providere nem oldható fel (a
   * `stepRunId` nem szerepel a betöltött lépés futások között, vagy a tárolt
   * érték nem ismert provider azonosító). Ilyenkor sem költség, sem a MiniMax
   * magyarázat nem jelenik meg, mert mindkettő egy konkrét providerre tett
   * állítás lenne; helyette egy mondat mondja ki, miért nincs költség
   * (T-009-25).
   */
  readonly costHiddenForUnknownProvider: boolean;
}

interface KindDescription {
  readonly kindLabel: string;
  readonly bodySegments: readonly RunEventRowTextSegment[];
  readonly costEstimateText?: string;
  readonly costHiddenForMinimax?: boolean;
  readonly costHiddenForUnknownProvider?: boolean;
}

/**
 * A sor rekordja azonosító nélkül: az összegzés az `id` mezőt nem olvassa,
 * és az átmeneti (`run_event_transient`) sornak nincs azonosítója (SPEC-008
 * 7.5, T-009-26).
 */
type RowRecord = Omit<RunEventRecord, 'id'>;

const ORIGIN_LABEL: Readonly<Record<RunEventOrigin, string>> = {
  sdk: 'SDK',
  engine: 'Motor',
};

/**
 * A sor szövegének egy darabja a törzs betűjével.
 */
function text(value: string): RunEventRowTextSegment {
  return { kind: 'text', text: value };
}

/**
 * A sor egy meta darabja (eszköznév, azonosító, szám) a design system Code
 * szerepével.
 */
function code(value: string): RunEventRowTextSegment {
  return { kind: 'code', text: value };
}

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
 * `sdk_assistant` és `sdk_result` sor): a megnevezés a törzs betűjével, a
 * szám meta darabként.
 */
function formatTokenCounts(record: RowRecord): readonly RunEventRowTextSegment[] {
  const counts: readonly (readonly [string, number | null])[] = [
    ['bemenet', record.inputTokens],
    ['kimenet', record.outputTokens],
    ['gyorsítótár olvasás', record.cacheReadInputTokens],
    ['gyorsítótár írás', record.cacheCreationInputTokens],
  ];
  const parts = counts.flatMap(([label, count]) => (count === null ? [] : [[text(`${label}: `), code(String(count))]]));
  if (parts.length === 0) {
    return [text('nincs token adat')];
  }
  return parts.flatMap((part, index) => (index === 0 ? part : [text(', '), ...part]));
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
function describeAssistant(record: RowRecord): KindDescription {
  const tokenSummary = formatTokenCounts(record);
  if (record.toolName !== null && record.toolUseId !== null) {
    return {
      kindLabel: 'Eszközhívás',
      bodySegments: [code(record.toolName), text(' ('), code(record.toolUseId), text('), tokenek: '), ...tokenSummary],
    };
  }
  return { kindLabel: 'Asszisztens üzenet', bodySegments: [text('Válasz szöveg, tokenek: '), ...tokenSummary] };
}

/**
 * Az `sdk_user` sor leírása (SPEC-008 7.1): a felhasználói fordulat
 * szövege, és a `parentToolUseId`, ha eszköz eredmény.
 */
function describeUser(record: RowRecord): KindDescription {
  const turnText = collectContentTexts(readPayloadField(readPayloadField(record.payload, 'message'), 'content')).join(
    ' ',
  );
  const turnDescription = turnText.length > 0 ? turnText : 'Felhasználói bemenet';
  if (record.parentToolUseId !== null) {
    return {
      kindLabel: 'Felhasználói üzenet',
      bodySegments: [text('Eszköz eredmény (hívás: '), code(record.parentToolUseId), text(`): ${turnDescription}`)],
    };
  }
  return { kindLabel: 'Felhasználói üzenet', bodySegments: [text(turnDescription)] };
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
    return { kindLabel: 'Streamelt részlet', bodySegments: [text(partialText)] };
  }
  const eventType = readNestedPayloadString(payload, 'event', 'type');
  return {
    kindLabel: 'Streamelt részlet',
    bodySegments: eventType === undefined ? [text('Stream esemény')] : [text('Stream esemény: '), code(eventType)],
  };
}

/**
 * A három hook alfajta közös leírása: a `hook_name` a payloadból, ha jelen van.
 */
function describeHook(payload: unknown, kindLabel: string, fallbackBodyText: string): KindDescription {
  const hookName = readPayloadString(payload, 'hook_name');
  return {
    kindLabel,
    bodySegments: hookName === undefined ? [text(fallbackBodyText)] : [text('Hook: '), code(hookName)],
  };
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
function describeRunEventKind(record: RowRecord, providerId: ProviderId | undefined): KindDescription {
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
      const turns = record.numTurns === null ? text('ismeretlen') : code(String(record.numTurns));
      const bodySegments = [...formatTokenCounts(record), text(', fordulók: '), turns];
      if (providerId === undefined) {
        return { kindLabel: 'Eredmény', bodySegments, costHiddenForUnknownProvider: true };
      }
      if (providerId === 'minimax') {
        return { kindLabel: 'Eredmény', bodySegments, costHiddenForMinimax: true };
      }
      return {
        kindLabel: 'Eredmény',
        bodySegments,
        costEstimateText: formatCostEstimate(readPayloadNumber(record.payload, 'total_cost_usd')),
      };
    }
    case 'sdk_system': {
      const subtype = record.sdkMessageSubtype;
      return {
        kindLabel: 'Rendszerüzenet',
        bodySegments: subtype === null ? [text('Rendszerüzenet')] : [text('Altípus: '), code(subtype)],
      };
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
      return { kindLabel: 'Tájékoztatás', bodySegments: [text(content ?? 'Tájékoztató üzenet')] };
    }
    case 'sdk_commands_changed': {
      const commandCount = readPayloadArrayLength(record.payload, 'commands');
      return {
        kindLabel: 'Parancsok frissültek',
        bodySegments:
          commandCount === undefined
            ? [text('A parancslista frissült')]
            : [code(String(commandCount)), text(' parancs érhető el')],
      };
    }
    case 'sdk_rate_limit': {
      const status = readNestedPayloadString(record.payload, 'rate_limit_info', 'status');
      return {
        kindLabel: 'Sebességkorlát',
        bodySegments: status === undefined ? [text('Sebességkorlát esemény')] : [text('Állapot: '), code(status)],
      };
    }
    case 'sdk_context_usage': {
      // A pinelt SDK-ban nincs önálló üzenet erre (research 2. szekció); a
      // felület a `kind` értéket kezeli, de élő gyakorlatban nem kap sort.
      return { kindLabel: 'Kontextushasználat', bodySegments: [text('Kontextushasználati esemény')] };
    }
    case 'run_started': {
      return { kindLabel: 'Futás indult', bodySegments: [text('A futás elindult')] };
    }
    case 'run_finished': {
      return { kindLabel: 'Futás befejeződött', bodySegments: [text('A futás véget ért')] };
    }
    case 'run_interrupted': {
      // Terminális állapot, nem folyamat: a szerver leállása (szabályos
      // leállás vagy az indulási helyreállítás) LEZÁRTA a futást. A
      // `megszakítás` szó a felhasználó döntésének (`cancelled`) foglalt
      // (SPEC-004 9., 10.2 "Miért `interrupted` és nem `cancelled`"), ezért a
      // felirat a futás jelvényével azonos "félbeszakítva".
      return {
        kindLabel: 'Futás félbeszakítva',
        bodySegments: [text('A futás a szerver leállása miatt félbeszakadt')],
      };
    }
    case 'step_started': {
      return { kindLabel: 'Lépés elindult', bodySegments: [text('Egy lépés végrehajtása elkezdődött')] };
    }
    case 'step_finished': {
      return { kindLabel: 'Lépés befejeződött', bodySegments: [text('Egy lépés végrehajtása lezárult')] };
    }
    case 'branch_taken': {
      return { kindLabel: 'Elágazás', bodySegments: [text('A motor kiválasztott egy ágat')] };
    }
    case 'fan_out_expanded': {
      return { kindLabel: 'Szétosztás', bodySegments: [text('A motor több ágra bontotta a végrehajtást')] };
    }
    case 'join_resolved': {
      return { kindLabel: 'Összefésülés', bodySegments: [text('A szétosztott ágak összefésülődtek')] };
    }
    case 'loop_iteration_started': {
      return { kindLabel: 'Ciklus iteráció', bodySegments: [text('Egy új ciklus iteráció kezdődött')] };
    }
    case 'approval_requested': {
      return { kindLabel: 'Jóváhagyás kérve', bodySegments: [text('A motor jóváhagyásra vár')] };
    }
    case 'approval_decided': {
      return { kindLabel: 'Jóváhagyási döntés', bodySegments: [text('A jóváhagyási döntés megszületett')] };
    }
    case 'sub_workflow_started': {
      return { kindLabel: 'Al-workflow indult', bodySegments: [text('Egy al-workflow futása elindult')] };
    }
    case 'sub_workflow_finished': {
      return { kindLabel: 'Al-workflow befejeződött', bodySegments: [text('Egy al-workflow futása lezárult')] };
    }
  }
}

/**
 * Egy `RunEventRecord` sor (vagy egy átmeneti sor azonosító nélküli rekordja)
 * összegzése, a `RunEventRow` komponens bemenete.
 *
 * A `providerId` a lépés ténylegesen feloldott providere (a hívó a
 * `record.stepRunId`-hoz tartozó `StepRunRecord.providerId` mezőből
 * biztosítja, SPEC-008 7.1), vagy `undefined`, ha a feloldás nem sikerült
 * (T-009-25). Alapérték nincs: egy alapérték a sikertelen feloldást
 * csendben egy konkrét providerré változtatná.
 */
export function summarizeRunEventRow(record: RowRecord, providerId: ProviderId | undefined): RunEventRowSummary {
  const description = describeRunEventKind(record, providerId);
  return {
    originLabel: ORIGIN_LABEL[record.origin],
    kindLabel: description.kindLabel,
    bodySegments: description.bodySegments,
    costEstimateText: description.costEstimateText,
    costHiddenForMinimax: description.costHiddenForMinimax ?? false,
    costHiddenForUnknownProvider: description.costHiddenForUnknownProvider ?? false,
  };
}
