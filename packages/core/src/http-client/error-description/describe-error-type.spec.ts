import { describe, expect, it } from 'vitest';
import { describeErrorType } from './describe-error-type.ts';

class SajatHiba extends Error {}

describe('describeErrorType', () => {
  it('Error példánynál a konstruktor nevét adja, az üzenetet nem', () => {
    expect(describeErrorType(new RangeError('TITOK'))).toBe('RangeError');
    expect(describeErrorType(new SajatHiba('TITOK'))).toBe('SajatHiba');
  });

  it('nem Error értéknél a typeof eredményét adja, null értékre null', () => {
    expect(describeErrorType('TITOK')).toBe('string');
    expect(describeErrorType({ uzenet: 'TITOK' })).toBe('object');
    expect(describeErrorType(undefined)).toBe('undefined');
    expect(describeErrorType(JSON.parse('null'))).toBe('null');
  });
});
