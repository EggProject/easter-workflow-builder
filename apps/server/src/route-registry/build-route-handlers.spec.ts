import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { isRouteId, ROUTE_TABLE } from '@easter-workflow-builder/protocol';
import type { Engine } from '@easter-workflow-builder/engine';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from './build-route-handlers.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => ({ suggestedLimit: undefined, note: 'teszt' }),
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
  };
}

function buildHandlers(database: DatabaseContext) {
  return buildRouteHandlers(database, buildFakeEngine(), createStreamRegistry(createRandomUuidIdGenerator()));
}

describe('buildRouteHandlers', () => {
  it('a ROUTE_TABLE mind a 26 azonosítójára kitölt egy kezelő függvényt', () => {
    const handlers = buildHandlers(openMemoryDatabase());
    for (const routeId of Object.keys(ROUTE_TABLE)) {
      expect(isRouteId(routeId)).toBe(true);
      if (isRouteId(routeId)) {
        expect(typeof handlers[routeId]).toBe('function');
      }
    }
    expect(Object.keys(handlers)).toHaveLength(Object.keys(ROUTE_TABLE).length);
  });

  it('a listWorkflows valódi kezelőt ad, ami az üres adatbázisra üres listát válaszol', async () => {
    const handlers = buildHandlers(openMemoryDatabase());
    const result = await handlers.listWorkflows({
      parameters: {},
      query: new URLSearchParams({ limit: '10' }),
      body: undefined,
    });
    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });

  it('a readSettings valódi kezelőt ad, ami üres táblán az alapértelmezett beállítást adja', async () => {
    const handlers = buildHandlers(openMemoryDatabase());
    const result = await handlers.readSettings({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('ok');
  });
});
