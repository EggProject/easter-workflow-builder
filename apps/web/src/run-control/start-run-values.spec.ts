import type { StartInputField } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { buildInitialStartRunValues, EMPTY_START_RUN_FIELD_VALUE } from './start-run-values.ts';

const TEXT_FIELD: StartInputField = { name: 'topic', label: 'Téma', valueKind: 'text', required: true };
const NUMBER_FIELD: StartInputField = { name: 'count', label: 'Darab', valueKind: 'number', required: false };

describe('EMPTY_START_RUN_FIELD_VALUE', () => {
  it('üres szöveg, hiányzó szám és nem jelölt négyzet', () => {
    expect(EMPTY_START_RUN_FIELD_VALUE.text).toBe('');
    expect(EMPTY_START_RUN_FIELD_VALUE.number).toBeNaN();
    expect(EMPTY_START_RUN_FIELD_VALUE.checked).toBe(false);
  });
});

describe('buildInitialStartRunValues', () => {
  it('minden mezőt üres állapottal nyit, típustól függetlenül', () => {
    expect(buildInitialStartRunValues([TEXT_FIELD, NUMBER_FIELD])).toEqual({
      topic: EMPTY_START_RUN_FIELD_VALUE,
      count: EMPTY_START_RUN_FIELD_VALUE,
    });
  });

  it('üres mezőlistára üres rekordot ad', () => {
    expect(buildInitialStartRunValues([])).toEqual({});
  });
});
