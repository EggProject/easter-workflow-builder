# packages/typeguards/src/is-constructor

`isConstructor<T>(value?: unknown): value is Constructor<T>` - megkülönbözteti az ES6
osztály-konstruktort a sima függvényektől (a `Function.prototype.toString` reprezentáció
`class` kezdetét vizsgálja). A `Constructor<T>` típus a `../types.ts`-ből jön, nem a hiányzó
`@pct/ts-typing`-ből (lásd a szülő CLAUDE.md "A hiányzó `@pct/ts-typing` csomag" szakaszát).

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
