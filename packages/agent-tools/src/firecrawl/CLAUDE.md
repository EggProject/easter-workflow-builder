# packages/agent-tools/src/firecrawl

## Mi ez a mappa

A Firecrawl scrape végpont drótszintű alakja: útvonal, válasz értelmezés és a kimenet
formázása. Ide **nem** tartozik környezeti változó olvasás és MCP eszköz definíció.

## Fájlok

| Fájl                           | Tartalom                                              |
| ------------------------------ | ----------------------------------------------------- |
| `endpoint-path.ts`             | `PATH_SCRAPE`                                         |
| `firecrawl-document.ts`        | `FirecrawlDocument`                                   |
| `interpret-scrape-response.ts` | `interpretScrapeResponse`, validáció és mezőkiolvasás |
| `format-firecrawl-document.ts` | `formatFirecrawlDocument`                             |

Minden viselkedést hordozó fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

A `../result` rétegtől és a `typeguards` csomagtól függ.

## Szabályok

**Nincs API kulcs.** A felhasználó saját Firecrawl példánya hitelesítés nélkül szolgál ki, a
cím pedig környezeti változóból jön, nem a kódból.

**A `v1` és a `v2` séma nem cserélhető fel.** A `v1` `formats` mezője szövegtömb, a `v2`-ben
objektum elemek is lehetnek benne, ezért a végpont verzióváltása külön döntés és mérés
kérdése, nem egyszerű útvonalcsere.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-agent-tools.md`](../../../../docs/research/2026-08-26-agent-tools.md)
