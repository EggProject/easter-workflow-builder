import { joinClassNames } from '@easter-workflow-builder/ui';
import { useId, type ReactElement, type TextareaHTMLAttributes } from 'react';

export interface TextAreaFieldProperties extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  readonly error?: string;
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
 */
export function TextAreaField(properties: Readonly<TextAreaFieldProperties>): ReactElement {
  const { label, error, id, rows, className, ...rest } = properties;
  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const hasError = error !== undefined;

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        {...rest}
        id={resolvedId}
        rows={rows ?? 3}
        className={joinClassNames('input', hasError && 'input--error', className)}
      />
      {hasError && <span className="field__error">{error}</span>}
    </label>
  );
}
