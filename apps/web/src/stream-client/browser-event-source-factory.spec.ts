import { afterEach, describe, expect, it } from 'vitest';
import { browserEventSourceFactory } from './browser-event-source-factory.ts';

/**
 * A pinelt happy-dom nem implementálja az `EventSource` API-t (SPEC-007
 * M-24), ezért a teszt a `globalThis` objektumra tesz egy dupla, hamis
 * konstruktort, hogy az egyetlen `new EventSource(` hívás happy-dom
 * támogatás nélkül is 100 százalékosan lefedett legyen. Az elkapott URL-t
 * egy objektum mezőjén tárolja, nem felső szintű változó újrakötésével
 * (`unicorn/no-top-level-assignment-in-function`).
 */
const captured: { url: string | undefined } = { url: undefined };

class FakeEventSource {
  readonly readyState = 0;

  constructor(url: string) {
    captured.url = url;
  }

  addEventListener(): void {
    // a teszt nem iratkozik fel keretre, csak a konstruktor hívást igazolja
  }

  close(): void {
    // a teszt nem zár kapcsolatot
  }
}

describe('browserEventSourceFactory', () => {
  // eslint-disable-next-line unicorn/no-unnecessary-global-this -- a bare `EventSource` azonosító ReferenceError-t dobna, mert happy-dom-ban nem létező globális (M-24); a `globalThis.` biztonságos, sosem dobó tulajdonság-elérés.
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    Object.assign(globalThis, { EventSource: originalEventSource });
    captured.url = undefined;
  });

  it('a globalThis.EventSource konstruktort hívja meg az adott URL-lel, opció objektum nélkül', () => {
    Object.assign(globalThis, { EventSource: FakeEventSource });

    const source = browserEventSourceFactory('https://api.example.test/events?streamId=s1');

    expect(captured.url).toBe('https://api.example.test/events?streamId=s1');
    expect(source).toBeInstanceOf(FakeEventSource);
  });
});
