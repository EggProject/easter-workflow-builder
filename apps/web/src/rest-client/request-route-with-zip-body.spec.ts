import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { requestRouteWithZipBody } from './request-route-with-zip-body.ts';
import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

const API_ORIGIN = 'https://api.example.test';

const passthroughSchema: SafeParsableSchema<unknown> = {
  safeParse: (input: unknown): SafeParseOutcome<unknown> => ({ success: true, data: input }),
};

describe('requestRouteWithZipBody', () => {
  it('a fájl bájtjait nyers törzsként, application/zip Content-Type fejléccel, PUT metódussal küldi', async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchFunction: FetchFunction = (input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return Promise.resolve(Response.json({ name: 'riport' }, { status: 200 }));
    };
    const archive = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'riport.zip', { type: 'application/zip' });

    const outcome = await requestRouteWithZipBody({
      routeId: 'uploadSkill',
      parameters: { name: 'riport' },
      body: archive,
      responseSchema: passthroughSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
    });

    expect(outcome).toEqual({ kind: 'ok', value: { name: 'riport' } });
    expect(capturedUrl).toBe(`${API_ORIGIN}/api/skills/riport`);
    expect(capturedInit?.method).toBe('PUT');
    expect(capturedInit?.body).toBe(archive);
    expect(new Headers(capturedInit?.headers).get('Content-Type')).toBe('application/zip');
  });

  it('a paraméterek nélküli hívás útvonal hibát ad, fetch nélkül', async () => {
    let wasCalled = false;
    const fetchFunction: FetchFunction = () => {
      wasCalled = true;
      return Promise.resolve(Response.json({}));
    };

    const outcome = await requestRouteWithZipBody({
      routeId: 'uploadSkill',
      body: new Blob([]),
      responseSchema: passthroughSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
    });

    expect(outcome.kind).toBe('error');
    expect(wasCalled).toBe(false);
  });
});
