import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './empty.css';

export type EmptyArtVariant = 'paper' | 'ink' | 'blue' | 'success' | 'warning' | 'square';

export type EmptyTone = 'plain' | 'card';

/**
 * A forrás `EmptyState` propjai, egy az egyben: `icon`, `artVariant`,
 * `eyebrow`, `title`, `message`, `actions`, `tone`, `inline` és `className`.
 * A forrás függvénye `EmptyState`, a SPEC-009 3.4 és O-15 szerint a
 * `packages/ui` neve `Empty`.
 */
export interface EmptyProperties {
  /**
   * A díszítő ikon (a forrás szerint `aria-hidden`); hiányában az ikon
   * helye sem rajzolódik ki.
   */
  readonly icon?: ReactNode;
  readonly artVariant?: EmptyArtVariant;
  /**
   * Kis, nagybetűs sor a cím fölött.
   */
  readonly eyebrow?: ReactNode;
  readonly title?: ReactNode;
  readonly message?: ReactNode;
  /**
   * Gombok sora (az elsődleges és a másodlagos művelet).
   */
  readonly actions?: ReactNode;
  readonly tone?: EmptyTone;
  /**
   * Vízszintes, tömör elrendezés.
   */
  readonly inline?: boolean;
  readonly className?: string;
}

/**
 * A design system `.empty` üres állapot elemének React változata
 * (`eggproject-design-components/components/empty/EmptyState.jsx`), a forrás
 * szerkezetével: burkoló `<div>`, díszítő ikon, `<h3>` cím és `<p>` üzenet,
 * a `inline` alakban a szöveg `.empty__body` dobozban. A forrás szerint egy
 * mező akkor rajzolódik ki, ha az értéke igaz (a `0` és az üres szöveg nem).
 */
export function Empty(properties: Readonly<EmptyProperties>): ReactElement {
  const {
    icon,
    artVariant = 'paper',
    eyebrow,
    title,
    message,
    actions,
    tone = 'plain',
    inline,
    className,
  } = properties;

  const text = (
    <>
      {Boolean(eyebrow) && <span className="empty__eyebrow">{eyebrow}</span>}
      {Boolean(title) && <h3 className="empty__title">{title}</h3>}
      {Boolean(message) && <p className="empty__message">{message}</p>}
    </>
  );

  return (
    <div
      className={joinClassNames(
        'empty',
        tone === 'card' && 'empty--card',
        inline === true && 'empty--inline',
        className,
      )}
    >
      {Boolean(icon) && (
        <span
          className={joinClassNames('empty__art', artVariant !== 'paper' && `empty__art--${artVariant}`)}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {inline === true ? <div className="empty__body">{text}</div> : text}
      {Boolean(actions) && <div className="empty__actions">{actions}</div>}
    </div>
  );
}
