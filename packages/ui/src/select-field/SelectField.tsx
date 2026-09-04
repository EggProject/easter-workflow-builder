import type { ReactElement, SelectHTMLAttributes } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './select-field.css';

export type SelectFieldSize = 'sm' | 'md';

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectFieldProperties extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> {
  readonly options: readonly SelectFieldOption[];
  /**
   * A design system `.select--sm` módosítója. A natív `<select>` saját,
   * szám értékű `size` attribútuma emiatt nem elérhető ezen a komponensen.
   */
  readonly size?: SelectFieldSize;
  /**
   * Az üres értékű, első opció felirata.
   */
  readonly placeholder?: string;
  /**
   * Betöltő állapot: a mező letiltva, a lista üres, és a `loadingLabel`
   * felirat áll az egyetlen opcióban (SPEC-007 11. szekció 4. async pont).
   */
  readonly loading?: boolean;
  /**
   * A betöltő állapot felirata; a szöveg a hívóé, a komponens nem ismer
   * nyelvet.
   */
  readonly loadingLabel?: string;
}

const NO_OPTIONS: readonly SelectFieldOption[] = [];

/**
 * A design-token `.select` választó, natív `<select>` elemre építve
 * (SPEC-007 6.2, T-008-13). A forrás `Select.jsx` egyedi listbox változata
 * (button trigger plusz `.menu` panel) a hatókörön kívüli Menu komponens
 * CSS-ét igényelné; a natív változatot maga a forrás CSS nevezi meg és
 * támogatja (`select.select` szabály). Címke: a hívó ad `<label for>`
 * elemet vagy `aria-label` értéket, mert a `.field__label` osztály a
 * `text-field` téma CSS-éé.
 */
export function SelectField(properties: Readonly<SelectFieldProperties>): ReactElement {
  const { options, size = 'md', placeholder, loading, loadingLabel, disabled, className, ...rest } = properties;

  const isLoading = loading === true;
  const visibleOptions = isLoading ? NO_OPTIONS : options;
  const placeholderLabel = isLoading ? loadingLabel : placeholder;

  return (
    <select
      className={joinClassNames('select', size === 'sm' && 'select--sm', className)}
      {...rest}
      disabled={isLoading || disabled === true}
    >
      {placeholderLabel !== undefined && <option value="">{placeholderLabel}</option>}
      {visibleOptions.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
