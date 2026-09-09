import { useId, type FocusEvent, type ReactElement, type TextareaHTMLAttributes } from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { useFieldErrorVisibility } from '../field-error-visibility/use-field-error-visibility.ts';
// A `.field`, a `.field__label` és a `.field__error` osztály a `text-field`
// téma CSS-éé; a `TextAreaField` ugyanezt a burkolót használja, ezért a
// témát is be kell töltenie, hogy egy csak `TextAreaField`-et használó
// felületen se maradjon stílus nélkül a címke és a hibaüzenet.
import '../text-field/text-field.css';
import './textarea.css';

export type TextAreaFieldSize = 'sm' | 'md';

export interface TextAreaFieldProperties extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * A design system `.textarea--sm` módosítója, a `TextField`/`SelectField`
   * `size` propjának pontos párja. A natív `<textarea>`-nak nincs saját
   * `size` attribútuma, tehát nincs szükség `Omit`-ra.
   */
  readonly size?: TextAreaFieldSize;
  /**
   * A mező fölött álló, nagybetűs címke szövege.
   */
  readonly label: string;
  /**
   * Hibaüzenet: egyben hibás állapotba is állítja a mezőt. Az `| undefined`
   * kimondása szándékos az `exactOptionalPropertyTypes` mellett: a hívók egy
   * `string | undefined` értékű keresés eredményét adják át közvetlenül,
   * objektum spread trükk nélkül. A MEGJELENÉS szabályát a
   * `useFieldErrorVisibility` adja (érintett vagy már megkísérelt beküldés).
   */
  readonly error?: string | undefined;
}

/**
 * A design system `.textarea` többsoros beviteli mezője, a `TextField`
 * `.field` burkolójában (címke fölé, hibaüzenet alá).
 *
 * MIÉRT ÖNÁLLÓ TÉMA, ÉS MIÉRT NEM AZ `.input` OSZTÁLY. A design system
 * `textarea` komponense saját osztályt (`.textarea`), saját `min-height`
 * értéket, natív `resize: vertical` viselkedést és saját fókusz/hiba/
 * letiltott állapotot hoz - ezek egyike sincs meg az egysoros `.input`
 * osztályon. A `node-inspector` korábban mégis az `.input` osztályt viselte
 * `<textarea>` elemen, egy saját `resize: vertical` toldással
 * (`docs/research/2026-09-08-design-system-audit.md` 4.4), ami pontosan a
 * felhasználó által kifogásolt megjelenést adta. Ez a téma a valódi
 * komponens átemelése.
 *
 * A hibás állapot osztálya a forrás szerint `.is-error` (nem `--error`,
 * ahogy az `.input` esetében), lásd `textarea.css`.
 *
 * A forrás `--lg`/`--ghost` variánsa propként nincs kivezetve, mert egyetlen
 * képernyő sem igényli. A `--sm` viszont IGEN (felhasználói kérés,
 * 2026-09-09: "slim mode alatt --sm varianst ertettem"): a `size` prop a
 * `TextField`/`SelectField` mintáját követi, alapértéke `md`, a gráf
 * szerkesztő node inspectora pedig explicit `size="sm"`-et ad át.
 */
export function TextAreaField(properties: Readonly<TextAreaFieldProperties>): ReactElement {
  const {
    size = 'md',
    label,
    error,
    className,
    id,
    rows,
    onBlur,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  } = properties;

  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const { isErrorVisible, markTouched } = useFieldErrorVisibility(error);
  const errorId = `${resolvedId}-error`;

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>): void {
    markTouched();
    onBlur?.(event);
  }

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        {...rest}
        id={resolvedId}
        rows={rows ?? 3}
        className={joinClassNames('textarea', size === 'sm' && 'textarea--sm', isErrorVisible && 'is-error', className)}
        onBlur={handleBlur}
        aria-invalid={isErrorVisible ? 'true' : ariaInvalid}
        aria-describedby={joinAriaTokenList(ariaDescribedBy, isErrorVisible ? errorId : undefined)}
      />
      {isErrorVisible && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
