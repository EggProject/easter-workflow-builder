import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  ProviderSummarySchema,
  WorkflowSummarySchema,
  type ProviderSummary,
  type WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import { Alert, Button, Modal, TextField } from '@easter-workflow-builder/ui';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import { createProviderConnectionTester } from '../provider-select/create-provider-connection-tester.ts';
import { describeRequiredEnvironment } from '../provider-select/describe-required-environment.ts';
import { ProviderSelect } from '../provider-select/ProviderSelect.tsx';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';

export interface EditWorkflowModalProperties {
  readonly workflow: WorkflowSummary | undefined;
  readonly onClose: () => void;
  readonly onEdited: (workflow: WorkflowSummary) => void;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
}

/**
 * Soronkénti "Workflow szerkesztése" modális (SPEC-009 3.3, O-3; a SPEC-007
 * 10.1 3. sorának átnevezés modálisa bővült): a név, a leírás és a provider
 * módosítása. A provider választó a `ProviderSelect` a "Kapcsolat teszt"
 * gombbal, a létrehozó modális mintáját követve; az "Nincs megadva" opció az
 * "örökölt" választás, amit a `PATCH` törzse `providerId: null` értékkel
 * küld (AC8). A `workflow` mező jelenléte nyitja a modálist (nincs külön
 * `open` prop, mert a tartalom a kiválasztott sortól függ).
 */
export function EditWorkflowModal(properties: Readonly<EditWorkflowModalProperties>): ReactElement {
  const { workflow, onClose, onEdited, apiOrigin, fetchFunction } = properties;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [providerId, setProviderId] = useState('');
  const providersState = useRequestState<readonly ProviderSummary[]>();
  const submitState = useRequestState<WorkflowSummary>();

  useEffect(() => {
    if (workflow === undefined) {
      return;
    }
    setName(workflow.name);
    setDescription(workflow.description ?? '');
    setProviderId(workflow.providerId ?? '');
    submitState.reset();
    void providersState.run(() =>
      requestRouteWithoutBody({
        routeId: 'listProviders',
        responseSchema: arraySchema(ProviderSummarySchema),
        fetchFunction,
        apiOrigin,
      }),
    );
  }, [workflow, apiOrigin, fetchFunction]);

  const testConnection = useMemo(
    () => createProviderConnectionTester(apiOrigin, fetchFunction),
    [apiOrigin, fetchFunction],
  );

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
              body: {
                name,
                // eslint-disable-next-line unicorn/no-null -- az `updateWorkflow` protokoll séma a hiányzó leírást/providert `null` értékkel írja le, nem `undefined`-nel (packages/protocol/src/workflow/workflow-record.ts).
                description: description.trim() === '' ? null : description,
                // eslint-disable-next-line unicorn/no-null -- lásd fent.
                providerId: providerId === '' ? null : providerId,
              },
              responseSchema: WorkflowSummarySchema,
              fetchFunction,
              apiOrigin,
            });
            if (outcome.kind === 'ok') {
              onEdited(outcome.value);
              onClose();
            }
            return outcome;
          });
        };

  const isSubmitting = submitState.state.status === 'pending';
  const isProvidersLoading = providersState.state.status === 'pending';
  const loadedProviders = providersState.state.status === 'success' ? providersState.state.value : [];
  const selectedProvider = loadedProviders.find((provider) => provider.id === providerId);

  return (
    <Modal
      open={workflow !== undefined}
      onClose={onClose}
      title="Workflow szerkesztése"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button type="submit" form="edit-workflow-form" disabled={isSubmitting || name.trim() === ''}>
            {isSubmitting ? 'Mentés...' : 'Mentés'}
          </Button>
        </>
      }
    >
      <form id="edit-workflow-form" onSubmit={handleSubmit}>
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
        <ProviderSelect
          label="Provider"
          providers={loadedProviders}
          emptyOptionLabel="Nincs megadva"
          placeholder="Nincs megadva"
          loading={isProvidersLoading}
          loadingLabel="betöltés"
          value={providerId}
          testConnection={testConnection}
          onChange={(nextProviderId) => {
            setProviderId(nextProviderId);
          }}
        />
        {selectedProvider !== undefined && (
          // A `ProviderSummary` env változó NEVET hordoz, értéket soha
          // (SPEC-005 4.2 D, `.claude/CLAUDE.md` 9.), és a felület is
          // kizárólag a nevet írja ki: a mondatot a `describeRequiredEnvironment` adja.
          <p>{describeRequiredEnvironment(selectedProvider.requiredEnvNames)}</p>
        )}
      </form>
      {/* A REST hiba a design system `danger` `Alert` blokkja, a `<form>`
          elemen kívül, a modális törzs közvetlen gyerekeként, hogy a forrás
          `.modal__body > * + *` térköze elválassza a mezőktől (SPEC-007
          8.4, user döntés 2026-09-24). */}
      {providersState.state.status === 'failure' && <Alert variant="danger">{providersState.state.message}</Alert>}
      {submitState.state.status === 'failure' && <Alert variant="danger">{submitState.state.message}</Alert>}
    </Modal>
  );
}
