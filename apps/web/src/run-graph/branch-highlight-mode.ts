/**
 * A futás nézet ág kiemelésének két módja (SPEC-008 6.6, 3. döntés):
 * `latest` a "csak a legutóbbi választás" (csomópontonként a legnagyobb `id`-jű
 * döntés élei), `all` a "minden eddig bejárt ág" (minden döntés éle). Az
 * alapértelmezés a `latest`; a kapcsoló és a tárolása nem e téma adat
 * rétegének része (PLAN-009 T-009-39).
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció): futásidejű kód nélkül.
 */
export type BranchHighlightMode = 'latest' | 'all';
