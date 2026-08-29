# packages/logger

## Mi ez a mappa

`pino` és `pino-roll` alapú naplózás, fájl rotációval és négyrétegű titok maszkolással
(SPEC-006 7. szekció). A `createServerLogger` mindig befecskendezett nyelőt fogad: a csomag
egyetlen tesztje sem hoz létre fájlt és nem indít worker szálat. A tényleges
`pino.transport({ target: 'pino-roll', ... })` hívás, ami worker szálat indít, az
`apps/server` `startup-sequence` témájában áll, nem itt.

## Fájlok

| Téma               | Mi kerül bele                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pino-logger`      | a `ServerLogger` felület (típus-only, `.spec.ts` nélkül) és a `createServerLogger` factory: befecskendezett nyelő, a `redact` opció bekötése, gyermek logger kontextussal (`.child`) |
| `secret-redaction` | a `redact` útvonal lista (`redact-paths.ts`, tiszta adat, `.spec.ts` nélkül - a `create-server-logger.spec.ts` gyakorolja) és az érték szintű törlő (`scrub-secret-values.ts`)       |
| `log-rotation`     | a `pino-roll` transport `options` mezőjét felépítő tiszta függvény (`buildLogRotationOptions`); nem hív `pino.transport()`-ot, nem indít worker szálat, nem hoz létre fájlt          |

## Függőségi irány

A `logger` a workspace csomagok közül semmitől nem függ, L0 réteg (SPEC-002 4. szekció). A
`dependencies` mezője pontosan `pino` (10.3.1) és `pino-roll` (4.0.0), a
`docs/research/2026-08-26-toolchain.md` fájlban rögzített verziókkal (M-30).

## Szabályok

- **Négyrétegű titok maszkolás** (SPEC-006 7.4, `.claude/CLAUDE.md` 9. szekció): (1) a `redact`
  opció mezőnév alapján, pino dokumentált `'[Redacted]'` alapértékkel, saját maszkoló sztring
  nélkül; (2) az érték szintű törlő (`scrubSecretValues`), ami a napló sorba kerülő SZÖVEGBEN
  cseréli az ismert titok értékeket, a lemezre írás előtt, memóriában; (3) a napló nem lát
  kérés/válasz törzset, SSE keret tartalmat és `run_event` payloadot (`apps/server` felelőssége);
  (4) a konfiguráció maga env változó **nevet** naplóz, értéket sosem (`apps/server` felelőssége).
  A `packages/logger` csak az (1) és (2) réteget valósítja meg.
- A `redact` útvonal lista (`REDACT_PATHS`) case sensitive pino path szintaxist használ
  (https://github.com/pinojs/pino/blob/main/docs/redaction.md#path-syntax): kötőjeles kulcshoz
  szögletes zárójel kell (`["x-api-key"]`), a `*` egy szintnyi wildcard.
- A `scrubSecretValues` `String.prototype.replaceAll` string argumentummal literális cserét
  végez, nem reguláris kifejezésként értelmezi a mintát, tehát a titok értékében szereplő
  speciális karaktert nem kell escape-elni.
- A `log-rotation` `size`, `frequency` és `retainedFileCount` (`limit.count`) mezője **kötelező
  bemenet, alapérték nélkül**: a `pino-roll` README egyikre sem ad dokumentált alapértéket
  (SPEC-006 M-28). A `dateFormat` opcionális. A `mkdir: true` rögzített, mert a napló könyvtár
  nem feltétlenül létezik.
- A `createServerLogger` `level` mezőjének elhagyása esetén a pino saját, dokumentált `'info'`
  alapértéke érvényesül (M-26) - a kódban nincs szint literál.
- A `ServerLogger` felület nem a nyers `pino.Logger`: a `trace` szintet a spec kimondottan nem
  használja, ezért nincs a felületen. A `createServerLogger` a valódi pino példányt adja vissza,
  típusban `ServerLogger`-re szűkítve - a log metódusok `this` kötése emiatt nem sérül.
- Az `IS_LOGGER_PLACEHOLDER` export megszűnt, a `src/index.ts` csak nevesített újraexportot ad.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-006-szerver-alkalmazas.md`](../../docs/spec/SPEC-006-szerver-alkalmazas.md), 7. és 9.2 szekció
- [`../../docs/research/2026-08-26-toolchain.md`](../../docs/research/2026-08-26-toolchain.md)
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
