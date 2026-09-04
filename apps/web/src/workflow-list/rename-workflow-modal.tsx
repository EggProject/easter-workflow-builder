import type { FetchFunction } from '@easter-workflow-builder/core';
import { WorkflowSummarySchema, type WorkflowSummary } from '@easter-workflow-builder/protocol';
import { Button, Modal, TextField } from '@easter-workflow-builder/ui';
import { useEffect, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import { requestRoute } from '../rest-client/request-route.ts';
import { useRequestState } from '../request-state/use-request-state.ts';

export interface RenameWorkflowModalProperties {
  readonly workflow: WorkflowSummary | undefined;
  readonly onClose: () => void;
  readonly onRenamed: (workflow: WorkflowSummary) => void;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
}

/**
 * Soronkénti "Átnevezés" modális (SPEC-007 10.1 3. sora): a név és a leírás
 * módosítása, provider mező nélkül. A `workflow` mező jelenléte nyitja a
 * modálist (nincs külön `open` prop, mert a tartalom a kiválasztott sortól
 * függ).
 */
export function RenameWorkflowModal(properties: Readonly<RenameWorkflowModalProperties>): ReactElement {
  const { workflow, onClose, onRenamed, apiOrigin, fetchFunction } = properties;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const submitState = useRequestState<WorkflowSummary>();

  useEffect(() => {
    if (workflow === undefined) {
      return;
    }
    setName(workflow.name);
    setDescription(workflow.description ?? '');
    submitState.reset();
  }, [workflow]);

  /**
   * A `<form>` csak akkor kerül a DOM-ba, ha `workflow !== undefined`
   * (a `Modal` `open` propján keresztül), tehát a submit kezelő csak akkor
   * hívódhat, ha `workflow` már ismert. A típusszűkítést emiatt itt, a
   * kezelő DEFINIÁLÁSAKOR végezzük el, nem a törzsében: egy belső
   * `workflow === undefined` ellenőrzés a törzsben típusilag garantáltan
   * sosem futna, amit a 100 százalékos lefedettségi küszöb tilt
   * (`.claude/CLAUDE.md` 5. szekció).
   */
  const handleSubmit =
    workflow === undefined
      ? undefined
      : (event: SubmitEvent<HTMLFormElement>): void => {
          event.preventDefault();
          void submitState.run(async () => {
            const outcome = await requestRoute({
              routeId: 'updateWorkflow',
              parameters: { workflowId: workflow.id },
              // eslint-disable-next-line unicorn/no-null -- az `updateWorkflow` protokoll séma a hiányzó leírást `null` értékkel írja le, nem `undefined`-nel (packages/protocol/src/workflow/workflow-record.ts).
              body: { name, description: description.trim() === '' ? null : description },
              responseSchema: WorkflowSummarySchema,
              fetchFunction,
              apiOrigin,
            });
            if (outcome.kind === 'ok') {
              onRenamed(outcome.value);
              onClose();
            }
            return outcome;
          });
        };

  const isSubmitting = submitState.state.status === 'pending';

  return (
    <Modal
      open={workflow !== undefined}
      onClose={onClose}
      title="Workflow átnevezése"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button type="submit" form="rename-workflow-form" disabled={isSubmitting || name.trim() === ''}>
            {isSubmitting ? 'Mentés...' : 'Mentés'}
          </Button>
        </>
      }
    >
      <form id="rename-workflow-form" onSubmit={handleSubmit}>
        <TextField
          label="Név"
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setName(event.target.value);
          }}
          required
        />
        <TextField
          label="Leírás"
          value={description}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setDescription(event.target.value);
          }}
        />
        {submitState.state.status === 'failure' && <p role="alert">{submitState.state.message}</p>}
      </form>
    </Modal>
  );
}
