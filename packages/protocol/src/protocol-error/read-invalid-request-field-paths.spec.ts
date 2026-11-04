import { describe, expect, it } from 'vitest';
import { readInvalidRequestFieldPaths } from './read-invalid-request-field-paths.ts';
import { zodErrorToProtocolErrorBody } from './zod-error-to-protocol-error-body.ts';

describe('readInvalidRequestFieldPaths', () => {
  it('a zodErrorToProtocolErrorBody mezőlistáját adja vissza, sorrendben (a két függvény párja)', () => {
    const body = zodErrorToProtocolErrorBody({
      issues: [
        { path: ['nodes', 1, 'config', 'structuredOutput', 'schema'] },
        { path: ['nodes', 2, 'config', 'settings', 'structuredOutput', 'schema'] },
      ],
    });

    expect(readInvalidRequestFieldPaths(body)).toStrictEqual([
      'nodes.1.config.structuredOutput.schema',
      'nodes.2.config.settings.structuredOutput.schema',
    ]);
  });

  it('a gyökér hibát a jelölésével adja vissza', () => {
    expect(readInvalidRequestFieldPaths(zodErrorToProtocolErrorBody({ issues: [{ path: [] }] }))).toStrictEqual([
      '(gyökér)',
    ]);
  });

  it('a mezőlista nélküli invalid_request üzenetre üres lista', () => {
    expect(readInvalidRequestFieldPaths(zodErrorToProtocolErrorBody({ issues: [] }))).toStrictEqual([]);
  });

  it('más hibakódra üres lista, akkor is, ha az üzenet mezőlistás alakú', () => {
    const { message } = zodErrorToProtocolErrorBody({ issues: [{ path: ['a'] }] });

    expect(readInvalidRequestFieldPaths({ code: 'unprocessable', message })).toStrictEqual([]);
  });
});
