/**
 * Az azonosító generáló port (SPEC-004 3.2 táblázat, `idGenerator` sor).
 *
 * Miért port. Az azonosítók a `step_run` sorokban jelennek meg, tehát a
 * teszt elvárása csak akkor stabil, ha a generátor is befecskendezett
 * (SPEC-004 3.2, "Miért port a `clock` és az `idGenerator`").
 */
export interface IdGeneratorPort {
  nextId(): string;
}
