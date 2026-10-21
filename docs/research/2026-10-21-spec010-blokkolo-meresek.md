# PLAN-010 F0: a három blokkoló mérés (T-010-2, T-010-3, T-010-4)

|               |                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum         | 2026-10-21                                                                                                                                                                                   |
| Terv          | [`../plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../plan/PLAN-010-sablon-es-kifejezes-nyelv.md) T-010-2, T-010-3, T-010-4                                                                   |
| Spec          | [`../spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../spec/SPEC-010-sablon-es-kifejezes-nyelv.md), [`../spec/SPEC-004-vegrehajto-motor.md`](../spec/SPEC-004-vegrehajto-motor.md)             |
| Mérő eszközök | [`2026-10-21-spec010-blokkolo-meresek/`](2026-10-21-spec010-blokkolo-meresek/): a mérő scriptek és a nyers kimenetek, mappánként egy mérés (`t010-2-cel`, `t010-3-mustache`, `t010-4-motor`) |
| Döntések      | a 5. szekció: a user 2026-10-21-i döntései és az átvezetésük helye                                                                                                                           |

A három mérés eldobható, repón kívüli munkakönyvtárban futott a pinelt verziókkal; a repó `bun.lock` fájlja és munkakönyvtára nem változott. A mérő scripteket és a nyers kimeneteket a `.claude/CLAUDE.md` 12. szekciója ("a számokat előállító mérő eszköz is a repóba tartozik") szerint verziókövetjük. Minden szám, ami a mondatban nincs forrásolva, a mérés nyers kimenetéből jön; a hivatkozott fájl a mondat mellett áll.

## 1. Közös felállás

- **Gép.** Linux `aarch64`, `nproc` 4 mag (`lscpu`: gyártó Apple), 3,8 GiB memória, Node `v26.7.0`, egyetlen szál, más terhelés nélkül. A gépet a T-010-2 jelentése rögzítette (`out-8.txt`, `### gép`); a T-010-3 és a T-010-4 jelentése külön nem rögzítette. A research írásakor ugyanebben a sandboxban lekérdezve azonos a gép (`uname -m`, `nproc`, `lscpu`, `free`, `node -v`). **Nem ellenőrzött**, hogy a három mérés ugyanazon a példányon futott; a munkamenet azonossága az egyetlen alap.
- **Csomagok, pinelt verzióval, repón kívüli telepítésből** (`bun init -y`, majd `bun add <csomag>@<verzió> --exact`):
  - `@marcbachmann/cel-js@8.0.0`, a `bun.lock` integritása `sha512-oaTrAziGr3zDLFiMt/yLU3nZuRMawyWQB5X1a0I7s9eGy3JYzX9l8ZXXHyMd64nzbeVFZTewuUShwsZQdK6UCA==`; a telepített `package.json` `version` mezője `8.0.0`. Egyezik a `2026-08-26-toolchain.md` soraival.
  - `mustache@4.2.0` és `@types/mustache@4.2.6` (ugyanott). A Node `import Mustache from 'mustache'` a csomag `exports.import` mezője szerint a `mustache.mjs` fájlt tölti be, ezért a lent megadott forráshely mind ennek a fájlnak a sora. Lenyomat: `mustache.mjs` sha256 `0f6041f0...c0ac61f2`, `mustache.js` sha256 `a80aca79...af590b90`. Bun `1.4.0`.
  - A mérő mappák `package.json`, `bun.lock`, `tsconfig.json`, `index.ts` fájljai (a `bun init` termékei) **nem kerülnek a repóba**: a `bun run docs:check` a `git ls-files '*/package.json'` alapján minden `package.json` mellé `CLAUDE.md`-t követelne, a többi fájl nem mérő eszköz.
- **A forráshelyek.** A mérő jelentése adta őket; a research írásakor a telepített fájlban újra elolvastam és egyeznek: `lib/index.d.ts` 338, 555, 575, 594; `lib/parser.js` 678, 778, 802; `lib/operators.js` 44 ... 56, 345 ... 353, 471 ... 476, 491, 509; `lib/registry.js` 197, 252, 1384; `lib/evaluator.js` 74 ... 116, 158; `lib/functions.js` 6, 53, 438 ... 439; `lib/globals.js` 1; `lib/options.js` 3 ... 9; `lib/errors.js`; `mustache.mjs` 39 ... 45, 60 ... 75, 141, 211, 246, 375 ... 394, 468 ... 472, 481 ... 493, 509 ... 520, 548 ... 551, 575 ... 580, 586 ... 589, 640, 655 ... 668, 711 ... 713, 757. A motor forráshelyei a `69bf35c` fa sorai; a `a964bb9` (a T-010-1 commit) a `packages/engine` alatt nem módosít, a hivatkozott sorokat ott is újraolvastam.
- **A scriptek formázása.** A repóban a `bun run format:check` kapu a `.mjs` fájlokat is ellenőrzi, ezért a másolatokat Prettier formázta (`prettier --write`); szemantikájuk nem változott. Ellenőrzés: a formázott scriptek újrafuttatva a CEL mérés (1) ... (7) pontjára, az `m2b`, `m4b`, `m7b`, `m7c`, `m7d` scriptre és a Mustache `p1` ... `p7`, `p8b` scriptre bájtra azonos kimenetet adtak a mellékelt `out-*.txt` és `out/*.txt` fájlokkal; a `p8` kimenetében kizárólag a verem sorszámai (`lib.mjs:160:40`, `p8-run.mjs:44:13`) tértek el, a formázás miatt. A (8) futásidők nem futottak újra (időmérés, nem determinisztikus).
- **A `cel-probe.mjs` abszolút importja.** A `t010-4-motor/cel-probe.mjs` a T-010-2 repón kívüli telepítéséből importál (`/sessions/.../t010-2/node_modules/...`), hogy semmi ne települjön újra. Máshol futtatva az importot a saját telepítésre kell igazítani.
- **Titok, kulcs, env érték nincs** a scriptekben és a kimenetekben (keresve: `api key`, `password`, `MINIMAX`, `ANTHROPIC`, `sk-`; a `SECRET_LITERAL`, `TITKOS-...` szövegek jelölő karakterláncok, nem értékek). **Képet egyik script sem ír.**

## 2. T-010-2: a CEL (`@marcbachmann/cel-js@8.0.0`)

Mérő eszköz: `2026-10-21-spec010-blokkolo-meresek/t010-2-cel/`. Futtatás: `node meres.mjs <pont>` (`1 2 3 4 4b 5 6 7 8`), plusz a kiegészítő scriptek: `m2b.mjs` -> `out-2b.txt`, `m4b.mjs` -> `out-4c.txt`, `m7b.mjs` -> `out-7b.txt`, `m7c.mjs` -> `out-7c.txt`, `m7d.mjs` -> `out-7d.txt`.

**Környezet** (SPEC-010 7.1): `new Environment()` opció nélkül, a hét név (`input`, `steps`, `item`, `itemIndex`, `iteration`, `joinInputs`, `error`) `registerVariable(név, 'dyn')`, saját függvény, operátor, típus nincs, a `limits` nincs felülírva (alapértékek: `lib/options.js` 3 ... 9 és 26 ... 31: `unlistedVariablesAreDyn: false`, `homogeneousAggregateLiterals: true`, `enableOptionalTypes: false`). **`compile`** (7.2): `env.parse(kif)`, majd `env.check(kif)` (`lib/index.d.ts` 555, 575; a `check` a parse hibát is `{ valid: false, error }` alakban adja, `lib/evaluator.js` 74 ... 80). **`evaluate`**: `env.evaluate(kif, kontextus)` (`lib/evaluator.js` 105 ... 107). **Valós alakú `RunContext`**: a `packages/engine/src/run-context/run-context.ts` hét mezője, a `buildRunContext` kimenetének alakjában (`input` JSON adat, `steps` node azonosító -> kimenet kötőjeles és ékezetes kulccsal is, a hatókörön kívüli mezők `undefined`, `iteration: 2`). **A 7.3 leképezés a mérésben** (`toCelContext`):

```js
function toCelContext(ctx) {
  const out = {};
  for (const name of RUN_CONTEXT_VARIABLE_NAMES) {
    const v = ctx[name];
    if (v === undefined) out[name] = null;
    else if ((name === 'itemIndex' || name === 'iteration') && Number.isInteger(v)) out[name] = BigInt(v);
    else out[name] = v;
  }
  return out;
}
```

| Pont | Ítélet                     | Röviden                                                                                                                                                            |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (1)  | egyezik                    | `string`, `Array`, `boolean`, `boolean`; mind szinkron (nem `Promise`)                                                                                             |
| (2)  | egyezik, egy pontosítással | a `maxDepth` nem általános AST mélység: az unáris és a bal asszociatív bináris láncra nem hat; a nem deklarált változót az `env.check` adja, nem a `parse`         |
| (3)  | egyezik                    | mindhárom sor a leírt módon; a `compile` az `input.darab + 1` alakot elfogadja                                                                                     |
| (4)  | eltér                      | a nem string kulcsú map literál sima objektum lesz, string kulcsokkal, ütközésnél csendes adatvesztéssel                                                           |
| (4b) | eltér                      | a `summary` nem a teljes szöveget, de azonosítót, kulcsnevet és index string literált idéz a kifejezésből                                                          |
| (5)  | egyezik                    | hiányzó kulcs `no_such_key`, a `has()` védett alak nem hiba                                                                                                        |
| (6)  | egyezik, egy pontosítással | `steps["kötőjeles-azonosító"].mezo` működik; az index utáni mezőnév is csak ASCII azonosító lehet                                                                  |
| (7)  | eltér                      | CEL-ből prototípus kulcs nem érhető el; de a saját `constructor` kulcsú adat kiértékelhetetlen (`unsupported_type`), és a map literál három kulcsot csendben eldob |
| (8)  | feljegyezve, küszöb nélkül | kétszintű beágyazott makró 3000 elemen 0,74 ... 1,6 s szinkron blokkolás                                                                                           |

### (1) A 7.5 három (négy) példa kifejezése

Kód: `points[1]` (`meres.mjs`): a négy példa (`branch`, `fan_out`, a `loop` két példája) `env.check`, majd `env.evaluate` a leképezett `RunContext` értéken. Nyers kimenet: `out-1.txt`.

| Kifejezés                                       | `check` típus | `evaluate`                       | `typeof` / prototípus |
| ----------------------------------------------- | ------------- | -------------------------------- | --------------------- |
| `input.pontszam >= 50.0 ? "magas" : "alacsony"` | `string`      | `'magas'`                        | `string`              |
| `input.elemek.filter(e, e.aktiv).map(e, e.nev)` | `list`        | `[ 'alma', 'szilva' ]`           | `Array.prototype`     |
| `iteration < 3`                                 | `bool`        | `true` (az `iteration` itt `2n`) | `boolean`             |
| `steps["ellenorzes"].kesz == false`             | `bool`        | `true`                           | `boolean`             |

Összevetés a SPEC-010 7.5-tel: **egyezik.** Egyik eredmény sem `Promise` (aszinkron függvény regisztrálása nélkül a kiértékelés szinkron; a `Promise` ág a `lib/evaluator.js` 158. sorában csak aszinkron eredményre lép életbe).

### (2) A 7.2 `compile` hibaágai

Kód: `points[2]`, plusz `m2b.mjs` a mélységi korlát határára. Nyers kimenet: `out-2.txt`, `out-2b.txt`.

| Eset                                                                                                             | Szakasz     | Osztály / `code`                                   | `summary`                         |
| ---------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------- | --------------------------------- |
| `1 +`                                                                                                            | `parse`     | `ParseError` / `unexpected_token`                  | `Unexpected token: EOF`           |
| `input.(`                                                                                                        | `parse`     | `ParseError` / `expected_token`                    | `Expected IDENTIFIER, got LPAREN` |
| `step.x`, `stepsx == 1`                                                                                          | **`check`** | a csomag `TypeError` osztálya / `unknown_variable` | `Unknown variable: step`          |
| 300 egymásba ágyazott zárójel, 260 egymásba ágyazott lista literál, 300 tagú mezőlánc (`input.a.a...`), 260 `-(` | `parse`     | `ParseError` / `limit_exceeded`                    | `Exceeded maxDepth (250)`         |
| 240 zárójel, 120 egymásba ágyazott lista                                                                         |             | `ok`                                               |                                   |
| a négy 7.5 példa, `has()` védett alak                                                                            |             | `ok`                                               |                                   |

Összevetés a SPEC-010 7.2-vel: **egyezik, két pontosítással.**

- **A nem deklarált változót az `env.check` adja, nem a `parse`.** A `parse` nem dob rá, a `check` `valid: false` eredménye hordozza, a csomag saját `TypeError` osztályával (nem `ParseError`). A spec mindkét utat `Outcome` hibaágra viszi, tehát a viselkedés egyezik; a megfogalmazás pontosítandó. Forrás: `lib/operators.js` 509, `lib/errors.js` 74 ... 78.
- **A `maxDepth` nem általános AST mélység.** 300 egymás utáni unáris mínusz (`---...1`), 300 `!` és egy 300 tagú `1 + 1 + ...` lánc hiba nélkül átmegy, holott az AST lánc mélysége 301 (`out-2b.txt`: `"------------" 301 parse ok`, `"1 + 1 + 1 + " 1201 parse ok`, `eval: 301`); a 300 mélységű unáris lánc kiértékelése sem dobott (veremtúlcsordulás nem történt), a 260 `-(`-s egymásba ágyazás viszont `limit_exceeded`. A típusdefiníció szerint a korlát a "Maximum nesting depth for recursive grammar elements (calls, selects, indexes, aggregates)" (`lib/index.d.ts` 338); a számláló a `parseExpression` és a `parsePostfix` belépésénél csökken (`lib/parser.js` 678, 778, 802), a `parseUnary` és a bináris ciklus nem számol. A SPEC-010 8. szekciójában az "AST mélység" helyett a pontos megnevezés: a rekurzív nyelvtani elemek (kifejezés, hívás, kiválasztás, index, aggregátum) beágyazási mélysége.

### (3) A 7.3 leképezés sorai

Kód: `points[3]`, leképezéssel (`celCtx`) és leképezés nélkül (`runContext`). Nyers kimenet: `out-3.txt`.

- `item == null`: leképezéssel `true`. Leképezés nélkül (`item: undefined`) `EvaluationError` `unknown_variable: Unknown variable: item`; tehát az `undefined` -> `null` sor szükséges (`lib/registry.js` 1384).
- `iteration + 1`: leképezéssel (`2n`) `3n`. Leképezés nélkül (`number` `2`) `no_such_overload: dyn<double> + int`; tehát a `BigInt` sor szükséges. Az `iteration < 3` leképezés nélkül is `true` (típusok közötti összehasonlítás).
- `input.darab + 1.0` -> `4` (`number`); `input.darab + 1` -> `EvaluationError` `no_such_overload: dyn<double> + int`; `input.darab > 1` -> `true`; `input.darab == 3` -> `true`.
- **Kiegészítés, nem eltérés:** a `compile` (`env.check`) az `input.darab + 1` alakot **elfogadja** (`type: 'int'`), mert a `dyn` statikus típus mellett a hiba csak futáskor derül ki. A szerkesztő mentés előtti ellenőrzése (SPEC-010 10.) ezt az alakot tehát nem fogja meg.

Összevetés a SPEC-010 7.3-mal: **egyezik.**

### (4) A 7.4 táblázat sorai CEL kifejezésből

Kód: `points[4]`, plusz `m4b.mjs` (nem string kulcsú map). Nyers kimenet: `out-4.txt`, `out-4c.txt`. A `plainJsonStringify` oszlop a nyers eredményen futtatott `JSON.stringify`.

| 7.4 sor                   | Kifejezés                                      | Nyers JS alak                                                                                                                                                               | Prototípus                                                             | `JSON.stringify`             |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| `string`                  | `"szöveg"`                                     | `'szöveg'`                                                                                                                                                                  | (primitív)                                                             | `"szöveg"`                   |
| `boolean`, `null`         | `true`, `null`                                 | `true`, `null`                                                                                                                                                              | (primitív)                                                             | `true`, `null`               |
| véges `double`            | `1.5 + 2.5`                                    | `4`                                                                                                                                                                         | (primitív)                                                             | `4`                          |
| `NaN`                     | `0.0 / 0.0`, `double("NaN")`                   | `NaN`                                                                                                                                                                       | (primitív)                                                             | `null` (csendes vesztés)     |
| `Infinity`, `-Infinity`   | `1.0 / 0.0`, `-1.0 / 0.0`                      | `Infinity`, `-Infinity`                                                                                                                                                     | (primitív)                                                             | `null`                       |
| `int`                     | `1 + 2`                                        | `3n`                                                                                                                                                                        | (primitív)                                                             | `TypeError`                  |
| nem biztonságos `int`     | `9007199254740993`, `9223372036854775807`      | `9007199254740993n`, `9223372036854775807n` (`Number()` után `9007199254740992`, `9223372036854776000`)                                                                     | (primitív)                                                             | `TypeError`                  |
| `uint`                    | `1u`                                           | `UnsignedInteger { value: 1 }`                                                                                                                                              | `UnsignedInt.prototype`                                                | `{}` (csendes vesztés)       |
| `bytes`                   | `b"abc"`                                       | `Uint8Array(3) [97, 98, 99]`                                                                                                                                                | `Uint8Array.prototype`                                                 | `{"0":97,"1":98,"2":99}`     |
| időbélyeg                 | `timestamp("2026-01-01T00:00:00Z")`            | `Date`                                                                                                                                                                      | `Date.prototype`                                                       | `"2026-01-01T00:00:00.000Z"` |
| időtartam                 | `duration("1s")`                               | `google.protobuf.Duration { seconds: 1, nanos: 0 }`                                                                                                                         | `Duration.prototype`                                                   | `{}`                         |
| típus érték               | `type(1)`                                      | `Type [Type<int>] {}`                                                                                                                                                       | `Type.prototype`                                                       | `{}`                         |
| lista literál             | `[1, 2, 3]`                                    | `[1n, 2n, 3n]`                                                                                                                                                              | `Array.prototype`                                                      | `TypeError`                  |
| lista makróból            | `input.elemek.filter(...).map(...)`            | `['alma', 'szilva']`                                                                                                                                                        | `Array.prototype`, új tömb                                             | `["alma","szilva"]`          |
| lista a kontextusból      | `input.elemek`                                 | a bemeneti tömb                                                                                                                                                             | `Array.prototype`, **ugyanaz a referencia** (`sameRefAsContext: true`) |                              |
| map, string kulcs         | `{"a": 1, "b": 2}`                             | `{ a: 1n, b: 2n }`                                                                                                                                                          | `Object.prototype`                                                     | `TypeError`                  |
| map a kontextusból        | `input`                                        | a bemeneti objektum                                                                                                                                                         | `Object.prototype`, **ugyanaz a referencia**                           |                              |
| vegyes lista              | `[dyn(1), dyn("a"), dyn(1u)]`                  | `[1n, 'a', UnsignedInteger {...}]`                                                                                                                                          | elemenként más                                                         | `TypeError`                  |
| **nem string kulcsú map** | `{1: "a", 2: "b"}`, `{true: "a"}`, `{1u: "a"}` | `{ '1': 'a', '2': 'b' }`, `{ true: 'a' }`, `{ '1': 'a' }`                                                                                                                   | **`Object.prototype`, a kulcsok JS stringek**                          | `{"1":"a","2":"b"}`          |
| JS `Map`                  | CEL kifejezésből nem állítható elő             | a map literál mindig sima objektum (`lib/operators.js` 345 ... 353, `safeFromEntries`); `Map` csak akkor jön vissza, ha a kontextus `Map` példányt tartalmaz (`out-7c.txt`) |                                                                        |                              |

A típusok forrása: `lib/functions.js` 6 (`UnsignedInt`), 53 (`Duration`), 438 ... 439 (a `timestamp` a JS `Date` konstruktorra regisztrálva).

Összevetés a SPEC-010 7.4-gyel: **eltér egy ponton.**

- A spec leírása (`BigInt` az `int`, `UnsignedInt` a `uint`, sima objektum a map, tömb a lista, `Uint8Array` a `bytes`) egyezik. Az időbélyeg, az időtartam és a típus érték konkrét JS alakja `Date`, a csomag `Duration` és `Type` osztálya; mindhárom nem sima objektum, tehát a prototípus alapú guard elutasítja, ahogy a spec szánja. A `Date` esetén a `JSON.stringify` nem veszít csendben (ISO szöveg), a spec mégis hibát ír elő: ez a spec döntése, nem eltérés.
- **Eltérés: a nem string kulcsú map.** A könyvtár a map literált sima JS objektumba építi (`obj[k] = v`, `lib/operators.js` 350), tehát az `int`, `uint`, `bool` kulcs JS stringgé alakul, és utólag semmi nem különbözteti meg a string kulcsú maptől. Ütközésnél **csendes adatvesztés**: `{dyn(1): "a", dyn("1"): "b"}` -> `{ '1': 'b' }`, `{dyn(1): "a", dyn(1u): "b"}` -> `{ '1': 'b' }`, `{dyn(1): "a", dyn(1.0): "b"}` -> `{ '1': 'b' }`. A könyvtár saját makrója is elromlik rajta: `{1: "a"}.map(k, k)` -> `variable_type_mismatch: Variable 'k' is not of type 'int', got 'string'` (`out-4c.txt`); `{1: "a"} == {"1": "a"}` -> `no_such_overload: map<int, string> == map<string, string>`. A 7.4 tehát ezt az esetet nem tud hibaággal elutasítani.
- **Kiegészítés:** a kontextusból változatlanul visszaadott lista és map **ugyanaz a referencia**, mint a bemenet; a normalizálásnak új értéket kell építenie, nem a bemenetet módosítania.

### (4b) A `ParseError` és az `EvaluationError` `summary` és `range` mezője

Kód: `points['4b']`. A `summaryContainsExprFragment` mező a kifejezés legalább négy karakteres azonosítóit és szavait keresi a `summary` szövegében. Nyers kimenet: `out-4b.txt`, plusz a `code`, `summary`, `range` minden más pont kimenetében.

Forrás: `lib/errors.js` 1 ... 44. A konstruktor a kapott üzenetet változatlanul `summary`-ként tárolja (13. sor), és ha az AST csomópont hordozza a bemenetet, a `message` mezőt a forrás sorával és kiemeléssel írja felül (`formatErrorWithHighlight`). A `range` `{ start, end }` karakter eltolás (`normalizeRange`). A `summary` szövegét a hívó helyek építik, például `Unknown variable: ${ast.args}` (`lib/operators.js` 509, `lib/registry.js` 1384) és `No such key: ${key}` (`lib/registry.js` 252, `lib/operators.js` 491).

| Eset                                      | `code`                 | `summary`                                | `range`     | idéz-e a kifejezésből              |
| ----------------------------------------- | ---------------------- | ---------------------------------------- | ----------- | ---------------------------------- |
| `"SECRET_LITERAL" +`                      | `unexpected_token`     | `Unexpected token: EOF`                  | 18 ... 18   | nem                                |
| `input.(`                                 | `expected_token`       | `Expected IDENTIFIER, got LPAREN`        | 6 ... 7     | nem                                |
| `step.x`                                  | `unknown_variable`     | `Unknown variable: step`                 | 0 ... 4     | **igen, az azonosítót**            |
| `titokNeve == "x"`                        | `unknown_variable`     | `Unknown variable: titokNeve`            | 0 ... 9     | **igen, az azonosítót**            |
| 300 zárójel                               | `limit_exceeded`       | `Exceeded maxDepth (250)`                | 250 ... 250 | nem                                |
| `input.TITKOS_KULCS_NEV`                  | `no_such_key`          | `No such key: TITKOS_KULCS_NEV`          | 6 ... 22    | **igen, a mezőnevet**              |
| `steps["nincs-ilyen-SECRET"]`             | `no_such_key`          | `No such key: nincs-ilyen-SECRET`        | 0 ... 27    | **igen, az index string literált** |
| `input.darab + "SECRET_LITERAL"`          | `no_such_overload`     | `no such overload: dyn<double> + string` | 0 ... 30    | nem (csak típusnevek)              |
| `1 / 0`                                   | `division_by_zero`     | `division by zero`                       | 0 ... 5     | nem                                |
| `steps["kötőjeles-azonosító"].mező`       | `unexpected_character` | `Unexpected character: ő`                | 32 ... 33   | igen, egy karaktert                |
| saját `constructor` kulcsú adat (7. pont) | `unsupported_type`     | `Unsupported type: object`               | `undefined` | nem                                |

A `message` minden csomóponthoz kötött esetben a teljes forrás sort tartalmazza kiemeléssel (például `'No such key: hianyzo\n\n>    1 | input.hianyzo\n               ^'`), ami az M-127 tényt megerősíti. Az `unsupported_type` esetén a `range` `undefined` és a `message` azonos a `summary`-vel.

Összevetés a SPEC-010 9.5-tel: **eltér.** A spec szerint "A csomag hibaleírása nem idézi a sablon vagy a kifejezés szövegét", és a leírás a `summary` és a `range` mezőből épül. A `summary` a teljes szöveget valóban nem idézi, de az `unknown_variable`, a `no_such_key` és az `unexpected_character` kódnál a kifejezés egy darabját igen: azonosítót, mezőnevet, és index alakban a felhasználó által írt **string literált** is.

### (5) Hiányzó kulcs és a `has()` védett alak

Kód: `points[5]`. Nyers kimenet: `out-5.txt`. Összevetés a SPEC-010 5.4-gyel és az M-121-gyel: **egyezik.**

- `input.hianyzo` -> `no_such_key: No such key: hianyzo`; `steps["nincs"].x` -> `no_such_key: No such key: nincs`.
- `has(input.hianyzo)` -> `false`, `has(input.tema)` -> `true`, `has(steps.nincs)` -> `false`, `has(input.prioritas) ? input.prioritas : "normal"` -> `'normal'`; egyik sem hiba.
- Kiegészítés: a `null` értékű `item` mezőjének olvasása (`item.x`) szintén `no_such_key`, a `has(item.x)` `false`: a hatókörön kívüli `item` mezőjére is a `has()` a védett alak.

### (6) Kötőjeles azonosító index alakban

Kód: `points[6]`. Nyers kimenet: `out-6.txt`. Összevetés a SPEC-010 5.3-mal: **egyezik, egy pontosítással.**

- `steps["kötőjeles-azonosító"].mezo` -> `'érték'`; `steps["llm-1"].text` -> `'válasz'`; a `compile` is `ok`. A `steps.llm-1` kivonásként értelmeződik (`no_such_key: No such key: llm`).
- **Pontosítás:** az index utáni mező kiválasztó is CEL azonosító (ASCII) kell legyen. `steps["kötőjeles-azonosító"].mező` -> `ParseError` `unexpected_character: Unexpected character: ő`; a működő alak `steps["kötőjeles-azonosító"]["mező"]` -> `'ékezetes kulcs'`.

### (7) Prototípus kulcsok

Kód: `points[7]`, plusz `m7b.mjs`, `m7c.mjs`, `m7d.mjs`. Nyers kimenet: `out-7.txt`, `out-7b.txt`, `out-7c.txt`, `out-7d.txt`.

**A CEL-ből a prototípus lánc nem érhető el.** `input.constructor`, `input.__proto__`, `input.toString`, `input.hasOwnProperty`, ugyanezek index alakban, `steps.constructor`, `input.elemek.constructor`, `input.tema.constructor`, `{}.constructor` mind `no_such_key`; `has(input.constructor)`, `has(input.toString)`, `"constructor" in input`, `"toString" in input` mind `false`. Függvény nem hívódik, érték nem szivárog. Forrás: a mező olvasás `Object.hasOwn` szűrésű (`lib/operators.js` 471 ... 476, `lib/registry.js` 197, `lib/globals.js` 1).

**Eltérés 1: a saját `constructor` kulcsú adat objektum kiértékelhetetlen.** Ha egy sima objektumnak saját `constructor` adat kulcsa van (például `JSON.parse('{"tema":"x","constructor":"saját"}')`), akkor minden kifejezés, ami ezt az objektumot érinti, `EvaluationError` `unsupported_type: Unsupported type: object` hibát ad, `range` nélkül: `input.tema`, `has(input.tema)`, `input.constructor` egyaránt; egy lista szűrése is, ha bármelyik eleme ilyen (`input.l.filter(e, e.n > 1.0).size()`); egy `"constructor"` kulcs objektum értékkel is. Ugyanazon `steps` rekord másik, érintetlen lépésének olvasása (`steps["a"].x`) működik. Ok: a könyvtár az érték CEL típusát a `v.constructor` alapján dönti el (`lib/operators.js` 44 ... 56: `undefined`, `Object`, `Map` -> map; `Array`, `Set` -> lista; más -> regisztrált típus vagy `unsupported_type`), és a saját adat kulcs eltakarja az örökölt `constructor` tulajdonságot. A `constructor` nélküli `null` prototípusú objektum működik (`out-7b.txt`); hogy a saját `constructor` kulcsú `null` prototípusú objektum ugyanígy jár-e, **nem mértük**, csak a `lib/operators.js` 44 ... 56 kódolvasásából következik (`v.constructor` a kulcs értéke lenne).

- **Az `out-7.txt` utolsó három blokkja félrevezető, ha magában olvasott:** a `meres.mjs` 7. pontja egyetlen objektumban hordozta mindhárom saját kulcsot (`{"constructor":"saját","__proto__":"saját proto","toString":"saját ts"}`), ezért a `__proto__` és a `toString` olvasása is `unsupported_type` hibát ad. Az `m7b.mjs` a kulcsokat külön objektumokban méri: a `constructor` nélküli objektumon a saját `__proto__`, `toString` és `hasOwnProperty` kulcs olvasható (`'saját'`), és a többi mező is (`input.tema` -> `'x'`). Egyedül a `constructor` kulcs bontja meg az objektumot.
- Mért kerülő út (nem döntés): ha a 7.3 leképezés a sima objektumokat mélyen `Map` példánnyá alakítja, a fenti kifejezések működnek (`input.tema` -> `'x'`, `input.constructor` -> `'saját'`, `has(input.constructor)` -> `true`, a lista szűrés `1n`), a prototípus kulcs továbbra sem érhető el (`input.toString` -> `no_such_key`); cserébe a kontextusból visszaadott map `Map` példányként jön vissza, amit a 7.4 "minden más -> hiba" sora elutasítana (`out-7c.txt`). A mély másolás költsége nem mért.

**Eltérés 2: a map literál három kulcsot csendben eldob.** `{"constructor": 1, "a": 2}`, `{"__proto__": 1, "a": 2}`, `{"prototype": 1, "a": 2}` -> `{ a: 2n }`; `size({"constructor": 1, "a": 2})` -> `1n`; `{"constructor": 1}.size()` -> `0n`. Forrás: `lib/operators.js` 345 ... 353 (`safeFromEntries`: `if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue`). Biztonsági szempontból ez véd, de az eredmény csendben veszít adatot (`out-7d.txt`).

Összevetés: a prototípus elérés szempontjából **egyezik** (nincs szivárgás); a két fenti viselkedés a SPEC-010 7.3 és 7.4 által nem leírt eltérés.

### (8) Beágyazott makró futásideje nagy listán (SPEC-010 O-2 bemenete)

Kód: `points[8]`. A lista elemei `{ id, ertek, aktiv }` sima objektumok az `input.lista` alatt; a kifejezés egyszer `env.parse`, egy bemelegítő futás, utána öt mért futás `process.hrtime.bigint()`-tel; min, medián, max. Küszöböt nem állítunk. Gép: az 1. szekció szerinti (Linux `aarch64`, 4 mag, 3,8 GiB, Node `v26.7.0`, egyetlen szál). Nyers kimenet: `out-8.txt`.

| Kifejezés                                                                                       | n      | min        | medián     | max        |
| ----------------------------------------------------------------------------------------------- | ------ | ---------- | ---------- | ---------- |
| `input.lista.filter(e, e.aktiv).map(e, e.ertek)`                                                | 1000   | 0,16 ms    | 0,17 ms    | 1,04 ms    |
|                                                                                                 | 10000  | 1,37 ms    | 1,40 ms    | 2,04 ms    |
|                                                                                                 | 100000 | 13,06 ms   | 13,87 ms   | 15,55 ms   |
| `input.lista.all(x, input.lista.exists(y, y.id == x.id))`                                       | 100    | 0,92 ms    | 1,08 ms    | 1,33 ms    |
|                                                                                                 | 1000   | 79,35 ms   | 82,72 ms   | 83,37 ms   |
|                                                                                                 | 3000   | 728,60 ms  | 741,02 ms  | 752,67 ms  |
| `input.lista.map(x, input.lista.filter(y, y.ertek > x.ertek).size())`                           | 100    | 1,89 ms    | 1,90 ms    | 2,05 ms    |
|                                                                                                 | 1000   | 182,00 ms  | 183,91 ms  | 194,02 ms  |
|                                                                                                 | 3000   | 1578,27 ms | 1624,64 ms | 1682,73 ms |
| `input.lista.exists(x, input.lista.exists(y, input.lista.exists(z, x.id + y.id + z.id < 0.0)))` | 10     | 0,36 ms    | 0,39 ms    | 0,42 ms    |
|                                                                                                 | 50     | 39,34 ms   | 39,50 ms   | 41,33 ms   |
|                                                                                                 | 100    | 318,54 ms  | 323,91 ms  | 340,01 ms  |

Megfigyelés: a futásidő a beágyazási szinttel a lista méretének hatványaként nő (kétszintűnél tízszeres n mellett nagyjából százszoros, háromszintűnél kétszeres n mellett nagyjából nyolcszoros), összhangban az M-123-mal. A `maxListElements: 1000` a futásidejű listára nem hat: a 100000 elemes lista hiba nélkül feldolgozódott (a SPEC-010 8. szekció megkötését megerősíti). A hívás szinkron, tehát a mért idő alatt az eseményhurok blokkolt (M-135). **Ez nyers bemenet az O-2-höz, ítélet nélkül.** A Mustache renderelés idejét ez a mérés nem fedi.

## 3. T-010-3: a Mustache (`mustache@4.2.0`)

Mérő eszköz: `2026-10-21-spec010-blokkolo-meresek/t010-3-mustache/`: a közös segédek `src/lib.mjs`, a pontonkénti scriptek `src/p1.mjs` ... `src/p8b.mjs`, a (8) hat folyamatos futtatása `src/p8.sh`; a nyers kimenetek `out/p1.txt` ... `out/p8b.txt`. A nézet minden ponton valós alakú `RunContext`: a `packages/engine/src/run-context/run-context.ts` hét kulcsa, a `buildRunContext` kimenetének alakjában (minden kulcs jelen van, a nem érvényes mező értéke `undefined`), az `input` és a `steps` JSON kerekúton (M-106).

**A mért három renderelési út** (`src/lib.mjs`):

| Név a kimenetben | Mi ez                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stock`          | a könyvtár gyári útja: sima nézet, csak `{ escape }` a `render` negyedik argumentumában                                                                            |
| `spec`           | a SPEC-010 6.2 szó szerinti útja: `Mustache.render(t, new OwnPropertyContext(view), undefined, { escape: toText })`                                                |
| `strict`         | `Mustache.Writer` alosztály (`StrictWriter`), ami a sima változó tag két ágát (`escapedValue`, `unescapedValue`) felülírja, ugyanazzal az `OwnPropertyContext`-tel |

A `strict` út lényege (`src/lib.mjs`, a teljes osztály ott áll):

```js
export class StrictWriter extends Mustache.Writer {
  constructor() {
    super();
    this.templateCache = undefined; // saját példány, saját gyorsítótár
  }
  #plainValue(token, context) {
    if (!(context instanceof OwnPropertyContext)) throw new Error('nem OwnPropertyContext');
    const r = context.resolve(token[1]);
    if (!r.found) throw new MissingNameError(token[1]);
    return toText(r.value);
  }
  escapedValue(token, context) {
    return this.#plainValue(token, context);
  }
  unescapedValue(token, context) {
    return this.#plainValue(token, context);
  }
}
```

Az `OwnPropertyContext` (a 6.6 szerinti alosztály: `lookup` és `push` felülírása, saját tulajdonságra szűkített feloldás, függvényhívás nélkül) és a `toText` (a 6.5 szerinti szöveggé alakítás) szintén a `src/lib.mjs` fájlban áll. Értelmezési pontok, amiket a mérő kód rögzít (nem a spec mondja ki szó szerint): a) konténer csak nem `null` objektum (sima objektum vagy tömb), primitív érték tulajdonsága (`'abc'.length`) nem saját adat tulajdonság; b) a saját tulajdonságként jelen lévő, de `undefined` értékű kulcs (`item`, `itemIndex`, ... a `buildRunContext` szerint) hiányzó névnek számít; c) a `.` név csak az aktuális kontextus nézete.

| Pont | Ítélet                                   | Röviden                                                                                                               |
| ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| (1)  | egyezik                                  | a nyolc karakter változatlanul átjut, a globális `Mustache.escape` érintetlen                                         |
| (2)  | eltér a `spec` úton                      | `null` -> `""` (nem `"null"`); a nyers alak tömbre és objektumra nem JSON; a `strict` úton egyezik                    |
| (3)  | **nem teljesül a 6.7 mechanizmusával**   | a `Context` nem látja a hívót; csak `Writer` alosztállyal különböztethető meg                                         |
| (4)  | részben eltér                            | az `Invalid tags` pozíció nélkül a határoló szöveget idézi; a szakasz név tetszőleges hosszú szöveg                   |
| (5)  | egyezik                                  | a `{{> x}}` üres                                                                                                      |
| (6)  | egyezik                                  | a modul szintű kikapcsolás működik; egy új `Writer` példány saját, bekapcsolt gyorsítótárral jön létre                |
| (7)  | teljesül                                 | a 6.4 táblázat bájtra azonos; a `{{input.tema.length}}` eltér a gyári viselkedéstől                                   |
| (8)  | teljesül (függvényhívás 0, elutasítás 0) | a `strict` úton a sima tagos támadás hiba, nem üres; a `spec` úton a jogos nyers tag implicit prototípus metódust hív |

### (1) A nyolc escape karakter a `config.escape` mellett; a globális `Mustache.escape` érintetlen

Kód: `src/p1.mjs`: `&<>"'/`=`bemenet a`{{input.s}}`, `{{{input.s}}}`, `{{& input.s}}`alakra, mindhárom úton;`Mustache.escape === originalEscape`. Nyers kimenet: `out/p1.txt`. Mindhárom alak, mindhárom úton a nyolc karaktert változatlanul adja (`&<>"'/`=`); `globalEscapeSameRef: true`; a `Mustache.escape('&<>"\'/`=')` továbbra is HTML escape-el (`&amp;&lt;&gt;&quot;&#39;&#x2F;&#x60;&#x3D;`), config nélkül is. Összevetés a SPEC-010 6.1-gyel: **egyezik.** Forrás: `mustache.mjs` 60 ... 75 (`entityMap`, `escapeHtml`), 663 ... 667 (`escapedValue`), 757 (`mustache.escape = escapeHtml`).

### (2) Szám, logikai érték, `null`, tömb, objektum szöveggé alakítása (6.5, O-5)

Kód: `src/p2.mjs`: tíz érték (`szam`, `tort`, `nulla`, `igaz`, `hamis`, `semmi: null`, `tomb`, `obj`, `uresTomb`, `uresObj`) mindhárom alakban, mindhárom úton. Nyers kimenet: `out/p2.txt`. A lényegi sorok:

```
{{input.semmi}}        spec=""                          strict="null"                       stock=""
{{{input.semmi}}}      spec=""                          strict="null"                       stock=""
{{input.tomb}}         spec="[\"a\",1,null,{\"k\":\"v\"}]"   strict="[\"a\",1,null,{\"k\":\"v\"}]"   stock="[\"a\",1,null,{\"k\":\"v\"}]"
{{{input.tomb}}}       spec="a,1,,[object Object]"     strict="[\"a\",1,null,{\"k\":\"v\"}]"   stock="a,1,,[object Object]"
{{{input.obj}}}        spec="[object Object]"           strict="{...JSON...}"               stock="[object Object]"
{{{input.uresTomb}}}   spec=""                          strict="[]"                         stock=""
```

Összevetés a SPEC-010 6.5-tel és a 6.1 "a három alak ugyanazt adja" mondatával:

- `{{név}}` alak, szám, logikai érték, tömb, objektum: **egyezik** (a `spec` úton is).
- **Eltér, `null`:** a `spec` úton mindhárom alak üres szöveget ad, nem `"null"`-t. Ok: a könyvtár `null` és `undefined` értékre meg sem hívja az escape függvényt (`mustache.mjs` 666: `if (value != null)`).
- **Eltér, a nyers alak (`{{{név}}}`, `{{& név}}`) tömbre és objektumra:** a `spec` úton `a,1,,[object Object]` és `[object Object]`, nem JSON. Ok: az `unescapedValue` a `config`-ot meg sem kapja, és az értéket változatlanul adja vissza (`mustache.mjs` 657 ... 660), a `renderTokens` `buffer += value` sora (579) a JavaScript implicit szöveggé alakítását futtatja. Ez a 6.1 "a három alak ugyanazt adja" állítását is megcáfolja a `spec` úton.
- A `strict` úton (`Writer` alosztály) mind a tíz típus, mindhárom alak a 6.5 szerinti eredményt adja.

### (3) A hiányzó név: megkülönböztethető-e a sima változó és a szakasz (6.7, O-4)

Kód: `src/p3.mjs`: A) a `lookup` hívás argumentumai a `Mustache.render` úton, a hívó verem sorával; A2) a `lookup` paraméterlistája; B) `Writer` alosztály út, 17 sablonon; C) ugyanez a `Context` alosztállyal egyedül; D) veremalapú megkülönböztetés (csak bizonyításként). Nyers kimenet: `out/p3.txt`.

- **A blokk:** a `lookup` mindig egyetlen argumentumot, a nevet kapja (`Mustache.Context.prototype.lookup.length` = 1; `mustache.mjs` 393; `@types/mustache` `lookup(name: string): any`), a sima változó (`escapedValue`, `mustache.mjs` 665), a nyers változó (`unescapedValue`, 658), a szakasz (`renderSection`, 588) és a fordított szakasz (`renderInverted`, 620) **ugyanazzal az argumentummal** hívja. A `Context`-en belül az egyetlen megkülönböztető információ a hívási verem (D blokk: működik, de a könyvtár belső függvényneveitől függ, és minifikált vagy átcsomagolt build alatt csendben elromlik; nem javasolt, csak bizonyításként mértük).
- **C blokk** (`Context` alosztály egyedül, `Mustache.render` út): a hiányzó név mindhárom változó alakon csendben üres; a szakasz üres, a fordított szakasz renderel.
- **B blokk** (`Writer` alosztály): a sima változó tag fel nem oldható neve hibát ad, a teljes kért nevet idézve (`input.szerzo.nemletezik`); a szakasz és a fordított szakasz a könyvtár alapértelmezését kapja (`""`, illetve a fordított ág szövege); a szakasz belsejében álló sima változó is hibát ad (`{{#input.elemek}}{{nincs}}{{/input.elemek}}` -> `hiányzó név a sablonban: nincs`). A `{{item}}`, `{{itemIndex}}`, `{{error.kind}}` egy nem `fan_out`/`error_handler` kontextusban hibát ad (a b) értelmezés miatt), ami az 5.1 "vagy hiányzó név" oszlopával egyezik. A `{{input.semmi}}` (érték `null`) a `strict` úton `"null"`-t ad, nem hibát.

Összevetés a SPEC-010 6.7-tel: **a 6.7 által leírt mechanizmus (a saját `Context` alosztály különbözteti meg a két hívást) a pinelt könyvtárral nem valósítható meg tisztán; a megkülönböztetés a `Writer` alosztállyal valósítható meg** (az `escapedValue` és az `unescapedValue` publikus, típusosan deklarált metódus, `@types/mustache` 280. és 294. sor). A szakasz és a fordított szakasz hiba nélküli alapértelmezése mindkét úton egyezik a 6.7-tel. Mellékhatás: a `Writer` alosztály saját példány, tehát nem a `Mustache.render` hívódik (6.2), és a saját gyorsítótárát külön ki kell kapcsolni ((6) pont).

### (4) A négy `parseTemplate` hiba, és mit idéz a sablonból (9.5)

Kód: `src/p4.mjs`: 12 sablon (a négy hiba több alakban, titok jellegű szöveggel és egy érvényes ellenpélda). Nyers kimenet: `out/p4.txt`.

| Sablon                                                     | Osztály | Üzenet                                                                    |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `Szia {{input.tema`                                        | `Error` | `Unclosed tag at 17`                                                      |
| `x {{/ez itt egy hosszu TITKOS mondat a sablonbol 789}} y` | `Error` | `Unopened section "ez itt egy hosszu TITKOS mondat a sablonbol 789" at 2` |
| `{{#input.elemek}}a{{/input.masik}}`                       | `Error` | `Unclosed section "input.elemek" at 18`                                   |
| `elotte {{#TITKOS nyito szoveg 222}}a`                     | `Error` | `Unclosed section "TITKOS nyito szoveg 222" at 36`                        |
| `{{=ez_a_teljes_TITKOS_szoveg_444_idezve_lesz=}}`          | `Error` | `Invalid tags: ez_a_teljes_TITKOS_szoveg_444_idezve_lesz`                 |
| `{{==}}`                                                   | `Error` | `Invalid tags: `                                                          |
| `{{=a b c=}}`                                              |         | nem hiba (a `split(spaceRe, 2)` két elemre bontja)                        |

Összevetés a SPEC-010 9.5-tel és az M-115-tel:

- A négy hibaosztály létezik, a `parse` sima `Error` kivételt dob, egyedi hibaosztály nélkül: **egyezik** (`mustache.mjs` 141, 211, 228, 231, 246). A hibaosztályt tehát csak az üzenet előtagja azonosítja.
- `Unclosed tag at <pos>`: csak pozíció, **egyezik**.
- `Unopened section "<név>"` és `Unclosed section "<név>"`: pozíció és egy szakasz név, **egyezik** a "legfeljebb egy szakasz név" mondattal, de a "szakasz név" a sablon tetszőleges, szóközt is tartalmazó szövegrésze lehet, hosszkorlát nélkül.
- **Eltér, `Invalid tags: <szöveg>`:** nincs benne pozíció, és nem szakasz nevet, hanem a határoló csere tag tartalmát idézi a sablonból (`mustache.mjs` 141: `'Invalid tags: ' + tagsToCompile`). A 9.5 "egy pozíciót és legfeljebb egy szakasz nevet tartalmaz" állítása erre az ágra nem igaz. A kiadott szöveg szóközt nem tartalmazhat (a 137. sor `split(spaceRe, 2)` két elemre bontja), de hosszkorlátja nincs.

### (5) A `{{> x}}` üres

Kód: `src/p5.mjs`: `{{> x}}`, `a{{>x}}b`, `{{> ../../etc/passwd}}`, `{{> input}}`, `  {{> x}}\nsor`. Nyers kimenet: `out/p5.txt`: mind a három úton üres (a standalone sor eleji szóköz és sortörés a könyvtár szokásos szabálya szerint eltűnik). Összevetés a SPEC-010 6.4-gyel és az M-117-tel: **egyezik.** Forrás: `mustache.mjs` 640 (`if (!partials) return;`).

### (6) A gyorsítótár kikapcsolása

Kód: `src/p6.mjs`. Nyers kimenet: `out/p6.txt`.

```
alapból templateCache típusa: object kulcsok: 0
cache BE: parse(t) === parse(t): true
beállítás után Mustache.templateCache: undefined
cache KI: parse(t) === parse(t): false  tokenek egyenlők tartalomra: true
új Mustache.Writer példány templateCache kulcsai (a globális kikapcsolás NEM hat rá): 2
StrictWriter példány templateCache: undefined  new StrictWriter(): undefined
StrictWriter parse(t) === parse(t): false
```

Összevetés a SPEC-010 6.3-mal: **egyezik** a modul szintű `Mustache.parse`/`Mustache.render` útra (`mustache.mjs` 509 ... 520, `isCacheEnabled = typeof cache !== 'undefined'`; 710 ... 713: a setter csak a `defaultWriter`-re hat). **Kiegészítés:** minden `new Mustache.Writer()` saját, bekapcsolt gyorsítótárral jön létre (`mustache.mjs` 481 ... 493), a globális kikapcsolás arra nem hat (mért: 2 kulcs). A `Writer` alosztály példányán külön kell kikapcsolni (a `StrictWriter` konstruktora). A `@types/mustache` a `Writer` példányon `templateCache` mezőt nem deklarál (csak modul szinten, 30. sor), tehát TypeScriptben a mezőt az alosztálynak kell deklarálnia; ezt **typecheck alatt nem mértem** (nem ellenőrzött; a T-010-5 (2) pont feladata).

### (7) A 6.6 szerinti `Context` alosztály a 6.4 táblázat minden során

Kód: `src/p7.mjs`: 29 sablon a három úton (`stock`, `spec`, `strict`), plusz a `push` felülírásának próbája. Nyers kimenet: `out/p7.txt`.

- A 6.4 táblázat mind az öt sora (pontozott név, szakasz tömbön, fordított szakasz üres és hiányzó értékre, partial, határoló csere), a beágyazott szakasz, a `.` név, a szülő kontextus bejárása, a pontozott név szakaszban, a `fan_out`/`loop`/`join`/`error` kontextus: a `spec` és a `strict` út kimenete **bájtra azonos** a könyvtár gyári kimenetével (28 sor a 29-ből; a 29. a `{{input.tema.length}}`, lásd lent). **Egyezik.** A `steps.node-1.summary` (kötőjeles azonosító) működik; a pont az egyetlen névelválasztó.
- A `push` felülírása szükséges és hat: a szonda minden `lookup` hívásnál `OwnPropertyContext` példányt lát; felülírás nélkül a szakasz belseje alap `Context` lesz (`mustache.mjs` 385 ... 387), és `{{#input.elemek}}{{constructor.name}}{{/input.elemek}}` kimenete `StringString`. **Egyezik** az M-134-gyel és a 6.6 2. pontjával.
- **Egy eltérés a könyvtár alapviselkedésétől:** `{{input.tema.length}}` gyári kimenete `22`, az alosztállyal üres (`spec`) vagy hiba (`strict`). A könyvtár a pontozott név utolsó szegmensét primitíven saját tulajdonságként elfogadja (`mustache.mjs` 39 ... 45, `primitiveHasOwnProperty`). Az alosztály ezt szándékosan nem engedi; a 6.6 "a nézet adatának saját tulajdonsága" mondata nem döntötte el, hogy egy szöveg hossza ide tartozik-e. A tömb `length`-je (saját adat tulajdonság) mindhárom úton `2`.

### (8) Támadó sablon lista, csapda függvényekkel és `unhandledRejection` figyelővel

Kód: `src/p8-run.mjs` (30 támadó sablon: a terv kötelező 9 eleme plusz 21 bővítés), `src/p8.sh` (hat külön folyamat), `src/p8b.mjs` (jogos nyers tag a `spec` és `strict` úton). A csapdák a beépített metódusokat (`Array.fromAsync`, `Array.from`, `Array.prototype.map`, `Array.prototype.toString`, `Object.prototype.toString`, `valueOf`, `hasOwnProperty`, `Object.keys`, `String.prototype.toString`, `valueOf`) és egy saját tulajdonságként a nézetbe tett `input.trapFn` függvényt számlálóval burkolják, és csak a `render` hívás idejére élesek. Nyers kimenet: `out/p8.txt`, `out/p8b.txt`.

| Út                                | Támadó sablonok kimenete                                                             | Függvényhívás | Kezeletlen elutasítás | Kilépési kód                                      |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------- | --------------------- | ------------------------------------------------- |
| `stock` (pozitív kontroll)        | `[object Object]`, `Function`, `[object Promise]`, kivételek                         | 69            | 2                     | **1** (a `fromAsync` eset leállítja a folyamatot) |
| `spec` (csak `Context` alosztály) | mind a 30 üres                                                                       | 0             | 0                     | 0                                                 |
| `strict` (`Writer` alosztály is)  | a sima változó tagos támadás `hiányzó név a sablonban: <név>` hiba, a szakaszos üres | 0             | 0                     | 0                                                 |

A pozitív kontroll bizonyítja, hogy a mérő eszköz érzékeli, amit keres: a research 7. szekció felállása (gyári út, figyelő nélkül) reprodukálva, a folyamat `TypeError ... Symbol.asyncIterator` miatt `1` kóddal leállt.

`p8b` (jogos nyers tag objektum vagy tömb értékre): a `spec` út meghívja az `Object.prototype.valueOf`, `Object.prototype.toString`, `Array.prototype.toString` metódust (`{{{input.szerzo}}}` -> `[object Object]`, `HÍVOTT: Array.prototype.join,Object.prototype.valueOf,Object.prototype.toString`); a `strict` úton egyedül az `Array.prototype.join` látszik, ami a könyvtár saját hívása a határoló tömbön (`mustache.mjs` 511, `cacheKey`), nem a nézeté.

Összevetés a SPEC-010 6.6-tal és a T-010-3 (8) kritériumával: a függvényhívás és a kezeletlen elutasítás tekintetében **teljesül** mindkét úton; a "mindegyik üres" elvárás csak a `spec` úton teljesül, a `strict` (6.7) úton nem (a két elvárás együtt nem teljesülhet; a 6.7 a későbbi döntés, a (8) szövege átvezetésre szorul); a `spec` úton a 6.6 szerződés jogos nyers tagon implicit prototípus hívással sérül.

## 4. T-010-4: a `loop` saját `continueExpression`-je által látott `iteration`

Mérő eszköz: `2026-10-21-spec010-blokkolo-meresek/t010-4-motor/`: `t010-4-probe.spec.ts.masolat` (a próba teljes fájlja; a `.masolat` végződés szándékos, hogy a Vitest és az ESLint ne vegye fel; a harness a `packages/engine/src/engine-port/create-engine.spec.ts` 1 ... 818. sorának másolata a `69bf35c` fán, két változással: a `HarnessOptions` kapott egy `expressionEvaluator` és egy `templateRenderer` mezőt), `cel-probe.mjs` (a mért kontextus a CEL környezeten), `cel-kimenet.txt`, `nyers-kimenet-tiszta.txt` (a Vitest kimenete ANSI escape nélkül).

**Felállás.** A `main` `69bf35c` eldobható másolatán (detached), `bun install --frozen-lockfile` után. Futtatás: `bun run vitest run packages/engine/src/engine-port/t010-4-probe.spec.ts --coverage.enabled=false` (Node alatt, Vitest 4.1.11). Valódi `createEngine`, valódi `openDatabase(':memory:')` a commitolt migrációkkal, a `create-engine.spec.ts` harnessa szerint. Valódi API hívás nincs: az `agentQueryRunner` a meglévő `fakeAgentStepRunner`. A kifejezés port rögzíti a kapott kontextust (`describeContext`), a döntése nem függ az `iteration` értéktől: a `FOLYTAT-<n>` szövegű kifejezés az első n kiértékelésre `true`, utána `false`.

**A próba esetei.** A) legfelső szintű `loop` (`FOLYTAT-2`, `maxIterations` 5); B) beágyazott `loop` (külső `FOLYTAT-1`, belső `BELSO-2`); C) és D) állandó igaz kifejezés (`FOLYTAT-99`, `maxIterations` 2) `on_error` éllel, illetve nélküle.

### 4.1 Eredmény

**A legfelső szintű `loop` saját `continueExpression`-je MINDEN lefutáskor `iteration: undefined` értéket kap** (a kulcs jelen van, az érték `undefined`), az első és minden további lefutásnál is. A CEL felé ez a SPEC-010 7.3 leképezés szerint `null`. Nyers kimenet: `nyers-kimenet-tiszta.txt`, A eset.

| `lp` lefutás | `step_run.iteration` | `loop_iteration_started` payload `iteration` | a kifejezés port `context.iteration` | a kifejezés port `steps` kulcsai |
| ------------ | -------------------- | -------------------------------------------- | ------------------------------------ | -------------------------------- |
| 1.           | 0                    | 0                                            | `undefined`                          | `start`                          |
| 2.           | 1                    | 1                                            | `undefined`                          | `start`                          |
| 3. (kilépő)  | 2                    | (nincs esemény)                              | `undefined`                          | `start`                          |

Összevetésül a törzs (`torzs`) sablon portja ugyanebben a futásban `iteration: 0`, majd `1` (`number`) értéket kap, a `loop` utáni `vege` pedig ismét `undefined`-ot. **A törzs kimenete sem látszik** a `loop` saját kifejezésében: a `steps` rekordban minden lefutáskor csak a `start` áll, a `torzs` nem. A `loop` saját kifejezésének kontextusa lefutásról lefutásra bájtra azonos (`contextJson`, PORT#1, #3, #5).

C és D eset: az állandó igaz kifejezés a `maxIterations` eléréséig folytat, és ott a lépés `loop_max_iterations_reached` osztállyal bukik; a futás `failed` (D: `errorKind` `loop_max_iterations_reached`; C: az `on_error` -> `error_handler` úton `retry_attempts_exhausted`).

### 4.2 Honnan jön az érték (forráshely, `69bf35c`)

1. `packages/engine/src/run-supervisor/advance-run.ts` 459: a `runContext`-et a `buildRunContext` hívással építi, a példány ág kontextusa alapján; a `loop` saját lefutásszáma (`iterationOf`, 71. sor, `resolveLoopIteration`) csak a `NodeExecutionInstance.iteration` mezőbe megy (441. sor), a `RunContext`-be nem.
2. `packages/engine/src/run-context/build-run-context.ts` 127: `iteration: innermostIteration(input.instance.branchContext)`, a 52. sorban: a verem legbelső `loop` keretének `iteration` értéke, keret nélkül `undefined`.
3. A `loop` példány saját ág kontextusa a `loop` keret NÉLKÜLI külső verem: `packages/engine/src/scheduling/advance-scheduler.ts` 103 ... 112 (`findLoopOuterContext`) a visszaélen érkező jelölésről leveszi a ciklus saját keretét (119. sor, `loopBackEdgeIds.has`). A `loop` keret csak a törzs kontextusába kerül (342 ... 343. sor: `{ kind: 'loop', stepRunId, iteration }`, `bodyContext`).
4. `packages/engine/src/node-executor/execute-loop.ts` 105: `ports.expressionEvaluator.evaluate(config.continueExpression, runContext)`: a végrehajtó a kapott `runContext`-et adja tovább változatlanul; a saját `instance.iteration` értékét (97. sor a `maxIterations` összevetésnél, 134. sor az esemény payloadban) a kontextusba nem teszi bele.
5. A törzs kimenetének láthatatlansága: `packages/engine/src/run-context/find-visible-step-instance.ts` 24 ... 25 és 82: a jelölt példány kontextusa (`[loop keret]`) hosszabb, mint a `loop` saját kontextusa (`[]`), az előtag próba megbukik. A `torzs` gráfbeli ős (a visszaélen át, `collect-ancestor-node-ids.ts` 41 ... 48 doksija), de nem látható példány.

Ez egyezik a SPEC-004 szövegével: 6.1 "`iteration`: a legbelső loop hatókör iterációja", 4.6 4. pont "a törzs kontextusa `[...ctx, { kind:'loop', stepRunId, iteration }]`", 4.6 1. pont a lefutásszámot a `step_run.iteration` oszlopra mondja ki, a kontextusra nem. **A motor a spec szerint működik; a SPEC-010 7.5 példái nem.**

### 4.3 Összevetés a SPEC-010 7.5 és 7.3 szövegével

A mért kontextuson, a SPEC-010 7.1 környezettel (hét név, `dyn`) és a 7.3 leképezéssel (`undefined` -> `null`), a pinelt `@marcbachmann/cel-js@8.0.0` ellen (`cel-probe.mjs`, `cel-kimenet.txt`):

```
loop saját | iteration < 3 | HIBA EvaluationError: no such overload: dyn<null> < int
loop saját | iteration < 2 | HIBA EvaluationError: no such overload: dyn<null> < int
loop saját | iteration == null | OK boolean true
loop saját | iteration != null && iteration < 2 | OK boolean false
loop saját | has(steps.torzs) | OK boolean false
loop saját | steps["ellenorzes"].kesz == false | HIBA EvaluationError: No such key: ellenorzes
loop saját | false | OK boolean false
törzs (iteration=1n) | iteration < 3 | OK boolean true
```

| SPEC-010 7.5 példa                  | mért viselkedés a `loop` saját kontextusán                            | következmény a motorban                                         |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `iteration < 3`                     | `EvaluationError: no such overload: dyn<null> < int`                  | az első lefutás `expression_evaluation_failed` osztállyal bukik |
| `steps["ellenorzes"].kesz == false` | `EvaluationError: No such key: ellenorzes` (a törzs node nem látható) | ugyanígy bukik                                                  |

A `loop` saját kifejezése a mai motoron `iteration` alapú és törzs kimenet alapú folytatási feltételt **nem tud kifejezni**. A 7.3 sor (`iteration` -> CEL `int`) a `loop` saját kifejezésére soha nem lép életbe, csak a törzsben és a `loop` utáni node-okon belső ciklus esetén. A T-010-16 (AC48, AC49) a mai motoron csak 0 iterációval teljesíthető. Ha a mai szemantika marad, egy `iteration == null` alakú őr hiba nélkül kiértékelhető, de mindig `true`, tehát egymagában nem ad véges ciklust.

**A mérő által felvetett opciók** (A: a `loop` saját kifejezésében az `iteration` a lefutásszám; B: a törzs utolsó iterációjának kimenete látható; C: motor változatlan, a kifejezés állandó `false`; D: állandó `true` plusz `maxIterations`, a futás `failed`) közül a user **az A opciót választotta** (5. szekció, 6. döntés): a T-010-16 kifejezése `iteration < 2`, `maxIterations` legalább 3, pontosan 2 `loop_iteration_started` esemény (payload `iteration` 0 és 1), a 3. lefutás `false`-szal kilép. A B opció (törzs kimenet látható) **nem lett kiválasztva**; a hatása a SPEC-010 O-12 nyitott kérdése.

### 4.4 Mellékmegfigyelés: a beágyazott `loop` (nyitott)

B eset (`kulso` -> `belso` `continue` él, a `belso` `exit` éle vissza a `kulso`-ra): a futás `succeeded`, de a `belso` **egyszer sem futott** (nincs `step_run` sora), csak `start` és `kulso` (`STEP_RUN` sorok és egyetlen `loop_iteration_started` a nyers kimenetben, B eset). Valószínű ok kódolvasásból, **nem ellenőrzött**: a SPEC-004 4.6 definíciója szerint a `kulso -> belso` él is visszaélnek minősül (a `kulso` elérhető a `belso`-ből), így a `belso`-nek nincs belépő éle. A futás hiba nélkül, csendben `succeeded`. Hogy ez szándékolt korlát, validációs rés vagy motor hiba, azt a mérés nem vizsgálta; a vizsgálat külön folyik (SPEC-004 O-10, "vizsgálat alatt").

## 5. A user döntései (2026-10-21) és az átvezetésük

A döntések szó szerinti rögzítése és a hivatkozott helyek:

| #   | Döntés (user döntés 2026-10-21)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Mérési alap                     | Átvezetve                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | CEL, saját `constructor` kulcsú adat: **elfogadott korlát**. A spec kimondja; az `unsupported_type` CEL hibakód saját magyar mondatot kap.                                                                                                                                                                                                                                                                                                                                                                                                  | 2. szekció (7)                  | SPEC-010 7.3, 9.5, 15. (O-7)                                                                            |
| 2   | CEL, nem string kulcsú map literál: **elfogadjuk**, a kulcs stringgé alakul, és az ütközés miatti csendes adatvesztést a spec kimondja.                                                                                                                                                                                                                                                                                                                                                                                                     | 2. szekció (4)                  | SPEC-010 7.4, 15. (O-8)                                                                                 |
| 3   | Hibaszöveg, CEL és Mustache: **saját leírás mindkettőnél**: hibakódonként (hibaosztályonként) saját magyar mondat plusz pozíció, a kifejezés és a sablon szövege nélkül; a könyvtár `summary`/`message` szövege nem kerül a felhasználó elé.                                                                                                                                                                                                                                                                                                | 2. szekció (4b), 3. szekció (4) | SPEC-010 9.5, 15. (O-9), AC33; PLAN-010 T-010-10                                                        |
| 4   | Mustache, sima változó és szakasz megkülönböztetése: **`Writer` alosztály** (az `escapedValue` és `unescapedValue` felülírása) az `OwnPropertyContext` mellett, saját `Writer` példányon, kikapcsolt gyorsítótárral. Ez a (2) pont eltéréseit is rendezi (`null` -> `String(value)`, a nyers alakok tömbre és objektumra `JSON.stringify`), és a 6.6 szerződést (nincs implicit `valueOf`/`toString` hívás). A T-010-3 (8) elfogadási szövege: "üres vagy `template_render_failed`, függvényhívás és kezeletlen promise elutasítás nélkül". | 3. szekció (2), (3), (6), (8)   | SPEC-010 4.1, 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 15. (O-4, O-5), AC11, AC12, AC14; PLAN-010 T-010-3, T-010-8 |
| 5   | Mustache, primitív érték beépített tulajdonsága (`{{input.tema.length}}`): **hiányzó név marad** (csak saját kulcs olvasható).                                                                                                                                                                                                                                                                                                                                                                                                              | 3. szekció (7)                  | SPEC-010 6.6, 15. (O-10)                                                                                |
| 6   | Motor, a `loop` saját `continueExpression`-je: **a motor adja át a körszámot**: a `loop` saját kontextusában az `iteration` a lefutásszám (0, 1, 2 ...). Motor módosítás, SPEC-004 és SPEC-010 7.5 átvezetéssel; a T-010-16 próba kifejezése `iteration < 2`, `maxIterations` legalább 3, pontosan 2 `loop_iteration_started`.                                                                                                                                                                                                              | 4. szekció                      | SPEC-004 4.6, 6.1, 17. (11a); SPEC-010 7.5, 15. (O-11), AC49; PLAN-010 T-010-4a, T-010-16               |
| 7   | A beágyazott `loop` mellékmegfigyelés (a belső loop egyszer sem fut): **most utánajárunk**, egy másik agent vizsgálja; nyitott pontként rögzítve.                                                                                                                                                                                                                                                                                                                                                                                           | 4. szekció 4.4                  | SPEC-004 15. (O-10)                                                                                     |

A pontosítások, amik döntést nem igényeltek, hanem a mérés javítja a spec szövegét: a 7.2 (a nem deklarált változót az `env.check` adja), az 5.3 (ékezetes mezőnév csak `["mező"]` index alakban), a 7.4 (`Map` csak kontextusból, a map literál három kulcsot eldob, a kontextus referenciáját nem szabad módosítani), a 8. szekció (a `maxDepth` pontos megnevezése), a 7.3 (a `compile` elfogadja az `input.darab + 1` alakot), a 6.4 (a táblázat mért), az M-112 (az escape függvény nem kap `null` értéket és a nyers alak nem hívja).

## 6. Nem ellenőrzött, nem mért

- A három mérés **gépazonossága** (1. szekció).
- A `@types/mustache` `Writer` alosztályának `templateCache` mezője **typecheck alatt** (T-010-5 (2)).
- A Mustache renderelés **ideje** nagy sablonon vagy nagy tömbön (SPEC-010 O-2): nem mértük, csak a CEL (2. szekció (8)).
- A mély `Map` másolás (2. szekció (7), mért kerülő út) **költsége**: nem mért, a döntés (1) szerint nem is kell.
- A `@bufbuild/cel` ugyanerre az esetre: nem mért (a (7) pont C) opciója nem lett kiválasztva).
- Firefox, WebKit: a böngésző oldali futás a T-010-5 tárgya, nem ezé.
