# packages/ui

## Mi ez a mappa

Az eggproject-design alapú komponenskönyvtár. **Jelenleg üres váz**, csak egy placeholder
export van benne, hogy a csomag lefordulhasson. A tényleges komponensek egy későbbi
specifikáció tárgyai, a `tooling/tsconfig/react.json`-t használja (JSX runtime).

## Fájlok

| Fájl               | Tartalom                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `src/index.ts`     | placeholder export, csak hogy a csomag lefordulhasson              |
| `vitest.config.ts` | Vitest projekt config, `happy-dom` környezet (SPEC-001 9. szekció) |

## Függőségi irány

Az `ui` a `core` és a `protocol` csomagtól függ, L2 réteg (SPEC-002 4. szekció: "a ... `ui` L2,
mert a `protocol`, a `core` és a `logger` fölött áll").

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_UI_PLACEHOLDER` konstansát törölni kell.
A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-002
hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
