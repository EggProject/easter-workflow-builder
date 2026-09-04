import type { StreamIdGenerator } from './stream-id-generator.ts';

/**
 * A `StreamIdGenerator` böngésző oldali megvalósítása (SPEC-007 9.3 1.
 * pont): a Web Crypto API `randomUUID()` hívása.
 */
export const browserStreamIdGenerator: StreamIdGenerator = () => crypto.randomUUID();
