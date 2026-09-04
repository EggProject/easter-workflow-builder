import { useId, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './text-field.css';

export interface TextFieldProperties extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * A mező fölött álló, nagybetűs címke szövege.
   */
  readonly label?: string;
  /**
   * Hibaüzenet: egyben hibás állapotba is állítja a mezőt.
   */
  readonly error?: string;
  /**
   * Vezető ikon; jelenlétében a mező `.input-with-icon` burkolót kap.
   */
  readonly icon?: ReactNode;
  /**
   * Extra osztály közvetlenül az `<input>` elemen; a `className` a burkoló
   * `<label>` elemre kerül.
   */
  readonly inputClassName?: string;
}

/**
 * A design-token `.field` / `.input` szöveges beviteli mező (SPEC-007 6.2,
 * T-008-13). Minden natív `<input>` attribútum áttovábbítódik. A címke
 * összekötése a forrás mintáját követi: a `<label>` körbeveszi a mezőt
 * (implicit összekötés), és a mező azonosítója a hívóé vagy a `useId`
 * generálta érték.
 */
export function TextField(properties: Readonly<TextFieldProperties>): ReactElement {
  const {
    label,
    error,
    icon,
    inputClassName,
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  } = properties;

  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const hasError = error !== undefined;
  const errorId = `${resolvedId}-error`;

  const inputElement = (
    <input
      className={joinClassNames('input', hasError && 'input--error', inputClassName)}
      {...rest}
      id={resolvedId}
      aria-invalid={hasError ? 'true' : ariaInvalid}
      aria-describedby={joinAriaTokenList(ariaDescribedBy, hasError ? errorId : undefined)}
    />
  );

  return (
    <label className={joinClassNames('field', className)}>
      {label !== undefined && <span className="field__label">{label}</span>}
      {icon === undefined ? (
        inputElement
      ) : (
        <span className="input-with-icon">
          {icon}
          {inputElement}
        </span>
      )}
      {hasError && (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
