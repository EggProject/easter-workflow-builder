import { randomUUID } from 'node:crypto';
import type { IdGeneratorPort } from '@easter-workflow-builder/engine';

/**
 * Az azonosító generáló port valódi implementációja: a beépített
 * `node:crypto` `randomUUID` felett (SPEC-004 3.2 táblázat, `idGenerator`
 * sor).
 */
export function createRandomUuidIdGenerator(): IdGeneratorPort {
  return { nextId: () => randomUUID() };
}
