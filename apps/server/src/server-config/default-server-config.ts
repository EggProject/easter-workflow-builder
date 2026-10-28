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
 *
 * A három skill korlát (SPEC-009 5.4 6. pont, O-34,
 * `docs/research/2026-10-26-spec-009-forrasok.md`): a kicsomagolt összméret
 * az Anthropic Skills API korlátja, decimális olvasatban (7.1); a törzs mérete
 * ebből levezetett (7.4); a bejegyzések száma a SEI CERT IDS04-J `TOOMANY`
 * értéke (7.2).
 */
export const DEFAULT_SERVER_CONFIG = {
  port: 3001,
  streamKeepAliveIntervalMs: 15_000,
  logDirectory: '.data/logs/server',
  logRotationSize: '10m',
  logRotationFrequency: 604_800_000,
  logRetainedFileCount: 4,
  skillMaxArchiveBytes: 30_000_000,
  skillMaxUnpackedBytes: 30_000_000,
  skillMaxEntryCount: 1024,
} as const;
