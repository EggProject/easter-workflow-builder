/* eslint-disable unicorn/no-null -- a RunEventRecord és a StepRunRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 4.10, 6.2) */
import type { RunEventRecord, StepRunRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunTranscriptState } from './run-transcript-state.ts';
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

function transcriptOf(records: readonly RunEventRecord[], isReplayComplete: boolean): RunTranscriptState {
  return { records, afterEventId: records.at(-1)?.id ?? 0, isReplayComplete };
}

function manyRecords(count: number): readonly RunEventRecord[] {
  return Array.from({ length: count }, (_, index) => makeRecord(index + 1));
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

  function renderPanel(transcript: RunTranscriptState, stepRuns: readonly StepRunRecord[] = []): void {
    act(() => {
      root.render(<TranscriptPanel transcript={transcript} stepRuns={stepRuns} />);
    });
  }

  function list(): HTMLElement {
    const element = container.querySelector<HTMLElement>('[role="list"]');
    if (element === null) {
      throw new Error('a teszt nem talált listát');
    }
    return element;
  }

  it('az első lap betöltése alatt a fejlécben az előzmények betöltését, a lista helyén csontvázat mutat', () => {
    renderPanel(transcriptOf([], false));

    expect(container.querySelector('[role="status"]')?.textContent).toBe('Előzmények betöltése');
    expect(container.querySelectorAll(':scope .transcript-panel__loading .skel')).toHaveLength(4);
    expect(container.querySelector('[role="list"]')).toBeNull();
  });

  it('lezárult pótlás és nulla esemény mellett kimondja, hogy nincs esemény, betöltés jelzés nélkül', () => {
    renderPanel(transcriptOf([], true));

    expect(container.querySelector('.transcript-panel__empty')?.textContent).toBe('A futásnak még nincs eseménye.');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('.transcript-panel__header')).toBeNull();
    expect(list().querySelectorAll('[role="listitem"]')).toHaveLength(0);
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
    expect(container.querySelector('.accordion__meta')?.textContent).toBe('Költség (SDK becslés): $0.2131');

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
    expect(container.querySelector('.transcript-panel__header')).toBeNull();

    renderPanel(transcriptOf(manyRecords(23), true));
    const button = container.querySelector<HTMLButtonElement>(':scope .transcript-panel__header button');
    expect(button?.textContent).toBe('Ugrás az aljára (3 új esemény)');
    expect(button?.className).toBe('btn btn--secondary btn--sm');

    act(() => {
      button?.click();
    });
    expect(container.querySelector('.transcript-panel__header')).toBeNull();
  });
});
