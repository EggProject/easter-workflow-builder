import { describe, expect, it } from 'vitest';
import { createSkillNameLock } from './skill-name-lock.ts';

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  const handle = { resolve: (): void => undefined };
  const promise = new Promise<void>((resolve) => {
    handle.resolve = resolve;
  });
  return {
    promise,
    resolve: () => {
      handle.resolve();
    },
  };
}

describe('createSkillNameLock', () => {
  it('ugyanarra a névre a feladatok egymás után futnak, az eredményt a saját hívó kapja', async () => {
    const lock = createSkillNameLock();
    const order: string[] = [];
    const gate = deferred();
    const first = lock.run('jelentes', async () => {
      order.push('első indul');
      await gate.promise;
      order.push('első vége');
      return 1;
    });
    const second = lock.run('jelentes', () => {
      order.push('második indul');
      return Promise.resolve(2);
    });
    await Promise.resolve();
    expect(order).toStrictEqual(['első indul']);
    gate.resolve();
    expect(await Promise.all([first, second])).toStrictEqual([1, 2]);
    expect(order).toStrictEqual(['első indul', 'első vége', 'második indul']);
  });

  it('egy elutasított feladat a hívójánál bukik, a lánc a következővel folytatódik', async () => {
    const lock = createSkillNameLock();
    const failing = lock.run('jelentes', () => Promise.reject(new Error('hiba')));
    const next = lock.run('jelentes', () => Promise.resolve('kész'));
    await expect(failing).rejects.toThrow('hiba');
    expect(await next).toBe('kész');
  });

  it('különböző nevekre a feladatok nem várnak egymásra', async () => {
    const lock = createSkillNameLock();
    const gate = deferred();
    const blocked = lock.run('jelentes', () => gate.promise);
    expect(await lock.run('docx', () => Promise.resolve('szabad'))).toBe('szabad');
    gate.resolve();
    await blocked;
  });

  it('a lánc kiürülése után ugyanaz a név újra azonnal fut', async () => {
    const lock = createSkillNameLock();
    await lock.run('jelentes', () => Promise.resolve(undefined));
    await Promise.resolve();
    expect(await lock.run('jelentes', () => Promise.resolve('újra'))).toBe('újra');
  });
});
