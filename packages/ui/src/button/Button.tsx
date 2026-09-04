import type { ButtonHTMLAttributes, ReactElement, Ref } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProperties extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /**
   * Négyzet alakú, szöveg nélküli gomb geometriája (`.btn--icon`, forrás
   * `button.css`). Ilyenkor a `children` egyetlen ikon, és a hívó
   * felelőssége hozzáférhető nevet adni (`aria-label` vagy `title`),
   * mert a gombnak nincs látható szövege.
   */
  readonly icon?: boolean;
  /**
   * Várakozás jelző (`.is-loading`, forrás `button.css`): a `children`
   * fölött egy három pöttyös loader jelenik meg, a szöveg/ikon
   * átlátszóvá válik, de a gomb mérete és hozzáférhető neve megmarad. A
   * hívó felelőssége a `disabled` együttes átadása, ha a művelet ismételt
   * indítását is meg kell akadályozni.
   */
  readonly isLoading?: boolean;
  /**
   * React 19 "ref mint prop" (https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop):
   * `forwardRef` nélkül is fogadható és a natív `<button>`-re
   * továbbítható. Ez teszi lehetővé, hogy egy lebegő menü (`Menu`) a
   * triggerként átadott `Button`-ra programozottan visszaállítsa a
   * fókuszt záráskor.
   */
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * A design-token `.btn` gomb (SPEC-007 6.2, T-008-11). Minden natív
 * `<button>` attribútum áttovábbítódik; a `variant` és a `size` diszkrét
 * unió, nem `string`.
 */
export function Button(properties: Readonly<ButtonProperties>): ReactElement {
  const {
    variant = 'primary',
    size = 'md',
    icon = false,
    isLoading = false,
    className,
    children,
    ref,
    ...rest
  } = properties;

  return (
    <button
      ref={ref}
      className={joinClassNames(
        'btn',
        `btn--${variant}`,
        size === 'md' ? undefined : `btn--${size}`,
        icon && 'btn--icon',
        isLoading && 'is-loading',
        className,
      )}
      aria-busy={isLoading ? true : undefined}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className="btn__content">{children}</span>
          <span className="btn__loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
