/**
 * A szerver konfigurációs env változóinak alapértékei (SPEC-012 4.2, user
 * döntés 2026-10-26): az olvasó (`readServerConfig`) az env változó hiányában
 * (nincs beállítva, vagy üres) ezeket használja; megadott, de érvénytelen
 * értékre hibaág jön, nem csendes visszaesés.
 *
 * Forrás értékenként (`docs/research/2026-10-26-helyi-inditas-es-valodi-proba.md`):
 * `port` user termékdöntés; `streamKeepAliveIntervalMs` 10.1; a négy napló
 * érték 13.1 (a `logDirectory` user döntés, fájl útvonal előtag, 2. szekció).
 * `logRotationFrequency` ezredmásodperc (7 nap), mert a `pino-roll` 4.0.0 a
 * `weekly` nevet nem ismeri.
 */
export const DEFAULT_SERVER_CONFIG = {
  port: 3001,
  streamKeepAliveIntervalMs: 15_000,
  logDirectory: '.data/logs/server',
  logRotationSize: '10m',
  logRotationFrequency: 604_800_000,
  logRetainedFileCount: 4,
} as const;
