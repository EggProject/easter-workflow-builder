# src/providers

## Mi ez a mappa

A provider képességleírók ideiglenes helye. A monorepo (Turborepo workspace) még nem létezik,
ezért ezek a fájlok most a repo gyökér `src/` alatt élnek. **Amint a `packages/` felállt, ide
tartoznak át**, várhatóan egy `packages/providers` csomagba. A fájlok között nincs futásidejű
függőség semmi máson kívül, csak típusokat és adat literálokat tartalmaznak, ezért az átmozgatás
import útvonal csere.

| Fájl | Tartalom |
|---|---|
| `fact.ts` | `Fact<T>` háromállapotú bizonyíték típus, `EvidenceRef`, `EvidenceList`, `isKnown` és `isUnknown` typeguard |
| `capability-descriptor.ts` | a `ProviderCapabilityDescriptor` generikus típus és a mezőcsoportjai |
| `minimax.ts` | a `minimax` provider kitöltött leírója, mérési adatokból |
| `claude-subscription.ts` | a `claude-subscription` provider leírója, hivatalos dokumentációból |

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** Minden képességmező vagy `known` egy nem üres
`evidence` listával (mérési eset azonosító, hivatalos doksi URL, vagy research szekció), vagy
`unknown` az akadály megnevezésével és a blokkoló mérési esetekkel. A típusrendszer ezt
kikényszeríti: az `EvidenceList` tuple alak miatt üres bizonyítéklistával a `known` ág nem fordul
le, és az `isKnown` typeguard nélkül a `value` mező nem olvasható.

Tippelni, extrapolálni, "valószínűleg ennyi jó lesz" alapon értéket beírni tilos. Ha nincs
dokumentált szabály vagy mérés, a mező `unknown` marad.

A `claude-subscription` leíró **nem** örökölhet értéket a `minimax` leíróból. Ezt a providert a
SPEC-000 1. szekciója szerint nem mértük drótszinten, ezért ott minden `known` mező mögött
hivatalos Anthropic dokumentáció áll, minden más `unknown`.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` (helyette
`satisfies`), a leíró objektum literál `satisfies ProviderCapabilityDescriptor<...>` alakban
kapcsolódik a típushoz.

## Típusrések, amiket a kitöltés felszínre hozott

| Mező | Probléma |
|---|---|
| `promptCaching.minimumInputTokens` | egyetlen számot vár, de az Anthropic oldalon modellenként eltér (512 / 1024 / 2048 / 4096). A `claude-subscription` leíróban ezért `unknown` |
| `models[].maxOutputTokensRecommended` | az Anthropic dokumentáció nem különböztet meg ajánlott és hard korlátot, csak egyet ad |
| `rateLimits.buckets` | RPM/TPM alakú, az előfizetéses út viszont gördülő 5 órás és heti ablakkal működik, publikus szám nélkül. A `claude-subscription` leíróban ezért üres a lista |

Ezeket a típus javításakor kell rendezni, addig `unknown` marad a mező.

## Mezők, amiket az M-19 ... M-25 mérés adott a típushoz

| Mező | Mit ír le | Miért kellett |
|---|---|---|
| `models[].maxOutputTokensWireCeiling` | a kimenő `max_tokens` **kliens oldali** felső korlátja | az M-22 megmutatta, hogy a Claude Code a saját modelltáblájának cap értékére vág (MiniMax ellen 128 000-re), tehát a provider dokumentált korlátja nem érhető el. Erre a különbségre nem volt mező |
| `streaming.streamDisableable` | kikapcsolható-e a kimenő `stream` mező | az M-24 szerint a telepített SDK `Options` típusában nincs `stream` mező, ezért a nem stream `usage` objektum elvi okból megfigyelhetetlen. Ez korlátozza a `promptCaching` mérhetőségét, tehát a leíróban látszania kell |

A `models[].effectiveContextWindowOnWire` mező jelentése is pontosodott: **mért alsó korlát**, a
legnagyobb sikeresen kiszolgált teljes bemeneti token szám (`usage.input_tokens` plusz
`usage.cache_read_input_tokens`), nem a pontos határ.

## Típusellenőrzés

A gyökér `tsconfig.json` fogja be ezt a mappát (`include: ["src/**/*.ts"]`). Futtatás a jelenlegi
átmeneti állapotban:

```
./tools/wire-probe/node_modules/.bin/tsc --noEmit -p tsconfig.json
```

## Kapcsolódó dokumentumok

- `docs/spec/SPEC-000-provider-wire-measurement.md`: a típusterv és a mérési esetek
- `docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`: nyers mérési megfigyelések
- `docs/research/2026-08-26-spec000-kiertekeles.md`: Q1-Q12 lezárása és a tervezési következmények
- `docs/research/2026-08-26-agent-sdk-minimax.md`: a research alapfájl
