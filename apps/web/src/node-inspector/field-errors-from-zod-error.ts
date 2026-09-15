/**
 * A `NodeConfigSchema.safeParse` `error` mezőjének szűkített, drótszintű
 * `zod` típust NEM igénylő alakja - az `apps/web` nem importálhat közvetlenül
 * `zod`-ot, mert az a drótszintű validáció a `packages/protocol` kizárólagos
 * felelőssége (T-008-31, `greppable-invariants` (2) tétel). A `NodeInspector`
 * a `NodeConfigSchema.safeParse(...).error` értéket adja át, ami
 * strukturálisan illeszkedik erre a típusra, `as` típuskényszerítés nélkül.
 */
export interface ZodIssueLike {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export interface ZodErrorLike {
  readonly issues: readonly ZodIssueLike[];
}

/**
 * A `NodeConfigSchema.safeParse` hibáit mezőnkénti térképpé alakítja, hogy a
 * panel a hibás mező MELLETT tudja megjeleníteni a hibaüzenetet (SPEC-008
 * 5.4 "mezőnkénti hibajelzéssel"). Az útvonal pontokkal összefűzött alakja
 * (pl. `branches.0.key`) a kulcs; egy útvonalon több hiba esetén az ELSŐ
 * marad, hogy a mező egyszerre egy üzenetet mutasson.
 */
export function fieldErrorsFromZodError(error: ZodErrorLike): ReadonlyMap<string, string> {
  const errors = new Map<string, string>();
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.');
    if (!errors.has(path)) {
      errors.set(path, issue.message);
    }
  }
  return errors;
}
