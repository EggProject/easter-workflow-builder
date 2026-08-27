/**
Alapértelmezések a környezeti változókhoz, mindegyik mögött megnevezett indok.
*/

/**
 * A felhasználó helyi Firecrawl példányának címe. Ez a jelenlegi telepítés
 * címe, nem a Firecrawl dokumentált alapértelmezése, ezért a
 * `FIRECRAWL_BASE_URL` környezeti változóval felülírható.
 */
export const DEFAULT_FIRECRAWL_BASE_URL = 'http://localhost:3222';

/**
 * DOKUMENTÁLT ÉRTÉK, nem tippelés. A Firecrawl scrape kérés `timeout` mezőjének
 * dokumentált alapértelmezése 60000 ezredmásodperc (minimum 1000, maximum
 * 300000), tehát a szolgáltatás ennyi után maga is feladja. A kliens oldali
 * megszakítás ezért ugyanennyi: rövidebbnek nincs értelme, hosszabb pedig
 * olyan válaszra várna, ami már nem érkezhet meg.
 * Forrás: https://docs.firecrawl.dev/api-reference/endpoint/scrape
 */
export const DEFAULT_FIRECRAWL_TIMEOUT_MS = 60_000;
