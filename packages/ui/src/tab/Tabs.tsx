import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import './tab.css';

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  /**
   * Opcionális darabszám a felirat mellett, `.tabs__count` pirulában.
   */
  readonly count?: number;
  /**
   * A fülhöz tartozó panel tartalma. Minden panel felcsatolva marad, az
   * inaktívakat a natív `hidden` attribútum rejti el, tehát a bennük álló
   * állapot nem vész el fülváltáskor.
   */
  readonly content?: ReactNode;
}

export interface TabsProperties {
  readonly items: readonly TabItem[];
  /**
   * Kontrollált mód: a jelenlegi fül azonosítója. Hiányában a komponens
   * saját állapotot vezet (nem kontrollált mód).
   */
  readonly active?: string;
  readonly onChange?: (id: string) => void;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
}

/**
 * A roving tabindex következő célja: `ArrowRight`, `ArrowLeft`, `Home` és
 * `End` billentyűre körbeérő mozgás. Nem kezelt billentyűre `undefined`,
 * tehát a hívó ilyenkor nem hív `preventDefault()` hívást, és a natív
 * viselkedés megmarad. Az írásirány megfordítja a bal és a jobb nyilat.
 */
function resolveRovingTarget(
  ids: readonly string[],
  currentId: string,
  key: string,
  isRightToLeft: boolean,
): string | undefined {
  const index = ids.indexOf(currentId);
  const forward = isRightToLeft ? -1 : 1;
  switch (key) {
    case 'ArrowRight': {
      return ids[(index + forward + ids.length) % ids.length];
    }
    case 'ArrowLeft': {
      return ids[(index - forward + ids.length) % ids.length];
    }
    case 'Home': {
      return ids[0];
    }
    case 'End': {
      return ids.at(-1);
    }
    default: {
      return undefined;
    }
  }
}

/**
 * A design-token `.tabs` aláhúzott fülsor (SPEC-007 6.2, T-008-14),
 * `role="tablist"` és `role="tab"` szemantikával, saját `role="tabpanel"`
 * panelekkel, roving tabindexszel és automatikus aktiválással.
 *
 * Kontrollált és nem kontrollált módot is ismer: `active` prop jelenlétében
 * a hívó birtokolja az értéket, hiányában a komponens. Ha a kért azonosító
 * nincs (már) a listában, az első fülre esik vissza; ez a visszaesés
 * `onChange` hívást soha nem vált ki.
 *
 * A forrás `Tabs.jsx` `Segmented` és `Pills` exportja nincs átemelve, mert
 * azok radiogroup szemantikájú, önálló komponensek (SPEC-007 6.1). A forrás
 * `.tabs-root` burkoló eleme is elmarad: a forrás CSS nem definiál hozzá
 * szabályt, a komponens pedig csak olyan osztálynevet írhat ki, ami a
 * mellette álló CSS-ben áll (SPEC-007 16. szekció 21. kritérium).
 */
export function Tabs(properties: Readonly<TabsProperties>): ReactElement {
  const { items, active, onChange, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy } = properties;

  const isControlled = active !== undefined;
  const ids = items.map((item) => item.id);
  const firstId = ids[0];

  const [internalActive, setInternalActive] = useState<string | undefined>(firstId);
  const requestedId = isControlled ? active : internalActive;
  const currentId = requestedId !== undefined && ids.includes(requestedId) ? requestedId : firstId;

  // Nem kontrollált módban a visszaesést el is tároljuk, hogy egy törölt,
  // majd újra felvett fül ne támasszon fel egy elavult belső azonosítót.
  useEffect(() => {
    if (isControlled) {
      return;
    }
    if (internalActive !== currentId) {
      setInternalActive(currentId);
    }
  }, [isControlled, internalActive, currentId]);

  const tabElements = useRef(new Map<string, HTMLButtonElement>());
  const automaticId = useId();
  const tabDomId = (index: number): string => `${automaticId}-tab-${String(index)}`;
  const panelDomId = (index: number): string => `${automaticId}-panel-${String(index)}`;

  const select = (nextId: string): void => {
    if (nextId === currentId) {
      return;
    }
    if (!isControlled) {
      setInternalActive(nextId);
    }
    onChange?.(nextId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string): void => {
    const isRightToLeft = globalThis.getComputedStyle(event.currentTarget).direction === 'rtl';
    const targetId = resolveRovingTarget(ids, id, event.key, isRightToLeft);
    if (targetId === undefined) {
      return;
    }
    event.preventDefault();
    select(targetId);
    tabElements.current.get(targetId)?.focus();
  };

  return (
    <>
      <div className="tabs" role="tablist" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
        {items.map((tab, index) => {
          const isCurrent = tab.id === currentId;
          return (
            <button
              type="button"
              key={tab.id}
              ref={(element) => {
                if (element === null) {
                  tabElements.current.delete(tab.id);
                } else {
                  tabElements.current.set(tab.id, element);
                }
              }}
              role="tab"
              id={tabDomId(index)}
              aria-selected={isCurrent}
              aria-controls={panelDomId(index)}
              tabIndex={isCurrent ? 0 : -1}
              className={isCurrent ? 'is-on' : undefined}
              onClick={() => {
                select(tab.id);
              }}
              onKeyDown={(event) => {
                handleKeyDown(event, tab.id);
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && <span className="tabs__count">{tab.count}</span>}
            </button>
          );
        })}
      </div>
      <div className="tabs__panels">
        {items.map((tab, index) => (
          <div
            key={tab.id}
            className="tabs__panel"
            role="tabpanel"
            id={panelDomId(index)}
            aria-labelledby={tabDomId(index)}
            hidden={tab.id !== currentId}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </>
  );
}
