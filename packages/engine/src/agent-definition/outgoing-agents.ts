/**
 * A kimenő `Options.agents` mező (SPEC-009 5.2, 6.2, M-147): az agent
 * definíciók kimenő alakja (a `skills` minősítve, az MCP hivatkozások
 * feloldva).
 *
 * A `definitions` a feloldott MCP env és fejléc **értékeket** hordozza, ezért
 * csak a kimenő `Options`-ba kerül (SPEC-009 6.4, AC19).
 */
export interface OutgoingAgents {
  readonly definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
