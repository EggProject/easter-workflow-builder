import type { ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';

export interface SelectFieldOptionRowProperties {
  readonly id: string;
  readonly label: string;
  readonly isSelected: boolean;
  /**
   * A billentyűzettel megjelölt opció (`aria-activedescendant`), ami NEM
   * azonos a kiválasztottal: a panelen a jelölés lépked, a kiválasztás
   * csak `Enter` / `Space` / kattintás hatására változik.
   */
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: () => void;
  /**
   * Egérmozgás egy másik, engedélyezett opció fölött: az lesz az aktív.
   */
  readonly onActivate: () => void;
}

/**
 * Egy sor a `SelectField` listbox paneljében: a design system `Select.jsx`
 * opció sorának pontos alakja (`.menu__item` a `.menu__check` pipa hellyel
 * és a `.menu__text` felirattal), `role="option"` szerepben. Saját fájlban
 * áll, mert a `SelectField` fő függvényének a kognitív összetettsége enélkül
 * a megengedett fölé nőne.
 */
export function SelectFieldOptionRow(properties: Readonly<SelectFieldOptionRowProperties>): ReactElement {
  const { id, label, isSelected, isActive, isDisabled, onSelect, onActivate } = properties;

  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled ? true : undefined}
      className={joinClassNames('menu__item', isActive && 'is-active', isDisabled && 'is-disabled')}
      onClick={onSelect}
      onMouseMove={() => {
        if (!isActive && !isDisabled) {
          onActivate();
        }
      }}
    >
      <span className="menu__check">
        {isSelected && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3.5 8 3 3 6-6.5" />
          </svg>
        )}
      </span>
      <span className="menu__text">{label}</span>
    </div>
  );
}
