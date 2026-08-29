import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { buildEngineDependencies } from './build-engine-dependencies.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('buildEngineDependencies', () => {
  it('a kapott database referenciát változatlanul adja tovább, a nyolc portot pedig felépíti', () => {
    const database = openMemoryDatabase();
    const dependencies = buildEngineDependencies(database);

    expect(dependencies.database).toBe(database);
    expect(typeof dependencies.agentQueryRunner.run).toBe('function');
    expect(typeof dependencies.providerDescriptorLookup).toBe('function');
    expect(typeof dependencies.expressionEvaluator.evaluate).toBe('function');
    expect(typeof dependencies.templateRenderer.render).toBe('function');
    expect(typeof dependencies.eventPublisher.publish).toBe('function');
    expect(typeof dependencies.clock.nowMs).toBe('function');
    expect(typeof dependencies.idGenerator.nextId).toBe('function');
    expect(typeof dependencies.processEnvironment.read).toBe('function');
  });

  it('az összeállított kilenc port a motor createEngine hívásának valódi bemenete lehet', () => {
    const dependencies = buildEngineDependencies(openMemoryDatabase());
    const engine = createEngine(dependencies);

    expect(typeof engine.startRun).toBe('function');
    expect(typeof engine.interruptRun).toBe('function');
    expect(typeof engine.decideApproval).toBe('function');
    expect(typeof engine.restartRun).toBe('function');
    expect(typeof engine.suggestedConcurrencyLimit).toBe('function');
    expect(typeof engine.testProviderConnection).toBe('function');
    expect(typeof engine.shutdown).toBe('function');
  });
});
