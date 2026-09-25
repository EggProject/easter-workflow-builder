import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { Alert, DrawerBody } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import './approval-prompt.css';

export interface ApprovalPromptBodyProperties {
  readonly approval: PendingApproval;
}

/**
 * A látott jóváhagyás görgethető törzse (SPEC-008 8. szekció 1. és 4. pont):
 * a design system `drawer` törzse (`DrawerBody`), benne elöl a
 * "visszavonhatatlan" `Alert`, utána a jóváhagyás teljes címe, szövege és
 * `payload` értéke. Ez az egyetlen része a jóváhagyásnak, ami a transcripttel
 * osztozik a húzható elválasztó területén (user döntés 2026-09-25): a lapozó
 * fölötte (`ApprovalPromptPanel`), a döntés gombjai a transcript alatt
 * (`ApprovalDecisionActions`) fix helyen állnak.
 *
 * A hívó a jóváhagyás azonosítóját adja `key` értéknek, hogy lapozáskor a
 * törzs a tetejéről induljon, ne az előző jóváhagyás görgetési helyéről.
 */
export function ApprovalPromptBody(properties: Readonly<ApprovalPromptBodyProperties>): ReactElement {
  return (
    <section className="approval-prompt-body" aria-label="Függő jóváhagyások">
      <DrawerBody>
        <Alert variant="warning" title="A döntés visszavonhatatlan">
          Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.
        </Alert>
        <ApprovalPromptCard approval={properties.approval} />
      </DrawerBody>
    </section>
  );
}
