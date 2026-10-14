import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';

/**
 * A `GraphElementIdGenerator` böngésző oldali megvalósítása (SPEC-008 5.8,
 * M-103): a Web Crypto API `randomUUID()` hívása, ami 36 karakteres v4 UUID-t
 * ad.
 */
export const browserGraphElementIdGenerator: GraphElementIdGenerator = () => crypto.randomUUID();
