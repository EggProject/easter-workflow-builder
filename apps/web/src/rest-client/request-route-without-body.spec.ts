import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { requestRouteWithoutBody } from './request-route-without-body.ts';
import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

const API_ORIGIN = 'https://api.example.test';

const passthroughSchema: SafeParsableSchema<unknown> = {
  safeParse: (input: unknown): SafeParseOutcome<unknown> => ({ success: true, data: input }),
};

describe('requestRouteWithoutBody', () => {
  it('törzs és Content-Type fejléc nélkül hívja meg a végpontot', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      capturedInit = init;
      return Promise.resolve(Response.json({}, { status: 200 }));
    };

    const outcome = await requestRouteWithoutBody({
      routeId: 'listWorkflows',
      query: { limit: '25' },
      responseSchema: passthroughSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
    });

    expect(outcome.kind).toBe('ok');
    expect(capturedInit?.method).toBe('GET');
    // A `RequestInit#body` DOM típusa `BodyInit | null`: törzs nélküli hívásnál a
    // `performRouteRequest` `null`-t küld, nem `undefined`-et (lásd perform-route-request.ts).
    expect(capturedInit?.body).toBeNull();
    expect(new Headers(capturedInit?.headers).has('Content-Type')).toBe(false);
  });
});
