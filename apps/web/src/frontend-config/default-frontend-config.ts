import type { FrontendConfig } from './frontend-config.ts';

/**
 * A felület konfigurációs env változóinak alapértékei (SPEC-012 4.2, user
 * döntés 2026-10-26): az olvasó (`readFrontendConfig`) az env változó
 * hiányában (nincs beállítva, vagy üres) ezeket használja; megadott, de
 * érvénytelen értékre hibaág jön, nem csendes visszaesés. Ez az EGYETLEN
 * fájl az `apps/web/src` alatt, ahol origin literál állhat (a
 * `greppable-invariants` (8) kivétele); a `vite.config.ts` a proxy célját
 * innen veszi, így a literál nem duplázódik.
 *
 * Forrás értékenként (`docs/research/2026-10-26-helyi-inditas-es-valodi-proba.md`):
 * `apiOrigin` 10.3 (Vite `server.host` `localhost`, `server.port` `5173`, a
 * böngésző által küldött `Origin` mért értéke 14.6); `streamOrigin` 10.2 és
 * 10.4 (a szerver `127.0.0.1` bind címe és a `3001` port); `listLimit` 13.2;
 * `streamReplayLimit` 13.3 (lapméret, nem plafon).
 */
export const DEFAULT_FRONTEND_CONFIG = {
  apiOrigin: 'http://localhost:5173',
  streamOrigin: 'http://127.0.0.1:3001',
  listLimit: 100,
  streamReplayLimit: 100,
} as const satisfies FrontendConfig;
