import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './accordion.css';

export interface AccordionProperties {
  /**
   * `AccordionItem` elemek. A konténer nem nyúl a gyerekek állapotához: az
   * `AccordionItem` maga tartja a nyitottságát (lásd ott az indoklást).
   */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A design system `.accordion` összecsukható panel listája (SPEC-008 5.2).
 *
 * MI MARADT KI A FORRÁSBÓL, ÉS MIÉRT. A forrás `Accordion.jsx` három
 * dolgot ad ezen felül: a `variant` propot (`bordered`, `separated`,
 * `subtle`), a `type="single"` módot (egyszerre egy panel lehet nyitva) és
 * a `defaultOpen` indexlistát, amit `React.cloneElement` hívással,
 * aláhúzással kezdődő "privát" propokon ad le a gyerekeknek. Egyik sem
 * került át:
 *
 * - a `bordered` és a `separated` variáns kártya alakú dobozt rajzol, ami a
 *   beállítás panelen pontosan a tiltott card in card lenne (a panel már egy
 *   `.resizable-group` kártyán belül ül);
 * - a `single` mód egyszerre egy nyitott panelt engedne, a panelen viszont
 *   a felhasználónak több szakaszt is nyitva kell tudnia tartani;
 * - a `cloneElement` alapú, privát propokon átadott állapot típusbiztosan
 *   csak `as` kényszerítéssel írható le, amit a projekt tilt - ehelyett az
 *   `AccordionItem` saját állapotot tart, és `defaultOpen` propot fogad.
 *
 * A CSS ettől függetlenül bájtra átkerült (lásd `accordion.css`), tehát a
 * variánsok később prop nélkül is bevezethetők.
 */
export function Accordion(properties: Readonly<AccordionProperties>): ReactElement {
  const { children, className } = properties;
  return <div className={joinClassNames('accordion', className)}>{children}</div>;
}
