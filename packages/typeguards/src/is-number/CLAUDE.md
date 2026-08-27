# packages/typeguards/src/is-number

`isNumber(n?: unknown): n is number` - érvényes szám (egész vagy tört), a `../is-int` és a
`../is-float` guardok uniójaként (`isInt(n) || isFloat(n)`). Kizárja a `NaN`-t és a végtelent.

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
