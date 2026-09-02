import type { FetchFunction } from '@easter-workflow-builder/core';
import { DeletionSummarySchema, type DeletionSummary, type WorkflowSummary } from '@easter-workflow-builder/protocol';
import { Button, Checkbox, Modal, Skeleton } from '@easter-workflow-builder/ui';
import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';

export interface DeleteWorkflowModalProperties {
  readonly workflow: WorkflowSummary | undefined;
  readonly onClose: () => void;
  readonly onDeleted: (workflowId: string) => void;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
}

/**
 * Soronkénti "Törlés" modális (SPEC-007 10.1 4. sora): előbb az előzetes
 * összefoglaló (`GET .../deletion-summary`) tölt be, `Skeleton` jelzéssel
 * (11. szekció 7. async pont), majd a törlés csak a jelölőnégyzet
 * bepipálása után küldhető el, a `DELETE` törzse a kötelező
 * `acknowledgeIrreversible: true` literállal (SPEC-007 10.1).
 */
export function DeleteWorkflowModal(properties: Readonly<DeleteWorkflowModalProperties>): ReactElement {
  const { workflow, onClose, onDeleted, apiOrigin, fetchFunction } = properties;

  const [acknowledged, setAcknowledged] = useState(false);
  const summaryState = useRequestState<DeletionSummary>();
  const submitState = useRequestState<DeletionSummary>();

  useEffect(() => {
    if (workflow === undefined) {
      return;
    }
    setAcknowledged(false);
    submitState.reset();
    void summaryState.run(() =>
      requestRouteWithoutBody({
        routeId: 'summarizeWorkflowDeletion',
        parameters: { workflowId: workflow.id },
        responseSchema: DeletionSummarySchema,
        fetchFunction,
        apiOrigin,
      }),
    );
  }, [workflow, apiOrigin, fetchFunction]);

  /**
   * A "Törlés" gomb csak akkor kerül a DOM-ba, ha `workflow !== undefined`
   * (a `Modal` `open` propján keresztül), tehát a kezelő csak akkor
   * hívódhat, ha `workflow` már ismert. A típusszűkítést emiatt itt, a
   * kezelő DEFINIÁLÁSAKOR végezzük el, nem a törzsében: egy belső
   * `workflow === undefined` ellenőrzés a törzsben típusilag garantáltan
   * sosem futna, amit a 100 százalékos lefedettségi küszöb tilt
   * (`.claude/CLAUDE.md` 5. szekció).
   */
  const handleDelete =
    workflow === undefined
      ? undefined
      : (): void => {
          void submitState.run(async () => {
            const outcome = await requestRoute({
              routeId: 'deleteWorkflow',
              parameters: { workflowId: workflow.id },
              body: { acknowledgeIrreversible: true },
              responseSchema: DeletionSummarySchema,
              fetchFunction,
              apiOrigin,
            });
            if (outcome.kind === 'ok') {
              onDeleted(workflow.id);
              onClose();
            }
            return outcome;
          });
        };

  const isSummaryLoading = summaryState.state.status === 'pending' || summaryState.state.status === 'idle';
  const isSubmitting = submitState.state.status === 'pending';
  const canDelete = acknowledged && summaryState.state.status === 'success' && !isSubmitting;

  return (
    <Modal
      open={workflow !== undefined}
      onClose={onClose}
      title="Workflow törlése"
      iconVariant="danger"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={!canDelete}>
            {isSubmitting ? 'Törlés...' : 'Törlés'}
          </Button>
        </>
      }
    >
      {isSummaryLoading && <Skeleton shape="text" lines={3} />}
      {summaryState.state.status === 'success' && (
        <div>
          <p>A törlés véglegesen elviszi:</p>
          <ul>
            <li>{summaryState.state.value.runCount} futást</li>
            <li>{summaryState.state.value.eventCount} eseményt</li>
            <li>{summaryState.state.value.snapshotCount} gráf pillanatképet</li>
          </ul>
          <Checkbox
            label="Tudomásul veszem, hogy a törlés nem vonható vissza"
            checked={acknowledged}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setAcknowledged(event.target.checked);
            }}
          />
        </div>
      )}
      {summaryState.state.status === 'failure' && <p role="alert">{summaryState.state.message}</p>}
      {submitState.state.status === 'failure' && <p role="alert">{submitState.state.message}</p>}
    </Modal>
  );
}
