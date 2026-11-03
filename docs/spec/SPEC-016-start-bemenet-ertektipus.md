# SPEC-016: A Start csomópont bemeneti mezőinek értéktípusa (`valueKind`)

|          |                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, user döntésre vár: a 7. szekció O-1 ... O-3 termékkérdése nyitott; a technikai döntések forrásból lezárva (5. szekció)                                                                                                          |
| Dátum    | 2026-11-03                                                                                                                                                                                                                                |
| Előzmény | [`SPEC-003`](SPEC-003-domain-perzisztencia.md) 4.3, [`SPEC-004`](SPEC-004-vegrehajto-motor.md) 4.8 4. lépés, [`SPEC-008`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) 5.1 és 6.5, [`SPEC-010`](SPEC-010-sablon-es-kifejezes-nyelv.md) 7.3 |
| Bemenet  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) 2. és 5. szekció; a hiányleltár H-12 tétele                                                                                |
| Kimenet  | a `valueKind` zárt értékkészlet, a futás indító ablak típus szerinti mezőt mutat, a futás bemenete típusos JSON érték, a motor a típust ellenőrzi                                                                                         |
| Terv     | [`../plan/PLAN-017-start-bemenet-ertektipus.md`](../plan/PLAN-017-start-bemenet-ertektipus.md)                                                                                                                                            |

---

## 1. Cél és hatókör

A user döntése (SPEC-009 14.6 O-25, 2026-10-26): a `valueKind` értékkészlete "saját kis spec". Ma a mező
szabad szöveg, semmi nem értelmezi, és minden futás bemenet szövegként érkezik.

### Amit eldönt

1. A `valueKind` zárt felsorolás lesz, és ami ebből a rétegekre következik (5.1).
2. A régi, tárolt szövegek olvashatósága (5.2).
3. A futás bemenetének típusos alakja és ellenőrzése (5.3, 5.4).
4. A szerkesztő és a futás indító ablak mezői (5.5).

### Amit NEM dönt el

- Az értékkészlet tagjait, a régi értékek sorsát és az alapértéket: termékdöntés (7. szekció).
- A CEL szám aritmetikájának szabályát (`double` és `int`): a SPEC-010 hatóköre, itt csak a következménye áll
  (5.3).

## 2. Kiindulási állapot

| Réteg            | Mai állapot                                                                                     | Hely (`bbed64c`)                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`             | `valueKind: string`, komment: "a felsorolás rögzítése külön termékdöntés"                       | `packages/db/src/workflow-graph/node-config/node-config.ts:18-28`                                                                                 |
| `db`, `protocol` | a `valueKind` kötelező szöveg mező mindkét tábla szerint                                        | `packages/db/src/workflow-graph/node-config/required-text-field-paths.ts:23`; `packages/protocol/src/node-config/required-text-field-paths.ts:22` |
| `protocol`       | `valueKind: z.string()`; a `StartRunRequest.input` `z.record(z.string(), z.unknown())`          | `packages/protocol/src/node-config/node-config.ts:25-29`; `packages/protocol/src/run/start-run-request.ts:11`                                     |
| `engine`         | csak a `required` mezők jelenlétét ellenőrzi                                                    | `packages/engine/src/run-supervisor/validate-run-input.ts:44-54`                                                                                  |
| `apps/web`       | a szerkesztőben szabad szöveg, alapértéke `'string'`; a futás indító ablak minden mezője szöveg | `apps/web/src/node-inspector/StartNodeFields.tsx:11, 58-65`; `apps/web/src/run-control/StartRunModal.tsx:48-51`                                   |
| adat             | a tárolt adatban `'string'`, `'text'` és `'number'` is előfordul                                | `apps/web/e2e/showcase-graph.ts:40`; `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json:18-19`                 |

## 3. Megerősített tények

Teljes lista: research 5. szekció (E-1 ... E-6). Kivonat:

- A GitHub Actions kézi indításának mezőtípusai: szöveg, szám, logikai, választólista, környezet (E-1); az
  n8n és a Windmill hasonló készletet használ, lista és objektum típussal kiegészítve (E-2, E-3), és a
  Windmill a bemenetet a típusra ellenőrzi (E-3).
- A CEL szigorú típusú: szöveget számmal nem hasonlít, a JSON szám `double` (E-4). Ma tehát egy
  `input.darab > 3` kifejezés hibát ad, mert a `darab` szövegként érkezik. A `cel-js` viselkedése mérendő
  (E-5).
- A böngésző beviteli mezője szöveget ad, a számot külön kell kiolvasni (E-6).

## 4. Fogalmak

- **Értéktípus**: a `valueKind` egy zárt értéke.
- **Típusos bemenet**: a futás `input` rekordjában a mezőhöz tartozó JSON érték a típusnak megfelelő JSON
  típussal (szöveg, szám, logikai).

## 5. Döntések

### 5.1 Zárt felsorolás, minden rétegen

- `db`: `StartInputValueKind` literál unió; az írás oldali `replaceGraph` ellenőrzés csak ezt fogadja el.
- `protocol`: `z.enum(...)` a mentési sémában, a `db` uniójának szándékos duplikátumaként, az
  `enum-drift-protection` minta szerinti kétirányú típusszintű és futásidejű védelemmel (`.claude/CLAUDE.md` 5. szekció).
- A kötelező szöveg mezők táblájából a `inputFields.*.valueKind` kikerül mindkét oldalon (a választó mezőnek
  nincs "üres" állapota); a tábla és a védelme együtt változik.
- A szerkesztő `valueKind` mezője a meglévő `SelectField` lesz (design system React változat, `.claude/CLAUDE.md` 11. szekció).

### 5.2 A régi értékek olvashatósága

Az olvasó út (`NodeConfigSchema`, `WorkflowGraphDocumentSchema`, a `db` `readGraph` guardja és a pillanatkép
olvasása) **továbbra is elfogad bármilyen szöveget**, mert a pillanatkép megváltoztathatatlan (SPEC-003 5.5,
5.6), és a régi gráfnak és futásnak olvashatónak kell maradnia: ez a kötelező szöveg mezők szigorításának
precedense (`.claude/CLAUDE.md` 5. szekció, user döntés 2026-09-28, O-21). A `GRAPH_DOCUMENT_VERSION` nem nő,
mert a dokumentum alakja nem változik. Hogy a futás indítása mit kezd egy régi, a készletben nem szereplő
értékkel, termékdöntés (O-2).

### 5.3 A futás bemenete típusos JSON

- A futás indító ablak a mező típusa szerinti JSON értéket küld: szöveg mezőre szöveget, szám mezőre számot,
  logikai mezőre `true` vagy `false` értéket. A drót ma is elfogad bármilyen JSON értéket (research C-19), tehát a
  `StartRunRequest` alakja nem változik.
- Az üres, nem kötelező mező kulcsa hiányzik a rekordból, ugyanúgy, mint ma: a motor a hiányzó kulcsot és az
  `undefined` értéket egyformán "nincs érték" jelentéssel kezeli (`validate-run-input.ts:14-19`).
- A szám a CEL-ben `double` (E-4, SPEC-010 M-122), tehát `input.darab > 3` működik, de `input.darab + 1`
  int literállal a CEL szabálya szerint nem (nincs automatikus aritmetikai konverzió, E-4); a helyes alak
  `input.darab + 1.0`. Ezt a szerkesztő súgója vagy a SPEC-010 dokumentációja mondja ki; a viselkedést a
  PLAN-017 F0 lépése a `cel-js`-en méri (E-5).

### 5.4 A motor ellenőrzi a típust

A futás indításának 4. lépése (SPEC-004 4.8) a `required` ellenőrzés után minden **jelen lévő** mező értékét a
típusára ellenőrzi; eltérésnél a futás nem indul, adat írás nélkül, új osztállyal: `invalid_input_type`, a
`ProtocolErrorClass` szótárba és a kliens magyar mondatai közé is felvéve, a sodródás védelemmel. Indok: a
felület mellett az API is indíthat futást, és a Windmill minta is a bemenetet ellenőrzi (E-3). Az ellenőrzés a
`typeguards` csomag meglévő guardjaival (`isString`, és szükség szerint új, fájlonként egy guard) történik.

### 5.5 Felület

- Szerkesztő: `SelectField` az értéktípusra, az új mező alapértéke az O-3 döntés szerint.
- Futás indító ablak: szöveg típusra a meglévő `TextField`; szám típusra `TextField` `type="number"`, az érték
  a `valueAsNumber` alapján (E-6), üres mezőre hiányzó kulcs; logikai típusra a meglévő `Checkbox`; választó
  lista típusra (ha az O-1 tartalmazza) a meglévő `SelectField`. A hibaüzenet a mező alatt (`.claude/CLAUDE.md` 11. szekció).
- Újraindításnál (`restartRun`) a tárolt bemenet változatlanul megy tovább.

## 6. Tesztelés

- `db`, `protocol`: a zárt készlet írás oldalon, a régi szöveg olvasó oldalon, a sodródás védelem mindkét
  irányban.
- `engine`: `invalid_input_type` minden típusra, a hiányzó nem kötelező mező nem hiba, a régi érték az O-2
  szerint.
- `apps/web`: a választó a szerkesztőben, a típusos mezők a futás indító ablakban, a küldött JSON típusa;
  e2e a futás indításra `page.route()` mockkal.
- Mérés: a `cel-js` 8.0.0 viselkedése szöveg, szám és logikai bemenetre (E-5).

## 7. Nyitott kérdések

### 7.1 Termékdöntések (user)

| #   | Kérdés                                                            | Opciók                                                                                                                                                  | Mi a viselkedés addig                            | Mi zárná le |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| O-1 | Milyen típusok közül választhasson a workflow készítő             | (a) szöveg, szám, igen/nem, választólista (ajánlott, a GitHub kézi indítás mintája); (b) szöveg, szám, igen/nem; (c) ezek plusz lista és összetett adat | szabad szöveg, minden bemenet szövegként érkezik | user döntés |
| O-2 | Egy régi workflow-ban álló, ismeretlen típus szövegével mi legyen | (a) szövegként kezeljük, a futás indul (ajánlott); (b) a futás csak újramentés után indul                                                               | ugyanaz                                          | user döntés |
| O-3 | Új mező felvételekor mi legyen az alapértelmezett típus           | (a) szöveg (ajánlott, ez a mai viselkedés); (b) nincs alapérték, választani kell                                                                        | `'string'` szöveg                                | user döntés |

Ha az O-1 (a) vagy (c), a választólista mezőhöz az opciók listája is kell (`options: readonly string[]`, csak
ennél a típusnál), ami a `db` és a `protocol` alakját és a `isRecordWithKnownKeys` kulcslistát is bővíti; a
(c) lista és összetett adat típusához JSON szerkesztő mező kell a futás indító ablakban, amire a design
systemben a `.textarea` áll rendelkezésre.

## 8. Elfogadási kritériumok

1. A `valueKind` zárt felsorolás a `db` és a `protocol` írás oldalán, a kétirányú sodródás védelemmel.
2. A régi szöveges érték olvasható, a pillanatkép és a régi futás megnyitható; a futás indítása az O-2 szerint
   jár el, teszttel.
3. A futás indító ablak a típus szerinti mezőt mutatja, és típusos JSON értéket küld.
4. A motor a jelen lévő mezők típusát ellenőrzi, eltérésnél `invalid_input_type`, adat írás nélkül.
5. A `cel-js` mért viselkedése a research fájlban, és a szám aritmetika szabálya a felhasználónak szóló
   dokumentációban.
6. A SPEC-003 4.3, SPEC-008 5.1 és 6.5, a csomagok `CLAUDE.md` fájljai (`apps/web/CLAUDE.md:284-288`,
   `packages/db/CLAUDE.md:77`) és a hiányleltár H-12 sora átvezetve.
7. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-017-start-bemenet-ertektipus.md`](../plan/PLAN-017-start-bemenet-ertektipus.md)
- [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)
