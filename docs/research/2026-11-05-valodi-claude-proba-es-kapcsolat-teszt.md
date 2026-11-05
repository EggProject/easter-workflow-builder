# Valódi Claude próba és Kapcsolat teszt (2026-11-05)

Engedély: user, 2026-11-04. A kérdés: "A claude-subscription (Claude előfizetés) provider és a 'Kapcsolat
teszt' gomb soha nem futott valódi API ellen. Futtassuk?", a válasz: "Igen, kis próba mindkettőre".
Pontosan ennyi volt engedélyezve: egy `claude-subscription` próba (`claude-haiku-4-5`, `maxTurns` 1) és egy-egy
Kapcsolat teszt `minimax`-ra és `claude-subscription`-re.

## 1. Előfeltétel: Claude Code bejelentkezés a futtatókörnyezetben

A `claude-subscription` a Claude Code bejelentkezést (`/login`) használja. A hivatalos dokumentáció szerint
Linuxon a hitelesítő adatok a `~/.claude/.credentials.json` fájlban állnak (0600), `CLAUDE_CONFIG_DIR` esetén
az alatt (<https://code.claude.com/docs/en/authentication>, "Credential management").
Második megerősítés: <https://claw.aguidetocloud.com/anthropic/claude-code/auth/> és
<https://secretspec.dev/blog/claude-code-stores-oauth-tokens-in-plaintext/> (mindkettő ugyanezt a Linux
útvonalat nevezi meg).

Saját ellenőrzés (csak létezés, tartalom nem nyitva): a futtatókörnyezetben a `~/.claude/.credentials.json`
**nem létezik**, a `~/.claude` könyvtárban nincs hitelesítő fájl, és a `CLAUDE_CODE_OAUTH_TOKEN` és az
`ANTHROPIC_API_KEY` környezeti változó sincs beállítva. A futtatókörnyezet izolált Linux sandbox, nem a user gépe.
Kerülő utat nem próbáltunk (a usert nem léptettük be, kulcsot nem kértünk).

## 2. Ami lefutott: `minimax` Kapcsolat teszt

Valódi szerver (`node apps/server/src/main.ts`, `EASTER_SERVER_PORT=0`, a lekötött port a stdout első sorából,
`--env-file` a user `.env` fájljára), majd `POST /api/providers/minimax/connection-test`, egyszer.

| Mező     | Érték                                    |
| -------- | ---------------------------------------- |
| HTTP     | 200                                      |
| törzs    | `{"succeeded":true,"errorMessage":null}` |
| idő      | 2,94 s (curl `time_total`)               |
| alap fej | `9acafec`                                |

A végpont választ a `succeeded` mezővel adja; modellt a válasz nem tartalmaz. Költség nem mért.

## 3. Ami NEM futott le (nyitva)

- a `claude-subscription` próba (`bun run probe:real-provider -- claude-subscription`),
- a `claude-subscription` Kapcsolat teszt.

Ezért a SPEC-012 21., a SPEC-013 19. kritérium és a SPEC-009 7.1 nyitott pontja változatlanul nyitva marad.

A user parancsai a saját gépén, a repó gyökeréből (bejelentkezett Claude Code mellett, `.env` megléte esetén):

```
bun run probe:real-provider -- claude-subscription
EASTER_SERVER_PORT=0 node --env-file-if-exists=.env apps/server/src/main.ts
# a stdout első sora a portot adja (EASTER_PROBE_PORT=<port>), majd másik terminálban:
curl -s -X POST localhost:<port>/api/providers/claude-subscription/connection-test
```

## 4. Titok keresés

A `.env` kulcs jellegű értékeire (darabszám: 1) fix szöveges keresés a worktree-ben, a szerver kimenetében és
az utolsó 300 commit minden ágában: 0 találat. Az értéket nem írtuk ki.
