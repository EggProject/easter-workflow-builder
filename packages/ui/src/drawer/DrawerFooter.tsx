import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import './drawer.css';

export interface DrawerFooterProperties extends Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'aria-labelledby' | 'aria-describedby'
> {
  /**
   * A tapadó akciósáv tartalma (jellemzően gombok).
   */
  readonly children?: ReactNode;
}

/**
 * A design system `drawer` komponensének tapadó akciósávja
 * (`eggproject-design-components/components/drawer/Drawer.jsx`: `<div
 * className="drawer__footer">{footer}</div>`): felső elválasztó, emelt
 * háttér, jobbra igazított gombok. A modális `Drawer` egésze nem került át,
 * az indok a `DrawerBody.tsx` fejlécében áll.
 *
 * **Kiegészítés a forráshoz: `role`, `aria-labelledby`, `aria-describedby`**
 * (2026-09-25). A forrásban a lábléc a modális `role="dialog"` panel része,
 * tehát a gombjai a dialógus nevéhez tartoznak; nem modális elhelyezésben ezt
 * a köteléket a hívónak kell kimondania, például `role="group"` és a gombok
 * tárgyára mutató `aria-labelledby` párral (W3C WCAG ARIA17: a csoport neve a
 * csoport minden vezérlőjének közös címkéje). Megadás nélkül a kimenet a
 * forráséval azonos.
 */
export function DrawerFooter(properties: Readonly<DrawerFooterProperties>): ReactElement {
  const { children, ...aria } = properties;
  return (
    <div className="drawer__footer" {...aria}>
      {children}
    </div>
  );
}
