/**
 * Az Agent SDK `query()` hívásának visszatérési értéke, a lehető legszűkebb
 * alakra fogva: csak az, amit az adapter ténylegesen használ.
 *
 * Nem az SDK `Query` típusa. Két oka van. Az egyik, hogy az SDK `Query`
 * vezérlő metódusainak (`setPermissionMode`, `setModel`, `setMaxThinkingTokens`,
 * `close`, ...) nagy része a porton nem megy át, tehát egy tesztbeli hamis
 * kezelőnek is meg kellene valósítania őket, pusztán a fordító kedvéért. A
 * másik, hogy az `interrupt()` nyugtájának alakja SDK verzióhoz kötött.
 *
 * Az `interrupt()` itt `Promise<unknown>`, mert az SDK-é nem `Promise<void>`:
 * a `Promise<SDKControlInterruptResponse | undefined>` nem hozzárendelhető a
 * `Promise<void>` típushoz. Az `AgentQuery.interrupt()` `Promise<void>` alakra
 * szűkítését az adapter végzi, a nyugta eldobásával.
 */
export interface SdkQueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<unknown>;
}
