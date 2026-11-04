import { describe, expect, it } from 'vitest';
import { createAjvLogger } from './create-ajv-logger.ts';
import type { StructuredOutputSchemaLogger } from './structured-output-schema-logger.ts';

interface LoggedCall {
  readonly level: 'info' | 'warn' | 'error';
  readonly bindings: Readonly<Record<string, unknown>>;
  readonly message: string;
}

function collectingLogger(): { readonly logger: StructuredOutputSchemaLogger; readonly calls: LoggedCall[] } {
  const calls: LoggedCall[] = [];
  return {
    logger: {
      info: (bindings, message) => {
        calls.push({ level: 'info', bindings, message });
      },
      warn: (bindings, message) => {
        calls.push({ level: 'warn', bindings, message });
      },
      error: (bindings, message) => {
        calls.push({ level: 'error', bindings, message });
      },
    },
    calls,
  };
}

describe('createAjvLogger', () => {
  it.each([
    ['log', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('a(z) %s hívás a(z) %s szinten naplóz, a nyers argumentumokkal', (method, level) => {
    const { logger, calls } = collectingLogger();

    createAjvLogger(logger)[method]('strict mode: üzenet', 'második');

    expect(calls).toEqual([
      {
        level,
        bindings: { ajv: ['strict mode: üzenet', 'második'] },
        message: 'A strukturált kimenet sémájának fordítója (Ajv) üzenetet adott.',
      },
    ]);
  });
});
