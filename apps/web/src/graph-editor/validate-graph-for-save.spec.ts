/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { validateGraphForSave } from './validate-graph-for-save.ts';

const START_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

describe('validateGraphForSave', () => {
  it('érvényes gráfra ok Outcome-ot ad, a ReplaceGraphRequestSchema szerint felparszolt törzzsel', () => {
    const outcome = validateGraphForSave([START_NODE], []);
    expect(outcome).toEqual({ kind: 'ok', value: { nodes: [START_NODE], edges: [] } });
  });

  it(
    'hibás node mezőre (NaN egy number mezőn - saját méréssel igazolt zod@4.4.3 elutasítja) ' +
      'error Outcome-ot ad, ami megnevezi a hibás mező útvonalát',
    () => {
      // A `maxIterations` típusa `number`, a JavaScript `NaN` érték is `number`
      // típusú, tehát ez a fixture típushelyesen fordul (nincs `as`), de a
      // `z.number()` futásidejűleg elutasítja (saját méréssel igazolt zod@4.4.3
      // viselkedés: `z.number().safeParse(NaN).success === false`) - pontosan
      // az az eset, amikor a `node-inspector` (T-009-18) egy számmezőt üresen
      // hagyva `Number('')` -> `NaN` értéket termelne.
      const loopNode: WorkflowNodeInput = {
        id: 'n-2',
        type: 'loop',
        label: 'Ciklus',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'loop',
          maxIterations: Number('nem szám'),
          continueExpression: 'i < 5',
          onUnhandledError: null,
        },
      };
      const outcome = validateGraphForSave([START_NODE, loopNode], []);
      expect(outcome.kind).toBe('error');
      if (outcome.kind === 'error') {
        expect(outcome.message).toContain('maxIterations');
      }
    },
  );

  it('hibás él mezőre (ismeretlen kulcs a strictObject sémán) error Outcome-ot ad', () => {
    const edgeWithExtraField = {
      id: 'e-1',
      sourceNodeId: 'n-1',
      targetNodeId: 'n-2',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      unknownField: 'x',
    };
    const outcome = validateGraphForSave([START_NODE], [edgeWithExtraField]);
    expect(outcome.kind).toBe('error');
  });
});
