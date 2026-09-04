import { useId, type InputHTMLAttributes, type ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './form-control.css';

export interface CheckboxProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * A jelölőnégyzet melletti szöveg.
   */
  readonly label?: string;
}

/**
 * A design-token `.ctrl` jelölőnégyzet (SPEC-007 6.2, T-008-13). A forrás
 * `FormControls.jsx` Radio, RadioGroup és Switch exportja nincs átemelve,
 * mert a SPEC-007 6.1 szerint a felület egyedül a törlés megerősítő
 * jelölőnégyzetét használja.
 *
 * A hozzáférhető név a `.ctrl__label` szövegből jön, `aria-labelledby`
 * hivatkozással: a burkoló `<label>` implicit neve helyett ez a
 * legmagasabb prioritású névforrás, tehát a név pontosan a címke szövege.
 * A hívó saját `aria-labelledby` értéke erősebb.
 */
export function Checkbox(properties: Readonly<CheckboxProperties>): ReactElement {
  const { label, className, disabled, 'aria-labelledby': ariaLabelledBy, ...rest } = properties;

  const automaticId = useId();
  const labelId = `${automaticId}-label`;
  const resolvedLabelledBy = ariaLabelledBy ?? (label === undefined ? undefined : labelId);

  return (
    <label className={joinClassNames('ctrl', disabled === true && 'is-disabled', className)}>
      <input
        {...rest}
        type="checkbox"
        className="ctrl__input"
        disabled={disabled}
        aria-labelledby={resolvedLabelledBy}
      />
      <span className="ctrl__box">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8 3 3 6-6.5" />
        </svg>
      </span>
      {label !== undefined && (
        <span className="ctrl__text">
          <span className="ctrl__label" id={labelId}>
            {label}
          </span>
        </span>
      )}
    </label>
  );
}
