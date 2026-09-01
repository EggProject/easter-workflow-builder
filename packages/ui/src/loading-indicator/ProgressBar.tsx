import { useId, type ReactElement } from 'react';
import './loading-indicator.css';

export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProperties {
  /**
   * 0-100 közé szorítva; nem véges érték (`NaN`/`Infinity`) 0-ra esik vissza.
   */
  readonly value?: number;
  readonly size?: ProgressBarSize;
  readonly isLabelVisible?: boolean;
  readonly label?: string;
  /**
   * Explicit felülírás; ha hiányzik, a látható címke vagy a szöveges címke ad nevet.
   */
  readonly ariaLabel?: string;
}

type AriaNameProperties = { readonly 'aria-label': string } | { readonly 'aria-labelledby': string };

/**
 * A `role="progressbar"` nevét NEM a tartalomból veszi, hanem a szerzőtől:
 * ha van látható címke, arra mutat (`aria-labelledby`), különben
 * `aria-label`. Az explicit `ariaLabel` mindig felülír.
 */
function resolveAriaNameProperties(
  ariaLabel: string | undefined,
  isLabelVisible: boolean,
  labelId: string,
  text: string,
): AriaNameProperties {
  if (ariaLabel !== undefined) {
    return { 'aria-label': ariaLabel };
  }
  if (isLabelVisible) {
    return { 'aria-labelledby': labelId };
  }
  return { 'aria-label': text };
}

/**
 * A design-token `.progress-bar` determinisztikus (százalékos) betöltés
 * jelző (SPEC-007 6.2, T-008-12). A forrás `ProgressIndeterminate` és
 * `LogoSpinner` komponense nincs átemelve, mert egyik sem tagja a
 * SPEC-007 12.1 tizenkét komponens listájának.
 */
export function ProgressBar(properties: Readonly<ProgressBarProperties>): ReactElement {
  const { value = 0, size = 'md', isLabelVisible = true, label, ariaLabel } = properties;
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const text = label ?? 'Uploading';
  const labelId = useId();
  const nameProperties = resolveAriaNameProperties(ariaLabel, isLabelVisible, labelId, text);
  const percentText = percent.toFixed(0);

  return (
    <div
      className={`progress-bar progress-bar--${size}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      {...nameProperties}
    >
      {isLabelVisible ? (
        <div className="progress-bar__header">
          <span className="progress-bar__label" id={labelId}>
            {text}
          </span>
          <span className="progress-bar__value">{percentText}%</span>
        </div>
      ) : undefined}
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={{ width: `${percentText}%` }}>
          <span className="progress-bar__shimmer" />
        </div>
      </div>
    </div>
  );
}
