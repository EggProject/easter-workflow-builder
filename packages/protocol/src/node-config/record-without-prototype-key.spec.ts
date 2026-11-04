import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { recordWithoutPrototypeKey } from './record-without-prototype-key.ts';

const Schema = recordWithoutPrototypeKey(z.record(z.string(), z.string()).readonly());

describe('recordWithoutPrototypeKey', () => {
  it('a saját __proto__ kulcsú bemenetet elutasítja (a puszta z.record csendben eldobná)', () => {
    const input: unknown = JSON.parse('{"__proto__":"X","A":"B"}');

    expect(z.record(z.string(), z.string()).safeParse(input).data).toStrictEqual({ A: 'B' });
    expect(Schema.safeParse(input).success).toBe(false);
  });

  it('a többi bemenetet a megadott séma dönti el', () => {
    expect(Schema.safeParse({ A: 'B' }).data).toStrictEqual({ A: 'B' });
    expect(Schema.safeParse({ A: 1 }).success).toBe(false);
    expect(Schema.safeParse('nem rekord').success).toBe(false);
  });

  it('a kimenet típusa a megadott séma kimenete', () => {
    expectTypeOf<z.infer<typeof Schema>>().toEqualTypeOf<Readonly<Record<string, string>>>();
  });
});
