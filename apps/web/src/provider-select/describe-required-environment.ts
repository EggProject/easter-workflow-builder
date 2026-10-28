/**
 * A kiválasztott provider kötelező env változóinak mondata (SPEC-009 3.1,
 * SPEC-007 10.1, 16. szekció 49. kritérium): kizárólag a NEVET írja ki,
 * értéket soha, hogy a felhasználó lássa, melyik változót kell beállítania a
 * szerver környezetében. Egy követelmény több elfogadott neve " vagy "
 * kötőszóval áll (SPEC-013 4.8).
 */
export function describeRequiredEnvironment(requiredEnvironmentNames: readonly (readonly string[])[]): string {
  return requiredEnvironmentNames.length === 0
    ? 'Ehhez a providerhez nem kell környezeti változó.'
    : `Szükséges környezeti változók: ${requiredEnvironmentNames.map((names) => names.join(' vagy ')).join(', ')}`;
}
