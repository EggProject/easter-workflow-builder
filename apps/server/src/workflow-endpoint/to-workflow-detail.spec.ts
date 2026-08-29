/* eslint-disable unicorn/no-null -- a WorkflowRecord description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import type { WorkflowRecord } from '@easter-workflow-builder/db';
import { toWorkflowDetail } from './to-workflow-detail.ts';

describe('toWorkflowDetail', () => {
  it('a Date mezőket egész milliszekundummá alakítja, a többi mezőt átveszi', () => {
    const record: WorkflowRecord = {
      id: 'wf-1',
      name: 'Teszt workflow',
      description: 'leírás',
      providerId: 'minimax',
      createdAtMs: new Date(1000),
      updatedAtMs: new Date(2000),
    };
    expect(toWorkflowDetail(record)).toStrictEqual({
      id: 'wf-1',
      name: 'Teszt workflow',
      description: 'leírás',
      providerId: 'minimax',
      createdAtMs: 1000,
      updatedAtMs: 2000,
    });
  });

  it('a null description és providerId értéket megtartja', () => {
    const record: WorkflowRecord = {
      id: 'wf-2',
      name: 'Másik',
      description: null,
      providerId: null,
      createdAtMs: new Date(0),
      updatedAtMs: new Date(0),
    };
    expect(toWorkflowDetail(record)).toStrictEqual({
      id: 'wf-2',
      name: 'Másik',
      description: null,
      providerId: null,
      createdAtMs: 0,
      updatedAtMs: 0,
    });
  });
});
