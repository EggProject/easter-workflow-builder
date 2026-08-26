# tools/wire-probe/src/harness

## Mi ez a mappa

A mérési esetek közös futtató rétege: egy `query()` hívás lefuttatása, a teljes `SDKMessage`
folyam és egy `meta.json` lemezre írása, falóra-időkorlát, valamint a SPEC-000 közös
alapbeállítása (`buildBaseOptions`) és a telepített SDK típusdefiníciójából kiolvasott, nem
kitalált enumértékek. Ide **nem** tartozik egyetlen konkrét mérési eset logikája (az a
`../cases/` alatt van), és nem tartozik ide a HTTP forgalom rögzítése vagy maszkolása (az a
`../proxy/` felelőssége, amit ez a mappa csak a titok-átfésüléshez, `redactKnownSecrets`-en
keresztül használ).

## Fájlok

| Fájl               | Tartalom                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`         | `CaseContext`, `CaseRunOutcome`, `MeasurementCase` közös típusok                                                                           |
| `environment.ts`   | `MINIMAX_API_KEY` betöltése `process.env`-ből vagy a repo gyökér `.env` fájljából                                                          |
| `sdk-constants.ts` | a telepített SDK típusdefiníciójából kiolvasott enumok (`effort`, `thinking`, `permissionMode`) és a telepített SDK verziójának kiolvasása |
| `runner.ts`        | `executeQuery()` (egy `query()` futtatása és rögzítése), `buildBaseOptions()`, `DEFAULT_PROMPT`                                            |

## Függőségi irány

Ez a mappa a `../proxy/mask.ts` `redactKnownSecrets` függvényétől függ (a `meta.json`-ba írt
`Options.env` átfésüléséhez), a `node:fs`, `node:path`, `node:url` beépített moduloktól, és a
`@anthropic-ai/claude-agent-sdk` csomagtól. A `../proxy/` többi részétől (recorder, HTTP szerver)
és a `../cases/`-től **tilos** függeni, azok a harnesst fogyasztják, nem fordítva.

## Szabályok

- Új, kitalált SDK enumértéket ide tilos felvenni: minden `sdk-constants.ts` konstans mellett forrás-hivatkozás (fájl és sor) kell a telepített `sdk.d.ts`-re.
- A `runner.ts` 400/429 upstream választ nem kezel hibaként: az a `result` üzenet `subtype`-jában jelenik meg, és a futás emiatt is `ok`-nak számít, amíg a harness maga nem dob kivételt.
- A `meta.json`-ba kerülő `Options` leírásból a függvényértékek `"[function]"`, a körkörös hivatkozások `"[circular]"` placeholderré alakulnak, mert a `mcpServers` élő szerver objektuma önmagára mutató mezőt tartalmazhat.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md)
- [`../../../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../../../docs/research/2026-08-26-agent-sdk-minimax.md)
