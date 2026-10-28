# A körkörös CEL kontextus billegő kivétel típusa

Dátum: 2026-10-28. Hatókör: `packages/workflow-language`, `cel-expression` téma, a
`normalizeCelResult` és a `createCelExpressionEvaluator` `evaluate` ága (SPEC-010 7.4, O-15,
O-22).

## 1. A tünet

A `create-cel-expression-evaluator.spec.ts` "furcsa kifejezésre és furcsa kontextusra sem" tesztje
egy teljes `bun run test` futásban egyszer `unexpectedErrorType: 'RangeError'` értéket kapott a
várt `'TypeError'` helyett; az újrafuttatás zöld volt.

## 2. A gyökérok

A körkörös kontextus (`input` önmagára mutató mezővel) a CEL kiértékelésen változatlanul átmegy (a
`input` kifejezés ugyanazt a hivatkozást adja vissza), és a `normalizeCelResult` rekurziója a
javítás előtt a verem kifutásáig ment. A körkörösséget tehát semmi nem ismerte fel: a hibaágat a
veremtúlcsordulás adta, amit az `evaluate` `try` ága elkapott, és a `describeCelError` a kivétel
típusnevét tette az `unexpectedErrorType` mezőbe (O-22).

A veremtúlcsordulás kivételének típusa nem rögzített: a V8 alatt a túlcsordulás `RangeError`
("Maximum call stack size exceeded"; MDN "too much recursion":
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion>), a Vitest alatt `TypeError` ("undefined is not a function") is jött. A verem nyom szerint a
`TypeError` a `normalize-cel-result.ts` `isPlainObject` hívási pontján keletkezett, a `RangeError`
az `isPlainObject` belsejében; hogy a V8 miért ad az előbbi helyen `TypeError`-t, nem ellenőrzött.
Hogy melyik jön, a futtató állapotától függ: a 3. szekció mérése szerint a normalizálás JIT
bemelegítésétől.

## 3. Mérés (saját, 2026-10-28, a `6d17889` main fejen, Vitest, Node v26.7.0)

Eldobható próba spec a `cel-expression` mappában (a mérés után törölve): egy friss kiértékelő `n`
darab nem körkörös `input` kiértékelése után a körkörös kontextus `unexpectedErrorType` értéke.

| `n` (bemelegítő kiértékelés) | a fájl összes tesztjével, két futás | csak ez a teszt (`-t`) |
| ---------------------------- | ----------------------------------- | ---------------------- |
| 0                            | `TypeError`, `TypeError`            | `TypeError`            |
| 500                          | `TypeError`, `TypeError`            | `TypeError`            |
| 1000                         | `TypeError`, `TypeError`            | `RangeError`           |
| 2000                         | `TypeError`, `TypeError`            | `RangeError`           |
| 5000                         | `RangeError`, `RangeError`          | `RangeError`           |
| 10000                        | `RangeError`, `RangeError`          | `RangeError`           |

Bemelegítés nélkül nyolc egymás utáni körkörös kiértékelés mind `TypeError` volt, mindhárom
futásban. A meglévő teszt `-t "furcsa"` szűrővel futtatva egyszer `RangeError`-ral bukott, a teljes
fájllal zöld volt. Vitest nélkül (`node --experimental-strip-types`, ugyanaz a forrás) a körkörös
kontextus minden mért veremmélységen (0 ... 10000 előzetes hívási keret) `RangeError` volt. A
típus tehát a futtatótól és a JIT állapottól függ; a teljes `bun run test` futásban a fájl előtt
futó tesztek ezt az állapotot nem rögzítik.

**Determinisztikus reprodukció:** 10 000 bemelegítő kiértékelés után a régi kód `RangeError`-t ad
(a fenti táblában minden futásban). A regressziós teszt erre épül; a régi kódon háromból három
futásban bukott, a javított kódon zöld.

## 4. A javítás

A `normalizeCelResult` az ősök láncán (a gyökértől az aktuális értékig vezető konténerek halmaza)
ismeri fel a körkörös hivatkozást, a `copyJsonValue` (SPEC-010 6.5) mintájára, és `TypeError`
kivételt dob. A spec szerinti hibaág változatlan: az `evaluate` elkapott kivétele, a közös
hibamondat (`a kifejezés nem dolgozható fel`), és az O-22 szerint a kivétel típusneve. A `TypeError`
választás oka: az ECMA-262 a `JSON.stringify` körkörös ágán is ezt dobja ("If state.[[Stack]]
contains value, throw a TypeError exception because the structure is cyclical",
<https://tc39.es/ecma262/multipage/structured-data.html#sec-serializejsonobject>); megerősítés: MDN
`JSON.stringify` "Exceptions" és "Issue with serializing circular references"
(<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify>),
és saját mérés (`node -e`, Node v26.7.0: `TypeError Converting circular structure to JSON`). A
közös hivatkozás (O-15) megmarad: a lezárt ág konténere kikerül a láncból, a gyorsítótár
változatlan.

A túl mély, de nem körkörös adat veremtúlcsordulása továbbra is a verem kifutásán bukik, a
kivétel típusa ott is futtatófüggő; erre a repóban nincs típust állító teszt.

## 5. Védelem

- `normalize-cel-result.spec.ts`: a körkörös objektum, tömb és közvetett körkörösség `TypeError`
  kivétele a saját üzenettel (a régi kód üzenete más, tehát minden futásban bukik), és a testvér
  ágon újra előforduló konténer nem körkörös.
- `create-cel-expression-evaluator.spec.ts`: a körkörös kontextus 10 000 bemelegítő kiértékelés
  után is `TypeError` (a 3. szekció determinisztikus reprodukciója).
