# SPEC-015: A strukturált kimenet séma szerinti ellenőrzése

|          |                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott: a 7.1 szekció O-1 ... O-3 termékkérdése lezárva (user döntés 2026-11-04); a technikai döntések forrásból lezárva (5. szekció)                                                          |
| Dátum    | 2026-11-03, átvezetve 2026-11-04 (a `format` kulcsszó, a fordító naplózója és a lefordított ellenőrző átadása: 5.2, 5.3, 5.4)                                                                       |
| Előzmény | [`SPEC-003`](SPEC-003-domain-perzisztencia.md) 4.6, [`SPEC-004`](SPEC-004-vegrehajto-motor.md) 5.2 és 17. szekció 21. kritérium, [`SPEC-013`](SPEC-013-flash-es-haiku.md) 3.2 (a Flash leíró mezői) |
| Bemenet  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) 2. és 4. szekció; a hiányleltár H-17 tétele                                          |
| Kimenet  | a strukturált kimenetet váró lépés csak akkor `succeeded`, ha a kimenet a beállított sémára illeszkedik; a SPEC-004 21. kritériuma teljesül                                                         |
| Terv     | [`../plan/PLAN-016-strukturalt-kimenet-sema-ellenorzes.md`](../plan/PLAN-016-strukturalt-kimenet-sema-ellenorzes.md)                                                                                |

---

## 1. Cél és hatókör

A user döntése (SPEC-009 14.6 O-24, 2026-10-26): a strukturált kimenet séma szerinti ellenőrzése saját
specet kap. A `packages/engine/CLAUDE.md:432-437` a hiányt "megnevezett hiány, nem elfogadott végállapot"
címkével vezeti.

**A user döntései (2026-11-04), szó szerint:** rossz alakú kimenet: "Hibával megáll" (a lépés hibás, a
hibakezelő csomóponttal újrapróbálható); hibás séma jelzése: "Mentéskor és indításkor"; séma korlát: "Nincs".

### Amit eldönt

1. Hol és mivel ellenőriz a motor (5.1 ... 5.3).
2. Mikor ellenőrzi a séma saját érvényességét (5.4).
3. Az eltérés hibaosztályát és a lépés sorsát (5.5).
4. Hogy a `join` `ai_synthesis` módja is ugyanígy jár el (5.6).
5. A mentéskori ellenőrzés helyét (5.7) és a séma korlát hiányának következményét (5.8).

### Amit NEM dönt el

- A szerkesztő séma író felületét (ma szabad JSON szöveg, `apps/web/src/node-inspector/StructuredOutputField.tsx`):
  csak a mentéskori hibajelzés helyét (5.7).
- A `MiniMax-M3.1-Flash` dekódolási viselkedését a séma kulcsszavaira: mérési kérdés (research K-6), a motor
  ellenőrzése éppen ettől függetleníti a helyességet.
- Új stratégiát: a `StructuredOutputStrategyId` egyetlen értéke a `sdk_output_format` marad.

## 2. Kiindulási állapot

| Réteg      | Mai állapot                                                                                               | Hely (`bbed64c`)                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `db`       | `StructuredOutputConfig { strategy; schema: unknown }`                                                    | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:25-33` |
| `protocol` | `schema: z.unknown()`                                                                                     | `packages/protocol/src/node-config/agent-step-config.ts:29-33`                |
| `engine`   | a séma változatlanul az SDK `outputFormat` mezőjébe megy                                                  | `packages/engine/src/agent-step/build-agent-step-options.ts:36-48`            |
| `engine`   | a `result` után csak a `structured_output` jelenlétét nézi, hiányra `missing_structured_output`           | `packages/engine/src/agent-step/run-agent-step.ts:88-97`                      |
| `agent`    | `hasStructuredOutput` a jelenlétet adja, a tartalmat nem                                                  | `packages/agent/src/sdk-message-shape/has-structured-output.ts:10-12`         |
| spec       | a SPEC-004 21. kritériuma "illeszkedik a sémára" fordulatot tartalmaz                                     | `docs/spec/SPEC-004-vegrehajto-motor.md:971`                                  |
| leíró      | a `minimax` `sdk_output_format` stratégiája használható (M-03-flash), a megbízhatóság a Flash-re nem mért | `packages/provider-minimax/src/request-shaping/structured-output.ts:4-27`     |

## 3. Megerősített tények

Teljes lista: research 4. szekció (K-1 ... K-11). Kivonat:

- Az SDK draft-07 szerint ellenőriz, eltérésnél újrakérdez, és a korlát után hibát ad; az újrapróbálások
  számát nem nevezi meg (K-2, K-3). Ugyanez a doksi azt is mondja, hogy `success` subtype mellett is
  hiányozhat a kimenet (K-4), és a saját példája kliens oldalon újra ellenőriz.
- Az Anthropic API a dekódolásban több kulcsszót nem kényszerít (`minimum`, `minLength` és társaik), és azt
  ajánlja, hogy a választ az eredeti, teljes sémára ellenőrizzük (K-5).
- A MiniMax doksi a mezőről hallgat (K-6).
- Az iparági keretrendszerek kliens oldalon ellenőriznek és eltérésnél hibát adnak, újrapróbálás nélkül
  (K-11).
- Ajv 8.20.0: az alap osztály draft-07, alapból strict és a sémát a meta-sémára is ellenőrzi; a biztonsági
  oldal szerint a sémát az alkalmazás kódjával azonos megbízhatóságúnak kezeli, és `allErrors` éles
  használatra nem ajánlott (K-7, K-8).

## 4. Fogalmak

- **Séma**: a lépés `structuredOutput.schema` mezőjében tárolt JSON Schema dokumentum.
- **Illeszkedés**: a `structured_output` érték a sémára a draft-07 szabályai szerint érvényes.

## 5. Döntések

### 5.1 A motor maga is ellenőriz

Az SDK ellenőrzése mellett a motor a `result` `success` ágán, a meglévő jelenlét ellenőrzés után, a
kimenetet a sémára ellenőrzi. Indok: a gyártó saját példája és az API doksi kliens oldali ellenőrzést ajánl
(K-4, K-5), az iparág így jár el (K-11), az SDK újrapróbálásainak száma és belső validátora nem ismert
(research 7. szekció 2. pont), és a MiniMax úton semmi nem ígér illeszkedést (K-6).

### 5.2 A validátor: Ajv, draft-07

| Jelölt                   | Döntés     | Indok                                                                                              |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------- |
| Ajv 8.20.0, alap osztály | választott | draft-07, ugyanaz, amit az SDK használ (K-3, K-7); strict mód, meta-séma ellenőrzés alapból        |
| `@cfworker/json-schema`  | elvetve    | a kódgenerálás hiánya a szerveren nem előny (Node alatt nincs CSP), a README szerint lassabb (K-9) |
| Zod `z.fromJSONSchema()` | elvetve    | kísérleti, nem része a stabil API-nak (K-10)                                                       |

A verzió a PLAN-016 F0 lépésében élő registry lekérdezésből, két forrásból, a
`docs/research/2026-08-26-toolchain.md` fájlba vezetve pinelődik (`.claude/CLAUDE.md` 4. szekció 4. pont).
Opciók: `allErrors: false` (K-8), `$data` nincs bekapcsolva (alapból kikapcsolt, K-8), `logger` a szerver
naplózója (5.3), minden más az Ajv alapértékén marad (nincs dokumentált okunk eltérni).

**A `format` kulcsszó ellenőrzött (user döntés 2026-11-04, "Ellenőrizzük").** Az Ajv alap osztálya formátumot
nem ismer, és strict módban minden `format` kulcsszót tartalmazó sémát elutasít (`unknown format "email" ignored
in schema`, a telepített `ajv/lib/vocabularies/format/format.ts` `unknownFormat` ága). A fordító ezért az
`ajv-formats` csomag alapértelmezett hívásával (`addFormats(ajv)`) veszi fel a teljes (`full`) módú formátum
listát (`date`, `time`, `date-time`, `duration`, `uri`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`, `regex` és
társaik, a telepített `ajv-formats/src/formats.ts` `fullFormats` táblája), tehát az ilyen kulcsszó a kimeneten
ténylegesen ellenőrzött. A listában nem szereplő `format` név változatlanul fordítási hiba (strict mód), tehát
mentéskor és indításkor elutasít. A verzió a toolchain research fájlban, két forrással.

### 5.3 A kód helye

Az ellenőrző függvény az `agent` csomag `sdk-message-shape` témájába kerül, a `hasStructuredOutput` mellé,
mert a motor ma is onnan importálja a result alakjának kérdéseit (`run-agent-step.ts:2`). Az `agent` csomag
`package.json` függősége bővül az Ajv-vel és az `ajv-formats`-szal; a réteg térkép nem változik, mert külső
csomag.

**A fordító naplózója, és ezért egy motor port (átvezetve 2026-11-04).** Az Ajv a strict mód figyelmeztetéseit
(alapból a `strictTypes` és a `strictTuples` `"log"` módja) a `logger` opción át írja, alapból a konzolra
(`ajv/lib/core.ts` `getLogger`, `ajv/lib/compile/util.ts` `checkStrictMode`). A fordító ezért a naplózót
paraméterként kapja (`compileStructuredOutputSchema(schema, logger)`), és az Ajv három metódusát az azonos nevű
pino szintre képezi (`log` az `info`-ra, SPEC-006 7.2). A motor naplózót nem ismer, ezért a fordítást a
`structuredOutputSchemaCompiler` porton kapja (a SPEC-004 3.2 portlistája ezzel bővül); a szerver ugyanazt a
fordítót (`createStructuredOutputSchemaCompiler(logger)`) adja a motornak és a gráf mentésének ellenőrzéséhez.

### 5.4 A séma saját érvényessége

- **A futás indításakor** a motor minden strukturált kimenetet váró lépés sémáját lefordítja (az Ajv a
  meta-sémára is ellenőriz, K-7), és a lefordított ellenőrzőt a futás végrehajtási állapota csomópontonként
  megőrzi; a lépés ezt kapja meg (`AgentStepRequest.structuredOutputValidator`), és a kimenetét ezzel
  ellenőrzi, újrafordítás nélkül (átvezetve 2026-11-04: a lépésen belüli újrafordítás hibaága a termékúton
  sosem futott, mert minden futás, az újraindítás és az al-workflow is, az indítás ellenőrzésén megy át). Érvénytelen séma esetén a futás nem indul, új osztály:
  `invalid_structured_output_schema`, a `ProtocolErrorClass` szótárba és a kliens magyar mondatai közé is
  felvéve, a meglévő sodródás védelemmel. Ez megelőzi, hogy az SDK a lépés elején álljon le (K-3), miközben
  a futás többi lépése már lefutott.
- Draft-07-nél újabb `$schema` deklaráció érvénytelen, ugyanúgy, mint az SDK-ban (K-3). Az Ajv alap osztálya csak
  a draft-07 meta-séma azonosítóját ismeri, tehát a régebbi (például draft-04) és a `https` alakú azonosító is
  érvénytelen (mérve a végrehajtáskor, `compile-structured-output-schema.spec.ts`).
- A mentéskor is ellenőriz (O-2 user döntés), lásd 5.7.

### 5.5 Eltérés esetén

- A lépés `failed`, új osztállyal: `structured_output_schema_mismatch`. Nem a meglévő
  `missing_structured_output`: a két eset más (nincs kimenet, illetve rossz alakú kimenet), és a
  `handledErrorKinds` szűrő (SPEC-004 8.2) csak külön osztállyal tudja őket megkülönböztetni.
- Az üzenet az Ajv első hibájának útvonalát és kulcsszavát nevezi meg (`allErrors: false`, tehát egy hiba),
  a hibaosztállyal zárójelben (F-24 konvenció).
- A motor nem kérdez újra: az SDK már újrapróbált (K-2), az iparági minta sem próbál újra (K-11), és a
  felhasználó `error_handler` csomóponttal kérhet újabb kísérletet.
- A nem illeszkedő kimenet a lépésen nem tárolódik kimenetként (a `failed` ág nem ír kimenetet); a nyers
  `result` üzenet a meglévő `appendSdkEvent` úton a transcriptben megmarad, tehát a felhasználó látja.

### 5.6 A `join` `ai_synthesis` mód

Az alobjektuma teljes `AgentStepConfig` (SPEC-003 4.3), ugyanazon a `runAgentStep` úton fut, tehát az 5.1
... 5.5 rá is érvényes, külön kód nélkül.

### 5.7 Mentéskori ellenőrzés (O-2 user döntés)

- A mentés a sémát ugyanazzal a fordítóval ellenőrzi, mint a futás indítása (5.4): érvénytelen vagy draft-07-nél
  újabb séma a mentést elutasítja, a hiba a `structuredOutput.schema` mező alatt jelenik meg
  (`.claude/CLAUDE.md` 11. szekció), az `agent_step` és a `join` `ai_synthesis` alobjektumán is.
- A futás indításakori ellenőrzés megmarad: az API más úton is ír gráfot, és a mentési szabály nem a `db`
  invariánsa.
- Az ellenőrzés helye a szerver `PUT .../graph` kezelője, nem a `protocol` mentési sémája. A kezelő ugyanazt az
  `agent` csomagbeli fordító függvényt hívja (5.3), mint a futás indítása, és érvénytelen sémára `invalid_request`
  hibát ad a mező útvonalával (`nodes.<index>.config.structuredOutput.schema`, illetve a `join` `ai_synthesis`
  alobjektumán a megfelelő út). Indok: (1) egyetlen validátor és egyetlen fordító függvény dönt mentéskor és
  indításkor, tehát a két ellenőrzés nem tud elsodródni, és nem kell hozzá sodródás védelem; (2) a `protocol` ma
  csak a `core` és a `typeguards` csomagtól függ (`packages/protocol/package.json`), az Ajv a webes csomagba nem
  kerül; (3) az `apps/server` már függ az `agent` csomagtól (`apps/server/package.json`). Az ára: a hiba a mentés
  válasza után jelenik meg, nem gépelés közben.
- A kliens ma a szerver mentési hibájának mezőútját nem jeleníti meg mezőn ("a mentés mezőútja nem kap mondatot",
  `.claude/CLAUDE.md` 11. szekció). Ehhez a mezőhöz a kliens a szerver válasz mezőútját a mező alatti hibára
  képezi le; ez a szabály szűkített kiegészítése, egyetlen mezőútra, és a szabálykönyvbe átvezetendő.

### 5.8 Séma korlát (O-3 user döntés)

Nincs korlát a séma méretére, mélységére és mintáira. Az Ajv biztonsági oldala szerint a séma az alkalmazás
kódjával azonos megbízhatóságú (K-8), és itt a sémát a workflow készítő írja, ugyanúgy, mint a CEL kifejezést
(SPEC-010 O-2 precedens). Kimondott kockázat: egy `pattern` kulcsszó a Node regex motorján exponenciális
idejű lehet (K-8), és az ellenőrzés a szerver eseményhurkán fut.

## 6. Tesztelés

- `agent`: illeszkedő és nem illeszkedő kimenet, érvénytelen séma, draft-07-nél újabb `$schema`, típusszűkítés.
- `engine`: a lépés `succeeded` illeszkedésnél, `failed` `structured_output_schema_mismatch` osztállyal
  eltérésnél, a futás indítás elutasítása `invalid_structured_output_schema` osztállyal; hamis agenttel.
- `apps/server`: az `error-class-drift-protection` téma a két új osztállyal; a mentési út érvénytelen sémára
  mezőútvonalas hibát ad.
- `apps/web`: a mentéskori hiba a `structuredOutput.schema` mező alatt; e2e `page.route()` mockkal.
- Valódi API hívás nem kell.

## 7. Nyitott kérdések

### 7.1 Termékdöntések (user)

| #   | Kérdés                                                  | Döntés                                                                                                                           |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | Rossz alakú kimenetnél mi történjen                     | **lezárva** (user döntés 2026-11-04): "Hibával megáll", a hibakezelő csomóponttal újrapróbálható (5.5)                           |
| O-2 | Mikor szóljon a program a hibás sémáról                 | **lezárva** (user döntés 2026-11-04): "Mentéskor és indításkor" (5.4, 5.7); a mentési ellenőrzés helye technikai, a T-016-6 méri |
| O-3 | Legyen-e korlát a séma méretére, mélységére és mintáira | **lezárva** (user döntés 2026-11-04): "Nincs" (5.8)                                                                              |

### 7.2 Technikai, nyitva

| #   | Kérdés                                                                      | Mi a viselkedés addig                   | Mi zárná le                                                   |
| --- | --------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| T-1 | Az SDK hány újrapróbálást végez, és mely kulcsszavakat ellenőrzi (K-2, K-3) | a motor ellenőrzése ettől független     | az SDK forrás olvasása vagy a doksi pontosítása; nem blokkoló |
| T-2 | A Flash a séma kulcsszavait betartja-e (K-6)                                | a motor ellenőrzése elkapja az eltérést | mérés a `tools/wire-probe` eszközzel; nem blokkoló            |

## 8. Elfogadási kritériumok

1. Strukturált kimenetet váró lépés csak illeszkedő kimenettel `succeeded`; eltérésnél `failed`
   `structured_output_schema_mismatch` osztállyal, az üzenetben az útvonal és a kulcsszó.
2. Hiányzó kimenet továbbra is `missing_structured_output`.
3. Érvénytelen vagy draft-07-nél újabb séma a futás indítását `invalid_structured_output_schema` osztállyal
   elutasítja, adat írás nélkül; a mentést is elutasítja, a hiba a `structuredOutput.schema` mező alatt.
4. A `join` `ai_synthesis` mód ugyanígy jár el, teszttel igazolva.
5. A két új osztály a motor uniójában, a `ProtocolErrorClass` szótárban (ahol REST hiba) és a kliens magyar
   mondatai között áll, a sodródás védelem mindkét irányban zöld.
6. Az Ajv verziója pinelve, a toolchain research fájlban két forrással.
7. A SPEC-004 21. kritériuma, a `packages/engine/CLAUDE.md` "megnevezett hiány" bekezdése és a hiányleltár
   H-17 sora átvezetve.
8. Kilenc kapu zöld, unit lefedettség 100 százalék.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-016-strukturalt-kimenet-sema-ellenorzes.md`](../plan/PLAN-016-strukturalt-kimenet-sema-ellenorzes.md)
- [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)
