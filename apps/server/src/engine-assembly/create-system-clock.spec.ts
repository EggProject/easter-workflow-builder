import { describe, expect, it } from 'vitest';
import { createSystemClock } from './create-system-clock.ts';

describe('createSystemClock', () => {
  it('a nowMs a Date.now() közelébe eső egész milliszekundumot ad', () => {
    const clock = createSystemClock();
    const before = Date.now();
    const value = clock.nowMs();
    const after = Date.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });

  it('a sleep a megadott idő után feloldódik', async () => {
    const clock = createSystemClock();
    const controller = new AbortController();
    await expect(clock.sleep(1, controller.signal)).resolves.toBeUndefined();
  });

  it('a sleep a signal megszakítására elutasítja a Promise-t', async () => {
    const clock = createSystemClock();
    const controller = new AbortController();
    const sleeping = clock.sleep(50, controller.signal);
    controller.abort(new Error('megszakítva'));
    await expect(sleeping).rejects.toThrow('megszakítva');
  });

  it('már megszakított signal esetén azonnal elutasítja a Promise-t', async () => {
    const clock = createSystemClock();
    const controller = new AbortController();
    controller.abort(new Error('már megszakítva'));
    await expect(clock.sleep(50, controller.signal)).rejects.toThrow('már megszakítva');
  });

  it('nem Error típusú megszakítási okot Error példánnyá alakítva utasít el', async () => {
    const clock = createSystemClock();
    const controller = new AbortController();
    controller.abort('nem Error ok');
    await expect(clock.sleep(50, controller.signal)).rejects.toThrow('nem Error ok');
  });
});
