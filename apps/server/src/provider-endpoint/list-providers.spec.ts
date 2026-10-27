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

  it('a minimax kulcsa névcsoportként, mindkét elfogadott névvel megy ki, érték nélkül (SPEC-013 4.8)', async () => {
    const handler = createListProvidersHandler();

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind === 'ok' && result.value.body).toMatchObject([
      { id: 'claude-subscription', requiredEnvNames: [] },
      {
        id: 'minimax',
        requiredEnvNames: [
          ['ANTHROPIC_BASE_URL'],
          ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'],
          ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'],
        ],
      },
    ]);
  });
});
