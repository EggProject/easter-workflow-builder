import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';
import { createSystemClock } from './create-system-clock.ts';
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
  it('a kapott database és clock referenciát változatlanul adja tovább, a nyolc portot pedig felépíti', () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(database, createStreamRegistry(createRandomUuidIdGenerator()), clock);

    expect(dependencies.database).toBe(database);
    expect(dependencies.clock).toBe(clock);
    expect(typeof dependencies.agentQueryRunner.run).toBe('function');
    expect(typeof dependencies.providerDescriptorLookup).toBe('function');
    expect(typeof dependencies.expressionEvaluator.evaluate).toBe('function');
    expect(typeof dependencies.templateRenderer.render).toBe('function');
    expect(typeof dependencies.eventPublisher.publish).toBe('function');
    expect(typeof dependencies.idGenerator.nextId).toBe('function');
    expect(typeof dependencies.processEnvironment.read).toBe('function');
  });

  it('az összeállított kilenc port a motor createEngine hívásának valódi bemenete lehet', () => {
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
    );
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
