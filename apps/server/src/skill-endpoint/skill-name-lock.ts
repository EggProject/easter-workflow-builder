/**
 * A skill könyvtár írásainak névenkénti sorosítása (PLAN-012 T-012-27, ZIP
 * 1. találat): ugyanarra a névre a feltöltés cseréje és a törlés egymás után
 * fut, különböző nevekre párhuzamosan. Két egyidejű csere ugyanarra a névre
 * különben egymás `previous` könyvtárát mozgatná el (`ENOTEMPTY`, `ENOENT`).
 * A zár a folyamaton belül él, mert a skill könyvtárat egyetlen szerver
 * folyamat kezeli (SPEC-009 5.1).
 */
export interface SkillNameLock {
  readonly run: <TValue>(name: string, task: () => Promise<TValue>) => Promise<TValue>;
}

// A lánc eleme sosem utasít el: a feladat hibáját a saját hívója kapja, a lánc csak a sorrendet hordozza.
async function settled(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // szándékosan üres: a hibát a feladat hívója kapja meg
  }
}

async function runAfter<TValue>(previous: Promise<void>, task: () => Promise<TValue>): Promise<TValue> {
  await previous;
  return task();
}

export function createSkillNameLock(): SkillNameLock {
  // Névenként a lánc utolsó, soha el nem utasított ígérete.
  const tails = new Map<string, Promise<void>>();
  return {
    run: async (name, task) => {
      const current = runAfter(tails.get(name) ?? Promise.resolve(), task);
      const tail = settled(current);
      tails.set(name, tail);
      try {
        return await current;
      } finally {
        if (tails.get(name) === tail) {
          tails.delete(name);
        }
      }
    },
  };
}
