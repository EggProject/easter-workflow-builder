/**
 * A listbox panel `optionIndex`-edik opció elemét adja vissza, feltétel
 * nélkül.
 *
 * Ugyanaz a minta, mint a `menu/read-panel-element.ts`: a panel mindig
 * renderelve van (zárva a `hidden` attribútum rejti), és az `activeIndex`
 * kizárólag a `findNextEnabledIndex` eredményéből származik ugyanarra az
 * opciólistára, tehát a hiányzó elem esete a komponensen keresztül NEM
 * idézhető elő. Egy `if (option === undefined) return;` ág a hívási helyen
 * ezért soha nem futó, tesztelhetetlen branch-et vinne be, ami a 100
 * százalékos, kizárás nélküli lefedettségi küszöböt sértené; ide kiemelve
 * viszont szintetikus DOM-mal közvetlenül tesztelhető.
 */
export function readOptionElement(panel: HTMLElement, optionIndex: number): HTMLElement {
  const option = panel.querySelectorAll('[role="option"]').item(optionIndex);
  if (!(option instanceof HTMLElement)) {
    throw new TypeError('a select opció nincs csatolva a DOM-hoz');
  }
  return option;
}
