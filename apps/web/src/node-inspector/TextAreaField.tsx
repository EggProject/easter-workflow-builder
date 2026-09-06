import { joinAriaTokenList, joinClassNames } from '@easter-workflow-builder/ui';
import { useId, type ReactElement, type TextareaHTMLAttributes } from 'react';

export interface TextAreaFieldProperties extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  /**
   * Hibaüzenet a mező ALATT; egyben hibás állapotba is állítja a mezőt. Az
   * `| undefined` kimondása szándékos az `exactOptionalPropertyTypes`
   * mellett: a hívók a `useFieldError` hook `string | undefined` eredményét
   * adják át közvetlenül, objektum spread trükk nélkül.
   */
  readonly error?: string | undefined;
}

/**
 * Többsoros szöveg mező, a `packages/ui` `TextField` `.field`/`.input`
 * osztályaira építve. A `packages/ui` csomagnak nincs saját textarea
 * komponense (csak `TextField`, natív `<input>`-ra építve), a `node-config`
 * séma viszont sok többsoros mezőt hordoz (`promptTemplate`, `expression`,
 * `bodyTemplate`, ...). Ez a `node-inspector` téma saját, egyedi fogyasztóra
 * szabott mezője, nem a design system bővítése - az `.input` osztály
 * class-alapú, nem címke szerint szűkített, tehát `<textarea>`-n is
 * ugyanúgy érvényes (`packages/ui/src/text-field/text-field.css`).
 *
 * A hibaüzenet kötése bájtra a `TextField` mintáját követi: `aria-invalid`
 * a mezőn, `aria-describedby` a hibaüzenet azonosítójára, a hívó saját
 * `aria-describedby` értékét megőrizve (`joinAriaTokenList`).
 */
export function TextAreaField(properties: Readonly<TextAreaFieldProperties>): ReactElement {
  const {
    label,
    error,
    id,
    rows,
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  } = properties;
  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const hasError = error !== undefined;
  const errorId = `${resolvedId}-error`;

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        {...rest}
        id={resolvedId}
        rows={rows ?? 3}
        className={joinClassNames('input', hasError && 'input--error', className)}
        aria-invalid={hasError ? 'true' : ariaInvalid}
        aria-describedby={joinAriaTokenList(ariaDescribedBy, hasError ? errorId : undefined)}
      />
      {hasError && (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
