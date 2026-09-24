import type { ApprovalDecision, PendingApproval } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';
import './approval-prompt.css';

export interface ApprovalPromptCardProperties {
  readonly approval: PendingApproval;
  /**
   * Az erre a jóváhagyásra elküldött döntés állapota, `undefined`, ha még
   * nem ment döntés (`reduce-approval-decisions.ts`).
   */
  readonly progress: ApprovalDecisionProgress | undefined;
  readonly onDecide: (decision: ApprovalDecision) => void;
  /**
   * A lezárt döntés eredményének nyugtázása ("Rendben" gomb).
   */
  readonly onDismiss: () => void;
}

const DECISION_LABELS: Readonly<Record<ApprovalDecision, string>> = {
  approved: 'jóváhagyva',
  rejected: 'elutasítva',
};

/**
 * A formázott `payload` mező, a `run-event-row` téma meglévő JSON
 * megjelenítési mintája szerint (`run-event-row.css` `.run-event-row__payload`):
 * `<pre>` elem, két szóközös behúzással szerializálva.
 */
function FormattedPayload(properties: Readonly<{ payload: unknown }>): ReactElement {
  return <pre className="approval-prompt-card__payload">{JSON.stringify(properties.payload, undefined, 2)}</pre>;
}

/**
 * A megjelenő döntés eredményt a panel görgetett területén láthatóvá görgeti.
 * A panel a transcript sávban legfeljebb a sáv felét kapja, és maga görget
 * (`run-view.css`), tehát a gombok alatt megjelenő eredmény a látható
 * területen kívülre eshetne (mérve, `docs/research/2026-09-24-jovahagyas-panel-helye.md`).
 * A `block: 'nearest'` a lehető legkisebb görgetéssel hozza be a sort
 * (<https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView>,
 * <https://www.w3.org/TR/cssom-view-1/#dom-element-scrollintoview>); a
 * `packages/ui` `use-scroll-active-option-into-view.ts` ugyanezt a hívást
 * használja. Csatoláskor fut egyszer: a modul szintű függvény azonossága
 * stabil, tehát a React nem hívja újra minden renderen.
 */
function revealResult(element: HTMLParagraphElement | null): void {
  element?.scrollIntoView({ block: 'nearest' });
}

/**
 * Egy függő jóváhagyás kártyája: a `title`, a `body`, a formázott `payload`,
 * és a két döntés gombja (SPEC-008 8. szekció, T-009-27, AC35). Csak
 * megjelenít: a döntés kérése és az eredménye a képernyő szintjén él
 * (`use-approval-decisions.ts`, `reduce-approval-decisions.ts`), mert a
 * kártya leszerelődik, amint a friss lista már nem tartalmazza a
 * jóváhagyást, vagy amikor a transcript sáv a reszponzív sáv váltásakor újra
 * felcsatolódik.
 *
 * A két gomb a küldés pillanatától letiltva (9. szekció 15. async pont), a
 * megnyomotton spinnerrel, és **egy elfogadott vagy véglegesen elbukott
 * döntés után többé nem kapcsol vissza**; csak az átmeneti hiba (hálózati
 * hiba, 502, 503) engedi az újrapróbálást. A döntés eredménye (siker vagy a
 * hibaüzenet) a "Rendben" gombbal való nyugtázásig látszik.
 */
export function ApprovalPromptCard(properties: Readonly<ApprovalPromptCardProperties>): ReactElement {
  const { approval, progress, onDecide, onDismiss } = properties;
  const titleId = useId();

  const isSending = progress?.status === 'sending';
  const isRetryable = progress?.status === 'failed' && !progress.isFinal;
  const areDecisionsDisabled = progress !== undefined && !isRetryable;

  return (
    <article className="approval-prompt-card" aria-labelledby={titleId}>
      <h3 id={titleId} className="approval-prompt-card__title">
        {approval.title}
      </h3>
      <p className="approval-prompt-card__body">{approval.body}</p>
      <FormattedPayload payload={approval.payload} />
      <div className="approval-prompt-card__actions">
        <Button
          type="button"
          size="sm"
          variant="primary"
          isLoading={isSending && progress.decision === 'approved'}
          disabled={areDecisionsDisabled}
          onClick={() => {
            onDecide('approved');
          }}
        >
          Jóváhagyás
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          isLoading={isSending && progress.decision === 'rejected'}
          disabled={areDecisionsDisabled}
          onClick={() => {
            onDecide('rejected');
          }}
        >
          Elutasítás
        </Button>
        {progress !== undefined && !isSending && (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Rendben
          </Button>
        )}
      </div>
      {progress?.status === 'decided' && (
        <p ref={revealResult} className="approval-prompt-card__result" role="status">
          Döntés rögzítve: {DECISION_LABELS[progress.decision]}.
        </p>
      )}
      {progress?.status === 'failed' && (
        <p ref={revealResult} role="alert">
          {progress.message}
        </p>
      )}
    </article>
  );
}
