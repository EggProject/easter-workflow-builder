import { describe, expect, it } from 'vitest';
import { toEditorWorkflowName } from './to-editor-workflow-name.ts';

describe('toEditorWorkflowName', () => {
  it('workflowId nélkül elérhetetlen, a kérés állapotától függetlenül', () => {
    expect(toEditorWorkflowName(undefined, { status: 'pending' })).toEqual({ kind: 'unavailable' });
  });

  it('a még el nem indult és a folyamatban lévő kérés egyaránt töltést jelent', () => {
    expect(toEditorWorkflowName('w-1', { status: 'idle' })).toEqual({ kind: 'loading' });
    expect(toEditorWorkflowName('w-1', { status: 'pending' })).toEqual({ kind: 'loading' });
  });

  it('sikeres kérés után a workflow neve áll készen', () => {
    expect(toEditorWorkflowName('w-1', { status: 'success', value: { name: 'Alfa' } })).toEqual({
      kind: 'ready',
      name: 'Alfa',
    });
  });

  it('az adat nélküli állapotok hivatkozása stabil, hogy a jelentés ne fusson újra változatlan értékre', () => {
    expect(toEditorWorkflowName('w-1', { status: 'idle' })).toBe(toEditorWorkflowName('w-1', { status: 'pending' }));
    expect(toEditorWorkflowName(undefined, { status: 'idle' })).toBe(
      toEditorWorkflowName('w-1', { status: 'failure', message: 'hiba' }),
    );
  });

  it('hibás kérés után elérhetetlen', () => {
    expect(toEditorWorkflowName('w-1', { status: 'failure', message: 'hiba' })).toEqual({ kind: 'unavailable' });
  });
});
