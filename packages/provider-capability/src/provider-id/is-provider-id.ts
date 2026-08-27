import type { ProviderId } from './provider-id.ts';

/**
 * A két azonosító kulcsonként. A `Record<ProviderId, true>` annotáció miatt a
 * fordító hibát ad, ha a unió bővül, de ez a lista nem.
 */
const PROVIDER_ID_KEYS: Readonly<Record<ProviderId, true>> = {
  'claude-subscription': true,
  minimax: true,
};

/**
 * Typeguard a `ProviderId` unióra (SPEC-003 9.4 szekció). A guard a típusa
 * mellett él, mert minden fogyasztó (a `db` csomag workflow, futás és lépés
 * táblái) innen importálja a uniót is, és így nem keletkezik második
 * igazságforrás.
 *
 * Szándékosan nem használ `@easter-workflow-builder/typeguards` guardot: ennek
 * a csomagnak nincs futásidejű függősége, és egyetlen `typeof` vizsgálatért nem
 * érdemes bevezetni egyet.
 */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && Object.hasOwn(PROVIDER_ID_KEYS, value);
}
