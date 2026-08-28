/* eslint-disable unicorn/no-null -- a nyers SDK üzenetek mezői (`parent_tool_use_id`,
   `stop_reason`, `cache_creation_input_tokens`, ...) ténylegesen `null` értéket hordoznak, és a
   normalizált oszlopok is `T | null` alakúak: a `null` itt adat, nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import { isOkOutcome } from '@easter-workflow-builder/core';
import type { NormalizedSdkMessage } from './normalize-sdk-message.ts';
import { normalizeSdkMessage } from './normalize-sdk-message.ts';

/**
 * A valós `usage` objektum a `BetaUsage` alakjából (research 1. szekció,
 * "Az `SDKMessage` ágak drótalakja").
 */
const usage = {
  input_tokens: 26_339,
  output_tokens: 1562,
  cache_read_input_tokens: 33_490,
  cache_creation_input_tokens: 0,
};

function ok(message: unknown): NormalizedSdkMessage {
  const outcome = normalizeSdkMessage(message);
  if (!isOkOutcome(outcome)) {
    throw new Error(`a normalizálásnak sikeresnek kellene lennie: ${outcome.message}`);
  }
  return outcome.value;
}

function errorMessage(message: unknown): string {
  const outcome = normalizeSdkMessage(message);
  if (isOkOutcome(outcome)) {
    throw new Error('a normalizálásnak hibaágat kellett volna adnia');
  }
  return outcome.message;
}

describe('normalizeSdkMessage, a type/subtype leképezése kind értékre', () => {
  it('a system üzenet init subtype-ja sdk_system, és a subtype oszlop kitöltődik', () => {
    const value = ok({ type: 'system', subtype: 'init', session_id: 's-1', uuid: 'u-1' });
    expect(value.kind).toBe('sdk_system');
    expect(value.sdkMessageType).toBe('system');
    expect(value.sdkMessageSubtype).toBe('init');
  });

  it('a system üzenet ismeretlen vagy hiányzó subtype-ja is sdk_system', () => {
    expect(ok({ type: 'system', subtype: 'thinking_tokens' }).kind).toBe('sdk_system');
    expect(ok({ type: 'system', subtype: 'status' }).kind).toBe('sdk_system');
    const withoutSubtype = ok({ type: 'system' });
    expect(withoutSubtype.kind).toBe('sdk_system');
    expect(withoutSubtype.sdkMessageSubtype).toBeNull();
  });

  it('az öt observability system subtype a saját kind értékét kapja', () => {
    expect(ok({ type: 'system', subtype: 'hook_started' }).kind).toBe('sdk_hook_started');
    expect(ok({ type: 'system', subtype: 'hook_progress' }).kind).toBe('sdk_hook_progress');
    expect(ok({ type: 'system', subtype: 'hook_response' }).kind).toBe('sdk_hook_response');
    expect(ok({ type: 'system', subtype: 'informational' }).kind).toBe('sdk_informational');
    expect(ok({ type: 'system', subtype: 'commands_changed' }).kind).toBe('sdk_commands_changed');
  });

  it('az assistant, user, stream_event, result és rate_limit_event ág saját kind értéke', () => {
    expect(ok({ type: 'assistant', message: { content: [] } }).kind).toBe('sdk_assistant');
    expect(ok({ type: 'user', message: { role: 'user', content: 'szia' } }).kind).toBe('sdk_user');
    expect(ok({ type: 'stream_event', event: { type: 'message_stop' } }).kind).toBe('sdk_stream_event');
    expect(ok({ type: 'result', subtype: 'success' }).kind).toBe('sdk_result');
    expect(ok({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } }).kind).toBe('sdk_rate_limit');
  });

  it('a result üzenet mindkét subtype családja sdk_result, a subtype oszlop szó szerint tárolódik', () => {
    expect(ok({ type: 'result', subtype: 'success' }).sdkMessageSubtype).toBe('success');
    expect(ok({ type: 'result', subtype: 'error_max_turns' }).sdkMessageSubtype).toBe('error_max_turns');
    expect(ok({ type: 'result' }).sdkMessageSubtype).toBeNull();
  });

  it('a subtype oszlop kizárólag system és result üzenetből töltődik', () => {
    // A 6.2 szekció szó szerint "a `system` és a `result` üzenet `subtype`
    // mezője"; más ágon akkor sem olvassuk ki, ha jelen van.
    expect(ok({ type: 'assistant', subtype: 'valami', message: { content: [] } }).sdkMessageSubtype).toBeNull();
    expect(ok({ type: 'stream_event', subtype: 'valami' }).sdkMessageSubtype).toBeNull();
  });

  it('az sdk_context_usage értékre nincs leképezés ebben az SDK verzióban', () => {
    // Az `SDKContextUsage` nem `SDKMessage` ág, hanem az
    // `SDKAssistantMessage.context_usage` mezőjének a típusa (research 1.
    // szekció), tehát a context usage adatot hordozó üzenet `sdk_assistant`.
    const value = ok({
      type: 'assistant',
      message: { content: [] },
      context_usage: { model: 'MiniMax-M3', total_tokens: 80_987 },
    });
    expect(value.kind).toBe('sdk_assistant');
    // És nincs olyan nyers `type`, amiből `sdk_context_usage` lenne: kitalált
    // leképezés helyett hibaág.
    expect(errorMessage({ type: 'context_usage' })).toContain('unrecognized_sdk_message_type');
  });
});

describe('normalizeSdkMessage, ismeretlen üzenettípus', () => {
  it('a 6.4 listán nem szereplő type hibaágat ad', () => {
    // A pinelt SDK `SDKMessage` uniója szélesebb, mint a 6.4 huszonöt értékű
    // listája; ezekre nevesített hibaág jár, nem csendes "ismeretlen" kind.
    expect(errorMessage({ type: 'keep_alive' })).toContain('unrecognized_sdk_message_type');
    expect(errorMessage({ type: 'tool_progress' })).toContain('tool_progress');
    expect(errorMessage({ type: 'auth_status' })).toContain('unrecognized_sdk_message_type');
  });

  it('a nem boríték alakú bemenet is hibaágat ad', () => {
    expect(errorMessage(null)).toContain('unrecognized_sdk_message_type');
    expect(errorMessage(undefined)).toContain('unrecognized_sdk_message_type');
    expect(errorMessage('assistant')).toContain('unrecognized_sdk_message_type');
    expect(errorMessage([{ type: 'assistant' }])).toContain('unrecognized_sdk_message_type');
    expect(errorMessage({})).toContain('unrecognized_sdk_message_type');
    expect(errorMessage({ type: '' })).toContain('unrecognized_sdk_message_type');
    expect(errorMessage({ type: 7 })).toContain('unrecognized_sdk_message_type');
  });
});

describe('normalizeSdkMessage, hiányzó mező NULL-t ad', () => {
  it('a hiányzó session_id, uuid és parent_tool_use_id oszlopa NULL', () => {
    const value = ok({ type: 'assistant', message: { content: [] } });
    expect(value.sdkSessionId).toBeNull();
    expect(value.sdkUuid).toBeNull();
    expect(value.parentToolUseId).toBeNull();
  });

  it('a jelen lévő session_id, uuid és parent_tool_use_id kitöltődik', () => {
    const value = ok({
      type: 'stream_event',
      event: { type: 'content_block_delta' },
      session_id: 'ses-42',
      uuid: 'uuid-42',
      parent_tool_use_id: 'toolu_01',
    });
    expect(value.sdkSessionId).toBe('ses-42');
    expect(value.sdkUuid).toBe('uuid-42');
    expect(value.parentToolUseId).toBe('toolu_01');
  });

  it('az üres szöveg és a nem szöveg érték NULL-t ad, nem üres szöveget', () => {
    // Az `sdk_uuid` oszlopon egyedi index fut a `(run_id, sdk_uuid)` páron:
    // két üres szöveg ütközne, két NULL nem (F-10).
    const value = ok({
      type: 'assistant',
      message: { content: [] },
      uuid: '',
      session_id: 42,
      parent_tool_use_id: null,
    });
    expect(value.sdkUuid).toBeNull();
    expect(value.sdkSessionId).toBeNull();
    expect(value.parentToolUseId).toBeNull();
  });

  it('az sdk_assistant üzenetből hiányzó usage mező NULL oszlopot ad, nem nullát', () => {
    const value = ok({
      type: 'assistant',
      message: { content: [], usage: { input_tokens: 128, cache_read_input_tokens: 64 } },
    });
    expect(value.inputTokens).toBe(128);
    expect(value.cacheReadInputTokens).toBe(64);
    // A két hiányzó mező NULL, nem 0: a `?? 0` alapérték hiányzó adatot
    // mutatna valósnak (10. kritérium).
    expect(value.outputTokens).toBeNull();
    expect(value.cacheCreationInputTokens).toBeNull();
  });

  it('a nem egész usage érték NULL-t ad', () => {
    const value = ok({
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: '128', output_tokens: 1.5, cache_read_input_tokens: null, cache_creation_input_tokens: 7 },
    });
    expect(value.inputTokens).toBeNull();
    expect(value.outputTokens).toBeNull();
    expect(value.cacheReadInputTokens).toBeNull();
    expect(value.cacheCreationInputTokens).toBe(7);
  });

  it('a hiányzó vagy nem rekord usage objektum mind a négy oszlopot NULL-on hagyja', () => {
    const withoutUsage = ok({ type: 'result', subtype: 'success' });
    expect(withoutUsage.inputTokens).toBeNull();
    expect(withoutUsage.outputTokens).toBeNull();
    expect(withoutUsage.cacheReadInputTokens).toBeNull();
    expect(withoutUsage.cacheCreationInputTokens).toBeNull();

    const scalarUsage = ok({ type: 'result', subtype: 'success', usage: 'nem objektum' });
    expect(scalarUsage.inputTokens).toBeNull();

    const assistantWithoutMessage = ok({ type: 'assistant' });
    expect(assistantWithoutMessage.inputTokens).toBeNull();

    const assistantScalarUsage = ok({ type: 'assistant', message: { content: [], usage: 7 } });
    expect(assistantScalarUsage.inputTokens).toBeNull();
  });

  it('a num_turns kizárólag a result üzenetből töltődik, hibás értékre NULL', () => {
    expect(ok({ type: 'result', subtype: 'success', num_turns: 4 }).numTurns).toBe(4);
    expect(ok({ type: 'result', subtype: 'success', num_turns: '4' }).numTurns).toBeNull();
    expect(ok({ type: 'result', subtype: 'success' }).numTurns).toBeNull();
    expect(ok({ type: 'assistant', message: { content: [] }, num_turns: 4 }).numTurns).toBeNull();
    expect(ok({ type: 'system', subtype: 'init', num_turns: 4 }).numTurns).toBeNull();
  });
});

describe('normalizeSdkMessage, a usage oszlopok forrásának zártsága (61. kritérium)', () => {
  it('az sdk_assistant és az sdk_result sor usage oszlopai ténylegesen kitöltődnek', () => {
    const assistant = ok({ type: 'assistant', message: { content: [], usage } });
    expect(assistant.kind).toBe('sdk_assistant');
    expect(assistant.inputTokens).toBe(26_339);
    expect(assistant.outputTokens).toBe(1562);
    expect(assistant.cacheReadInputTokens).toBe(33_490);
    expect(assistant.cacheCreationInputTokens).toBe(0);

    const result = ok({ type: 'result', subtype: 'success', usage, num_turns: 3 });
    expect(result.kind).toBe('sdk_result');
    expect(result.inputTokens).toBe(26_339);
    expect(result.outputTokens).toBe(1562);
    expect(result.cacheReadInputTokens).toBe(33_490);
    expect(result.cacheCreationInputTokens).toBe(0);
    expect(result.numTurns).toBe(3);
  });

  it('az sdk_stream_event sorból egyetlen usage oszlop sem töltődik, usage mező jelenlétében sem', () => {
    // Adverzariális bemenet: a usage MINDHÁROM lehetséges helyen ott van
    // (top-level, `message.usage`, és a nyers streaming eseményen belül),
    // az oszlopoknak mégis NULL-nak kell maradniuk. Ez a 6.2 szekció
    // "sdk_stream_event sorból soha" szabálya és a 61. kritérium.
    const value = ok({
      type: 'stream_event',
      event: { type: 'message_delta', usage, message: { usage } },
      usage,
      message: { content: [], usage },
      parent_tool_use_id: null,
      uuid: 'uuid-1',
      session_id: 'ses-1',
    });

    expect(value.kind).toBe('sdk_stream_event');
    expect(value.inputTokens).toBeNull();
    expect(value.outputTokens).toBeNull();
    expect(value.cacheReadInputTokens).toBeNull();
    expect(value.cacheCreationInputTokens).toBeNull();
    // A többi normalizált mező viszont ettől függetlenül kitöltődik.
    expect(value.sdkUuid).toBe('uuid-1');
    expect(value.sdkSessionId).toBe('ses-1');
  });

  it('a másik kilenc sdk eredetű kind sem tölt usage oszlopot', () => {
    const carriers: readonly unknown[] = [
      { type: 'system', subtype: 'init', usage, message: { content: [], usage } },
      { type: 'system', subtype: 'hook_started', usage },
      { type: 'system', subtype: 'hook_progress', usage },
      { type: 'system', subtype: 'hook_response', usage },
      { type: 'system', subtype: 'informational', usage },
      { type: 'system', subtype: 'commands_changed', usage },
      { type: 'user', usage, message: { role: 'user', content: 'szia', usage } },
      { type: 'rate_limit_event', usage, rate_limit_info: { status: 'allowed' } },
    ];

    for (const carrier of carriers) {
      const value = ok(carrier);
      expect(value.inputTokens).toBeNull();
      expect(value.outputTokens).toBeNull();
      expect(value.cacheReadInputTokens).toBeNull();
      expect(value.cacheCreationInputTokens).toBeNull();
    }
  });
});

describe('normalizeSdkMessage, a tool_use blokk kinyerése', () => {
  it('az asszisztens üzenet tool_use blokkjából jön a tool_name és a tool_use_id', () => {
    const value = ok({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Megnézem.' },
          { type: 'tool_use', id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6', name: 'get_weather', input: {} },
        ],
      },
    });
    expect(value.toolName).toBe('get_weather');
    expect(value.toolUseId).toBe('toolu_01T1x1fJ34qAmk2tNTrN7Up6');
  });

  it('több tool_use blokk esetén az első érvényes kerül az oszlopokba', () => {
    const value = ok({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'toolu_a', name: 'elso', input: {} },
          { type: 'tool_use', id: 'toolu_b', name: 'masodik', input: {} },
        ],
      },
    });
    expect(value.toolName).toBe('elso');
    expect(value.toolUseId).toBe('toolu_a');
  });

  it('a hiányos tool_use blokkot átugorja, és nem talál esetén NULL marad', () => {
    const skipped = ok({
      type: 'assistant',
      message: {
        content: [
          'nem objektum',
          null,
          { type: 'thinking', thinking: '...' },
          { type: 'tool_use', name: 'nincs_id', input: {} },
          { type: 'tool_use', id: 'toolu_c', name: '', input: {} },
          { type: 'tool_use', id: 'toolu_d', name: 'jo', input: {} },
        ],
      },
    });
    expect(skipped.toolName).toBe('jo');
    expect(skipped.toolUseId).toBe('toolu_d');

    const nothing = ok({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'csak szöveg' }] },
    });
    expect(nothing.toolName).toBeNull();
    expect(nothing.toolUseId).toBeNull();
  });

  it('NULL marad, ha a message hiányzik, vagy a content nem tömb', () => {
    expect(ok({ type: 'assistant' }).toolName).toBeNull();
    expect(ok({ type: 'assistant', message: 'nem objektum' }).toolName).toBeNull();
    expect(ok({ type: 'assistant', message: { content: 'nem tömb' } }).toolUseId).toBeNull();
    expect(ok({ type: 'assistant', message: {} }).toolUseId).toBeNull();
  });

  it('nem asszisztens üzenetből akkor sem olvassuk ki, ha van tool_use alakú blokk', () => {
    const content = [{ type: 'tool_use', id: 'toolu_x', name: 'tiltott', input: {} }];
    expect(ok({ type: 'user', message: { role: 'user', content } }).toolName).toBeNull();
    expect(ok({ type: 'stream_event', message: { content } }).toolUseId).toBeNull();
    expect(ok({ type: 'result', subtype: 'success', message: { content } }).toolName).toBeNull();
    expect(ok({ type: 'system', subtype: 'init', message: { content } }).toolName).toBeNull();
  });
});

describe('normalizeSdkMessage, a payload és a hiányzó költség oszlop', () => {
  it('a payload a teljes nyers üzenet, változtatás nélkül', () => {
    const raw = { type: 'result', subtype: 'success', usage, num_turns: 4, total_cost_usd: 0.213 };
    const value = ok(raw);
    expect(value.payload).toBe(raw);
  });

  it('a total_cost_usd nem kap normalizált oszlopot, csak a payloadban marad', () => {
    const raw = { type: 'result', subtype: 'success', total_cost_usd: 0.213 };
    const value = ok(raw);
    // A `NormalizedSdkMessage` kulcskészlete tételesen a 6.2 mezőkészlet,
    // költség oszlop nélkül (10. kritérium). A sorrend az objektum literál
    // beszúrási sorrendje, tehát determinisztikus; egy jövőbeli, észrevétlenül
    // bevezetett oszlop megbuktatja ezt az assertet.
    expect(Object.keys(value)).toStrictEqual([
      'kind',
      'sdkMessageType',
      'sdkMessageSubtype',
      'sdkSessionId',
      'sdkUuid',
      'parentToolUseId',
      'toolName',
      'toolUseId',
      'inputTokens',
      'outputTokens',
      'cacheReadInputTokens',
      'cacheCreationInputTokens',
      'numTurns',
      'payload',
    ]);
    expect(value.payload).toBe(raw);
  });
});
