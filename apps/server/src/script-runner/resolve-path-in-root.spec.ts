import { describe, expect, it } from 'vitest';
import { resolvePathInRoot } from './resolve-path-in-root.ts';

describe('resolvePathInRoot', () => {
  it('a relatív útvonalat a gyökérhez oldja fel', () => {
    expect(resolvePathInRoot('/gyoker', 'a/b.txt', false)).toStrictEqual({
      kind: 'path',
      path: '/gyoker/a/b.txt',
      requested: 'a/b.txt',
    });
    expect(resolvePathInRoot('/gyoker', 'a/../b.txt', false)).toStrictEqual({
      kind: 'path',
      path: '/gyoker/b.txt',
      requested: 'a/../b.txt',
    });
  });

  it('a .. kivezetést elutasítja', () => {
    expect(resolvePathInRoot('/gyoker', '../kint.txt', false)).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: ../kint.txt',
    });
  });

  it('a gyökér maga csak allowRoot mellett elfogadott', () => {
    expect(resolvePathInRoot('/gyoker', '.', true)).toStrictEqual({ kind: 'path', path: '/gyoker', requested: '.' });
    expect(resolvePathInRoot('/gyoker', '.', false)).toMatchObject({ kind: 'rejected' });
  });

  it('az abszolút útvonalat elutasítja, a gyökér alattit is', () => {
    expect(resolvePathInRoot('/gyoker', '/gyoker/a.txt', false)).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal nem lehet abszolút: /gyoker/a.txt',
    });
  });

  it('a nem szöveg útvonalat TypeError-ral utasítja el', () => {
    expect(resolvePathInRoot('/gyoker', 1, false)).toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'az útvonal szöveg kell legyen',
    });
  });
});
