import { UnhandledErrorPolicySchema, type UnhandledErrorPolicy } from '@easter-workflow-builder/protocol';
import { SelectField } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { useFieldError } from './use-field-error.ts';

export interface UnhandledErrorPolicyFieldProperties {
  readonly value: UnhandledErrorPolicy | null;
  readonly onChange: (nextValue: UnhandledErrorPolicy) => void;
}

/**
 * A csomópont kezeletlen hiba szabálya (`onUnhandledError`: `fail_run` vagy
 * `fail_branch`, SPEC-004 8.3). Mind a tíz típus `config` alakjának tetején
 * áll, ezért a `NodeInspector` egyetlen helyen, a törzs első mezőjeként
 * rajzolja, nem a típus szerinti komponensek (SPEC-008 5.2, O-29).
 *
 * Kötelezően választandó mező: a tárolt `null` (még nem választott) a
 * `SelectField` helyőrző feliratát mutatja, a lista pedig csak a séma két
 * értékét tartalmazza, tehát választás után üresre visszaállni nem lehet
 * (user döntés 2026-10-14). A mentési séma a `null` értéket a mező alatt
 * jelzi (SPEC-008 5.4).
 */
export function UnhandledErrorPolicyField(properties: Readonly<UnhandledErrorPolicyFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const error = useFieldError('onUnhandledError');

  return (
    <SelectField
      size="sm"
      label="Kezeletlen hiba szabálya"
      error={error}
      placeholder="Válassz…"
      options={UnhandledErrorPolicySchema.options.map((option) => ({ value: option, label: option }))}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
