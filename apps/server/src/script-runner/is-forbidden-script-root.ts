import { realpath } from 'node:fs/promises';
import { isForbiddenHostPath } from './is-forbidden-host-path.ts';

/**
 * A fájl hozzáférés abszolút gyökere (a `cwd`, üresen a szerver
 * munkakönyvtára) a `/proc` vagy a `/dev` alá mutat-e, lexikálisan vagy az
 * `fs.realpath` alakján (SPEC-014 5.4 "Fájl", user döntés 2026-11-04). Ha a
 * gyökér nem oldható fel (nem létezik, nem könyvtár, nincs jog), az eredmény
 * hamis: a szkript fájl művelete ilyenkor a saját hibáját adja (`ENOENT`,
 * `ENOTDIR`), ugyanúgy, mint a döntés előtt.
 */
export async function isForbiddenScriptRoot(root: string): Promise<boolean> {
  if (isForbiddenHostPath(root)) {
    return true;
  }
  try {
    return isForbiddenHostPath(await realpath(root));
  } catch {
    return false;
  }
}
