import { describe, expect, it } from 'vitest';
import { isAllowedHostHeader } from './is-allowed-host-header.ts';

describe('isAllowedHostHeader', () => {
  it.each(['127.0.0.1:3001', 'localhost:3001', 'LOCALHOST:3001'])('a "%s" fejlécet a 3001 porton átengedi', (host) => {
    expect(isAllowedHostHeader(host, 3001)).toBe(true);
  });

  it.each([
    ['DNS rebinding név', 'evil.example:3001'],
    ['idegen port', '127.0.0.1:3002'],
    ['port nélkül, nem alapértelmezett porton', '127.0.0.1'],
    ['IPv6 loopback, amin a szerver nem hallgat', '[::1]:3001'],
    ['localhost aldomain', 'app.localhost:3001'],
    ['a helyi név utótagként', '127.0.0.1:3001.evil.example'],
    ['felhasználói rész', 'evil.example@127.0.0.1:3001'],
    ['üres', ''],
  ])('elutasítja: %s ("%s")', (_label, host) => {
    expect(isAllowedHostHeader(host, 3001)).toBe(false);
  });

  it('hiányzó fejlécet és ismeretlen helyi portot elutasít', () => {
    expect(isAllowedHostHeader(undefined, 3001)).toBe(false);
    expect(isAllowedHostHeader('127.0.0.1:3001', undefined)).toBe(false);
  });

  it('az alapértelmezett porton a böngésző port nélküli Host fejlécét fogadja (WHATWG URL szerializálás)', () => {
    expect(isAllowedHostHeader('localhost', 80)).toBe(true);
    expect(isAllowedHostHeader('localhost:80', 80)).toBe(false);
  });
});
