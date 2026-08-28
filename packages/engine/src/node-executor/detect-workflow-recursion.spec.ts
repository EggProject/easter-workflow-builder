import { describe, expect, it } from 'vitest';
import { detectWorkflowRecursion } from './detect-workflow-recursion.ts';

/**
 * A PLAN-005 T-005-23 elfogadási kritériuma szó szerint két és három szintű
 * ciklusra is előírja a `workflow_recursion_detected` osztályt, mélységi
 * küszöb nélkül. A tesztek ezért a lánc hosszát változtatják, nem a mélységet
 * jelző számot.
 */
describe('detectWorkflowRecursion', () => {
  it('üres ancestry mellett nincs kör', () => {
    expect(detectWorkflowRecursion([], 'wf-a').kind).toBe('ok');
  });

  it('nem ciklikus láncnál nincs kör, akármilyen mély is a lánc', () => {
    expect(detectWorkflowRecursion(['wf-a', 'wf-b', 'wf-c'], 'wf-d').kind).toBe('ok');
  });

  it('önhívást elfog: a gyökér workflow saját magát hívja', () => {
    const outcome = detectWorkflowRecursion(['wf-a'], 'wf-a');

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('workflow_recursion_detected');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('wf-a -> wf-a');
  });

  it('két szintű kört elfog (A -> B -> A)', () => {
    const outcome = detectWorkflowRecursion(['wf-a', 'wf-b'], 'wf-a');

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('workflow_recursion_detected');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('wf-a -> wf-b -> wf-a');
  });

  it('három szintű kört elfog (A -> B -> C -> A)', () => {
    const outcome = detectWorkflowRecursion(['wf-a', 'wf-b', 'wf-c'], 'wf-a');

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('workflow_recursion_detected');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('wf-a -> wf-b -> wf-c -> wf-a');
  });

  it('a lánc közepére visszatérő kört is elfogja (A -> B -> C -> B)', () => {
    const outcome = detectWorkflowRecursion(['wf-a', 'wf-b', 'wf-c'], 'wf-b');

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('workflow_recursion_detected');
  });
});
