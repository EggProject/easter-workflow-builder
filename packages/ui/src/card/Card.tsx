import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './card.css';

export interface CardProperties extends HTMLAttributes<HTMLDivElement> {
  /**
   * `true` esetén a sötét, invertált variánst (`.card--feature`) rajzolja.
   */
  readonly feature?: boolean;
  readonly title?: string;
  /**
   * Kis jelölés a fejlécben: egyetlen betű vagy SVG.
   */
  readonly icon?: ReactNode;
  /**
   * [bal, jobb] pár az alsó meta sorhoz.
   */
  readonly meta?: readonly [ReactNode, ReactNode];
}

/**
 * A design-token `.card` felület (SPEC-007 6.2, T-008-11).
 */
export function Card(properties: Readonly<CardProperties>): ReactElement {
  const { feature, title, icon, meta, children, className, ...rest } = properties;

  return (
    <div className={joinClassNames('card', feature === true ? 'card--feature' : undefined, className)} {...rest}>
      {icon === undefined && title === undefined ? undefined : (
        <div className="card__header">
          {icon === undefined ? undefined : (
            <div className="card__icn" aria-hidden="true">
              {icon}
            </div>
          )}
          {title === undefined ? undefined : <h3>{title}</h3>}
        </div>
      )}
      {children === undefined ? undefined : <p>{children}</p>}
      {meta === undefined ? undefined : (
        <div className="card__meta">
          <span>{meta[0]}</span>
          <span>{meta[1]}</span>
        </div>
      )}
    </div>
  );
}
