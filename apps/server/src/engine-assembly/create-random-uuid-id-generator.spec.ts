import { describe, expect, it } from 'vitest';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('createRandomUuidIdGenerator', () => {
  it('érvényes, egyedi UUID-t ad hívásonként', () => {
    const generator = createRandomUuidIdGenerator();
    const first = generator.nextId();
    const second = generator.nextId();
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toMatch(UUID_PATTERN);
    expect(first).not.toBe(second);
  });
});
