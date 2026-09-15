import type { RunStatus } from '@easter-workflow-builder/protocol';

/**
 * Megszakítható-e a futás (SPEC-008 6.5 táblázat: a megszakítás `pending` és
 * `running` állapotban aktív, az újraindítás TERMINÁLIS állapotban).
 *
 * A hat `RunStatus` érték két, egymást kizáró csoportra oszlik: a `pending` és
 * a `running` a nem terminális, a maradék négy (`succeeded`, `failed`,
 * `cancelled`, `interrupted`) a terminális (SPEC-004 9. és 10. szekció: a
 * megszakított és a félbeszakított futás is terminális, az újraindítás
 * mindkettőnél ÚJ futás, új pillanatképpel, F-18). Ezért az újraindíthatóság
 * ennek a tagadása, és nincs rá önálló függvény: az egyetlen fogyasztó
 * (`RunControlBar`) egyetlen ternáriában dönt a két gomb között, tehát egy
 * `isRunRestartable` burkoló sosem futó, második ág lenne.
 */
export function isRunInterruptible(status: RunStatus): boolean {
  return status === 'pending' || status === 'running';
}
