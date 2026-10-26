# PLAN-010 T-010-21: adverzariális átvizsgálás (2026-10-25)

|         |                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Lépés   | PLAN-010 T-010-21                                                                                      |
| Dátum   | 2026-10-25                                                                                             |
| Bázis   | `f4cb61d` (T-010-20), branch `feat/spec-010-f5-zaras`                                                  |
| Hatókör | a PLAN-010 terméke: `packages/workflow-language`, a motor és a szerver bekötése, a kapcsolódó research |
| Spec    | [`../spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../spec/SPEC-010-sablon-es-kifejezes-nyelv.md)       |
| Terv    | [`../plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../plan/PLAN-010-sablon-es-kifejezes-nyelv.md)       |

## 1. Módszer

A PLAN-010 T-010-21 sora öt kategóriát kér: forrás nélküli szám, kitalált könyvtári viselkedés,
megkerülhető szabály, kiszivárgó titok, elnyelt kivétel. Minden állítás mögött eldobható próba áll a
repón kívül (`/tmp/t21probe/`, a csomag forrását importálva, valós `:memory:` adatbázison), vagy a
telepített könyvtár forrása (`@marcbachmann/cel-js` 8.0.0, `mustache` 4.2.0). A javítás után a próbák
újra lefutottak, és minden javításhoz regressziós teszt tartozik, ami a javítás előtti kódon bukik (a
bukás tételenként igazolva: a javított fájl visszaállítása a bázisra, a teszt futtatása, majd
visszaállítás). Valódi API hívás egyik próbában sem volt.

## 2. Összesítés

| Tétel | Kategória                                  | Súly       | Rendezés                                       | Commit    |
| ----- | ------------------------------------------ | ---------- | ---------------------------------------------- | --------- |
| A-1   | megkerülhető szabály (tárolási korlát)     | blokkoló   | javítva, user döntés (SPEC-010 O-21)           | `cdbd578` |
| A-2   | kiszivárgó szöveg (hibaüzenet)             | magas      | javítva, user döntés                           | `5aa6293` |
| A-3   | megkerülhető szabály (greppes invariáns)   | közepes    | javítva                                        | `95a6836` |
| A-4   | hiányzó bizonyíték (nyers kimenet)         | közepes    | javítva                                        | `59f6f7a` |
| A-5   | kitalált könyvtári viselkedés (`optional`) | közepes    | javítva, user döntés (SPEC-010 O-23)           | `82562b6` |
| A-6   | elnyelt kivétel (barátságtalan `Proxy`)    | megjegyzés | elfogadott korlát (10. szekció)                |           |
| A-7   | elnyelt kivétel (tartalék mondat)          | közepes    | javítva, user döntés (SPEC-010 O-22)           | `174fc3e` |
| A-8   | pontatlan hibaüzenet (tárolhatóság)        | alacsony   | javítva                                        | `d460a17` |
| A-9   | megkerülhető szabály (`render` invariáns)  | megjegyzés | elfogadott korlát (10. szekció)                |           |
| A-10  | sodródás védelem nélküli lista             | alacsony   | első fele javítva, második fele javaslat (10.) | `1a15682` |
| A-11  | megkerülhető szabály (böngészőbiztos)      | megjegyzés | elfogadott korlát (10. szekció)                |           |

Minden javító commit előtt a kilenc kapu (`format:check`, `typecheck`, `lint`, `test`, `build`,
`docs:check`, `check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal futott, a `test`
100 százalékos lefedettséggel mind a négy metrikán.

## 3. A-1: a `fan_out` tárolási korlátja megkerülhető volt

**A hiba.** A 16 777 215 karakteres korlát (O-18) csak a `fan_out` saját kimenetére futott
(`execute-fan-out.ts`). A közvetlenül `join`-ba kötött `fan_out` után a `join` `merge` minden ágtól a
teljes listát kapja (`collect-join-inputs.ts`), és a kimenetét korlát nélkül tárolta
(`execute-join-merge.ts`, `output: joinInputs`).

**A próba.** `join-bypass.ts`: `start -> fan_out -> join`, a kifejezés a `["a"]` után 21 darab
`.map(x, x + x)`, majd `.map(s, [s, s, s, s, s, s, s])[0]` (hét, 2^21 karakteres elem). A bázison a
`fan_out` kimenete 14 680 086 karakter (a korlát alatt), a `join` kimenete 102 760 610 karakter, a
lépés `succeeded`; kisebb heapen a folyamat OOM-mal leállt (`join-crash.ts`). A javítás után
ugyanaz a próba: a `fan_out` `succeeded` (14 680 086), a `join` `failed`, `step_output_not_storable`,
a futás `failed` ugyanezzel az osztállyal, kezeletlen hibaként.

**A döntés (user, 2026-10-25).** A korlát minden tárolt lépés kimenetére fut, a motor közös pontján;
a `fan_out` marad `expression_evaluation_failed`, minden más lépés új, nevesített osztállyal bukik.

**A javítás.** `node-executor/finish-step-run-with-output.ts`: a kimenetet tároló lépések (`start`,
`agent_step`, `join` mindkét módja, `sub_workflow`) közös záró menete, a korlát a `markStepSucceeded`
előtt fut, a nem tárolható kimenet a lépést `step_output_not_storable` osztállyal zárja, a token és kör
adatokkal együtt. A `db` nem változott. A `null` kimenetű lépések (`branch`, `loop`, `error_handler`)
és a saját előzetes ellenőrzésű `fan_out` a `finishStepRunSucceeded`-et közvetlenül hívják; ezt az
egyetlen pontot az `engine-port/config-invariants.spec.ts` hetedik invariánsa őrzi (a
`markStepSucceeded` hívás csak a segédben, a `finishStepRunSucceeded` hívás csak `output: null`
értékkel vagy a két korlátot futtató fájlban). Az új osztály az `EngineErrorKind` unióba, az
`isEngineErrorKind` guard rekordjába és a két felsoroló tesztbe került; a `ProtocolErrorClass`
szótárba nem, mert futás közbeni hiba, REST hibatörzsben nem jelenik meg (`.claude/CLAUDE.md` 5.
szekció, a szótár a futás indításának hibáit tartalmazza). Az `apps/web` és a `protocol` nem sorolja
fel a motor futás közbeni osztályait, tehát ott nem kellett bővíteni.

**A név indoka.** A SPEC-004 hibaosztály nevei a tárgyat és az okot nevezik meg
(`fan_out_items_not_a_list`, `missing_structured_output`, `approval_timed_out`), a `run_` előtag futás
szintű állapotot jelöl (`run_execution_failed`, `run_stalled`). Ez lépés szintű hiba, ezért `step_`
előtagú. A javasolt `step_output_too_large` helyett `step_output_not_storable`, mert az osztály a
szerializálás kivételét is lefedi (A-8), ami nem mindig méret.

**Regressziós tesztek.** `finish-step-run-with-output.spec.ts` (határ, tokenek, mindkét hibaág),
`execute-join-merge.spec.ts` (két, egyenként a korlát fele alatti ág, együtt fölötte, `join_resolved`
esemény nélkül), `execute-start.spec.ts`, `execute-agent-step.spec.ts`, `execute-sub-workflow.spec.ts`,
`config-invariants.spec.ts`, és a szerver végponttól végpontig tesztje (`build-engine-dependencies.spec.ts`:
a valódi CEL porton a `["a"]` után 22 duplázás, majd `.map(s, [s, s, s])[0]`, a `fan_out` `succeeded`,
a `join` `step_output_not_storable`). A `execute-join-merge.ts` bázisra állításával a három érintett
teszt bukik.

**Átvezetve.** SPEC-004 5. szekció (közös szabály, táblázat, új bekezdés, 23. kritérium), SPEC-010
O-15 és O-18 pontosítás, új O-21, 7.4, 8. tábla, 68. kritérium; PLAN-010 T-010-13; a
`2026-10-21-spec010-blokkolo-meresek.md` 10.2 szekciójának hamis "egyetlen út" állítása; a
`packages/engine/CLAUDE.md`.

## 4. A-2: a futás közbeni hibaüzenet idézte a kifejezés és a sablon szövegét

**A hiba.** Hét helyen: `execute-branch.ts` (kiértékelés), `execute-fan-out.ts` (kiértékelés, nem lista,
címke sablon), `execute-loop.ts` (kiértékelés, nem logikai), `execute-human-approval.ts`
(`bodyTemplate`). A `run-agent-step.ts` prompt hibája és a `validate-language-fields.ts` nem idézett.

**A próba.** `leak.ts`: a kifejezés `input.TITOK_JELOLO_8f3a.b`; a bázison a jelölő a
`step_run.error_message` mezőben állt. A javítás után az üzenet
`A(z) "fo" fan_out node itemsExpression mezőjének kiértékelése sikertelen: a hivatkozott kulcs nem
létezik (pozíció: 6) (expression_evaluation_failed).`, jelölő nélkül.

**A döntés (user).** Kikerül az idézet; az üzenet a csomópontot és a mező nevét mondja.

**Regressziós tesztek.** Hét teszt jelölővel a négy végrehajtó specjében (`execute-branch.spec.ts`,
`execute-fan-out.spec.ts` kettő plusz egy, `execute-loop.spec.ts` kettő, `execute-human-approval.spec.ts`);
a négy végrehajtó bázisra állításával mind a hét bukik. A csomag leírása (a Mustache hiányzó név
hibájának idézésével, O-4) változatlanul a mondat végére kerül. Átvezetve: SPEC-004 5. közös szabály,
SPEC-010 9.5 és 33. kritérium.

## 5. A-3: a greppes invariáns komment szűrője valódi kódot vágott ki

**A hiba.** `greppable-invariants.spec.ts`: a `replaceAll(/\/\*[\s\S]*?\*\//g, '')` egy sor- vagy
szöveg kommentben álló `/*` jeltől a következő `*/`-ig mindent kivágott. Valódi előfordulás: az
`apps/web/src/browser-safe-imports/browser-safe-imports.spec.ts` 22. sora (`tooling/*`).

**A próba.** `strip.mjs`, `inject1.mjs`: az említett fájl 31. sora után beszúrt
`import Mustache from 'mustache';` a bázis szűrője után eltűnt, az (1) invariáns zöld maradt.

**A javítás.** A kommenteket a TypeScript elemző komment tartományai adják (`createSourceFile`, a
tokenenkénti `getLeadingCommentRanges` és `getTrailingCommentRanges`, a JSDoc csomópontok és a JSX
szövegben kezdődő tartományok nélkül); a csere `slice` alapú, mert a tartományok UTF-16 eltolások. A
workspace bejárása előszűr: csak a nyers szövegben illeszkedő fájl kerül elemzésre (a komment
eltávolítása találatot csak elvehet), a teljes workspace elemzése a teszt idejét a korlát közelébe
vinné (`.claude/CLAUDE.md` 12. szekció). Az `apps/web` greppes invariánsai soronként szűrnek (a `//`
és a JSDoc `*` sorokat), blokk komment regexet csak CSS fájlon használnak, tehát ott ez a hiba nem áll
fenn.

**Igazolás.** Ugyanaz az injekció a javított szűrővel: `a workspace többi fájlja egyiket sem
importálja` bukik; a bázis szűrőjével 14/14 zöld. Szintetikus regressziós tesztek: sor komment `/*`
jellel, string, regex, template literál, JSX szöveg, kódpontnál hosszabb karakter.

## 6. A-4: a Mustache mérés nyers kimenetei hiányoztak a repóból

A research 3. szekciója a `t010-3-mustache/out/p1.txt` ... `out/p8b.txt` fájlokra hivatkozott, a
gyökér `.gitignore` `out/` sora (8. sor) viszont kizárta őket. A mérés idején mentett példány (a
mérési munkakönyvtár és a T-010-3 worktree két másolata bájtra azonos, `cmp`) `nyers/` néven került a
repóba; a research tizenkét hivatkozása igazítva. Ellenőrizve: a három titok env változó a
sandboxban nincs beállítva, kulcs mintára nincs találat, kép nincs a fájlok között.

## 7. A-5: a `compile` átengedte az `optional` névtérre épülő kifejezést

**A hiba.** A SPEC-010 7.2 és a `create-cel-expression-evaluator.ts` 9-12. sora szerint a nem
deklarált változót az `env.check` elkapja. Az `optional` névre ez nem igaz.

**A próba.** `opt.mjs`, plusz egy bővített próba a hét deklarált változós környezeten: az
`optional.of(1)`, az `optional.none()` és a puszta `optional` `check.valid = true`, a kiértékelés
`unknown_variable`; az `optional.ofNonZeroValue(1)` már a `check`-en `no_matching_overload`; a
`[1].map(optional, optional + 1)` érvényes (eredmény `[2n]`). Az ok a telepített forrásban:
`lib/optional.js` 59-72, a `registerConstant('optional', 'OptionalNamespace', optionalConstant)`, ahol
a konstans értéke kikapcsolt opcionális típusok mellett `undefined`, a típusa viszont deklarált.

**A döntés (user).** Saját ellenőrzés az `optional` névre.

**A javítás.** `cel-expression/reject-optional-namespace.ts`: a `parse` AST-jén (a `lib/index.d.ts`
`ASTNode` alakja; a csomópontot az `isCelAstNode` guard szűkíti) egy `optional` azonosító csomópont
hibát ad, kivéve, ha egy változót kötő makró (`all`, `exists`, `exists_one`, `map`, `filter`,
`lib/macros.js` `registerMacros`) vagy a `cel.bind` saját változója. A mezőnév (`input.optional`, AST
`.` csomópont) és a szöveg literál (`"optional"`, `value` csomópont) nem azonosító, tehát nem érinti,
regex nem kellett. Mondat: `az optional névtér nem használható, mert az opcionális típusok ki vannak
kapcsolva (pozíció: N)`, pont nélkül (az `error-sentence-form` téma őrzi). Új általános guard:
`isUnknownArray` (`typeguards`), mert az `Array.isArray` `any[]` szűkítését a lint nem engedi
tovább.

**Regressziós tesztek.** `reject-optional-namespace.spec.ts` (nyolc elutasított, kilenc átengedett
alak, szintetikus csomópontok a rendhagyó ágakra), `create-cel-expression-evaluator.spec.ts`
(`optional.of(1)`, `optional.none()`, `input.optional`, `"optional"`), `error-sentence-form.spec.ts`;
a `create-cel-expression-evaluator.ts` bázisra állításával kettő bukik. Átvezetve: SPEC-010 7.2, 18.
kritérium, új O-23, a gyártó függvény kommentje.

## 8. A-7: a tartalék hibamondat mögött az eredeti kivétel nem maradt meg

**A hiba.** `describe-template-error.ts` (`a sablon nem renderelhető`) és `describe-cel-error.ts` (a
nem CEL kivétel és a táblában nem álló kód): az eredeti kivétel sehol, a szerver naplójában sem
jelent meg.

**A döntés (user).** Napló a hiba típusával, az üzenete nélkül.

**A terv és a megvalósítás.** A `workflow-language` L1 réteg, `logger` függősége nincs, ezért nem
naplóz. A hibaág egy opcionális, strukturált mezőt visz: `unexpectedErrorType`, a kivétel típusneve
(`Error` példánynál a konstruktor neve, egyébként a `typeof` eredménye). A típus és a segéd a `core`
csomagba került (`OutcomeWithErrorType`, `describeErrorType`), mert a csomag két témája és a szerver
is használja, a `workflow-language` `src/` alatt pedig a SPEC-010 1. kritériuma pontosan két termék
témát enged. Az `Outcome` maga változatlan (SPEC-005 F-22: a hibaág csak `message` mezőt hordoz); a
két típus kölcsönösen értékadható, tehát a motor `ExpressionEvaluatorPort` és `TemplateRendererPort`
portja (SPEC-004 3.2) nem változott. A szerver `engine-assembly` témája a két portot a
`reportUnexpectedLanguageError` burkolón át köti be, ami a mezőt a művelet nevével (`template_compile`,
`template_render`, `expression_compile`, `expression_evaluate`) `error` szinten naplózza, és a
`buildEngineDependencies` negyedik paraméterként kapja a naplózót.

**Regressziós teszt.** `build-engine-dependencies.spec.ts`: a valódi összeállításon egy dobó `Proxy`
sablon értékként (`TypeError`) és egy dobó getter kifejezés kontextusként (`RangeError`) két
naplósort ad, `level: 50`, a művelettel és a típussal, a kivétel üzenetében álló jelölő nélkül; az
érvényes `compile` nem naplóz. Plusz `report-unexpected-language-error.spec.ts`, a két hibaleíró
tartalék ágának és ismert ágának tesztje, és a `describe-error-type.spec.ts`. Átvezetve: SPEC-010
9.5, új O-22, a `core`, a `workflow-language` és az `apps/server` `CLAUDE.md` fájlja.

## 9. A-8 és A-10

**A-8.** Az `isStorableOutput` `catch { return false; }` ága minden kivételt "túl nagy" hibának
nevezett. A függvény `outputStorabilityOf` néven háromállapotú lett (`storable`, `too_large`,
`not_serializable`; `git mv`), a kivétel ága a `nem tárolható, mert nem alakítható JSON szöveggé`
mondatot kapja a `fan_out` (`expression_evaluation_failed`) és a többi lépés
(`step_output_not_storable`) üzenetében, a méret ága a régit. Regressziós tesztek egy dobó `toJSON`
értékkel a függvény, a `fan_out` és a közös záró menet szintjén. Átvezetve: SPEC-004 5. (pontosítás),
SPEC-010 O-18, a research 12.6 szekciója.

**A-10, első fele.** Az `INTEGER_COUNTER_NAMES` (`to-cel-context.ts`) `as const satisfies readonly
(typeof RUN_CONTEXT_VARIABLE_NAMES)[number][]` alakkal a hét deklarált névhez kötve; egy elírás
(`'iteratio'`) a `typecheck` kapun `TS2820` hibát ad.

## 10. Elfogadott korlátok és javaslatok (nem javítva)

- **A-6, a barátságtalan `Proxy`.** Egy olyan `Proxy`, aminek a csapdája maga is `Proxy`-t dob
  (`escape.ts`), a `render` és az `evaluate` `catch` ágából kijut, mert a hibaleíró `instanceof`
  vizsgálata a dobott `Proxy` csapdáját is meghívja. A `RunContext` a motorban JSON adatból áll (a
  `steps` és az `input` JSON kerekúton, M-106), tehát ilyen érték a termék útján nem állhat elő;
  elfogadott korlát. Az A-7 `describeErrorType` ugyanezt az `instanceof` vizsgálatot használja, tehát
  a korlát nem bővült.
- **A-9, a `render` invariáns.** A `greppable-invariants` (6) invariánsa a szétterített argumentumú
  `writer.render(...args)` hívást és a `writer.renderTokens(...)` utat nem látja (`inv6.mjs`: mindkettő
  átmegy, a három argumentumú `render` bukik). A csomag ma egyiket sem használja; szövegalapú
  ellenőrzéssel csak a `renderTokens` név tiltása zárhatná, a szétterítés nem. Elfogadott korlát a
  2026-09-15-i képernyőkép védelem mintájára (szándékos megkerülést a szöveg alapú ellenőrzés nem lát);
  javaslat, nem döntés: a `renderTokens` név felvétele a tiltott tagok közé.
- **A-10, második fele, a hét nyelvi mező listája.** A sablon és kifejezés mezők listája kétszer áll:
  a motor `run-validation/validate-language-fields.ts` `languageFieldsOf` függvényében és a szerkesztő
  `apps/web/src/node-inspector/find-language-field-issues.ts` fájljában; a kettő között nincs sodródás
  védelem. Javaslat, nem döntés: egy `apps/server` regressziós
  téma, ami a két listát a meglévő sodródás védelmek mintájára összeveti.
- **A-11, a böngészőbiztos invariáns.** A (3) invariáns a `process`, `globalThis`, `require` és
  `import(` hivatkozást tiltja, a `self`, `window`, `Function(` és `eval` utat nem. A csomag ma egyiket
  sem használja; elfogadott korlát, javaslat, nem döntés: a négy név felvétele a tiltott listára.

## 11. Amit NEM talált

- Forrás nélküli számot a PLAN-010 termékében nem talált: a 16 777 215 (O-18) user döntés, a CEL és a
  Mustache korlátai a csomag dokumentált alapértékein maradnak (M-125, M-126).
- Titok kiszivárgást a sablon és a kifejezés kimenetén nem talált a `secret-prohibition` téma
  esetein túl; az A-2 a felhasználó saját szövegének idézése volt, nem env érték.
- A futás szintű kimenet (`workflow_run`) nem tárol lépés kimenetet: a `collect-terminal-output.ts`
  eredménye a `sub_workflow` lépés kimenete lesz, ami az A-1 óta a korlát alá esik.
