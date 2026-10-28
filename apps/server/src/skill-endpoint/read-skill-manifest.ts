import { parseDocument } from 'yaml';
import type { Outcome } from '@easter-workflow-builder/core';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { skillUploadFailure } from './skill-upload-failure.ts';

// Az Agent Skills specifikáció és a platform doksi szerint a `description` legfeljebb 1024 karakter (SPEC-009 2.2, research 3.4).
const MAX_DESCRIPTION_LENGTH = 1024;
const FRONTMATTER_FENCE = '---';

/**
 * A `SKILL.md` fejlécéből olvasott, a listán megjelenő adat (SPEC-009 5.3).
 */
export interface SkillManifest {
  readonly description: string;
}

/**
 * A `SKILL.md` YAML frontmatterének ellenőrzése (SPEC-009 5.4 4. és 5. pont):
 * a fájl az első sorban `---` jellel nyit, a következő `---` sorig YAML
 * leképezés áll, a `description` nem üres szöveg, legfeljebb 1024 karakter
 * (UTF-16 kódegységben számolva: a forrás a
 * karakter fogalmát nem pontosítja, és ez a szigorúbb olvasat). A `name` elhagyható; ha meg van adva és
 * eltér a feltöltéskor megadott névtől, elutasítás mindkét névvel (O-37). A
 * tartalmat nem módosítja.
 */
export function readSkillManifest(content: string, skillName: string): Outcome<SkillManifest> {
  const lines = content.split(/\r?\n/u);
  const closingIndex = lines.indexOf(FRONTMATTER_FENCE, 1);
  if (closingIndex === -1 || lines[0] !== FRONTMATTER_FENCE) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md nem YAML frontmatterrel kezdődik');
  }

  const document = parseDocument(lines.slice(1, closingIndex).join('\n'));
  if (document.errors.length > 0) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md frontmattere nem olvasható YAML');
  }
  const frontmatter: unknown = document.toJS();
  if (!isRecord(frontmatter)) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md frontmattere nem kulcs-érték leképezés');
  }

  const description = frontmatter['description'];
  if (!isString(description)) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md description mezője hiányzik vagy nem szöveg');
  }
  if (description.trim().length === 0) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md description mezője üres');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return skillUploadFailure('skill_manifest_invalid', 'A SKILL.md description mezője 1024 karakternél hosszabb');
  }

  const name = frontmatter['name'];
  if (name !== undefined && name !== skillName) {
    return skillUploadFailure(
      'skill_name_mismatch',
      `A SKILL.md name mezője (${JSON.stringify(name)}) eltér a megadott névtől ("${skillName}")`,
    );
  }
  return { kind: 'ok', value: { description } };
}
