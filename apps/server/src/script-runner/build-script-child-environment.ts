/**
 * A szkript folyamat környezete (SPEC-017 4.3): a szerver környezete NEM
 * öröklődik (a `fork` `env` alapértéke a `process.env`, Node `child_process`
 * doksi), mert abban a provider kulcsok és a `.env` fájlból betöltött titkok is
 * állnak. Egyetlen név megy át, ha a szerveren be van állítva: a `TZ`, mert a
 * sandbox `Date` értéke az időzónát a folyamat környezetéből veszi (mérve:
 * research `2026-11-05-szkript-kulon-folyamat.md` 3. szekció), és enélkül a
 * szkript más időzónát látna, mint a szerver.
 */
export function buildScriptChildEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const { TZ: timeZone } = environment;
  return timeZone === undefined ? {} : { TZ: timeZone };
}
