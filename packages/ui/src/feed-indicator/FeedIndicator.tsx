import type { HTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { Dot, type DotProperties, type DotTone } from '../dot/Dot.tsx';
import './feed-indicator.css';

export type FeedIndicatorState = 'connecting' | 'streaming' | 'stale' | 'disconnected' | 'idle';

export type FeedIndicatorVariant = 'plain' | 'soft' | 'outline';

export type FeedIndicatorSize = 'sm' | 'md' | 'lg';

export type FeedIndicatorSurface = 'paper' | 'ink';

/**
 * Egy állapot leírása a forrás `FEED_STATES` táblájából: a belső `Dot`
 * tónusa és módosítói, plusz az alapértelmezett felirat.
 */
export interface FeedIndicatorStateSpecification {
  readonly tone: DotTone;
  readonly pulse: boolean;
  readonly blink: boolean;
  readonly hollow: boolean;
  readonly halo: boolean;
  readonly label: string;
}

/**
 * A forrás kanonikus taxonómiája, változatlan értékekkel
 * (`eggproject-design-components/components/feed-indicator/FeedIndicator.jsx`).
 */
const FEED_STATES: Readonly<Record<FeedIndicatorState, FeedIndicatorStateSpecification>> = {
  connecting: { tone: 'info', pulse: true, blink: false, hollow: false, halo: true, label: 'Connecting' },
  streaming: { tone: 'success', pulse: true, blink: false, hollow: false, halo: true, label: 'Live' },
  stale: { tone: 'warning', pulse: false, blink: true, hollow: false, halo: true, label: 'Stale' },
  disconnected: { tone: 'danger', pulse: false, blink: false, hollow: true, halo: false, label: 'Offline' },
  idle: { tone: 'muted', pulse: false, blink: false, hollow: true, halo: false, label: 'Idle' },
};

/**
 * A forrás `FeedIndicator.jsx` propjai, egy az egyben: `state`, `label`,
 * `meta`, `variant`, `size`, `surface`, `compact`, `stack`, `dotProps`,
 * `className` és a többi, a gyökér `<span>`-re továbbadott attribútum.
 */
export interface FeedIndicatorProperties extends HTMLAttributes<HTMLSpanElement> {
  readonly state?: FeedIndicatorState;
  /**
   * Az állapot alapértelmezett feliratának felülírása.
   */
  readonly label?: string;
  /**
   * Monospace kiegészítő a felirat után ("12ms", "42s ago").
   */
  readonly meta?: string;
  readonly variant?: FeedIndicatorVariant;
  readonly size?: FeedIndicatorSize;
  /**
   * `ink` a sötét felületekre.
   */
  readonly surface?: FeedIndicatorSurface;
  /**
   * Csak a pötty; a felirat a `title` attribútumba és a pötty nevébe kerül.
   */
  readonly compact?: boolean;
  /**
   * Függőleges elrendezés: a pötty fölül, a felirat alatta.
   */
  readonly stack?: boolean;
  /**
   * A belső `Dot` további propjai; a forrás szerint az állapotból számolt
   * értékek UTÁN terülnek szét, tehát felülírják azokat.
   */
  readonly dotProps?: DotProperties;
}

/**
 * A design system élő adatforrás kapcsolat jelzője (WebSocket, SSE,
 * lekérdezés), a forrás `FeedIndicator.jsx` szerkezetével: `<span>` gyökér, a
 * belső `Dot`, a felirat és az elhagyható `meta`. Nem kompakt alakban
 * `role="status"` élő régió `"<felirat> feed"` hozzáférhető névvel, a pötty
 * dekoratív; kompakt alakban a gyökér csak `title`-t kap, a nevet a pötty
 * viseli (`role="img"`). A gyökérre szétterülő attribútumok a hozzáférhetőségi
 * attribútumok UTÁN jönnek, tehát a hívó felülírhatja az `aria-label` értékét.
 *
 * Egyetlen eltérés a forrástól: a forrás ismeretlen `state` értékre az `idle`
 * leírásra esik vissza; itt a `state` típusa zárt unió, tehát ez az ág nem
 * érhető el, és nincs is megírva.
 */
export function FeedIndicator(properties: Readonly<FeedIndicatorProperties>): ReactElement {
  const {
    state = 'idle',
    label,
    meta,
    variant = 'plain',
    size = 'md',
    surface = 'paper',
    compact = false,
    stack = false,
    dotProps: dotProperties = {},
    className,
    ...rest
  } = properties;

  const specification = FEED_STATES[state];
  const shownLabel = label ?? specification.label;
  const hasMeta = meta !== undefined && meta !== '';

  const classNames = joinClassNames(
    'ep-feed',
    `ep-feed--${state}`,
    `ep-feed--${size}`,
    variant !== 'plain' && `ep-feed--${variant}`,
    surface === 'ink' && 'ep-feed--ink',
    compact && 'ep-feed--compact',
    stack && 'ep-feed--stack',
    className,
  );
  const accessibility = compact
    ? { title: hasMeta ? `${shownLabel} · ${meta}` : shownLabel }
    : { 'aria-label': `${shownLabel} feed`, role: 'status' };

  return (
    <span className={classNames} {...accessibility} {...rest}>
      <Dot
        tone={specification.tone}
        size={size === 'lg' ? 'lg' : 'md'}
        halo={specification.halo}
        pulse={specification.pulse}
        blink={specification.blink}
        hollow={specification.hollow}
        title={compact ? shownLabel : undefined}
        {...dotProperties}
      />
      {compact ? undefined : <span className="ep-feed__label">{shownLabel}</span>}
      {!compact && hasMeta ? <span className="ep-feed__meta">{meta}</span> : undefined}
    </span>
  );
}

/**
 * A forrás statikus taxonómiája (`FeedIndicator.STATES`), változatlan néven.
 */
FeedIndicator.STATES = FEED_STATES;
