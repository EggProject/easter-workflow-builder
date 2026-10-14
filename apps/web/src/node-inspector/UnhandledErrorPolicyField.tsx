import { UnhandledErrorPolicySchema, type UnhandledErrorPolicy } from '@easter-workflow-builder/protocol';
import { SelectField } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { useFieldError } from './use-field-error.ts';

export interface UnhandledErrorPolicyFieldProperties {
  readonly value: UnhandledErrorPolicy | null;
  readonly onChange: (nextValue: UnhandledErrorPolicy | null) => void;
}

/**
 * A csomópont kezeletlen hiba szabálya (`onUnhandledError`: `fail_run` vagy
 * `fail_branch`, SPEC-004 8.3). Mind a tíz típus `config` alakjának tetején
 * áll, ezért a `NodeInspector` egyetlen helyen, a törzs első mezőjeként
 * rajzolja, nem a típus szerinti komponensek (SPEC-008 5.2, O-29).
 *
 * Az opciók a panel meglévő zárt listás mezőinek mintáját követik: az üres
 * opció kisbetűs leírás, a tárolt alakja `null`, a többi a séma értéke. A
 * mentési séma a `null` értéket a mező alatt jelzi (SPEC-008 5.4); a
 * megjelenés szabálya a `SelectField` saját, a többi mezővel közös szabálya.
 */
export function UnhandledErrorPolicyField(properties: Readonly<UnhandledErrorPolicyFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const error = useFieldError('onUnhandledError');

  return (
    <SelectField
      size="sm"
      label="Kezeletlen hiba szabálya"
      error={error}
      options={[
        { value: '', label: 'nincs beállítva' },
        ...UnhandledErrorPolicySchema.options.map((option) => ({ value: option, label: option })),
      ]}
      value={value ?? ''}
      onChange={(nextValue) => {
        // A `nextValue` itt `'' | UnhandledErrorPolicy`; a `.find` az üres
        // ("nincs beállítva") értéket szűri ki, ugyanúgy, mint az
        // `AgentStepConfigFields` nullázható választó mezői.
        const matched = UnhandledErrorPolicySchema.options.find((option) => option === nextValue);
        // eslint-disable-next-line unicorn/no-null -- az `onUnhandledError: UnhandledErrorPolicy | null` `null` értéke jelenti a "nincs beállítva" állapotot.
        onChange(matched ?? null);
      }}
    />
  );
}
