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
 * A skill könyvtár útvonala (SPEC-009 5.1, O-49, user döntés 2026-10-28) az
 * adatbázis és a napló `.data` könyvtára alatt áll, ugyanabban a mintában.
 *
 * A három skill korlát (SPEC-009 5.4 6. pont, O-34,
 * `docs/research/2026-10-26-spec-009-forrasok.md`): a kicsomagolt összméret
 * az Anthropic Skills API korlátja, decimális olvasatban (7.1); a törzs mérete
 * ebből levezetett (7.4); a bejegyzések száma a SEI CERT IDS04-J `TOOMANY`
 * értéke (7.2).
 *
 * A `uiOrigin` a felület engedett originje, ha az `EASTER_STREAM_DEV_ORIGIN`
 * nincs megadva (SPEC-017 5.3): a Vite dev szerver címe, ugyanaz a forrás,
 * mint a web `DEFAULT_FRONTEND_CONFIG.apiOrigin` értékéé (research 10.3, a
 * böngésző által küldött `Origin` mért értéke 14.6).
 */
export const DEFAULT_SERVER_CONFIG = {
  port: 3001,
  streamKeepAliveIntervalMs: 15_000,
  logDirectory: '.data/logs/server',
  logRotationSize: '10m',
  logRotationFrequency: 604_800_000,
  logRetainedFileCount: 4,
  skillLibraryDirectory: '.data/skills',
  skillMaxArchiveBytes: 30_000_000,
  skillMaxUnpackedBytes: 30_000_000,
  skillMaxEntryCount: 1024,
  uiOrigin: 'http://localhost:5173',
} as const;
