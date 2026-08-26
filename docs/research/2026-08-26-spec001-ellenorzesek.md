# SPEC-001 ellenőrizendő pontok lezárása (V-1 ... V-17)

|          |                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Dátum    | 2026-08-26                                                                                            |
| Tárgy    | A [`../spec/SPEC-001-monorepo-toolchain.md`](../spec/SPEC-001-monorepo-toolchain.md) 15. szekciója    |
| Módszer  | hivatalos dokumentáció, telepített forrás olvasása, vagy saját, ebben a repóban most futtatott mérés  |
| Kimenet  | pontonként: kérdés, válasz, bizonyíték, következmény                                                  |
| Futtatás | Node 26.7.0, Bun 1.4.0, Turborepo 2.10.12, TypeScript 6.0.3, Vite 8.2.2, ESLint 10.9.1, Vitest 4.1.11 |

Ami nincs dokumentálva vagy nem mérhető, az itt **nyitottként** szerepel, számmal vagy állítással
nem pótoljuk. A projekt szabálya szerint konfigurációs érték csak akkor kerül be, ha forrásban vagy
dokumentációban ellenőrizve van, mit csinál.

---

## Összesítés

| Állapot                                                                    | Pontok                                                | Darab  |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| Lezárva méréssel                                                           | V-1, V-2, V-3, V-7, V-8, V-10, V-11, V-18, V-19, V-20 | 10     |
| Lezárva dokumentált forrással                                              | V-5, V-6, V-9, V-12, V-13, V-15                       | 6      |
| Lezárva, tárgytalan                                                        | V-4                                                   | 1      |
| Lezárva projekt döntéssel, mérésre támaszkodva, dokumentált szabály nélkül | V-16, V-17                                            | 2      |
| **Nyitva marad**                                                           | V-14                                                  | **1**  |
| Összesen                                                                   |                                                       | **20** |

V-18 és V-19 az elfogadási kritériumok tételes auditja során merült fel, utólag, a fenti
pontok eredeti lezárása után - lásd a saját szakaszaikat lent. V-20 még későbbi: egy éles
GitHub Actions futás bukásából, nem auditból.

A V-19 **kétszer** lett lezárva: először tévesen, "nem javítható környezeti korlát" indoklással,
másodszor méréssel, a tényleges javítással. A saját szakasza mindkét kört tartalmazza, mert a
hibás következtetés menete önmagában is tanulság: a `sudo` hiánya nem jelenti azt, hogy egy deb
csomag tartalma ne lenne telepíthető.

---

## V-1: forrás `.ts` fogyasztás szimlinkelt workspace csomagra

**Kérdés.** A könyvtárcsomagok fogyaszthatók-e forrás `.ts` alakban, azaz a Node 26 type stripping
működik-e olyan csomagra, ami a `node_modules` alá szimlinkelve érhető el.

**Válasz.** Igen. A **(a) forrás fogyasztás** út érvényes, a `(b)` fordított kimenet nem kell.

**Bizonyíték, saját mérés.** Két csomagos minimálpélda ebben a repóban:

```
packages/core/package.json  ->  "exports": "./src/index.ts"
packages/core/src/index.ts  ->  export function coreProbe(): CoreProbe { ... }
apps/server/src/index.ts    ->  import { coreProbe } from 'core';

$ readlink -f apps/server/node_modules/core
/.../easter-workflow-builder/packages/core

$ node apps/server/src/index.ts
V-1 eredmeny: core-ok          # kilépési kód 0
```

Node verzió: `v26.7.0`.

**Bizonyíték, dokumentáció.** A Node dokumentáció "Type stripping in dependencies" szekciója szó
szerint: _"To discourage package authors from publishing packages written in TypeScript, Node.js
refuses to handle TypeScript files inside folders under a `node_modules` path."_
([nodejs.org/api/typescript.html#type-stripping-in-dependencies](https://nodejs.org/api/typescript.html#type-stripping-in-dependencies))

A mérés ezzel nem mond ellent: a szimlink **feloldott** útvonala
(`packages/core`) nincs `node_modules` alatt, és a Node ezt az útvonalat nézi. Ez a viselkedés a
hivatalos Node dokumentációban **nincs explicit leírva**, csak a fenti tiltás; a szimlink feloldás
mechanizmusát community hibajegy demonstrálja
([pnpm/pnpm#10602](https://github.com/pnpm/pnpm/issues/10602),
[nodejs/node#57215](https://github.com/nodejs/node/issues/57215), utóbbi "not planned" státusszal
lezárva). Ezért a döntés alapja a **saját mérés**, nem a dokumentáció.

**Kockázat, kimondva.** Mivel a mechanizmus nem dokumentált, egy Node minor frissítés elvben
megváltoztathatja. A visszaesési út a SPEC-001 6. szekció (b) ága, plusz a hivatalos `amaro/strip`
loader ([nodejs/amaro README, "Monorepo usage"](https://github.com/nodejs/amaro)).

**Következmény.**

- Minden könyvtárcsomag `package.json` `exports` mezője `./src/index.ts` értéket kap. Bevezetve.
- Nincs `build` script a könyvtárcsomagokban, a `build` task csak az `apps/web` csomagban létezik.
- A `turbo.json` `lint` és `test` taskja `^typecheck`-től függ, nem `^build`-tól. Változatlan.
- Az `isolatedDeclarations` nem kerül be a `tooling/tsconfig` alá, mert nincs deklaráció emittálás.

---

## V-2: elfogadja-e a Turborepo a `devEngines.packageManager` deklarációt önmagában

**Kérdés.** Elég-e a `devEngines.packageManager` mező a gyökér `package.json`-ban, vagy kell mellé a
régi, gyökérszintű `packageManager` mező is.

**Válasz.** Elég önmagában. A `packageManager` mező **eltávolítva**, csak a `devEngines` marad.

**Bizonyíték, saját mérés.** Három állapot ugyanazon a repón, Turborepo 2.10.12:

| Gyökér `package.json` állapota                 | `turbo run typecheck --dry=json` | Kimenet                                                                                |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `devEngines.packageManager` + `packageManager` | kilépési kód 0                   | 14 task                                                                                |
| csak `devEngines.packageManager`               | kilépési kód **0**               | 14 task                                                                                |
| egyik sem                                      | kilépési kód **1**               | `Missing 'devEngines.packageManager' or legacy 'packageManager' field in package.json` |

A hibaüzenet maga is a `devEngines` alakot nevezi meg elsőként, a `packageManager` mezőt pedig
`legacy` jelzővel.

**Bizonyíték, dokumentáció.** A Turborepo `run` referencia szó szerint: _"We recommend
`devEngines.packageManager`; the legacy top-level `packageManager` field is also supported."_
([turborepo.dev/docs/reference/run](https://turborepo.dev/docs/reference/run)). A "structuring a
repository" oldal minden csomagkezelőhöz kizárólag a `devEngines.packageManager` alakot mutatja,
`packageManager` mező nélkül
([turborepo.dev/docs/crafting-your-repository/structuring-a-repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).

A `devEngines` mező az npm CLI 10.9.0 óta létezik és támogatott, a séma a `name`, `version`, `onFail`
kulcsokat ismeri, az `onFail` értékkészlete `warn`, `error`, `ignore`, alapértelmezés `error`
([docs.npmjs.com package-json #devengines](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#devengines)).
A Bun jelenleg **nem** olvassa egyik mezőt sem, a `devEngines` támogatás nyitott kérés
([oven-sh/bun#26512](https://github.com/oven-sh/bun/issues/26512)).

**Miért nem maradt meg mindkét mező.** A Bun egyiket sem olvassa, tehát a mező kizárólag a
Turborepo felé hat, ott pedig a `devEngines` a dokumentáltan ajánlott alak. Két mező azt jelentené,
hogy a Bun verziószám két helyen áll a gyökér `package.json`-ban, és egy verzióemelésnél
csendben szétcsúszhat. A projekt szabálya egy verzió, egy forrás.

**Mellékhatás, mérve és kezelve.** A `devEngines.packageManager` jelenléte mellett az npm és az
`npx` **megtagadja a futást** ebben a repóban:

```
npm error EBADDEVENGINES   current: { name: 'npm', version: '11.19.0' },
npm error EBADDEVENGINES   required: { name: 'bun', version: '1.4.0' }
```

Ez a mező szándékolt működése, de érintette a CI-t: a `.github/workflows/ci.yml` e2e jobja
`npx playwright install --with-deps chromium` parancsot futtatott. **Átírva `bunx` alakra.**

**Következmény.** A gyökér `package.json` `devEngines.packageManager` mezőt tartalmaz,
`packageManager` mezőt nem. A CI-ben `npx` nem használható, csak `bunx` vagy `bun run`.

---

## V-3: a `turbo.json` `boundaries` kulcs `tags` szintaxisa és a kilépési kód

**Kérdés.** Mi a `boundaries` és a csomagszintű `tags` pontos szintaxisa, és a `turbo boundaries`
parancs ad-e nem nulla kilépési kódot szabálysértésre.

**Válasz.** A szintaxis igazolt, és a parancs **nem nulla kóddal lép ki** szabálysértésre.

**Bizonyíték, saját mérés.** Három futtatás Turborepo 2.10.12 alatt:

| Eset                                                              | Kilépési kód | Kimenet                                                               |
| ----------------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| tiszta repo                                                       | **0**        | `Checked 133 files in 14 packages, no issues found`                   |
| `protocol` importál `engine`-t, ami nincs a `dependencies` között | **1**        | `cannot import package 'engine' because it is not a dependency`       |
| tag alapú `dependents.deny` szabály megsértése                    | **1**        | `denylist defined here`, a szabály helyére mutató forráshivatkozással |

A tag alapú próbában a csomagszintű alak `packages/core/turbo.json` -> `{"tags":["probe-private"]}`,
a gyökérszintű alak pedig:

```json
{ "boundaries": { "tags": { "probe-private": { "dependents": { "deny": ["probe-public"] } } } } }
```

Mindkettő működött, tehát a szintaxis igazolt.

**Bizonyíték, dokumentáció.** A szintaxis és a két szabálysértés-típus a hivatalos referencián
([turborepo.dev/docs/reference/boundaries](https://turborepo.dev/docs/reference/boundaries)). A
funkció ott **Experimental** jelöléssel szerepel
([RFC #9435](https://github.com/vercel/turborepo/discussions/9435)). A kilépési kódra a
dokumentáció nem tartalmaz explicit állítást, ezért az a saját mérésből származik.

**Következmény.** A `boundaries` **nem kerül bevezetésre**, marad opcionális, ahogy a SPEC-001 3.
szekció írja. Indok: a függőségi irányt már két aktív mechanizmus fedi (`import-x/no-cycle` és a
`package.json` `dependencies` + `import-x/no-extraneous-dependencies`), a funkció pedig kísérleti
jelölésű. A V-3 lezárása annyit rögzít, hogy ha a projekt később mégis bevezeti, a szintaxis és a
CI-képesség igazolt, nem kell újra felderíteni.

---

## V-4: `.tsbuildinfo` és a Turborepo cache viszonya

**Kérdés.** Tárgytalan.

**Válasz.** A D-1 döntés szerint nincs TypeScript projekt referencia, nincs `composite: true`, tehát
`.tsbuildinfo` sehol nem keletkezik.

**Bizonyíték.** A repo egyetlen `tsconfig.json`-ja sem tartalmaz `composite` vagy `references`
kulcsot, és a `.gitignore` `*.tsbuildinfo` mintája sosem fog fájlt.

**Következmény.** Nincs teendő. A SPEC-001 6. szekció D-1 döntése ezt már rögzíti.

---

## V-5: a `jsx` compilerOption értéke React 19 és TypeScript 6.0 mellett

**Kérdés.** Melyik `jsx` értéket kell beállítani a `tooling/tsconfig/react.json` fájlban.

**Válasz.** `"jsx": "react-jsx"`.

**Bizonyíték.** A TypeScript tsconfig referencia szerint a `react-jsx` érték jelentése _"Emit `.js`
files with the JSX changed to `_jsx` calls optimized for production"_, és a doksi ezt köti a React
új, automatikus JSX runtime-jához
([typescriptlang.org/tsconfig/jsx.html](https://www.typescriptlang.org/tsconfig/jsx.html)). A Vite
hivatalos `react-ts` sablonja ugyanezt az értéket használja
([vitejs/vite, create-vite/template-react-ts/tsconfig.app.json](https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/tsconfig.app.json)).
A TypeScript 6.0 kiadási jegyzete a `jsx` opció értékkészletét vagy alapértelmezését **nem
változtatta meg**
([TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)).

**Következmény.** A `tooling/tsconfig/react.json` `"jsx": "react-jsx"` értéket állít. Már bevezetve,
a V-5 ezt megerősíti.

---

## V-6: a `projectService: true` viselkedése több tsconfigos monorepóban

**Kérdés.** Használható-e a `parserOptions.projectService` a statikus `project` tömb helyett, és
kell-e hozzá monorepo specifikus konfiguráció.

**Válasz.** Használható, és monorepóhoz **nem kell külön konfiguráció**. Egy kiegészítés kell: az
`allowDefaultProject` a csomag `include` mintáin kívül élő config fájlokra.

**Bizonyíték.** A typescript-eslint Monorepo Configuration oldala szó szerint: _"The new 'project
service' in v8 requires no additional configuration for monorepos. If you're using
`parserOptions.projectService`, you don't need this guide."_
([typescript-eslint.io/troubleshooting/typed-linting/monorepos](https://typescript-eslint.io/troubleshooting/typed-linting/monorepos))
A parser doksi szerint fájlonként a legközelebbi `tsconfig.json`-t használja, ugyanazokkal a
TypeScript API-kkal, amiket a VS Code is
([typescript-eslint.io/packages/parser](https://typescript-eslint.io/packages/parser)).

Az `allowDefaultProject` dokumentált célja: _"This is intended to produce type information for
config files such as `eslint.config.js` that aren't included in their sibling `tsconfig.json`."_
Két dokumentált korlátja van: a globokban `**` nem engedélyezett, és minden így kezelt fájl
_"incurs a non-trivial performance overhead"_ (ugyanaz a parser doksi).

Teljesítményről a dokumentáció az **ellenkezőjét** állítja a spec kockázati táblázatának: a v8
bejelentő szerint a project service _"generally easier to configure and faster at runtime than our
previous offerings"_
([typescript-eslint.io/blog/announcing-typescript-eslint-v8-beta](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8-beta)).

**Bizonyíték, saját mérés.** A repo teljes lintje a `projectService` beállítással 14 csomagon
lefut, kilépési kód 0 (`bun run lint`, `22/22 sikeres, 0 hibas`).

**Következmény.** Marad a `projectService: true`, `allowDefaultProject: ['*.config.ts',
'*/*/*.config.ts']` kiegészítéssel. A `project` tömbre való visszaesés (SPEC-001 17. szekció
kockázati sora) nem szükséges. Már bevezetve, a V-6 ezt megerősíti.

---

## V-7: jelzi-e az `assertionStyle: 'never'` az `as const` alakot

**Kérdés.** A `@typescript-eslint/consistent-type-assertions` `assertionStyle: 'never'` beállítása
hibát ad-e a const assertion (`as const`) alakra.

**Válasz.** **Nem ad hibát.** Az `as const` szabadon használható.

**Bizonyíték, saját mérés.** Próbafájl a repo tényleges ESLint konfigurációjával:

```ts
export const asConstProbe = { a: 1 } as const; // NINCS hiba
export const asProbe = { b: 2 } as unknown as { b: number }; // 4 hiba
```

Az ESLint kimenete a második sorra `consistent-type-assertions`, `no-unsafe-type-assertion` és
`no-unnecessary-type-assertion` hibát adott, az elsőre **egyetlen jelzést sem**.

**Következmény.** Nem kell `objectLiteralTypeAssertions` finomhangolás, és nem kell fájlszintű
kivétel. Az `as const` marad használható, a típuskényszerítő `as X` tiltott. A SPEC-001 7. szekció
"Kivétel" bekezdésének kérdése ezzel eldőlt.

---

## V-8: jelzi-e a `no-restricted-syntax` szelektor a `private` módosítót

**Kérdés.** A SPEC-001 7. szekcióban rögzített három AST szelektor valóban jelzi-e a TypeScript
`private` módosítót, és nem jelzi-e a `#` alakot.

**Válasz.** Mindhárom szelektor jelez, a `#` alakra nincs jelzés.

**Bizonyíték, saját mérés.** Ugyanaz a próbafájl, a releváns ESLint sorok:

| Próba                                       | Eredmény                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `private fieldProbe = 1;`                   | hiba: `Use native ECMAScript private fields (e.g., #field) instead of the TypeScript 'private' modifier` |
| `private methodProbe(): number`             | hiba: `Use native ECMAScript private methods (e.g., #method) ...`                                        |
| `constructor(private readonly dep: string)` | hiba: `Do not use 'private' in constructor parameter properties ...`                                     |
| `#nativeField = 2;`                         | **nincs jelzés**                                                                                         |
| `#nativeMethod(): number`                   | **nincs jelzés**                                                                                         |

**Következmény.** A `no-restricted-syntax` megoldás elegendő, saját ESLint plugin nem kell. A
SPEC-001 7. szekció konfigurációja változatlanul marad. A konstruktor parameter property-t
egyébként az `erasableSyntaxOnly` TypeScript kapcsoló is fordítási hibává teszi, tehát azt két
réteg fedi.

---

## V-9: a `sonarjs/cognitive-complexity` dokumentált alapértelmezett küszöbe

**Kérdés.** Mi az `eslint-plugin-sonarjs` 4.2.0 `cognitive-complexity` szabályának dokumentált
alapértelmezett küszöbe, és a `recommended` config milyen szinten hozza.

**Válasz.** Az alapértelmezett küszöb **15**, a `recommended` config `error` szinten hozza.

**Bizonyíték, telepített forrás.** A ténylegesen publikált 4.2.0 csomagból:

- `cjs/S3776/rule.js`: `const DEFAULT_THRESHOLD = 15;`
- `cjs/S3776/generated-meta.js`: `defaultOptions: [15]`, `docs: { recommended: true }`
- `cjs/plugin.js`: `recommendedConfig.rules[...] = recommended ? 'error' : 'off';`

**Bizonyíték, dokumentáció.** A szabály doksija szó szerint: _"The maximum authorized complexity can
be provided. Default is 15."_
([SonarSource/eslint-plugin-sonarjs, docs/rules/cognitive-complexity.md](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md))

**Megjegyzés a forrásról.** A `SonarSource/eslint-plugin-sonarjs` repo 2024-10-03 óta archivált,
a 4.2.0 npm csomag `repository` mezője a `SonarSource/SonarJS` monorepóra mutat. A fenti tényeket
ezért a publikált npm tarball tartalmából olvastuk ki, nem az archivált repóból.

**Következmény.** Saját küszöbszámot **nem** állítunk, a plugin dokumentált alapértelmezésén
maradunk. A SPEC-001 7. szekció ezt már így írja elő, a V-9 annyit ad hozzá, hogy az érték immár
ismert és forrásolt: 15.

---

## V-10: a Prettier `printWidth` értéke

**Kérdés.** Melyik `printWidth` érték ad a meglévő kódra minimális formázási diffet.

**Válasz.** **120.** A mért minimum egy 120 és 140 közötti fennsíkon van, ezen belül a 120 a
legkisebb sorhossz.

**Bizonyíték, saját mérés.** A Prettier bevezetése előtti kódra (a `df4a649` commit **előtti**
állapot, `src/providers/**` és `tools/wire-probe/src/**`, összesen 51 TypeScript fájl, 4152 sor)
`singleQuote: true` mellett, `printWidth` értékenként:

| `printWidth` | Változott fájl | Változott sor |
| ------------ | -------------- | ------------- |
| 80           | 47 / 51        | 892           |
| 90           | 34 / 51        | 490           |
| 100          | 28 / 51        | 301           |
| 110          | 21 / 51        | 278           |
| **120**      | **16 / 51**    | **202**       |
| 130          | 16 / 51        | 201           |
| 140          | 16 / 51        | 213           |
| 160          | 19 / 51        | 235           |

A meglévő kód sorhossz eloszlása ugyanezen a fájlkészleten: medián 28, p90 79, p95 88, p99 124.

A 120 és a 130 közötti különbség egyetlen sor, tehát a kettő a mérés felbontásán belül azonos. A
120 azért nyer, mert a fennsík alsó széle: ugyanazt a minimális diffet adja rövidebb megengedett
sorhosszal.

**Bizonyíték, dokumentáció.** A Prettier 3 alapértelmezései: `printWidth: 80`, `singleQuote: false`
([prettier.io/docs/options](https://prettier.io/docs/options)). A két felülírt opció tehát tudatos
eltérés az alapértelmezéstől, nem véletlen.

**Következmény.** A `.prettierrc.json` `{"singleQuote": true, "printWidth": 120}` marad, és az érték
mostantól erre a mérésre hivatkozik, nem tippelésre.

---

## V-11: működik-e a `vite-plugin-istanbul` 9.0.1 a Vite 8 (Rolldown) alatt

**Kérdés.** Instrumentál-e a plugin Vite 8 alatt, és tiszteletben tartja-e a `requireEnv` kapcsolót.

**Válasz.** **Működik.** A build mindkét módban sikeres, és az instrumentálás pontosan akkor
aktiválódik, amikor kell.

**Bizonyíték, saját mérés.** `vite/8.2.2 linux-arm64 node-v26.7.0`, `vite-plugin-istanbul@9.0.1`,
`apps/web` csomag, `forceBuildInstrument: true`, `requireEnv: true`:

| Futtatás                        | Build          | Bundle méret | `__coverage__` a kimenetben |
| ------------------------------- | -------------- | ------------ | --------------------------- |
| `vite build`                    | sikeres, 27 ms | 0.80 kB      | **nincs**                   |
| `VITE_COVERAGE=true vite build` | sikeres, 97 ms | 1.97 kB      | **van**                     |

A méretkülönbség maga az istanbul instrumentálás. A `requireEnv: true` tehát pontosan a dokumentált
módon viselkedik: env változó nélkül nincs instrumentálás.

**Bizonyíték, dokumentáció.** A csomag `peerDependencies` mezője `"vite": ">=7"`, felső korlát
nélkül ([registry.npmjs.org/vite-plugin-istanbul/latest](https://registry.npmjs.org/vite-plugin-istanbul/latest)).
A 9.0.0 változásnapló csak ennyit rögzít: _"feat!: bump vite peer dependency from >=4 to >=7"_
([GitHub release v9.0.0](https://github.com/iFaxity/vite-plugin-istanbul/releases/tag/v9.0.0)).
**Explicit Vite 8 vagy Rolldown kompatibilitási állítás sehol nincs**, és nyitott issue sincs Vite 8
inkompatibilitásról. Ezért volt szükség a saját próbabuildre.

**Kockázat, kimondva.** A projekt README-je szerint _"This project is not under active development"_
és új karbantartót keres. A `requireEnv` opció leírását és a `window.__coverage__` populálását a
README dokumentálja, de a Playwright oldali kigyűjtést és összefésülést **nem**.

**Következmény.** Az e2e coverage váz nem halasztódik el, be van vezetve. A SPEC-001 16. szekció 24.
kritériuma teljesül, méghozzá a működést igazoló ágon.

---

## V-12: az e2e coverage összefésülő eszköz

**Kérdés.** Melyik eszköz fésülje össze a Playwrightból mentett istanbul coverage objektumokat.

**Válasz.** **`nyc`**, a már bevezetett `nyc report --temp-dir e2e/.nyc_output` alakban.

**Bizonyíték.** Három jelölt, npm registry adatokkal:

| Eszköz                      | Verzió | Utolsó kiadás | Megjegyzés                                                      |
| --------------------------- | ------ | ------------- | --------------------------------------------------------------- |
| `nyc`                       | 18.0.0 | 2026-02       | az istanbul hivatalos CLI-ja, aktív                             |
| `istanbul-lib-coverage`     | 3.2.2  | 2023-11       | alacsony szintű könyvtár, nem riportáló eszköz                  |
| `monocart-coverage-reports` | 2.13.0 | 2026-08       | aktív, Playwrightot és Vite 8-at is használ a saját devDeps-ben |

Az `nyc` dokumentálja a `temp-dir` opciót (_"Directory to output raw coverage information to"_,
alapértelmezés `./.nyc_output`) és van dedikált "Combining reports from multiple runs" szekciója,
ami pontosan az `nyc report` parancsot mutatja meglévő nyers JSON-okból történő riportgenerálásra
([nyc README](https://cdn.jsdelivr.net/npm/nyc/README.md)). Az `nyc` nincs deprecated jelöléssel, a
deprecation kérdését felvető jegy tartalmi válasz nélkül lezárva
([istanbuljs/nyc#1514](https://github.com/istanbuljs/nyc/issues/1514)).

**Amit a dokumentáció NEM fed.** A Playwright specifikus lépést, azaz hogy a böngészőből kiolvasott
`window.__coverage__` objektumot hogyan kell a `temp-dir` alá írni, egyik eszköz doksija sem
tárgyalja. Ezt a repo `apps/web/e2e/coverage-fixture.ts` fájlja oldja meg, saját kóddal.

**Következmény.** Marad az `nyc`, ahogy az `apps/web` `coverage:e2e:report` scriptje már használja.
A `monocart-coverage-reports` frissebb és aktívabb, de a váltásra nincs kényszerítő ok, és a
projekt szabálya szerint nem cserélünk működő eszközt indok nélkül. E2E küszöb nincs.

---

## V-13: az `actions/cache` v6.1.0 létezése

**Kérdés.** Létezik-e a research fájlban rögzített `actions/cache` v6.1.0.

**Válasz.** Igen. Már a SPEC-001 írásakor lezárva, itt csak a teljesség kedvéért szerepel.

**Bizonyíték.** Élő GitHub API lekérdezés (`repos/actions/cache/releases/latest`): v6.1.0,
2026-06-26. Ugyanígy megerősítve: `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0,
`oven-sh/setup-bun` v2.2.0, `actions/upload-artifact` v7.0.1.

**Következmény.** A `docs/research/2026-08-26-toolchain.md` action verzió táblázata helyes, a
workflow ezekre hivatkozik.

---

## V-14: nyer-e időt a Bun globális cache `actions/cache` receptje

**Kérdés.** Az `actions/cache` lépés a `~/.bun/install/cache` könyvtárra gyorsítja-e a CI-t.

**Válasz.** **NYITVA MARAD.** Nem tudjuk lezárni.

**Ami igazolt.** A cache könyvtár helye hivatalosan dokumentált: _"Bun stores every package
downloaded from the registry in a global cache at `~/.bun/install/cache`, or the path set by the
`BUN_INSTALL_CACHE_DIR` environment variable."_
([bun.com/docs/pm/global-cache](https://bun.com/docs/pm/global-cache))

Az is igazolt, hogy más út nincs: az `oven-sh/setup-bun` action **kizárólag a letöltött Bun
binárist** cache-eli, a `no-cache` bemenete is csak erre vonatkozik
([setup-bun README](https://github.com/oven-sh/setup-bun)), az `actions/setup-node` `cache`
bemenete pedig szó szerint _"Supported values: npm, yarn, pnpm"_, a `bun` **nincs** köztük
([actions/setup-node action.yml](https://github.com/actions/setup-node/blob/main/action.yml)).

**Ami nyitva marad, és miért.** Nincs hivatalos, sem az oven-sh, sem a GitHub által dokumentált
recept a Bun függőség cache-re `actions/cache` lépéssel. A kérdés maga (nyer-e időt) csak GitHub
Actions runneren mérhető, két futtatás összehasonlításával hideg és meleg cache mellett. **Ez a
futtatókörnyezet nem GitHub Actions runner**, tehát a mérés itt nem elvégezhető, és becsülni tilos.

**Mi kellene a lezárásához.** Egy PR, ami legalább kétszer lefuttatja a workflow-t, és a `Cache Bun
global cache` plusz az `Install dependencies` lépés együttes idejét összeveti hideg és meleg cache
mellett. Ha nem nyer időt, a lépés elhagyandó.

**Következmény.** A `.github/workflows/ci.yml` cache lépése marad, a nem hivatalos recept ténye a
workflow kommentjében jelölve. Nem blokkolja a SPEC-001 elfogadását, mert a hivatalosan dokumentált
`.turbo` cache ettől függetlenül működik.

---

## V-15: a Playwright `retries` CI értéke

**Kérdés.** Van-e dokumentált ajánlott `retries` érték CI-re.

**Válasz.** **Kimondott ajánlás nincs.** Az alapértelmezés `0`, és a hivatalos mintakonfiguráció
`2`-t használ CI-ben.

**Bizonyíték.** A "Test retry" oldal szó szerint: _"By default failing tests are not retried."_
([playwright.dev/docs/test-retries](https://playwright.dev/docs/test-retries)) A hivatalos
"Basic Configuration" példa
([playwright.dev/docs/test-configuration](https://playwright.dev/docs/test-configuration)):

```js
forbidOnly: !!process.env.CI,
retries: process.env.CI ? 2 : 0,   // "Retry on CI only."
workers: process.env.CI ? 1 : undefined,
```

Ez a dokumentáció egyetlen helye, ahol konkrét szám szerepel `retries`-hez, de ez **mintakód, nem
kimondott ajánlás**. A `workers` esetében viszont van explicit ajánlás: _"We recommend setting
workers to '1' in CI environments to prioritize stability and reproducibility."_
([playwright.dev/docs/ci#workers](https://playwright.dev/docs/ci#workers))

**Következmény.** A `workers` CI értéke `1`, kimondott dokumentált ajánlás alapján. A `retries`
értéke a **dokumentált alapértelmezésen, `0`-n marad**. Indok: a `2` értékre nincs kimondott
ajánlás, csak mintakód, saját mérésünk pedig nincs, ami az újrapróbálkozást indokolná. A projekt
szabálya szerint dokumentált szabály nélkül nem veszünk fel számot, még akkor sem, ha az egy
hivatalos példában szerepel. A `playwright.config.ts` már így áll, a kommentje a
`test-retries` oldalra hivatkozik.

Saját mérés a `retries` értékére nem lehetséges: ebben a futtatókörnyezetben a böngésző nem indul
(rootless konténer, a `sudo playwright install-deps` tiltva). Ha egy valós CI futtatás
instabilitást mutat, a `retries` emelése akkor és csak akkor indokolt, a mért flakiness alapján.

**Utólagos kiegészítés (a böngésző azóta indul, lásd V-19).** Az első éles CI E2E bukás
(32994208280) **nem flakiness**, hanem determinisztikus konfigurációs hiba volt, ezért **nem
nyitja újra ezt a pontot**: nem a Playwright teszt bukott, hanem az azt követő lefedettségi
riport, és a hibaok lokálisan száz százalékban reprodukálható (V-20). A `retries` értéke marad
`0`, továbbra sincs mért flakiness, ami az emelést indokolná.

---

## V-16: a wrapper scriptek csonkolási határa

**Kérdés.** Hány hibasornál csonkoljanak a `tooling/scripts` alatti wrapperek.

**Válasz.** Marad **50**, de mostantól mérésre támaszkodva, nem önkényes választásként. Dokumentált
szabály erre az értékre **nincs**, ezt kimondjuk.

**Bizonyíték, saját mérés.** Egyetlen realisztikus, egy okra visszavezethető típushiba a
`packages/providers` alaptípusában (`evidence/fact.ts`, a `state` diszkriminátor átnevezése):

| Mérőszám                              | Érték                       |
| ------------------------------------- | --------------------------- |
| keletkezett `tsc` hibasor             | 90                          |
| érintett különböző fájl               | 22                          |
| érintett csomag                       | 1 (`providers`)             |
| legnagyobb egy fájlra eső hibacsoport | 17                          |
| átlagos hibasor hossz                 | 170 karakter                |
| a teljes hibalista mérete             | 15 358 karakter (kb. 15 kB) |

A gyökérok az **első** hibasorból azonosítható, mert a `tsc` üzenete megnevezi az elrontott típust:
`Type '"known"' is not assignable to type '"unknown" | "KNOWN_RENAMED"'`.

**Az érvelés.** Egy okra visszavezethető kaszkádnál a csonkolás nem rontja a diagnosztizálhatóságot,
mert a gyökérok az első sorban látszik, és a wrapper kiírja a kimaradt hibák számát plusz a teljes
kimenet útját. A határ valódi feladata a **több okú** hibák kimenetének korlátozása. Az 50 a mért
worst case 55 százalékát mutatja, ami 8,5 kB nagyságrendű kimenet; a teljes lista kiírása 15 kB
lenne.

**Amit nem állítunk.** Nincs olyan dokumentált szabály, ami az 50-et vagy bármely más számot
alátámasztaná. Ez projekt döntés, aminek a mérés adja a nagyságrendi keretét, nem a levezetését.

**Következmény.** A `tooling/scripts/_lib.sh` `WRAPPER_ERROR_LIMIT` értéke 50 marad, és a
kommentje erre a mérésre hivatkozik. Ugyanez vonatkozik a `format.sh` `WRAPPER_FILE_LIMIT`
értékére.

---

## V-17: az artefaktum retenciós napszám

**Kérdés.** Milyen `retention-days` értéket állítson a workflow az artefaktum feltöltéseknél.

**Válasz.** **Nem állítunk explicit értéket.** A repository alapértelmezése érvényesül. Konkrét
napszámra dokumentált ajánlás nincs, ezt kimondjuk.

**Bizonyíték.** Az `actions/upload-artifact` README szó szerint: _"Duration after which artifact
will expire in days. 0 means using default retention. Minimum 1 day. Maximum 90 days unless changed
from the repository settings page. Optional. Defaults to repository settings."_
([actions/upload-artifact README](https://github.com/actions/upload-artifact))

A GitHub dokumentáció a repository szintű alapértelmezésről: _"By default, the artifacts and log
files generated by workflows are retained for 90 days before they are automatically deleted."_
Publikus repóban 1 és 90 nap között, privátban 1 és 400 nap között állítható
([docs.github.com, artifact and log retention](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)).

**Amit nem állítunk.** Sem az action README-je, sem a GitHub dokumentáció **nem ad ajánlott konkrét
napszámot**. A projektnek sincs olyan szabálya, amiből ilyen szám levezethető lenne, ezért számot
nem rögzítünk.

**Következmény.** A `.github/workflows/ci.yml` egyetlen `upload-artifact` lépése sem állít
`retention-days` bemenetet, tehát a repository beállítása érvényesül. Ez tudatos döntés, nem
hiányosság, és a workflow kommentje ezt jelöli. Ha a projekt később szeretne rövidebb retenciót, azt
a repository beállítás oldalán kell megtenni, egy helyen, nem a workflow-ban szétszórva.

---

## V-18: a `//#test` gyökér-szkópolt task `dependsOn` értéke

**Kérdés.** A SPEC-001 5. szekció eredeti táblázata a `test` taskra `dependsOn: ["^typecheck"]`
értéket írt elő, ugyanúgy, mint a `lint`-re. A tényleges `turbo.json`-ban a `test` task
`//#test` néven, gyökér-szkópolt taskként létezik (mert a Vitest coverage a 9. szekció szerint
kizárólag a teljes folyamatra vonatkozik), és `dependsOn: []` értékkel. Helyes-e ez az eltérés,
vagy pótolandó hiba.

**Válasz.** Az eltérés **helyes**, a spec eredeti értéke technikailag nem alkalmazható egy
gyökér-szkópolt taskra. A `dependsOn: []` marad, a SPEC-001 szövege lett a valósághoz igazítva.

**Bizonyíték, dokumentáció.** A Turborepo "Registering Root Tasks" szakasza szerint a
gyökérre szkópolt (`//#<task>`) taskok saját, önálló bejegyzések, a hivatalos példa
(`"//#lint:root": {}`) **nem használ `dependsOn`-t**
([configuring-tasks#registering-root-tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#registering-root-tasks)).
A `^` mikroszintaxis dokumentált jelentése: _"the `^` microsyntax tells Turborepo to run the
task in **direct dependencies**"_, azaz a csomag `package.json` `dependencies`/`devDependencies`
mezőjében ténylegesen felsorolt workspace csomagok azonos nevű taskját várja be.

**Bizonyíték, saját mérés.** `turbo run test --dry=json` a `//#test` task `dependsOn:
["^typecheck"]` mellett (ideiglenes próba, nem került commitba):

```json
"taskId": "//#test",
"dependencies": ["eslint-config#typecheck"],
"resolvedTaskDefinition": { "dependsOn": ["^typecheck"], ... }
```

A gyökér `package.json`-nak **nincs** `dependencies` mezője, a `devDependencies` mezőben pedig
kizárólag a `tooling/eslint-config` szerepel workspace hivatkozásként (`"eslint-config":
"workspace:*"`). A `^typecheck` tehát nem az összes termékcsomag (`packages/core`,
`packages/providers`, `apps/server` stb.) típusellenőrzését várná be, hanem kizárólag az
`eslint-config` csomagét - ez a csomag pedig nem is az, amit a Vitestnek ténylegesen be kellene
várnia. A `^typecheck` a root taskon **hamis biztonságérzetet** adna: úgy tűnne, mintha a teszt
a teljes workspace típusellenőrzésétől függene, valójában majdnem semmitől nem függ.

**Miért nincs is szükség rá.** A V-1 döntés szerint a könyvtárcsomagok forrás `.ts` alakban
fogyaszthatók, a `tsc --noEmit` nem termel artefaktumot, amit a Vitest felhasználna - tehát a
Vitestnek nincs mire várnia buildként vagy típus-ellenőrzésként, a `test` és a `typecheck`
egymástól ténylegesen független taskok. A CI `verify` jobja (`turbo run format:check typecheck
lint test`, 12. szekció) mindkettőt lefuttatja egy hívásban, sorrend nélkül is helyes eredménnyel.

**Következmény.** A `turbo.json` `//#test` taskja `dependsOn: []` marad (nem módosult kód). A
SPEC-001 5. szekció szövege és a 16. szekció 5. kritériuma frissült, hogy ezt a tényt és az
indoklást tükrözze - ez a spec egy hibás feltételezésének utólagos javítása, nem a kritérium
megkerülése: a hibás feltételezés (hogy a `test` csomagonként ismétlődő task lesz) még a Vitest
coverage architektúrájának teljes felderítése előtt került a specbe.

---

## V-19: a Playwright smoke teszt tényleges böngésző-futtatása ebben a sandboxban

**Kérdés.** A `turbo run test:e2e` (illetve `bun run test:e2e` az `apps/web` csomagban) valóban
lefuttatja-e végig a Playwright smoke tesztet ebben a végrehajtási környezetben, és ha nem, mi a
pontos hiba.

**Válasz.** **Lefut.** A pont eredetileg "nem fut le, nem javítható" állapotban volt lezárva; ez
az állítás **téves volt**, és itt javítjuk. A hiányzó rendszerkönyvtár telepítéséhez valóban nem
lehet `sudo`-t használni, de a telepítéshez **nem is kell root**: az `apt-get download` és a
`dpkg -x` nem privilegizált parancs, a kicsomagolt könyvtárat pedig a `LD_LIBRARY_PATH` húzza be.
A smoke teszt ezzel valódi Chromiumon, zölden lefut, a repó egyetlen fájljának módosítása nélkül.

**Bizonyíték, saját mérés.** Négy lépésben. Először a hiba reprodukciója (ez a rész az eredeti
lezárásból változatlan):

1. `playwright test` közvetlenül (nem `bun run` scripten keresztül) az `apps/web` könyvtárból:
   `[WebServer] /bin/sh: 1: vite: not found`, kilépési kód 127. Ez **nem** a valódi hiba, hanem a
   shell PATH-ja nem tartalmazza a helyi `node_modules/.bin`-t, mert a `webServer.command` nyers
   shell parancsként fut, nem `bun run`/`npm run` szkript-kontextusban.
2. `bun run test:e2e` (a csomag saját `package.json` scriptje, ami helyesen állítja be a
   PATH-ot): a `vite build && vite preview` sikeresen elindul, a Playwright eléri a portot, majd:

   ```
   Error: browserType.launch:
   ╔══════════════════════════════════════════════════════╗
   ║ Host system is missing dependencies to run browsers. ║
   ║ Please install them with the following command:      ║
   ║     sudo npx playwright install-deps                 ║
   ║ Alternatively, use apt:                               ║
   ║     sudo apt-get install libxdamage1                  ║
   ╚══════════════════════════════════════════════════════╝
   ```

A javasolt javítás (`sudo npx playwright install-deps`) ellenőrizve, miért nem elvégezhető:

```
$ id
uid=1045(vigilant-clever-mendel) gid=1045(vigilant-clever-mendel) groups=1045(vigilant-clever-mendel)
$ sudo -n true
sudo: /etc/sudo.conf is owned by uid 65534, should be 0
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
sudo: If sudo is running in a container, you may need to adjust the container configuration to disable the flag.
$ apt-get install -y libxdamage1
E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)
E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?
```

A sandbox nem-root felhasználóként fut (`uid=1045`), a konténer explicit `no new privileges`
flaggel tiltja a `sudo`-t, és a csomagkezelő zárolt fájlja sem írható nem-root felhasználóként.
Ez a rész igaz. **A hibás következtetés az volt, hogy ebből a telepíthetetlenség következik.**

Másodszor: a hiányzó könyvtárak pontos, teljes listája. Nem a Playwright hibaüzenetéből, hanem
közvetlenül a dinamikus linkerből, a letöltött binárisokra:

```
$ ldd ~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux/headless_shell | grep 'not found'
	libXdamage.so.1 => not found
$ ldd ~/.cache/ms-playwright/chromium-1234/chrome-linux/chrome | grep 'not found'
	libXdamage.so.1 => not found
```

**Összesen egy darab könyvtár hiányzik**, a `libxdamage1` csomagból. A Playwright teljes
`nativeDeps` listája (`ubuntu22.04-arm64`, ami a forrásban az `ubuntu22.04-x64` klónja) 22 csomagot
sorol fel a chromiumhoz, ebből 21 már jelen van a képben.

Harmadszor: telepítés root nélkül. Sem az `apt-get download`, sem a `dpkg -x` nem igényel
privilégiumot, mert egyik sem nyúl a `/var/lib/dpkg` zárolt állományhoz, csak letölt és kicsomagol
egy tetszőleges célmappába:

```
$ apt-get download libxdamage1
Get:1 http://ports.ubuntu.com/ubuntu-ports jammy/main arm64 libxdamage1 arm64 1:1.1.5-2build2 [6950 B]
$ dpkg -x libxdamage1_*.deb ~/pwdeps
$ ldd ~/pwdeps/usr/lib/aarch64-linux-gnu/libXdamage.so.1 | grep -c 'not found'
0                                    # a kicsomagolt libnek nincs tovabbi hianyzo fuggosege
$ export LD_LIBRARY_PATH="$HOME/pwdeps/usr/lib/aarch64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
$ ldd ~/.cache/ms-playwright/chromium-1234/chrome-linux/chrome | grep -c 'not found'
0
```

Negyedszer: a tényleges futtatás. `LD_LIBRARY_PATH` beállítva, a repó **változatlan**:

```
$ bun run test:e2e                    # a gyoker, turbo-n keresztul
web:test:e2e:   ✓  1 [chromium] › e2e/smoke.spec.ts:7:1 › betölti a kezdőlapot ... (82ms)
web:test:e2e:   1 passed (2.3s)
 Tasks:    2 successful, 2 total      # kilepesi kod 0
```

**Miért nem "zöldre hazudás".** A Playwright ismer egy
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env változót, ami átugorja az indulás előtti
ellenőrzést (`playwright-core/lib/coreBundle.js`,
[forrás](https://github.com/microsoft/playwright/blob/v1.62.0/packages/playwright-core/src/server/registry/index.ts#L1204-L1211)).
**Ezt nem használjuk**, mert az csak az ellenőrzést kapcsolná ki, a hiányzó könyvtárat nem
pótolná. A `LD_LIBRARY_PATH` viszont valóban megoldja a szimbólumot, és a Playwright validátora
is átmegy tőle, mert a saját `ldd` hívásába maga elé fűzi a `process.env.LD_LIBRARY_PATH`
értéket (`coreBundle.js:31892`). A javítás terhelő voltát ellenpróba igazolja: ugyanez a parancs
`LD_LIBRARY_PATH` nélkül továbbra is bukik, immár a valódi, dlopen szintű hibával:

```
[pid=77][err] .../headless_shell: error while loading shared libraries:
              libXdamage.so.1: cannot open shared object file: No such file or directory
  1 failed                                                    # kilepesi kod 1
```

**Amire nem volt szükség.** A `--no-sandbox` és a `--disable-dev-shm-usage` kapcsolót nem kellett
hozzáadni: a Playwright mindkettőt alapból kiküldi (a fenti launch log tartalmazza őket), mert a
`chromiumSandbox` dokumentált alapértelmezése `false`
([forrás](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)). A rendszeren
nincs előre telepített chromium vagy chrome (`which chromium chromium-browser google-chrome`
üres), tehát a `channel`/`executablePath` út nem volt járható, de nem is kellett.

**Következmény.** A SPEC-001 16. szekció 22. kritériuma **teljesül**, nem "környezetfüggő".
A megoldás **kizárólag környezeti változó**, a repóban nulla módosítás, ezért a CI-re semmilyen
hatása nincs: a `playwright.config.ts`, a `.github/workflows/ci.yml` és a `turbo.json` érintetlen,
a GitHub Actions runner változatlanul a rendes, root jogú `install --with-deps` úton kapja meg a
függőségeket. A helyi beállítás a fejlesztői sandbox `~/envrc` fájljában él, leírva a gyökér
`CLAUDE.md` "Teszt infrastruktúra" szekciójában és az `apps/web/e2e/CLAUDE.md`-ben.

**Kapcsolódó eredmény: az e2e coverage gyűjtés is igazolt.** A smoke teszt futása után az
`apps/web/e2e/.nyc_output/` alá ténylegesen kikerült egy nyers JSON, benne az
`apps/web/src/main.ts` bejegyzése `s: {"0":1,"1":1,"2":1}` értékkel, azaz a böngészőben mind a
három instrumentált utasítás lefutott. A `bun run --filter web coverage:e2e:report` ebből 100
százalékos riportot állít elő (`text`, `html`, `lcov`, kilépési kód 0). Ez a `vite-plugin-istanbul`
Vite 8 (Rolldown) alatti működését a korábbi izolált próbán túl **végponttól végpontig, valódi
böngészőben** is igazolja (lásd V-11).

---

## V-20: a Turborepo cache találat és az e2e lefedettségi riport ütközése

**Kérdés.** Miért bukott az `E2E` job "E2E coverage report" lépése a
[32994208280](https://github.com/EggProject/easter-workflow-builder/actions/runs/32994208280)
futásban, miközben az előző futásban
([32993421389](https://github.com/EggProject/easter-workflow-builder/actions/runs/32993421389))
ugyanez a lépés zöld volt, és a két futás között egyetlen változás a `gh pr comment --repo`
kapcsoló felvétele volt.

**Válasz.** **Turborepo cache találat.** A `bun run test:e2e` valójában `turbo run test:e2e`,
és cache találatkor a Playwright **nem indul el**, csak a napló játszódik vissza. A lemezre
ilyenkor kizárólag az kerül ki, amit a `turbo.json` `outputs` mezője felsorol - abban pedig
nem szerepelt a nyers coverage könyvtár. A rákövetkező `nyc report --temp-dir e2e/.nyc_output`
így egy nem létező könyvtárat próbált beolvasni.

**Bizonyíték, 1: a két CI napló különbsége.** Ugyanaz a task hash mindkét futásban
(`8edba6961267f6d2`), de a viselkedés más:

```
# 32993421389 (zold), E2E > Setup:
Cache not found for input keys: Linux-turbo-e2e-86940656..., Linux-turbo-e2e-
# 32993421389, E2E > Run e2e tests:
web:test:e2e: cache miss, executing 8edba6961267f6d2
  Time:    5.045s
# 32993421389, E2E > E2E coverage report:
web coverage:e2e:report: All files |     100 |      100 |     100 |     100
web coverage:e2e:report: Exited with code 0

# 32994208280 (bukott), E2E > Setup:
Cache restored from key: Linux-turbo-e2e-86940656b2e97e0ac4a1a410e7d41ed10b985d7f
# 32994208280, E2E > Run e2e tests:
web:test:e2e: cache hit, replaying logs 8edba6961267f6d2
  Time:    33ms >>> FULL TURBO
# 32994208280, E2E > E2E coverage report:
##[error]Process completed with exit code 1
```

A `gh pr comment --repo` commit tehát csak **közvetve** hatott: nem változtatta meg a
`test:e2e` task hash-ét (a `.github/**` nincs a `globalDependencies` között és nincs a `web`
csomagon belül), viszont az általa kiváltott új futás már megtalálta az előző futás által
feltöltött `.turbo` cache-t. A hiba tehát **a második futástól kezdve determinisztikus**,
nem flaky.

Ugyanezt igazolja a két kísérő figyelmeztetés is, amit a job feltöltő lépései írtak:
`No files were found with the provided path: apps/web/coverage-e2e/**` és
`No files were found with the provided path: pr-comment/02-e2e.md`. Az utóbbi azt is
megmondja, hogy a `pr-comment/02-e2e.md` **nem** készült el: a `bash -e` shell az első
paranccsal (`bun run ... > $RUNNER_TEMP/e2e-coverage.txt`) megállt, tehát sem a fájl, sem a
`$GITHUB_STEP_SUMMARY` hozzáfűzés nem futott le. A `coverage-comment` job ennek megfelelően
csak az unit töredéket töltötte le (`ARTIFACTS: coverage-comment-unit, coverage-report`),
és mivel nem minőségi kapu, ő maga zöld maradt.

**Bizonyíték, 2: helyi reprodukció.** A CI-t utánozva (először friss cache, majd a
`.nyc_output` törlése, ami a friss checkoutot modellezi):

```
$ rm -rf .turbo/cache apps/web/e2e/.nyc_output && CI=true turbo run test:e2e
web:test:e2e: cache miss, executing ...      # a Playwright tenylegesen fut
$ rm -rf apps/web/e2e/.nyc_output && CI=true turbo run test:e2e
web:test:e2e: cache hit, replaying logs ...  # >>> FULL TURBO
$ ls apps/web/e2e/.nyc_output
ls: cannot access 'apps/web/e2e/.nyc_output': No such file or directory
$ bun run --filter web coverage:e2e:report
web coverage:e2e:report: ENOENT: no such file or directory, scandir '.../apps/web/e2e/.nyc_output'
web coverage:e2e:report: Exited with code 1   # kilepesi kod 1
```

**Bizonyíték, 3: a dokumentált szabály.** A Turborepo "Caching" oldala szó szerint:
_"Turborepo caches the file outputs of a task that are defined in the `outputs` key of
`turbo.json`. When there's a cache hit, Turborepo will restore the files from the cache."_
([turborepo.com/docs/crafting-your-repository/caching](https://turborepo.com/docs/crafting-your-repository/caching))
A "Configuring tasks" oldal ugyanezt megfordítva is kimondja: _"Without this key defined,
Turborepo will not cache any files. Hitting cache on subsequent runs will not restore any
file outputs."_
([turborepo.com/docs/crafting-your-repository/configuring-tasks](https://turborepo.com/docs/crafting-your-repository/configuring-tasks))

**Javítás.** A `turbo.json` `test:e2e` taskja két ponton változott:

| Mező      | Előtte                                                    | Utána                                  |
| --------- | --------------------------------------------------------- | -------------------------------------- |
| `outputs` | `playwright-report/**`, `test-results/**`                 | plusz `e2e/.nyc_output/**`             |
| `inputs`  | `$TURBO_DEFAULT$`, `**/e2e/**`, `**/playwright.config.ts` | plusz `!**/e2e/.nyc_output/**` negáció |

A negáció **nem kozmetika**. Explicit `inputs` glob esetén a Turborepo dokumentáltan **nem
veszi figyelembe a `.gitignore`-t**: _"Using the `inputs` key opts you out of `turbo`'s
default behavior of considering `.gitignore`. You must reconstruct the globs from
`.gitignore` as desired"_
([turborepo.com/docs/reference/configuration#inputs](https://turborepo.com/docs/reference/configuration#inputs)),
és a task saját `outputs`-a sem kerül automatikusan kizárásra az `inputs`-ból
([vercel/turborepo#7480](https://github.com/vercel/turborepo/discussions/7480), a karbantartó
válasza: _"I would prefer Turborepo do exactly what I told it to do."_). A `**/e2e/**` minta
tehát a visszaállított, UUID nevű nyers JSON-t is behúzná a hash-be. Mérve, a negáció nélkül:

```
# negacio NELKUL
web:test:e2e: cache miss, executing 0bf79d9dbf53afc9   # ures .nyc_output
web:test:e2e: cache miss, executing 9938c234fe752699   # .nyc_output jelen van -> mas hash

# negacioval
web:test:e2e: cache miss, executing 64a823f2ea95e9bf   # elso futas
web:test:e2e: cache hit,  replaying 64a823f2ea95e9bf   # .nyc_output torolve, HELYREALL
web:test:e2e: cache hit,  replaying 64a823f2ea95e9bf   # .nyc_output jelen, hash valtozatlan
web:test:e2e: cache hit,  replaying 64a823f2ea95e9bf   # negyedik futas, stabil
```

**Következmény a hibakereshetőségre.** A bukott lépés naplója **egyetlen hibaüzenetet sem
tartalmazott**, mert a parancs stdout-ja fájlba ment (`> "$RUNNER_TEMP/e2e-coverage.txt"`), a
`bash -e` pedig azonnal megölte a lépést, mielőtt a fájlt bárki kiírta volna. Ez önmagában is
hiba volt, ezért két, egymástól független javítás készült:

1. Új token takarékos wrapper, a `tooling/scripts/e2e-coverage.sh` (gyökér script:
   `bun run coverage:e2e:report`). **A stdout kizárólag az `nyc` táblázata**, minden más
   (fejléc, időmérés, hibaüzenet) a **stderr**-re megy - a stderr nincs átirányítva, tehát a
   hiba mindig látszik a naplóban. A wrapper ezen felül külön ellenőrzi a nyers coverage
   fájlok meglétét, és beszédes üzenettel áll meg helyettük, nem az `nyc` csupasz
   `ENOENT ... scandir` sorával.
2. A CI lépés `if !` ágban futtatja a parancsot, és bukás esetén a fájlba fogott kimenetet is
   kiírja egy összecsukható `::group::` blokkba, mielőtt elbuktatja a lépést. Sikeres ágon a
   napló változatlan méretű marad.

Sem `|| true`, sem `continue-on-error` nem került a lépésre: a CI kapu marad kapu.

---

## Melléklet: a lezárás során talált és javított hibák

A pontok ellenőrzése öt valós hibát hozott a felszínre. Az utolsó kettőt nem az audit
találta meg, hanem egy éles GitHub Actions futás bukása (V-20).

| Hiba                                                                                                                                                                     | Hol                                        | Javítás                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Egyetlen csomag `package.json`-ja sem deklarálta a workspace függőségeit, ezért a Turborepo függőségi gráfja üres volt és a cache soha nem invalidálódott                | minden `package.json`                      | a SPEC-001 3. szekció függőségi iránya felvéve `workspace:*` alakban                      |
| A `devEngines.packageManager` bevezetése után az `npx` megtagadja a futást, a CI e2e jobja viszont `npx playwright install` parancsot hívott                             | `.github/workflows/ci.yml`                 | `bunx playwright install` alakra átírva                                                   |
| Egy `unknown` `Fact` `reason` mezője prózai mérési hivatkozást és mért számot tartalmazott, amit a SPEC-001 35. kritériuma tilt                                          | `claude-subscription/structured-output.ts` | a `reason` egy mondatra rövidítve, a hivatkozást a `blockedBy` hordozza                   |
| A `test:e2e` task `outputs` mezője nem sorolta fel a nyers e2e coverage könyvtárat, ezért Turborepo cache találatkor a rákövetkező `nyc report` ENOENT-tel bukott (V-20) | `turbo.json`                               | `e2e/.nyc_output/**` felvéve az `outputs` közé, `!**/e2e/.nyc_output/**` az `inputs` közé |
| A CI e2e coverage lépése fájlba irányította a stdout-ot, ezért bukás esetén a naplóban egyetlen hibaüzenet sem jelent meg (V-20)                                         | `.github/workflows/ci.yml`                 | `tooling/scripts/e2e-coverage.sh` wrapper (hibák a stderr-re) + `::group::` dump bukáskor |

Az utolsó hibát a `packages/providers/src/registry.test.ts` regressziós tesztje találta meg, és
ugyanaz a teszt akadályozza meg, hogy visszatérjen.

## Kapcsolódó dokumentumok

- [`../spec/SPEC-001-monorepo-toolchain.md`](../spec/SPEC-001-monorepo-toolchain.md)
- [`../plan/PLAN-001-monorepo-toolchain.md`](../plan/PLAN-001-monorepo-toolchain.md)
- [`2026-08-26-toolchain.md`](2026-08-26-toolchain.md)
