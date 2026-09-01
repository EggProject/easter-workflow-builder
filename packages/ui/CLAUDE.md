# packages/ui

## Mi ez a mappa

Az `eggproject-design` design system átemelt, TypeScript plusz TSX alakú komponenskönyvtára
(SPEC-007). Domain mentes: egyetlen komponense sem ismer workflow-t, futást, eseményt vagy
providert. A tokenek, a self-hosted fontok, a topnav shell és a téma mód mellett csak azok a
komponensek kerülnek át, amiket az `apps/web` ténylegesen használ.

## Fájlok

| Téma               | Tartalom                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `design-token`     | a token barrel (`colors-and-type.css`) és 11 token CSS fájl, bájtra azonosan az `eggproject-design` skillből átemelve (SPEC-007 4.2), plusz a bájtazonosságot őrző regressziós teszt |
| `self-hosted-font` | a `fonts.css` és 20 `.woff2` fájl (Roboto + JetBrains Mono, latin plusz latin-ext), bájtra azonosan átemelve, plusz a bájtazonosságot őrző regressziós teszt                         |
| `topnav-shell`     | a `topnav-shell.css` (az átemelt `.app-pagehead`/`.app-content`/`.app-tn` blokk plusz a "faltól falig" override), az `AppShellFrame` domain mentes React komponens és mindkét spec   |

A további témák (`theme-mode`, és a 12 komponens téma) a SPEC-007 12.1 szekciója szerint épülnek
fel, F1 és F2 fázisban.

## Függőségi irány

Az `ui` L2 réteg (SPEC-002 4. szekció). A `dependencies` mezője **nem tartalmaz workspace
csomagot**: a `core` és a `protocol` bejegyzés törölve, mert a csomag domain mentes, egyetlen
fájlja sem importálja őket (SPEC-007 3.1). A `react`, a `react-dom` és a `@tanstack/react-table`
külső csomagokra épül, mindhárom a gyökér `package.json` `catalog` mezőjéből.

## Szabályok

A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi (SPEC-002 6. szekció): egy
szint mély, tárgykör mappa nélkül. Az átemelt CSS fájlok bájtra azonosak a forrással (a
`design-token` barrel `@import` útvonalai az egyetlen kivétel); a bájtazonosságot a forrásból
egyszer kiszámított SHA-256 lenyomatokhoz hasonlító regressziós teszt őrzi, mert a forrás skill
könyvtár futásidőben (CI-ben, más gépen) nem érhető el (SPEC-007 4.2). Licencállítás egyik
fájlban sincs (SPEC-007 4.4, M-34); a származást a `fonts.css` már ma meglévő fejléce nevezi
meg, a `design-token` és a `topnav-shell` provenienciáját ez a `CLAUDE.md` és a
`docs/research/2026-09-01-spec007-f0-meresek.md` dokumentálja. A `.prettierignore` kizárja a
`design-token` és a `self-hosted-font` mappát, plusz a `topnav-shell.css` és a komponens CSS
fájlokat, fájlonként (SPEC-007 4.5).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-007-frontend-alkalmazas.md`](../../docs/spec/SPEC-007-frontend-alkalmazas.md)
- [`../../docs/plan/PLAN-008-frontend-alkalmazas.md`](../../docs/plan/PLAN-008-frontend-alkalmazas.md)
- [`../../docs/research/2026-09-01-spec007-f0-meresek.md`](../../docs/research/2026-09-01-spec007-f0-meresek.md)
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
