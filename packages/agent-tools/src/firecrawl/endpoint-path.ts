/**
 * A használt Firecrawl útvonal. A csomag szándékosan a `v1` alakot hívja, mert
 * a felhasználó helyi példánya ezt szolgálja ki, és a `v1` sémában a `formats`
 * mező egyszerű szövegtömb. A Firecrawl `v2` API-jában a `formats` elemei
 * objektumok is lehetnek, ezért a váltás nem elírás kérdése, hanem külön
 * döntésé.
 */
export const PATH_SCRAPE = '/v1/scrape';
