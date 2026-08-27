/**
 * String, vagy egy `T` kontextusból stringet előállító függvény. A típus
 * korábban a közös `types.ts` fájlban állt a `Constructor<T>` mellett; a
 * SPEC-002 6.1 pont téma konvenciója szerint ide, a saját témájához
 * (`is-string-resolver`) került (T-002-23). A `@pct/ts-typing` hiányzó
 * csomagról szóló háttértörténetet lásd az `is-constructor/constructor.ts`
 * fájlban.
 */
export type StringResolver<T> = string | ((context: T) => string);
