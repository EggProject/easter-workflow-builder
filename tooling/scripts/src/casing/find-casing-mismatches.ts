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
import { findRelativeSpecifierCandidates } from './find-relative-specifier-candidates.ts';

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

// Egyetlen import specifikátorhoz eldönti, hogy eltérés-e: ha igen, a git
// szerinti valódi betűzést adja vissza, ha nem, `undefined`-ot (akár mert
// pontosan egyezik, akár mert a git egyáltalán nem ismeri a célfájlt, ami
// más hiba, nem ennek az ellenőrzésnek a dolga).
function findCaseOnlyMatch(
  trackedPath: string,
  specifier: string,
  trackedSet: ReadonlySet<string>,
  lowercaseToTracked: ReadonlyMap<string, string>,
): string | undefined {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(trackedPath), specifier));

  if (trackedSet.has(resolved)) {
    return undefined;
  }

  return lowercaseToTracked.get(resolved.toLowerCase());
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

    // A drága, parser alapú kinyerés csak akkor fut, ha az előszűrő nem tud
    // dönteni, vagy legalább egy jelöltje eltérésnek látszik; a garanciát a
    // `find-relative-specifier-candidates.ts` fejléce írja le.
    const candidates = findRelativeSpecifierCandidates(sourceText);
    if (
      candidates?.every(
        (candidate) => findCaseOnlyMatch(trackedPath, candidate, trackedSet, lowercaseToTracked) === undefined,
      ) === true
    ) {
      continue;
    }

    for (const { specifier, line } of findRelativeImportSpecifiers(trackedPath, sourceText)) {
      const caseOnlyMatch = findCaseOnlyMatch(trackedPath, specifier, trackedSet, lowercaseToTracked);
      if (caseOnlyMatch !== undefined) {
        mismatches.push({ file: trackedPath, line, specifier, trackedPath: caseOnlyMatch });
      }
    }
  }

  return mismatches;
}
