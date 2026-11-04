import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';

/**
 * A csere két fájlrendszer művelete; a teszt a hibaágat egy hibázó
 * `rename` befecskendezésével igazolja (a valódi fájlrendszeren ez az ág
 * determinisztikusan nem idézhető elő).
 */
export interface DirectoryReplaceOperations {
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly remove: (target: string) => Promise<void>;
}

const NODE_FILE_SYSTEM: DirectoryReplaceOperations = {
  rename,
  remove: (target) => rm(target, { recursive: true, force: true }),
};

/**
 * A kicsomagolt skill a végleges helyére kerül (SPEC-009 5.4 9. pont):
 * felülíráskor a régi skill előbb félrekerül (`previous`), az új átnevezéssel
 * a helyére lép, és csak ezután törlődik a régi. Ha az új nem kerülhet a
 * helyére, a régi visszakerül, és a hiba továbbmegy: a régi skill érintetlen
 * marad. A `source`, a `previous` és a `destination` ugyanazon a
 * fájlrendszeren áll (a skill könyvtár gyökere alatt), így az átnevezés nem
 * másolás.
 */
export async function replaceSkillDirectory(
  source: string,
  destination: string,
  previous: string,
  operations: DirectoryReplaceOperations = NODE_FILE_SYSTEM,
): Promise<void> {
  const hasPrevious = existsSync(destination);
  if (hasPrevious) {
    await operations.rename(destination, previous);
  }
  try {
    await operations.rename(source, destination);
  } catch (error) {
    if (hasPrevious) {
      await operations.rename(previous, destination);
    }
    throw error;
  }
  if (hasPrevious) {
    await operations.remove(previous);
  }
}
