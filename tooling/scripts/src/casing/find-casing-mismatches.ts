/**
 * A KIKÉNYSZERÍTETT SZABÁLY: a git INDEXBEN tárolt fájlnév betűzése egyezzen
 * meg a rá hivatkozó relatív import specifikátor betűzésével.
 *
 * Miért kell ez a `git ls-files`-re épülve, és miért nem elég a lemez (élő
 * mérés, ezen a repón, 2026-08-26):
 *
 * Case-insensitive, de case-preserving fejlesztői fájlrendszeren (ez a
 * futtatókörnyezet is ilyen, `git config core.ignorecase` = `true`) egy
 * hibás `git mv` a git indexet a RÉGI betűzésen hagyhatja, miközben a lemez
 * már a helyeset mutatja - és a `git status` ilyenkor TISZTÁT jelez, nincs
 * `R` bejegyzés. Ugyanígy a lemez-alapú eszközök (`eslint import-x/no-unresolved`
 * `caseSensitive` opciója, `tsc` `forceConsistentCasingInFileNames`) is
 * hibátlant jeleznek, mert ők a lemezt nézik, nem a git indexet - ezt élőben
 * megmértük: a `tools/wire-probe/src/cases/m-05.ts` fájlt szándékosan
 * `git mv m-05.ts M-05.ts`-vel visszaállítottuk (a lemez emiatt VÁLTOZATLANUL
 * `m-05.ts` maradt, a git index viszont `M-05.ts`-re állt), és sem a
 * `git status --short`, sem az `eslint`, sem a `tsc --noEmit` nem jelzett
 * semmit. Csak egy VALÓDI, kis-nagybetű-érzékeny checkoutnál (a CI-ban) derül
 * ki a hiba: `TS2307 Cannot find module`. Ez a modul ezért kizárólag a
 * `git ls-files` kimenetére épül, sosem a lemezre.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findRelativeImportSpecifiers } from './find-relative-import-specifiers.ts';
import type { RelativeImportSpecifier } from './find-relative-import-specifiers.ts';

export interface CasingMismatch {
  /**
   * A git szerinti relatív útvonala annak a fájlnak, ami az importot tartalmazza.
   */
  readonly file: string;
  readonly line: number;
  /**
   * A forráskódban szó szerint szereplő import specifikátor.
   */
  readonly specifier: string;
  /**
   * A git index szerinti VALÓDI betűzés, amire a specifikátornak mutatnia kellene.
   */
  readonly trackedPath: string;
}

// Csak ezekben a kiterjesztésekben fordulhat elő `import`/`export ... from`
// deklaráció - a repóban nincs relatív import kiterjesztés nélkül (SPEC-001,
// `allowImportingTsExtensions`), tehát a célfájl kiterjesztése is mindig
// megegyezik a forrásfájlokéval.
const SCANNABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function listTrackedFiles(repoRoot: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

function isScannableSourceFile(trackedPath: string): boolean {
  return SCANNABLE_EXTENSIONS.some((extension) => trackedPath.endsWith(extension));
}

// Egyetlen import specifikátorhoz eldönti, hogy eltérés-e - visszatér
// `undefined`-nal, ha nem (akár mert pontosan egyezik, akár mert a git
// egyáltalán nem ismeri a célfájlt, ami más hiba, nem ennek az
// ellenőrzésnek a dolga).
function resolveMismatch(
  trackedPath: string,
  { specifier, line }: RelativeImportSpecifier,
  trackedSet: ReadonlySet<string>,
  lowercaseToTracked: ReadonlyMap<string, string>,
): CasingMismatch | undefined {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(trackedPath), specifier));

  if (trackedSet.has(resolved)) {
    return undefined;
  }

  const caseInsensitiveMatch = lowercaseToTracked.get(resolved.toLowerCase());
  if (caseInsensitiveMatch === undefined) {
    return undefined;
  }

  return { file: trackedPath, line, specifier, trackedPath: caseInsensitiveMatch };
}

export function findCasingMismatches(repoRoot: string): readonly CasingMismatch[] {
  const trackedFiles = listTrackedFiles(repoRoot);
  const trackedSet = new Set(trackedFiles);
  const lowercaseToTracked = new Map<string, string>();
  for (const trackedPath of trackedFiles) {
    lowercaseToTracked.set(trackedPath.toLowerCase(), trackedPath);
  }

  const mismatches: CasingMismatch[] = [];

  for (const trackedPath of trackedFiles) {
    if (!isScannableSourceFile(trackedPath)) {
      continue;
    }

    const sourceText = readFileSync(path.join(repoRoot, trackedPath), 'utf8');
    const specifiers = findRelativeImportSpecifiers(trackedPath, sourceText);

    for (const specifier of specifiers) {
      const mismatch = resolveMismatch(trackedPath, specifier, trackedSet, lowercaseToTracked);
      if (mismatch !== undefined) {
        mismatches.push(mismatch);
      }
    }
  }

  return mismatches;
}
