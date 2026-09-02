import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { requestRoute } from './request-route.ts';
import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

const API_ORIGIN = 'https://api.example.test';

const passthroughSchema: SafeParsableSchema<unknown> = {
  safeParse: (input: unknown): SafeParseOutcome<unknown> => ({ success: true, data: input }),
};

describe('requestRoute', () => {
  it('törzzsel, a paraméterek alapértelmezésével hívja meg a végpontot', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      capturedInit = init;
      return Promise.resolve(Response.json({}, { status: 200 }));
    };

    const outcome = await requestRoute({
      routeId: 'createWorkflow',
      // eslint-disable-next-line unicorn/no-null -- a `createWorkflow` protokoll séma a hiányzó leírást és providert `null` értékkel írja le, nem `undefined`-nel.
      body: { name: 'Alfa', description: null, providerId: null },
      responseSchema: passthroughSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
    });

    expect(outcome.kind).toBe('ok');
    expect(capturedInit?.method).toBe('POST');
    // eslint-disable-next-line unicorn/no-null -- ugyanaz a törzs, amit a hívás elküldött (lásd fent).
    expect(capturedInit?.body).toBe(JSON.stringify({ name: 'Alfa', description: null, providerId: null }));
  });
});
