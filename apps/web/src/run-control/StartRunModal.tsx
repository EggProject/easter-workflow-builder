import type { StartInputField } from '@easter-workflow-builder/protocol';
import { Alert, Button, FieldErrorVisibilityContext, Modal, TextField } from '@easter-workflow-builder/ui';
import { useEffect, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import {
  buildInitialStartRunValues,
  buildStartRunInput,
  findStartRunValueErrors,
  type StartRunValues,
} from './start-run-values.ts';

export interface StartRunModalProperties {
  readonly open: boolean;
  /**
   * A `start` csomópont bemeneti mezői (`readStartInputFields`). A modális
   * NEM dönt a megnyitásról: üres lista esetén a hívó egyáltalán nem nyitja
   * meg, hanem közvetlenül indít (SPEC-008 6.5, AC28).
   */
  readonly fields: readonly StartInputField[];
  /**
   * Folyamatban van-e az indítás (9. szekció 5. async pont).
   */
  readonly isSubmitting: boolean;
  /**
   * A szerver oldali indítás hibája, ha volt.
   */
  readonly errorMessage: string | undefined;
  readonly onClose: () => void;
  readonly onSubmit: (input: Readonly<Record<string, unknown>>) => void;
}

const FORM_DOM_ID = 'start-run-form';

/**
 * A futás indításának modálisa, a `start` csomópont `inputFields` listájából
 * épített mezőkkel (SPEC-008 6.5, AC28). A `workflow-list` három modálisának
 * már bevált mintáját követi: a mezők a törzsben, a két gomb a lábban, a
 * küldés alatt letiltva.
 *
 * A HIBAÜZENET KIZÁRÓLAG A MEZŐ ALATT áll, összesítő nincs a törzs tetején
 * (`.claude/CLAUDE.md` 11. szekció). A megjelenés szabályát a `packages/ui`
 * `field-error-visibility` témája adja: érintett és érvénytelen, VAGY már volt
 * egy sikertelen beküldési kísérlet és érvénytelen. A "volt már kísérlet"
 * tényt a `FieldErrorVisibilityContext` viszi le a mezőkhöz. A szerver oldali
 * hiba ezzel szemben NEM mezőszintű (a `StartRunRequest` alakját a szerver
 * ellenőrzi), ezért az a láb fölött, a design system `danger` `Alert`
 * blokkjában áll (`role="alert"`, SPEC-007 8.4, user döntés 2026-09-24).
 *
 * A mezők `TextField` elemek, mert a `StartInputField.valueKind`
 * értékkészletét egyetlen forrás sem sorolja fel (lásd a `start-run-values.ts`
 * `StartRunValues` doksiját), tehát egy `valueKind` szerint váltó mezőtípus
 * tippelés lenne.
 */
export function StartRunModal(properties: Readonly<StartRunModalProperties>): ReactElement {
  const { open, fields, isSubmitting, errorMessage, onClose, onSubmit } = properties;

  const [values, setValues] = useState<StartRunValues>({});
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(buildInitialStartRunValues(fields));
    setIsSubmitAttempted(false);
    // A `fields` szándékosan nincs a dependency listán: a mezőlista a modális
    // MEGNYITÁSÁNAK pillanatában érvényes gráfból származik, és a
    // `readStartInputFields` minden renderen új tömb hivatkozást ad, ami
    // körkörös újraindítást okozna. A projekt ESLint konfigurációja nem
    // tartalmazza a `react-hooks/exhaustive-deps` szabályt.
  }, [open]);

  const errors = findStartRunValueErrors(fields, values);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (errors.size > 0) {
      setIsSubmitAttempted(true);
      return;
    }
    onSubmit(buildStartRunInput(values));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Futás indítása"
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button type="submit" form={FORM_DOM_ID} isLoading={isSubmitting} disabled={isSubmitting}>
            Indítás
          </Button>
        </>
      }
    >
      <FieldErrorVisibilityContext.Provider value={isSubmitAttempted}>
        {/* `noValidate`: a beküldés ellenőrzése a saját, a szabálykönyv 11.
            szekciója szerinti szabályon megy (a hibaüzenet a MEZŐ ALATT áll).
            Enélkül a böngésző natív ellenőrzése a `required` mezőn még a
            `submit` esemény ELŐTT megállítaná a beküldést, a saját buborékával,
            és a mező alatti üzenet sosem jelenne meg. A `required` attribútum
            marad a mezőn, mert az a kötelezőség HOZZÁFÉRHETŐSÉGI jelzése. */}
        <form id={FORM_DOM_ID} noValidate onSubmit={handleSubmit}>
          {fields.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              value={values[field.name] ?? ''}
              required={field.required}
              error={errors.get(field.name)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setValues((previous) => ({ ...previous, [field.name]: event.target.value }));
              }}
            />
          ))}
        </form>
      </FieldErrorVisibilityContext.Provider>
      {/* A `<form>` elemen kívül, a modális törzs közvetlen gyerekeként, hogy
          a forrás `.modal__body > * + *` térköze elválassza a mezőktől. */}
      {errorMessage !== undefined && <Alert variant="danger">{errorMessage}</Alert>}
    </Modal>
  );
}
