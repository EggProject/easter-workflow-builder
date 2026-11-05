# PLAN-018: A Host és Origin ellenőrzés terve

|         |                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Státusz | végrehajtva (T-018-1 ... T-018-9)                                                                      |
| Dátum   | 2026-11-05                                                                                             |
| Spec    | [`../spec/SPEC-017-host-origin-ellenorzes.md`](../spec/SPEC-017-host-origin-ellenorzes.md)             |
| Forrás  | [`../research/2026-11-05-host-origin-ellenorzes.md`](../research/2026-11-05-host-origin-ellenorzes.md) |
| Branch  | `feat/host-origin-ellenorzes`                                                                          |

A lépések a SPEC-017 8. szekciójának kritérium számára hivatkoznak (`ACn`).

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                      | Ellenőrzés                        |
| ------------------- | ------------------------------------------------- | --------------------------------- |
| Termékdöntés        | a user 2026-11-04-i válasza (SPEC-017 7.1 O-1)    | a SPEC-017 1. szekciója           |
| Feature branch      | `feat/host-origin-ellenorzes`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                     | a T-018-1 kimenete                |

## 2. Kapuk

**Minden lépés végén a kilenc kapu** nulla kilépési kóddal fut, a mérvadó lista a `.claude/CLAUDE.md` 8.
szekciója; a lint `bun x turbo run lint --concurrency=1` alakban fut.

**Merge kapu** (a CI ki van kapcsolva): a friss `main` bemergelése után a PR fején a kilenc kapu, a teljes e2e
nyolc shardban (`flock /tmp/playwright-gep.lock`, legfeljebb 3 worker) és a `coverage:e2e:report` a küszöbbel;
a parancsok, a kilépési kódok, a számok és a fej SHA-ja a PR leírásába kerül.

**Valódi provider hívás nincs**: a mérés szervere futást nem indít.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `sonnet`, `medium` | forrás ellenőrzés, dokumentum átvezetés                                  |
| `sonnet`, `high`   | a spec szerint leírt kódolás (protokoll kód, konfiguráció, guard, teszt) |
| `opus`, `medium`   | a szabály kialakítása, mérés kiértékelése, adverzariális átvizsgálás     |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

| ID      | Leírás                                                                                                                                                                               | Függőség         | Modell             | Elfogadási kritérium  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------ | --------------------- |
| T-018-1 | Források és mérések: OWASP, Fetch Metadata, Go `CrossOriginProtection`, Vite proxy forrás, Node `fetch` fejlécei; a research fájl.                                                   | nincs            | `opus`, `medium`   | research 2., 3.1, 3.2 |
| T-018-2 | `protocol`: `forbidden` kód, `403` státusz, unit.                                                                                                                                    | T-018-1          | `sonnet`, `high`   | AC7 (protokoll rész)  |
| T-018-3 | `apps/web`: a `forbidden` magyar mondata, unit és a `rest-error-paths.spec.ts` e2e esete.                                                                                            | T-018-2          | `sonnet`, `high`   | AC7                   |
| T-018-4 | `server-config`: az engedett origin (`allowedOrigin`, `uiOrigin` alapérték), az `EASTER_STREAM_DEV_ORIGIN` origin alakjának ellenőrzése, unit.                                       | T-018-1          | `sonnet`, `high`   | AC6                   |
| T-018-5 | `request-source-check` téma: `Host` és forrás szabály, unit minden ágra.                                                                                                             | T-018-1          | `sonnet`, `high`   | AC1 ... AC5 (unit)    |
| T-018-6 | Bekötés a `createHttpServer` elejére, a `continueStartupWithDatabase` és a `stub-agent-server` átadja az engedett origint; szerver szintű tesztek nyers `node:http` kéréssel.        | T-018-4, T-018-5 | `sonnet`, `high`   | AC1 ... AC5           |
| T-018-7 | Mérés: `apps/web/measurement/request-source-check.ts`, előtte (a kiinduló fej szervere) és utána, alap és Local Network Access nélküli Chromiummal; számok a research 3.3 szekcióba. | T-018-6          | `opus`, `medium`   | AC8                   |
| T-018-8 | Átvezetés: SPEC-005 8.2, SPEC-006 3.5, 5.7, 5.8, SPEC-007 8.4, SPEC-009 11. szekció, `.env.example`, `README.md`, csomag `CLAUDE.md` fájlok, szabálykönyv.                           | T-018-7          | `sonnet`, `medium` | AC9                   |
| T-018-9 | Adverzariális átvizsgálás, merge kapu, PR.                                                                                                                                           | T-018-8          | `opus`, `medium`   | AC10                  |

## 5. Kockázatok

- Egy eltérő címen megnyitott felület (például `http://127.0.0.1:5173`) minden böngészős kérésére `403` jön; a
  kliens ehhez saját mondatot mutat, a `README.md` és az `.env.example` megnevezi az `EASTER_STREAM_DEV_ORIGIN`
  beállítását.
- A Vite `/api` proxy szabályának jövőbeli `changeOrigin: false` alakja a `Host` fejlécet a Vite címén hagyná,
  és minden REST kérés `403` lenne; a research 3.2 a forrás sorát rögzíti, a mérő eszköz a változást kimutatja.
