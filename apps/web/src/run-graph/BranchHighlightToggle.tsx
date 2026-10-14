import { ControlButton } from '@xyflow/react';
import type { ReactElement } from 'react';
import type { BranchHighlightMode } from './branch-highlight-mode.ts';

/**
 * A kapcsoló hozzáférhető neve és tooltip felirata: a React Flow beépített
 * vezérlő gombjainak mintájára a kettő azonos (SPEC-008 6.6, 3. döntés,
 * O-25).
 */
const BRANCH_HIGHLIGHT_TOGGLE_LABEL = 'Minden bejárt ág kiemelése';

/**
 * A vendorolt lucide 0.525.0 készlet `Route` ikonja (24x24 viewBox), kézzel
 * beágyazva, a repó meglévő ikon konvenciója szerint (1.75 vonalvastagság,
 * kerekített vonalvég és csatlakozás; `RunEventRow.tsx` `OriginMarkerIcon`).
 * Az `aria-hidden` miatt a hozzáférhetőségi fából kimarad: a gomb neve az
 * `aria-label`. A méretét a React Flow vezérlő sávjának saját szabálya adja
 * (`.react-flow__controls-button svg`), a kitöltést a `run-graph.css`
 * kapcsolja ki, mert az ikon vonalas.
 */
function RouteIcon(): ReactElement {
  return (
    <svg
      className="run-graph-branch-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

export interface BranchHighlightToggleProperties {
  readonly mode: BranchHighlightMode;
  readonly onToggle: () => void;
}

/**
 * A "csak a legutóbbi választás" és a "minden eddig bejárt ág" mód kapcsolója
 * (SPEC-008 6.6, 3. döntés, O-25): a React Flow vezérlő paneljének
 * `ControlButton` eleme, ami a beépített gombok után áll. A lenyomott állapot
 * (`aria-pressed="true"`) a "minden eddig bejárt ág" mód. A design system
 * `toggle` komponensét szándékosan nem emeli át: a vezérlő sáv a React Flow
 * sajátja, amit a design system nem ismer (SPEC-008 11.4).
 */
export function BranchHighlightToggle(properties: Readonly<BranchHighlightToggleProperties>): ReactElement {
  const { mode, onToggle } = properties;
  return (
    <ControlButton
      onClick={onToggle}
      aria-label={BRANCH_HIGHLIGHT_TOGGLE_LABEL}
      title={BRANCH_HIGHLIGHT_TOGGLE_LABEL}
      aria-pressed={mode === 'all'}
    >
      <RouteIcon />
    </ControlButton>
  );
}
