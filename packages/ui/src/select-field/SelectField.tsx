import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { useFieldErrorVisibility } from '../field-error-visibility/use-field-error-visibility.ts';
import { computePanelPosition, type PanelPosition } from '../menu/compute-panel-position.ts';
import { isInsideMenu } from '../menu/is-inside-menu.ts';
// A panel a design system `.menu` osztályát viseli, ahogy a forrás
// `select.css` `@import url('../menu/menu.css')` sora is előírja.
import '../menu/menu.css';
// A `.field`, a `.field__label` és a `.field__error` osztály a `text-field`
// téma CSS-éé; a `SelectField` a címkés/hibás alakjában ugyanezt a burkolót
// használja, ezért a témát is be kell töltenie, hogy egy csak `SelectField`-et
// használó felületen se maradjon stílus nélkül a címke és a hibaüzenet.
import '../text-field/text-field.css';
import { findNextEnabledIndex } from './find-next-enabled-index.ts';
import { SelectFieldOptionRow } from './SelectFieldOptionRow.tsx';
import { useScrollActiveOptionIntoView } from './use-scroll-active-option-into-view.ts';
import './select-field.css';

export type SelectFieldSize = 'sm' | 'md';

export interface SelectFieldOption<TValue extends string = string> {
  readonly value: TValue;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectFieldProperties<TValue extends string = string> {
  readonly options: readonly SelectFieldOption<TValue>[];
  /**
   * A kiválasztott opció értéke. Vezérelt mező: ha az érték egyetlen
   * opcióval sem egyezik, a trigger a `placeholder` feliratot mutatja.
   * Szándékosan `string`, nem `TValue`: a hívó adhat olyan kiindulóértéket
   * (tipikusan üres sztringet), amihez nem tartozik opció.
   */
  readonly value: string;
  /**
   * A kiválasztás visszajelzése. A forrás `Select.jsx` szerződését követi:
   * a kiválasztott opció ÉRTÉKÉT kapja, nem DOM eseményt. Az érték típusa a
   * megadott opciólistából következik, ezért a hívónak nem kell sztringből
   * visszaszűkítenie: a szűkítés hamis ága úgyis sosem futna.
   */
  readonly onChange: (value: TValue) => void;
  /**
   * A design system `.select--sm` módosítója.
   */
  readonly size?: SelectFieldSize;
  /**
   * A trigger felirata, amíg az érték egyetlen opcióval sem egyezik. NEM
   * hoz létre opciót: ha a mező üríthető is legyen, a hívó tegyen a listába
   * egy üres értékű opciót (így az `onChange` értéktípusa is pontos marad).
   */
  readonly placeholder?: string;
  /**
   * Betöltő állapot: a mező letiltva, a lista üres, és a `loadingLabel`
   * felirat áll a triggerben (SPEC-007 11. szekció 4. async pont).
   */
  readonly loading?: boolean;
  /**
   * A betöltő állapot felirata; a szöveg a hívóé, a komponens nem ismer
   * nyelvet.
   */
  readonly loadingLabel?: string;
  /**
   * A mező letiltása. A forrás `Select` komponensének nincs ilyen propja
   * (csak a `Combobox`-nak), nálunk viszont a `loading` állapot ezen
   * keresztül tiltja le a triggert, és a hívók is használják.
   */
  readonly disabled?: boolean;
  /**
   * A mező fölött álló, nagybetűs címke szövege, a `TextField` `label`
   * propjának pontos párja. A trigger `aria-labelledby` hivatkozással
   * kötődik hozzá, mert a `<button>` nem címkézhető elem, tehát a `<label>`
   * burkoló nem adna neki hozzáférhető nevet.
   */
  readonly label?: string | undefined;
  /**
   * Hibaüzenet: egyben hibás állapotba is állítja a mezőt. A `TextField`
   * mintáját követi (`aria-invalid`, `aria-describedby`), hogy a két mező
   * hibajelzése ugyanúgy viselkedjen; a MEGJELENÉS szabályát ugyanaz a
   * `useFieldErrorVisibility` adja (érintett vagy már megkísérelt beküldés).
   */
  readonly error?: string | undefined;
  readonly id?: string;
  readonly className?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
}

const NO_OPTIONS: readonly SelectFieldOption<never>[] = [];

/**
 * A design system `Select` komponense: `.select` osztályú `<button>`
 * trigger a kiválasztott felirattal és a `.select__caret` chevronnal, alatta
 * `.menu` panel `role="listbox"` szerepben (forrás:
 * `eggproject-design-components/components/select/Select.jsx`).
 *
 * MIÉRT EZ, ÉS NEM A NATÍV `<select>`. A forrás `select.css` két változatot
 * ismer ugyanarra a `.select` héjra. A natív `<select>` retrofit a forrás
 * saját szavai szerint a STATIKUS oldalaké ("the native <select> retrofit on
 * static pages uses the platform control"), és a platform indikátorát
 * rajzolja, ami a jobb szegélyre tapad; a React trigger a `.select__caret`
 * SVG-t a `padding: 10px 14px` belső térközön belül helyezi el. Mérve
 * (`docs/research/2026-09-09-select-chevron-meres.md`): a chevron
 * középpontja a referencián 22px-re, a natív retrofiton 9px-re áll a mező
 * jobb szélétől. Mi React alkalmazás vagyunk, tehát a forrás React
 * változata jár - felhasználói döntés, 2026-09-09.
 *
 * ELTÉRÉS A FORRÁSTÓL, PORTÁL. A panel `createPortal`-lal a
 * `document.body`-ba kerül, `position: fixed` alakban, a trigger
 * `getBoundingClientRect()`-jéből nyitáskor számított koordinátákkal
 * (`computePanelPosition`) - nem a `.menu-anchor` gyermekeként, ahogy a
 * forrás teszi. Az ok ugyanaz a mért, valódi hiba, amit a `Menu` is így
 * kezel: a mezők görgethető konténerekben ülnek (a node inspector jobb
 * oldali sávja és a modális törzse egyaránt `overflow-y: auto`), ami a
 * forrás relatív pozícionálású paneljét levágná. A panel szélessége a
 * triggeré, hogy a lenyíló a mező alá igazodjon.
 *
 * MARADÉK KORLÁT, a `Menu`-ével azonos: a pozíció csak NYITÁSKOR
 * számolódik, tehát ha a görgethető ős a panel nyitott állapotában
 * görgetne, a panel nem követi.
 *
 * A FORRÁSBÓL NEM KERÜLT ÁT: az `icon` (vezető ikon a triggerben), a `meta`
 * (opció melletti gyorsparancs felirat) és az `align` prop - a jelen
 * felhasználási esetek egyiket sem igénylik.
 *
 * Billentyűzet, a forrás szerint: zárva `Enter` / `Space` / `ArrowDown`
 * nyit az első engedélyezett (vagy a kiválasztott) opcióra, `ArrowUp` az
 * utolsóra. Nyitva `ArrowDown` / `ArrowUp` lép körbeérve, `Home` / `End` az
 * első / utolsó engedélyezett opcióra ugrik, `Enter` / `Space` választ,
 * `Escape` zár és a fókuszt a triggerre állítja vissza, `Tab` zár és
 * továbbengedi a fókuszt. A DOM fókusz végig a triggeren marad, az aktív
 * opciót az `aria-activedescendant` jelöli.
 */
export function SelectField<TValue extends string = string>(
  properties: Readonly<SelectFieldProperties<TValue>>,
): ReactElement {
  const {
    options,
    value,
    onChange,
    size = 'md',
    placeholder,
    loading = false,
    loadingLabel,
    disabled = false,
    className,
    label,
    error,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
  } = properties;

  const automaticId = useId();
  const resolvedId = id ?? automaticId;
  const labelId = `${resolvedId}-label`;
  const errorId = `${resolvedId}-error`;
  const panelId = `${resolvedId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, bottom: undefined, left: 0 });
  const [panelWidth, setPanelWidth] = useState(0);
  const anchorReference = useRef<HTMLSpanElement | null>(null);
  const triggerReference = useRef<HTMLButtonElement | null>(null);
  const panelReference = useRef<HTMLDivElement | null>(null);

  const { isErrorVisible, markTouched } = useFieldErrorVisibility(error);

  // A betöltő állapot a `loadingLabel` feliratot teszi a placeholder
  // helyére, és üresre cseréli a listát.
  const placeholderLabel = loading ? loadingLabel : placeholder;
  const listOptions: readonly SelectFieldOption<TValue>[] = loading ? NO_OPTIONS : options;

  const selectedIndex = listOptions.findIndex((option) => option.value === value);
  const currentOption = listOptions.find((option) => option.value === value);
  const isPlaceholderShown = currentOption === undefined;
  const triggerLabel = currentOption?.label ?? placeholderLabel ?? '';
  // Az aktív opció keresése a sorszáma szerint. A `.find` azért kell az
  // indexelés helyett, mert az `activeIndex` a -1 értéket is felveheti
  // (nyitva: nincs egyetlen engedélyezett opció sem), és így ez az eset a
  // keresés természetes "nincs találat" ága, nem egy külön, nem futó elágazás.
  const activeOption = listOptions.find((_option, index) => index === activeIndex);
  // Nyitáskor a kiválasztott opcióra állunk, ha az engedélyezett; különben a
  // megadott szélső (első vagy utolsó) engedélyezett opcióra.
  const isSelectedUsable = currentOption !== undefined && currentOption.disabled !== true;
  const activeIndexOnOpenDown = isSelectedUsable ? selectedIndex : findNextEnabledIndex(listOptions, -1, 1);
  const activeIndexOnOpenUp = isSelectedUsable
    ? selectedIndex
    : findNextEnabledIndex(listOptions, listOptions.length, -1);

  const optionId = (index: number): string => `${resolvedId}-option-${String(index)}`;
  // Egy helyen dől el, hogy van-e látható címke: a trigger és a panel
  // ugyanarra a `field__label` elemre hivatkozik.
  const labelledBy = label === undefined ? undefined : labelId;

  const closePanel = useCallback((shouldRestoreFocus: boolean): void => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (shouldRestoreFocus) {
      triggerReference.current?.focus();
    }
  }, []);

  // Kattintás a panelen és a triggeren kívülre zár, fókusz-visszaállítás
  // nélkül. `mousedown`-on figyelünk (nem `click`-en), hogy a záró kattintás
  // előbb fusson le, mint egy másik trigger saját nyitása.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent): void {
      if (!isInsideMenu(anchorReference.current, panelReference.current, event.target)) {
        closePanel(false);
      }
    }
    globalThis.addEventListener('mousedown', handlePointerDown);
    return () => {
      globalThis.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, closePanel]);

  useScrollActiveOptionIntoView(isOpen, activeIndex, panelReference);

  function openPanel(triggerElement: HTMLButtonElement, nextActiveIndex: number): void {
    const triggerRect = triggerElement.getBoundingClientRect();
    setPanelPosition(computePanelPosition(triggerRect, 'left', globalThis.innerWidth, globalThis.innerHeight));
    setPanelWidth(triggerRect.width);
    setActiveIndex(nextActiveIndex);
    setIsOpen(true);
  }

  function selectOption(option: SelectFieldOption<TValue>): void {
    if (option.disabled === true) {
      return;
    }
    onChange(option.value);
    closePanel(true);
  }

  function selectActiveOption(): void {
    if (activeOption === undefined) {
      return;
    }
    selectOption(activeOption);
  }

  // Az `activeIndex` nyitott panelen csak akkor -1, ha egyetlen
  // engedélyezett opció sincs; a keresés ilyenkor a kiindulóponttól
  // függetlenül -1-et ad, ezért a forrás kiindulópont-korrekciója
  // (`dir > 0 ? -1 : 0`) itt nem hozna más eredményt.
  function moveActive(step: 1 | -1): void {
    const nextIndex = findNextEnabledIndex(listOptions, activeIndex, step);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }

  function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    // A billentyűzetből származó kattintás (`detail === 0`) nem nyit: azt a
    // `keydown` ág már lekezelte.
    if (event.detail === 0) {
      return;
    }
    if (isOpen) {
      closePanel(false);
      return;
    }
    openPanel(event.currentTarget, activeIndexOnOpenDown);
  }

  function handleClosedKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ': {
        event.preventDefault();
        openPanel(event.currentTarget, activeIndexOnOpenDown);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        openPanel(event.currentTarget, activeIndexOnOpenUp);
        break;
      }
      default: {
        break;
      }
    }
  }

  function handleOpenKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        moveActive(1);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        moveActive(-1);
        break;
      }
      case 'Home': {
        event.preventDefault();
        setActiveIndex(findNextEnabledIndex(listOptions, -1, 1));
        break;
      }
      case 'End': {
        event.preventDefault();
        setActiveIndex(findNextEnabledIndex(listOptions, listOptions.length, -1));
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        selectActiveOption();
        break;
      }
      case 'Escape': {
        event.preventDefault();
        closePanel(true);
        break;
      }
      // A `Tab` zár, de nem nyeli el: a fókusz normálisan tovább lép.
      case 'Tab': {
        closePanel(false);
        break;
      }
      default: {
        break;
      }
    }
  }

  return (
    <div className="field">
      {label !== undefined && (
        <span className="field__label" id={labelId}>
          {label}
        </span>
      )}
      <span ref={anchorReference} className="menu-anchor" style={{ display: 'inline-block', width: '100%' }}>
        <button
          type="button"
          ref={triggerReference}
          id={resolvedId}
          className={joinClassNames(
            'select',
            size === 'sm' && 'select--sm',
            isOpen && 'select--open',
            isErrorVisible && 'select--error',
            className,
          )}
          disabled={loading || disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-invalid={isErrorVisible ? true : undefined}
          aria-describedby={joinAriaTokenList(ariaDescribedBy, isErrorVisible ? errorId : undefined)}
          onClick={handleTriggerClick}
          onKeyDown={isOpen ? handleOpenKeyDown : handleClosedKeyDown}
          onBlur={markTouched}
        >
          <span className={joinClassNames('select__value', isPlaceholderShown && 'select__value--placeholder')}>
            {triggerLabel}
          </span>
          <svg
            className="select__caret"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </span>
      {createPortal(
        <div
          ref={panelReference}
          id={panelId}
          className="menu select__panel"
          role="listbox"
          aria-labelledby={labelledBy}
          hidden={!isOpen}
          style={{
            top: panelPosition.top,
            bottom: panelPosition.bottom,
            left: panelPosition.left,
            width: panelWidth,
          }}
        >
          {listOptions.map((option, index) => (
            <SelectFieldOptionRow
              key={option.value}
              id={optionId(index)}
              label={option.label}
              isSelected={option.value === value}
              isActive={index === activeIndex}
              isDisabled={option.disabled === true}
              onSelect={() => {
                selectOption(option);
              }}
              onActivate={() => {
                setActiveIndex(index);
              }}
            />
          ))}
        </div>,
        document.body,
      )}
      {isErrorVisible && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
