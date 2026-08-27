# packages/firecrawl-client

## Mi ez a mappa

Firecrawl HTTP kliens: konfiguráció feloldás, scrape hívás, a válasz szűkítése és markdownná
formázása. A `packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.11 szekció).
Ide **nem** tartozik az MCP eszköz definíció: a `web_fetch` eszköz a
`@easter-workflow-builder/tool-web-fetch` csomagban áll.

## Fájlok

| Mappa               | Felelősség                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `firecrawl-config/` | a beállítás feloldása: a konfiguráció típusa, a feloldó, a változónevek és az alapértelmezések |
| `scrape-call/`      | a hívás maga: a végpont útvonala és a `scrapePage`                                             |
| `scrape-document/`  | a visszakapott dokumentum értelmezése és markdownná formázása                                  |

A `firecrawl-config/firecrawl-config.ts` és a `scrape-document/firecrawl-document.ts`
típus-only fájl, nincs hozzájuk `.spec.ts` (SPEC-002 6.3 pont).

## A `scrapePage`, az egyetlen új logika a migrációban

Nem új viselkedés: a korábbi `create-web-fetch-tool.ts` fájlban álló `postJson` hívást
(URL összerakás a `PATH_SCRAPE` konstansból, `{ url, formats: ['markdown'] }` törzs,
`timeoutMs`) emeli át ide. Indok: egy kliens hív, nem csak válaszalakot értelmez. A szerződése
szándékosan azonos a `callMiniMax` szerződésével: `Promise<Outcome<unknown>>`, a nyers JSON
választ adja vissza, a szűkítést az `interpretScrapeResponse` végzi a hívó oldalon.

**Aszimmetria a MiniMax klienssel, szándékosan.** A Firecrawlnak egy végpontja van, ezért a
`PATH_SCRAPE` a `scrape-call` témán belül marad, a `scrapePage` saját használatára, és **nincs**
a barrelben (a `callMiniMax` ezzel szemben paraméterként kapja az útvonalat, mert két végpontot
szolgál ki, ezért a `PATH_SEARCH` és a `PATH_VLM` a `minimax-client` publikus felületén van).

## Függőségi irány

Az `@easter-workflow-builder/core` (HTTP réteg, környezeti változó olvasás, `Outcome`) és az
`@easter-workflow-builder/typeguards` csomagtól függ,
L2 réteg (SPEC-002 4. szekció). A barrel újraexportálja az `EnvironmentReader` és a
`FetchFunction` típust, mert megjelennek a `resolveFirecrawlConfig` és a `scrapePage` saját
publikus szignatúrájában (SPEC-002 6.6 pont 7. szabálya).

## Szabályok

**A `success: false` válasz a szolgáltatás saját hibája.** Ilyenkor a válasz `error` mezője megy
tovább az agentnek. A cím és a forráscím hiánya nem hiba, csak üres marad, a markdown tartalom
hiánya viszont igen: enélkül az eszköznek nincs mit visszaadnia.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.11 szekció
