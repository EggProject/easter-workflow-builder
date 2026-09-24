import { RunStatusSchema, type RunStatus } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isRunInterruptible } from './run-control-availability.ts';

const NON_TERMINAL_STATUSES: readonly RunStatus[] = ['pending', 'running'];
const TERMINAL_STATUSES: readonly RunStatus[] = ['succeeded', 'failed', 'cancelled', 'interrupted'];

describe('isRunInterruptible', () => {
  it('a két csoport együtt a hat drótszintű RunStatus értéket fedi', () => {
    // Harmadik csoport nincs: a felület a függvény tagadásával dönt az
    // újraindítás gombjáról. Ez az eset azt őrzi, hogy a két lista együtt a
    // teljes, drótszintű felsorolást fedi, és minden elem valóban érvényes
    // `RunStatus` érték.
    const allStatuses = [...NON_TERMINAL_STATUSES, ...TERMINAL_STATUSES];
    expect(allStatuses).toHaveLength(6);
    for (const status of allStatuses) {
      expect(RunStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it.each(NON_TERMINAL_STATUSES)('a %s állapot megszakítható', (status) => {
    expect(isRunInterruptible(status)).toBe(true);
  });

  it.each(TERMINAL_STATUSES)('a %s állapot nem megszakítható', (status) => {
    expect(isRunInterruptible(status)).toBe(false);
  });
});
