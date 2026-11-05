/**
 * A szkript folyamat környezete (SPEC-017 4.3): a szerver környezete NEM
 * öröklődik (a `fork` `env` alapértéke a `process.env`, Node `child_process`
 * doksi), mert abban a provider kulcsok és a `.env` fájlból betöltött titkok is
 * állnak. Két név megy át, ha a szerveren be van állítva, mert a szkript
 * viselkedése a szerver folyamatában ezektől függött (mérve: research
 * `2026-11-05-szkript-kulon-folyamat.md` 3.1 és 3.5):
 *
 * - `TZ`: a sandbox `Date` értéke az időzónát a folyamat környezetéből veszi;
 * - `NODE_EXTRA_CA_CERTS`: a gazda `fetch` által elfogadott további
 *   tanúsítványok fájlja (egy útvonal, nem titok); nélküle a szerveren működő
 *   HTTPS cím a szkript folyamatban tanúsítvány hibát adna.
 */
export function buildScriptChildEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const passed: Record<string, string> = {};
  for (const name of ['TZ', 'NODE_EXTRA_CA_CERTS'] as const) {
    const value = environment[name];
    if (value !== undefined) {
      passed[name] = value;
    }
  }
  return passed;
}
