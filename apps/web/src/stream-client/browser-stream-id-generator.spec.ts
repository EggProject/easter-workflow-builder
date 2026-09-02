import { describe, expect, it } from 'vitest';
import { browserStreamIdGenerator } from './browser-stream-id-generator.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('browserStreamIdGenerator', () => {
  it('érvényes, egyedi UUID-t ad hívásonként', () => {
    const first = browserStreamIdGenerator();
    const second = browserStreamIdGenerator();
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toMatch(UUID_PATTERN);
    expect(first).not.toBe(second);
  });
});
