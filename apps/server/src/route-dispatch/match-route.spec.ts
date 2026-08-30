import { describe, expect, it } from 'vitest';
import { matchRoute } from './match-route.ts';

describe('matchRoute', () => {
  it('paraméter nélküli útvonalat illeszt', () => {
    const result = matchRoute('GET', '/api/workflows');
    expect(result).toStrictEqual({ kind: 'matched', match: { routeId: 'listWorkflows', parameters: {} } });
  });

  it('egy paraméteres útvonalat illeszt, és kinyeri az értékét', () => {
    const result = matchRoute('GET', '/api/workflows/abc-123');
    expect(result).toStrictEqual({
      kind: 'matched',
      match: { routeId: 'getWorkflow', parameters: { workflowId: 'abc-123' } },
    });
  });

  it('két paraméteres útvonalat illeszt', () => {
    const result = matchRoute('PUT', '/api/settings/concurrency-limits/minimax');
    expect(result).toStrictEqual({
      kind: 'matched',
      match: { routeId: 'setConcurrencyLimit', parameters: { providerId: 'minimax' } },
    });
  });

  it('a hasonló előtagú, de eltérő szegmensszámú útvonalakat megkülönbözteti', () => {
    expect(matchRoute('GET', '/api/workflows/abc-123/graph')).toStrictEqual({
      kind: 'matched',
      match: { routeId: 'readWorkflowGraph', parameters: { workflowId: 'abc-123' } },
    });
    expect(matchRoute('GET', '/api/workflows/abc-123/deletion-summary')).toStrictEqual({
      kind: 'matched',
      match: { routeId: 'summarizeWorkflowDeletion', parameters: { workflowId: 'abc-123' } },
    });
  });

  it('ismeretlen útvonalra not_found eredményt ad', () => {
    expect(matchRoute('GET', '/api/nincs-ilyen')).toStrictEqual({ kind: 'not_found' });
  });

  it('ismert útvonalon, nem támogatott metódusra method_not_allowed eredményt ad, az engedélyezett metódusokkal', () => {
    const result = matchRoute('DELETE', '/api/workflows');
    expect(result).toStrictEqual({ kind: 'method_not_allowed', allowedMethods: ['GET', 'POST'] });
  });

  it('a stream útvonal (API_BASE_PATH-on kívül) nem illeszkedik egyetlen REST végpontra sem', () => {
    expect(matchRoute('GET', '/events')).toStrictEqual({ kind: 'not_found' });
  });
});
