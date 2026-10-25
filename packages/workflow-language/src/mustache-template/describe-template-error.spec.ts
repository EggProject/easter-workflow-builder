import { describe, expect, it } from 'vitest';
import { describeTemplateError } from './describe-template-error.ts';
import { MissingTemplateNameError } from './missing-template-name-error.ts';
import { NonJsonTemplateValueError } from './non-json-template-value-error.ts';

describe('describeTemplateError', () => {
  it('a hiányzó név hibája a kért nevet idézi', () => {
    expect(describeTemplateError(new MissingTemplateNameError('input.x')).message).toBe(
      'hiányzó név a sablonban: "input.x"',
    );
  });

  it('a nem JSON értékre mutató név hibája a kért nevet idézi', () => {
    expect(describeTemplateError(new NonJsonTemplateValueError('input.szerzo')).message).toBe(
      'nem JSON értékre mutató név a sablonban: "input.szerzo"',
    );
  });

  it.each([
    ['Unclosed tag at 17', 'le nem zárt tag a sablonban (pozíció: 17)'],
    ['Unopened section "TITKOS a b" at 2', 'meg nem nyitott szakasz lezárása a sablonban (pozíció: 2)'],
    ['Unclosed section "TITKOS a b" at 36', 'le nem zárt szakasz a sablonban (pozíció: 36)'],
    ['Invalid tags: TITKOS_444', 'érvénytelen határoló csere a sablonban'],
  ])('a %s könyvtári üzenet saját magyar mondat', (libraryMessage, expected) => {
    expect(describeTemplateError(new Error(libraryMessage)).message).toBe(expected);
  });

  it('az ismeretlen kivétel szövege nem kerül ki', () => {
    expect(describeTemplateError(new TypeError('Do not know how to serialize a BigInt')).message).toBe(
      'a sablon nem renderelhető',
    );
    expect(describeTemplateError('Unclosed tag at 1').message).toBe('a sablon nem renderelhető');
  });

  it('a tartalék ág a kivétel típusnevét is hordozza, az üzenetét nem; az ismert hiba nem (SPEC-010 O-22)', () => {
    expect(describeTemplateError(new RangeError('TITKOS'))).toStrictEqual({
      kind: 'error',
      message: 'a sablon nem renderelhető',
      unexpectedErrorType: 'RangeError',
    });
    expect(describeTemplateError(new Error('Unclosed tag at 5'))).toStrictEqual({
      kind: 'error',
      message: 'le nem zárt tag a sablonban (pozíció: 5)',
    });
    expect(describeTemplateError(new MissingTemplateNameError('input.x'))).toStrictEqual({
      kind: 'error',
      message: 'hiányzó név a sablonban: "input.x"',
    });
  });
});
