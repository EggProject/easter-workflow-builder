import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactElement } from 'react';
import './tag-input.css';

export type TagInputTone = 'blue' | 'ink' | 'yolk' | 'paper';

/**
 * A címkéző mező bejelentései és az eltávolító gomb neve. A forrás
 * `TagInput.jsx` ezeket angolul, beégetve adja; a `labels` prop az egyetlen
 * kiegészítés a forráshoz képest, hogy a magyar felület a saját szövegét
 * adhassa (a `PaginationLabels` mintája). Az alapérték a forrás szövege
 * (`TAG_INPUT_SOURCE_LABELS`).
 */
export interface TagInputLabels {
  /**
   * A hozzáadás után a képernyőolvasónak bejelentett mondat (forrás:
   * `Added <címke>`).
   */
  readonly added: (tag: string) => string;
  /**
   * Az eltávolítás után bejelentett mondat (forrás: `Removed <címke>`).
   */
  readonly removed: (tag: string) => string;
  /**
   * A címke eltávolító gombjának hozzáférhető neve (forrás:
   * `Remove <címke>`).
   */
  readonly remove: (tag: string) => string;
}

export const TAG_INPUT_SOURCE_LABELS: TagInputLabels = {
  added: (tag) => `Added ${tag}`,
  removed: (tag) => `Removed ${tag}`,
  remove: (tag) => `Remove ${tag}`,
};

/**
 * A forrás `TagInput` propjai, egy az egyben: `value`, `onChange`,
 * `placeholder`, `tone`, `separators`, `className` és `ariaLabel`, plusz a
 * `labels` kiegészítés.
 */
export interface TagInputProperties {
  /**
   * A mostani címkék; a komponens vezérelt, a változást az `onChange`
   * adja vissza.
   */
  readonly value?: readonly string[];
  readonly onChange?: (value: readonly string[]) => void;
  /**
   * A beviteli mező helykitöltője, amíg nincs címke.
   */
  readonly placeholder?: string;
  readonly tone?: TagInputTone;
  /**
   * A címkét lezáró billentyűk (`KeyboardEvent.key`).
   */
  readonly separators?: readonly string[];
  readonly className?: string;
  /**
   * A beágyazott beviteli mező hozzáférhető neve; üres szövegnél a
   * forrás szerint `Tags`.
   */
  readonly ariaLabel?: string;
  readonly labels?: TagInputLabels;
}

const NO_TAGS: readonly string[] = [];
const DEFAULT_SEPARATORS: readonly string[] = ['Enter', ','];

/**
 * A design system `.tagi` címkéző mezőjének React változata
 * (`eggproject-design-components/components/tag-input/TagInput.jsx`), a
 * forrás szerkezetével: a lekerekített címkék és a szabad szöveges mező
 * egy keretben, a burkolóra kattintás a mezőre fókuszál, a hozzáadást és az
 * eltávolítást egy rejtett `role="status"` régió jelenti be. A címke a
 * lezáró billentyűre vagy a fókusz elvesztésekor kerül be; a már meglévő
 * címke és az üres szöveg nem. Eltérés a forrástól: a lezáró billentyű
 * vizsgálatának redundáns második tagja (a `,` külön ellenőrzése) nincs
 * átemelve, mert az eredménye nem tér el az első tagétól.
 */
export function TagInput(properties: Readonly<TagInputProperties>): ReactElement {
  const {
    value = NO_TAGS,
    onChange,
    placeholder = 'Add a tag…',
    tone = 'blue',
    separators = DEFAULT_SEPARATORS,
    className,
    ariaLabel = 'Tags',
    labels = TAG_INPUT_SOURCE_LABELS,
  } = properties;

  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputReference = useRef<HTMLInputElement>(null);

  const addTag = (raw: string): void => {
    const trimmed = raw.trim().replace(/,$/, '');
    if (trimmed === '') {
      return;
    }
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange?.([...value, trimmed]);
    setDraft('');
    setAnnouncement(labels.added(trimmed));
  };

  const removeTag = (index: number, tag: string): void => {
    onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
    setAnnouncement(labels.removed(tag));
  };

  const lastTag = value.at(-1);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (separators.includes(event.key)) {
      event.preventDefault();
      addTag(draft);
    } else if (lastTag !== undefined && draft === '' && event.key === 'Backspace') {
      removeTag(value.length - 1, lastTag);
    }
  };

  return (
    // A burkoló kattintása csak a beágyazott mezőre fókuszál (az egér elérhetőség a forrás
    // szerint); a billentyűs elérést maga a mező adja.
    <div
      className={className === undefined ? 'tagi' : `tagi ${className}`}
      onClick={() => inputReference.current?.focus()}
    >
      {value.map((tag, index) => (
        <span key={`${tag}-${String(index)}`} className={`tagi__tag tagi__tag--${tone}`}>
          <span className="tagi__tag-text">{tag}</span>
          <button
            type="button"
            className="tagi__tag-x"
            onClick={(event) => {
              event.stopPropagation();
              removeTag(index, tag);
            }}
            aria-label={labels.remove(tag)}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputReference}
        className="tagi__input"
        value={draft}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setDraft(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          addTag(draft);
        }}
        placeholder={value.length > 0 ? '' : placeholder}
        aria-label={ariaLabel === '' ? 'Tags' : ariaLabel}
      />
      <span className="tagi__status" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
