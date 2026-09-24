import type { StartInputField } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import {
  buildInitialStartRunValues,
  buildStartRunInput,
  findStartRunValueErrors,
  REQUIRED_START_FIELD_MESSAGE,
} from './start-run-values.ts';

const REQUIRED_FIELD: StartInputField = { name: 'topic', label: 'Téma', valueKind: 'string', required: true };
const OPTIONAL_FIELD: StartInputField = { name: 'note', label: 'Megjegyzés', valueKind: 'string', required: false };

describe('buildInitialStartRunValues', () => {
  it('minden mezőt üres szöveggel nyit', () => {
    expect(buildInitialStartRunValues([REQUIRED_FIELD, OPTIONAL_FIELD])).toEqual({ topic: '', note: '' });
  });

  it('üres mezőlistára üres rekordot ad', () => {
    expect(buildInitialStartRunValues([])).toEqual({});
  });
});

describe('findStartRunValueErrors', () => {
  it('üresen hagyott kötelező mezőre hibát ad', () => {
    const errors = findStartRunValueErrors([REQUIRED_FIELD], { topic: '' });
    expect(errors.get('topic')).toBe(REQUIRED_START_FIELD_MESSAGE);
  });

  it('a csak szóközt tartalmazó kötelező mező is hibás', () => {
    expect(findStartRunValueErrors([REQUIRED_FIELD], { topic: ' '.repeat(3) }).get('topic')).toBe(
      REQUIRED_START_FIELD_MESSAGE,
    );
  });

  it('a szerkesztett értékek között nem szereplő mező nem ad hibát (a rekord kulcsai a mezőlistából jönnek)', () => {
    expect(findStartRunValueErrors([REQUIRED_FIELD], {}).size).toBe(0);
  });

  it('kitöltött kötelező mezőre nincs hiba', () => {
    expect(findStartRunValueErrors([REQUIRED_FIELD], { topic: 'AI' }).size).toBe(0);
  });

  it('az üresen hagyott, nem kötelező mező nem hibás', () => {
    expect(findStartRunValueErrors([OPTIONAL_FIELD], { note: '' }).size).toBe(0);
  });
});

describe('buildStartRunInput', () => {
  it('a kitöltött mezőket átveszi', () => {
    expect(buildStartRunInput({ topic: 'AI', note: 'rövid' })).toEqual({ topic: 'AI', note: 'rövid' });
  });

  it('az üresen hagyott mezőt kihagyja, nem üres szövegként adja ki', () => {
    expect(buildStartRunInput({ topic: 'AI', note: '' })).toEqual({ topic: 'AI' });
  });

  it('üres rekordra üres bemenetet ad', () => {
    expect(buildStartRunInput({})).toEqual({});
  });
});
