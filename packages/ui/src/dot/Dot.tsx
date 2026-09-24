import type { HTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './dot.css';

export type DotTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'yolk' | 'ink' | 'muted';

export type DotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * A forrás `Dot.jsx` propjai, egy az egyben: `tone`, `size`, `halo`, `ring`,
 * `pulse`, `blink`, `hollow`, `title`, `className` és a többi, a gyökér
 * `<span>`-re továbbadott attribútum. A `title` az örökölt HTML attribútum
 * típusát viseli, de a forrás szerint NEM kerül `title` attribútumként a
 * DOM-ba: a hozzáférhető nevet adja.
 */
export interface DotProperties extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: DotTone;
  readonly size?: DotSize;
  /**
   * Halvány, azonos színű gyűrű.
   */
  readonly halo?: boolean;
  /**
   * Éles gyűrű körvonal, sűrű háttérre.
   */
  readonly ring?: boolean;
  /**
   * Animált hullám ("élő", "kapcsolódás").
   */
  readonly pulse?: boolean;
  /**
   * Lassú átlátszóság villogás ("elavult").
   */
  readonly blink?: boolean;
  /**
   * Csak körvonal ("kikapcsolt", "megszakadt").
   */
  readonly hollow?: boolean;
}

/**
 * A design system `.ep-dot` önálló státusz atomja
 * (`eggproject-design-components/components/dot/Dot.jsx`), a forrás
 * szerkezetével: egyetlen `<span>`, a módosítók osztályként. A `title`
 * megadásakor `role="img"` és `aria-label` a neve, nélküle dekoratív
 * (`aria-hidden`), ahogy a forrás adja; a `title` igazságértéke dönt, tehát
 * az üres szöveg is dekoratív.
 */
export function Dot(properties: Readonly<DotProperties>): ReactElement {
  const {
    tone = 'info',
    size = 'md',
    halo = false,
    ring = false,
    pulse = false,
    blink = false,
    hollow = false,
    title,
    className,
    ...rest
  } = properties;

  const classNames = joinClassNames(
    'ep-dot',
    `ep-dot--${tone}`,
    `ep-dot--${size}`,
    halo && 'ep-dot--halo',
    ring && 'ep-dot--ring',
    pulse && 'ep-dot--pulse',
    blink && 'ep-dot--blink',
    hollow && 'ep-dot--hollow',
    className,
  );
  const accessibility =
    title === undefined || title === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title };

  return <span className={classNames} {...accessibility} {...rest} />;
}
