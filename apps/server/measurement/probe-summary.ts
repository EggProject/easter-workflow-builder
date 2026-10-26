/**
 * A próba kimenete (SPEC-012 5.1 4. lépés): kizárólag összegzés. A kimeneti
 * szöveg maga nem szerepel, csak a hossza; a hibaosztály csak hiba esetén.
 */
export interface ProbeSummary {
  readonly providerId: string;
  readonly runStatus: string;
  readonly stepStatus: string | undefined;
  readonly resultSubtype: string | undefined;
  readonly numTurns: number | undefined;
  readonly outputTextLength: number | undefined;
  readonly errorClass: string | undefined;
}
