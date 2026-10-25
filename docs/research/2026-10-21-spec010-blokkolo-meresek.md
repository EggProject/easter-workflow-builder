# PLAN-010 F0: a blokkoló mérések (T-010-2 ... T-010-5) és a beágyazott `loop`

|               |                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dátum         | 2026-10-21                                                                                                                                                                                                                                 |
| Terv          | [`../plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../plan/PLAN-010-sablon-es-kifejezes-nyelv.md) T-010-2 ... T-010-5, T-010-6                                                                                                              |
| Spec          | [`../spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../spec/SPEC-010-sablon-es-kifejezes-nyelv.md), [`../spec/SPEC-004-vegrehajto-motor.md`](../spec/SPEC-004-vegrehajto-motor.md)                                                           |
| Mérő eszközök | [`2026-10-21-spec010-blokkolo-meresek/`](2026-10-21-spec010-blokkolo-meresek/): a mérő scriptek és a nyers kimenetek, mappánként egy mérés (`t010-2-cel`, `t010-3-mustache`, `t010-4-motor`, `t010-5-bongeszo-tipusok`, `beagyazott-loop`) |
| Döntések      | az 5. és a 9. szekció: a user 2026-10-21-i döntései és az átvezetésük helye                                                                                                                                                                |

A három mérés eldobható, repón kívüli munkakönyvtárban futott a pinelt verziókkal; a repó `bun.lock` fájlja és munkakönyvtára nem változott. A mérő scripteket és a nyers kimeneteket a `.claude/CLAUDE.md` 12. szekciója ("a számokat előállító mérő eszköz is a repóba tartozik") szerint verziókövetjük. Minden szám, ami a mondatban nincs forrásolva, a mérés nyers kimenetéből jön; a hivatkozott fájl a mondat mellett áll.

## 1. Közös felállás

- **Gép.** Linux `aarch64`, `nproc` 4 mag (`lscpu`: gyártó Apple), 3,8 GiB memória, Node `v26.7.0`, egyetlen szál, más terhelés nélkül. A gépet a T-010-2 jelentése rögzítette (`out-8.txt`, `### gép`); a T-010-3 és a T-010-4 jelentése külön nem rögzítette. A research írásakor ugyanebben a sandboxban lekérdezve azonos a gép (`uname -m`, `nproc`, `lscpu`, `free`, `node -v`). **Nem ellenőrzött**, hogy a három mérés ugyanazon a példányon futott; a munkamenet azonossága az egyetlen alap.
- **Csomagok, pinelt verzióval, repón kívüli telepítésből** (`bun init -y`, majd `bun add <csomag>@<verzió> --exact`):
  - `@marcbachmann/cel-js@8.0.0`, a `bun.lock` integritása `sha512-oaTrAziGr3zDLFiMt/yLU3nZuRMawyWQB5X1a0I7s9eGy3JYzX9l8ZXXHyMd64nzbeVFZTewuUShwsZQdK6UCA==`; a telepített `package.json` `version` mezője `8.0.0`. Egyezik a `2026-08-26-toolchain.md` soraival.
  - `mustache@4.2.0` és `@types/mustache@4.2.6` (ugyanott). A Node `import Mustache from 'mustache'` a csomag `exports.import` mezője szerint a `mustache.mjs` fájlt tölti be, ezért a lent megadott forráshely mind ennek a fájlnak a sora. Lenyomat: `mustache.mjs` sha256 `0f6041f0...c0ac61f2`, `mustache.js` sha256 `a80aca79...af590b90`. Bun `1.4.0`.
  - A mérő mappák `package.json`, `bun.lock`, `tsconfig.json`, `index.ts` fájljai (a `bun init` termékei) **nem kerülnek a repóba**: a `bun run docs:check` a `git ls-files '*/package.json'` alapján minden `package.json` mellé `CLAUDE.md`-t követelne, a többi fájl nem mérő eszköz.
- **A forráshelyek.** A mérő jelentése adta őket; a research írásakor a telepített fájlban újra elolvastam és egyeznek: `lib/index.d.ts` 338, 555, 575, 594; `lib/parser.js` 678, 778, 802; `lib/operators.js` 44 ... 56, 345 ... 353, 471 ... 476, 491, 509; `lib/registry.js` 197, 252, 1384; `lib/evaluator.js` 74 ... 116, 158; `lib/functions.js` 6, 53, 438 ... 439; `lib/globals.js` 1; `lib/options.js` 3 ... 9; `lib/errors.js`; `mustache.mjs` 39 ... 45, 60 ... 75, 141, 211, 246, 375 ... 394, 468 ... 472, 481 ... 493, 509 ... 520, 548 ... 551, 575 ... 580, 586 ... 589, 640, 655 ... 668, 711 ... 713, 757. A motor forráshelyei a `69bf35c` fa sorai; a `a964bb9` (a T-010-1 commit) a `packages/engine` alatt nem módosít, a hivatkozott sorokat ott is újraolvastam.
- **A scriptek formázása.** A repóban a `bun run format:check` kapu a `.mjs` fájlokat is ellenőrzi, ezért a másolatokat Prettier formázta (`prettier --write`); szemantikájuk nem változott. Ellenőrzés: a formázott scriptek újrafuttatva a CEL mérés (1) ... (7) pontjára, az `m2b`, `m4b`, `m7b`, `m7c`, `m7d` scriptre és a Mustache `p1` ... `p7`, `p8b` scriptre bájtra azonos kimenetet adtak a mellékelt `out-*.txt` és `nyers/*.txt` fájlokkal; a `p8` kimenetében kizárólag a verem sorszámai (`lib.mjs:160:40`, `p8-run.mjs:44:13`) tértek el, a formázás miatt. A (8) futásidők nem futottak újra (időmérés, nem determinisztikus).
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

Mérő eszköz: `2026-10-21-spec010-blokkolo-meresek/t010-3-mustache/`: a közös segédek `src/lib.mjs`, a pontonkénti scriptek `src/p1.mjs` ... `src/p8b.mjs`, a (8) hat folyamatos futtatása `src/p8.sh`; a nyers kimenetek `nyers/p1.txt` ... `nyers/p8b.txt` (a mappa eredetileg `out/` volt, amit a gyökér `.gitignore` `out/` sora kizárt, tehát a fájlok nem kerültek a repóba; 2026-10-25-én a mérés idején mentett, bájtra azonos példányból `nyers/` néven felvéve, PLAN-010 T-010-21 A-4). A nézet minden ponton valós alakú `RunContext`: a `packages/engine/src/run-context/run-context.ts` hét kulcsa, a `buildRunContext` kimenetének alakjában (minden kulcs jelen van, a nem érvényes mező értéke `undefined`), az `input` és a `steps` JSON kerekúton (M-106).

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

Kód: `src/p1.mjs`: `&<>"'/`=`bemenet a`{{input.s}}`, `{{{input.s}}}`, `{{& input.s}}`alakra, mindhárom úton;`Mustache.escape === originalEscape`. Nyers kimenet: `nyers/p1.txt`. Mindhárom alak, mindhárom úton a nyolc karaktert változatlanul adja (`&<>"'/`=`); `globalEscapeSameRef: true`; a `Mustache.escape('&<>"\'/`=')` továbbra is HTML escape-el (`&amp;&lt;&gt;&quot;&#39;&#x2F;&#x60;&#x3D;`), config nélkül is. Összevetés a SPEC-010 6.1-gyel: **egyezik.** Forrás: `mustache.mjs` 60 ... 75 (`entityMap`, `escapeHtml`), 663 ... 667 (`escapedValue`), 757 (`mustache.escape = escapeHtml`).

### (2) Szám, logikai érték, `null`, tömb, objektum szöveggé alakítása (6.5, O-5)

Kód: `src/p2.mjs`: tíz érték (`szam`, `tort`, `nulla`, `igaz`, `hamis`, `semmi: null`, `tomb`, `obj`, `uresTomb`, `uresObj`) mindhárom alakban, mindhárom úton. Nyers kimenet: `nyers/p2.txt`. A lényegi sorok:

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

Kód: `src/p3.mjs`: A) a `lookup` hívás argumentumai a `Mustache.render` úton, a hívó verem sorával; A2) a `lookup` paraméterlistája; B) `Writer` alosztály út, 17 sablonon; C) ugyanez a `Context` alosztállyal egyedül; D) veremalapú megkülönböztetés (csak bizonyításként). Nyers kimenet: `nyers/p3.txt`.

- **A blokk:** a `lookup` mindig egyetlen argumentumot, a nevet kapja (`Mustache.Context.prototype.lookup.length` = 1; `mustache.mjs` 393; `@types/mustache` `lookup(name: string): any`), a sima változó (`escapedValue`, `mustache.mjs` 665), a nyers változó (`unescapedValue`, 658), a szakasz (`renderSection`, 588) és a fordított szakasz (`renderInverted`, 620) **ugyanazzal az argumentummal** hívja. A `Context`-en belül az egyetlen megkülönböztető információ a hívási verem (D blokk: működik, de a könyvtár belső függvényneveitől függ, és minifikált vagy átcsomagolt build alatt csendben elromlik; nem javasolt, csak bizonyításként mértük).
- **C blokk** (`Context` alosztály egyedül, `Mustache.render` út): a hiányzó név mindhárom változó alakon csendben üres; a szakasz üres, a fordított szakasz renderel.
- **B blokk** (`Writer` alosztály): a sima változó tag fel nem oldható neve hibát ad, a teljes kért nevet idézve (`input.szerzo.nemletezik`); a szakasz és a fordított szakasz a könyvtár alapértelmezését kapja (`""`, illetve a fordított ág szövege); a szakasz belsejében álló sima változó is hibát ad (`{{#input.elemek}}{{nincs}}{{/input.elemek}}` -> `hiányzó név a sablonban: nincs`). A `{{item}}`, `{{itemIndex}}`, `{{error.kind}}` egy nem `fan_out`/`error_handler` kontextusban hibát ad (a b) értelmezés miatt), ami az 5.1 "vagy hiányzó név" oszlopával egyezik. A `{{input.semmi}}` (érték `null`) a `strict` úton `"null"`-t ad, nem hibát.

Összevetés a SPEC-010 6.7-tel: **a 6.7 által leírt mechanizmus (a saját `Context` alosztály különbözteti meg a két hívást) a pinelt könyvtárral nem valósítható meg tisztán; a megkülönböztetés a `Writer` alosztállyal valósítható meg** (az `escapedValue` és az `unescapedValue` publikus, típusosan deklarált metódus, `@types/mustache` 280. és 294. sor). A szakasz és a fordított szakasz hiba nélküli alapértelmezése mindkét úton egyezik a 6.7-tel. Mellékhatás: a `Writer` alosztály saját példány, tehát nem a `Mustache.render` hívódik (6.2), és a saját gyorsítótárát külön ki kell kapcsolni ((6) pont).

### (4) A négy `parseTemplate` hiba, és mit idéz a sablonból (9.5)

Kód: `src/p4.mjs`: 12 sablon (a négy hiba több alakban, titok jellegű szöveggel és egy érvényes ellenpélda). Nyers kimenet: `nyers/p4.txt`.

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

Kód: `src/p5.mjs`: `{{> x}}`, `a{{>x}}b`, `{{> ../../etc/passwd}}`, `{{> input}}`, `  {{> x}}\nsor`. Nyers kimenet: `nyers/p5.txt`: mind a három úton üres (a standalone sor eleji szóköz és sortörés a könyvtár szokásos szabálya szerint eltűnik). Összevetés a SPEC-010 6.4-gyel és az M-117-tel: **egyezik.** Forrás: `mustache.mjs` 640 (`if (!partials) return;`).

### (6) A gyorsítótár kikapcsolása

Kód: `src/p6.mjs`. Nyers kimenet: `nyers/p6.txt`.

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

Kód: `src/p7.mjs`: 29 sablon a három úton (`stock`, `spec`, `strict`), plusz a `push` felülírásának próbája. Nyers kimenet: `nyers/p7.txt`.

- A 6.4 táblázat mind az öt sora (pontozott név, szakasz tömbön, fordított szakasz üres és hiányzó értékre, partial, határoló csere), a beágyazott szakasz, a `.` név, a szülő kontextus bejárása, a pontozott név szakaszban, a `fan_out`/`loop`/`join`/`error` kontextus: a `spec` és a `strict` út kimenete **bájtra azonos** a könyvtár gyári kimenetével (28 sor a 29-ből; a 29. a `{{input.tema.length}}`, lásd lent). **Egyezik.** A `steps.node-1.summary` (kötőjeles azonosító) működik; a pont az egyetlen névelválasztó.
- A `push` felülírása szükséges és hat: a szonda minden `lookup` hívásnál `OwnPropertyContext` példányt lát; felülírás nélkül a szakasz belseje alap `Context` lesz (`mustache.mjs` 385 ... 387), és `{{#input.elemek}}{{constructor.name}}{{/input.elemek}}` kimenete `StringString`. **Egyezik** az M-134-gyel és a 6.6 2. pontjával.
- **Egy eltérés a könyvtár alapviselkedésétől:** `{{input.tema.length}}` gyári kimenete `22`, az alosztállyal üres (`spec`) vagy hiba (`strict`). A könyvtár a pontozott név utolsó szegmensét primitíven saját tulajdonságként elfogadja (`mustache.mjs` 39 ... 45, `primitiveHasOwnProperty`). Az alosztály ezt szándékosan nem engedi; a 6.6 "a nézet adatának saját tulajdonsága" mondata nem döntötte el, hogy egy szöveg hossza ide tartozik-e. A tömb `length`-je (saját adat tulajdonság) mindhárom úton `2`.

### (8) Támadó sablon lista, csapda függvényekkel és `unhandledRejection` figyelővel

Kód: `src/p8-run.mjs` (30 támadó sablon: a terv kötelező 9 eleme plusz 21 bővítés), `src/p8.sh` (hat külön folyamat), `src/p8b.mjs` (jogos nyers tag a `spec` és `strict` úton). A csapdák a beépített metódusokat (`Array.fromAsync`, `Array.from`, `Array.prototype.map`, `Array.prototype.toString`, `Object.prototype.toString`, `valueOf`, `hasOwnProperty`, `Object.keys`, `String.prototype.toString`, `valueOf`) és egy saját tulajdonságként a nézetbe tett `input.trapFn` függvényt számlálóval burkolják, és csak a `render` hívás idejére élesek. Nyers kimenet: `nyers/p8.txt`, `nyers/p8b.txt`.

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
| 7   | A beágyazott `loop` mellékmegfigyelés (a belső loop egyszer sem fut): utánajárás, eredménye a 8. szekció; a döntések a 9. szekcióban.                                                                                                                                                                                                                                                                                                                                                                                                       |

A pontosítások, amik döntést nem igényeltek, hanem a mérés javítja a spec szövegét: a 7.2 (a nem deklarált változót az `env.check` adja), az 5.3 (ékezetes mezőnév csak `["mező"]` index alakban), a 7.4 (`Map` csak kontextusból, a map literál három kulcsot eldob, a kontextus referenciáját nem szabad módosítani), a 8. szekció (a `maxDepth` pontos megnevezése), a 7.3 (a `compile` elfogadja az `input.darab + 1` alakot), a 6.4 (a táblázat mért), az M-112 (az escape függvény nem kap `null` értéket és a nyers alak nem hívja).

## 6. Nem ellenőrzött, nem mért

- A három mérés **gépazonossága** (1. szekció).
- A `@types/mustache` `Writer` alosztályának `templateCache` mezője typecheck alatt: **mérve a T-010-5-ben** (7. szekció (2)).
- A Mustache renderelés **ideje** nagy sablonon vagy nagy tömbön (SPEC-010 O-2): nem mértük, csak a CEL (2. szekció (8)).
- A mély `Map` másolás (2. szekció (7), mért kerülő út) **költsége**: nem mért, a döntés (1) szerint nem is kell.
- A `@bufbuild/cel` ugyanerre az esetre: nem mért (a (7) pont C) opciója nem lett kiválasztva).
- Firefox, WebKit: a böngésző oldali futás a T-010-5 tárgya, nem ezé.

## 7. T-010-5: böngésző, típusok, instrumentálás

Mérés: 2026-10-21, a `main` `69bf35c` eldobható, detached másolatán, commit nélkül. Pinelt verziók: `mustache@4.2.0`, `@marcbachmann/cel-js@8.0.0`, `@types/mustache@4.2.6`, mind tartomány nélkül. A mérő forrás, a nyers kimenetek és a másolat teljes diffje: `2026-10-21-spec010-blokkolo-meresek/t010-5-bongeszo-tipusok/` (a TypeScript fájlok `.masolat` végződéssel, hogy a kapuk ne olvassák). Felállás: ideiglenes `packages/workflow-language` csomag (a T-010-7 tervezett neve), `tsconfig` a `core` mintájával `skipLibCheck` nélkül (a két könyvtár `.d.ts` fájljai is ellenőrzöttek), `package-layer.ts` L1 érték, az `apps/web` egy importtal mindkét gyártó függvényt behúzza.

### (1) `vite build` és bundle méret

Mindkét build (`bun x vite build` az `apps/web`-ből) hiba nélkül fut; a figyelmeztetés csak a meglévő "chunks larger than 500 kB".

|           | JS bájt           | vite gzip | `gzip -9c` bájt | sourcemap   |
| --------- | ----------------- | --------- | --------------- | ----------- |
| alap      | 712 192           | 217,56 kB | 214 519         | 3 600,26 kB |
| utána     | 803 384           | 243,92 kB | 240 555         | 3 903,05 kB |
| különbség | +91 192 (+12,8 %) | +26,36 kB | +26 036         | +302,79 kB  |

Küszöb nincs, csak feljegyzés. A sourcemap szerint a bundle-be a `mustache@4.2.0/mustache.mjs` (az `exports` `import` ága) és a cel-js `lib/` 12 fájlja került. A cel-js a `Buffer` globálist csak `typeof Buffer !== 'undefined'` őr mögött használja, `node:` importja nincs; a meglévő `browser-safe-imports.spec.ts` az új függőséggel zöld. Nyers: `raw/base-build.txt`, `raw/after-build.txt`.

### (2) `typecheck` és `lint`

A két csomag hívása és mindkét alosztály `as`, `any`, `!`, `private` és `eslint-disable` nélkül átmegy mindkét kapun: `TURBO_CONCURRENCY=1 bun run typecheck` 26/26 sikeres; `bun x turbo run lint --concurrency=1` 45/45 sikeres; `bun run vitest run packages/workflow-language` 16/16 zöld. Egyetlen szabály bukott, az a globális gyorsítótár értékadásáé (lent). Nyers: `raw/typecheck.txt`, `raw/lint-full-1.txt`, `raw/lint-2pkg*.txt`.

| Probléma                                                                                                                               | Forrás                                                                                                                                                                                             | Szabályos megoldás, mérve                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `Writer` példány `templateCache` mezőjét a típus nem deklarálja                                                                      | `@types/mustache/index.d.ts` `class Writer` (nincs `templateCache`); a futásidő a konstruktorban állítja (`mustache.mjs` 481-494), a `parse` `undefined` esetén nem tárol (`mustache.mjs` 510-521) | Az alosztály saját mezőt deklarál: `templateCache: Mustache.TemplateCache \| undefined = undefined;`. Modul augmentáció, `as` és `override` nem kell (a bázistípusban nincs ilyen tag). A futásidejű teszt szerint az érték `undefined`. |
| `Context.view: any`, `lookup(): any`, `push(view: any)`                                                                                | `@types/mustache/index.d.ts` 77, 91, 99                                                                                                                                                            | Az alosztály nem olvassa a `this.view` mezőt: saját `#ownView` és `#ownParent` mezőt tart; `override lookup(name): unknown` és `override push(view: unknown): OwnPropertyContext`.                                                       |
| `escapedValue(token, context, ...)`: a `context` a bázis típusa, a `token[1]` a `noUncheckedIndexedAccess` miatt `string \| undefined` | `@types/mustache/index.d.ts` 280, 294-298                                                                                                                                                          | `instanceof OwnPropertyContext` szűkítés és `undefined` ellenőrzés. A `Writer.render` a már `Context` példányt nem csomagolja újra (`mustache.mjs` 549).                                                                                 |
| `Writer.parse(): any`, CEL `evaluate(): any`                                                                                           | `@types/mustache/index.d.ts` 127; `@marcbachmann/cel-js/lib/index.d.ts` 133, 594                                                                                                                   | `const tokens: unknown = ...`, `const value: unknown = ...`                                                                                                                                                                              |

### A globális `Mustache.templateCache` (user döntés: nem nyúlunk hozzá)

- `Mustache.templateCache = undefined;` (default import) a `tsc` kapun átmegy (`@types/mustache/index.d.ts` 30: `export let templateCache`), a `lint` kapun **bukik**: `create-mustache-template-renderer.ts:18:3 error Assignment to member of namespace 'Mustache' import-x/namespace` (`raw/lint-2pkg.txt`). A szabály az `importX.flatConfigs.recommended` része (`eslint-plugin-import-x@4.17.1`), a default importot is névtérként kezeli, ha a feloldott modul exportjának névtere van.
- `Reflect.set(Mustache, 'templateCache', undefined)` mindkét kapun átmegy, és a globális érték `undefined` lesz, de ez a szabály betűjét tartja be, a szándékát (importált névtér módosítása) megkerüli. Nem választott út.
- A saját `Writer` példány mellett a globális gyorsítótár hatástalan a mi utunkon, ha a csomag a `Mustache.render` és `Mustache.parse` függvényt nem hívja. A user döntése: a globálishoz nem nyúlunk, és ezt greppes invariáns őrzi (SPEC-010 6.3, 16. szekció 63. kritérium).

### (3) `vite-plugin-istanbul` és a workspace csomag

**Nem instrumentálja.** `VITE_COVERAGE=true bun x vite build` az `apps/web`-ből (a `playwright.config.ts` `webServer` parancsával azonos env és munkakönyvtár), egyszer a csomag importjával, egyszer a `HEAD` `main.tsx`-ével; az Istanbul fájlonkénti coverage objektumának `path:` mezőit gyűjtve:

|             | instrumentált fájl | ebből `apps/web/src` | ebből `packages/*` |
| ----------- | ------------------ | -------------------- | ------------------ |
| alap        | 177                | 177                  | 0                  |
| a csomaggal | 177                | 177                  | 0                  |

A két lista bájtra azonos (`raw/cov-base-paths.txt`, `raw/cov-after-paths.txt`), a csomag kódja viszont a bundle-ben van. A meglévő workspace csomagok (`ui`, `protocol`, `core`) sem instrumentáltak. Forrás, miért: a plugin a `test-exclude` csomaggal dönt (`vite-plugin-istanbul@9.0.1` `dist/index.mjs` 116-129, 194: `cwd = opts.cwd ?? process.cwd()`, `excludeNodeModules: true`), és a `test-exclude@8.0.0` `index.js` 86-92 a munkakönyvtáron kívüli fájlt nem instrumentálja. A PLAN-010 6. szekció megfelelő sora ezért nem lép életbe. Az `[INVALID_ANNOTATION]` figyelmeztetés mindkét buildben azonos számú, a csomag nem hozott újat.

Megfigyelés a T-010-8-hoz (nem blokkoló): a `StrictWriter` két védő ága (`token[1] === undefined`, nem `OwnPropertyContext` kontextus) a könyvtár útján nem fut, a 100 százalékos kapuhoz közvetlen metódushívással kell tesztelni, vagy más alakot kell találni.

## 8. A beágyazott `loop`: a belső ciklus nem fut, a futás mégis `succeeded`

Mérés: 2026-10-21, a `main` `69bf35c` eldobható másolatán (a `packages/engine` és az `apps/*` forrása a `c2138c2` fejen azonos). Mérő eszközök: `2026-10-21-spec010-blokkolo-meresek/beagyazott-loop/` (a két próba `.masolat` végződéssel, a nyers kimenetek, a `futas-elakadas/` mappa). Valódi `createEngine`, valódi `openDatabase(':memory:')` a commitolt migrációkkal, a `create-engine.spec.ts` harnessa, a meglévő hamis agent; valódi API hívás nincs. A kifejezés port "CIKLUS-n" szövegre számlál: n igaz után egy hamisat ad (a belső `loop` így minden külső iterációban kétszer folytat, a 3. lefutáson kilép); `maxIterations` 5.

### 8.1 A mért alakok

| Alak                                                                                 | Élek                                                                                                                                                                                                        | Visszaél halmaz (mai definíció) | `validateRun`, `replaceGraph` | Futás                         | `step_run` sorok                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| K: kontroll, egyszintű `loop`                                                        | `start->belso`, `belso-continue->torzs`, `torzs->belso`, `belso-exit->vege`                                                                                                                                 | `e3`                            | ok, ok                        | `succeeded`                   | start, belso 0, torzs 0, belso 1, torzs 1, belso 2, vege (helyes)                                      |
| (a) belső `exit` közvetlenül a külsőre                                               | `e1 start->kulso`, `e2 kulso-continue->belso`, `e3 belso-continue->torzs`, `e4 torzs->belso`, `e5 belso-exit->kulso`, `e6 kulso-exit->vege`                                                                 | `e2, e4, e5`                    | ok, ok                        | `succeeded`, `errorKind=null` | **csak** start, kulso 0                                                                                |
| (b) belső `exit` egy `koztes` node-on át vissza a külsőre, a belső előtt `elo` node  | `e1 start->kulso`, `e2 kulso-continue->elo`, `e3 elo->belso`, `e4 belso-continue->torzs`, `e5 torzs->belso`, `e6 belso-exit->koztes`, `e7 koztes->kulso`, `e8 kulso-exit->vege`                             | `e3, e5, e7`                    | ok, ok                        | `succeeded`, `errorKind=null` | **csak** start, kulso 0, elo 0                                                                         |
| (c) villa: a belső `exit` nem tér vissza, a külső visszaéle egy párhuzamos ágról jön | `e1 start->kulso`, `e2 kulso-continue->elo`, `e3 elo->belso`, `e4 belso-continue->torzs`, `e5 torzs->belso`, `e6 belso-exit->belso_vege`, `e7 elo->visszavez`, `e8 visszavez->kulso`, `e9 kulso-exit->vege` | `e5, e8`                        | ok, ok                        | `succeeded`                   | mind lefut (12 sor); a `vege` a belső 2. törzs lefutásával párhuzamosan, a belső ciklus vége előtt fut |

Az (a) és (b) alakon a belső `loop` minden belépő éle visszaélnek minősül, ezért a példánya örökre `waiting`. Nyers: `nyers-valodi.txt`, `nyers-valodi-tiszta.txt`.

### 8.2 Ugyanez dominancia alapú visszaél definícióval

`vi.mock` cseréli a `findLoopBackEdges` függvényt (a motor többi része valódi): `u -> v` visszaél, ha `v` típusa `loop`, és `v` dominálja `u`-t a `start` node-tól, iteratív dominátor számítással.

| Alak | Visszaél halmaz | Futás       | `step_run` sorok                                                                                                               |
| ---- | --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| K    | `e3`            | `succeeded` | változatlan, helyes                                                                                                            |
| (a)  | `e4, e5`        | `succeeded` | start, kulso 0, belso 0/1/2 (szülő `kulso`), torzs 0/1 (szülő a belső lefutás); **a `kulso` 2. lefutása és a `vege` hiányzik** |
| (b)  | `e5, e7`        | `succeeded` | start, kulso 0, elo 0, belso 0/1/2, torzs 0/1, koztes 0, kulso 1, vege 0: a várt teljes sorrend                                |
| (c)  | `e5, e8`        | `succeeded` | változatlan a valódi motorhoz képest                                                                                           |

A két javítás együtt (dominancia plusz az `exit` jelölés kontextusa) **nem mért**: az (a) alak teljes sorrendje a SPEC-004 17. szekció 11b kritériuma szerint a PLAN-010 T-010-4b feladata. Nyers: `nyers-dominancia.txt`, `nyers-dominancia-tiszta.txt`.

### 8.3 Gyökérok, forráshelyek (`69bf35c`)

1. **A visszaél halmaz.** `packages/engine/src/run-graph/find-loop-back-edges.ts:22-28`: minden `loop` node-ra a teljes gráfon számolt elérhetőség, és minden bejövő él visszaél, aminek a forrása elérhető. Ez szó szerint a SPEC-004 4.6 korábbi definíciója. Beágyazásnál a belső `loop`-ból a külső visszaélen át a külső `loop`, onnan a külső törzse elérhető, tehát a belső `loop` minden belépő éle visszaélnek minősül. Spec hiba, nem motor eltérés.
2. **A belépő él nélküli `loop` örökre vár.** `scheduling/resolve-instance-readiness.ts:112-115`: a futtathatóság csak a belépő éleket nézi, és üres belépő halmazra `waiting`-et ad.
3. **Rejtett motor hiba, ami a definíció javítása után jön elő.** `scheduling/advance-scheduler.ts:332-337`: a `loop` kilépő lefutása az `exit` élekre a `loop` példány saját kontextusában tesz jelölést, a `markContextOnEdge` nélkül, holott az `applyOutgoingMarks` és az `applyDeferredMarks` visszaélnél a cél `loop` külső kontextusát használja. Ha a belső `loop` `exit` éle közvetlenül a külső `loop`-ra mutat ((a) alak), a jelölés rossz kontextusba kerül, a külső `loop` nem lesz futtatható. A (b)-ben ez nem jön elő, mert a visszaél forrása közönséges node. Ugyanez a 345-349. sor `continue` ágára is áll elvben; ilyen alakot nem mértünk.
4. **A bennragadt futás csendben `succeeded`.** `scheduling/is-run-terminal.ts:16-17` és `run-supervisor/advance-run.ts:712-727` (`finishRun`) a `error-policy/resolve-run-completion.ts:26-31` alapján: kezeletlen hiba nélkül a zárás `succeeded`. A várakozó példányokat és a fel nem használt jelöléseket semmi nem vizsgálja. Spec hiány: a SPEC-004 4.4 6. pontja betű szerint ezt írja.
5. **A mentési és indítási ellenőrzés mindhárom alakot elfogadja.** A `validateRun` (`validate-run.ts:91-104`) minden lépése zöld; a `validate-loop-back-edge-body.ts` törzs fogalma a teljes gráfon számolt elérhetőség. A SPEC-008 15. szekció 12. kritériuma a gráf szemantikai validációt a webben tiltja.
6. **A `loop` saját kifejezése a külső iterációt látja.** A (c) alakon és a 8.2 táblákon a belső `loop` saját kifejezése `iteration: 0` értéket kap minden belső lefutáson (a külső ciklus iterációja), mert a belső példány kontextusának legbelső `loop` kerete a külsőé. A user O-11 döntése szerinti változtatás tehát beágyazásnál a külső iteráció felülírása a saját lefutásszámmal (SPEC-004 6.1).

### 8.4 A dominancia alapú definíció forrásai (Exa, 2026-10-21)

- University of Wisconsin CS 701: <https://pages.cs.wisc.edu/~fischer/cs701.f14/finding.loops.html>: "An arc (or edge) from node N to node H is a back edge if H dominates N." és "Since loops can nest, a header for one loop can be in the body of (but not the header of) another loop."
- Cornell CS 4120, 25. előadás: <https://www.cs.cornell.edu/courses/cs4120/2016sp/lectures/25cflow/lec25-sp16.pdf>: "An edge from A to B is called a forward edge if A dom B and a back edge if B dom A."
- UIUC CS 526: <http://misailo.web.engr.illinois.edu/courses/526-sp17/lec1.pdf>: "Def. Back Edge: An edge n → d where d dom n", és "Identifies nested loops (if different headers)".
- Kiegészítő: Wikipedia "Control-flow graph" (<https://en.wikipedia.org/wiki/Control-flow_graph>) és az LLVM Loop Terminology (<https://llvm.org/docs/LoopTerminology.html>).

Ezek a definíciót igazolják a fordítóprogramok vezérlési gráfjára, nem azt, hogy a mi motorunkra a csere minden alakon helyes: azt csak a 8.2 mérése mutatja, a K, (b), (c) alakra.

### 8.5 Az elakadt futás vizsgálata (a `run_stalled` szabály alapja)

A kérdés: van-e jogos, `succeeded` végállapot, ahol fel nem használt jelölés marad. Az eldobható próba (`futas-elakadas/stall-probe.ts.masolat`, a `finishRun` kapcsolása: `futas-elakadas/advance-run.diff.masolat`) a `resolveRunCompletion` után minden terminális futásnál végigmegy az `edgeMarks` jelölésein, és kiírja azokat, amelyek célpéldánya a `resolveInstanceReadiness` szerint `waiting` (külön a `live` jelölésűeket és az összeset).

- **A tesztkészlet:** a `packages/engine` 117 fájlja és 798 tesztje (113 commitolt fájl és négy eldobható próba: `t010-4-probe`, `nested-loop-probe`, `nested-loop-dominator-probe`, `stall-shape-probe`), valamint a `packages/db`, a `packages/protocol` és az `apps/server` 170 fájlja és 2092 tesztje, mind zöld. **A commitolt tesztekben nulla találat.** Ebben benne vannak a `fan_out` N = 0, `error_handler`, `human_approval`, `fail_branch`, `fail_run` és `sub_workflow` esetek. Nyers: `futas-elakadas/futas-engine-teljes.txt`, `futas-server-teljes.txt`, `out.jsonl`.
- **Találat négyszer, mind az eldobható beágyazott `loop` próbákból** (`futas-elakadas/out.jsonl`): a mai definícióval a T-010-4 próba B esete (`e2:live->belso`), az (a) alak (`e2:live->belso`) és a (b) alak (`e3:live->belso`); a dominancia alapú halmazzal az (a) alak, a kilépő jelölés javítása nélkül (`e5:live->kulso`). Mind a négyben a fel nem használt `live` jelölések halmaza és az összes jelölés halmaza azonos.
- **Egy téves hipotézis, megcáfolva:** az S1 alak (a törzsből a ciklus utáni node-ra mutató közvetlen él) nem ad csendes kihagyást: a `validateRun` `unbalanced_fan_out_scope` hibával elutasítja (`stall-shape-probe`, `s1_torzs_kozvetlen_el_a_ciklus_utani_nodera`). Az S2 kontroll alak nem ad elakadást. Ezért a `run_stalled` regressziós tesztje a `RunTopology.loopBackEdgeIds` halmazt kézzel adja meg a régi definíció szerint.
- **Jogos `live` jelöléssel elakadó eset:** a commitolt tesztekben és a vizsgált alakokban nincs. A forrás olvasása szerint minden jogos eset eldönti a jelölt példányt (a nem választott ág `dead`, a `fan_out` N = 0 nem jelöl, a `loop` kilépő lefutás az `exit` ágra `live` jelölést tesz, az `error_handler` halasztott jelölései véglegesülnek; SPEC-004 4.9). **Nem bizonyított, hogy tetszőleges gráfon nincs jogos elakadás** (nem ellenőrzött); a T-010-4b ezért a teljes tesztkészleten megismétli a mérést.

### 8.6 Újramérés a PLAN-010 T-010-4b után (a `run_stalled` bevezetése)

Felállás: a `feat/spec-010-sablon-es-kifejezes` ág T-010-4b munkapéldánya (a `0b91a07` fölött, a dominancia alapú `findLoopBackEdges`, a `markContextOnEdge` a `loop` lefutás lezárásában, a `findStalledInstances` és a `run_stalled` ág bekötve). Eldobható, nem commitolt próba: a `finishRun` a `resolveRunCompletion` után, a leállítás vizsgálata ELŐTT, minden terminális futásnál meghívta a `findStalledInstances` függvényt, és a nem üres eredményt a teszt nevével, a futás záró állapotával és a leállítás jelzőivel egy JSONL fájlba írta (a 8.5 próbájának elve, a jelölés fajtájától függetlenül). Futtatás: `node_modules/.bin/vitest run packages/engine packages/db packages/protocol apps/server --coverage.enabled=false`.

- **A tesztkészlet:** 284 fájl, 2899 teszt, mind zöld.
- **Találat kettő**, mindkettő az `advance-run.spec.ts` szándékosan bennragadó tesztjeiből (a 4.6 (a) alak a régi, elérhetőség alapú visszaél halmazzal, kézzel megadott `RunTopology.loopBackEdgeIds`): a `run_stalled` regressziós teszt (`succeeded` helyett `failed`, elakadt példány `belso`), és a kezeletlen hibával záró társa (`failed`, a vizsgálat ott nem írja felül az első kezeletlen hibát, elakadt példány `belso`).
- **Jogos végállapoton nulla találat**, a `failed` és a leállított futásokat is beleértve. A próba a mérés után eltávolítva, a forrás bájtra visszaállítva (`cmp`).

### 8.7 A `loop` kilépő ágának köre (PR #55 review, javítva)

Mérés: 2026-10-21, a `feat/spec-010-sablon-es-kifejezes` ág `c796bc7` fején, eldobható próbával a `create-engine.spec.ts` harnessában (valódi `createEngine`, valódi `:memory:` adatbázis, hamis agent, a 8. szekció "CIKLUS-n" számláló kifejezés portja `CIKLUS-1` kifejezéssel, `maxIterations` 5). A próba a mérés után eltávolítva, a fájl bájtra visszaállítva.

| Alak                                                                     | `validateRun` (`c796bc7`)  | Futás (`c796bc7`)                       | `step_run` sorok                                                                           |
| ------------------------------------------------------------------------ | -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| X: `start->lp`, `lp-continue->torzs`, `torzs->lp`, `lp-exit->x`, `x->lp` | ok                         | `failed`, `loop_max_iterations_reached` | start 0, lp 0, torzs 0, lp 1, x 0, lp 2, torzs 2, lp 3, x 0, lp 4, torzs 4, lp 5           |
| X2: mint X, de `lp-exit->x`, `x->y`, `y->lp`                             | ok                         | `failed`, `loop_max_iterations_reached` | start 0, lp 0, torzs 0, lp 1, x 0, y 0, lp 2, torzs 2, lp 3, x 0, y 0, lp 4, torzs 4, lp 5 |
| EXITSELF: `start->lp`, `lp-continue->torzs`, `torzs->lp`, `lp-exit->lp`  | ok                         | `failed`, `loop_max_iterations_reached` | start 0, lp 0, torzs 0, lp 1, lp 2, torzs 2, lp 3, lp 4, torzs 4, lp 5                     |
| MERGE: `lp-continue->torzs`, `torzs->m`, `lp-exit->m`, `m->lp`           | `unbalanced_fan_out_scope` | nem indul                               | nincs                                                                                      |

A `loop` minden kilépése után a kilépő ág visszavitte a vezérlést ugyanabba a `loop`-ba, és csak a `maxIterations` állította meg. Gyökérok: a `validate-loop-back-edge-body.ts` törzs fogalma a teljes gráfon számolt elérhetőség volt, tehát a `torzs -> lp` élen át a `loop`, onnan az `exit` ág node-ja is a törzsbe került. A javítás (SPEC-004 4.6 "A 3. lépés törzs fogalma"): a törzs a `continue` célpontokból a `loop` node újbóli érintése nélkül elérhető rész, a `loop` önmagára mutató `continue` éle a törzsből érkezőnek számít. A javítás után az X, X2 és EXITSELF alak a meglévő `loop_back_edge_outside_body` osztállyal, `workflow_run` sor nélkül utasítódik el (`validate-run.spec.ts`, `validate-loop-back-edge-body.spec.ts`, `create-engine.spec.ts`); a javítás előtti `validate-loop-back-edge-body.ts`-sel mind a négy új regressziós teszt bukik. A MERGE alakot már a 4.5 hatókör ellenőrzés elutasítja. A K, (a), (b), villa alak, két egymás utáni `loop`, a `fan_out` törzsében álló `loop` és a `loop` önmagára mutató `continue` éle érvényes marad; a `packages/engine` teljes tesztkészlete zöld.

**Miért a `loop_back_edge_outside_body`, és nem új osztály vagy a `graph_cycle_detected`.** Az `x -> lp` élt az `lp` dominálja, tehát a 4.6 definíciója szerint visszaél, és a visszaélek elhagyása után nincs kör: a `graph_cycle_detected` (2. lépés) ezért nem szólalhat meg. A 3. lépés szövege ("Minden visszaél forrásának a `loop` node törzsében kell lennie, azaz elérhetőnek a `loop` node `continue` élein át") pontosan erre az élre mond nemet, ha a "`continue` élein át" a `loop` újbóli érintése nélküli elérhetőséget jelenti; a hibaosztály REST oldalon már `422 unprocessable` (`apps/server` `map-outcome-message-to-error-code.ts`).

### 8.8 A `validateRun` hibaágai a dominancia átállással (PLAN-010 T-010-4b)

Mérés: 2026-10-21, ugyanaz a próba a `0b91a07` (a régi, elérhetőség alapú `findLoopBackEdges`) és a javított fej `packages/engine/src` fáján (a két fa között más csomag forrása nem változott, `git diff --stat 0b91a07 c796bc7`). A PR #55 review három alakja:

| Alak                                                                                                                   | `0b91a07`                                        | Most                                                | REST |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- | ---- |
| `A -> L` belépő él egy körben: `start->a`, `a->lp`, `lp-continue->torzs`, `torzs->a`, `lp-exit->vege`                  | átment, futás csendben `succeeded`, sor: start 0 | `graph_cycle_detected` (a, lp, torzs)               | 422  |
| törzs node külső második bejövő éllel: `start->lp`, `start->torzs`, `lp-continue->torzs`, `torzs->lp`, `lp-exit->vege` | `unbalanced_fan_out_scope`                       | `graph_cycle_detected` (lp, torzs)                  | 422  |
| `L -exit-> u -> L` (8.7 X alak)                                                                                        | átment, `failed` `loop_max_iterations_reached`   | `loop_back_edge_outside_body` (a 8.7 javítása után) | 422  |

Az első két sorban a `0b91a07` a `torzs -> a`, illetve a `torzs -> lp` élt visszaélnek vette (a forrás elérhető volt a `loop`-ból); a dominancia alapú definíció szerint a `loop` nem dominálja a forrást, a kör megmarad, és a 2. lépés jelez. A REST kód mindhárom osztályra a `ENGINE_VALIDATION_ERROR_CLASSES` listából jön.

### 8.9 A T-010-4b szándékos rontásai

A T-010-4b végrehajtó jelentése szerint (itt nem futtattuk újra) négy rontás bukó tesztekkel: a régi `findLoopBackEdges` visszahelyezésével 9 teszt bukott; a `markContextOnEdge` hívás nélkül a beágyazott (a) alak tesztjei; a T-010-4a (a `loop` saját `iteration` értéke) nélkül a 11a és a 11e teszt; a `run_stalled` vizsgálat nélkül a `run_stalled` regressziós teszt.

### 8.10 A 44a kritérium leállítási ága (PR #55 review, J1)

A "megszakításnál és szabályos leállásnál a vizsgálat nem fut" részt korábban csak egy üres ütemezőn futó teszt fedte, ahol elakadt példány nem is keletkezhet. Az `advance-run.spec.ts` két új tesztje a 4.6 (a) alakot a régi visszaél halmazzal futtatja, és a külső leállítást a `kulso` lefutása közben adja (a kifejezés port hívásában): egyszer a `stopRequested` jelzővel (megszakítás), egyszer a valódi `shutdownActiveRuns` menettel. Mindkettő ellenőrzi, hogy a terminális ponton tényleg van elakadt példány (`findStalledInstances` nem üres), a hurok `succeeded` záró értéket ad, `run_finished` esemény nincs, a futás sora megszakításnál `running` (a megszakító fél zár), leállásnál `interrupted` egy `run_interrupted` eseménnyel. Szándékos rontás (nem commitolva): a `withStallCheck` a `finishRun` `stopRequested` ága elé téve mindkét új teszt bukik; a `stopRequested` ág törlésével a két új és a meglévő "külső leállítás után" teszt bukik.

## 9. A user további döntései (2026-10-21, a mérések után) és az átvezetésük

| #   | Döntés                                                                                                                                                                                                                                                                                  | Átvezetve                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 8   | A beágyazott `loop` támogatott, javítjuk: a visszaél dominancia alapú, a `loop` jelölései a visszaél szabályt követik. A SPEC-004 O-10 lezárva.                                                                                                                                         | SPEC-004 4.6, 15. (O-10), 17. (10a, 11b ... 11e); PLAN-010 T-010-4b |
| 9   | A bennragadt futás sikertelen, új nevesített `EngineErrorKind` ággal (`run_stalled`); jogos végállapotot nem érint. Nem tagja a `ProtocolErrorClass` részhalmaznak, mert csak a `run_finished` payloadban és a `workflow_run.error_kind` oszlopban jelenik meg, REST hibatörzsben soha. | SPEC-004 4.4, 4.9, 8.4, 13., 17. (44a); PLAN-010 T-010-4b           |
| 10  | A villa alak elfogadva: a külső ciklus nem vár a belső `loop`-ra; aki várakozást akar, kösse vissza a belső kimenetet.                                                                                                                                                                  | SPEC-004 4.6                                                        |
| 11  | A Mustache gyorsítótárat csak a saját `Writer` kapcsolja ki, a globális `Mustache.templateCache`-hez nem nyúlunk, és a csomag nem hívja a globális `Mustache.render` és `Mustache.parse` függvényt.                                                                                     | SPEC-010 6.3, 16. (63); PLAN-010 T-010-8, T-010-11                  |
| 12  | A névidézés aszimmetriája marad (a CEL nem idéz kulcsnevet, a Mustache hiányzó név hibája idéz).                                                                                                                                                                                        | SPEC-010 9.5, 15. (O-9)                                             |
| 13  | Az O-1, O-2, O-3 korlátkérdés: most nincs korlát, "Lezárva" jelöléssel a táblában; az O-2 mért futásidőkkel és a kimondott korláttal, hogy a szinkron kiértékelés alatt a szerver mást nem szolgál ki. Később újranyitható.                                                             | SPEC-010 8., 14., 15.                                               |
| 14  | Az O-12: marad a mai szabály (SPEC-004 6.2), a user a "csak körszám" opciót választotta.                                                                                                                                                                                                | SPEC-010 7.5, 15. (O-12)                                            |
| 15  | A `graph_cycle_detected` felhasználói mondata általánosabb: "A gráf olyan kört tartalmaz, amely nem egyetlen Ciklus csomóponton keresztül indul." (PR #55 review).                                                                                                                      | SPEC-007 8.4; `apps/web` `protocol-error-message`                   |
| 16  | A `loop` kilépő ágáról ugyanabba a `loop`-ba visszatérő gráfot a futás indítási ellenőrzés elutasítja, most javítjuk (PR #55 review, 8.7).                                                                                                                                              | SPEC-004 4.6, 17. (10)                                              |

## 10. PR #56 review: a Mustache kiírás és a CEL közös hivatkozás (2026-10-25)

Saját, eldobható próbák a repón kívül, a csomag forrását importálva (Node v26.7.0, aarch64, 4
vCPU, 3906 MB memória, a V8 `heap_size_limit` értéke kapcsoló nélkül 2149 MB).

### 10.1 J1: a `JSON.stringify` mást írt ki, mint amit a vizsgálat bejárt (javítva)

A vizsgálat a mezőket tulajdonság leírón át olvasta, a `JSON.stringify` viszont a `[[Get]]` úton
(és a `toJSON` függvényt is így keresi). A saját `toJSON` függvény mező és getter már a vizsgálaton
bukott, a null prototípusú objektum nem örököl. Átment viszont, és mást írt ki:

| Bemenet                                                        | Vizsgálat | Kiírt szöveg (javítás előtt)  |
| -------------------------------------------------------------- | --------- | ----------------------------- |
| `Proxy` `{ a: 1 }` körül, `get` csapda `toJSON` és `a` kulcsra | átment    | `"HAMIS"`                     |
| `Proxy` `[1, 2]` körül, `get` csapda a `0` indexre             | átment    | `["HAMIS",2]`                 |
| `Object.prototype.toJSON` globális felülírása (szennyezés)     | átment    | a felülíró függvény eredménye |
| `Array.prototype.toJSON` globális felülírása, beágyazva        | átment    | `{"l":"SZENNYEZETT_TOMB"}`    |

A javítás: a vizsgálat (`copyJsonValue`) a bejárt adat tiszta másolatát építi, és a
`JSON.stringify` azt kapja; a két `Proxy` sor utána a vizsgált adatot írja ki (`{"a":1}`,
`[1,2]`), és a regressziós tesztek a régi kiíráson bukik. A globális prototípus felülírása nem
bemenet, hanem a futtatókörnyezet módosítása; a másolat új tömbjei és objektumai ettől
változatlanul örökölnek, tehát erre a javítás nem vonatkozik.

### 10.2 J2: a közös hivatkozású CEL eredmény normalizálása (mérve; a normalizálás javítva, user döntés 2026-10-25)

A `[1]` + n darab `.map(x, [x, x])` kifejezés hossza lineáris (n = 22-nél 333 karakter), a
könyvtár eredménye közös hivatkozású szerkezet (a két testvér ugyanaz a tömb), és a kiértékelés a
könyvtárban 1 ms alatt marad. A `normalizeCelResult` memoizálás nélkül fává bontja:

| n   | `evaluate` (ms) | JSON szöveg hossza | heap utána (MB) |
| --- | --------------- | ------------------ | --------------- |
| 18  | 34              | 1 048 575          | 61              |
| 20  | 127             | 4 194 303          | 109             |
| 22  | 556             | 16 777 215         | 441             |
| 23  | 1083            | nem mérve          | maxRSS 671      |
| 24  | 2273            | nem mérve          | maxRSS 1206     |
| 25  | folyamat leáll  | nincs              | maxRSS 2092     |

n = 25-nél a folyamat `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed -
JavaScript heap out of memory` üzenettel, 6-os szignállal áll le: nem `Outcome` hibaág, a `try`
nem fogja.

Memoizálással (próba: a már normalizált konténer visszaadása egy `Map` alapján) a normalizálás
n = 200-nál is 1 ms alatt fut, és a közös hivatkozás megmarad. A kimenet viszont a motor és a
`db` útján `JSON.stringify` hívást kap (`step_run.output`, M-106; `run_event.payload`), ami a
közös hivatkozást újra kibontja: n = 26-nál 268 435 455 karakteres szöveg 890 ms alatt, n = 27-nél
`RangeError: Invalid string length` (elkapható kivétel, nem leállás). A memoizálás tehát a
normalizálás leállását megszünteti, a tárolás méretét nem.

**A user döntése (2026-10-25): "közös hivatkozás + elkapott hiba"** (SPEC-010 O-15). A
`normalizeCelResult` memoizál: egy híváson belül ugyanarra a forrás tömbre vagy objektumra ugyanazt
a normalizált értéket adja, a gyorsítótárba csak a kész érték kerül. Mérés a javított csomagon
(a valódi `createCelExpressionEvaluator`, ugyanazon a gépen, egy futás):

| n    | kifejezés hossza | `evaluate`                                                  | idő (ms) | szerkezet mélysége |
| ---- | ---------------- | ----------------------------------------------------------- | -------- | ------------------ |
| 3    | 48               | `ok`                                                        | 1,2      | 4                  |
| 25   | 378              | `ok`                                                        | 1,3      | 26                 |
| 27   | 408              | `ok`                                                        | 0,9      | 28                 |
| 200  | 3003             | `ok`                                                        | 4,3      | 201                |
| 1000 | 15003            | hiba: a nyelv beépített szerkezeti korlátja (pozíció: 3717) | 1,9      | nincs              |

A regressziós teszt (`create-cel-expression-evaluator.spec.ts`, n = 3 és n = 200) nem időt mér: azt
állítja, hogy minden szinten a két testvér ugyanaz a tömb. A régi kódra visszaállítva az n = 3
eset és a `normalize-cel-result.spec.ts` közös hivatkozás tesztje bukik (a testvérek egyenlők, de
nem azonosak), tehát a hiba a nagy n kiértékelése előtt jelez. A körkörös kontextus (`input`
önmagára mutató mezővel) a javítás után is a közös hibamondatot adja (`a kifejezés nem dolgozható
fel`), a meglévő teszt változatlanul zöld; CEL kifejezés körkörös értéket nem épít.

**A tároláskori szerializálás, a forrás olvasásával és eldobható próbával (`openDatabase(':memory:')`,
a repón kívül, a csomag forrását importálva).** A CEL eredmény ma nem jut a motorba: az `apps/server`
az elutasító kifejezés portot köti be (`apps/server/src/engine-assembly/create-rejecting-expression-evaluator.ts`),
a szállított port bekötése a PLAN-010 T-010-13. A bekötés után a CEL eredmény közvetlenül a `fan_out`
kimenetében tárolódik (**pontosítás 2026-10-25:** nem ez az egyetlen út; a közvetlenül `join`-ba kötött
`fan_out` után a `join` `merge` ágonként újra tárolja a teljes listát, PLAN-010 T-010-21 A-1,
`2026-10-25-plan-010-adverzarialis-atvizsgalas.md`; a korlát azóta minden tárolt lépés kimenetére fut,
SPEC-010 O-21): `packages/engine/src/node-executor/execute-fan-out.ts` a lista
elemeit `finishStepRunSucceeded` hívással a `markStepSucceeded` `output` mezőjébe adja; a `branch`
és a `loop` kimenete `null`, a `fan_out_expanded` esemény payloadja csak az elemszám. A
`step_run.output` oszlop Drizzle `mode: 'json'` (`packages/db/src/step-run/step-run.ts`), a
szerializálás a `markStepSucceeded` `transaction(...)` hívásán belül fut, és a
`packages/db/src/sqlite-connection/open-database.ts` `transaction` függvényének `catch` ága a
kivételt `Outcome` hibaágra viszi (`describeTransactionError`, ami erre a hibára a nyers üzenetet
adja, zárójeles hibaosztály nélkül). A `run_event.payload` útja (`insert-engine-event-row.ts`, a
`run-event-repository.ts` `appendEngineEvent` tranzakciójában) ugyanígy. Mért eredmény n = 27
közös hivatkozású értékkel: a `markStepSucceeded` `kind: 'error'`, üzenet `Invalid string length`,
3048 ms alatt; az `appendEngineEvent` ugyanígy; a lépés sora `running` állapotban marad (a
tranzakció visszagörgetve). A motorban a hibaág a `fan_out` végrehajtóból
(`finished.kind === 'error'`) a `run-supervisor/advance-run.ts` `applyCompletion` és
`runSchedulingLoop` útján az `abortRun` hívásig jut, ami a futást `run_execution_failed`
osztállyal zárja; ezt a láncot motor futással nem mértük, csak a forrásból olvastuk.

**Ugyanez a minta a Mustache kiírásban (mérve; javítva, user döntés 2026-10-25).** A `copyJsonValue`
a közös hivatkozást nem memoizálta, tehát egy közös hivatkozású érték (`{{item}}`, ha az `item` a
fenti `fan_out` eleme) fává bomlott. A `render('{{item}}', { item })` mérve a memoizálás nélküli
kódon: n = 16-nál 70 ms (heap 32 MB), n = 18-nál 238 ms (47 MB), n = 20-nál 883 ms (168 MB),
n = 22-nél 3685 ms (560 MB); a növekedés exponenciális, nagyobb n-re nem mértük. A `fan_out` a
címke sablont (`branchLabelTemplate`) a kimenet tárolása előtt rendereli, tehát egy `{{item}}` címke
sablon ezen az úton a tárolás előtt bontaná ki az értéket.

**A user döntése (2026-10-25): "közös hivatkozás + elkapott hiba", az O-15 mintájára** (SPEC-010
O-16). A `copyJsonValue` memoizál: egy híváson belül ugyanarra a forrás tömbre vagy objektumra
ugyanazt a másolatot adja vissza; a gyorsítótárba csak a kész másolat kerül, a körkörös hivatkozás
felismerése a gyökértől vezető láncon marad (a hibaág a nevet megnevezi). Mérés a javított csomagon
(a valódi `createMustacheTemplateRenderer`, `render('{{item}}', { item })`, `item` az n szintű `[x, x]`
duplázás, egy futás, Node 26.7.0, 4 mag, 3,9 GB memória):

| n   | `render`                           | kiírt szöveg hossza | idő (ms) | heap utána (MB) |
| --- | ---------------------------------- | ------------------- | -------- | --------------- |
| 16  | `ok`                               | 262 141             | 1        | 9               |
| 18  | `ok`                               | 1 048 573           | 4        | 11              |
| 20  | `ok`                               | 4 194 301           | 14       | 15              |
| 22  | `ok`                               | 16 777 213          | 67       | 32              |
| 26  | `ok`                               | 268 435 453         | 902      | 300             |
| 27  | hiba (`a sablon nem renderelhető`) | nincs               | 1705     | 300             |

Az n = 27-nél a `JSON.stringify` `RangeError: Invalid string length` kivételt dob, amit a `render`
`try` ága `Outcome` hibaágra visz, a közös tartalék mondattal (`describeTemplateError`: a `RangeError`
üzenete egyik elemzett előtagra sem illik); a folyamat nem áll le. A szerializálás önmagában (a
másolat nélkül, `JSON.stringify` egy n szintű duplázott értéken, ugyanazon a gépen): n = 26-nál 979 ms,
n = 27-nél `RangeError` 1787 ms után, n = 28-nál `RangeError` 3525 ms után (314 MB RSS); n = 40-nél a
mérő folyamatot az operációs rendszer leállította (`Killed`). **Az ok nem ellenőrzött:** az n = 27 és
n = 28 idejének megkétszerződése arra utal, hogy a bejárás a szöveghossz korlátja után is
folytatódik, de ezt forrásból nem igazoltuk. **Ezért** a `RangeError` ágat a regressziós teszt nem a
valódi kibontással váltja ki (n = 27-nél mérve 1,7 és 1,8 s, a nagyobb n ideje és memóriája tovább
duplázódik, n = 40-nél a folyamat leállt), hanem a `JSON.stringify` első hívását cseréli egy
`RangeError` kivételt dobóra, miközben az n = 200 szintű duplázott érték másolása a valódi kódon
fut; ez a másolás a memoizálás nélküli kódon nem ért volna véget (2^200 levél). A teljes szerkezetre állító teszt a `copy-json-value.spec.ts`-ben a másolat minden
szintjén `toBe` egyezést állít a két testvérre, n = 3 és n = 200 értékre; a memoizálás nélküli
kódon az n = 3 eset is bukik (a testvérek egyenlők, de nem azonosak).

Mellékmérés: a `["a"]` + n darab `.map(x, x + x)` kifejezés egyetlen, 2^n hosszú szöveget ad; a
könyvtár ezt rope szövegként tartja (n = 28-nál 268 435 456 karakter, a folyamat RSS értéke 87
MB), n = 29-nél pedig a közös hibamondatot adja (`a kifejezés nem dolgozható fel`), tehát a
szöveg hosszának határa `Outcome` hibaágon jön.

**A motor bekötése (PLAN-010 T-010-13, 2026-10-25).** A `fan_out` végrehajtó a listát a tárolás és a
címkék renderelése előtt maga szerializálja (`packages/engine/src/node-executor/can-serialize-output.ts`),
és kivétel esetén a lépést `expression_evaluation_failed` osztállyal zárja. Mérve ugyanezen a gépen, a
javítás előtt (a valódi `createCelExpressionEvaluator`, `[1]` + 27 darab `.map(x, [x, x])`, három futás):
az `evaluate` 2 ms, a `JSON.stringify` `RangeError` kivétele 1677 ... 1695 ms után, RSS 92 ... 93 MB. A
regressziós teszt (`apps/server/src/engine-assembly/build-engine-dependencies.spec.ts`) a valódi motoron,
a szerver összeállításával fut, a végét a `run_finished` eseményből olvassa; egyedül futtatva 1711 ms, a
javítás előtti motoron 1730 ms alatt bukik (a futás `run_execution_failed` osztállyal zárt). A motor
egység tesztje (`execute-fan-out.spec.ts`) a kivételt egy dobó `toJSON` értékkel váltja ki.

**Felülírva a 12.6 szekcióval (2026-10-25):** a nehéz, 27 szintű teszt helyére a méretkorlát és egy olcsó, a korlát fölötti bemenet lépett; a szerializálás kivétele ága változatlanul él.

### 10.3 J3: a Mustache greppes invariánsok destrukturálással megkerülhetők voltak (javítva)

Egy nem commitolt termékkód fájlba injektált `const { render } = Mustache`, `const {
templateCache } = Mustache` plusz `templateCache?.clear()`, `const { escape } = Mustache`, és a
saját `Writer` destrukturált `render` hívása `call`-lal, `partials` argumentummal: az akkori 18
teszt mind zöld maradt. A javítás után a `Mustache` azonosító csak a `Writer`, `Context` és
`TemplateCache` tagra mutathat, a `render` név csak metódushívás, tulajdonság vagy metódus
definíció lehet; a fenti öt, plusz az álnév (`const M = Mustache`), a közvetlen `Mustache.render`,
`Mustache.escape =`, `Mustache['parse']`, `writer.render.call`, a harmadik argumentum és a
`writer.render?.(` injekció egyenként bukik, a meglévő kód zöld. A futásidejű összerakás
(számított kulcs, a név szövegből építése) továbbra is elfogadott korlát.

## 11. PLAN-010 T-010-16: végponttól végpontig próba valódi szerver ellen (2026-10-25)

A SPEC-010 12.3 és a 16. szekció 48 ... 50. kritériuma egy commitolt tesztben:
`apps/server/src/workflow-language-end-to-end/workflow-language-end-to-end.spec.ts`. Kiinduló fej
`ab5975d`. A próba a valódi `createHttpServer` szervert `127.0.0.1` címen, `port: 0` értékkel
indítja, a valódi útvonal kezelőkkel, stream nyilvántartással, motorral és `:memory:` adatbázissal (a
commitolt migrációk), a szállított `createMustacheTemplateRenderer` és `createCelExpressionEvaluator`
porttal. Kizárólag az `agentQueryRunner` hamis: a commitolt
`agent-step-messages-fixture.json` sorozatát adja (`system`/`init`, `assistant`, `result`/`success`,
az F-3 táblázat szerinti értékekkel), hívásonként egyedi `uuid` és `session_id` utótaggal, és rögzíti
a kapott promptot. Valódi provider hívás nem történt; a fixture sem kulcsot, sem szolgáltatói
szöveget nem tartalmaz. A workflow a REST felületen jön létre (`POST /api/workflows`,
`PUT .../graph`, `PUT /api/settings` `defaultProviderId: claude-subscription`, `POST .../runs`). A
futás végét a `GET /events` folyam `run_finished` eseménye adja (a `stream_ready` után
`PUT /api/streams/{streamId}/subscriptions`, 0 padlóval); `setTimeout` és `sleep` nincs.

A gráf: `start` -> `tema` (`agent_step`, `Téma: {{input.tema}}`) -> `valaszto` (`branch`,
`input.mod == "reszletes" ? "reszletes" : "rovid"`) -> `reszletes` ágon `szetoszt` (`fan_out`,
`input.elemek`) -> `elem` (`Elem {{itemIndex}}: {{item}}`) -> `osszezar` (`join` `merge`) ->
`ciklus` (`loop`, `continueExpression: iteration < 2`, `maxIterations: 3`) -> `continue` ágon `kor`
(`Kör {{iteration}}`), `exit` ágon `vege` (`Vége: {{input.tema}}`); a `rovid` ágon
`nem_valasztott`. Bemenet: `{ tema: "kert", mod: "reszletes", elemek: ["alma", "körte", "szilva"] }`.

Eredmény (a teszt állításai, mind zöld):

| Pont | Mért                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 48.  | a `run_finished` payload `status` és a `GET /api/runs/{runId}` `status` értéke `succeeded`; minden `step_run` `succeeded`                                                                                                                                                      |
| 49.  | 7 prompt: `Téma: kert`; a három `fan_out` példány (sorrendje kötetlen) `Elem 0: alma`, `Elem 1: körte`, `Elem 2: szilva`; majd `Kör 0`, `Kör 1`, `Vége: kert`                                                                                                                  |
| 49.  | `branch_taken` payload pontosan egy: `{ branchKey: "reszletes", usedDefault: false }`; a `nem_valasztott` csomópontnak nincs `step_run` sora                                                                                                                                   |
| 49.  | `fan_out_expanded` payload pontosan egy: `{ itemCount: 3 }`; az `elem` csomópontnak 3 `step_run` sora van                                                                                                                                                                      |
| 49.  | `loop_iteration_started` pontosan 2, a payload `iteration` értéke `0` és `1` (7.5, O-11)                                                                                                                                                                                       |
| 50.  | `branch` `expression: input.mod ==`: a `POST .../runs` válasza `422`, `code: unprocessable`, `errorClass: expression_evaluation_failed`, az üzenet tartalmazza a `valaszto` és az `expression` nevet; a `GET /api/runs?workflowId=...` üres, a hamis agent nem kapott promptot |

Szándékos rontások (egyenként, a teszt fájlban, utána visszaállítva), mind az első tesztet buktatta, a
422 eset zöld maradt:

| Rontás                                                   | Bukás                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `continueExpression: iteration < 3` (`maxIterations: 3`) | `expected 'failed' to be 'succeeded'`                                                     |
| a `branch` kifejezés a `rovid` kulcsot adja              | `expected [ 'Téma: kert', 'Rövid: kert' ] to have a length of 7 but got 2`                |
| `elem` sablon `Elem {{item}}` (`itemIndex` nélkül)       | `expected [ 'Elem alma', 'Elem körte', …(1) ] to strictly equal [ 'Elem 0: alma', …(2) ]` |

A fájl két tesztje egyedül futtatva 124 ms alatt fut le.

**A teljes `test` kapu kétszer (mellékes ellenőrzés).** Egy korábbi futáson párhuzamos terhelés mellett
3 bukó teszt látszott (a `screenshot-pipeline` (2) fejléce), újrafuttatva zöld. Ezen a fán (az új próbával
együtt) a `bun run test` kétszer, egymás után, a `flock /tmp/kapu-gep.lock` alatt: mindkétszer kilépési kód
0, 625 teszt fájl, 6257 teszt zöld, a lefedettség mind a négy metrikán 100 százalék; a futásidő 63,33 s és
61,94 s. A `build-engine-dependencies.spec.ts` 27 szintű `.map(x, [x, x])` tesztje 1739 ms és 1724 ms, a
`screenshot-pipeline.spec.ts` 7 tesztje zöld. A korábbi bukás ezen a két futáson nem jött elő, tehát a
gyökéroka (a nehéz teszt memóriája vagy ideje párhuzamos terhelés alatt, vagy más) **nem ellenőrzött**.

## 12. A tárolandó kimenet méretkorlátjának mérése (PR #57 review, 2026-10-25)

A user döntése (2026-10-25): "méretkorlát, szám mérés után"; a tárolandó kimenet JSON hosszára
korlát kerül, fölötte a lépés `expression_evaluation_failed` hibával zár, a számot a user dönti el.
Ez a szekció a mérés; a döntés és a megvalósítás a 12.6 szekcióban áll.

### 12.1 A gép és a felállás

Gép: `aarch64`, 4 mag, 3906 MB RAM, swap nincs; Node `v26.7.0`;
`v8.getHeapStatistics().heap_size_limit` = 2 149 056 512 bájt (2050 MB), alapértelmezett kapcsolókkal.
Hogy a V8 ezt az értéket miből számolja (a gép memóriájából vagy rögzített értékből), **nem
ellenőrzött**; egy másik gépen az összeomlási pont ezért eltolódhat.

Felállás: eldobható, repón kívüli script (`/tmp/meret/measure.ts`, nem commitolt), a
`build-engine-dependencies.spec.ts` nehéz tesztjének gráfja (`start -> fan_out -> join merge`, a
`fan_out` kifejezése `[1]` + n darab `.map(x, [x, x])`), a valódi `buildEngineDependencies` portjaival,
`createEngine`, `openDatabase(':memory:')`, a fej `e063b7b`. Szintenként külön Node folyamat,
`flock /tmp/kapu-gep.lock` alatt, `/usr/bin/time -v` a csúcs RSS-hez. A script a `JSON.parse` és a
`JSON.stringify` hívást az 1 000 000 karakternél hosszabb szövegre naplózó burokkal veszi körül
(hívási verem az első futásokon), és a `database.stepRuns.markStepSucceeded` hívást be- és kilépéskor
naplózza. Valódi provider hívás nincs (a gráfban nincs agent lépés).

### 12.2 A kimenet hossza

A kimenet `JSON.stringify` hossza n szinten 2^(n+2) - 1 karakter; a szöveg ASCII, tehát a UTF-8
bájtszám egyenlő a karakterszámmal (`Buffer.byteLength`, külön folyamatban mérve):

| n   | karakter = UTF-8 bájt               |
| --- | ----------------------------------- |
| 18  | 1 048 575                           |
| 19  | 2 097 151                           |
| 20  | 4 194 303                           |
| 21  | 8 388 607                           |
| 22  | 16 777 215                          |
| 23  | 33 554 431                          |
| 24  | 67 108 863                          |
| 25  | 134 217 727                         |
| 26  | 268 435 455                         |
| 27  | `RangeError: Invalid string length` |

A `join merge` kimenete ugyanez a lista egy tömbbe csomagolva, 2 karakterrel hosszabb, és szintén
tárolódik.

### 12.3 A valódi út (a `db` visszaolvasásával)

| n   | kimenetel                                                             | futás (ms, `startRun` -> `run_finished`) | csúcs RSS (MB) | heap a végén (MB) |
| --- | --------------------------------------------------------------------- | ---------------------------------------- | -------------- | ----------------- |
| 18  | `succeeded`                                                           | 60                                       | 221            | 63                |
| 19  | `succeeded`                                                           | 122                                      | 258            | 101               |
| 20  | `succeeded`                                                           | 201                                      | 342            | 162               |
| 21  | `succeeded`                                                           | 399                                      | 497            | 313               |
| 22  | `succeeded`                                                           | 856                                      | 829            | 569               |
| 23  | `succeeded`                                                           | 1818                                     | 1389           | 1109              |
| 24  | folyamat leáll (a `join` visszaolvasásában)                           | (7,2 s fali idő a leállásig)             | 2258           | (limit)           |
| 25  | folyamat leáll (a `fan_out` visszaolvasásában)                        | (7,3 s fali idő a leállásig)             | 2267           | (limit)           |
| 26  | folyamat leáll (a `fan_out` visszaolvasásában)                        | (7,7 s fali idő a leállásig)             | 2397           | (limit)           |
| 27  | `failed`, `expression_evaluation_failed` (a `canSerializeOutput` ága) | 1727                                     | 709            | 36                |

A leállás minden esetben `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed -
JavaScript heap out of memory`, 6-os szignál, 134-es kilépési kód; a `--report-on-fatalerror`
jelentésben a heap 2 047 734 576 / 2 149 056 512 bájt, JavaScript verem nem érhető el, ezért a hely a
naplóból jön. n = 24-nél a `fan_out` `markStepSucceeded` hívása még lefut (a visszaolvasás után a heap
1177 MB), és a `join` `markStepSucceeded` visszaolvasásának `JSON.parse` hívásában áll le, miközben a
`fan_out` kifejtett fája még él. n = 25 és 26 már a `fan_out` visszaolvasásában áll le.

A visszaolvasás `JSON.parse` hívásának heap növekménye (a `fan_out` sor, egyetlen hívás):

| n   | szöveg (karakter) | heap növekmény (MB) | idő (ms) |
| --- | ----------------- | ------------------- | -------- |
| 21  | 8 388 607         | 110                 | 138      |
| 22  | 16 777 215        | 252                 | 281      |
| 23  | 33 554 431        | 508                 | 651      |
| 24  | 67 108 863        | 1020                | 1226     |

Ez karakterenként kb. 15 bájt heap. **Ez az arány ennek az alaknak (egymásba ágyazott kételemű
tömbök) a mért értéke; más alakú kimenetre (például hosszú szövegekre) nem mértük**, és nem
ellenőrzött, hogy ez a legrosszabb alak.

### 12.4 Hol bomlik ki a memória (forráshelyek)

A CEL eredmény a memóriában közös hivatkozású (10.2), a tárolás szövege viszont a kibontott fa, és a
visszaolvasás ebből a szövegből teljes, közös hivatkozás nélküli fát épít. A lánc (hívási verem az
n = 18 futás naplójából):

1. `packages/db/src/step-run/step-run.ts:70`: `output: text('output', { mode: 'json' })`.
2. Írás: `drizzle-orm@0.45.2` `sqlite-core/columns/text.js:52`, `SQLiteTextJson.mapToDriverValue` =
   `JSON.stringify(value)`. A szöveg mérete egyenlő a 12.2 táblázatéval; ez önmagában a mért
   tartományban nem állította le a folyamatot.
3. Visszaolvasás: `packages/db/src/step-run/step-run-repository.ts:461` `.returning()` a
   `markStepSucceeded` `UPDATE` utasításán, a `drizzle-orm` `better-sqlite3/session.js:94` és `:101`
   (`stmt.raw().get(...)`, majd `mapResultRow`), `utils.js:30` (`decoder.mapFromDriverValue`), és
   `sqlite-core/columns/text.js:49`, `SQLiteTextJson.mapFromDriverValue` = `JSON.parse(value)`. **Itt
   bomlik ki a memória**: a 12.3 táblázat szerint a heap ennél a hívásnál nő, és a leállás ebben a
   hívásban történik.
4. A visszaolvasott rekord (a kifejtett fával) a motorban tovább él, ezért egy futás egymás után
   tárolt kimenetei összeadódnak (n = 24: a `fan_out` fája él, amikor a `join` visszaolvasása elfogy).

**A visszaolvasás nem az egyetlen olvasó.** A `listStepRuns` (`step-run-repository.ts:363`) ugyanazon a
`mode: 'json'` oszlopon olvas, tehát a REST lépés lista és minden más olvasó ugyanígy kifejti a
szöveget: a mérő script n = 18 ... 21 futásán a `listStepRuns` két további, ugyanakkora `JSON.parse`
hívást adott.

**Mérés a visszaolvasás nélkül** (eldobható módosítás, nem commitolva, utána `git checkout`): a
`markStepSucceeded` `.returning()` hívása az `output` oszlop nélküli oszlopkészletet kérte, a rekord
`output` mezője a bemenet memóriabeli értéke lett:

| n   | kimenetel                                | futás (ms) | csúcs RSS (MB) |
| --- | ---------------------------------------- | ---------- | -------------- |
| 18  | `succeeded`                              | 24         | 218            |
| 22  | `succeeded`                              | 220        | 292            |
| 23  | `succeeded`                              | 407        | 359            |
| 24  | `succeeded`                              | 824        | 524            |
| 25  | `succeeded`                              | 1602       | 855            |
| 26  | `succeeded`                              | 3130       | 1512           |
| 27  | `failed`, `expression_evaluation_failed` | 1683       | 719            |

A visszaolvasás nélkül a motor a V8 szöveg korlátjáig (n = 26) végigfut. A tárolt sort később olvasó
`listStepRuns` viszont ugyanazt a kifejtést végezné, tehát a visszaolvasás elhagyása önmagában a
leállást csak a futásból a későbbi olvasásba tolja (ezt a mérést nem futtattuk le n = 24 fölött).

### 12.5 Dokumentált korlátok

| Korlát                                                          | Érték                                         | Forrás                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite `SQLITE_MAX_LENGTH` alapértéke (TEXT vagy BLOB, bájtban) | 1 000 000 000                                 | <https://www.sqlite.org/limits.html> ("The default value of this macro is 1 billion"); a telepített `better-sqlite3@13.0.3` `deps/sqlite3/sqlite3.c:14715` (`# define SQLITE_MAX_LENGTH 1000000000`, SQLite 3.53.4); a `deps/defines.gypi` nem írja felül                                                                                            |
| A futásidejű korlát nem emelhető a fordítási felső korlát fölé  |                                               | <https://www.sqlite.org/c3ref/limit.html> ("Attempts to increase a limit above its hard upper bound are silently truncated")                                                                                                                                                                                                                         |
| A `better-sqlite3` futásidejű `SQLITE_LIMIT_LENGTH` beállítása  | (1 << 29) - 24 = 536 870 888 bájt             | `better-sqlite3@13.0.3` `src/objects/database.cpp:7-8` és `:168` (a forrás kommentje szerint azért, hogy a túl nagy érték SQLite `SQLITE_TOOBIG` hibával bukjon, ne az átalakításkor)                                                                                                                                                                |
| V8 maximális szöveghossz 64 bites gépen                         | (1 << 29) - 24 = 536 870 888 UTF-16 kódegység | a telepített Node `include/node/v8-primitive.h:126-127` (`String::kMaxLength`); <https://nodejs.org/api/buffer.html> (`buffer.constants.MAX_STRING_LENGTH`, "may depend on the JS engine"); <https://github.com/nodejs/node/issues/33960> (`536870888` 64 bites buildön); saját mérés: `require('buffer').constants.MAX_STRING_LENGTH` = 536 870 888 |

Mindkét dokumentált korlát (536 870 888) a mért összeomlási pont (67 108 863 karakter, n = 24) fölött
van, tehát a korlát számához egyik sem ad forrást: a valódi úton a visszaolvasás heapje fogy el előbb.
A SQLite korlát bájtban, a V8 korlát UTF-16 kódegységben számol; a `JSON.stringify` eredmény `length`
mezője kódegység, ami nem ASCII szövegnél eltér a UTF-8 bájtszámtól.

### 12.6 A döntés és a megvalósítás (PR #57, 2026-10-25)

**A user döntése (2026-10-25): a korlát 16 777 215 karakter** (SPEC-010 O-18). Az érték a tárolandó
lista `JSON.stringify` eredményének `length` mezője (UTF-16 kódegység), és a 12.3 táblázat mért
összeomlási pontjának (n = 24, 67 108 863 karakter) negyede. A mérés gép és alak függő (12.1, 12.3), a
számot a user döntötte el, nem a mérés vezette le. A korlát a 12.2 és 12.3 táblázat n = 22 sorával egyezik
(16 777 215): ott a mért futás `succeeded`, 856 ms, csúcs RSS 829 MB.

**A megvalósítás.** `packages/engine/src/node-executor/max-stored-output-length.ts` (a konstans),
`output-storability.ts` (tiszta függvény: a `JSON.stringify` eredménye legfeljebb a korlát hosszú, és a
szerializálás nem dob kivételt), a `fan_out` végrehajtó a `failFanOut` úton zár
`expression_evaluation_failed` osztállyal. A szerializálás kivétele (`RangeError`, a 12.4 szerinti V8
szöveghossz-korlát) mindig a méretkorlát fölötti méret, ezért a kivétel ága valódi, nem halott út, és
ugyanúgy nemet ad. **Pontosítás (2026-10-25, PLAN-010 T-010-21 A-8):** a kivétel nem csak a
szöveghossz-korlátból jöhet (például `toJSON` hiba vagy körkörös hivatkozás), ezért a függvény ma
`outputStorabilityOf` néven háromállapotú (`storable`, `too_large`, `not_serializable`), és a kivétel
ága a `nem tárolható, mert nem alakítható JSON szöveggé` mondatot kapja. Az üzenet a csomópontot és a korlát számát nevezi meg, a kifejezés szövegét nem.

**Határ tesztek.** Az `output-storability.spec.ts` és az `execute-fan-out.spec.ts` egy hosszú szöveg
elemmel (`[` + `"` + szöveg + `"` + `]`, a JSON hossza a szöveg hossza plusz négy) a pontosan a
korláttal egyenlő hosszra igent, eggyel hosszabbra nemet állít; a kivétel ágát a dobó `toJSON` értékes
teszt váltja ki.

**A végponttól végpontig teszt átalakítása.** A `build-engine-dependencies.spec.ts` a korábbi,
27 szintű `[1]` + `.map(x, [x, x])` kifejezés helyett a `["a"]` után 24 darab `.map(x, x + x)`
kifejezést használja: egy 2^24 karakter hosszú szöveg elem, a lista JSON hossza 16 777 220 karakter, a
korlát fölött négy karakterrel. A könyvtár az összefűzést rope szövegként tartja (10.2 mellékmérés), a
kiértékelés és a szerializálás olcsó. Ugyanezen a gépen, a teljes suite alatt (`bash
tooling/scripts/test.sh`, 6265 teszt zöld, 100 százalék lefedettség mind a négy metrikán, 63 s): a
teszt 51 ms (a régi 27 szintű teszt 1724 ... 1739 ms, 11. szekció). Szándékos rontás: a `<=
MAX_STORED_OUTPUT_LENGTH` feltétel `<= MAX_STORED_OUTPUT_LENGTH * 100` alakra cserélve a
végponttól végpontig teszt, az `execute-fan-out.spec.ts` korlát feletti tesztje és az
`output-storability.spec.ts` korlát feletti tesztje egyaránt elbukik; a visszaállítás után zöld.
