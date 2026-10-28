import type { SkillSummary } from '@easter-workflow-builder/protocol';

/**
 * A feltöltött skillt a listába illeszti: az azonos nevű sort lecseréli, a
 * többit megtartja, az eredmény név szerint rendezett (UTF-16 kódegység
 * sorrend; a skill név kisbetű, szám és kötőjel, tehát a szerver
 * sorrendjével egyezik). Új tömböt ad, a bemenetet nem módosítja.
 */
export function mergeSkill(skills: readonly SkillSummary[], uploaded: SkillSummary): readonly SkillSummary[] {
  return [...skills.filter((skill) => skill.name !== uploaded.name), uploaded].toSorted(
    (first, second) => Number(first.name > second.name) - Number(first.name < second.name),
  );
}
