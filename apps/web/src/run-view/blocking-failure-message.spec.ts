import { describe, expect, it } from 'vitest';
import type { RouteFailure } from '../rest-client/route-outcome.ts';
import { blockingFailureMessage } from './blocking-failure-message.ts';

const TRANSIENT_FAILURE: RouteFailure = {
  kind: 'error',
  message: 'A szerver hibás választ adott (HTTP 502).',
  isTransient: true,
};

const PERMANENT_FAILURE: RouteFailure = {
  kind: 'error',
  message: 'A szerver hibás választ adott (HTTP 500).',
  isTransient: false,
};

describe('blockingFailureMessage', () => {
  it('hiba nélkül nincs blokkoló üzenet', () => {
    expect(blockingFailureMessage(undefined, false)).toBeUndefined();
    expect(blockingFailureMessage(undefined, true)).toBeUndefined();
  });

  it('átmeneti hiba korábbi érték mellett nem blokkol', () => {
    expect(blockingFailureMessage(TRANSIENT_FAILURE, true)).toBeUndefined();
  });

  it('átmeneti hiba korábbi érték nélkül blokkol, mert nincs mit helyette mutatni', () => {
    expect(blockingFailureMessage(TRANSIENT_FAILURE, false)).toBe('A szerver hibás választ adott (HTTP 502).');
  });

  it('nem átmeneti hiba korábbi érték mellett is blokkol', () => {
    expect(blockingFailureMessage(PERMANENT_FAILURE, true)).toBe('A szerver hibás választ adott (HTTP 500).');
    expect(blockingFailureMessage(PERMANENT_FAILURE, false)).toBe('A szerver hibás választ adott (HTTP 500).');
  });
});
