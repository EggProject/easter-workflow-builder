/**
 * Igaz, ha a lépés kimenete `JSON.stringify` hívással szerializálható. A `db`
 * a `step_run.output` oszlopot a záró tranzakción belül szerializálja, és a
 * kivételt névtelen `Outcome` hibára viszi, amiből a motor nem tudja
 * megkülönböztetni a tárolási hibát; ez az ellenőrzés a tárolás ELŐTT fut,
 * hogy a végrehajtó a hibát lépés szintű hibaosztállyal zárhassa. Egy közös
 * hivatkozású CEL eredmény a szerializáláskor újra kibomlik, és túl nagy
 * méretnél `RangeError` kivételt dob (SPEC-010 O-15, research
 * `2026-10-21-spec010-blokkolo-meresek.md` 10.2).
 */
export function canSerializeOutput(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}
