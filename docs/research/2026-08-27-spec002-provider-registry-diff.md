# SPEC-002 T-002-10: `providerRegistry` normalizált JSON diff

Mérés dátuma: 2026-08-27. A SPEC-002 5.7 szekció és a T-002-10 lépés elfogadási kritériuma
megkívánja, hogy a `packages/providers` -> hét csomagra bomlás (SPEC-002 5. szekció, T-002-6
... T-002-10) ne változtasson egyetlen `Fact` `state`, `value` vagy `evidence` mezőn sem. A
szétbontás előtti állapot a T-002-10 indulásakor már csak a git történetből érhető el (a
`packages/providers/src` a T-002-6 ... T-002-9 lépésekben fokozatosan kiürült), ezért a
bizonyítás módja: a szétbontás előtti `registry.ts` kiértékelése a git történetből kivágott,
önmagában lefuttatható forrásfán, a szétbontás utáni `provider-registry.ts` kiértékelése a
jelenlegi munkafán, mindkettő azonos kanonikus JSON alakra hozva, majd bitre egyező
összehasonlítás.

## A "before" állapot forrása

A `packages/providers/src` teljes fája a `b91f150` commitból (a T-002-5 lépés, "névtér prefix,
spec kiterjesztés, téma szerinti mappák" commitja, közvetlenül a providers szétbontás F2
fázisának kezdete előtt):

```
git archive b91f150 packages/providers/src | tar -x -C <scratch>/old
```

Ez a fa önmagában lefuttatható: minden importja relatív útvonal a fán belülre mutat (`./evidence/`,
`./capability/`, `./minimax/`, `./claude-subscription/`, `./references/`), workspace csomagra
nem hivatkozik.

## A kanonikus szerializálás

A sima `JSON.stringify` object kulcs sorrendje a JS motorban **beszúrási sorrend** szerinti
(ECMA-262 `OrdinaryOwnPropertyKeys`, string kulcsokra), ezért két, forrásban eltérő sorrendben
felépített, de tartalmilag azonos objektum más-más `JSON.stringify` kimenetet adhatna. Mivel a
T-002-6 ... T-002-9 lépések a mezők importsorrendjét és a leíró objektum literálok mezőinek
sorrendjét nem feltétlenül tartják meg (a fájlok új mappákba kerültek, az importok
átrendeződtek), a nyers `JSON.stringify` összevetés hamis pozitív eltérést mutathatna.

Ezért egy kanonikus szerializáló függvény (`canonicalJson`) mélységi rekurzióval minden objektum
kulcsot ábécé sorrendbe rendez, mielőtt szerializálna. A **tömbök sorrendjét változatlanul
hagyja**: a tömbök (`evidence`, `buckets`, `models`, `blockedBy`, `usageFields`, `models` stb.)
jelentéshordozó, sorrendfüggő listák a leíróban, ezek sorrendjének felcserélése tartalmi
változás lenne, nem szerializálási zaj.

```ts
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    const sortedKeys = Object.keys(record).toSorted((left, right) => left.localeCompare(right));
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(record[key]);
    }
    return result;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}
```

## A kiértékelés

Két külön Bun folyamat, mindkettő a saját forrásfájára mutató `import` utasítással:

```ts
// eval-old.ts, a scratch fán belül
import { providerRegistry } from './old/packages/providers/src/registry.ts';
import { canonicalJson } from './canonical-json.ts';
console.log(canonicalJson(providerRegistry));
```

```ts
// eval-new.ts, a jelenlegi repo gyökeréről futtatva
import { providerRegistry } from '.../packages/provider-registry/src/provider-registry/provider-registry.ts';
import { canonicalJson } from './canonical-json.ts';
console.log(canonicalJson(providerRegistry));
```

A "new" oldal a repo tényleges `bun install`-lal telepített workspace szimlinkjein keresztül
oldja fel a `@easter-workflow-builder/provider-minimax`, `@easter-workflow-builder/provider-claude-subscription`,
`@easter-workflow-builder/provider-capability`, `@easter-workflow-builder/evidence` és
`@easter-workflow-builder/evidence-sources` importokat, tehát a T-002-6 ... T-002-9 lépések
teljes, éles importláncán megy át, nem egy leegyszerűsített másolaton.

## Eredmény

```
$ bun run eval-old.ts > old-registry.json
$ bun run eval-new.ts > new-registry.json
$ diff old-registry.json new-registry.json
$ echo $?
0
$ md5sum old-registry.json new-registry.json
4e71582a0f3b75c789e2b15489938ab5  old-registry.json
4e71582a0f3b75c789e2b15489938ab5  new-registry.json
```

A `diff` kimenete üres, a két kanonikus JSON fájl MD5 ellenőrzőösszege megegyezik (mindkettő
1624 sor). A `providerRegistry` fa tehát a szétbontás előtt és után **bitre azonos**: egyetlen
`Fact` `state`, `value` vagy `evidence` mező sem mozdult el vagy veszett el a `packages/providers`
hét csomagra bontása során (SPEC-002 5. szekció, T-002-6 ... T-002-10 lépés). Ez igazolja a
SPEC-002 30. elfogadási kritériumát.

A mérés egyszeri, a T-002-10 lépés lezárásához készült; a scratch fájlok (`old-registry.json`,
`new-registry.json`, a git archívumból kivágott `old/` fa, a kiértékelő szkriptek) nem kerültek
a repóba, mert a bizonyítás reprodukálható a fenti parancsokból bármikor újra, és a `git archive
b91f150` mindig ugyanazt a forrást adja vissza.
