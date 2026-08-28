/* eslint-disable unicorn/no-null -- a `WorkflowRecord` és az `AppSettingsRecord` nullázható mezői (SPEC-003 4.1, 4.13) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AppSettingsRecord, WorkflowGraph, WorkflowRecord } from '@easter-workflow-builder/db';
import { collectRunInputs } from './collect-run-inputs.ts';

const WORKFLOW: Outcome<WorkflowRecord> = {
  kind: 'ok',
  value: {
    id: 'wf-1',
    name: 'Teszt',
    description: null,
    providerId: null,
    createdAtMs: new Date(0),
    updatedAtMs: new Date(0),
  },
};
const GRAPH: Outcome<WorkflowGraph> = { kind: 'ok', value: { nodes: [], edges: [] } };
const SETTINGS: Outcome<AppSettingsRecord> = {
  kind: 'ok',
  value: { defaultProviderId: 'minimax', persistStreamDeltas: false },
};

describe('collectRunInputs', () => {
  it('mindhárom olvasás sikeres: egyetlen struktúrában adja vissza őket', () => {
    const outcome = collectRunInputs(WORKFLOW, GRAPH, SETTINGS);

    expect(outcome.kind).toBe('ok');
    expect(outcome.kind === 'ok' ? outcome.value.workflow.id : '').toBe('wf-1');
    expect(outcome.kind === 'ok' ? outcome.value.graph.nodes : undefined).toStrictEqual([]);
    expect(outcome.kind === 'ok' ? outcome.value.settings.defaultProviderId : '').toBe('minimax');
  });

  it('a workflow olvasás hibája megy tovább', () => {
    const outcome = collectRunInputs({ kind: 'error', message: 'nincs workflow' }, GRAPH, SETTINGS);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'nincs workflow' });
  });

  it('a gráf olvasás hibája megy tovább', () => {
    const outcome = collectRunInputs(WORKFLOW, { kind: 'error', message: 'korrupt node config' }, SETTINGS);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'korrupt node config' });
  });

  it('a beállítás olvasás hibája megy tovább', () => {
    const outcome = collectRunInputs(WORKFLOW, GRAPH, { kind: 'error', message: 'korrupt provider' });

    expect(outcome).toStrictEqual({ kind: 'error', message: 'korrupt provider' });
  });
});
