/**
 * A `VITE_API_ORIGIN` build időben rögzített értéke, amit a
 * `playwright.config.ts` `webServer.env` mezője állít be. EGYETLEN forrás,
 * amit mind a config, mind a mock segédfüggvények importálnak, hogy a kettő
 * sosem szakadhasson el egymástól.
 *
 * A port (4174) szándékosan KÜLÖNBÖZIK a Vite preview 4173-as portjától: a
 * legtöbb teszt ezen a címen semmit nem indít ténylegesen, a `page.route()`
 * teljesen kiváltja a hálózatot. A `sse-reconnect.spec.ts` az egyetlen
 * kivétel, ami egy valódi `node:http` szervert köt pontosan erre a portra
 * (`docs/research/2026-08-30-sse-mockolas-meres.md` 3. szekció 2. pontja).
 */
export const API_ORIGIN = 'http://localhost:4174';

/**
 * A `playwright.config.ts` `use.baseURL`-je és a `vite preview --port`
 * ugyanerre az értékre mutat. A `sse-reconnect.spec.ts` valódi teszt
 * szervere ezt írja az `Access-Control-Allow-Origin` fejlécbe (nem `*`),
 * mert az `EventSource` innen indul kereszt-origin kéréssel.
 */
export const PREVIEW_ORIGIN = 'http://localhost:4173';
