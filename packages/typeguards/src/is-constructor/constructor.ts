/**
 * A bemásolt guardok négy fájlja (`is-constructor.ts`, `is-instanceof.ts`,
 * `is-numeric.ts`, `is-string-resolver.ts`) egy `@pct/ts-typing` nevű
 * csomagból importál típusokat. Ez a csomag nem létezik a monorepóban:
 * nincs bejegyezve a gyökér `package.json` semelyik mezőjében, nincs
 * `packages/*` workspace tagként, és a `bun.lock`-ban sincs nyoma - ezért a
 * típusellenőrzés `@pct/ts-typing`-re hivatkozva `TS2307: Cannot find
 * module` hibával elbukna. A hiányzó típusokat itt, helyben pótoljuk,
 * pontosan olyan alakban, amit a hivatkozó guardok és a specek elvárnak.
 *
 * A `NumericString` típus itt szándékosan HIÁNYZIK: az `is-numeric.ts`
 * eredetileg ezt importálta a `@pct/ts-typing`-ből is, de mivel nálunk ez
 * pusztán `string` alias lenne, a `sonarjs/redundant-type-aliases` szabály
 * elutasítja - ezért az `is-numeric.ts` közvetlenül `string`-et használ.
 *
 * A `StringResolver<T>` típus a saját témájába, az `is-string-resolver/
 * string-resolver.ts` fájlba került (SPEC-002 6.1 pont, T-002-23).
 */

/**
 * Osztály/konstruktor, ami `T` példányát hozza létre. Az `arguments_` típusa
 * szándékosan `never[]`, nem `unknown[]`: a beépített konstruktorok (pl.
 * `Set`, `RegExp`) konkrét paramétertípussal rendelkeznek, és egy `unknown[]`
 * rest paraméter kontravariáns ellenőrzése ezekre elbukna (`tsc --noEmit`-tel
 * ellenőrizve: "Types of parameters ... are incompatible"). A `never[]`
 * mindig kompatibilis, mert a `never` bármi másnak részhalmaza - ugyanezt a
 * mintát követi a bemásolt `is-function.ts` saját `(...arguments_: never[])
 * => unknown` visszatérési predikátuma is.
 */
export type Constructor<T> = new (...arguments_: never[]) => T;
