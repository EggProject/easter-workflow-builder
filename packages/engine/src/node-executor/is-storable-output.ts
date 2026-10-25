import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';

/**
 * Igaz, ha a lépés kimenete tárolható: a `JSON.stringify` eredménye nem
 * hosszabb a `MAX_STORED_OUTPUT_LENGTH` korlátnál, és a szerializálás nem dob
 * kivételt. A `db` a `step_run.output` oszlopot a záró tranzakción belül
 * szerializálja és olvassa vissza, a visszaolvasás pedig közös hivatkozás nélküli
 * fát épít; ez az ellenőrzés a tárolás ELŐTT fut, hogy a végrehajtó a hibát
 * lépés szintű hibaosztállyal zárhassa. A szerializálás kivétele (`RangeError`,
 * a szöveg hossza a motor határát lépi át) mindig a korlát fölötti méretet
 * jelent, ezért ugyanúgy nemet ad (SPEC-010 O-15, O-18, research
 * `2026-10-21-spec010-blokkolo-meresek.md` 10.2 és 12. szekció).
 */
export function isStorableOutput(value: readonly unknown[]): boolean {
  try {
    return JSON.stringify(value).length <= MAX_STORED_OUTPUT_LENGTH;
  } catch {
    return false;
  }
}
