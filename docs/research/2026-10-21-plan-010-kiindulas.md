# PLAN-010 kiinduló állapot (T-010-1, 2026-10-21)

Branch: `feat/spec-010-sablon-es-kifejezes`, fej `69bf35c` (= origin/main), tiszta munkafa.

## Kilenc kapu

Mind a kilenc kapu zöld (`format:check`, `typecheck`, `lint`, `test`, `build`, `docs:check`,
`check:casing`, `check:graph`, `check:db-drift`), `bun install --frozen-lockfile` után.

## E2e kiindulás: fa azonosság, nem újrafuttatás

Az e2e-t nem futtattuk újra. A `69bf35c` fája bájtra azonos a `97b3d0081cae3ff9b0ceed938fa9152bdd2b6f31`
fejjel (`git diff --quiet 97b3d00 69bf35c` üres; `git rev-parse 97b3d00^{tree} 69bf35c^{tree}`
mindkettő `510e368ac8f6e39dd3590bf7463fe4d5b32d89dc`), amin a PR #54 merge kapuja 2026-10-21-én
lefutott.

Kiinduló e2e értékek (`docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 52. szekció):

- 8 shard, 645 teszt zöld, `coverage:e2e:report` kilépési kód 0
- mért lefedettség: 99.35 / 98.92 / 99.73 / 99.32
- fedetlen darab: 14 / 11 / 2 / 14

## Függőség pinek

Az élő `latest` ellenőrzés a `docs/research/2026-08-26-toolchain.md` végén áll: nem mozdult.
