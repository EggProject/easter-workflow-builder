import { useContext, type ReactElement, type ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { MenuCloseContext } from './menu-close-context.ts';

export interface MenuItemProperties {
  /**
   * Veszélyes (pl. törlő) művelet jelölése: `.menu__item--danger`,
   * piros szöveg.
   */
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: () => void;
  readonly children: ReactNode;
}

/**
 * Egy sor a `Menu` panelen belül. `role="menuitem"`; a kezdő roving
 * `tabIndex` értékét a befoglaló `Menu` állítja be DOM-szinten
 * (`querySelectorAll` plusz `tabIndex` írás), ezért itt mindig `-1` indul.
 * Kiválasztáskor (kattintás vagy natív `Enter`/`Space` aktiváció) előbb az
 * `onSelect` fut, utána a `Menu` kontextusból kapott záró függvény - ez
 * zárja a panelt és állítja vissza a fókuszt a triggerre (lásd `Menu.tsx`
 * dokumentációja).
 */
export function MenuItem(properties: Readonly<MenuItemProperties>): ReactElement {
  const { danger = false, disabled = false, onSelect, children } = properties;
  const requestClose = useContext(MenuCloseContext);

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      className={joinClassNames('menu__item', danger && 'menu__item--danger')}
      onClick={() => {
        onSelect?.();
        requestClose();
      }}
    >
      <span className="menu__text">{children}</span>
    </button>
  );
}
