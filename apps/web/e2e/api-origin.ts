/**
 * A `VITE_API_ORIGIN` build időben rögzített értéke, amit a
 * `playwright.config.ts` `webServer.env` mezője állít be. EGYETLEN forrás,
 * amit mind a config, mind a REST mock segédfüggvények importálnak, hogy a
 * kettő sosem szakadhasson el egymástól.
 *
 * A port (4174) szándékosan KÜLÖNBÖZIK a Vite preview 4173-as portjától: a
 * legtöbb teszt ezen a címen semmit nem indít ténylegesen, a `page.route()`
 * teljesen kiváltja a hálózatot.
 */
export const API_ORIGIN = 'http://localhost:4174';

/**
 * A `VITE_STREAM_ORIGIN` build időben rögzített értéke (SPEC-008 3.3: a REST
 * és az SSE csatorna a fejlesztői proxy döntés után két külön origin mezőt
 * kap). Az e2e felállásban SZÁNDÉKOSAN ugyanaz az érték, mint az
 * `API_ORIGIN`: a `page.route()` mindkét csatornát ugyanazon az originen
 * fogja el, és a `sse-reconnect.spec.ts` (illetve `sse-real-server.spec.ts`)
 * egyetlen kivétele is erre a portra köt egy valódi `node:http` szervert
 * (`docs/research/2026-08-30-sse-mockolas-meres.md` 3. szekció 2. pontja).
 * A két konstans külön deklarációja azért kell, hogy a REST és az SSE mock
 * segédfüggvények a saját, szemantikailag helyes nevükön importálják az
 * origint, nem pedig azért, mert az e2e alatt ténylegesen eltérő portra
 * lenne szükség.
 */
export const STREAM_ORIGIN = API_ORIGIN;

/**
 * A `playwright.config.ts` `use.baseURL`-je és a `vite preview --port`
 * ugyanerre az értékre mutat. A `sse-reconnect.spec.ts` valódi teszt
 * szervere ezt írja az `Access-Control-Allow-Origin` fejlécbe (nem `*`),
 * mert az `EventSource` innen indul kereszt-origin kéréssel.
 */
export const PREVIEW_ORIGIN = 'http://localhost:4173';
