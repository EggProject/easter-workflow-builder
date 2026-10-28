import { SelectField, type SelectFieldOption } from '@easter-workflow-builder/ui';
import { useId, useState, type ReactElement } from 'react';
import { CLIENT_ROUTE_TABLE } from '../client-route/client-route-table.ts';
import { UNDO_MODIFIER_PREFERENCES, type UndoModifierPreference } from '../graph-editor/undo-modifier-preference.ts';
import {
  getBrowserLocalStorage,
  readUndoModifierPreference,
  storeUndoModifierPreference,
} from '../graph-editor/undo-modifier-storage.ts';

/**
 * A három opció felirata a döntés szövegével (SPEC-008 5.10 "A választó",
 * O-31). A `Record` a beállítás uniójára kulcsolt, tehát egy új érték
 * felirat nélkül nem fordul le.
 */
const UNDO_MODIFIER_PREFERENCE_LABELS = {
  auto: 'Automatikus (macOS-en Cmd, máshol Ctrl)',
  ctrl: 'Ctrl',
  meta: 'Cmd',
} as const satisfies Readonly<Record<UndoModifierPreference, string>>;

/**
 * Az opciók a `UNDO_MODIFIER_PREFERENCES` sorrendjében: elöl az
 * alapértelmezés.
 */
const UNDO_MODIFIER_OPTIONS: readonly SelectFieldOption<UndoModifierPreference>[] = UNDO_MODIFIER_PREFERENCES.map(
  (value) => ({ value, label: UNDO_MODIFIER_PREFERENCE_LABELS[value] }),
);

/**
 * A Beállítások gráf szerkesztő kártyája (SPEC-008 5.11, O-32; SPEC-009 3.1
 * 6. pont, változatlan): egyetlen `preference-row` sor a visszavonás/újra
 * billentyű módosítójának választójával. A design system admin `settings.html`
 * mintáját követi; a kártya a `packages/ui` `Card` komponensének szerkezete
 * (`.card`, `.card__header`, `<h3>`), mert a komponens a gyerekeit `<p>`
 * elembe teszi, amiben a választó `<div>` gyökere nem állhat.
 *
 * A kártya címe a szerkesztő útvonalának felirata, mert a beállítás a
 * szerkesztő billentyűire hat; a név így nem kerül második listába
 * (`.claude/CLAUDE.md` 5. szekció).
 *
 * A választás azonnal, hálózati kérés nélkül a tárolóba íródik (SPEC-008
 * 5.10); a szerkesztő a következő betöltésekor olvassa. Betöltéskor a
 * választó a tárolt értéket, hiányzó vagy hibás érték és dobó tároló esetén
 * az alapértelmezett Automatikus értéket mutatja.
 */
export function EditorSettingsCard(): ReactElement {
  const headingId = useId();
  const selectId = useId();
  const [preference, setPreference] = useState<UndoModifierPreference>(() =>
    readUndoModifierPreference(getBrowserLocalStorage),
  );

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card__header">
        <h3 id={headingId}>{CLIENT_ROUTE_TABLE.graphEditor.label}</h3>
      </div>
      <div className="preference-row">
        <div className="preference-row__body">
          <label className="preference-row__title" htmlFor={selectId}>
            Visszavonás/újra billentyű módosítója
          </label>
        </div>
        <SelectField
          id={selectId}
          size="sm"
          options={UNDO_MODIFIER_OPTIONS}
          value={preference}
          onChange={(nextPreference) => {
            storeUndoModifierPreference(getBrowserLocalStorage, nextPreference);
            setPreference(nextPreference);
          }}
        />
      </div>
    </section>
  );
}
