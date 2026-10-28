import { describe, expect, it } from 'vitest';
import { unavailableProviderConnectionTester } from './unavailable-provider-connection-tester.ts';

describe('unavailableProviderConnectionTester', () => {
  it('nem átmeneti hibaágat ad, hálózati hívás nélkül', async () => {
    await expect(unavailableProviderConnectionTester('minimax')).resolves.toEqual({
      kind: 'error',
      message: 'A kapcsolat teszt itt nem érhető el.',
      isTransient: false,
    });
  });
});
