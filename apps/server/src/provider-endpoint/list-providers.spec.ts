import { describe, expect, it } from 'vitest';
import { createListProvidersHandler } from './list-providers.ts';

describe('createListProvidersHandler', () => {
  it('pontosan a két rögzített providert adja vissza, ProviderSummary alakban', async () => {
    const handler = createListProvidersHandler();

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([
      { id: 'claude-subscription', displayName: 'Claude Code előfizetés' },
      { id: 'minimax', displayName: 'MiniMax' },
    ]);
  });
});
