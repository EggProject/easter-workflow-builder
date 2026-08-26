# packages/agent-tools/src/image

## Mi ez a mappa

A képértelmező eszköz bemenetének feloldása: data URL, HTTP cím vagy helyi fájl útvonal
átalakítása base64 data URL alakra, a formátum meghatározásával együtt. Ide **nem** tartozik
a MiniMax hívás és az MCP eszköz definíció.

## Fájlok

| Fájl                              | Tartalom                                                 |
| --------------------------------- | -------------------------------------------------------- |
| `image-media-type.ts`             | `ImageMediaType`, a három támogatott formátum            |
| `media-type-from-extension.ts`    | `mediaTypeFromExtension`                                 |
| `media-type-from-content-type.ts` | `mediaTypeFromContentType`                               |
| `read-file-function.ts`           | `ReadFileFunction`, a befecskendezhető fájlolvasó típusa |
| `resolve-image-data-url.ts`       | `resolveImageDataUrl`                                    |

Minden viselkedést hordozó fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

A `../http` és a `../result` rétegtől függ.

## Szabályok

**Ismeretlen formátum nem tippelhető el.** A referencia implementáció ismeretlen kiterjesztés
és ismeretlen `content-type` esetén JPEG-et feltételezett, ami néma hibához vezet: itt
ilyenkor hibaág keletkezik, ami megnevezi a támogatott formátumokat.

**A helyi fájl olvasás valódi fájlrendszer hozzáférés.** Az eszköz azt a fájlt olvassa be,
amit az agent megnevez, és a tartalmát elküldi a MiniMaxnak. Aki a lépéshez bekapcsolja ezt
az eszközt, ezt a hozzáférést is engedélyezi.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-agent-tools.md`](../../../../docs/research/2026-08-26-agent-tools.md)
