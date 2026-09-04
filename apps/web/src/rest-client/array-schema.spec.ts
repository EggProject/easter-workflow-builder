import { describe, expect, it } from 'vitest';
import { arraySchema } from './array-schema.ts';
import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

interface DemoValue {
  readonly name: string;
}

function isDemoValue(input: unknown): input is DemoValue {
  return typeof input === 'object' && input !== null && 'name' in input && typeof input.name === 'string';
}

const demoValueSchema: SafeParsableSchema<DemoValue> = {
  safeParse: (input: unknown): SafeParseOutcome<DemoValue> =>
    isDemoValue(input) ? { success: true, data: input } : { success: false, error: { issues: [{ path: ['name'] }] } },
};

describe('arraySchema', () => {
  it('tömb bemenetre minden elemet a belső sémával dekódol, sikeres esetben', () => {
    const schema = arraySchema(demoValueSchema);
    const result = schema.safeParse([{ name: 'Alfa' }, { name: 'Béta' }]);
    expect(result).toEqual({ success: true, data: [{ name: 'Alfa' }, { name: 'Béta' }] });
  });

  it('üres tömbre üres listát ad', () => {
    const schema = arraySchema(demoValueSchema);
    expect(schema.safeParse([])).toEqual({ success: true, data: [] });
  });

  it('nem tömb bemenetre hibaágat ad, gyökér mezőúttal', () => {
    const schema = arraySchema(demoValueSchema);
    const result = schema.safeParse({ nem: 'tomb' });
    expect(result).toEqual({ success: false, error: { issues: [{ path: [] }] } });
  });

  it('ha egy elem nem illeszkedik a belső sémára, a hibaág az elem indexét vezeti a mezőút elé', () => {
    const schema = arraySchema(demoValueSchema);
    const result = schema.safeParse([{ name: 'Alfa' }, { nincsNev: true }]);
    expect(result).toEqual({ success: false, error: { issues: [{ path: [1, 'name'] }] } });
  });
});
