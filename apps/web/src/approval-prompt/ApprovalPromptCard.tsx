import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { useId, type ReactElement } from 'react';
import './approval-prompt.css';

export interface ApprovalPromptCardProperties {
  readonly approval: PendingApproval;
}

/**
 * A formázott `payload` mező, a `run-event-row` téma meglévő JSON
 * megjelenítési mintája szerint (`run-event-row.css` `.run-event-row__payload`):
 * `<pre>` elem, két szóközös behúzással szerializálva.
 */
function FormattedPayload(properties: Readonly<{ payload: unknown }>): ReactElement {
  return <pre className="approval-prompt-card__payload">{JSON.stringify(properties.payload, undefined, 2)}</pre>;
}

/**
 * Egy függő jóváhagyás TARTALMA: a `title`, a `body` és a formázott
 * `payload` (SPEC-008 8. szekció, T-009-27, AC35). A döntés gombjai nem itt
 * állnak, hanem a panel tapadó akciósávjában, a görgethető törzs alatt
 * (`ApprovalDecisionActions`), hogy görgetés nélkül is elérhetők legyenek
 * (user döntés 2026-09-24 és 2026-09-25, SPEC-008 8. szekció 1. pont).
 */
export function ApprovalPromptCard(properties: Readonly<ApprovalPromptCardProperties>): ReactElement {
  const { approval } = properties;
  const titleId = useId();

  return (
    <article className="approval-prompt-card" aria-labelledby={titleId}>
      <h3 id={titleId} className="approval-prompt-card__title">
        {approval.title}
      </h3>
      <p className="approval-prompt-card__body">{approval.body}</p>
      <FormattedPayload payload={approval.payload} />
    </article>
  );
}
