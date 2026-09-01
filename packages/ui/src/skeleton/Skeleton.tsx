import type { CSSProperties, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './skeleton.css';

export type SkeletonShape = 'block' | 'text' | 'title' | 'circle' | 'btn' | 'card' | 'avatar' | 'avatar-lg';

export interface SkeletonProperties {
  readonly shape?: SkeletonShape;
  /**
   * Szélesség felülírás: szám esetén px-re alakul.
   */
  readonly w?: string | number;
  /**
   * Magasság felülírás: szám esetén px-re alakul.
   */
  readonly h?: string | number;
  /**
   * Sötét felületen használva.
   */
  readonly ink?: boolean;
  /**
   * `shape="text"` esetén N sort rajzol, az utolsó rövidebb.
   */
  readonly lines?: number;
  /**
   * Alapból dekoratív (`true` → `aria-hidden="true"`).
   */
  readonly ariaHidden?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
}

function resolveDimension(value: string | number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? `${String(value)}px` : value;
}

/**
 * A design-token `.skel` betöltés-jelző elem (SPEC-007 6.2, T-008-12). A
 * forrás `SkeletonList` komponense nincs átemelve, mert nem tagja a
 * SPEC-007 12.1 tizenkét komponens listájának.
 */
export function Skeleton(properties: Readonly<SkeletonProperties>): ReactElement {
  const { shape = 'block', w, h, ink, lines, ariaHidden = true, className, style } = properties;

  if (lines !== undefined && shape === 'text') {
    return (
      <div className="skel-stack">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            shape="text"
            ariaHidden={ariaHidden}
            w={index === lines - 1 ? '60%' : '100%'}
            {...(ink !== undefined && { ink })}
          />
        ))}
      </div>
    );
  }

  const width = resolveDimension(w);
  const height = resolveDimension(h);
  const styleObject: CSSProperties = {
    ...style,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
  };

  return (
    <span
      className={joinClassNames(
        'skel',
        shape === 'block' ? undefined : `skel--${shape}`,
        ink === true ? 'skel--ink' : undefined,
        className,
      )}
      style={styleObject}
      aria-hidden={ariaHidden ? 'true' : undefined}
    />
  );
}
