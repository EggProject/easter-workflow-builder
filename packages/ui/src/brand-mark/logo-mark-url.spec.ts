import { describe, expect, it } from 'vitest';
import { logoMarkUrl } from './logo-mark-url.ts';

describe('logoMarkUrl', () => {
  it('a Vite feloldott, nem üres URL sztringet ad az importra', () => {
    expect(typeof logoMarkUrl).toBe('string');
    expect(logoMarkUrl.length).toBeGreaterThan(0);
  });
});
