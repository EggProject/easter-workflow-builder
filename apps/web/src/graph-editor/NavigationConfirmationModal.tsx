import { Button, Modal } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';

export interface NavigationConfirmationModalProperties {
  /**
   * "Kilépés mentés nélkül": a navigáció végrehajtása, a változások elvesznek.
   */
  readonly onLeave: () => void;
  /**
   * "Mégse": a szerkesztő marad, a változások megmaradnak. A fejléc bezárás
   * gombja és az `Escape` is ezt hívja.
   */
  readonly onCancel: () => void;
}

/**
 * Az elnavigálás megerősítő modálisa mentetlen változásnál (SPEC-008 5.10, 1.
 * pont), a workflow törlés megerősítésének mintájára (`delete-workflow-modal.tsx`):
 * két gomb a lábban, a "Mégse" elöl. Modálisban a gombok nem `sm` méretűek
 * (`.claude/CLAUDE.md` 11. szekció). A cím és a törzs szövege user döntés
 * (2026-10-17, SPEC-008 5.10). A hívó csak a megerősítésre váró navigáció
 * idejére rajzolja, tehát a modális mindig nyitva áll.
 */
export function NavigationConfirmationModal(properties: Readonly<NavigationConfirmationModalProperties>): ReactElement {
  const { onLeave, onCancel } = properties;
  return (
    <Modal
      open
      onClose={onCancel}
      title="Kilépés mentés nélkül?"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Mégse
          </Button>
          <Button type="button" variant="danger" onClick={onLeave}>
            Kilépés mentés nélkül
          </Button>
        </>
      }
    >
      <p>A mentetlen változtatások elvesznek.</p>
    </Modal>
  );
}
