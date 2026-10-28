/**
 * A `pino-roll` transport opció objektumát felépítő tiszta függvény
 * (SPEC-006 9.2). Nem indít worker szálat és nem hoz létre fájlt: a
 * `pino.transport({ target: 'pino-roll', options: ... })` hívás az
 * `apps/server` `startup-sequence` témájában áll, ez a függvény csak az
 * `options` mezőt adja.
 *
 * A `pino-roll` README-je (https://github.com/mcollina/pino-roll) szerint a
 * `size`, a `frequency` és a `limit.count` mezőnek NINCS dokumentált
 * alapértéke (SPEC-006 M-28), ezért mindhárom kötelező bemenet marad, alapérték
 * nélkül. A `mkdir: true` mindig rögzített, mert a napló könyvtár nem
 * feltétlenül létezik ("the logger will throw an error unless you set `mkdir`
 * to `true`").
 *
 * A `limit.removeOtherLogFiles` mindig `true` (user technikai döntés
 * 2026-10-26, SPEC-012 4.2, SPEC-006 9.2): enélkül a `limit.count` korlát csak
 * a jelenlegi folyamat fájljaira szól, és egy újraindítás után a korábbi
 * futások fájljai megmaradnának. Vele a darabszám a könyvtárra érvényes, mint
 * a `logrotate` `rotate` szabálya (forrás: a telepített `pino-roll` 4.0.0
 * `lib/utils.js` `removeOldFiles` függvénye és README `limit` szakasza,
 * `docs/research/2026-10-26-helyi-inditas-es-valodi-proba.md` 13.1 és 14.6).
 */
export interface LogRotationConfig {
  readonly logDirectory: string;
  readonly size: number | string;
  readonly frequency: number | string;
  readonly retainedFileCount: number;
  readonly dateFormat?: string;
}

export interface PinoRollTransportOptions {
  readonly file: string;
  readonly size: number | string;
  readonly frequency: number | string;
  readonly mkdir: true;
  readonly limit: { readonly count: number; readonly removeOtherLogFiles: true };
  readonly dateFormat?: string;
}

export function buildLogRotationOptions(config: LogRotationConfig): PinoRollTransportOptions {
  return {
    file: config.logDirectory,
    size: config.size,
    frequency: config.frequency,
    mkdir: true,
    limit: { count: config.retainedFileCount, removeOtherLogFiles: true },
    ...(config.dateFormat !== undefined && { dateFormat: config.dateFormat }),
  };
}
