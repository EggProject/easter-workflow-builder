/* eslint-disable unicorn/no-null -- a szintetikus StepRunRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnmatchedStepRunList } from './UnmatchedStepRunList.tsx';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-torolt',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'failed',
  providerId: 'minimax',
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
  startedAtMs: 100,
  finishedAtMs: 200,
  createdAtMs: 100,
};

describe('UnmatchedStepRunList', () => {
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

  it('kimondja, hogy a sorok a rajzon nem szerepelnek, és soronként a csomópont azonosítót, típust és állapotot mutatja', () => {
    act(() => {
      root.render(
        <UnmatchedStepRunList
          stepRuns={[
            BASE_STEP_RUN,
            { ...BASE_STEP_RUN, id: 's-2', nodeId: 'n-masik', nodeType: 'loop', status: 'succeeded' },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain('a rajzon nem jelennek meg');
    const items = [...container.querySelectorAll('li')];
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('n-torolt');
    expect(items[0]?.textContent).toContain('Agent lépés');
    expect(items[0]?.textContent).toContain('sikertelen');
    expect(items[1]?.textContent).toContain('Ciklus');
    expect(items[1]?.textContent).toContain('sikeres');
  });

  it('a szakasz a saját fejlécére hivatkozik, kártya alakú doboz nélkül', () => {
    act(() => {
      root.render(<UnmatchedStepRunList stepRuns={[BASE_STEP_RUN]} />);
    });

    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('unmatched-step-run-list-title');
    expect(container.querySelector('#unmatched-step-run-list-title')?.textContent).toBe(
      'A rajzon nem szereplő lépés futások',
    );
    expect(container.querySelector('.card')).toBeNull();
  });
});
