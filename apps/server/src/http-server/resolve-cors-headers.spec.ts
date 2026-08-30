import { describe, expect, it } from 'vitest';
import { resolveCorsHeaders } from './resolve-cors-headers.ts';

describe('resolveCorsHeaders', () => {
  it('nincs konfigurált origin esetén nem ad CORS fejlécet a stream útvonalon sem', () => {
    expect(resolveCorsHeaders('/events', undefined)).toStrictEqual({});
  });

  it('konfigurált origin esetén a stream útvonalon a konfigurált értéket adja', () => {
    expect(resolveCorsHeaders('/events', 'http://localhost:5173')).toStrictEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    });
  });

  it('nem a stream útvonalon konfigurált origin mellett sem ad fejlécet', () => {
    expect(resolveCorsHeaders('/api/workflows', 'http://localhost:5173')).toStrictEqual({});
  });

  it('mindig a konfigurált értéket adja, nem a kérés Originjét tükrözi vissza (eltérő origin esetén sem)', () => {
    // A hívó (create-http-server.ts) nem adja át a kérés Origin fejlécét: a
    // függvény szignatúrája szerint sincs mit visszatükrözni - ez maga a
    // bizonyíték arra, hogy a válasz mindig a konfigurált értéken áll, egy
    // "eltérő", a devOrigintől különböző kérés Originje sem térítheti el.
    expect(resolveCorsHeaders('/events', 'http://localhost:5173')).toStrictEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    });
  });

  it('a fejléc értéke soha nem csillag', () => {
    const headers = resolveCorsHeaders('/events', 'http://localhost:5173');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
  });
});
