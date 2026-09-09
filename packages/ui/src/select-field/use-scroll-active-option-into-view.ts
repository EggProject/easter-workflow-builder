import { useEffect, type RefObject } from 'react';
import { readPanelElement } from '../menu/read-panel-element.ts';
import { readOptionElement } from './read-option-element.ts';

/**
 * A listbox panel aktív opcióját a látható sávba görgeti, a DOM fókusz
 * mozgatása nélkül (az a triggeren marad, az aktív opciót az
 * `aria-activedescendant` jelöli). Azonnali, `behavior: 'smooth'` nélkül,
 * tehát a csökkentett mozgás beállítás nem érinti.
 *
 * Nem csinál semmit zárt panelen, és akkor sem, ha nincs aktív opció
 * (`activeIndex` -1: a lista üres, vagy minden opciója letiltott).
 */
export function useScrollActiveOptionIntoView(
  isOpen: boolean,
  activeIndex: number,
  panelReference: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }
    readOptionElement(readPanelElement(panelReference), activeIndex).scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex, panelReference]);
}
