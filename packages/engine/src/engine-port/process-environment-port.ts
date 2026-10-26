/**
 * A folyamat környezeti változó port (SPEC-004 3.2 táblázat,
 * `processEnvironment` sor), kizárólag olvasásra. A `provider-environment`
 * téma a kötelező és a tiltott env változókat ezen a porton át dolgozza fel
 * (SPEC-004 12. szekció).
 *
 * A `readAll` a teljes környezetet adja `undefined` értékű bejegyzések nélkül:
 * a lépés kimenő `Options.env` objektuma erre épül (SPEC-012 3.1, 3.3), mert
 * megadott `env` mellett az alfolyamat környezete pontosan ez az objektum.
 */
export interface ProcessEnvironmentPort {
  read(name: string): string | null;
  readAll(): Readonly<Record<string, string>>;
}
