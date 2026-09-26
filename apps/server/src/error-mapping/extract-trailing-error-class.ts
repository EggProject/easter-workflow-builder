/**
 * A hibaosztály neve mindig a zárójelben, az üzenet VÉGÉN áll, egy opcionális
 * záró pont előtt (F-22, pl. `... (not_found).`). Az üzenet elején is
 * előfordulhat zárójel ("A(z) ..."), ezért a mintát a string VÉGÉHEZ
 * horgonyozzuk, nem az első találatot vesszük.
 */
const TRAILING_ERROR_CLASS_PATTERN = /\(([a-z0-9_]+)\)\.?\s*$/;

/**
 * Az `Outcome` hibaágának üzenetéből a záró zárójelben álló hibaosztály nevet
 * adja (SPEC-006 5.5); ha nincs ilyen, `undefined`. A szabad szövegben előforduló
 * hibaosztály nevet szándékosan nem ismeri fel.
 */
export function extractTrailingErrorClass(message: string): string | undefined {
  const match = TRAILING_ERROR_CLASS_PATTERN.exec(message);
  return match?.[1];
}
