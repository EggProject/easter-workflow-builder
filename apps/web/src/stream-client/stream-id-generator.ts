/**
 * A `streamId` generáló port (SPEC-007 9.3 1. pont): fülönként egy értéket
 * ad, hogy a teszt determinisztikus legyen. A böngésző oldali megvalósítás a
 * `crypto.randomUUID()` hívás.
 */
export type StreamIdGenerator = () => string;
