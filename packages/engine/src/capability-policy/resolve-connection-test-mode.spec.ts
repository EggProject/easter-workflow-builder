import { describe, expect, it } from 'vitest';
import type { Fact, ModelsEndpointCapability } from '@easter-workflow-builder/provider-capability';
import { resolveConnectionTestMode } from './resolve-connection-test-mode.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// A `directHttpReachable` az első három esetben `known` igaz, éppen azért, hogy
// látszódjon: a döntést nem befolyásolja, a motor nem nyit hálózati kapcsolatot
// (SPEC-004 17. szekció 7. kritérium).
function buildModelsEndpoint(calledBySdk: Fact<boolean>): ModelsEndpointCapability {
  return { directHttpReachable: knownFact(true), calledBySdk, listedModelCount: unknownFact<number>() };
}

const calledBySdk = buildModelsEndpoint(knownFact(true));
const notCalledBySdk = buildModelsEndpoint(knownFact(false));
const unknownCall = buildModelsEndpoint(unknownFact<boolean>());
const unreachableButCalledBySdk: ModelsEndpointCapability = {
  directHttpReachable: knownFact(false),
  calledBySdk: knownFact(true),
  listedModelCount: unknownFact<number>(),
};

describe('resolveConnectionTestMode', () => {
  it('known igaz: az SDK hívja a modell végpontot, a teszt onnan ad listát', () => {
    expect(resolveConnectionTestMode(calledBySdk)).toBe('sdk_model_list');
  });

  it('known hamis: a teszt egy minimális query() hívás', () => {
    expect(resolveConnectionTestMode(notCalledBySdk)).toBe('minimal_query');
  });

  it('unknown: ugyanaz a minimális query() hívás, konzervatív visszaesésként', () => {
    expect(resolveConnectionTestMode(unknownCall)).toBe('minimal_query');
  });

  it('a directHttpReachable hamis értéke nem változtat a listás meneten', () => {
    expect(resolveConnectionTestMode(unreachableButCalledBySdk)).toBe('sdk_model_list');
  });
});
