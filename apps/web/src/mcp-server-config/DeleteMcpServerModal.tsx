import { Alert, Button, Modal } from '@easter-workflow-builder/ui';
import { useEffect, type ReactElement } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

export interface DeleteMcpServerModalProperties {
  /**
   * A törlendő szerver neve; `undefined` esetén a modális zárva van.
   */
  readonly serverName: string | undefined;
  readonly onClose: () => void;
  readonly deleteServer: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A központi MCP szerver törlésének megerősítő modálisa (SPEC-009 6.2, O-43):
 * a meglévő `Modal`, a törlés végleges, és kimondja, mi vész el: a szerver
 * definíciója az alapértelmezett hozzárendeléssel. A törlés akkor is
 * megengedett, ha egy lépés vagy agent definíció hivatkozik a szerverre;
 * ilyenkor a hivatkozó workflow indítása hibával áll meg, ezt a szöveg
 * szintén kimondja. A REST hiba a modálisban, danger `Alert`.
 */
export function DeleteMcpServerModal(properties: Readonly<DeleteMcpServerModalProperties>): ReactElement {
  const { serverName, onClose, deleteServer } = properties;
  const request = useRequestState<undefined>();
  const { run, reset } = request;

  useEffect(() => {
    reset();
  }, [serverName, reset]);

  /**
   * A "Törlés" gomb csak akkor kerül a DOM-ba, ha `serverName !== undefined`
   * (a `Modal` `open` propján át), a kezelő a szűkítést a definiálásakor
   * végzi, hogy ne legyen típusilag sosem futó ág (`.claude/CLAUDE.md` 5.
   * szekció).
   */
  const handleDelete =
    serverName === undefined
      ? undefined
      : (): void => {
          void run(async () => {
            const outcome = await deleteServer(serverName);
            if (outcome.kind === 'ok') {
              onClose();
            }
            return outcome;
          });
        };

  const isDeleting = request.state.status === 'pending';

  return (
    <Modal
      open={serverName !== undefined}
      onClose={onClose}
      title="MCP szerver törlése"
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
        A(z) <strong>{serverName}</strong> MCP szerver definíciója az alapértelmezett hozzárendelésével véglegesen
        törlődik, a művelet nem vonható vissza.
      </p>
      <p>
        Ha egy lépés vagy agent definíció hivatkozik az MCP szerverre, a workflow indítása a törlés után hibával áll
        meg, amíg a hivatkozást nem javítod.
      </p>
      {request.state.status === 'failure' && <Alert variant="danger">{request.state.message}</Alert>}
    </Modal>
  );
}
