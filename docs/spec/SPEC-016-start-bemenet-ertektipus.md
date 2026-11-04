# SPEC-016: A Start csomópont bemeneti mezőinek értéktípusa (`valueKind`)

|          |                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott: a 7. szekció O-1 ... O-3 termékkérdése lezárva (user döntés 2026-11-04); a technikai döntések forrásból lezárva (5. szekció)                                                                                                 |
| Dátum    | 2026-11-03, átvezetve 2026-11-04                                                                                                                                                                                                          |
| Előzmény | [`SPEC-003`](SPEC-003-domain-perzisztencia.md) 4.3, [`SPEC-004`](SPEC-004-vegrehajto-motor.md) 4.8 4. lépés, [`SPEC-008`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) 5.1 és 6.5, [`SPEC-010`](SPEC-010-sablon-es-kifejezes-nyelv.md) 7.3 |
| Bemenet  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) 2., 5. és 9. szekció; a hiányleltár H-12 tétele                                                                            |
| Kimenet  | a `valueKind` zárt értékkészlet minden rétegen, a futás indító ablak típus szerinti mezőt mutat, a futás bemenete típusos JSON érték, a motor a típust ellenőrzi                                                                          |
| Terv     | [`../plan/PLAN-017-start-bemenet-ertektipus.md`](../plan/PLAN-017-start-bemenet-ertektipus.md)                                                                                                                                            |

---

## 1. Cél és hatókör

A user döntése (SPEC-009 14.6 O-25, 2026-10-26): a `valueKind` értékkészlete "saját kis spec". Ma a mező
szabad szöveg, semmi nem értelmezi, és minden futás bemenet szövegként érkezik.

**A user döntései (2026-11-04), szó szerint:**

- Típusok: "minden tipus mert lehet az is hogy eppen egy json -t akarok beadni egyik parameterbe ...": szöveg,
  szám, igen/nem, választólista, lista, összetett JSON adat.
- Alapértelmezett típus: "Szöveg".
- Régi, ismeretlen típus: tárolt adat nincs (user, korábban: "nincs meg adatbazis!!!! nincs mit migralni!!",
  "nincs regi rajz!!!"), tehát nincs visszafelé kompatibilitási ág: a típus mindenhol, az olvasó úton is, szigorú
  zárt felsorolás.

### Amit eldönt

1. A `valueKind` hat értékét és a nevüket (5.1).
2. A zárt felsorolást minden rétegen, az olvasó utat is beleértve (5.2).
3. A választólista opcióinak alakját (5.3).
4. A futás bemenetének típusos alakját és ellenőrzését (5.4, 5.5).
5. A szerkesztő és a futás indító ablak mezőit (5.6).

### Amit NEM dönt el

- A CEL szám aritmetikájának szabályát (`double` és `int`): a SPEC-010 hatóköre, itt csak a következménye áll
  (5.4).
- Alapértéket a futás indító ablak mezőire (egy mező előre kitöltött értékét): nem kérte senki.

## 2. Kiindulási állapot

| Réteg            | Mai állapot                                                                                     | Hely (`bbed64c`)                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`             | `valueKind: string`, komment: "a felsorolás rögzítése külön termékdöntés"                       | `packages/db/src/workflow-graph/node-config/node-config.ts:18-28`                                                                                 |
| `db`, `protocol` | a `valueKind` kötelező szöveg mező mindkét tábla szerint                                        | `packages/db/src/workflow-graph/node-config/required-text-field-paths.ts:23`; `packages/protocol/src/node-config/required-text-field-paths.ts:22` |
| `protocol`       | `valueKind: z.string()`; a `StartRunRequest.input` `z.record(z.string(), z.unknown())`          | `packages/protocol/src/node-config/node-config.ts:25-29`; `packages/protocol/src/run/start-run-request.ts:11`                                     |
| `engine`         | csak a `required` mezők jelenlétét ellenőrzi                                                    | `packages/engine/src/run-supervisor/validate-run-input.ts:44-54`                                                                                  |
| `apps/web`       | a szerkesztőben szabad szöveg, alapértéke `'string'`; a futás indító ablak minden mezője szöveg | `apps/web/src/node-inspector/StartNodeFields.tsx:11, 58-65`; `apps/web/src/run-control/StartRunModal.tsx:48-51`                                   |
| `apps/web`       | soronkénti `<textarea>` lista szerkesztő minta (`allowedTools`, `additionalDirectories`)        | `apps/web/src/node-inspector/string-list-field-value.ts:1-16`                                                                                     |
| `packages/ui`    | `Checkbox`, `SelectField`, `TextField`, `TextAreaField` létező komponens                        | `packages/ui/src/form-control/Checkbox.tsx`; `select-field/SelectField.tsx`; `text-field/`; `textarea/TextAreaField.tsx`                          |
| adat             | a commitolt v1 pillanatkép fixtúrában `'text'` és `'number'`, a bemutató fixtúrában `'string'`  | `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json:18-19`; `apps/web/e2e/showcase-graph.ts:40`                 |

## 3. Megerősített tények

Teljes lista: research 5. szekció (E-1 ... E-6). Kivonat:

- A GitHub Actions kézi indításának mezőtípusai: `boolean`, `choice`, `number`, `environment`, `string` (E-1);
  az n8n és a Windmill tömb és objektum típussal egészíti ki (E-2, E-3), és a Windmill a bemenetet a típusra
  ellenőrzi (E-3).
- A CEL szigorú típusú: szöveget számmal nem hasonlít, a JSON szám `double` (E-4). Ma tehát egy
  `input.darab > 3` kifejezés hibát ad, mert a `darab` szövegként érkezik. A `cel-js` viselkedése mérendő
  (E-5).
- A böngésző beviteli mezője szöveget ad, a számot a `valueAsNumber` adja, üresen `NaN` (E-6).

## 4. Fogalmak

- **Értéktípus**: a `valueKind` egy zárt értéke.
- **Típusos bemenet**: a futás `input` rekordjában a mezőhöz tartozó JSON érték a típusnak megfelelő JSON
  alakkal.

## 5. Döntések

### 5.1 A hat érték

| `valueKind` | Felirat       | JSON alak a futás bemenetében    | Futás indító mező                                                     |
| ----------- | ------------- | -------------------------------- | --------------------------------------------------------------------- |
| `text`      | Szöveg        | szöveg                           | `TextField`                                                           |
| `number`    | Szám          | véges szám                       | `TextField` `type="number"`, az érték a `valueAsNumber` alapján (E-6) |
| `boolean`   | Igen/nem      | `true` vagy `false`              | `Checkbox`                                                            |
| `choice`    | Választólista | szöveg, az `options` egyik eleme | `SelectField`                                                         |
| `list`      | Lista         | szövegek tömbje                  | `TextAreaField`, soronként egy elem (a projekt meglévő lista mintája) |
| `json`      | JSON adat     | bármely JSON érték               | `TextAreaField`, `JSON.parse` a küldés előtt                          |

- A nevek a GitHub Actions kézi indításának kulcsszavait követik, ahol van megfelelő (`number`, `boolean`,
  `choice`, E-1). A szöveg neve `text`, nem `string`: a commitolt v1 pillanatkép fixtúra `'text'` és `'number'`
  értéket hordoz, és a lenyomata literálként áll a teszten (`graph-snapshot-document-v1-fixture.spec.ts`); ezzel a
  névvel a fixtúra a szigorú olvasó úton is érvényes marad, és a lenyomat literál nem változik.
- A `list` elemei szövegek, mert a projekt lista szerkesztő mintája soronkénti szöveg
  (`string-list-field-value.ts`); tetszőleges elemű tömb a `json` típussal adható.
- A `json` bármely JSON értéket elfogad (objektum, tömb, szöveg, szám, logikai, `null`), mert a user kérése
  "egy json -t akarok beadni"; a drót már ma is bármilyen JSON értéket elfogad (research C-19).
- Az új mező alapértéke `text` (O-3 user döntés, "Szöveg").

### 5.2 Zárt felsorolás minden rétegen, az olvasó úton is

- `db`: `StartInputValueKind` literál unió; az `isNodeConfig` guard (írás és olvasás: `replaceGraph`,
  `readGraph`, a futás indítás ellenőrzése, a pillanatkép node `config` ellenőrzése) csak a hat értéket fogadja el.
- `protocol`: `z.enum(...)` az olvasó és a mentési sémában is, a `db` uniójának szándékos duplikátumaként, az
  `enum-drift-protection` minta szerinti kétirányú típusszintű és futásidejű védelemmel (`.claude/CLAUDE.md` 5. szekció).
- Nincs visszafelé kompatibilitási ág (O-2 user döntés). Ez a `.claude/CLAUDE.md` 5. szekció "a kötelező szöveg
  mezőnél csak az írás oldala szigorodik" szabályának kimondott kivétele: ott az ok a régi, tárolt pillanatkép
  olvashatósága, itt tárolt adat nincs, és a commitolt fixtúra a választott nevekkel érvényes (5.1). A szabálykönyv
  ezt a kivételt átvezeti (PLAN-017 T-017-10).
- A `GRAPH_DOCUMENT_VERSION` nem nő (SPEC-003 5.2): a fixtúra olvasható marad, más tárolt dokumentum nincs.
- A kötelező szöveg mezők táblájából az `inputFields.*.valueKind` kikerül mindkét oldalon (a választó mezőnek
  nincs "üres" állapota); a tábla és a védelme együtt változik.

### 5.3 A választólista opciói

- A `StartInputField` a `valueKind` szerinti diszkriminált unió lesz: a `choice` ág kötelező `options: readonly string[]`
  mezőt kap, a többi ágon a mező nem létezik. A zárt kulcslista (`isRecordWithKnownKeys`, `z.strictObject`) ágonként
  áll, a `protocol` oldalon `z.discriminatedUnion('valueKind', ...)`.
- Mentési szabály mindkét oldalon, a sodródás védelemmel: az `options` nem üres, minden eleme nem üres szöveg, és
  az elemek egyediek. Indok: üres listából nem lehet választani, és két azonos elem a választóban
  megkülönböztethetetlen.
- A szerkesztőben az opciók a meglévő soronkénti `TextAreaField` mintával szerkeszthetők
  (`string-list-field-value.ts`).

### 5.4 A futás bemenete típusos JSON

- A futás indító ablak az 5.1 táblázat JSON alakját küldi. A `StartRunRequest` alakja nem változik (C-19).
- Az üres, nem kötelező mező kulcsa hiányzik a rekordból, ugyanúgy, mint ma: a motor a hiányzó kulcsot és az
  `undefined` értéket egyformán "nincs érték" jelentéssel kezeli (`validate-run-input.ts:14-19`). Üres a szám mező,
  ha a `valueAsNumber` `NaN`; üres a lista, ha a soronkénti felbontás után nincs elem; üres a JSON mező, ha a szöveg
  csak szóközt tartalmaz.
- A `boolean` mező mindig küld értéket (`true` vagy `false`), mert a jelölőnégyzetnek nincs harmadik állapota; a
  `required` jelzés ezért ennél a típusnál mindig teljesül.
- A JSON mező szövege, ha nem értelmezhető (`JSON.parse` kivétel), a mező alatti hibát ad, és a futás nem indul.
- A szám a CEL-ben `double` (E-4, SPEC-010 M-122), tehát `input.darab > 3` működik, de `input.darab + 1` int
  literállal a CEL szabálya szerint nem (nincs automatikus aritmetikai konverzió, E-4); a helyes alak
  `input.darab + 1.0`. A viselkedést a PLAN-017 T-017-2 lépése a `cel-js`-en méri (E-5), és a SPEC-010
  dokumentációja mondja ki.

### 5.5 A motor ellenőrzi a típust

A futás indításának 4. lépése (SPEC-004 4.8) a `required` ellenőrzés után minden **jelen lévő** mező értékét a
típusára ellenőrzi:

| `valueKind` | Elfogadott érték                                  | Guard                                                                            |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `text`      | szöveg                                            | `typeguards` `isString`                                                          |
| `number`    | véges szám                                        | `typeguards` `isNumber` (a `NaN` és a végtelen kizárva, a guard doksija szerint) |
| `boolean`   | logikai                                           | `typeguards` `isBoolean`                                                         |
| `choice`    | szöveg, ami az `options` eleme                    | `isString` plusz tagság                                                          |
| `list`      | szövegek tömbje                                   | `typeguards` `isStringArray`                                                     |
| `json`      | bármely érték, ami a drót JSON értelmezéséből jön | nincs ellenőrzés: a drót JSON-t ad, más érték nem érkezhet                       |

Eltérésnél a futás nem indul, adat írás nélkül, új osztállyal: `invalid_input_type`, a `ProtocolErrorClass`
szótárba és a kliens magyar mondatai közé is felvéve, a sodródás védelemmel. Indok: a felület mellett az API is
indíthat futást, és a Windmill minta is a bemenetet ellenőrzi (E-3). A `json` ágon nincs futásidejű ág, mert az
garantáltan sosem bukna (a halott ág tilalma, `.claude/CLAUDE.md` 5. szekció).

### 5.6 Felület

- Szerkesztő: `SelectField` a hat értékre az 5.1 feliratával, az új mező alapértéke `text`; `choice` típusnál az
  opciók soronkénti `TextAreaField` mezője. A hibaüzenet a mező alatt (`.claude/CLAUDE.md` 11. szekció).
- Futás indító ablak: az 5.1 táblázat mezői, a hibaüzenet a mező alatt.
- Újraindításnál (`restartRun`) a tárolt bemenet változatlanul megy tovább.
- A bemutató fixtúra (`showcase-graph.ts`) `'string'` értéke `'text'` lesz; a képernyőkép lenyomata ettől elavul,
  a `bun run screenshots` újra fut (`.claude/CLAUDE.md` 12. szekció).

## 6. Tesztelés

- `db`, `protocol`: a hat érték írás és olvasás oldalon, ismeretlen érték elutasítva mindkét úton, a `choice`
  `options` szabálya, a sodródás védelem mindkét irányban; a v1 fixtúra teszt változatlanul zöld.
- `engine`: `invalid_input_type` minden típusra (a `json` kivételével), a hiányzó nem kötelező mező nem hiba, a
  `choice` opción kívüli értéke hiba.
- `apps/web`: a választó a szerkesztőben, az opciók mezője, a típusos mezők a futás indító ablakban, a küldött JSON
  alakja, az érvénytelen JSON mező alatti hibája; e2e a futás indításra `page.route()` mockkal.
- Mérés: a `cel-js` 8.0.0 viselkedése szöveg, szám és logikai bemenetre (E-5).

## 7. Nyitott kérdések

### 7.1 Termékdöntések (user)

| #   | Kérdés                                                            | Döntés                                                                                                                     |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| O-1 | Milyen típusok közül választhasson a workflow készítő             | **lezárva** (user döntés 2026-11-04): mind a hat (szöveg, szám, igen/nem, választólista, lista, összetett JSON adat), 5.1  |
| O-2 | Egy régi workflow-ban álló, ismeretlen típus szövegével mi legyen | **lezárva** (user döntés 2026-11-04): régi adat nincs, nincs kompatibilitási ág, minden úton szigorú zárt felsorolás (5.2) |
| O-3 | Új mező felvételekor mi legyen az alapértelmezett típus           | **lezárva** (user döntés 2026-11-04): "Szöveg" (`text`)                                                                    |

### 7.2 Technikai, nyitva

| #   | Kérdés                                   | Mi a viselkedés addig                      | Mi zárná le      |
| --- | ---------------------------------------- | ------------------------------------------ | ---------------- |
| T-1 | A `cel-js` 8.0.0 típus viselkedése (E-5) | a CEL szabálya (E-4) a dokumentált elvárás | a T-017-2 mérése |

## 8. Elfogadási kritériumok

1. A `valueKind` hat értékű zárt felsorolás a `db` és a `protocol` írás és olvasás oldalán, a kétirányú sodródás
   védelemmel; ismeretlen érték mindkét úton elutasítva.
2. A commitolt v1 pillanatkép fixtúra olvasható, a lenyomat literál változatlan.
3. A `choice` típus kötelező, nem üres, egyedi, nem üres elemű `options` listát hordoz, a zárt kulcslista ágonként
   mindkét oldalon.
4. A futás indító ablak a típus szerinti mezőt mutatja, és az 5.1 JSON alakot küldi; az érvénytelen JSON a mező
   alatt jelez.
5. A motor a jelen lévő mezők típusát ellenőrzi, eltérésnél `invalid_input_type`, adat írás nélkül; a kód a
   `protocol` szótárában és a kliens magyar mondatai között, a drift védelemmel.
6. A `cel-js` mért viselkedése a research fájlban, és a szám aritmetika szabálya a SPEC-010 dokumentációjában.
7. A SPEC-003 4.3, SPEC-004 4.8, SPEC-008 5.1 és 6.5, a csomagok `CLAUDE.md` fájljai (`apps/web/CLAUDE.md:284-288`,
   `packages/db/CLAUDE.md:77`), a szabálykönyv 5. szekciója (5.2 kivétel) és a hiányleltár H-12 sora átvezetve.
8. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-017-start-bemenet-ertektipus.md`](../plan/PLAN-017-start-bemenet-ertektipus.md)
- [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)
