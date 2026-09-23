import { describe, expect, it } from 'vitest';
import { createCoalescedReload } from './create-coalesced-reload.ts';

interface ControlledLoad {
  readonly load: () => Promise<void>;
  readonly callCount: () => number;
  readonly resolveNext: () => Promise<void>;
}

/**
 * Egy kívülről lezárható betöltés: minden hívás egy új, függő ígéretet ad,
 * és a teszt dönti el, mikor fejeződik be. A `resolveNext` a legrégebbi
 * függő betöltést zárja le.
 */
function createControlledLoad(): ControlledLoad {
  const pending: (() => void)[] = [];
  let calls = 0;
  return {
    load: () => {
      calls += 1;
      const { promise, resolve } = Promise.withResolvers<undefined>();
      pending.push(() => {
        resolve(undefined);
      });
      return promise;
    },
    callCount: () => calls,
    resolveNext: async () => {
      pending.shift()?.();
      // A `finally` láncszem és az utólagos `request` hívás mikrotaszkon fut.
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('createCoalescedReload', () => {
  it('az első kérés azonnal elindítja a betöltést', () => {
    const controlled = createControlledLoad();
    const request = createCoalescedReload(controlled.load);

    request();

    expect(controlled.callCount()).toBe(1);
  });

  it('a futás alatt érkező bármennyi kérés EGYETLEN utólagos betöltéssé olvad össze', async () => {
    const controlled = createControlledLoad();
    const request = createCoalescedReload(controlled.load);

    request();
    for (let index = 0; index < 1000; index += 1) {
      request();
    }
    expect(controlled.callCount()).toBe(1);

    await controlled.resolveNext();
    expect(controlled.callCount()).toBe(2);

    await controlled.resolveNext();
    expect(controlled.callCount()).toBe(2);
  });

  it('ha a futás alatt nem érkezett kérés, a befejezés után nincs újabb betöltés', async () => {
    const controlled = createControlledLoad();
    const request = createCoalescedReload(controlled.load);

    request();
    await controlled.resolveNext();

    expect(controlled.callCount()).toBe(1);
  });

  it('a befejezés utáni kérés új betöltést indít', async () => {
    const controlled = createControlledLoad();
    const request = createCoalescedReload(controlled.load);

    request();
    await controlled.resolveNext();
    request();

    expect(controlled.callCount()).toBe(2);
  });

  it('az utólagos betöltés alatt érkező kérés ismét egy újabb utólagos betöltést kap', async () => {
    const controlled = createControlledLoad();
    const request = createCoalescedReload(controlled.load);

    request();
    request();
    await controlled.resolveNext();
    expect(controlled.callCount()).toBe(2);

    request();
    await controlled.resolveNext();
    expect(controlled.callCount()).toBe(3);
  });
});
