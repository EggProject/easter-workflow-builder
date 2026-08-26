# packages/agent-tools/src/http

## Mi ez a mappa

A csomag HTTP rétege a beépített `fetch` fölött. Ide **nem** tartozik semmilyen
szolgáltatás specifikus tudás: sem MiniMax, sem Firecrawl séma, sem hibakód értelmezés.

## Fájlok

| Fájl                | Tartalom                                             |
| ------------------- | ---------------------------------------------------- |
| `fetch-function.ts` | `FetchFunction`, a befecskendezhető `fetch` típusa   |
| `describe-error.ts` | `describeError`, ismeretlen hiba egymondatos leírása |
| `post-json.ts`      | `PostJsonRequest` és `postJson`                      |
| `binary-payload.ts` | `BinaryPayload`                                      |
| `get-binary.ts`     | `getBinary`                                          |

Minden fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

Csak a `../result` rétegtől függ. Nincs `axios` és nincs más HTTP kliens csomag: a Node 26
beépített `fetch` implementációját használjuk.

## Szabályok

**Nincs újrapróbálkozás.** A referencia implementáció három próbálkozást és lineáris
várakozást használt, de erre nincs dokumentált MiniMax vagy Firecrawl szabály, tippelni
pedig tilos. Az eszköz a hibát visszaadja az agentnek, aki dönthet az ismétlésről.

**A megszakítás `AbortSignal.timeout` jelzéssel történik**, az érték a hívó
konfigurációjából jön, nem itt van beégetve.

## Kapcsolódó dokumentumok

- [`../config/CLAUDE.md`](../config/CLAUDE.md): a timeout értékek forrása
