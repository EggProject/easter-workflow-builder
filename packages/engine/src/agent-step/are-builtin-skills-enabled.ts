/**
 * A CLI beépített skilljeinek hatályos kapcsolója (SPEC-009 O-44, user döntés
 * 2026-11-04), a provider választás háromszintű mintája szerint: a
 * legalacsonyabb megadott szint nyer. A lépés értéke, ha nem `null` (a
 * hiányzó mező a régi gráf és pillanatkép alakja, jelentése a `null`);
 * különben a workflow értéke, ha nem `null`; különben a globális beállítás.
 */
export function areBuiltinSkillsEnabled(
  stepValue: boolean | null | undefined,
  workflowValue: boolean | null,
  isGloballyEnabled: boolean,
): boolean {
  return stepValue ?? workflowValue ?? isGloballyEnabled;
}
