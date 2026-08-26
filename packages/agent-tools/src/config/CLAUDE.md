# packages/agent-tools/src/config

## Mi ez a mappa

Környezeti változó olvasás és a három eszköz futásidejű konfigurációjának feloldása. Ide
**nem** tartozik hálózati hívás, séma validáció és formázás.

## Fájlok

| Fájl                           | Tartalom                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| `environment-reader.ts`        | `EnvironmentReader`, a `process.env` csak olvasható alakja |
| `environment-variable-name.ts` | a hat használt környezeti változó neve                     |
| `default-config-value.ts`      | az alapértelmezések, mindegyik mellett az indok            |
| `minimax-config.ts`            | `MiniMaxConfig`                                            |
| `firecrawl-config.ts`          | `FirecrawlConfig`                                          |
| `read-timeout-ms.ts`           | `readTimeoutMs`                                            |
| `read-base-url.ts`             | `readBaseUrl`                                              |
| `resolve-minimax-config.ts`    | `resolveMiniMaxConfig`                                     |
| `resolve-firecrawl-config.ts`  | `resolveFirecrawlConfig`                                   |

Minden fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

Csak a `../result` rétegtől függ.

## Szabályok

**Nincs `dotenv`.** A repóban a `.env` betöltése a futtató környezet dolga, a kód a
`process.env` értéket kapja meg paraméterként, ahogy a `tools/wire-probe` is teszi.

**Nincs forrás nélküli szám.** Minden alapértelmezés mellett a JSDoc megmondja, hogy
dokumentált érték-e vagy önkényes. Az önkényes érték kötelezően felülírható környezeti
változóval.

**Hiányzó konfiguráció nem kivétel.** A feloldó függvények `Outcome` hibaágat adnak, amiből
az eszköz az agentnek szóló hibaüzenetet készít.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../../../docs/research/2026-08-26-agent-sdk-minimax.md), 2. szekció
