import { describe, expect, it } from 'vitest';
import { compileScript } from './compile-script.ts';

describe('compileScript', () => {
  it('a helyes törzs lefordul', async () => {
    await expect(compileScript('const x = await Promise.resolve(input); return { y: x };')).resolves.toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
  });

  it('a szintaktikai hiba script_compile_failed, a QuickJS hibájának szövegével', async () => {
    await expect(compileScript('return {')).resolves.toStrictEqual({
      kind: 'error',
      message: "A JavaScript szkript nem fordul le: SyntaxError: expecting ';' (script_compile_failed).",
    });
  });

  it('a fordítás nem futtatja a törzset', async () => {
    await expect(compileScript('while (true) {}')).resolves.toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a gazdára kijutó mély forrás elemzés is script_compile_failed', async () => {
    await expect(compileScript(`return ${'('.repeat(100_000)}1${')'.repeat(100_000)};`)).resolves.toStrictEqual({
      kind: 'error',
      message: 'A JavaScript szkript fordítása a gazda oldalon megszakadt (RangeError) (script_compile_failed).',
    });
  });
});
