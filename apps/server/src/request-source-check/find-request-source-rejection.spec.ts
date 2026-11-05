import { describe, expect, it } from 'vitest';
import { findRequestSourceRejection } from './find-request-source-rejection.ts';

const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('findRequestSourceRejection', () => {
  it('a saját felület kérését átengedi', () => {
    expect(
      findRequestSourceRejection({ host: '127.0.0.1:3001', origin: ALLOWED_ORIGIN }, 3001, ALLOWED_ORIGIN),
    ).toBeUndefined();
  });

  it('idegen Host fejlécre host_not_allowed, a kapott érték visszhangja nélkül', () => {
    const rejection = findRequestSourceRejection(
      { host: 'evil.example:3001', origin: ALLOWED_ORIGIN },
      3001,
      ALLOWED_ORIGIN,
    );
    expect(rejection).toBe('A kérés Host fejléce nem a szerver helyi neve (host_not_allowed).');
  });

  it('a Host ellenőrzés az Origin előtt dönt', () => {
    expect(
      findRequestSourceRejection(
        { host: 'evil.example:3001', origin: 'https://evil.example:3001' },
        3001,
        ALLOWED_ORIGIN,
      ),
    ).toContain('(host_not_allowed)');
  });

  it('idegen Origin fejlécre origin_not_allowed, a kapott érték visszhangja nélkül', () => {
    const rejection = findRequestSourceRejection(
      { host: '127.0.0.1:3001', origin: 'https://evil.example' },
      3001,
      ALLOWED_ORIGIN,
    );
    expect(rejection).toBe('A kérés nem a beállított felület originjéről érkezett (origin_not_allowed).');
  });
});
