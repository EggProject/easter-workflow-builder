/**
 * A `join` és a hozzá tartozó `fan_out` node párosítása (SPEC-004 4.5): "A
 * `fan_out` node config nem tartalmaz `joinNodeId` mezőt, és a jelen spec nem
 * vezet be ilyet: a párosítás szerkezetből derül ki."
 *
 * A `joinToFanOut` térkép kulcsa a `join`, értéke annak a `fan_out` node-nak az
 * azonosítója, aminek a hatóköre a `join`-ig nyitva maradt. A párosítás a
 * hatókör kiegyensúlyozottság bejárásának mellékterméke: amikor a bejárás a
 * `join` node-nál leveszi a verem tetejét, a levett keret `originNodeId` mezője
 * **maga mondja meg** a párt, külön keresés nélkül.
 *
 * A térképet a `scheduling` téma használja majd, amikor a `join` bemeneteinek
 * várt darabszámát a `fan_out` elemszámából kell megállapítania
 * (PLAN-005 T-005-17).
 */
export interface FanOutJoinPairing {
  readonly joinToFanOut: ReadonlyMap<string, string>;
}
