import { describe, expect, it } from 'vitest';
import { isRecord } from './is-record.ts';

describe('isRecord', () => {
  it('igazat ad sima objektumra', () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('hamisat ad a JSON-ból jövő null értékre', () => {
    // A `null` literált a lint tiltja, a guardnak viszont pont a JSON-ból
    // érkező null értéket kell kizárnia, ezért így állítjuk elő.
    const nullFromJson: unknown = JSON.parse('null');
    expect(isRecord(nullFromJson)).toBe(false);
  });

  it('hamisat ad hiányzó értékre', () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it('hamisat ad tömbre', () => {
    expect(isRecord([1, 2])).toBe(false);
  });

  it('hamisat ad nem objektum értékre', () => {
    expect(isRecord('szöveg')).toBe(false);
  });

  it('szűkíti a típust, tehát a kulcsok olvashatóvá válnak', () => {
    const value: unknown = { kulcs: 'ertek' };
    if (!isRecord(value)) {
      throw new Error('objektumra igazat kellene adnia');
    }
    expect(value['kulcs']).toBe('ertek');
  });
});
