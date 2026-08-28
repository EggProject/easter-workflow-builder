/**
 * A folyamat környezeti változó port (SPEC-004 3.2 táblázat,
 * `processEnvironment` sor), kizárólag olvasásra. A `provider-environment`
 * téma a kötelező és a tiltott env változókat ezen a porton át dolgozza fel
 * (SPEC-004 12. szekció).
 */
export interface ProcessEnvironmentPort {
  read(name: string): string | null;
}
