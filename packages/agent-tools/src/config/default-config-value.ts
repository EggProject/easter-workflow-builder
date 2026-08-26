/**
Alapértelmezések a környezeti változókhoz, mindegyik mögött megnevezett indok.
*/

/**

 * A MiniMax nemzetközi endpont alapcíme, a research fájl 2. szekciója szerint.

 */
export const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io';

/**
 * ÖNKÉNYES ÉRTÉK. A MiniMax dokumentációja egyetlen konkrét timeout számot sem
 * ad a kereső és a képértelmező végpontra, csak annyit, hogy a keresés miatt a
 * kérés hosszabb lehet és a klienst ennek megfelelően kell beállítani. Nincs
 * tehát dokumentált alapunk, ezért ez az érték nem tekinthető ajánlásnak: a
 * `MINIMAX_TIMEOUT_MS` környezeti változóval felülírható.
 */
export const DEFAULT_MINIMAX_TIMEOUT_MS = 60_000;

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
