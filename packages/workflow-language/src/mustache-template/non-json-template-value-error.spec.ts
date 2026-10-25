import { describe, expect, it } from 'vitest';
import { NonJsonTemplateValueError } from './non-json-template-value-error.ts';

describe('NonJsonTemplateValueError', () => {
  it('a teljes, kért nevet idézi, és Error példány', () => {
    const error = new NonJsonTemplateValueError('input.szerzo');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('nem JSON értékre mutató név a sablonban: "input.szerzo"');
  });
});
