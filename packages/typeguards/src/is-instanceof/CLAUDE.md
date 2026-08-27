# packages/typeguards/src/is-instanceof

`isInstanceof<T>(object: unknown, type: Constructor<T>): object is T` - típusbiztos wrapper az
`instanceof` operátor köré. A `Constructor<T>` típus a `../types.ts`-ből jön, nem a hiányzó
`@pct/ts-typing`-ből (lásd a szülő CLAUDE.md "A hiányzó `@pct/ts-typing` csomag" szakaszát).

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
