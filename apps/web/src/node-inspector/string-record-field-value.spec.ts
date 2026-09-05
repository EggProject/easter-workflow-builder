import { describe, expect, it } from 'vitest';
import { fromStringRecordFieldValue, toStringRecordFieldValue } from './string-record-field-value.ts';

describe('stringRecordFieldValue', () => {
  it('a rekordot kulcs=érték soronkénti szöveggé alakítja', () => {
    expect(toStringRecordFieldValue({ a: '1', b: '2' })).toBe('a=1\nb=2');
  });

  it('az üres rekordot üres sztringgé alakítja', () => {
    expect(toStringRecordFieldValue({})).toBe('');
  });

  it('a kulcs=érték soronkénti szöveget rekorddá bontja', () => {
    expect(fromStringRecordFieldValue('a=1\nb=2')).toStrictEqual({ a: '1', b: '2' });
  });

  it('az "=" jel nélküli sort kihagyja', () => {
    expect(fromStringRecordFieldValue('nincs egyenlőségjel\na=1')).toStrictEqual({ a: '1' });
  });

  it('a "=" jellel kezdődő (üres kulcsú) sort kihagyja', () => {
    expect(fromStringRecordFieldValue('=érték\na=1')).toStrictEqual({ a: '1' });
  });

  it('a csak szóközből álló kulcsú sort kihagyja', () => {
    expect(fromStringRecordFieldValue('   =érték\na=1')).toStrictEqual({ a: '1' });
  });
});
