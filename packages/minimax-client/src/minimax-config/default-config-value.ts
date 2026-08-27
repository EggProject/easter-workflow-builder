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
