import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProperties extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/**
 * A design-token `.btn` gomb (SPEC-007 6.2, T-008-11). Minden natív
 * `<button>` attribútum áttovábbítódik; a `variant` és a `size` diszkrét
 * unió, nem `string`.
 */
export function Button(properties: Readonly<ButtonProperties>): ReactElement {
  const { variant = 'primary', size = 'md', className, children, ...rest } = properties;

  return (
    <button
      className={joinClassNames('btn', `btn--${variant}`, size === 'md' ? undefined : `btn--${size}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
