import { describe, expect, it } from 'vitest';
import { buildRoutePath } from './build-route-path.ts';

describe('buildRoutePath', () => {
  it('paraméter nélküli sablont változatlanul ad vissza', () => {
    const outcome = buildRoutePath('listWorkflows', {});
    expect(outcome).toStrictEqual({ kind: 'ok', value: '/api/workflows' });
  });

  it('egyetlen paramétert helyettesít be', () => {
    const outcome = buildRoutePath('getWorkflow', { workflowId: 'wf-1' });
    expect(outcome).toStrictEqual({ kind: 'ok', value: '/api/workflows/wf-1' });
  });

  it('két különböző paramétert is helyettesít', () => {
    const outcome = buildRoutePath('setConcurrencyLimit', { providerId: 'minimax' });
    expect(outcome).toStrictEqual({ kind: 'ok', value: '/api/settings/concurrency-limits/minimax' });
  });

  it('hiányzó paraméterre Outcome hibaágat ad', () => {
    const outcome = buildRoutePath('getWorkflow', {});
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('missing_route_param');
    }
  });

  it('fölös paraméterre Outcome hibaágat ad', () => {
    const outcome = buildRoutePath('listWorkflows', { unexpected: 'value' });
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('unknown_route_param');
    }
  });
});
