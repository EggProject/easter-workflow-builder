import { describe, expect, it } from 'vitest';
import { fromTimeoutSecondsFieldValue, toTimeoutSecondsFieldValue } from './timeout-seconds-field-value.ts';

describe('toTimeoutSecondsFieldValue', () => {
  it('a null üres szöveg (alapérték)', () => {
    // eslint-disable-next-line unicorn/no-null -- a `timeoutMs` a dróton ténylegesen `null` értéket hordoz.
    expect(toTimeoutSecondsFieldValue(null)).toBe('');
  });

  it('az ezredmásodpercet tizedes másodperccé írja', () => {
    expect(toTimeoutSecondsFieldValue(60_000)).toBe('60');
    expect(toTimeoutSecondsFieldValue(1500)).toBe('1.5');
    expect(toTimeoutSecondsFieldValue(1)).toBe('0.001');
  });
});

describe('fromTimeoutSecondsFieldValue', () => {
  it('az üres és a csak szóközből álló szöveg null', () => {
    expect(fromTimeoutSecondsFieldValue('')).toBeNull();
    expect(fromTimeoutSecondsFieldValue('  ')).toBeNull();
  });

  it('az egész másodpercet ezredmásodpercre váltja', () => {
    expect(fromTimeoutSecondsFieldValue('60')).toBe(60_000);
  });

  it('a tizedes másodpercet lebegőpontos zaj nélkül, pontos egészre váltja', () => {
    expect(fromTimeoutSecondsFieldValue('1.1')).toBe(1100);
    expect(fromTimeoutSecondsFieldValue('1.5')).toBe(1500);
    expect(fromTimeoutSecondsFieldValue('0.001')).toBe(1);
    expect(fromTimeoutSecondsFieldValue('1e2')).toBe(100_000);
  });

  it('az ezredmásodpercnél finomabb bemenetet nem kerekíti, törtként adja tovább', () => {
    expect(fromTimeoutSecondsFieldValue('1.0004')).toBeCloseTo(1000.4, 9);
    expect(Number.isSafeInteger(fromTimeoutSecondsFieldValue('1.0004'))).toBe(false);
    expect(Number.isSafeInteger(fromTimeoutSecondsFieldValue('0.0005'))).toBe(false);
  });

  it('a nem szám bemenet NaN marad, a mentési séma jelzi', () => {
    expect(fromTimeoutSecondsFieldValue('abc')).toBeNaN();
  });
});
