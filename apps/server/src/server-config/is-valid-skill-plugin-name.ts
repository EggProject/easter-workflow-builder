// A pinelt Agent SDK (`@anthropic-ai/claude-agent-sdk` 0.3.245, `sdk.mjs`) a `skills` lista minden
// elemét a `query()` hívásakor ellenőrzi, és ezekre dob: zárójel, vessző, C0 és C1 vezérlő karakter
// (`/[(),\u0000-\u001f\u007f-\u009f]/`), kezdő vagy záró szóköz (`e !== e.trim()`), üres név. A motor a
// lista elemeit `<plugin>:<név>` alakban adja (SPEC-009 5.3), a név a `SkillNameSchema` szabálya
// szerint csak kisbetű, szám és kötőjel, tehát a teljes elemet a plugin név dönti el. A páratlan
// helyettesítő pár ága (`isWellFormed`) itt nem kell: a `process.env` értéke UTF-8 dekódolású szöveg,
// amiben páratlan helyettesítő nem áll elő.
const SDK_FORBIDDEN_SKILL_NAME_CHARACTERS = /[(),\u{0}-\u{1F}\u{7F}-\u{9F}]/u;

/**
 * Igaz, ha a skill könyvtár gyökerének neve (a plugin neve, M-136 4a) a
 * kimenő `<plugin>:<név>` skill elemben átmegy az SDK névellenőrzésén
 * (M-136 5b: érvénytelen alakra a `query()` dob,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció 8.
 * pont). A szerver ezt induláskor ellenőrzi, hogy a hiba ne az első skillt
 * használó lépés futásakor jelenjen meg (SPEC-009 5.1).
 */
export function isValidSkillPluginName(name: string): boolean {
  return name.length > 0 && name.trimStart() === name && !SDK_FORBIDDEN_SKILL_NAME_CHARACTERS.test(name);
}
