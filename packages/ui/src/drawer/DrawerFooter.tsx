import type { ReactElement, ReactNode } from 'react';
import './drawer.css';

export interface DrawerFooterProperties {
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
 */
export function DrawerFooter(properties: Readonly<DrawerFooterProperties>): ReactElement {
  return <div className="drawer__footer">{properties.children}</div>;
}
