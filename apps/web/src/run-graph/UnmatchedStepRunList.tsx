import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { Badge } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { describeStepRunStatusBadge } from '../graph-node-card/step-run-status-badge.ts';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';

export interface UnmatchedStepRunListProperties {
  readonly stepRuns: readonly StepRunRecord[];
}

/**
 * A pillanatképpel nem párosítható lépés futások listája, a gráf ALATT
 * (SPEC-008 6.2, AC23). A `step_run.node_id` szándékosan nem idegen kulcs
 * (SPEC-003 4.10), tehát a futás hivatkozhat olyan csomópontra, ami a
 * pillanatképben nincs benne; a felület ezt kimondja, ahelyett hogy a sorokat
 * némán elhagyná.
 *
 * Kártya alakú doboz nincs (tilos a card in card): megnevezett, doboz nélküli
 * szakasz, `<h2>` fejléccel és valódi listával.
 */
export function UnmatchedStepRunList(properties: Readonly<UnmatchedStepRunListProperties>): ReactElement {
  const { stepRuns } = properties;

  return (
    <section className="unmatched-step-run-list" aria-labelledby="unmatched-step-run-list-title">
      <h2 id="unmatched-step-run-list-title" className="unmatched-step-run-list__title">
        A rajzon nem szereplő lépés futások
      </h2>
      <p className="unmatched-step-run-list__hint">
        Ezek a lépés futások olyan csomópontra hivatkoznak, ami a futás pillanatképében nem szerepel, ezért a rajzon nem
        jelennek meg.
      </p>
      <ul className="unmatched-step-run-list__items">
        {stepRuns.map((stepRun) => (
          <li key={stepRun.id} className="unmatched-step-run-list__item">
            <span className="unmatched-step-run-list__node-id">{stepRun.nodeId}</span>
            <span className="unmatched-step-run-list__node-type">{GRAPH_NODE_CATALOG[stepRun.nodeType].label}</span>
            <Badge variant={describeStepRunStatusBadge(stepRun.status).variant}>
              {describeStepRunStatusBadge(stepRun.status).label}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
