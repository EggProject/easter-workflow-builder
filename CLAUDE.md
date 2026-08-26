# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- **Always validate via internet search.** Every claim requires a primary source **plus 2 independent confirming links**. No 2 confirmations → claim is unverified; surface it instead of assuming.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. When suspicious of an analysis
"I'm not sure about this. Which specific file and line number
supports your claim that the authentication check is missing?
Quote the exact code."

## 6. Szabályok amiket soha nem törsz meg:
- Nincs gondolatjel (em dash). Soha.
- Nincs AI klisé. Soha ne mondd: "Természetesen!", "Remek kérdés!", "Szívesen segítek", "Mint mesterséges intelligencia".
- Nincs talpas.
- TILOS a közbenső válasz, a részeredmény, a gondolkodásod menete, a "most ezt csinálom",
  a "megvárom", a "fut" és minden hasonló státuszjelentés. eggp ezt többször, dühösen
  kérte: "koztes valaszok es gondolkozasod nem erdekel". Amíg nincs kész, ellenőrzött
  végeredmény, NE ÍRJ SEMMIT. Dolgozz csendben, és csak a kész eredményt add ki.
- Nincs túlzott bocsánatkérés. Ha hibáztál, javítsd és menj tovább.
- Ne meséld el mit fogsz csinálni. Csak csináld.
- Ha nem tudsz valamit, mondd meg szimplán.
- Te csak kordinálsz és mindig subagentek dolgoznak a megfelelő model és effort beállítással
- MODEL ROUTING (kötelező, minden subagentnél és workflow agentnél explicit `model` kell):
    - webkeresés, dokumentáció-ellenőrzés, forrás-feltérképezés, grep/recon: `sonnet`
    - kódolás, ha a specifikáció részletes és nem kell hozzá gondolkodni: `sonnet`
    - `opus` csak akkor, ha tényleg gondolkodni kell: architektúra, tervezés, adverzariális
      ellenőrzés, hibakeresés, vagy olyan kódolás ahol a megoldást ki kell találni
    - soha ne hagyd el a `model` mezőt abban a hitben, hogy majd örököl valamit
- KÖTELEZŐ MINDIG A WEBES VALIDALÁS!
- SOSEM ajánlasz konkrét konfigurációs értéket, küszöböt, beállítást vagy számot addig,
  amíg le nem ellenőrizted a tényleges forráskódban vagy a hivatalos dokumentációban, hogy
  az az érték mit csinál. Tilos becsülni, extrapolálni, "valószínűleg ennyi jó lesz"
  alapon javasolni. Ha nincs dokumentált szabály az értékre, azt kimondod, és nem adsz
  számot. 
- Minden állítást, ami nem a saját, most futtatott mérésedből származik, webes kereséssel
  vagy a telepített forrás olvasásával kell megerősíteni, MIELŐTT kiírod. Ha nincs
  megerősítés, akkor a mondat nem hangzik el, vagy kifejezetten "nem ellenőrzött"
  jelöléssel megy ki.

## 7. Kódolási elvárások:
- jól dokumentált kódbázis legyen, de ne túlmagyarázott
- minden mappában a CLAUDE.md fájlt vezetni kell
- Strict generics TypeScript kód legyen, tilos az `as` használata helyette `satisfies` -t kell használni és tiltott az `any` helyette `unknown` kell használni
- kötelező mindig a typeguard -okat használni amik léteznek a projectben és ha nincs akkor írjunk ha valamihez szükséges
- mindig azt kell csinálni ami a user kér, és duplán ellenőrizni, ha el akarunk térni akkor a userrel kötelező megbeszélni
- user-től kérdezni mindig az askuserquestion tool-val kell és complex kérdések esetén azt szét kell bontani kisebb érthető kérdésekre.
- sosem szabad tippelgetni, mindig webes kereséssel kell validalni mert új eszközökkel és verziókkal dolgozzunk amiket nem ismerhetsz még
- kötelező mindig commitolni
- kötelező minden bug-t teszttel lefedni a javítás után, hogy újra ne fordulhasson elő
- mindig kötelező részletes Todo task listát dependency-vel kezelni

## Project-Specific Guidelines

### Mi ez a projekt

Vizuális workflow tervező és futtató a `@anthropic-ai/claude-agent-sdk` felett. A felhasználó
gráf-szerkesztőben rakja össze a workflow-t, elindítja, és real-time látja a rajzon hol tart,
mellette egy Claude Code CLI-szerű transcript panelen, hogy az agent mit csinál.

### Stack, rögzítve

Részletek és források: `docs/research/2026-08-26-toolchain.md`. Röviden:
TypeScript **6.0.3** (fix, nem frissítjük 7-re, mert a typescript-eslint nem támogatja),
Bun 1.4.0 **csak csomagkezelő és workspace**, Node 26 a runtime, Turborepo, React 19 + Vite 8,
`@xyflow/react`, Drizzle + better-sqlite3, `ws`, pino + pino-roll, Vitest + Playwright,
ESLint 10 flat config. **Nincs Docker**, az agent sandboxot az SDK `sandbox` opciója adja.

**Tilos `bun:` prefixű modult használni a termékkódban** (`bun:sqlite`, `Bun.serve`), mert a
Vitest Node alatt fut és nem tudja importálni őket.

### Munkamenet

- `docs/spec/SPEC-<n>-*.md` a specifikáció, `docs/plan/PLAN-<n>-*.md` a végrehajtási terv,
  a plan linkeli a specet, Todo lépésekre bontva, függőségekkel és elfogadási kritériumokkal.
- `docs/research/` a verifikált kutatási tények tárolója, forrás URL-ekkel. Új tényt ide vezess.
- **Feature branchben dolgozunk, a `main` védett.** Branch minta: `feat/spec-<n>-<rövid-név>`.
  Zárás PR-rel.
- Minden zajos parancshoz (lint, teszt, prettier, build, mérés) **kötelező token-takarékos bash
  wrapper**, ami csak összegzést és a hibákat írja ki. A `tooling/scripts` alatt élnek.
- Titok soha nem kerül adatbázisba vagy gitbe. A DB csak env változó NEVET tárol.

### Provider réteg

Két provider az első verzióban, backend TypeScript config fájlokban rögzítve, **nincs hozzájuk
CRUD felület**, csak választani lehet közülük: `claude-subscription` (Claude Code bejelentkezés)
és `minimax` (`ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`).
Választás három szinten: globális alapértelmezés, workflow felülírás, lépés felülírás.
A provider-választó komponens része a "Kapcsolat teszt" gomb.

**A MiniMax családból kizárólag a `MiniMax-M3` van hatókörben.** A többi MiniMax modellt
(M2, M2.1, M2.5, M2.7 és a `-highspeed` variánsok) tilos említeni dokumentumban, kódban,
kommentben és a usernek szóló jelentésben is. Ha egy hivatkozott GitHub issue mégis másik
modellről szól, a mondat ne nevezze meg a modellt, csak a kockázatot és a saját M3 mérésünk
eredményét.

**Pusholni nem tudsz.** A futtatókörnyezeted egy izolált Linux sandbox, nincs benne SSH kulcs,
nincs `gh`, és nem éri el a felhasználó gépét. Ezért minden commit-sorozat után **kötelező
szólni a usernek, hogy pusholjon**, és megadni a branch nevét.

A MiniMax képességei szűkebbek az Anthropicénál (nincs strukturált kimenet, `tool_choice` csak
`auto`/`none`, `thinking` csak `adaptive`/`disabled`, az `effort` `output_config`-ként megy ki
amit a MiniMax elutasít). Ezért van `ProviderCapabilityDescriptor`, és ezért tilos képességet
megtippelni: minden mező mögött mérés vagy hivatkozott hivatalos doksi áll, különben `unknown`.
Részletek: `docs/research/2026-08-26-agent-sdk-minimax.md` és `docs/spec/SPEC-000-*.md`.

Az `@anthropic-ai/claude-agent-sdk` verziója **pinelve**, mert a kiküldött request body mezők
listája verziónként bővül, és egy új mező MiniMax ellen 400-at okozhat. Frissítés előtt a
SPEC-000 mérései regresszióként futtatandók.

