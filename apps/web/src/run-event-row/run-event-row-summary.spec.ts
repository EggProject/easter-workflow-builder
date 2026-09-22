/* eslint-disable unicorn/no-null -- a szintetikus RunEventRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import {
  RunEventKindSchema,
  type RunEventKind,
  type RunEventOrigin,
  type RunEventRecord,
} from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { summarizeRunEventRow } from './run-event-row-summary.ts';

function makeRecord(overrides: Partial<RunEventRecord> & { readonly kind: RunEventKind }): RunEventRecord {
  const origin: RunEventOrigin = overrides.kind.startsWith('sdk_') ? 'sdk' : 'engine';
  return {
    id: 1,
    runId: 'run-1',
    stepRunId: null,
    origin,
    occurredAtMs: 1_700_000_000_000,
    sdkMessageType: null,
    sdkMessageSubtype: null,
    sdkSessionId: null,
    sdkUuid: null,
    parentToolUseId: null,
    toolName: null,
    toolUseId: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    numTurns: null,
    payload: null,
    ...overrides,
  };
}

describe('summarizeRunEventRow', () => {
  // AC3 (PLAN-009 T-009-24): a tesztesetek listája magából a `RunEventKindSchema`
  // felsorolásból származik, nem egy itt kézzel írt, duplikált listából - így egy
  // huszonhatodik érték e teszt nélkül nem csúszhatna be észrevétlenül.
  it('mind a huszonöt RunEventKind értékre nem üres kindLabel-t és bodyText-et ad', () => {
    expect(RunEventKindSchema.options).toHaveLength(25);
    for (const kind of RunEventKindSchema.options) {
      const summary = summarizeRunEventRow(makeRecord({ kind }));
      expect(summary.kindLabel.length).toBeGreaterThan(0);
      expect(summary.bodyText.length).toBeGreaterThan(0);
      expect(summary.originLabel.length).toBeGreaterThan(0);
      // Költség mezője kizárólag az `sdk_result` sornak van (user döntés 2026-09-23).
      expect(summary.costEstimateText === undefined).toBe(kind !== 'sdk_result');
    }
  });

  it('egyetlen sor szövegében sincs gondolatjel', () => {
    for (const kind of RunEventKindSchema.options) {
      const summary = summarizeRunEventRow(
        makeRecord({ kind, toolName: 'web_search', toolUseId: 'tool-abc', parentToolUseId: 'tool-xyz' }),
      );
      expect(`${summary.kindLabel} ${summary.bodyText}`).not.toContain('\u{2014}');
    }
  });

  it('az origin sdk értéke SDK, az engine értéke Motor feliratot kap', () => {
    expect(summarizeRunEventRow(makeRecord({ kind: 'sdk_result' })).originLabel).toBe('SDK');
    expect(summarizeRunEventRow(makeRecord({ kind: 'run_started' })).originLabel).toBe('Motor');
  });

  describe('sdk_assistant', () => {
    it('megjeleníti a toolName-t, a toolUseId-t és mind a négy token számot', () => {
      const summary = summarizeRunEventRow(
        makeRecord({
          kind: 'sdk_assistant',
          toolName: 'web_search',
          toolUseId: 'tool-abc',
          inputTokens: 10,
          outputTokens: 20,
          cacheReadInputTokens: 30,
          cacheCreationInputTokens: 40,
        }),
      );
      expect(summary.bodyText).toContain('web_search');
      expect(summary.bodyText).toContain('tool-abc');
      expect(summary.bodyText).toContain('bemenet: 10');
      expect(summary.bodyText).toContain('kimenet: 20');
      expect(summary.bodyText).toContain('gyorsítótár olvasás: 30');
      expect(summary.bodyText).toContain('gyorsítótár írás: 40');
    });

    it('eszközhívás nélkül, token adat nélkül a nincs token adat szöveget adja', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_assistant' }));
      expect(summary.kindLabel).toBe('Asszisztens üzenet');
      expect(summary.bodyText).toContain('nincs token adat');
    });

    it('csak toolName vagy csak toolUseId esetén nem eszközhívásként mutatja (mindkettő kell)', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_assistant', toolName: 'web_search', toolUseId: null }),
      );
      expect(summary.kindLabel).toBe('Asszisztens üzenet');
    });
  });

  describe('sdk_user', () => {
    it('eszköz eredmény esetén megnevezi a parentToolUseId-t', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_user', parentToolUseId: 'tool-xyz' }));
      expect(summary.bodyText).toBe('Eszköz eredmény (hívás: tool-xyz): Felhasználói bemenet');
    });

    it('parentToolUseId nélkül és szöveg nélkül általános felhasználói bemenet szöveget ad', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_user' }));
      expect(summary.bodyText).toBe('Felhasználói bemenet');
    });

    it('a puszta szöveges content mezőt mutatja felhasználói fordulatként', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_user', payload: { message: { role: 'user', content: 'Foglald össze a cikket' } } }),
      );
      expect(summary.bodyText).toBe('Foglald össze a cikket');
    });

    it('a text blokkok szövegét egymás után fűzi', () => {
      const summary = summarizeRunEventRow(
        makeRecord({
          kind: 'sdk_user',
          payload: {
            message: {
              content: [
                { type: 'text', text: 'Első' },
                { type: 'text', text: 'Második' },
              ],
            },
          },
        }),
      );
      expect(summary.bodyText).toBe('Első Második');
    });

    it('a tool_result blokk szöveges és blokk listás content mezőjét is kiolvassa, a nem objektum elemet kihagyja', () => {
      const summary = summarizeRunEventRow(
        makeRecord({
          kind: 'sdk_user',
          parentToolUseId: 'tool-xyz',
          payload: {
            message: {
              content: [
                { type: 'tool_result', tool_use_id: 'call-1', content: 'kész' },
                { type: 'tool_result', tool_use_id: 'call-2', content: [{ type: 'text', text: 'teszt' }] },
                42,
              ],
            },
          },
        }),
      );
      expect(summary.bodyText).toBe('Eszköz eredmény (hívás: tool-xyz): kész teszt');
    });
  });

  describe('sdk_stream_event', () => {
    it.each([
      ['text_delta', { type: 'text_delta', text: 'Szia' }, 'Szia'] as const,
      ['thinking_delta', { type: 'thinking_delta', thinking: 'gondolkodom' }, 'gondolkodom'] as const,
      ['input_json_delta', { type: 'input_json_delta', partial_json: '{"q":' }, '{"q":'] as const,
    ])('%s: a részleges szöveget mutatja', (_name, delta, expected) => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_stream_event', payload: { event: { type: 'content_block_delta', delta } } }),
      );
      expect(summary.kindLabel).toBe('Streamelt részlet');
      expect(summary.bodyText).toBe(expected);
    });

    it('szöveg nélküli eseménynél az esemény típusát nevezi meg', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_stream_event', payload: { event: { type: 'message_start' } } }),
      );
      expect(summary.bodyText).toBe('Stream esemény: message_start');
    });

    it('esemény nélküli payloadnál általános szöveget ad', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_stream_event' }));
      expect(summary.bodyText).toBe('Stream esemény');
    });
  });

  describe('sdk_result', () => {
    it('mind a négy token számot és a numTurns értéket mutatja, a költség külön mezőben áll', () => {
      const summary = summarizeRunEventRow(
        makeRecord({
          kind: 'sdk_result',
          inputTokens: 1,
          outputTokens: 2,
          cacheReadInputTokens: 3,
          cacheCreationInputTokens: 4,
          numTurns: 5,
        }),
      );
      expect(summary.bodyText).toContain('bemenet: 1');
      expect(summary.bodyText).toContain('kimenet: 2');
      expect(summary.bodyText).toContain('gyorsítótár olvasás: 3');
      expect(summary.bodyText).toContain('gyorsítótár írás: 4');
      expect(summary.bodyText).toContain('fordulók: 5');
      expect(summary.bodyText).not.toContain('$');
    });

    it('hiányzó token adat és numTurns esetén a nincs token adat és ismeretlen szöveget adja', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_result' }));
      expect(summary.bodyText).toBe('nincs token adat, fordulók: ismeretlen');
    });

    // A kerekítés a pinelt CLI `/cost` kijelzésének szabálya (research
    // 2026-09-23 5. szekció); a két mért érték az M-13 és az M-28 futásé.
    it.each([
      [0.213108, '$0.2131'] as const,
      [0.497899, '$0.4979'] as const,
      [0.5, '$0.5000'] as const,
      [1.23456, '$1.23'] as const,
    ])('a total_cost_usd %s értékét %s alakban adja', (totalCostUsd, expected) => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_result', payload: { type: 'result', total_cost_usd: totalCostUsd } }),
      );
      expect(summary.costEstimateText).toBe(expected);
    });

    it.each([
      ['hiányzó mező', { type: 'result' }] as const,
      ['nem szám', { type: 'result', total_cost_usd: '0.21' }] as const,
      ['nem objektum payload', 'nem objektum'] as const,
    ])('%s esetén a költség ismeretlen', (_name, payload) => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_result', payload }));
      expect(summary.costEstimateText).toBe('ismeretlen');
    });
  });

  describe('sdk_system', () => {
    it('subtype nélkül általános Rendszerüzenet szöveget ad', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_system' }));
      expect(summary.bodyText).toBe('Rendszerüzenet');
    });

    it('subtype-pal az altípus nevét mutatja', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_system', sdkMessageSubtype: 'init' }));
      expect(summary.bodyText).toBe('Altípus: init');
    });
  });

  describe('a három hook alfajta', () => {
    it.each([
      ['sdk_hook_started', 'Hook indult'] as const,
      ['sdk_hook_progress', 'Hook folyamatban'] as const,
      ['sdk_hook_response', 'Hook válasz'] as const,
    ])('%s: hook_name jelenlétében megnevezi a hookot', (kind, kindLabel) => {
      const summary = summarizeRunEventRow(makeRecord({ kind, payload: { hook_name: 'pre-commit' } }));
      expect(summary.kindLabel).toBe(kindLabel);
      expect(summary.bodyText).toBe('Hook: pre-commit');
    });

    it('hook_name nélkül, nem objektum payload esetén az alapértelmezett szöveget adja', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_hook_started', payload: 'nem objektum' }));
      expect(summary.bodyText).toBe('Hook indult');
    });

    it('hook_name nélkül, üres objektum payload esetén a válasz alapértelmezettje jelenik meg', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_hook_response', payload: {} }));
      expect(summary.bodyText).toBe('Hook lezárult');
    });
  });

  describe('sdk_informational', () => {
    it('a payload content mezőjét mutatja', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_informational', payload: { content: 'Slash parancs lefutott' } }),
      );
      expect(summary.bodyText).toBe('Slash parancs lefutott');
    });

    it('content nélkül általános szöveget ad', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_informational', payload: {} }));
      expect(summary.bodyText).toBe('Tájékoztató üzenet');
    });
  });

  describe('sdk_commands_changed', () => {
    it('a commands tömb elemszámát mutatja', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_commands_changed', payload: { commands: [{}, {}, {}] } }),
      );
      expect(summary.bodyText).toBe('3 parancs érhető el');
    });

    it('commands tömb nélkül általános szöveget ad', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_commands_changed', payload: { commands: 'nem tömb' } }),
      );
      expect(summary.bodyText).toBe('A parancslista frissült');
    });
  });

  describe('sdk_rate_limit', () => {
    it('a rate_limit_info.status mezőt mutatja', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_rate_limit', payload: { rate_limit_info: { status: 'allowed_warning' } } }),
      );
      expect(summary.bodyText).toBe('Állapot: allowed_warning');
    });

    it('nem objektum payload esetén általános szöveget ad', () => {
      const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_rate_limit', payload: 'nem objektum' }));
      expect(summary.bodyText).toBe('Sebességkorlát esemény');
    });

    it('nem objektum rate_limit_info esetén is általános szöveget ad', () => {
      const summary = summarizeRunEventRow(
        makeRecord({ kind: 'sdk_rate_limit', payload: { rate_limit_info: 'nem objektum' } }),
      );
      expect(summary.bodyText).toBe('Sebességkorlát esemény');
    });
  });

  it('sdk_context_usage esetén általános szöveget ad, mert a pinelt SDK-ban nincs önálló üzenet erre', () => {
    const summary = summarizeRunEventRow(makeRecord({ kind: 'sdk_context_usage' }));
    expect(summary.bodyText).toBe('Kontextushasználati esemény');
  });

  describe('a tizenhárom engine eredetű kind', () => {
    it.each([
      ['run_started', 'Futás indult'] as const,
      ['run_finished', 'Futás befejeződött'] as const,
      ['run_interrupted', 'Futás megszakítva'] as const,
      ['step_started', 'Lépés elindult'] as const,
      ['step_finished', 'Lépés befejeződött'] as const,
      ['branch_taken', 'Elágazás'] as const,
      ['fan_out_expanded', 'Szétosztás'] as const,
      ['join_resolved', 'Összefésülés'] as const,
      ['loop_iteration_started', 'Ciklus iteráció'] as const,
      ['approval_requested', 'Jóváhagyás kérve'] as const,
      ['approval_decided', 'Jóváhagyási döntés'] as const,
      ['sub_workflow_started', 'Al-workflow indult'] as const,
      ['sub_workflow_finished', 'Al-workflow befejeződött'] as const,
    ])('%s: saját magyar mondatot ad, Motor eredettel', (kind, kindLabel) => {
      const summary = summarizeRunEventRow(makeRecord({ kind }));
      expect(summary.kindLabel).toBe(kindLabel);
      expect(summary.originLabel).toBe('Motor');
    });
  });
});
