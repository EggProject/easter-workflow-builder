import { describe, expect, it } from 'vitest';
import { browserGraphElementIdGenerator } from './browser-graph-element-id-generator.ts';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('browserGraphElementIdGenerator', () => {
  it('36 karakteres, egyedi v4 UUID-t ad hívásonként', () => {
    const first = browserGraphElementIdGenerator();
    const second = browserGraphElementIdGenerator();
    expect(first).toHaveLength(36);
    expect(first).toMatch(UUID_V4_PATTERN);
    expect(second).toMatch(UUID_V4_PATTERN);
    expect(first).not.toBe(second);
  });
});
