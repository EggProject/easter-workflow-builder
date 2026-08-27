# packages/typeguards/src/is-numeric

`isNumeric(object?: unknown): object is string` - számmá alakítható string (kizárva a hex/
bin/oct jelölést). Eredetileg `NumericString` visszatérési típussal a `@pct/ts-typing`-ből,
nálunk közvetlenül `string` (lásd a szülő CLAUDE.md "A hiányzó `@pct/ts-typing` csomag"
szakaszát - a `sonarjs/redundant-type-aliases` miatt nincs helyi `NumericString` alias).

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
