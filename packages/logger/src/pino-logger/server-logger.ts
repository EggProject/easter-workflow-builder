import type { Logger } from 'pino';

/**
 * A szerver naplózó publikus felülete: a pino `Logger` azon szintjei, amiket
 * a SPEC-006 7.2 táblázata megnevez. A `trace` szintet a spec kimondottan
 * nem használja ("nincs olyan esemény, ami ennél részletesebb lenne"), ezért
 * nem kerül a felületre - a `createServerLogger` visszatérési típusa emiatt
 * szűkebb, mint a nyers `pino.Logger`.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts` (a csomag CLAUDE.md `## Fájlok`
 * táblázata jelöli).
 */
export interface ServerLogger {
  readonly fatal: Logger['fatal'];
  readonly error: Logger['error'];
  readonly warn: Logger['warn'];
  readonly info: Logger['info'];
  readonly debug: Logger['debug'];
  readonly child: (bindings: Readonly<Record<string, unknown>>) => ServerLogger;
}
