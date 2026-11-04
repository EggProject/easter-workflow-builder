import type { StartInputField } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import {
  evaluateStartRunValues,
  INVALID_JSON_START_FIELD_MESSAGE,
  REQUIRED_START_FIELD_MESSAGE,
} from './evaluate-start-run-values.ts';
import { EMPTY_START_RUN_FIELD_VALUE, type StartRunFieldValue } from './start-run-values.ts';

const REQUIRED_TEXT: StartInputField = { name: 'topic', label: 'Téma', valueKind: 'text', required: true };
const OPTIONAL_TEXT: StartInputField = { name: 'note', label: 'Megjegyzés', valueKind: 'text', required: false };

function withText(text: string): StartRunFieldValue {
  return { ...EMPTY_START_RUN_FIELD_VALUE, text };
}

describe('evaluateStartRunValues', () => {
  it('a kitöltött mezőket típusos értékkel veszi át', () => {
    const fields: readonly StartInputField[] = [
      REQUIRED_TEXT,
      { name: 'count', label: 'Darab', valueKind: 'number', required: false },
      { name: 'urgent', label: 'Sürgős', valueKind: 'boolean', required: false },
      { name: 'color', label: 'Szín', valueKind: 'choice', options: ['piros', 'zöld'], required: false },
      { name: 'tags', label: 'Címkék', valueKind: 'list', required: false },
      { name: 'payload', label: 'Adat', valueKind: 'json', required: false },
    ];
    const { input, errors } = evaluateStartRunValues(fields, {
      topic: withText('AI'),
      count: { ...EMPTY_START_RUN_FIELD_VALUE, number: 3 },
      urgent: { ...EMPTY_START_RUN_FIELD_VALUE, checked: true },
      color: withText('zöld'),
      tags: withText('a\nb'),
      payload: withText('{"k": 1}'),
    });
    expect(errors.size).toBe(0);
    expect(input).toEqual({
      topic: 'AI',
      count: 3,
      urgent: true,
      color: 'zöld',
      tags: ['a', 'b'],
      payload: { k: 1 },
    });
  });

  it('az üresen hagyott, nem kötelező mező kulcsa kimarad, a logikai mező viszont mindig megy', () => {
    const fields: readonly StartInputField[] = [
      OPTIONAL_TEXT,
      { name: 'count', label: 'Darab', valueKind: 'number', required: false },
      { name: 'urgent', label: 'Sürgős', valueKind: 'boolean', required: false },
      { name: 'tags', label: 'Címkék', valueKind: 'list', required: false },
      { name: 'payload', label: 'Adat', valueKind: 'json', required: false },
    ];
    const { input, errors } = evaluateStartRunValues(fields, {
      note: EMPTY_START_RUN_FIELD_VALUE,
      count: EMPTY_START_RUN_FIELD_VALUE,
      urgent: EMPTY_START_RUN_FIELD_VALUE,
      tags: withText(' \n'),
      payload: withText('  '),
    });
    expect(errors.size).toBe(0);
    expect(input).toEqual({ urgent: false });
    expect(Object.keys(input)).toEqual(['urgent']);
  });

  it('az üresen hagyott kötelező mezőre hibát ad, a csak szóközt tartalmazóra is', () => {
    const blank = withText(' '.repeat(3));
    const emptyResult = evaluateStartRunValues([REQUIRED_TEXT], { topic: EMPTY_START_RUN_FIELD_VALUE });
    const blankResult = evaluateStartRunValues([REQUIRED_TEXT], { topic: blank });
    expect(emptyResult.errors.get('topic')).toBe(REQUIRED_START_FIELD_MESSAGE);
    expect(blankResult.errors.get('topic')).toBe(REQUIRED_START_FIELD_MESSAGE);
  });

  it('a kötelező szám, lista és JSON mező üresen szintén hibás', () => {
    const fields: readonly StartInputField[] = [
      { name: 'count', label: 'Darab', valueKind: 'number', required: true },
      { name: 'tags', label: 'Címkék', valueKind: 'list', required: true },
      { name: 'payload', label: 'Adat', valueKind: 'json', required: true },
    ];
    const { errors } = evaluateStartRunValues(fields, {
      count: EMPTY_START_RUN_FIELD_VALUE,
      tags: EMPTY_START_RUN_FIELD_VALUE,
      payload: EMPTY_START_RUN_FIELD_VALUE,
    });
    expect([...errors]).toEqual([
      ['count', REQUIRED_START_FIELD_MESSAGE],
      ['tags', REQUIRED_START_FIELD_MESSAGE],
      ['payload', REQUIRED_START_FIELD_MESSAGE],
    ]);
  });

  it('a kötelező logikai mező a hamis értékkel is teljesül', () => {
    const field: StartInputField = { name: 'urgent', label: 'Sürgős', valueKind: 'boolean', required: true };
    const { input, errors } = evaluateStartRunValues([field], { urgent: EMPTY_START_RUN_FIELD_VALUE });
    expect(errors.size).toBe(0);
    expect(input).toEqual({ urgent: false });
  });

  it('az értelmezhetetlen JSON mező hibát ad, kötelezőségtől függetlenül, és nem kerül a bemenetbe', () => {
    const optional: StartInputField = { name: 'a', label: 'A', valueKind: 'json', required: false };
    const required: StartInputField = { name: 'b', label: 'B', valueKind: 'json', required: true };
    const { input, errors } = evaluateStartRunValues([optional, required], { a: withText('{'), b: withText('[1,') });
    expect(errors.get('a')).toBe(INVALID_JSON_START_FIELD_MESSAGE);
    expect(errors.get('b')).toBe(INVALID_JSON_START_FIELD_MESSAGE);
    expect(input).toEqual({});
  });

  it('a szerkesztett értékek között nem szereplő mezőt üresnek veszi (a modális nyitásának első renderje)', () => {
    const { input, errors } = evaluateStartRunValues([REQUIRED_TEXT, OPTIONAL_TEXT], {});
    expect(input).toEqual({});
    expect(errors.has('topic')).toBe(true);
    expect(errors.size).toBe(1);
  });

  it('üres mezőlistára üres bemenetet és hibák nélküli eredményt ad', () => {
    const { input, errors } = evaluateStartRunValues([], {});
    expect(input).toEqual({});
    expect(errors.size).toBe(0);
  });
});
