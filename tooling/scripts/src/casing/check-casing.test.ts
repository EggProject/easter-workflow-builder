// Regressziós teszt egy valós CI hibára: a git indexben tárolt fájlnevek
// betűzése eltért a rájuk hivatkozó relatív importokétól
// (`tools/wire-probe/src/cases/M-01.ts` ... `M-36.ts` a git indexben, de az
// import `./m-01.ts` ... `./m-36.ts`). Case-insensitive fejlesztői
// fájlrendszeren ez lokálisan láthatatlan, csak a CI valódi,
// kis-nagybetű-érzékeny checkoutján bukott ki (`TS2307`). Lásd a
// `find-casing-mismatches.ts` fejlécét a részletes indoklásért és az élő
// mérésért, ami igazolja, hogy sem az `eslint`, sem a `tsc` nem kapja el ezt
// az esetet - csak egy, a git indexre épülő ellenőrzés.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { findCasingMismatches } from './find-casing-mismatches.ts';

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

describe('git index fájlnevek és a relatív importok betűzése', () => {
  it('nincs eltérés a teljes repóban', () => {
    const mismatches = findCasingMismatches(repoRoot());
    expect(mismatches).toEqual([]);
  });
});
