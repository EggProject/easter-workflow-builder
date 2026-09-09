import { useId, type FocusEvent, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { useFieldErrorVisibility } from '../field-error-visibility/use-field-error-visibility.ts';
import './text-field.css';

export type TextFieldSize = 'sm' | 'md';

export interface TextFieldProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * A design system `.input--sm` módosítója, a `SelectField` `size`
   * propjának pontos párja. A natív `<input>` saját, szám értékű `size`
   * attribútuma emiatt nem elérhető ezen a komponensen.
   */
  readonly size?: TextFieldSize;
  /**
   * A mező fölött álló, nagybetűs címke szövege.
   */
  readonly label?: string | undefined;
  /**
   * Hibaüzenet: egyben hibás állapotba is állítja a mezőt. Az `| undefined`
   * kimondása szándékos az `exactOptionalPropertyTypes` mellett: a hívók egy
   * `string | undefined` értékű keresés eredményét adják át közvetlenül
   * (`error={fieldErrors.get(path)}`), objektum spread trükk nélkül. A
   * MEGJELENÉS szabályát a `useFieldErrorVisibility` adja (érintett vagy már
   * megkísérelt beküldés).
   */
  readonly error?: string | undefined;
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
 *
 * A HIBAÜZENET MEGJELENÉSE nem az `error` prop puszta meglétén múlik, hanem
 * a `useFieldErrorVisibility` szabályán: érintett (`blur`) VAGY már
 * megkísérelt űrlap beküldés. A hívó saját `onBlur` kezelője megmarad, a
 * komponens csak elé fűzi az érintettség jelölését.
 *
 * A `size` alapértéke `md`, a `SelectField` mintáját követve: a modálison
 * kívüli, sűrű felületek (pl. a gráf szerkesztő node inspectora) explicit
 * `size="sm"`-et adnak át, a modálisok pedig változatlanul hagyják.
 */
export function TextField(properties: Readonly<TextFieldProperties>): ReactElement {
  const {
    size = 'md',
    label,
    error,
    icon,
    inputClassName,
    className,
    id,
    onBlur,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  } = properties;

  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const { isErrorVisible, markTouched } = useFieldErrorVisibility(error);
  const errorId = `${resolvedId}-error`;

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    markTouched();
    onBlur?.(event);
  }

  const inputElement = (
    <input
      className={joinClassNames(
        'input',
        size === 'sm' && 'input--sm',
        isErrorVisible && 'input--error',
        inputClassName,
      )}
      {...rest}
      id={resolvedId}
      onBlur={handleBlur}
      aria-invalid={isErrorVisible ? 'true' : ariaInvalid}
      aria-describedby={joinAriaTokenList(ariaDescribedBy, isErrorVisible ? errorId : undefined)}
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
      {isErrorVisible && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
