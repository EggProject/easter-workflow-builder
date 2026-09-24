import { afterEach, describe, expect, it } from 'vitest';
import process from 'node:process';
// Előtöltő import, szándékosan név nélkül: a `main.ts` mögötti teljes
// szerver modulgráfot (`runStartupSequence` és minden, amit behúz) a fájl
// gyűjtési fázisában tölti be, amire a Vitest nem alkalmaz teszt
// időkorlátot. Nélküle a teszt törzsében álló dinamikus `import('./main.ts')`
// a gráf transzformálását és kiértékelését is az 5000 ms-os korláton belül
// végezte (mérve: a gráf betöltése 2360-2672 ms, a `main.ts` saját része 4-5
// ms), ami terhelés alatt túllépte azt. Az előtöltés után a dinamikus import
// csak a `main.ts` saját mellékhatását futtatja, ugyanazzal a
// `runStartupSequence` példánnyal
// (`docs/research/2026-09-23-teszt-idokorlat-bombak.md`).
import './startup-sequence/run-startup-sequence.ts';

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
