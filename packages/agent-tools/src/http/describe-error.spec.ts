import { describe, expect, it } from 'vitest';
import { describeError } from './describe-error.ts';

describe('describeError', () => {
  it('az Error üzenetét adja vissza', () => {
    expect(describeError(new Error('elszallt'))).toBe('elszallt');
  });

  it('ismeretlen értékre általános szöveget ad', () => {
    expect(describeError('valami')).toBe('ismeretlen hiba');
  });
});
