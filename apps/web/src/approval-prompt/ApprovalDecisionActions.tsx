import type { ApprovalDecision } from '@easter-workflow-builder/protocol';
import { Alert, Button, DrawerFooter } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';
import './approval-prompt.css';

export interface ApprovalDecisionActionsProperties {
  /**
   * A LÁTOTT jóváhagyásra elküldött döntés állapota, `undefined`, ha még nem
   * ment döntés (`reduce-approval-decisions.ts`).
   */
  readonly progress: ApprovalDecisionProgress | undefined;
  readonly onDecide: (decision: ApprovalDecision) => void;
  /**
   * A látott jóváhagyás címének azonosítója (`ApprovalPromptCard`): a gombok
   * csoportjának neve.
   */
  readonly approvalTitleId: string;
  /**
   * A látott jóváhagyás szövegének azonosítója: a gombok csoportjának
   * leírása.
   */
  readonly approvalTextId: string;
}

const DECISION_LABELS: Readonly<Record<ApprovalDecision, string>> = {
  approved: 'jóváhagyva',
  rejected: 'elutasítva',
};

/**
 * A látott jóváhagyás tapadó akciósávja (SPEC-008 8. szekció 1. és 3. pont,
 * user döntés 2026-09-25: "egyszerre egy"): a design system `drawer`
 * láblécében (`DrawerFooter`) a két `sm` döntés gomb, és előttük a döntés
 * eredménye, további burkoló nélkül, hogy a sáv saját térköze és igazítása
 * érvényesüljön. A sáv a "Függő jóváhagyások" régióban, a lapozó alatt, a
 * húzható elválasztón kívül áll, közvetlenül a jóváhagyás szövege alatt (user
 * döntés 2026-09-25: "transcript felül, kérdés alul"), tehát az elválasztó
 * bármely állásában látszik.
 *
 * **A sáv a jóváhagyáshoz kötött csoport** (W3C WCAG ARIA17, APG "Providing
 * Accessible Names and Descriptions"): `role="group"`, a neve a látott
 * jóváhagyás címe (`aria-labelledby`), a leírása a szövege
 * (`aria-describedby`), így a gomb fókuszakor a képernyőolvasó a csoport
 * nevével, azaz a jóváhagyás címével együtt mondja a gomb nevét. A cím és a
 * szöveg a húzható panelben áll, a sáv azon kívül, tehát a kötés azonosítóval
 * megy, nem DOM tartalmazással.
 *
 * A két gomb a küldés pillanatától letiltva (9. szekció 15. async pont), a
 * megnyomotton spinnerrel, és **egy elfogadott vagy véglegesen elbukott
 * döntés után többé nem kapcsol vissza**; csak az átmeneti hiba (hálózati
 * hiba, 502, 503) engedi az újrapróbálást. Az eredmény (siker vagy a
 * hibaüzenet) külön nyugtázás nélkül látszik, amíg a nézet ugyanazon a
 * futáson áll (user döntés 2026-09-24); a sáv nem görget, tehát görgetés
 * nélkül. A hiba a design system `danger` `Alert` blokkja, a gombok fölötti
 * saját sorban (SPEC-007 8.4, user döntés 2026-09-24).
 */
export function ApprovalDecisionActions(properties: Readonly<ApprovalDecisionActionsProperties>): ReactElement {
  const { progress, onDecide, approvalTitleId, approvalTextId } = properties;

  const isSending = progress?.status === 'sending';
  const isRetryable = progress?.status === 'failed' && !progress.isFinal;
  const areDecisionsDisabled = progress !== undefined && !isRetryable;

  return (
    <DrawerFooter role="group" aria-labelledby={approvalTitleId} aria-describedby={approvalTextId}>
      {progress?.status === 'decided' && (
        <p className="approval-decision-actions__result" role="status">
          Döntés rögzítve: {DECISION_LABELS[progress.decision]}.
        </p>
      )}
      {progress?.status === 'failed' && (
        <Alert variant="danger" className="approval-decision-actions__failure">
          {progress.message}
        </Alert>
      )}
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
    </DrawerFooter>
  );
}
