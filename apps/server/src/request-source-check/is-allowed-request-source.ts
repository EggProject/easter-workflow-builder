import type { IncomingHttpHeaders } from 'node:http';

/**
 * A `Sec-Fetch-Site` fejléc spec szerinti négy értéke
 * (https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-site-header). A
 * listán kívüli értéket a szerver figyelmen kívül hagyja, az OWASP CSRF
 * Cheat Sheet "Fetch Metadata headers" szakasza szerint ("servers should
 * ignore those headers").
 */
const SAME_SOURCE_FETCH_SITES = new Set(['same-origin', 'none']);
const FOREIGN_FETCH_SITES = new Set(['same-site', 'cross-site']);

/**
 * A kérés forrásának ellenőrzése, a CSRF ellen (SPEC-017 5.4). Sorrend:
 *
 * 1. Ha van `Origin`, pontosan az engedett origin kell legyen (egyszerű
 *    egyenlőség, a `null` és minden más elutasít; Filippo Valsorda,
 *    https://words.filippo.io/csrf/ 2. lépés, és az OWASP "Checking the
 *    Origin Header" szakasza).
 * 2. Ha nincs `Origin`, de a `Sec-Fetch-Site` ismert értékű: a `same-origin`
 *    és a `none` átmegy, a `same-site` és a `cross-site` elutasít. Két
 *    kimondott eltérés a Go `net/http` `CrossOriginProtection.Check`
 *    szabályától: a Go a `Sec-Fetch-Site` fejlécet az `Origin` előtt nézi
 *    (itt az `Origin` egyenlősége dönt először, ez szigorúbb), és minden
 *    ismeretlen értéket elutasít (itt az ismeretlen érték figyelmen kívül
 *    marad, az OWASP szerint; a `Sec-` előtagú fejlécet oldal nem állíthatja,
 *    tehát böngészőből ez nem kihasználható).
 * 3. Ha egyik sincs, de van `Referer`: az originje az engedett origin kell
 *    legyen (az OWASP "Checking the Referer Header if Origin Header Is Not
 *    Present" szakasza; a `Sec-Fetch-Site` nélküli, régi böngésző esete).
 * 4. Ha egyik fejléc sincs, a kérés nem böngészőből jön (a próba eszköz, a
 *    `curl`), és átmegy: CSRF böngészőn át történik, és a Fetch szabvány
 *    szerint a böngésző minden nem `GET`/`HEAD` kérésre `Origin` fejlécet
 *    küld (https://fetch.spec.whatwg.org/#origin-header; a Go
 *    `CrossOriginProtection` ugyanígy dönt, a forrás SPEC-017 3.).
 *
 * A Node HTTP elemzője az ismétlődő `Origin` vagy `Sec-Fetch-Site`
 * fejlécet `", "` elválasztóval egyetlen stringgé fűzi (a Node
 * `message.headers` dokumentációja), ami egyik engedett értékkel sem
 * egyezik; a `Referer` ismétlésénél az első példány marad.
 */
export function isAllowedRequestSource(headers: IncomingHttpHeaders, allowedOrigin: string): boolean {
  if (headers.origin !== undefined) {
    return headers.origin === allowedOrigin;
  }
  const fetchSite = headers['sec-fetch-site'] ?? '';
  if (SAME_SOURCE_FETCH_SITES.has(fetchSite)) {
    return true;
  }
  if (FOREIGN_FETCH_SITES.has(fetchSite)) {
    return false;
  }
  if (headers.referer !== undefined) {
    return URL.parse(headers.referer)?.origin === allowedOrigin;
  }
  return true;
}
