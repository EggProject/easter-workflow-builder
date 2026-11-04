import { describe, expect, it } from 'vitest';
import { createServerLogger } from '@easter-workflow-builder/logger';
import { createStructuredOutputSchemaCompiler } from './create-structured-output-schema-compiler.ts';

function discardLogLine(): void {
  // szándékosan üres: a teszt nem a naplót vizsgálja
}

describe('createStructuredOutputSchemaCompiler', () => {
  it('a strict mód figyelmeztetése warn szinten a szerver naplójába kerül, a séma lefordul', () => {
    const lines: string[] = [];
    const logger = createServerLogger(
      { secretValues: [] },
      {
        write: (line: string) => {
          lines.push(line);
        },
      },
    );

    const outcome = createStructuredOutputSchemaCompiler(logger).compile({
      properties: { answer: { type: 'string' } },
    });

    expect(outcome.kind).toBe('ok');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 40,
      ajv: ['strict mode: missing type "object" for keyword "properties" at "#" (strictTypes)'],
      msg: 'A strukturált kimenet sémájának fordítója (Ajv) üzenetet adott.',
    });
  });

  it('a format kulcsszó ellenőrzött: az érvénytelen email elbukik (ajv-formats)', () => {
    const logger = createServerLogger({ secretValues: [] }, { write: discardLogLine });

    const outcome = createStructuredOutputSchemaCompiler(logger).compile({ type: 'string', format: 'email' });

    expect(outcome.kind === 'ok' && outcome.value('nem-email')).toBe(false);
    expect(outcome.kind === 'ok' && outcome.value('anna@example.test')).toBe(true);
  });
});
