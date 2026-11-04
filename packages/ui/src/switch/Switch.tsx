import { useId, type InputHTMLAttributes, type ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import '../form-control/form-control.css';
import { resolveSwitchAria } from './resolve-switch-aria.ts';
import './switch.css';

export type SwitchSize = 'md' | 'sm';

/**
 * A forrás `Switch` propjai: `label`, `hint`, `checked`, `disabled`,
 * `onChange`, `size`, `className`, az `aria-*` hármas és a többi, a natív
 * inputra továbbadott attribútum. A `type` és a `role` rögzített, a natív
 * `size` (szám) helyét a forrás `size` (`md` | `sm`) propja veszi át.
 */
export interface SwitchProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'size'> {
  /**
   * A kapcsoló melletti szöveg; ez adja a hozzáférhető nevet.
   */
  readonly label?: string;
  /**
   * Másodlagos szöveg a címke alatt; leírásként (`aria-describedby`) kötődik.
   */
  readonly hint?: string;
  readonly size?: SwitchSize;
}

/**
 * A design system `.ctrl__switch` kapcsolója
 * (`eggproject-design-components/components/form-controls/FormControls.jsx`,
 * `Switch`), a forrás szerkezetével: `<label class="ctrl">` burkoló, benne a
 * rejtett `role="switch"` natív jelölőnégyzet és a megrajzolt sáv. A név a
 * `.ctrl__label` szövegből jön `aria-labelledby` hivatkozással (a `hint`
 * így nem kerül a névbe), a `hint` a leírás. A `checked` mindig vezérelt:
 * a forrás szerint a hiányzó érték `false`.
 */
export function Switch(properties: Readonly<SwitchProperties>): ReactElement {
  const {
    label,
    hint,
    checked,
    disabled,
    onChange,
    size = 'md',
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = properties;

  const automaticId = useId();
  const labelId = `${automaticId}-label`;
  const hintId = `${automaticId}-hint`;
  const hasLabel = label !== undefined && label !== '';
  const hasHint = hint !== undefined && hint !== '';
  const { labelledBy, describedBy } = resolveSwitchAria({
    labelId,
    hintId,
    hasLabel,
    hasHint,
    ariaLabelledBy,
    ariaDescribedBy,
  });

  return (
    <label className={joinClassNames('ctrl', disabled === true && 'is-disabled', className)}>
      <input
        {...rest}
        type="checkbox"
        role="switch"
        className="ctrl__input"
        checked={checked === true}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      />
      <span className={joinClassNames('ctrl__switch', size === 'sm' && 'ctrl__switch--sm')} />
      {(hasLabel || hasHint) && (
        <span className="ctrl__text">
          {hasLabel && (
            <span className="ctrl__label" id={labelId}>
              {label}
            </span>
          )}
          {hasHint && (
            <span className="ctrl__hint" id={hintId}>
              {hint}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
