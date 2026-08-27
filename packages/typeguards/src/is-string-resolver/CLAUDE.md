# packages/typeguards/src/is-string-resolver

`isStringResolver<T>(value?: unknown): value is StringResolver<T>` - string, vagy egy nem
konstruktor függvény, ami stringet ad vissza (`isString(value) || (isFunction(value) &&
!isConstructor(value))`). A `StringResolver<T>` típus a `../types.ts`-ből jön, nem a hiányzó
`@pct/ts-typing`-ből (lásd a szülő CLAUDE.md "A hiányzó `@pct/ts-typing` csomag" szakaszát).

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
