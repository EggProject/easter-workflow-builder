import { describe, expect, it } from 'vitest';
import { STRUCTURED_OUTPUT_SCHEMA_REJECTED_MESSAGE } from './structured-output-schema-rejected-message.ts';

describe('STRUCTURED_OUTPUT_SCHEMA_REJECTED_MESSAGE', () => {
  it('a felület nyelvén, a szerver szövege és mezőútja nélkül nevezi meg az okot', () => {
    expect(STRUCTURED_OUTPUT_SCHEMA_REJECTED_MESSAGE).toBe(
      'A séma érvénytelen: nem draft-07 szerinti JSON Schema, ismeretlen kulcsszót vagy formátumot tartalmaz, vagy draft-07-nél újabb $schema értéket deklarál.',
    );
    expect(STRUCTURED_OUTPUT_SCHEMA_REJECTED_MESSAGE).not.toContain('invalid_request');
  });
});
