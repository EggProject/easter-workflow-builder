# SPEC-014: A szkript csomópont és a `join` szkript módjának végrehajtása

|          |                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, user döntésre vár: a 7. szekció O-1 ... O-4 termékkérdése nyitott; a technikai döntések forrásból lezárva (5. szekció)                                                                                                                                  |
| Dátum    | 2026-11-03                                                                                                                                                                                                                                                        |
| Előzmény | [`SPEC-003`](SPEC-003-domain-perzisztencia.md) 4.3, [`SPEC-004`](SPEC-004-vegrehajto-motor.md) 4.7, 5. szekció 10. sora, [`SPEC-008`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) 5.1, O-43, [`SPEC-010`](SPEC-010-sablon-es-kifejezes-nyelv.md) 7. és 8. szekció |
| Bemenet  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) 2. és 3. szekció; a hiányleltár H-13 tétele                                                                                                        |
| Kimenet  | a `script` node és a `join` `script` mód futtatható, a felület tiltása és figyelmeztetése megszűnik                                                                                                                                                               |
| Terv     | [`../plan/PLAN-015-szkript-csomopont.md`](../plan/PLAN-015-szkript-csomopont.md)                                                                                                                                                                                  |

---

## 1. Cél és hatókör

A user döntése (SPEC-009 14.6 O-23, 2026-10-26): a szkript csomópont végrehajtása "saját spec, később"; a
mai korlát (a futás elutasítja, a felület tiltja) addig érvényes (user döntés 2026-10-21, "Rövid szöveg",
"Letiltás okkal"). Ez a spec azt írja le, mi kell a végrehajtáshoz.

### Amit eldönt

1. Melyik izolációs megoldás jöhet szóba, és melyik nem (forrásból, 5.1).
2. A szkript bemenete, kimenete és hibaosztályai (5.3 ... 5.5).
3. A futás indításának, a szerkesztőnek és a futás nézetnek a változása (5.6, 5.7).
4. A nyelvenként eltérő technikai következmények (5.2), hogy a user nyelvválasztása után ne kelljen új spec.

### Amit NEM dönt el

- A szkript nyelvét, és hogy mit érhet el a szkript a futás adatain túl: termékdöntés (7. szekció).
- A CEL kiértékelési idő korlátját: a SPEC-010 O-2 user döntése ("most nincs korlát") érvényes, ezt a spec
  nem nyitja újra, csak megnevezi a következményét (5.2).
- Új provider vagy agent képesség: a szkript nem AI lépés, provider hívás nincs.

## 2. Kiindulási állapot

| Réteg      | Mai állapot                                                                                                                                           | Hely (`bbed64c`)                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`       | `ScriptConfig { source: string; runtime: 'expression' }`, a `script` node és a `join` `script` mód tárolható                                          | `packages/db/src/workflow-graph/node-config/script-config.ts:7-10`; `node-config.ts:80-85, 160-166`                                               |
| `protocol` | `ScriptConfigSchema` `z.literal('expression')` futásidővel                                                                                            | `packages/protocol/src/node-config/script-config.ts:7-12`                                                                                         |
| `engine`   | a futás indítása `unimplemented_node_type` hibát ad; a diszpécserben nincs `script` ág, mert a validáció típusszinten szűkít (`ExecutableNodeConfig`) | `packages/engine/src/run-validation/validate-implemented-node-types.ts:10-56`                                                                     |
| `apps/web` | a kártya rövid figyelmeztetése, a panel `role="alert"` mondata, a "Futás indítása" gomb tiltása okkal                                                 | `apps/web/src/node-inspector/ScriptNodeFields.tsx:24-45`; `apps/web/src/graph-editor/GraphEditorScreen.tsx:252, 737, 821`                         |
| CEL        | hét név a környezetben, köztük a `joinInputs`; a `branch` a befecskendezett `expressionEvaluator` porton értékel ki                                   | `packages/workflow-language/src/cel-expression/run-context-variable-names.ts:7-15`; `packages/engine/src/node-executor/execute-branch.ts:125-131` |

A `runtime` mező egyetlen értéke ma `'expression'`, és a SPEC-003 4.3 nem nevezi meg, mit jelent. A projekt
egyetlen kifejezés nyelve a CEL (SPEC-010), tehát a `'expression'` természetes olvasata a CEL, de ezt
kifejezetten egyetlen dokumentum sem mondja ki: ezért kérdés (O-1).

## 3. Megerősített tények

A teljes forráslista a research 3. szekciójában (S-1 ... S-12). A döntéshez szükséges kivonat:

- A `node:vm` hivatalosan nem biztonsági mechanizmus, az időkorlátja Promise úton megkerülhető (S-1).
- A Node permission model "seat belt", rosszindulatú kód ellen nem véd (S-2).
- Az `isolated-vm` karbantartási módban van, natív buildet igényel, és a saját README-je szerint egy memória
  túllépés a folyamatot leállíthatja (S-4, S-5).
- A `quickjs-emscripten` WebAssembly alapú, natív build nélküli, memória, stack és megszakítás API-val (S-6).
- A CEL lineáris idejű, mellékhatás mentes, nem Turing-teljes, csak a kapott adathoz fér hozzá (S-12,
  SPEC-010 M-120); a `cel-js`-ben nincs kiértékelési idő korlát (S-11).
- Iparági minta időkorlátra: az n8n Code node task runnerének alapértéke a 3.0-ban 60 másodperc (S-9).
  Memória korlátra iparági szállított szám nincs (S-9).

## 4. Fogalmak

- **Szkript lépés**: a `script` node egy lefutása, vagy a `join` node `script` módú lefutása.
- **Futás kontextus**: a SPEC-010 7.3 `RunContext` hét neve (`input`, `steps`, `item`, `itemIndex`,
  `iteration`, `joinInputs`, `error`).

## 5. Döntések

### 5.1 Izoláció: ami kizárt, forrásból

| Megoldás                                   | Döntés | Indok                                                                                             |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `node:vm`                                  | kizárt | a Node doksi szerint nem biztonsági mechanizmus, az időkorlát megkerülhető (S-1)                  |
| Node permission model a szerver folyamaton | kizárt | "seat belt", nem véd rosszindulatú kód ellen (S-2), és a szerver saját hozzáférését is korlátozná |
| `worker_threads` önmagában                 | kizárt | csak heap és stack korlát, fájlrendszer és hálózat izoláció nincs dokumentálva (S-3)              |
| `isolated-vm`                              | kizárt | karbantartási mód, natív build, a folyamat leállhat memória túllépésnél (S-4, S-5)                |
| Docker vagy más konténer                   | kizárt | projekt szabály (`.claude/CLAUDE.md` 7. szekció)                                                  |

### 5.2 A két életképes út, és amit mindegyik maga után von

A user nyelvválasztása (O-1) dönt közöttük; a spec mindkettőt előre leírja.

| Szempont                   | (A) CEL, a meglévő kifejezés nyelv                                                                                 | (B) JavaScript, QuickJS WebAssembly sandboxban                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Új függőség                | nincs (`@marcbachmann/cel-js` már pinelve, SPEC-010)                                                               | `quickjs-emscripten` (S-6), pinelve, a toolchain research fájlba vezetve, két forrásból (`.claude/CLAUDE.md` 4. szekció 4. pont)                                                        |
| Adat modell                | a `runtime: 'expression'` marad, a `db`, a `protocol` és a pillanatkép változatlan                                 | új `runtime` érték (például `'javascript'`) a `db` unióban és a `protocol` sémában, a meglévő sodródás védelemmel; a `GRAPH_DOCUMENT_VERSION` változásáról a SPEC-003 5.2 szabálya dönt |
| Mit ér el a szkript        | kizárólag a futás kontextust (S-12, a CEL nyelvi garanciája)                                                       | a sandbox globális objektumán csak az, amit a motor beletesz: a futás kontextus; fájlrendszer, hálózat, időzítő nincs (a QuickJS alapból nem ad ilyet, a gazda dönt)                    |
| Időkorlát                  | nincs (SPEC-010 O-2, user döntés): a szinkron kiértékelés alatt a szerver mást nem szolgál ki, ez kimondott korlát | a megszakítás kezelő 60 másodperces határidővel (iparági alapérték, n8n 3.0, S-9); a lejárat a lépést bukja                                                                             |
| Memória korlát             | nincs saját opció a csomagban; a parse idejű `limits` alapértékei érvényesek (SPEC-010 M-125)                      | nincs forrásolt iparági szám (S-9), ezért a spec nem ad értéket; nyitott technikai pont, 7.1 T-1                                                                                        |
| Ciklus, tetszőleges logika | nincs ciklus, csak makrók (`map`, `filter`, `all`, `exists`)                                                       | teljes nyelv                                                                                                                                                                            |
| Kockázat                   | a beágyazott makró exponenciális lehet (SPEC-010 M-123)                                                            | a sandbox szökés a WASM határán múlik; a README nem ad erős garanciát (S-6); az aszinkron kód megszakítása nem ellenőrzött (S-7)                                                        |

### 5.3 Bemenet

A szkript a futás kontextus hét nevét látja, ugyanazzal a leképezéssel, mint a `branch` kifejezése
(SPEC-010 7.3). A `join` `script` módban a `joinInputs` a beérkezett ág kimenetek listája, ugyanaz a lista,
amit a `merge` mód kimenetként ad (SPEC-004 5.6). A `script` node-nál a `joinInputs` hiányzó név, mint
minden nem `join` csomópontnál (SPEC-010 7.3 táblázata).

### 5.4 Kimenet

A szkript eredménye a lépés kimenete, a SPEC-010 7.4 normalizálás szerint (A úton változatlanul; B úton a
QuickJS értéket JSON alakba kell vinni, a nem JSON értékre a lépés bukik). A tárolási korlát a meglévő
`step_output_not_storable` (SPEC-010 O-21) mind a két úton. A lépés után a vezérlés a csomópont egyetlen
névtelen kimenő élén megy tovább (SPEC-008 5.1 táblázata).

### 5.5 Hibaosztályok

| Eset                               | A út                                                                                                                | B út                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| fordítási hiba a futás indításakor | a meglévő nyelvi mező ellenőrzés (`validateLanguageFields`), ugyanazzal az osztállyal, mint a `branch` kifejezésnél | új osztály: `script_compile_failed`    |
| futásidejű hiba                    | `expression_evaluation_failed` (meglévő)                                                                            | új osztály: `script_evaluation_failed` |
| időkorlát                          | nincs (5.2)                                                                                                         | új osztály: `script_timed_out`         |
| tárolhatatlan kimenet              | `step_output_not_storable` (meglévő)                                                                                | ugyanaz                                |

Új hibaosztály felvételekor a `protocol` `ProtocolErrorClass` szótára és a kliens magyar mondata a meglévő
szabály szerint bővül (`.claude/CLAUDE.md` 5. szekció, SPEC-005 8.5), az `error-class-drift-protection`
téma őrzésével.

### 5.6 Motor

- A `validateImplementedNodeTypes` a `script` node-ot és a `join` `script` módot többé nem utasítja el; az
  `unimplemented_node_type` osztály más típusra ma nem keletkezik, tehát a guard ága és a hibaosztály a 100
  százalékos lefedettség miatt törlendő, vagy kimondott okkal megtartandó (a halott ág tilalma,
  `.claude/CLAUDE.md` 5. szekció). A PLAN-015 T-015-3 dönti el a kód olvasásával.
- A diszpécser új `script` ága és a `join` beágyazott `switch`-ének `script` ága egy közös végrehajtót hív.
- A szkript lépés nem foglal párhuzamossági helyet (nincs provider hívás, SPEC-004 7.2 szerint a helyet csak
  agent lépés foglalja).

### 5.7 Felület

- A kártya figyelmeztetése (O-43), a panel `role="alert"` mondata és a "Futás indítása" gomb tiltása okkal
  megszűnik.
- A `source` mező a meglévő `TextAreaField` marad (design system `.textarea`, `.claude/CLAUDE.md` 11.
  szekció). B úton a `runtime` választó a meglévő `SelectField`.
- A mentési séma a `source` mezőt a kötelező szöveg mezők közé veszi fel (a meglévő `required-text-field-paths`
  tábla mindkét oldalon, a sodródás védelemmel), mert üres szkript nem futtatható. Ez az írás oldalt
  szigorítja, az olvasó út változatlan (`.claude/CLAUDE.md` 5. szekció, O-21 precedens).
- A futás nézet a szkript lépést a meglévő csomópont állapot jelvényekkel mutatja; új transcript sor típus
  nem kell, mert a lépés nem ad SDK eseményt.

## 6. Tesztelés

- Unit: a végrehajtó mindkét kimeneti ága (siker, hiba), a `join` `script` mód a `joinInputs` listával, a
  tárolási korlát, a futás indítás ellenőrzés (fordítási hiba). B úton a megszakítás és a memória túllépés.
- Valós `:memory:` adatbázis, hamis agent nélkül is futtatható, mert provider hívás nincs.
- e2e: a szerkesztő tiltása megszűnik, a `source` kötelező mező hibája a mező alatt jelenik meg.
- Valódi API hívás nem kell.

## 7. Nyitott kérdések

### 7.1 Termékdöntések (user)

| #   | Kérdés                                        | Opciók                                                                                                                      | Mi a viselkedés addig                                         | Mi zárná le                         |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| O-1 | Milyen nyelven írja a felhasználó a szkriptet | (a) CEL, a már meglévő kifejezés nyelv (ajánlott); (b) JavaScript sandboxban; (c) mindkettő, választhatóan                  | a mai korlát: tárolható, a futás elutasítja, a felület tiltja | user döntés                         |
| O-2 | Mit érhet el a szkript                        | (a) csak a futás adatait (ajánlott); (b) ezen felül hálózatot vagy fájlt is (csak a JavaScript úton értelmezhető)           | ugyanaz                                                       | user döntés                         |
| O-3 | Kell-e a `join` `script` módja egyáltalán     | (a) igen, ugyanazzal a nyelvvel (ajánlott); (b) a mód kikerül, a szkript csak önálló csomópont                              | ugyanaz                                                       | user döntés                         |
| O-4 | Ha a szkript lassú, mi történjen              | csak (b) JavaScript út esetén értelmes: (a) 60 másodperc után a lépés bukik (ajánlott, iparági alapérték); (b) nincs korlát | ugyanaz                                                       | user döntés, ha az O-1 (b) vagy (c) |

Az O-1 ajánlása: a CEL nem igényel új függőséget és új izolációt, a projekt már elfogadta a biztonsági
modelljét (SPEC-010), és a `runtime: 'expression'` adat modell változatlan maradhat. Az ára: nincs ciklus és
tetszőleges logika.

### 7.2 Technikai, nyitva

| #   | Kérdés                                      | Mi a viselkedés addig                 | Mi zárná le                                                          |
| --- | ------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| T-1 | QuickJS memória korlát értéke (csak B úton) | a spec nem ad számot                  | forrásolt iparági ajánlás, vagy saját mérés a megcélzott szkriptekre |
| T-2 | QuickJS megszakítás aszinkron kódnál (S-7)  | B úton a Promise tiltott vagy mérendő | mérés a pinelt verzióval a PLAN-015 F0 fázisában                     |

## 8. Elfogadási kritériumok

1. A `script` node és a `join` `script` mód futtatható, a futás indítása nem ad `unimplemented_node_type`
   hibát; az `unimplemented_node_type` sorsa (törlés vagy megtartás) kimondva és tesztelve.
2. A szkript a futás kontextus hét nevét a SPEC-010 7.3 leképezéssel látja; a `join` `script` módban a
   `joinInputs` a `merge` móddal azonos lista.
3. A szkript eredménye a lépés kimenete, a SPEC-010 7.4 normalizálással; a korlát fölötti kimenet
   `step_output_not_storable`.
4. A fordítási hiba a futás indításakor, a futásidejű hiba a lépésen jelentkezik, az 5.5 táblázat
   osztályaival, mindegyik hibaosztály a `protocol` szótárában és a kliens magyar mondatai között.
5. A szkript nem ér el fájlrendszert, hálózatot, folyamatot vagy időzítőt (A úton nyelvi garancia, B úton
   unit teszt a sandbox globális objektumára).
6. B úton a 60 másodperces megszakítás `script_timed_out` osztállyal bukik, unit teszt hamis órával vagy a
   megszakítás kezelő bemenetével.
7. A szerkesztő tiltása és figyelmeztetése megszűnt; a `source` kötelező mező a mentéskor, a hiba a mező
   alatt; a sodródás védelem mindkét oldalon.
8. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.
9. A SPEC-003 4.3, SPEC-004 4.7 és 5. szekció, SPEC-008 5.1 és O-43, a csomagok `CLAUDE.md` fájljai és a
   hiányleltár H-13 sora átvezetve.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-015-szkript-csomopont.md`](../plan/PLAN-015-szkript-csomopont.md)
- [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)
- [`SPEC-010-sablon-es-kifejezes-nyelv.md`](SPEC-010-sablon-es-kifejezes-nyelv.md)
