import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { STAGING_PREFIX } from './staging-prefix.ts';

/**
 * Az indulási takarítás (PLAN-012 T-012-27, ZIP 8. találat): a skill könyvtár
 * gyökere alatti `.staging-*` maradékok törlése, amiket egy megszakadt
 * feltöltés (a folyamat leállása a kicsomagolás vagy a csere közben) hagyott
 * hátra. Induláskor még nem fut feltöltés, tehát minden ilyen mappa árva. Ha a
 * gyökér még nem létezik (nincs feltöltött skill), nincs teendő; a gyökér
 * olvasásának hibája az indulás hibája.
 */
export async function removeStagingLeftovers(rootDirectory: string): Promise<void> {
  if (!existsSync(rootDirectory)) {
    return;
  }
  const entries = await readdir(rootDirectory);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(STAGING_PREFIX))
      .map((entry) => rm(path.join(rootDirectory, entry), { recursive: true, force: true })),
  );
}
