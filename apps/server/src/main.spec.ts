import { afterEach, describe, expect, it } from 'vitest';
import process from 'node:process';

describe('main belépési pont', () => {
  afterEach(() => {
    process.exitCode = undefined;
    Reflect.deleteProperty(process.env, 'EASTER_SERVER_PORT');
  });

  it('egyetlen hívást tesz a runStartupSequence-re: hiányzó konfigurációra a folyamat kilépési kódja 1 lesz', async () => {
    Reflect.deleteProperty(process.env, 'EASTER_SERVER_PORT');

    await import('./main.ts');

    expect(process.exitCode).toBe(1);
  });
});
