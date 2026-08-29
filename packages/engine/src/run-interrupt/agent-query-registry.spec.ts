import { describe, expect, it } from 'vitest';
import type { AgentQuery } from '@easter-workflow-builder/agent';
import { createAgentQueryRegistry } from './agent-query-registry.ts';

function fakeQuery(): AgentQuery {
  return {
    messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
    interrupt: () => Promise.resolve(),
  };
}

describe('createAgentQueryRegistry', () => {
  it('regisztráció után a runId-hoz tartozó lekérdezés visszaadja a query-t', () => {
    const registry = createAgentQueryRegistry();
    const query = fakeQuery();

    registry.register('run-1', 'step-1', query);

    expect(registry.listForRunIds(new Set(['run-1']))).toStrictEqual([query]);
  });

  it('leiratkozás után a query eltűnik a lekérdezésből', () => {
    const registry = createAgentQueryRegistry();
    registry.register('run-1', 'step-1', fakeQuery());

    registry.unregister('step-1');

    expect(registry.listForRunIds(new Set(['run-1']))).toStrictEqual([]);
  });

  it('ismeretlen stepRunId leiratkozása csendben nem tesz semmit', () => {
    const registry = createAgentQueryRegistry();

    expect(() => {
      registry.unregister('nincs-ilyen-lepes');
    }).not.toThrow();
  });

  it('a lekérdezés csak a kért runId halmazhoz tartozó bejegyzéseket adja vissza, máshoz tartozók nem szivárognak át', () => {
    const registry = createAgentQueryRegistry();
    const queryA = fakeQuery();
    const queryB = fakeQuery();
    const queryC = fakeQuery();
    registry.register('run-a', 'step-a', queryA);
    registry.register('run-b', 'step-b', queryB);
    registry.register('run-c', 'step-c', queryC);

    const matches = registry.listForRunIds(new Set(['run-a', 'run-c']));

    expect(matches).toStrictEqual([queryA, queryC]);
  });

  it('egy futáson belül több élő lépés is szerepelhet egyszerre', () => {
    const registry = createAgentQueryRegistry();
    const queryOne = fakeQuery();
    const queryTwo = fakeQuery();
    registry.register('run-1', 'step-1', queryOne);
    registry.register('run-1', 'step-2', queryTwo);

    expect(registry.listForRunIds(new Set(['run-1']))).toStrictEqual([queryOne, queryTwo]);
  });

  it('ugyanarra a stepRunId-ra ismételt regisztráció lecseréli a korábbi bejegyzést', () => {
    const registry = createAgentQueryRegistry();
    const first = fakeQuery();
    const second = fakeQuery();
    registry.register('run-1', 'step-1', first);
    registry.register('run-1', 'step-1', second);

    expect(registry.listForRunIds(new Set(['run-1']))).toStrictEqual([second]);
  });

  it('üres runId halmazra üres listát ad', () => {
    const registry = createAgentQueryRegistry();
    registry.register('run-1', 'step-1', fakeQuery());

    expect(registry.listForRunIds(new Set())).toStrictEqual([]);
  });
});
