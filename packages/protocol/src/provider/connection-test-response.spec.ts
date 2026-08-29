/* eslint-disable unicorn/no-null -- a ConnectionTestResponse errorMessage mezője sikeres tesztnél a dróton ténylegesen `null` értéket hordoz, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { ConnectionTestResponseSchema } from './connection-test-response.ts';

describe('ConnectionTestResponseSchema', () => {
  it('elfogadja a sikeres tesztet, errorMessage: null mellett', () => {
    const outcome = ConnectionTestResponseSchema.safeParse({
      succeeded: true,
      mode: 'minimal_query',
      errorMessage: null,
    });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja a sikertelen tesztet, hibaüzenettel', () => {
    const outcome = ConnectionTestResponseSchema.safeParse({
      succeeded: false,
      mode: 'sdk_model_list',
      errorMessage: 'hiányzó API kulcs',
    });
    expect(outcome.success).toBe(true);
  });
});
