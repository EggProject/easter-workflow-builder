import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { Button, Modal } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';

export interface OverwriteSkillModalProperties {
  /**
   * A felülírandó, már feltöltött skill; `undefined` esetén a modális zárva
   * van.
   */
  readonly skill: SkillSummary | undefined;
  /**
   * A felülírás elindítása; `undefined`, amíg nincs mit felülírni (a modális
   * ilyenkor zárva van).
   */
  readonly onConfirm: (() => void) | undefined;
  readonly onCancel: () => void;
}

/**
 * Az azonos nevű skill felülírásának megerősítő modálisa (SPEC-009 5.1,
 * O-16): a meglévő `Modal`, kimondja, mi vész el: a régi skill teljes
 * tartalma. Hiba esetén a régi skill érintetlen marad (SPEC-009 5.4 9.
 * pont), ezt a szöveg is mondja. A feltöltést és annak hibáját a kártya
 * űrlapja vezeti, a modális csak a döntést kéri.
 */
export function OverwriteSkillModal(properties: Readonly<OverwriteSkillModalProperties>): ReactElement {
  const { skill, onConfirm, onCancel } = properties;

  return (
    <Modal
      open={skill !== undefined}
      onClose={onCancel}
      title="Skill felülírása"
      iconVariant="warning"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Mégse
          </Button>
          <Button type="button" onClick={onConfirm}>
            Felülírás
          </Button>
        </>
      }
    >
      <p>
        Már van <strong>{skill?.name}</strong> nevű skill. A feltöltés a régi skill teljes tartalmát lecseréli, a régi
        fájlok elvesznek.
      </p>
      <p>Ha a feltöltés hibával elutasítódik, a régi skill érintetlen marad.</p>
    </Modal>
  );
}
