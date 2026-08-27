# tooling/tsconfig

## Mi ez a mappa

Megosztott TypeScript alapkonfigurációk a teljes workspace-nek. Ide **nem** kerül
domain logika, csak `.json` konfiguráció és egy `src/index.ts` placeholder, hogy a
csomag a többi workspace taggal egységesen `tsc --noEmit`-elhető legyen.

## Fájlok

| Fájl           | Tartalom                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `base.json`    | minden csomag közös alapja, a TS 6.0 alapértelmezéstől eltérő opciók                                        |
| `node.json`    | Node 26 alatt futó csomagoknak (`apps/server`, `packages/*`, `tools/wire-probe`), `base.json` kiterjesztése |
| `react.json`   | `apps/web` és `packages/ui` React csomagoknak, `base.json` kiterjesztése                                    |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson                                                       |

## Függőségi irány

Csak fejlesztői eszköz, a workspace futásidejű csomagjai közül semelyiktől nem függ, réteg
nélküli "eszköz" csomag (SPEC-002 4. szekció). Bármelyik másik csomag hivatkozhat rá a saját
`tsconfig.json` `extends` mezőjéből, de futásidejű `dependencies` helyen sosem jelenhet meg,
csak `devDependencies`-ként.

## Szabályok

A `base.json` **nem ismétli meg** a TypeScript 6.0.3 alapértelmezéseit (`strict`,
`module`, `types`, `rootDir` stb.), csak az azoktól eltérő opciókat állítja. Eltávolított
vagy deprecated opció (`baseUrl`, `moduleResolution: node`, `target: es5` stb.) ide nem
kerülhet, és `"ignoreDeprecations"` kapcsolót sem használunk.

**Kivétel: `forceConsistentCasingInFileNames`.** Ez már a TS 6.0.3 alapértelmezése is
(forrás a `base.json`-ban), mégis explicit szerepel, mert egy valós CI hibát fedez fel
(`tools/wire-probe/src/cases` git index vs. import betűzés eltérés) - a szándék explicit
dokumentálása a cél, ne függjünk egy jövőbeli TS alapértelmezés-változástól.

A fogyasztó csomagok a saját `tsconfig.json`-jukban `"extends"` mezővel hivatkoznak
ide, relatív útvonallal (pl. `"../../tooling/tsconfig/node.json"`).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 6. szekció
- [`../../docs/plan/PLAN-001-monorepo-toolchain.md`](../../docs/plan/PLAN-001-monorepo-toolchain.md)
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. szekció (eszköz csomagok rétege)
