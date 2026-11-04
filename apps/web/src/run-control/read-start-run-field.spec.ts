import type { StartInputField, StartInputValueKind } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { readStartRunField } from './read-start-run-field.ts';
import { EMPTY_START_RUN_FIELD_VALUE, type StartRunFieldValue } from './start-run-values.ts';

function fieldOf(valueKind: Exclude<StartInputValueKind, 'choice'>): StartInputField {
  return { name: 'f', label: 'F', valueKind, required: false };
}

const CHOICE_FIELD: StartInputField = {
  name: 'f',
  label: 'F',
  valueKind: 'choice',
  options: ['piros', 'zöld'],
  required: false,
};

function withText(text: string): StartRunFieldValue {
  return { ...EMPTY_START_RUN_FIELD_VALUE, text };
}

describe('readStartRunField', () => {
  it('a szöveg mező szövegként adja az értéket', () => {
    expect(readStartRunField(fieldOf('text'), withText('AI hírek'))).toEqual({ status: 'present', value: 'AI hírek' });
  });

  it('az üres szöveg mező hiányzik, a csak szóközt tartalmazó nem kötelező szöveg viszont megy, ahogy ma', () => {
    const blank = withText(' '.repeat(3));
    expect(readStartRunField(fieldOf('text'), withText(''))).toEqual({ status: 'missing' });
    expect(readStartRunField(fieldOf('text'), blank)).toEqual({ status: 'present', value: ' '.repeat(3) });
    expect(readStartRunField(CHOICE_FIELD, blank)).toEqual({ status: 'present', value: ' '.repeat(3) });
  });

  it('a kötelező szöveg és választó mezőt a csak szóköz is üresnek számít', () => {
    const blank = withText(' '.repeat(3));
    const requiredText: StartInputField = { ...fieldOf('text'), required: true };
    const requiredChoice: StartInputField = { ...CHOICE_FIELD, required: true };
    expect(readStartRunField(requiredText, blank)).toEqual({ status: 'missing' });
    expect(readStartRunField(requiredChoice, blank)).toEqual({ status: 'missing' });
  });

  it('a szám mező számként adja az értéket, a nulla is érték', () => {
    expect(readStartRunField(fieldOf('number'), { ...EMPTY_START_RUN_FIELD_VALUE, number: 4.5 })).toEqual({
      status: 'present',
      value: 4.5,
    });
    expect(readStartRunField(fieldOf('number'), { ...EMPTY_START_RUN_FIELD_VALUE, number: 0 })).toEqual({
      status: 'present',
      value: 0,
    });
  });

  it('a NaN szám mező hiányzik', () => {
    expect(readStartRunField(fieldOf('number'), EMPTY_START_RUN_FIELD_VALUE)).toEqual({ status: 'missing' });
  });

  it('a logikai mező mindig ad értéket, a hamis is', () => {
    expect(readStartRunField(fieldOf('boolean'), EMPTY_START_RUN_FIELD_VALUE)).toEqual({
      status: 'present',
      value: false,
    });
    expect(readStartRunField(fieldOf('boolean'), { ...EMPTY_START_RUN_FIELD_VALUE, checked: true })).toEqual({
      status: 'present',
      value: true,
    });
  });

  it('a választólista mező a kiválasztott opciót adja, üresen hiányzik', () => {
    expect(readStartRunField(CHOICE_FIELD, withText('zöld'))).toEqual({ status: 'present', value: 'zöld' });
    expect(readStartRunField(CHOICE_FIELD, withText(''))).toEqual({ status: 'missing' });
  });

  it('a lista mező soronként egy elemet ad, üres sorok nélkül', () => {
    expect(readStartRunField(fieldOf('list'), withText('egy\n\n  kettő  \n'))).toEqual({
      status: 'present',
      value: ['egy', 'kettő'],
    });
  });

  it('az elem nélküli lista mező hiányzik', () => {
    expect(readStartRunField(fieldOf('list'), withText('\n  \n'))).toEqual({ status: 'missing' });
  });

  it('a JSON mező minden JSON értéket értelmez', () => {
    expect(readStartRunField(fieldOf('json'), withText('{"a": [1, true]}'))).toEqual({
      status: 'present',
      value: { a: [1, true] },
    });
    expect(readStartRunField(fieldOf('json'), withText('"szöveg"'))).toEqual({ status: 'present', value: 'szöveg' });
    expect(readStartRunField(fieldOf('json'), withText('0'))).toEqual({ status: 'present', value: 0 });
    // eslint-disable-next-line unicorn/no-null -- a JSON `null` érték a tesztelt viselkedés: érték, nem hiányzó mező.
    expect(readStartRunField(fieldOf('json'), withText('null'))).toEqual({ status: 'present', value: null });
  });

  it('a csak szóközt tartalmazó JSON mező hiányzik', () => {
    expect(readStartRunField(fieldOf('json'), withText(' \n '))).toEqual({ status: 'missing' });
  });

  it('az értelmezhetetlen JSON szöveg külön állapot', () => {
    expect(readStartRunField(fieldOf('json'), withText('{"a": '))).toEqual({ status: 'invalid_json' });
  });
});
