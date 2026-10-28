import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { Button, formatBytes } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';

export interface SkillRowProperties {
  readonly skill: SkillSummary;
  readonly onDelete: (skill: SkillSummary) => void;
}

/**
 * Egy feltöltött skill sora a "Skill könyvtár" kártyán (SPEC-009 5.1, 5.3): a
 * név, a `SKILL.md` frontmatteréből jövő leírás (kívülről elrontott
 * könyvtárnál üres, ilyenkor saját mondat áll helyette), a fájlok összmérete
 * és a módosítás ideje, valamint a "Törlés" gomb, ami a megerősítő modálist
 * nyitja. A sor a design system `preference-row` mintája.
 */
export function SkillRow(properties: Readonly<SkillRowProperties>): ReactElement {
  const { skill, onDelete } = properties;
  const titleId = useId();

  return (
    <div className="preference-row skill-row" role="group" aria-labelledby={titleId}>
      <div className="preference-row__body">
        <span className="preference-row__title" id={titleId}>
          {skill.name}
        </span>
        <span className="settings-screen__hint">{skill.description === '' ? 'Nincs leírás.' : skill.description}</span>
        <span className="settings-screen__hint">
          {`${formatBytes(skill.sizeBytes)} · Módosítva: ${new Date(skill.modifiedAtMs).toLocaleString('hu-HU')}`}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-label={`Törlés: ${skill.name}`}
        onClick={() => {
          onDelete(skill);
        }}
      >
        Törlés
      </Button>
    </div>
  );
}
