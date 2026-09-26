import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { Alert, DrawerBody } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import './approval-prompt.css';

export interface ApprovalPromptBodyProperties {
  readonly approval: PendingApproval;
  /**
   * A cím és a szöveg azonosítója (`ApprovalPromptCard`): a döntés gombjainak
   * csoportja ezekre hivatkozik (`ApprovalDecisionActions`).
   */
  readonly titleId: string;
  readonly textId: string;
}

/**
 * A látott jóváhagyás görgethető törzse (SPEC-008 8. szekció 1. és 4. pont):
 * a design system `drawer` törzse (`DrawerBody`), benne elöl a
 * "visszavonhatatlan" `Alert`, utána a jóváhagyás teljes címe, szövege és
 * `payload` értéke. Ez az egyetlen része a jóváhagyásnak, ami a transcripttel
 * osztozik a húzható elválasztó területén (user döntés 2026-09-25, "transcript
 * felül, kérdés alul"): a transcript fölötte, a lapozó és a döntés gombjai
 * közvetlenül alatta, fix helyen állnak (`ApprovalPromptPanel`).
 *
 * **Nem régió.** A "Függő jóváhagyások" régió a lapozót és a gombokat fogja
 * össze (`ApprovalPromptPanel`), a törzs a húzható panelben áll, tehát a
 * kettő nem lehet egy DOM elem gyereke; egy második, azonos nevű régió a W3C
 * APG szerint tilos. A gombok csoportja a cím és a szöveg azonosítójával
 * kötődik a törzshöz.
 *
 * A hívó a jóváhagyás azonosítóját adja `key` értéknek, hogy lapozáskor a
 * törzs a tetejéről induljon, ne az előző jóváhagyás görgetési helyéről.
 */
export function ApprovalPromptBody(properties: Readonly<ApprovalPromptBodyProperties>): ReactElement {
  const { approval, titleId, textId } = properties;
  return (
    <div className="approval-prompt-body">
      <DrawerBody>
        <Alert variant="warning" title="A döntés visszavonhatatlan">
          Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.
        </Alert>
        <ApprovalPromptCard approval={approval} titleId={titleId} textId={textId} />
      </DrawerBody>
    </div>
  );
}
