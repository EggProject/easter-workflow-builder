# D3: kötelező szöveg mezők és a Start a létrehozáskor

## T-009-48

**Dátum:** 2026-10-14
**Ág:** `feat/spec-008-d3-kotelezo-mezok`, az `origin/main` `8413882` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `zod@4.4.3` (telepítve), Vitest `4.1.11`, Playwright
chromium a sandbox `LD_LIBRARY_PATH` kerülőjével (`.claude/CLAUDE.md` 12. szekció).
**Hatókör:** SPEC-008 5.4, O-21 (a kötelező szöveg mezők mentéskori elutasítása). Az O-33 (a `join`
negyedik, `mode: null` ága) ebben a lépésben NEM valósult meg, lásd a 4. pontot.

### 1. A mentési séma és a Zod 4 viselkedése, amire épül

A `protocol` mentési sémája (`NodeConfigSaveSchema`) a `NodeConfigSchema.superRefine(...)` alak. Két
tény, a telepített forrásból és saját futtatott tesztből:

- **A `superRefine` nem változtatja a kimeneti típust.** A telepített
  `zod@4.4.3/v4/classic/schemas.js` szerint `superRefine(refinement, params) { return
this.check(superRefine(refinement, params)); }`, tehát ugyanazt a séma osztályt adja vissza egy
  plusz ellenőrzéssel, nem `.transform()`-ot és nem `.default()`-ot. A
  `node-config-save-schema.spec.ts` `expectTypeOf<z.infer<typeof NodeConfigSaveSchema>>()
.toEqualTypeOf<NodeConfig>()` sora ezt a `typecheck` kapun rögzíti.
- **A finomítás alak hibánál nem fut.** A telepített `zod@4.4.3/v4/core/schemas.js` `runChecks`
  függvénye a `when` opció nélküli ellenőrzést kihagyja, ha a bemenet már hibás
  (`util.aborted(payload)`); a `node-config-save-schema.spec.ts` "alak hibánál a kötelező mező
  szabály nem fut" tesztje ezt méri: egy `maxIterations` nélküli `loop` konfig üres
  `continueExpression` mezővel kizárólag a `maxIterations` útvonalú hibát adja.

### 2. A sodródás védelem szándékosan elrontott próbája (99. kritérium, 3. elfogadási pont)

A `db` táblájából ideiglenesen kivett mező (nem commitolt próba, a fájl utána visszaállítva):

```
sed -i "s/  fan_out: \['itemsExpression', 'branchLabelTemplate'\],/  fan_out: ['itemsExpression'],/" \
  packages/db/src/workflow-graph/node-config/required-text-field-paths.ts
flock /tmp/kapu-gep.lock bun run typecheck
```

Eredmény (a wrapper kimenete, kilépési kód `2`):

```
typecheck | 11s
24/25 sikeres, 1 hibas, 20 cache-bol
src/node-config-drift-protection/node-config-drift-protection.spec.ts:150:7 TS2344 Type '{ readonly start: readonly ["inputFields.*.name", "inputFields.*.label", "inputFields.*.valueKind"]; readonly agent_step: readonly ["promptTemplate"]; readonly branch: readonly ["expression", "branches.*.key", "branches.*.label"]; ... 6 more ...; readonly script: readonly [...]; }' does not satisfy the constraint '{ join: { merge: { [x: number]: undefined; [iterator]?: () => ArrayIterator<never>; [unscopables]?: { [x: number]: boolean | undefined; toString: boolean | undefined; ... 30 more ...; with?: boolean; }; ... 29 more ...; toLocaleString?: { ...; }; }; script: { ...; }; ai_synthesis: { ...; }; }; ... 8 more ...; sub_wo...'.
```

A visszaállítás után ugyanez a parancs `25/25 sikeres` eredménnyel zárt.

### 3. Az e2e lefedettség előtte és utána

**Előtte:** a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 47. szekciójának mérése (a `main`
`95f62db` állapota). A `95f62db` és a kiinduló `8413882` között az `apps/web/src` termékkódja nem
változott (`git diff --stat 95f62db 8413882 -- apps/web/src` kizárólag `.spec.ts` fájlt mutat), tehát
az összes darabszám azonos, a fedett legfeljebb nőhetett.

**Utána:** saját mérés a lépés végső kódján, a 29. szekció tiszta eljárásával: `rm -rf
apps/web/e2e/.nyc_output apps/web/coverage-e2e`, az `apps/web` alatt `bun x playwright test
--shard=1/2` és `--shard=2/2` két egymás utáni hívásban (a sandbox egy hívásban legfeljebb kb. 178
másodpercig fut, és a hívás végén minden indított folyamat leáll, ezért háttérben futtatni nem
lehetett; a lefedettségi fixtúra tesztenként egyedi fájlba ír, tehát a két szelet adata összeadódik),
**477 teszt, mind zöld** (239 + 238), majd `bun run coverage:e2e:report` (exit 0, a meglévő
küszöbbel).

| Metrika    | Előtte fedett / összes (fedetlen) | Utána fedett / összes (fedetlen) |
| ---------- | --------------------------------- | -------------------------------- |
| statements | 1682 / 1697 (15)                  | 1686 / 1701 (15)                 |
| branches   | 784 / 795 (11)                    | 784 / 795 (11)                   |
| functions  | 562 / 565 (3)                     | 562 / 565 (3)                    |
| lines      | 1622 / 1637 (15)                  | 1626 / 1641 (15)                 |

**A fedetlen darabszám egyik metrikán sem nőtt**, és a fedetlen helyek ugyanazon a hat fájlon és
sorszámon állnak, mint a 47. szekcióban (`mount-app.tsx` 16, 21-22; `read-frontend-config.ts` 41,
62, 67, 72, 77; `is-valid-connection.ts` 36; `browser-history-location-port.ts` 21;
`perform-route-request.ts` 89; `use-stream-connection.ts` 202). A négy új, fedett statement és sor a
`run-graph/project-snapshot-graph.ts` csomópontonkénti vetítése. Új, e2e-vel elvileg el nem érhető
sor nem keletkezett.

### 4. Az O-33 negyedik `join` ága: a motor fordítása megbukik (mérve, ezért a lépés itt megállt)

A SPEC-008 5.4 "A join módja: üresen indul" bekezdése a `db` `JoinNodeConfig` uniójába egy negyedik,
`mode: null` tagot vesz fel, és az 1. szekció kimondja, hogy "Az `engine` érintetlen marad". A
`packages/engine` viszont a `db` `NodeConfig` unióját közvetlenül használja
(`run-validation/executable-node-config.ts`: `Exclude<NodeConfig, ScriptNodeConfig |
JoinScriptNodeConfig>`). Ideiglenes próba (nem commitolt): a `db` `node-config.ts` fájlba felvett
`JoinUnselectedNodeConfig` (`type: 'join'`, `mode: null`, `onUnhandledError`) tag után

```
cd packages/engine && bun x tsc --noEmit
src/node-executor/execute-node.ts(37,4): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

A hiba oka a `executeJoinNode` kimerítő `switch (config.mode)` szerkezete, aminek nincs `null` ága.
Futásidőben ugyanez rosszabb: a spec által előírt `isJoinConfig` `case null` ág után egy `mode: null`
`join` átmegy a motor `validateNodeConfigs` lépésén (az a `db` `isNodeConfig` guardját hívja), a
`validateImplementedNodeTypes` is átengedi (`config.mode !== 'script'`), és a végrehajtó diszpécser
`undefined` értéket adna `Promise` helyett. A motor viselkedéséről (melyik hibaosztállyal utasítja el
a futás indításakor) a spec nem dönt, ezért az O-33 része a user döntéséig nyitva marad.
