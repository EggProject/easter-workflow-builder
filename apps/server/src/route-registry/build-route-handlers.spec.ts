import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { isRouteId, ROUTE_TABLE } from '@easter-workflow-builder/protocol';
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

describe('buildRouteHandlers', () => {
  it('a ROUTE_TABLE mind a 26 azonosítójára kitölt egy kezelő függvényt', () => {
    const handlers = buildRouteHandlers(openMemoryDatabase());
    for (const routeId of Object.keys(ROUTE_TABLE)) {
      expect(isRouteId(routeId)).toBe(true);
      if (isRouteId(routeId)) {
        expect(typeof handlers[routeId]).toBe('function');
      }
    }
    expect(Object.keys(handlers)).toHaveLength(Object.keys(ROUTE_TABLE).length);
  });

  it('a listWorkflows valódi kezelőt ad, ami az üres adatbázisra üres listát válaszol', async () => {
    const handlers = buildRouteHandlers(openMemoryDatabase());
    const result = await handlers.listWorkflows({
      parameters: {},
      query: new URLSearchParams({ limit: '10' }),
      body: undefined,
    });
    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });

  it('a még nem implementált végpont (pl. startRun) őszinte not_implemented hibát ad', async () => {
    const handlers = buildRouteHandlers(openMemoryDatabase());
    const result = await handlers.startRun({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
  });
});
