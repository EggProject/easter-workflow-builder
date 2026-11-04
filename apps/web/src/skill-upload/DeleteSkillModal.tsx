import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { Alert, Button, Modal } from '@easter-workflow-builder/ui';
import { useEffect, type ReactElement } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

export interface DeleteSkillModalProperties {
  /**
   * A törlendő skill; `undefined` esetén a modális zárva van.
   */
  readonly skill: SkillSummary | undefined;
  readonly onClose: () => void;
  readonly deleteSkill: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A skill törlésének megerősítő modálisa (SPEC-009 5.1, O-13, O-16): a
 * meglévő `Modal`, a törlés végleges, és kimondja, mi vész el: a skill
 * könyvtára minden fájljával. A törlés akkor is megengedett, ha egy lépés
 * hivatkozik a skillre; ilyenkor a futás indítása hibával áll meg, ezt a
 * szöveg szintén kimondja. A REST hiba a modálisban, danger `Alert`.
 */
export function DeleteSkillModal(properties: Readonly<DeleteSkillModalProperties>): ReactElement {
  const { skill, onClose, deleteSkill } = properties;
  const request = useRequestState<undefined>();
  const { run, reset } = request;

  useEffect(() => {
    reset();
  }, [skill, reset]);

  /**
   * A "Törlés" gomb csak akkor kerül a DOM-ba, ha `skill !== undefined` (a
   * `Modal` `open` propján át), a kezelő a szűkítést a definiálásakor végzi,
   * hogy ne legyen típusilag sosem futó ág (`.claude/CLAUDE.md` 5. szekció).
   */
  const handleDelete =
    skill === undefined
      ? undefined
      : (): void => {
          void run(async () => {
            const outcome = await deleteSkill(skill.name);
            if (outcome.kind === 'ok') {
              onClose();
            }
            return outcome;
          });
        };

  const isDeleting = request.state.status === 'pending';

  return (
    <Modal
      open={skill !== undefined}
      onClose={onClose}
      title="Skill törlése"
      iconVariant="danger"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>
            Mégse
          </Button>
          <Button type="button" variant="danger" isLoading={isDeleting} disabled={isDeleting} onClick={handleDelete}>
            Törlés
          </Button>
        </>
      }
    >
      <p>
        A(z) <strong>{skill?.name}</strong> skill könyvtára minden fájljával véglegesen törlődik, a művelet nem vonható
        vissza.
      </p>
      <p>
        Ha egy lépés vagy agent definíció hivatkozik a skillre, a törlés után a workflow futása hibával nem indul el,
        amíg a hivatkozást nem javítod.
      </p>
      {request.state.status === 'failure' && <Alert variant="danger">{request.state.message}</Alert>}
    </Modal>
  );
}
