# packages/agent-tools/src/result

## Mi ez a mappa

A csomag közös eredmény rétege: a belső hívások kétállapotú `Outcome` típusa és az MCP felé
visszaadott `ToolCallResult` előállítói. Ide **nem** tartozik hálózati hívás, konfiguráció
olvasás és domain specifikus formázás.

## Fájlok

| Fájl                   | Tartalom                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `outcome.ts`           | `Outcome<TValue>` diszkriminált unió                       |
| `is-ok-outcome.ts`     | `isOkOutcome` typeguard                                    |
| `tool-call-result.ts`  | `ToolCallResult`, az MCP `tools/call` válasz saját alakja  |
| `text-tool-result.ts`  | `textToolResult`, sikeres válasz egyetlen szöveges blokkal |
| `error-tool-result.ts` | `errorToolResult`, hibás válasz `isError: true` jelzéssel  |

## Függőségi irány

Semmitől nem függ a csomagon belül, minden más réteg ettől függ.

## Szabályok

**Kivétel nem hagyhatja el ezt a csomagot.** Minden hibaág `Outcome` hibaágként vagy
`errorToolResult` válaszként jelenik meg, hogy az agent dönthessen a folytatásról.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
