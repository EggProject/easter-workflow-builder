import type { HTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './badge.css';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'yolk' | 'ink' | 'outline';

export interface BadgeProperties extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
  /**
   * Explicit felülírás; alapértelmezésben a négy státusz variánsnál jelenik meg.
   */
  readonly dot?: boolean;
}

const DOT_DEFAULT_VARIANTS: ReadonlySet<BadgeVariant> = new Set(['info', 'success', 'warning', 'danger']);

/**
 * A design-token `.badge` jelvény (SPEC-007 6.2, T-008-11). A forrás
 * `Chip` komponense nincs átemelve, mert nem tagja a SPEC-007 12.1
 * tizenkét komponens listájának.
 */
export function Badge(properties: Readonly<BadgeProperties>): ReactElement {
  const { variant = 'info', dot, className, children, ...rest } = properties;
  const isDotVisible = dot ?? DOT_DEFAULT_VARIANTS.has(variant);

  return (
    <span className={joinClassNames('badge', `badge--${variant}`, className)} {...rest}>
      {isDotVisible ? <span className="badge__dot" /> : undefined}
      {children}
    </span>
  );
}
