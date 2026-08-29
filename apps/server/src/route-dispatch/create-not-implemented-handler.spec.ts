import { describe, expect, it } from 'vitest';
import { createNotImplementedHandler } from './create-not-implemented-handler.ts';

describe('createNotImplementedHandler', () => {
  it('a routeId nevét viselő, not_implemented hibaosztályú Outcome hibaágat ad', async () => {
    const handler = createNotImplementedHandler('startRun');
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('"startRun"');
    expect(result.kind === 'error' && result.message).toContain('(not_implemented)');
  });
});
