import { describe, expect, it } from 'vitest';
import { TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE } from './timeout-seconds-field-error-message.ts';

describe('TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE', () => {
  it('másodpercben mondja ki a szabályt, az ezredmásodperces határ nélkül', () => {
    expect(TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE).toBe(
      'Az időkorlát pozitív szám legyen másodpercben, legfeljebb három tizedesjeggyel, és legfeljebb 2 147 483,647 másodperc.',
    );
    expect(TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE).not.toContain('2147483647');
  });
});
