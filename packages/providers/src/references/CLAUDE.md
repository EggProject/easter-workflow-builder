# packages/providers/src/references

## Mi ez a mappa

A leírókban hivatkozott bizonyítékok feloldó rétege: nevesített doksi URL-ek, nevesített
research szekció azonosítók, és a mérési azonosító -> docs horgony leképezés. Ez teszi
lehetővé, hogy a `minimax` és a `claude-subscription` leírókban sehol ne legyen próza: az
`evidence` mező csak stabil azonosítót hordoz, a feloldást innen kapja a fogyasztó (UI,
jelentés).

## Fájlok

| Fájl                      | Tartalom                                     |
| ------------------------- | -------------------------------------------- |
| `document-url.ts`         | nevesített hivatalos doksi URL-ek            |
| `research-section.ts`     | nevesített research szekció azonosítók       |
| `measurement-document.ts` | `MeasurementId` -> `docs/` horgony leképezés |

## Függőségi irány

A `measurement-document.ts` a `../evidence/measurement-id.ts`-től függ. A másik két fájl semmitől.

## Szabályok

Ez az egyetlen hely, ahol a mérési azonosítóhoz tartozó `docs/` fájl és fejléc szerepel. A
mérés tartalmát (mit mértünk, mi jött ki) ide **nem** szabad átmásolni, csak a hivatkozást.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md)
- [`../../../../docs/research/2026-08-26-spec000-kiertekeles.md`](../../../../docs/research/2026-08-26-spec000-kiertekeles.md)
