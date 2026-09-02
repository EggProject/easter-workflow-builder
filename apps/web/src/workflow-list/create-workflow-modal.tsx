import type { FetchFunction } from '@easter-workflow-builder/core';
import { ProviderSummarySchema, WorkflowSummarySchema, type WorkflowSummary } from '@easter-workflow-builder/protocol';
import { Button, Modal, SelectField, TextField } from '@easter-workflow-builder/ui';
import { useEffect, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';

export interface CreateWorkflowModalProperties {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (workflow: WorkflowSummary) => void;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
}

/**
 * "Új workflow" modális (SPEC-007 10.1 2. sora). A provider választó a
 * `GET /api/providers` válaszából épül, betöltés közben letiltva
 * (11. szekció 4. async pont); a küldés alatt a gomb letiltva, felirata jelzi
 * a folyamatot (11. szekció 5. async pont).
 */
export function CreateWorkflowModal(properties: Readonly<CreateWorkflowModalProperties>): ReactElement {
  const { open, onClose, onCreated, apiOrigin, fetchFunction } = properties;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [providerId, setProviderId] = useState('');

  const providersState = useRequestState<readonly { readonly id: string; readonly displayName: string }[]>();
  const submitState = useRequestState<WorkflowSummary>();

  useEffect(() => {
    if (!open) {
      return;
    }
    setName('');
    setDescription('');
    setProviderId('');
    submitState.reset();
    void providersState.run(() =>
      requestRouteWithoutBody({
        routeId: 'listProviders',
        responseSchema: arraySchema(ProviderSummarySchema),
        fetchFunction,
        apiOrigin,
      }),
    );
  }, [open, apiOrigin, fetchFunction]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitState.run(async () => {
      const outcome = await requestRoute({
        routeId: 'createWorkflow',
        body: {
          name,
          // eslint-disable-next-line unicorn/no-null -- a `createWorkflow` protokoll séma a hiányzó leírást/providert `null` értékkel írja le, nem `undefined`-nel (packages/protocol/src/workflow/workflow-record.ts).
          description: description.trim() === '' ? null : description,
          // eslint-disable-next-line unicorn/no-null -- lásd fent.
          providerId: providerId === '' ? null : providerId,
        },
        responseSchema: WorkflowSummarySchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        onCreated(outcome.value);
        onClose();
      }
      return outcome;
    });
  }

  const isSubmitting = submitState.state.status === 'pending';
  const isProvidersLoading = providersState.state.status === 'pending';
  const providerOptions =
    providersState.state.status === 'success'
      ? providersState.state.value.map((provider) => ({ value: provider.id, label: provider.displayName }))
      : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Új workflow"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button type="submit" form="create-workflow-form" disabled={isSubmitting || name.trim() === ''}>
            {isSubmitting ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </>
      }
    >
      <form id="create-workflow-form" onSubmit={handleSubmit}>
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
        <SelectField
          aria-label="Provider"
          options={providerOptions}
          placeholder="Nincs megadva"
          loading={isProvidersLoading}
          loadingLabel="betöltés"
          value={providerId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setProviderId(event.target.value);
          }}
        />
        {submitState.state.status === 'failure' && <p role="alert">{submitState.state.message}</p>}
      </form>
    </Modal>
  );
}
