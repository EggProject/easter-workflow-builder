import type { ProviderConnectionTester } from './provider-connection-tester.ts';

/**
 * A `ProviderOptionsContext` alapértéke, szolgáltató nélkül: nincs hova
 * hívni, ezért a teszt hibaágat ad, nem hálózati kérést (ugyanaz a minta,
 * mint a kontextus protokoll konstansból vett provider listája). Az éles
 * szolgáltató a `GraphEditorScreen`, ami a `createProviderConnectionTester`
 * kimenetét adja.
 */
export const unavailableProviderConnectionTester: ProviderConnectionTester = () =>
  Promise.resolve({
    kind: 'error',
    message: 'A kapcsolat teszt itt nem érhető el.',
    isTransient: false,
  });
