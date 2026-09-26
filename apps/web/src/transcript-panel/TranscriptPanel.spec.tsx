/* eslint-disable unicorn/no-null -- a RunEventRecord és a StepRunRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 4.10, 6.2) */
import type { RunEventRecord, RunStatus, StepRunRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';
import { toTransientRowRecord } from './to-transient-row-record.ts';
import type { TranscriptRow } from './transcript-row.ts';
import { TranscriptPanel } from './TranscriptPanel.tsx';

function makeRecord(id: number, overrides: Partial<RunEventRecord> = {}): RunEventRecord {
  return {
    id,
    runId: 'run-1',
    stepRunId: null,
    origin: 'engine',
    kind: 'step_started',
    occurredAtMs: id,
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
    payload: {},
    ...overrides,
  };
}

const CLAUDE_STEP_RUN: StepRunRecord = {
  id: 's-claude',
  runId: 'run-1',
  nodeId: 'n-1',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
  providerId: 'claude-subscription',
  modelId: null,
  sessionMode: null,
  sdkSessionId: null,
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: null,
  resultSubtype: null,
  numTurns: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 1,
  finishedAtMs: 2,
  createdAtMs: 1,
};

function persistedRow(record: RunEventRecord): TranscriptRow {
  return { source: 'persisted', key: `event-${String(record.id)}`, record };
}

/**
 * Egy átmeneti sor, a szerver által kikapcsolt delta kapcsolónál küldött
 * alakú keretből (`apps/server/src/engine-assembly/classify-published-event.ts`).
 */
function transientRow(sequence: number, text: string): TranscriptRow {
  return {
    source: 'transient',
    key: `transient-${String(sequence)}`,
    record: toTransientRowRecord({
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: 's-claude',
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } },
    }),
  };
}

function rowsTranscript(rows: readonly TranscriptRow[], isReplayComplete: boolean): RunTranscriptState {
  const persisted = rows.flatMap((row) => (row.source === 'persisted' ? [row.record.id] : []));
  const transientCount = rows.filter((row) => row.source === 'transient').length;
  return { rows, afterEventId: persisted.at(-1) ?? 0, transientSequence: transientCount, isReplayComplete };
}

function transcriptOf(records: readonly RunEventRecord[], isReplayComplete: boolean): RunTranscriptState {
  return rowsTranscript(
    records.map((record) => persistedRow(record)),
    isReplayComplete,
  );
}

const DELTA_NOTE =
  'Ennél a futásnál a streamelt részleges szöveg csak élőben látszik, nem kerül tárolásra: újratöltés vagy ' +
  'későbbi megnyitás után csak az összeállt üzenetek maradnak meg.';

function manyRecords(count: number): readonly RunEventRecord[] {
  return Array.from({ length: count }, (_, index) => makeRecord(index + 1));
}

/**
 * A lista `ResizeObserver` jelentése rögzített tartalom doboz magassággal: a
 * `react-window` ebből adja az `onResize` méretét (a happy-dom nem végez
 * layoutot). A megfigyelő a megfigyelés kezdetén azonnal jelent, és csak a
 * lista elemére: a sorok magasságát ugyanez az API figyeli
 * (`useDynamicRowHeight`), azok mérete itt nem tárgy.
 */
function stubListContentHeight(height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly #callback: (entries: readonly { target: Element; contentRect: DOMRectReadOnly }[]) => void;

      constructor(callback: (entries: readonly { target: Element; contentRect: DOMRectReadOnly }[]) => void) {
        this.#callback = callback;
      }

      observe(target: Element): void {
        if (target.classList.contains('transcript-panel__list')) {
          this.#callback([{ target, contentRect: new DOMRect(0, 0, 300, height) }]);
        }
      }

      unobserve(): void {
        // A rögzített jelentésnek nincs leiratkozása.
      }

      disconnect(): void {
        // A rögzített jelentésnek nincs leiratkozása.
      }
    },
  );
}

describe('TranscriptPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderPanel(
    transcript: RunTranscriptState,
    stepRuns: readonly StepRunRecord[] = [],
    runStatus: RunStatus = 'running',
    hasPersistedStreamDeltas = true,
  ): void {
    act(() => {
      root.render(
        <TranscriptPanel
          transcript={transcript}
          stepRuns={stepRuns}
          runStatus={runStatus}
          persistedStreamDeltas={hasPersistedStreamDeltas}
        />,
      );
    });
  }

  function list(): HTMLElement {
    const element = container.querySelector<HTMLElement>('[role="list"]');
    if (element === null) {
      throw new Error('a teszt nem talált listát');
    }
    return element;
  }

  /**
   * A kinyitott sorok sorszáma (`aria-posinset`), a kirajzolt sorok közül.
   */
  function expandedPositions(): readonly (string | null)[] {
    return [...list().querySelectorAll('[role="listitem"]')]
      .filter((item) => item.querySelector('.accordion__header')?.getAttribute('aria-expanded') === 'true')
      .map((item) => item.getAttribute('aria-posinset'));
  }

  /**
   * Az "ugrás az aljára" gomb, ha a DOM-ban van: a lista keretében, a lista
   * előtt áll, és új esemény nélkül nincs kirajzolva.
   */
  function queryJumpButton(): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(':scope .transcript-panel__list-frame > button');
  }

  function jumpButton(): HTMLButtonElement {
    const element = queryJumpButton();
    if (element === null) {
      throw new Error('a teszt nem talált ugrás gombot');
    }
    return element;
  }

  function listFrame(): HTMLElement {
    const element = container.querySelector<HTMLElement>(':scope .transcript-panel__list-frame');
    if (element === null) {
      throw new Error('a teszt nem talált lista keretet');
    }
    return element;
  }

  function statusTexts(): readonly (string | null)[] {
    return [...container.querySelectorAll('[role="status"]')].map((element) => element.textContent);
  }

  it.each(['running', 'succeeded'] satisfies RunStatus[])(
    '%s futás első lapjának betöltése alatt a fejlécben az előzmények betöltését, a lista helyén csontvázat mutat',
    (runStatus) => {
      renderPanel(transcriptOf([], false), [], runStatus);

      expect(statusTexts()).toEqual(['Előzmények betöltése']);
      expect(container.querySelectorAll(':scope .transcript-panel__loading .skel')).toHaveLength(4);
      expect(container.querySelector('[role="list"]')).toBeNull();
      expect(container.querySelector('.transcript-panel__empty')).toBeNull();
    },
  );

  it.each(['pending', 'running'] satisfies RunStatus[])(
    'lezárult pótlás és nulla esemény mellett a még tartó (%s) futás az első eseményre várakozást jelzi',
    (runStatus) => {
      renderPanel(transcriptOf([], true), [], runStatus);

      expect(statusTexts()).toEqual(['Várakozás az első eseményre']);
      expect(container.querySelector('.transcript-panel__empty')).toBeNull();
      expect(container.querySelector('.transcript-panel__loading')).toBeNull();
      expect(queryJumpButton()).toBeNull();
      expect(list().querySelectorAll('[role="listitem"]')).toHaveLength(0);
    },
  );

  it.each(['succeeded', 'failed', 'cancelled', 'interrupted'] satisfies RunStatus[])(
    'lezárult pótlás és nulla esemény mellett a lezárt (%s) futás kimondja, hogy nincs esemény, várakozás jelzés nélkül',
    (runStatus) => {
      renderPanel(transcriptOf([], true), [], runStatus);

      expect(container.querySelector('.transcript-panel__empty')?.textContent).toBe('A futásnak nincs eseménye.');
      expect(statusTexts()).toEqual([]);
      expect(container.querySelector('.transcript-panel__loading')).toBeNull();
      expect(queryJumpButton()).toBeNull();
      expect(list().querySelectorAll('[role="listitem"]')).toHaveLength(0);
    },
  );

  it('a még tartó futás első eseménye után a várakozás jelzés eltűnik', () => {
    renderPanel(transcriptOf([], true));
    expect(statusTexts()).toEqual(['Várakozás az első eseményre']);

    renderPanel(transcriptOf([makeRecord(1)], true));
    expect(statusTexts()).toEqual([]);
    expect(list().querySelectorAll('.run-event-row')).toHaveLength(1);
  });

  it('a pótlás alatt már megérkezett sorok látszanak, a fejléc közben még a betöltést jelzi', () => {
    renderPanel(transcriptOf([makeRecord(1)], false));

    expect(container.querySelector('[role="status"]')?.textContent).toBe('Előzmények betöltése');
    expect(list().querySelectorAll('.run-event-row')).toHaveLength(1);
    expect(container.querySelector('.transcript-panel__loading')).toBeNull();
  });

  it('a lista megnevezett, és minden kirajzolt sora egy RunEventRow a sorszámmal', () => {
    renderPanel(transcriptOf(manyRecords(3), true));

    expect(list().getAttribute('aria-label')).toBe('Futás eseményei');
    const items = list().querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(3);
    expect([...items].map((item) => item.getAttribute('aria-posinset'))).toEqual(['1', '2', '3']);
    for (const item of items) {
      expect(item.querySelector('.run-event-row')).not.toBeNull();
    }
  });

  it('a lista kerete legalább egy összecsukott sornyi magas, és a lista kitölti, hogy az elválasztó End állásában is legyen hol látszania az utolsó sornak', () => {
    renderPanel(transcriptOf(manyRecords(3), true));

    expect(listFrame().style.minHeight).toBe(`${String(COLLAPSED_TRANSCRIPT_ROW_HEIGHT)}px`);
    expect(list().parentElement).toBe(listFrame());
  });

  it('a sor React kulcsa a sor key mezője, nem a sorszáma: a kinyitott állapot a sorral marad, más sor nem örökli', () => {
    // Regresszió: `rowKey` nélkül a `react-window` a sorszámmal kulcsol, a
    // lista elem nem követi a sort, és az elé beszúrt sor után a kinyitott sor
    // újracsatolódva bezárul (a `rowKey` törlésével mérve: `[]` a `['3']`
    // helyett). A virtualizált lista a kirajzolt tartományból kikerülő sort
    // leszereli, tehát az állapot csak a kirajzolva maradó sorokra őrizhető
    // meg; a teszt ilyen sorokon fut.
    const rows = [makeRecord(2), makeRecord(3), makeRecord(4)];
    renderPanel(transcriptOf(rows, true));
    act(() => {
      list().querySelector<HTMLButtonElement>(':scope [aria-posinset="2"] .accordion__header')?.click();
    });
    expect(expandedPositions()).toEqual(['2']);

    // Egy sor a lista elejére kerül: a kinyitott sor a harmadik helyre csúszik,
    // és ott is nyitva marad; a második helyre került sor zárva.
    renderPanel(transcriptOf([makeRecord(1), ...rows], true));
    expect(expandedPositions()).toEqual(['3']);

    // Egy másik futás sorai ugyanazokon a sorszámokon: egyik sem örököl
    // nyitott állapotot.
    renderPanel(transcriptOf([makeRecord(10), makeRecord(11), makeRecord(12), makeRecord(13)], true));
    expect(expandedPositions()).toEqual([]);
  });

  it('nagy eseménylistán sem rajzol ki minden sort (a valós böngészős mérést az e2e végzi)', () => {
    renderPanel(transcriptOf(manyRecords(5000), true));

    const renderedCount = list().querySelectorAll('[role="listitem"]').length;
    expect(renderedCount).toBeGreaterThan(0);
    expect(renderedCount).toBeLessThan(5000);
    expect(list().querySelector('[role="listitem"]')?.getAttribute('aria-setsize')).toBe('5000');
  });

  it('a sor a lépés futás providerId mezőjéből kapja a providert: claude-subscription mellett a költség látszik', () => {
    const result = makeRecord(1, {
      origin: 'sdk',
      kind: 'sdk_result',
      stepRunId: 's-claude',
      payload: { type: 'result', total_cost_usd: 0.213108 },
    });
    renderPanel(transcriptOf([result], true), [CLAUDE_STEP_RUN]);
    expect(container.querySelector('.accordion__meta')?.textContent).toBe('$0.2131');

    renderPanel(transcriptOf([result], true), [{ ...CLAUDE_STEP_RUN, providerId: 'minimax' }]);
    expect(container.querySelector('.accordion__meta')).toBeNull();
  });

  it('felgörgetés után érkező eseményekre megjelenik az ugrás az aljára gomb a számukkal, és megnyomva eltűnik', () => {
    renderPanel(transcriptOf(manyRecords(20), true));
    // A happy-dom nem végez layoutot: a lista konténer mérete nulla, tehát a
    // görgetési pozíció közvetlenül a látható sorindexet adja. Előbb lejjebb,
    // majd feljebb görgetünk: a látható tartomány felfelé mozdul.
    act(() => {
      list().scrollTop = 10_000;
      list().dispatchEvent(new Event('scroll'));
    });
    act(() => {
      list().scrollTop = 0;
      list().dispatchEvent(new Event('scroll'));
    });
    expect(queryJumpButton()).toBeNull();

    renderPanel(transcriptOf(manyRecords(23), true));
    expect(jumpButton().textContent).toBe('Ugrás az aljára (3 új esemény)');
    expect(jumpButton().className).toBe('btn btn--secondary btn--sm transcript-panel__jump');

    act(() => {
      jumpButton().click();
    });
    expect(queryJumpButton()).toBeNull();
  });

  it('a látható gomb fókuszálható, a hozzáférhetőségi fában a nevével áll, és a DOM-ban a lista előtt, tehát a Tab sorrendben a sorok előtt van', () => {
    renderPanel(transcriptOf(manyRecords(20), true));
    act(() => {
      list().scrollTop = 10_000;
      list().dispatchEvent(new Event('scroll'));
    });
    act(() => {
      list().scrollTop = 0;
      list().dispatchEvent(new Event('scroll'));
    });
    renderPanel(transcriptOf(manyRecords(21), true));

    const button = jumpButton();
    act(() => {
      button.focus();
    });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-hidden')).toBeNull();
    expect(button.tabIndex).toBe(0);
    expect(button.nextElementSibling).toBe(list());
  });

  function scrollUpAndReceive(count: number): void {
    renderPanel(transcriptOf(manyRecords(20), true));
    act(() => {
      list().scrollTop = 10_000;
      list().dispatchEvent(new Event('scroll'));
    });
    act(() => {
      list().scrollTop = 0;
      list().dispatchEvent(new Event('scroll'));
    });
    renderPanel(transcriptOf(manyRecords(20 + count), true));
  }

  it('szűk listán (a tartalom doboza egy sornál kisebb) a gomb nem lebeg: a keret sor irányú, a gomb a lista előtt, ugyanazzal a szöveggel (user döntés 2026-09-25)', () => {
    stubListContentHeight(COLLAPSED_TRANSCRIPT_ROW_HEIGHT - 1);
    try {
      scrollUpAndReceive(2);
      expect(listFrame().className).toBe('transcript-panel__list-frame transcript-panel__list-frame--compact');
      expect(jumpButton().textContent).toBe('Ugrás az aljára (2 új esemény)');
      expect(jumpButton().nextElementSibling).toBe(list());
      act(() => {
        jumpButton().click();
      });
      expect(queryJumpButton()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pontosan egy sornyi tartalom dobozú listán a gomb a lebegő alakban áll', () => {
    stubListContentHeight(COLLAPSED_TRANSCRIPT_ROW_HEIGHT);
    try {
      scrollUpAndReceive(1);
      expect(listFrame().className).toBe('transcript-panel__list-frame');
      expect(jumpButton().textContent).toBe('Ugrás az aljára (1 új esemény)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('új esemény nélkül nincs gomb és nincs sáv: a lista kerete a panel első eleme, benne csak a lista (user döntés 2026-09-25)', () => {
    renderPanel(transcriptOf(manyRecords(3), true));

    expect(container.querySelector('.transcript-panel')?.firstElementChild).toBe(listFrame());
    expect([...listFrame().children]).toEqual([list()]);
    expect(container.textContent).not.toContain('Ugrás az aljára');
  });
  it('ha a futás a részleges szöveget NEM tárolja, a fejlécben kimondja, hogy az csak élőben látszik (AC43)', () => {
    renderPanel(transcriptOf(manyRecords(2), true), [], 'running', false);

    const note = container.querySelector(':scope .transcript-panel > .transcript-panel__delta-note');
    expect(note?.textContent).toBe(DELTA_NOTE);
    // A lista FÖLÖTT áll, az első helyen.
    expect(container.querySelector('.transcript-panel')?.firstElementChild).toBe(note);
    expect(statusTexts()).toEqual([]);
  });

  it('ha a futás a részleges szöveget tárolja, nincs delta mondat, és a panel első eleme a lista kerete (AC43)', () => {
    renderPanel(transcriptOf(manyRecords(2), true), [], 'running', true);

    expect(container.querySelector('.transcript-panel__delta-note')).toBeNull();
    expect(container.querySelector('.transcript-panel')?.firstElementChild).toBe(listFrame());
    expect(container.textContent).not.toContain(DELTA_NOTE);
  });

  it('a delta mondat a pótlás alatti betöltés jelzés mellett is ott áll, a tárolt deltás futásnál nem', () => {
    renderPanel(transcriptOf([], false), [], 'running', false);
    expect(container.querySelector('.transcript-panel__delta-note')?.textContent).toBe(DELTA_NOTE);
    expect(statusTexts()).toEqual(['Előzmények betöltése']);

    renderPanel(transcriptOf([], false), [], 'running', true);
    expect(container.querySelector('.transcript-panel__delta-note')).toBeNull();
    expect(statusTexts()).toEqual(['Előzmények betöltése']);
  });

  it('az átmeneti sor a Nem tárolt jelölést kapja, a perzisztált sor nem (AC42)', () => {
    const rows = [persistedRow(makeRecord(1)), transientRow(1, 'Helló')];
    renderPanel(rowsTranscript(rows, true), [CLAUDE_STEP_RUN]);

    const items = [...list().querySelectorAll('[role="listitem"]')];
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector('.badge')).toBeNull();
    const badge = items[1]?.querySelector(':scope .accordion__meta .badge');
    expect(badge?.textContent).toBe('Nem tárolt');
    expect(badge?.getAttribute('title')).toContain('nem kerül tárolásra');
    expect(items[1]?.querySelector('.accordion__title')?.textContent).toContain('Streamelt részlet: Helló');
  });

  it('két azonos tartalmú átmeneti sor két külön sorként jelenik meg (a kulcs a számláló, nem a tartalom)', () => {
    renderPanel(rowsTranscript([transientRow(1, 'ugyanaz'), transientRow(2, 'ugyanaz')], true));

    const titles = [...list().querySelectorAll('.accordion__title')].map((title) => title.textContent);
    expect(titles).toHaveLength(2);
    expect(titles[0]).toBe(titles[1]);
    expect(list().querySelectorAll('.badge')).toHaveLength(2);
  });
});
