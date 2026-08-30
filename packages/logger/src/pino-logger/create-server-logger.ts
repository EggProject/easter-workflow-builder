import { pino } from 'pino';
import type { DestinationStream, LoggerOptions } from 'pino';
import { REDACT_PATHS } from '../secret-redaction/redact-paths.ts';
import { scrubSecretValues } from '../secret-redaction/scrub-secret-values.ts';
import type { ServerLogger } from './server-logger.ts';

/**
 * A `createServerLogger` bemenete. A `level` elhagyása esetén a pino saját,
 * dokumentált `'info'` alapértéke érvényesül (SPEC-006 7.2, M-26) - ezért a
 * kódban nincs szint literál. A `secretValues` a konfigurációból ismert,
 * titkot hordozó env változók ÉRTÉKE (SPEC-006 7.4 2. pont), nem a nevük.
 */
export interface CreateServerLoggerOptions {
  readonly level?: string;
  readonly secretValues: readonly string[];
}

// A nyelőt körbecsomagolja: minden kiírt sorban lecseréli az ismert titok
// ÉRTÉKEKET, mielőtt a hívó által adott, befecskendezett nyelőhöz érne. Ez a
// 7.4 2. pontja - a `redact` opció (redact-paths.ts) mezőnév alapján dolgozik,
// ez a réteg viszont a már szövegesített sorban keres, függetlenül attól,
// melyik mezőben vagy a szabad szövegben áll a titok.
function wrapSinkWithSecretScrubbing(sink: DestinationStream, secretValues: readonly string[]): DestinationStream {
  return {
    write(message: string): void {
      sink.write(scrubSecretValues(message, secretValues));
    },
  };
}

/**
 * Létrehozza a szerver pino logger példányát. A nyelő (`sink`) mindig
 * befecskendezett: a függvény sem fájlt nem hoz létre, sem worker szálat nem
 * indít (SPEC-006 9.2, AC31) - a fájl rotációval író `pino.transport()`
 * hívás az `apps/server` `startup-sequence` témájában áll.
 */
export function createServerLogger(options: CreateServerLoggerOptions, sink: DestinationStream): ServerLogger {
  const loggerOptions: LoggerOptions = {
    redact: [...REDACT_PATHS],
    ...(options.level !== undefined && { level: options.level }),
  };

  return pino(loggerOptions, wrapSinkWithSecretScrubbing(sink, options.secretValues));
}
