import { describe, expect, it } from 'vitest';
import { MissingTemplateNameError } from './missing-template-name-error.ts';

describe('MissingTemplateNameError', () => {
  it('a teljes, kért nevet idézi, és Error példány', () => {
    const error = new MissingTemplateNameError('input.szerzo.nemletezik');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('hiányzó név a sablonban: input.szerzo.nemletezik');
  });
});
