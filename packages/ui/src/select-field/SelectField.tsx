import { useId, type ReactElement, type SelectHTMLAttributes } from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
// A `.field`, a `.field__label` és a `.field__error` osztály a `text-field`
// téma CSS-éé; a `SelectField` a címkés/hibás alakjában ugyanezt a burkolót
// használja, ezért a témát is be kell töltenie, hogy egy csak `SelectField`-et
// használó felületen se maradjon stílus nélkül a címke és a hibaüzenet.
import '../text-field/text-field.css';
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
  /**
   * A mező fölött álló, nagybetűs címke szövege, a `TextField` `label`
   * propjának pontos párja. Megadása esetén a mező a design system `.field`
   * burkolóját kapja, a címkével implicit összekötve.
   */
  readonly label?: string | undefined;
  /**
   * Hibaüzenet: egyben hibás állapotba is állítja a mezőt. A `TextField`
   * mintáját követi (`aria-invalid`, `aria-describedby`), hogy a két mező
   * hibajelzése ugyanúgy viselkedjen.
   */
  readonly error?: string | undefined;
}

const NO_OPTIONS: readonly SelectFieldOption[] = [];

/**
 * A design-token `.select` választó, natív `<select>` elemre építve
 * (SPEC-007 6.2, T-008-13). A forrás `Select.jsx` egyedi listbox változata
 * (button trigger plusz `.menu` panel) a hatókörön kívüli Menu komponens
 * CSS-ét igényelné; a natív változatot maga a forrás CSS nevezi meg és
 * támogatja (`select.select` szabály).
 *
 * Címke és hibaüzenet: a `label` vagy az `error` megadásakor a mező a
 * `TextField` `.field` burkolójába kerül (címke fölé, hibaüzenet alá), a
 * hibaüzenet pedig `aria-describedby` és `aria-invalid` párral kötődik a
 * mezőhöz. Egyik sem kötelező: mindkettő nélkül a komponens változatlanul
 * csupasz `<select>` elemet ad, tehát a saját elrendezést hozó hívók
 * (`aria-label` plusz külső címke) érintetlenek maradnak.
 */
export function SelectField(properties: Readonly<SelectFieldProperties>): ReactElement {
  const {
    options,
    size = 'md',
    placeholder,
    loading,
    loadingLabel,
    disabled,
    className,
    label,
    error,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  } = properties;

  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const isLoading = loading === true;
  const hasError = error !== undefined;
  const errorId = `${resolvedId}-error`;
  const visibleOptions = isLoading ? NO_OPTIONS : options;
  const placeholderLabel = isLoading ? loadingLabel : placeholder;

  const selectElement = (
    <select
      className={joinClassNames('select', size === 'sm' && 'select--sm', hasError && 'select--error', className)}
      {...rest}
      id={resolvedId}
      disabled={isLoading || disabled === true}
      aria-invalid={hasError ? 'true' : ariaInvalid}
      aria-describedby={joinAriaTokenList(ariaDescribedBy, hasError ? errorId : undefined)}
    >
      {placeholderLabel !== undefined && <option value="">{placeholderLabel}</option>}
      {visibleOptions.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (label === undefined && !hasError) {
    return selectElement;
  }

  return (
    <label className="field">
      {label !== undefined && <span className="field__label">{label}</span>}
      {selectElement}
      {hasError && (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
