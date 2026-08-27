# packages/typeguards/src/is-function

Két guard, mert a felhasználó bemásolt kódja két külön fájlként hozta őket:

- `isFunction<T>(object: T): object is Extract<T, (...arguments_: never[]) => unknown>` -
  `typeof object === 'function'`, a visszatérési típus a bemenet unióján szűkít.
- `isFunctionReturnAny(object?: unknown): object is (...arguments_: any) => any` - ugyanaz a
  futásidejű ellenőrzés, de a visszatérési típus explicit `any` (lásd a fájlban az
  `eslint-disable` indoklását).

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
