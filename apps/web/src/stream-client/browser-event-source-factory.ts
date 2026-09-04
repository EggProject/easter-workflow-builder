import type { EventSourceFactory } from './event-source-like.ts';

/**
 * Az `EventSourceFactory` böngésző oldali megvalósítása (SPEC-007 9.1): az
 * egyetlen `new EventSource(` hívás az `apps/web/src` alatt (16. szekció 41.
 * kritérium). Opció objektum nélkül hívódik, mert a `withCredentials`
 * dokumentált alapértéke `false` (M-16), amit a SPEC-005 3.5 kimond.
 */
export const browserEventSourceFactory: EventSourceFactory = (url) => new EventSource(url);
