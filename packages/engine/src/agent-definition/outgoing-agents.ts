/**
 * A kimenő `Options.agents` mező és a skill könyvtár igénye (SPEC-009 5.2,
 * 6.2, M-147): a `definitions` az agent definíciók kimenő alakja (a `skills`
 * minősítve, az MCP hivatkozások feloldva), a `hasSkillReferences` igaz, ha
 * legalább egy definíció nem `null` `skills` mezőt hordoz. Az utóbbi miatt a
 * lépés a `plugins` opciót a saját `skills: null` mezője mellett is kiadja,
 * mert az al-agent a skillt csak a lépés szintű `plugins` úton éri el (M-147
 * A3).
 *
 * A `definitions` a feloldott MCP env és fejléc **értékeket** hordozza, ezért
 * csak a kimenő `Options`-ba kerül (SPEC-009 6.4, AC19).
 */
export interface OutgoingAgents {
  readonly definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly hasSkillReferences: boolean;
}
