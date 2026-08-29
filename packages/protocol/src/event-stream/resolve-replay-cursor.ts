/**
 * A kurzor szabály: `max(padló, kurzor)` (SPEC-005 5.3 és 5.6 szekció).
 * Tiszta függvény, nem ismer hálózatot és nem hív portot. A `cursor` a
 * kliens `Last-Event-ID` fejlécéből jövő, egésszé szűkített érték; `null`,
 * ha a fejléc nem érkezett (a kapcsolat még egyetlen `id:` mezőt sem
 * látott, SPEC-005 5.6 1. pont).
 */
export function resolveReplayCursor(floor: number, cursor: number | null): number {
  if (cursor === null) {
    return floor;
  }
  return Math.max(floor, cursor);
}
