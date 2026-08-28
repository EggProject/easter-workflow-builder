/**
 * Az óra port (SPEC-004 3.2 táblázat, `clock` sor). Minden időbélyeg és
 * várakozás (a `human_approval` időkorlátja, az `error_handler` node
 * `backoffMs` listája) ezen a porton megy át.
 *
 * Miért port. Az ütemező determinisztikus tesztelhetősége ezen áll: a
 * backoff várakozás, a jóváhagyás időkorlátja és minden időbélyeg a `clock`
 * porton megy át, tehát a teszt valós idő nélkül léptet (SPEC-004 3.2, "Miért
 * port a `clock` és az `idGenerator`").
 */
export interface ClockPort {
  nowMs(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}
