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
  readonly limit: { readonly count: number };
  readonly dateFormat?: string;
}

export function buildLogRotationOptions(config: LogRotationConfig): PinoRollTransportOptions {
  return {
    file: config.logDirectory,
    size: config.size,
    frequency: config.frequency,
    mkdir: true,
    limit: { count: config.retainedFileCount },
    ...(config.dateFormat !== undefined && { dateFormat: config.dateFormat }),
  };
}
