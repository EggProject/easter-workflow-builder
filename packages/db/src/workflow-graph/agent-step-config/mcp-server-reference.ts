/**
 * A lépés hivatkozása egy központi MCP szerver definícióra (SPEC-009 6.2,
 * O-42 (b)): az `AgentStepConfig.mcpServerReferences` rekord értéke, a kulcs
 * a központi definíció neve. Kizárólag neveket hordoz, értéket soha.
 *
 * A két mező a lépés felülírása a 6.4 feloldási sorrend első szintjén; a
 * definíció típusa dönti el, melyik hat:
 *
 * - `envBindings`: a `stdio` ágon deklarált név -> szerver oldali név. Egy
 *   hiányzó bejegyzés nem felülírás (a központi alapértelmezés, végül a
 *   deklarált név marad), egy nem deklarált névre szóló bejegyzés hatástalan.
 * - `authEnvName`: a `sse` és a `http` ágon az `Authorization` fejléc értékét
 *   adó szerver oldali változó neve; `null` = nincs felülírás, a központi
 *   definíció `authEnvName` mezője dönt.
 *
 * A másik ág mezője a definíció típusán hatástalan, így egy utólag típust
 * váltó definíció mellett is olvasható marad a hivatkozás.
 */
export interface McpServerReference {
  readonly envBindings: Readonly<Record<string, string>>;
  readonly authEnvName: string | null;
}
