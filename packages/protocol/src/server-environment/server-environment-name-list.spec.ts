import { describe, expect, it } from 'vitest';
import { ServerEnvironmentNameListSchema } from './server-environment-name-list.ts';

describe('ServerEnvironmentNameListSchema', () => {
  it('a név alakú elemek listáját elfogadja, az üres listát is', () => {
    expect(ServerEnvironmentNameListSchema.safeParse(['GITHUB_TOKEN_CEG', 'PATH']).success).toBe(true);
    expect(ServerEnvironmentNameListSchema.safeParse([]).success).toBe(true);
  });

  it('a név alakú szövegen kívül semmit nem enged, értéket hordozó objektumot sem', () => {
    expect(ServerEnvironmentNameListSchema.safeParse(['1ROSSZ']).success).toBe(false);
    expect(ServerEnvironmentNameListSchema.safeParse([{ name: 'PATH', value: '/usr/bin' }]).success).toBe(false);
    expect(ServerEnvironmentNameListSchema.safeParse({ PATH: '/usr/bin' }).success).toBe(false);
  });
});
